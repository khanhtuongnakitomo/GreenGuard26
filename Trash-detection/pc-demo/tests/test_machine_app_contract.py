"""Fixed-camera entrypoint and UI boundary tests."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import machine_app  # noqa: E402
import machine_ui  # noqa: E402
from gate import M1FrameResult  # noqa: E402


class Cap:
    def __init__(self, opened):
        self.opened = opened
        self.released = False

    def isOpened(self):
        return self.opened

    def release(self):
        self.released = True


class LiveCap(Cap):
    def read(self):
        return True, np.zeros((120, 160, 3), dtype=np.uint8)


def test_machine_cli_has_no_source_or_camera_switch_argument():
    with pytest.raises(SystemExit):
        machine_app.parse_args(["--source", "0"])


def test_machine_camera_uses_index_one_and_same_index_backend_fallback():
    calls = []
    captures = [Cap(False), Cap(True)]

    def factory(*args):
        calls.append(args)
        return captures.pop(0)

    assert machine_app.open_machine_camera(factory, 1) is not None
    assert calls == [(1, machine_app.cv2.CAP_DSHOW), (1,)]


def test_camera_failure_is_fail_closed_before_pipeline_or_transport_init():
    calls = []

    def factory(*args):
        del args
        return Cap(False)

    def forbidden(*args):
        calls.append(args)
        raise AssertionError("must not initialize after camera failure")

    assert machine_app.run([], camera_factory=factory, pipeline_factory=forbidden, transport_factory=forbidden) == 2
    assert calls == []


def test_machine_headless_smoke_with_mocked_camera_and_transport():
    class FakeTransport:
        def refresh_idle(self):
            return None

        def send(self, result):
            raise AssertionError(f"no command expected for missing object: {result}")

        def close(self):
            pass

    class FakeM1:
        def run(self, frame):
            del frame
            return M1FrameResult()

    class FakeM2:
        def run(self, frame, poly):
            del frame, poly
            return []

    cap = LiveCap(True)
    assert machine_app.run(
        ["--headless", "--auto-start", "--max-frames", "1"],
        camera_factory=lambda *args: cap,
        pipeline_factory=lambda config: (FakeM1(), FakeM2()),
        transport_factory=lambda config, stdout, stderr: FakeTransport(),
    ) == 0
    assert cap.released is True


def test_machine_ui_contains_only_allowed_operator_text(monkeypatch):
    captured = []
    original = machine_ui.cv2.putText

    def record(image, text, *args):
        captured.append(str(text))
        return original(image, text, *args)

    monkeypatch.setattr(machine_ui.cv2, "putText", record)
    frame = np.zeros((240, 320, 3), dtype=np.uint8)
    machine_ui.render(frame, "DETECTING...", "", True)
    machine_ui.render(frame, "BAD", "BAD", True)
    joined = " ".join(captured).lower()
    for forbidden in ("confidence", "fps", "legend", "camera", "switch", "cap", "label", "ring"):
        assert forbidden not in joined
    assert {"RUN", "PAUSE", "DETECTING...", "BAD"}.issubset(set(captured))


def test_public_testing_launchers_share_pc_app_and_do_not_initialize_serial():
    root = Path(__file__).resolve().parents[2]
    launchers = {path.name for path in root.glob("*.bat")}
    assert launchers == {
        "demo_model1.bat",
        "demo_model1_candidate.bat",
        "demo-model1-b.bat",
        "compare_model1.bat",
        "demo_model2.bat",
        "full_demo.bat",
        "full-workflow-machine.bat",
    }
    for name in ("demo_model1.bat", "demo_model2.bat", "full_demo.bat"):
        text = (root / name).read_text(encoding="utf-8").lower()
        assert "pc-demo" in text
        assert "src\\app.py" in text
        assert "serial" not in text
    for name in ("demo_model1_candidate.bat", "demo-model1-b.bat", "compare_model1.bat"):
        text = (root / name).read_text(encoding="utf-8").lower()
        assert "serial" not in text


def test_model1_b_is_a_standalone_challenger_launcher():
    root = Path(__file__).resolve().parents[2]
    text = (root / "demo-model1-b.bat").read_text(encoding="utf-8").lower()
    assert "src\\app.py --mode model1 --config m1_candidate" in text
    assert "models\\candidates\\m1_efficient_current.onnx" in text
    assert "mode full" not in text
    assert "mode model2" not in text
    assert "serial" not in text
