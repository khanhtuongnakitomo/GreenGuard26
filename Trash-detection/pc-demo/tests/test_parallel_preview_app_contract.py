from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import app  # noqa: E402
from gate import M2Hit  # noqa: E402
import ui  # noqa: E402


class Cap:
    def __init__(self):
        self.released = False

    def isOpened(self):
        return True

    def read(self):
        return True, np.zeros((32, 32, 3), dtype=np.uint8)

    def release(self):
        self.released = True


def test_qr_screen_renders_a_payload_without_referencing_a_switch_banner(monkeypatch):
    class Encoder:
        def encode(self, _payload):
            return np.asarray([[0, 1], [1, 0]], dtype=np.uint8)

    monkeypatch.setattr(ui.cv2, "QRCodeEncoder_create", lambda: Encoder())
    frame = np.zeros((320, 480, 3), dtype=np.uint8)

    ui.draw_qr_screen(
        frame,
        '{"expiresAt":"2100-01-01T00:00:00Z"}',
        {"items": [], "totalItems": 0, "totalPoints": 0},
    )

    assert frame.any()


def test_q_key_finalizes_a_paused_session_and_opens_its_claim_qr(monkeypatch):
    cap = Cap()
    rendered = []
    keys = iter([ord("q"), ord("x")])
    finalized = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

    class FakeM2:
        pass

    class FakeDashboard:
        def __init__(self, api_url, machine_code):
            del api_url, machine_code

        def check_health(self):
            pass

        def get_latest_session(self):
            return None

        def finalize_session(self):
            finalized.append(True)
            return {
                "session": {
                    "qrPayload": '{"claimToken":"demo","expiresAt":"2100-01-01T00:00:00Z"}',
                    "items": [{"itemType": "pet_clean", "quantity": 2}],
                    "totalItems": 2,
                    "totalPoints": 20,
                    "status": "unclaimed",
                }
            }

        def close(self):
            pass

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "DashboardTransport", FakeDashboard)
    monkeypatch.setattr(app, "draw_qr_screen", lambda frame, payload, session: rendered.append((payload, session.copy())))
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(app.cv2, "namedWindow", lambda *args: None)
    monkeypatch.setattr(app.cv2, "setMouseCallback", lambda *args: None)
    monkeypatch.setattr(app.cv2, "resizeWindow", lambda *args: None)
    monkeypatch.setattr(app.cv2, "imshow", lambda *args: None)
    monkeypatch.setattr(app.cv2, "destroyAllWindows", lambda: None)
    monkeypatch.setattr(app.cv2, "waitKey", lambda _delay: next(keys))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "app.py", "--mode", "parallel-preview", "--publish-dashboard", "--require-dashboard",
            "--dashboard-api-url", "http://127.0.0.1:3003", "--session-mode", "manual",
        ],
    )

    assert app.main() == 0
    assert finalized == [True]
    assert rendered == [
        ('{"claimToken":"demo","expiresAt":"2100-01-01T00:00:00Z"}', {
            "items": [{"itemType": "pet_clean", "quantity": 2}],
            "totalItems": 2,
            "totalPoints": 20,
            "status": "unclaimed",
            "qrPayload": '{"claimToken":"demo","expiresAt":"2100-01-01T00:00:00Z"}',
        })
    ]


def test_result_notification_expires_after_two_seconds():
    expires_at = 12.0
    assert app._result_notification_visible(expires_at, 11.999)
    assert not app._result_notification_visible(expires_at, 12.0)


def test_emergency_stop_sends_only_the_stop_command_to_the_controller():
    sent = []

    class FakeController:
        def send(self, command):
            sent.append(command)

    app._send_emergency_stop(FakeController())

    assert sent == ["EMERGENCY_STOP"]


