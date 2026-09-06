import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from serial_controller import RVMSerialController  # noqa: E402
from workflow import SignalLatch  # noqa: E402


def test_serial_is_disabled_by_default():
    controller = RVMSerialController({"enabled": False, "port": "auto", "baud": 115200})
    assert controller.enabled is False
    assert controller.connect() is False
    assert controller.send("1") is False


def test_signal_latch_never_sends_when_serial_disabled():
    controller = RVMSerialController({"enabled": False})
    latch = SignalLatch()
    assert latch.send_once(controller, "1") is False
    assert latch.sent is False
