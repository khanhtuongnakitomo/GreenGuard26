from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dashboard_transport import DashboardTransport, detection_payload  # noqa: E402


class FakeResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def test_canonical_results_map_to_dashboard_types():
    expected = {
        "ALUMINUM_CAN": "aluminum",
        "PET_CLEAN": "pet_clean",
        "PET_REJECT": "pet_bad",
    }
    for result, detected_type in expected.items():
        payload = detection_payload(
            result,
            machine_code="0001",
            confidence=0.91,
            event_id=f"test-{detected_type}",
            captured_at="2026-09-09T00:00:00+00:00",
        )
        assert payload["detectedType"] == detected_type
        assert payload["sortingStatus"] == "sorted"


def test_unknown_result_is_not_sent():
    with pytest.raises(ValueError, match="unsupported dashboard result"):
        detection_payload("UNKNOWN", machine_code="0001", confidence=0.5)


def test_transport_posts_local_dashboard_detection_payload():
    requests = []

    def opener(request, timeout):
        requests.append((request, timeout))
        return FakeResponse()

    stdout = io.StringIO()
    transport = DashboardTransport(
        "http://localhost:3003",
        "0001",
        opener=opener,
        stdout=stdout,
    )
    event_id = transport.send("PET_CLEAN", confidence=0.87, fps=5.2, latency_ms=44.1)
    transport.close()

    request, timeout = requests[0]
    body = json.loads(request.data.decode("utf-8"))
    assert request.full_url == "http://localhost:3003/api/dashboard/detections"
    assert request.get_header("X-api-key") is None
    assert timeout == 3.0
    assert body["eventId"] == event_id
    assert body["machineCode"] == "0001"
    assert body["detectedType"] == "pet_clean"
    assert body["confidence"] == 0.87
    assert body["fps"] == 5.2
    assert body["latencyMs"] == 44.1
    assert "sent pet_clean" in stdout.getvalue()


def test_health_check_uses_local_dashboard_health_endpoint():
    requests = []

    def opener(request, timeout):
        requests.append((request, timeout))
        return FakeResponse()

    transport = DashboardTransport("http://localhost:3003", "0001", opener=opener)
    transport.check_health()
    transport.close()
    assert requests[0][0].full_url == "http://localhost:3003/health"
