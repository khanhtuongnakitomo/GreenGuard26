"""Fail-closed one-byte transport for the fixed-camera RVM workflow."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Any, Callable


RESULT_TO_BYTE = {
    "CANS": b"1",
    "ALUMINUM_CAN": b"1",
    "GOOD": b"2",
    "PET_CLEAN": b"2",
    "BAD": b"3",
    "PET_REJECT": b"3",
}


def command_byte(result_name: str) -> bytes:
    try:
        return RESULT_TO_BYTE[str(result_name)]
    except KeyError as exc:
        raise ValueError(f"unsupported machine result: {result_name!r}") from exc


def is_usb_serial_device(info: Any) -> bool:
    """Recognize USB serial entries returned by pyserial on Windows."""
    if getattr(info, "is_usb", False):
        return True
    if getattr(info, "vid", None) is not None:
        return True
    fields = " ".join(
        str(getattr(info, field, ""))
        for field in ("hwid", "description", "manufacturer", "product")
    ).upper()
    return "USB" in fields


@dataclass(frozen=True)
class SendOutcome:
    result: str
    payload: bytes
    transport: str
    port: str | None = None


class SerialTransport:
    """Select one configured/USB port and never retry a failed write."""

    def __init__(
        self,
        cfg: dict | None = None,
        *,
        stdout=None,
        stderr=None,
        serial_module=None,
        port_enumerator: Callable[[], list[Any]] | None = None,
    ):
        self.cfg = cfg or {}
        self.stdout = sys.stdout if stdout is None else stdout
        self.stderr = sys.stderr if stderr is None else stderr
        self.serial_module = serial_module
        self.port_enumerator = port_enumerator
        self.connection = None
        self.port_name: str | None = None

    def _load_serial(self):
        if self.serial_module is None:
            import serial

            self.serial_module = serial
        return self.serial_module

    def _serial_cfg(self) -> dict:
        return self.cfg.get("serial", self.cfg)

    def _configured_port(self) -> str | None:
        value = self._serial_cfg().get("port") or self._serial_cfg().get("configured_port")
        return str(value) if value else None

    def _baudrate(self) -> int:
        value = int(self._serial_cfg().get("baudrate", 115200))
        if value != 115200:
            raise ValueError("machine transport requires 115200 baud")
        return value

    def _ports(self) -> list[Any]:
        if self.port_enumerator is not None:
            return list(self.port_enumerator())
        try:
            serial = self._load_serial()
            return list(serial.tools.list_ports.comports())
        except (ImportError, AttributeError, OSError):
            return []

    def select_port(self) -> str | None:
        configured = self._configured_port()
        if configured:
            return configured
        usb = [str(info.device) for info in self._ports() if is_usb_serial_device(info)]
        return usb[0] if len(usb) == 1 else None

    def _close(self) -> None:
        if self.connection is not None:
            try:
                self.connection.close()
            finally:
                self.connection = None
                self.port_name = None

    def refresh_idle(self) -> str | None:
        """Re-evaluate selection during idle without producing a command."""
        selected = self.select_port()
        if selected is None:
            self._close()
            return None
        if self.connection is not None and self.port_name == selected and getattr(self.connection, "is_open", True):
            return selected
        self._close()
        try:
            serial = self._load_serial()
        except (ImportError, AttributeError, OSError) as exc:
            print(f"serial support unavailable: {exc}", file=self.stderr)
            return None
        try:
            self.connection = serial.Serial(
                port=selected,
                baudrate=self._baudrate(),
                timeout=0,
                write_timeout=1,
            )
            self.port_name = selected
            return selected
        except Exception as exc:  # pyserial exposes platform-specific errors.
            self.connection = None
            self.port_name = None
            print(f"serial unavailable on {selected}: {exc}", file=self.stderr)
            return None

    def _fallback(self, result_name: str, payload: bytes) -> SendOutcome:
        self.stdout.write(payload.decode("ascii") + "\n")
        self.stdout.flush()
        return SendOutcome(result_name, payload, "terminal")

    def send(self, result_name: str) -> SendOutcome:
        """Recheck immediately before result and emit exactly one byte/line."""
        payload = command_byte(result_name)
        selected = self.refresh_idle()
        if self.connection is None:
            return self._fallback(result_name, payload)
        try:
            self.connection.write(payload)
            self.connection.flush()
            return SendOutcome(result_name, payload, "serial", selected)
        except Exception as exc:  # one failed write is terminal for this event.
            print(f"serial write failed on {selected}: {exc}; terminal fallback", file=self.stderr)
            self._close()
            return self._fallback(result_name, payload)

    def close(self) -> None:
        self._close()
