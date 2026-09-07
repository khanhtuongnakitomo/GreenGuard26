"""Explicit opt-in RVM v2 serial transport.

The controller refuses the legacy firmware because the legacy protocol treats
``0`` as emergency stop and has no acknowledgement contract.  Commands are
sent only after an exact ``RVM-V2`` handshake and are never retried
automatically.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

try:
    from decision_core import FINAL_SIGNALS
except ModuleNotFoundError:  # source-checkout tests; bundle supplies runtime/src
    pc_src = Path(__file__).resolve().parents[2] / "pc-demo" / "src"
    if str(pc_src) not in sys.path:
        sys.path.insert(0, str(pc_src))
    from decision_core import FINAL_SIGNALS

PROTOCOL_VERSION = "RVM-V2"
HANDSHAKE_BYTE = b"?"
EMERGENCY_BYTE = b"!"


class RVMSerialController:
    def __init__(self, cfg: dict):
        self.enabled = bool(cfg.get("enabled", False))
        self.port = cfg.get("port", "auto")
        self.baud = int(cfg.get("baud", 115200))
        self.timeout_s = float(cfg.get("timeout_s", 1.0))
        # Handshake/reset reads should fail quickly, but a complete physical
        # route can legitimately wait on several motors and sensors.  Keep
        # that operation deadline separate so ACK is not mistaken for a
        # completed route and a running machine is not reported failed after
        # the one-second connection timeout.
        self.command_timeout_s = float(cfg.get("command_timeout_s", 180.0))
        if self.timeout_s <= 0 or self.command_timeout_s <= 0:
            raise ValueError("serial timeouts must be positive")
        self.connected = False
        self.handshake_ok = False
        self._serial = None

    def connect(self) -> bool:
        if not self.enabled:
            return False
        try:
            import serial
            from serial.tools import list_ports
        except ImportError:
            return False

        port = self.port
        if port == "auto":
            devices = [item.device for item in list_ports.comports()]
            # Ambiguous auto-selection is unsafe for a machine controller.
            if len(devices) != 1:
                return False
            port = devices[0]
        if not port:
            return False

        try:
            self._serial = serial.Serial(port, self.baud, timeout=self.timeout_s)
            self._serial.reset_input_buffer()
            self._serial.write(HANDSHAKE_BYTE)
            self._serial.flush()
            identity = self._serial.readline().decode("ascii", errors="replace").strip()
            if identity != PROTOCOL_VERSION:
                self.close()
                return False
        except (OSError, serial.SerialException, UnicodeError):
            self.close()
            return False
        self.handshake_ok = True
        self.connected = bool(self._serial and self._serial.is_open)
        return self.connected

    def _read_line(self) -> str:
        if self._serial is None:
            return ""
        return self._serial.readline().decode("ascii", errors="replace").strip()

    def _wait_for_done(self, signal: int) -> bool:
        """Ignore firmware progress lines until DONE/ERR or timeout."""
        deadline = time.monotonic() + max(self.command_timeout_s, 0.05)
        expected = f"DONE:{signal}"
        original_timeout = getattr(self._serial, "timeout", None)
        while time.monotonic() < deadline:
            remaining = max(deadline - time.monotonic(), 0.01)
            if original_timeout is not None:
                self._serial.timeout = min(float(original_timeout), remaining)
            line = self._read_line()
            if line == expected:
                if original_timeout is not None:
                    self._serial.timeout = original_timeout
                return True
            if line.startswith("ERR"):
                if original_timeout is not None:
                    self._serial.timeout = original_timeout
                return False
        if original_timeout is not None:
            self._serial.timeout = original_timeout
        return False

    def send_signal(self, signal: int) -> bool:
        if signal not in FINAL_SIGNALS:
            return False
        if not self.enabled or not self.handshake_ok or self._serial is None or not self.connected:
            return False
        encoded = str(int(signal)).encode("ascii")
        try:
            self._serial.write(encoded)
            self._serial.flush()
            ack = self._read_line()
            if ack != f"ACK:{signal}":
                return False
            return self._wait_for_done(signal)
        except (OSError, UnicodeError):
            return False

    def emergency_stop(self) -> bool:
        if not self.enabled or not self.handshake_ok or self._serial is None or not self.connected:
            return False
        try:
            self._serial.write(EMERGENCY_BYTE)
            self._serial.flush()
            return True
        except OSError:
            return False

    def reset_emergency(self) -> bool:
        """Send the explicit firmware reset and require RESET-OK."""
        if not self.enabled or not self.handshake_ok or self._serial is None or not self.connected:
            return False
        try:
            self._serial.write(b"R")
            self._serial.flush()
            deadline = time.monotonic() + max(self.timeout_s, 0.05)
            original_timeout = getattr(self._serial, "timeout", None)
            while time.monotonic() < deadline:
                remaining = max(deadline - time.monotonic(), 0.01)
                if original_timeout is not None:
                    self._serial.timeout = min(float(original_timeout), remaining)
                line = self._read_line()
                if line == "RESET-OK":
                    if original_timeout is not None:
                        self._serial.timeout = original_timeout
                    return True
                if line.startswith("ERR"):
                    if original_timeout is not None:
                        self._serial.timeout = original_timeout
                    return False
            if original_timeout is not None:
                self._serial.timeout = original_timeout
            return False
        except (OSError, UnicodeError):
            return False

    # Compatibility shim for callers that only need the transport primitive.
    # Production workflow code uses send_signal/emergency_stop explicitly.
    def send(self, command: str) -> bool:
        if command == "!":
            return self.emergency_stop()
        if command in {"0", "1", "2"}:
            return self.send_signal(int(command))
        return False

    def close(self) -> None:
        if self._serial is not None:
            try:
                self._serial.close()
            except OSError:
                pass
        self._serial = None
        self.connected = False
        self.handshake_ok = False
