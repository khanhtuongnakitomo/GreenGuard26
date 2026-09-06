"""Small opt-in wrapper around the legacy one-byte RVM controller."""
from __future__ import annotations

import time


class RVMSerialController:
    def __init__(self, cfg: dict):
        self.enabled = bool(cfg.get("enabled", False))
        self.port = cfg.get("port", "auto")
        self.baud = int(cfg.get("baud", 115200))
        self.connected = False
        self._serial = None

    def connect(self) -> bool:
        if not self.enabled:
            return False
        import serial

        port = self.port
        if port == "auto":
            port = next((p.device for p in serial.tools.list_ports.comports()), None)
        if not port:
            return False
        self._serial = serial.Serial(port, self.baud, timeout=0.2)
        self.connected = bool(self._serial.is_open)
        return self.connected

    def send(self, command: str) -> bool:
        if not self.enabled or self._serial is None or not self.connected:
            return False
        self._serial.write(command.encode("ascii"))
        self._serial.flush()
        time.sleep(0.02)
        return True

    def close(self) -> None:
        if self._serial is not None:
            self._serial.close()
        self.connected = False
