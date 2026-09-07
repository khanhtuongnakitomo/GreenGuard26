from __future__ import annotations

import sys
import types
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

from serial_controller import RVMSerialController  # noqa: E402


class FakeSerial:
    def __init__(self, port, baudrate, timeout):
        self.port, self.baudrate, self.timeout = port, baudrate, timeout
        self.is_open = True
        self.writes = []
        self.lines = [b"RVM-V2\n", b"ACK:0\n", b"moving M1\n", b"moving M2\n", b"DONE:0\n"]

    def reset_input_buffer(self):
        return None

    def write(self, value):
        self.writes.append(value)

    def flush(self):
        return None

    def readline(self):
        return self.lines.pop(0) if self.lines else b""

    def close(self):
        self.is_open = False


def install_fake_serial(monkeypatch, serial_factory, devices):
    serial_mod = types.ModuleType("serial")
    serial_mod.Serial = serial_factory
    serial_mod.SerialException = OSError
    tools_mod = types.ModuleType("serial.tools")
    ports_mod = types.ModuleType("serial.tools.list_ports")
    ports_mod.comports = lambda: devices
    tools_mod.list_ports = ports_mod
    serial_mod.tools = tools_mod
    monkeypatch.setitem(sys.modules, "serial", serial_mod)
    monkeypatch.setitem(sys.modules, "serial.tools", tools_mod)
    monkeypatch.setitem(sys.modules, "serial.tools.list_ports", ports_mod)


def test_v2_handshake_progress_lines_ack_done_and_no_resend(monkeypatch):
    fake = None

    def factory(*args, **kwargs):
        nonlocal fake
        fake = FakeSerial(*args, **kwargs)
        return fake

    install_fake_serial(monkeypatch, factory, [type("P", (), {"device": "COM9"})()])
    controller = RVMSerialController({
        "enabled": True,
        "port": "auto",
        "baud": 115200,
        "timeout_s": 0.2,
        "command_timeout_s": 15.0,
    })
    assert controller.timeout_s == 0.2
    assert controller.command_timeout_s == 15.0
    assert controller.connect() is True
    assert fake.writes == [b"?"]
    assert controller.send_signal(0) is True
    assert fake.writes == [b"?", b"0"]
    assert controller.send_signal(3) is False
    assert fake.writes == [b"?", b"0"]


def test_err_before_done_is_failure_without_resend(monkeypatch):
    class ErrSerial(FakeSerial):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.lines = [b"RVM-V2\n", b"ACK:1\n", b"ERR:blocked\n"]

    fake = None

    def factory(*args, **kwargs):
        nonlocal fake
        fake = ErrSerial(*args, **kwargs)
        return fake

    install_fake_serial(monkeypatch, factory, [type("P", (), {"device": "COM9"})()])
    controller = RVMSerialController({"enabled": True, "port": "auto", "timeout_s": 0.2})
    assert controller.connect() is True
    assert controller.send_signal(1) is False
    assert fake.writes == [b"?", b"1"]


def test_legacy_identity_is_rejected(monkeypatch):
    class Legacy(FakeSerial):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.lines = [b"=================================\n"]

    install_fake_serial(monkeypatch, Legacy, [type("P", (), {"device": "COM9"})()])
    controller = RVMSerialController({"enabled": True, "port": "auto"})
    assert controller.connect() is False
    assert controller.connected is False


def test_ambiguous_auto_selection_is_rejected(monkeypatch):
    devices = [type("P", (), {"device": "COM9"})(), type("P", (), {"device": "COM10"})()]
    install_fake_serial(monkeypatch, FakeSerial, devices)
    controller = RVMSerialController({"enabled": True, "port": "auto"})
    assert controller.connect() is False