def test_parallel_preview_ignores_dashboard_environment_and_never_constructs_transport(monkeypatch):
    cap = Cap()

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

        def run_preview(self, frame, conf):
            del frame, conf
            return SimpleNamespace(label="NONE", confidence=0.0, accepted=False, poly=None, color=(160, 160, 160))

    class FakeM2:
        def run_all(self, frame, conf):
            del frame, conf
            return []

    def forbidden_transport(*args, **kwargs):
        raise AssertionError("parallel-preview must not construct DashboardTransport")

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(app, "DashboardTransport", forbidden_transport)
    monkeypatch.setenv("DASHBOARD_API_URL", "http://127.0.0.1:9")
    monkeypatch.setattr(sys, "argv", ["app.py", "--mode", "parallel-preview", "--headless", "--auto-start", "--max-frames", "1"])

    assert app.main() == 0
    assert cap.released is True


def test_app_wait_clear_calls_runner_with_m1_conf_keyword(monkeypatch):
    cap = Cap()
    seen = []
    progress = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

        def run_preview(self, frame, conf):
            del frame, conf
            return SimpleNamespace(label="NONE", confidence=0.0, accepted=False, poly=None, color=(160, 160, 160))

    class FakeM2:
        def run_all(self, frame, conf):
            del frame, conf
            return []

    class FakeRunner:
        def __init__(self, m1, m2):
            del m1, m2

        def infer_m1(self, frame, *, m1_conf=None):
            del frame
            seen.append(m1_conf)
            return SimpleNamespace(label="NONE", confidence=0.0, accepted=False, poly=None, color=(160, 160, 160))

        def close(self):
            pass

    class FakePreview:
        window_size = 4
        clear_frames = 8
        m2_thresholds = {"cap": 0.5, "label": 0.5, "ring": 0.3}
        phase = "WAIT_CLEAR"

        def reset(self):
            self.phase = "WAIT_CLEAR"

        def pause(self):
            self.phase = "WAIT_CLEAR"

        def update_clear(self, m1, now):
            del now
            progress.append(m1.label)
            return SimpleNamespace(
                phase="WAIT_CLEAR",
                m1=m1,
                m2_hits=(),
                result="",
                m1_average=None,
                m2_averages={},
                progress=len(progress),
                preview_signal=None,
                new_result=False,
            )

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "ParallelInferenceRunner", FakeRunner)
    monkeypatch.setattr(app, "ParallelPreviewWorkflow", lambda **kwargs: FakePreview())
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(sys, "argv", ["app.py", "--mode", "parallel-preview", "--headless", "--auto-start", "--max-frames", "1"])

    assert app.main() == 0
    assert seen == [None]
    assert progress == ["NONE"]
    assert cap.released is True


def test_parallel_preview_publishes_each_completed_result_once(monkeypatch):
    cap = Cap()
    transports = []
    result_statuses = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

        def run_preview(self, frame, conf):
            del frame, conf
            return SimpleNamespace(
                label="PET",
                confidence=0.91,
                accepted=True,
                poly=np.asarray([[2, 2], [8, 2], [8, 8], [2, 8]], dtype=np.int32),
                color=(0, 255, 0),
            )

    class FakeM2:
        def run_all(self, frame, conf):
            del frame, conf
            return [
                M2Hit(
                    name="ring",
                    confidence=0.31,
                    polygon=np.asarray([[2, 2], [8, 2], [8, 8], [2, 8]], dtype=np.float32),
                    class_id=2,
                )
            ]

    class FakeDashboard:
        def __init__(self, api_url, machine_code):
            self.api_url = api_url
            self.machine_code = machine_code
            self.health_checks = 0
            self.sent = []
            self.closed = False
            transports.append(self)

        def check_health(self):
            self.health_checks += 1

        def send(self, result, **metrics):
            self.sent.append((result, metrics))

        def close(self):
            self.closed = True

    def record_result(_frame, result, signal, status="NOT SENT"):
        result_statuses.append((result, signal, status))

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "DashboardTransport", FakeDashboard)
    monkeypatch.setattr(app, "draw_preview_result", record_result)
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "app.py",
            "--mode",
            "parallel-preview",
            "--headless",
            "--auto-start",
            "--max-frames",
            "3",
            "--publish-dashboard",
            "--dashboard-api-url",
            "http://127.0.0.1:3003",
            "--machine-code",
            "0001",
            "--require-dashboard",
        ],
    )

    assert app.main() == 0
    assert len(transports) == 1
    assert transports[0].health_checks == 1
    assert len(transports[0].sent) == 1
    result, metrics = transports[0].sent[0]
    assert result == "PET_REJECT"
    assert metrics["confidence"] == 0.31
    assert metrics["fps"] > 0.0
    assert metrics["latency_ms"] >= 0.0
    assert transports[0].closed is True
    assert result_statuses == [("BAD PET", 2, "DASHBOARD ONLY")] * 3
    assert cap.released is True


