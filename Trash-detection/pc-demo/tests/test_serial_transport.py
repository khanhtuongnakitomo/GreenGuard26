"""Exact serial selection, byte, and terminal fallback tests."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from serial_transport import SerialTransport, command_byte  # noqa: E402


class Port:
    def __init__(self, device, *, vid=None, description=""):
        self.device = device
        self.vid = vid
        self.description = description
        self.hwid = ""
        self.manufacturer = ""
        self.product = ""


class FakeSerial:
    def __init__(self, *, fail=False, **kwargs):
        self.kwargs = kwargs
        self.writes = []
        self.flushes = 0
        self.closed = False
        self.fail = fail
        self.is_open = True

    def write(self, payload):
        if self.fail:
            raise OSError("write failed")
        self.writes.append(payload)
        return 1

    def flush(self):
        self.flushes += 1

    def close(self):
        self.closed = True
        self.is_open = False


class SerialModule:
    def __init__(self, *, fail=False):
        self.instances = []
        self.fail = fail

    def Serial(self, **kwargs):
        instance = FakeSerial(fail=self.fail, **kwargs)
        self.instances.append(instance)
        return instance


def transport(cfg, ports, *, serial=None):
    return SerialTransport(
        cfg,
        stdout=io.StringIO(),
        stderr=io.StringIO(),
        serial_module=serial,
        port_enumerator=lambda: ports,
    )


def test_result_mapping_is_name_only_and_exact_ascii_byte():
    assert command_byte("CANS") == b"1"
    assert command_byte("GOOD") == b"2"
    assert command_byte("BAD") == b"3"
    assert command_byte("ALUMINUM_CAN") == b"1"
    with pytest.raises(ValueError):
        command_byte("0")


def test_configured_com_wins_without_enumerating_ports():
    module = SerialModule()
    calls = []
    item = transport({"serial": {"port": "COM7"}}, [Port("COM8", vid=10)], serial=module)
    item.port_enumerator = lambda: calls.append(True) or []
    outcome = item.send("CANS")
    assert outcome.transport == "serial"
    assert outcome.port == "COM7"
    assert calls == []
    assert module.instances[0].kwargs["baudrate"] == 115200


def test_exactly_one_usb_port_is_selected_but_zero_or_multiple_fall_back():
    module = SerialModule()
    one = transport({}, [Port("COM4", vid=123)], serial=module)
    assert one.select_port() == "COM4"
    zero = transport({}, [Port("COM4", description="Bluetooth")], serial=module)
    assert zero.send("GOOD").transport == "terminal"
    many = transport({}, [Port("COM4", vid=1), Port("COM5", vid=2)], serial=module)
    assert many.send("BAD").transport == "terminal"


def test_serial_success_writes_one_raw_byte_flushes_and_keeps_stdout_empty():
    module = SerialModule()
    item = transport({}, [Port("COM4", vid=123)], serial=module)
    outcome = item.send("GOOD")
    assert outcome.payload == b"2"
    assert module.instances[0].writes == [b"2"]
    assert module.instances[0].flushes == 1
    assert item.stdout.getvalue() == ""


def test_terminal_fallback_writes_exactly_one_line():
    item = transport({}, [])
    outcome = item.send("BAD")
    assert outcome.transport == "terminal"
    assert item.stdout.getvalue() == "3\n"


def test_write_failure_closes_and_falls_back_once_without_retry():
    module = SerialModule(fail=True)
    item = transport({}, [Port("COM4", vid=123)], serial=module)
    outcome = item.send("CANS")
    assert outcome.transport == "terminal"
    assert item.stdout.getvalue() == "1\n"
    assert module.instances[0].closed is True
    assert len(module.instances) == 1
    assert "write failed" in item.stderr.getvalue()