def test_preview_dashboard_result_mapping_and_confidence():
    assert app._preview_dashboard_result("ALUMINUM") == "ALUMINUM_CAN"
    assert app._preview_dashboard_result("GOOD PET") == "PET_CLEAN"
    assert app._preview_dashboard_result("BAD PET") == "PET_REJECT"
    assert app._preview_event_confidence(
        SimpleNamespace(result="GOOD PET", m2_hits=(), m1_average=0.83, m1=None)
    ) == 0.83
    assert app._preview_event_confidence(
        SimpleNamespace(
            result="BAD PET",
            m2_hits=(SimpleNamespace(confidence=0.31), SimpleNamespace(confidence=0.72)),
            m1_average=None,
            m1=None,
        )
    ) == 0.72


def test_parallel_preview_sends_controller_before_dashboard_once(monkeypatch):
    cap = Cap()
    order = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

        def run_preview(self, frame, conf):
            del frame, conf
            return SimpleNamespace(
                label="ALUMINUM",
                confidence=0.91,
                accepted=True,
                poly=np.asarray([[2, 2], [8, 2], [8, 8], [2, 8]], dtype=np.int32),
                color=(0, 255, 0),
            )

    class FakeM2:
        def run_all(self, frame, conf):
            del frame, conf
            return [
                M2Hit(
                    name="ring",
                    confidence=0.31,
                    polygon=np.asarray([[2, 2], [8, 2], [8, 8], [2, 8]], dtype=np.float32),
                    class_id=2,
                )
            ]

    class FakeController:
        def __init__(self, cfg, *, output_mode):
            del cfg
            assert output_mode == "terminal"

        def send(self, result):
            order.append(("controller", result))

        def close(self):
            pass

    class FakeDashboard:
        def __init__(self, api_url, machine_code):
            del api_url, machine_code

        def check_health(self):
            pass

        def send(self, result, **metrics):
            del metrics
            order.append(("dashboard", result))

        def close(self):
            pass

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "SerialTransport", FakeController)
    monkeypatch.setattr(app, "DashboardTransport", FakeDashboard)
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "app.py",
            "--mode",
            "parallel-preview",
            "--headless",
            "--auto-start",
            "--max-frames",
            "3",
            "--publish-dashboard",
            "--require-dashboard",
            "--dashboard-api-url",
            "http://127.0.0.1:3003",
            "--controller-output",
            "terminal",
        ],
    )

    assert app.main() == 0
    assert order == [("controller", "ALUMINUM"), ("dashboard", "ALUMINUM_CAN")]


def test_terminal_result_survives_a_manual_dashboard_timeout(monkeypatch, capsys):
    cap = Cap()
    order = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

        def run_preview(self, frame, conf):
            del frame, conf
            return SimpleNamespace(label="PET", confidence=0.9, accepted=True, poly=np.asarray([[1, 1], [8, 1], [8, 8], [1, 8]]), color=(0, 255, 0))

    class FakeM2:
        def run_all(self, frame, conf):
            del frame, conf
            return [M2Hit("ring", 0.3, np.asarray([[1, 1], [8, 1], [8, 8], [1, 8]], dtype=np.float32), 2)]

    class FakeController:
        def __init__(self, cfg, *, output_mode):
            del cfg
            assert output_mode == "terminal"

        def send(self, result):
            order.append(("controller", result))

        def close(self):
            pass

    class FakeDashboard:
        def __init__(self, api_url, machine_code):
            del api_url, machine_code

        def check_health(self):
            pass

        def get_latest_session(self):
            return None

        def send_and_wait(self, result, **metrics):
            del metrics
            order.append(("dashboard", result))
            raise TimeoutError("timed out")

        def close(self):
            pass

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "SerialTransport", FakeController)
    monkeypatch.setattr(app, "DashboardTransport", FakeDashboard)
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(
        sys,
        "argv",
        [
                "app.py", "--mode", "parallel-preview", "--headless", "--auto-start", "--max-frames", "3",
            "--publish-dashboard", "--require-dashboard", "--dashboard-api-url", "http://127.0.0.1:3003",
            "--controller-output", "terminal", "--session-mode", "manual", "--pause-after-result",
        ],
    )

    assert app.main() == 0
    assert order == [("controller", "BAD PET"), ("dashboard", "PET_REJECT")]
    captured = capsys.readouterr()
    assert "Dashboard update timed out/failed" in captured.err
    assert "Dashboard status is unknown" in captured.out


def test_pause_after_result_stops_preview_until_operator_restarts(monkeypatch, capsys):
    cap = Cap()
    workflows = []
    inference_calls = []
    sent = []

    class FakeM1:
        infer_conf = 0.05

        def reset_vote(self):
            pass

    class FakeM2:
        pass

    class FakeRunner:
        def __init__(self, m1, m2):
            del m1, m2

        def infer(self, frame, **kwargs):
            del frame, kwargs
            inference_calls.append("pair")
            return object()

        def close(self):
            pass

    class FakePreview:
        window_size = 4
        clear_frames = 8
        m2_thresholds = {"cap": 0.5, "label": 0.5, "ring": 0.3}

        def __init__(self):
            self.phase = "READY"
            self.pause_calls = 0

        def reset(self):
            self.phase = "READY"

        def pause(self):
            self.pause_calls += 1
            self.phase = "READY"

        def update(self, evidence, now):
            del evidence, now
            raw = SimpleNamespace(label="PET", confidence=0.91, accepted=True, poly=None, color=(0, 255, 0))
            return SimpleNamespace(
                phase="RESULT",
                m1=raw,
                m2_hits=(),
                result="GOOD PET",
                m1_average=0.91,
                m2_averages={"cap": 0.0, "label": 0.0, "ring": 0.0},
                progress=4,
                preview_signal=1,
                    new_result=True,
            )

    class FakeController:
        def __init__(self, cfg, *, output_mode):
            del cfg
            assert output_mode == "terminal"

        def send(self, result):
            sent.append(result)

        def close(self):
            pass

    def make_preview(**kwargs):
        del kwargs
        preview = FakePreview()
        workflows.append(preview)
        return preview

    monkeypatch.setattr(app, "M1Pipeline", lambda cfg: FakeM1())
    monkeypatch.setattr(app, "M2Pipeline", lambda cfg: FakeM2())
    monkeypatch.setattr(app, "ParallelInferenceRunner", FakeRunner)
    monkeypatch.setattr(app, "ParallelPreviewWorkflow", make_preview)
    monkeypatch.setattr(app, "SerialTransport", FakeController)
    monkeypatch.setattr(app.cv2, "VideoCapture", lambda *args: cap)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "app.py",
            "--mode",
            "parallel-preview",
            "--headless",
            "--auto-start",
            "--max-frames",
            "3",
            "--controller-output",
            "terminal",
            "--pause-after-result",
        ],
    )

    assert app.main() == 0
    assert inference_calls == ["pair"]
    assert sent == ["GOOD PET"]
    assert workflows[0].pause_calls == 1
    assert "Detection paused" in capsys.readouterr().out
