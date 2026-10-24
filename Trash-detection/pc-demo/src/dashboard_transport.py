"""Asynchronous REST transport for dashboard detection telemetry."""
from __future__ import annotations

import json
import sys
import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, TextIO
from urllib.request import Request, urlopen


RESULT_TYPES = {
    "ALUMINUM_CAN": "aluminum",
    "PET_CLEAN": "pet_clean",
    "PET_REJECT": "pet_bad",
}


def _response_status(response: Any) -> int:
    status = getattr(response, "status", None)
    if status is None:
        status = response.getcode()
    return int(status)


def _endpoint_urls(api_url: str) -> tuple[str, str, str]:
    base = str(api_url).strip().rstrip("/")
    if not base:
        raise ValueError("dashboard API URL is required")
    endpoint_suffix = "/api/dashboard/detections"
    if base.endswith(endpoint_suffix):
        api_base = base[: -len(endpoint_suffix)]
        return base, f"{api_base}/health", api_base
    return f"{base}{endpoint_suffix}", f"{base}/health", base


def detection_payload(
    result: str,
    *,
    machine_code: str,
    confidence: float,
    fps: float | None = None,
    latency_ms: float | None = None,
    captured_at: str | None = None,
    event_id: str | None = None,
    session_mode: str = "inactivity",
) -> dict[str, Any]:
    """Translate a canonical workflow result into the local Dashboard contract."""
    try:
        detected_type = RESULT_TYPES[str(result).upper()]
    except KeyError as exc:
        raise ValueError(f"unsupported dashboard result: {result!r}") from exc

    code = str(machine_code).strip()
    if not code:
        raise ValueError("machine code is required")

    confidence_value = max(0.0, min(1.0, float(confidence)))
    payload: dict[str, Any] = {
        "eventId": event_id or f"{code}-{time.time_ns()}-{uuid.uuid4().hex[:8]}",
        "machineCode": code,
        "detectedType": detected_type,
        "confidence": round(confidence_value, 4),
        "sortingStatus": "sorted",
        "syncStatus": "synced",
        "capturedAt": captured_at or datetime.now(timezone.utc).isoformat(),
    }
    if fps is not None:
        payload["fps"] = round(max(0.0, float(fps)), 2)
    if latency_ms is not None:
        payload["latencyMs"] = round(max(0.0, float(latency_ms)), 2)
    if session_mode not in {"inactivity", "manual"}:
        raise ValueError(f"unsupported session mode: {session_mode!r}")
    payload["sessionMode"] = session_mode
    return payload


class DashboardTransport:
    """Post finalized detections without blocking the camera/inference loop."""

    def __init__(
        self,
        api_url: str,
        machine_code: str,
        *,
        timeout_s: float = 3.0,
        opener: Callable[..., Any] = urlopen,
        stdout: TextIO = sys.stdout,
        stderr: TextIO = sys.stderr,
    ) -> None:
        self.endpoint, self.health_endpoint, self.api_base = _endpoint_urls(api_url)
        self.machine_code = str(machine_code).strip()
        if not self.machine_code:
            raise ValueError("machine code is required")
        self.timeout_s = max(0.1, float(timeout_s))
        self._opener = opener
        self._stdout = stdout
        self._stderr = stderr
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="dashboard-rest")
        self._closed = False
        self._lock = threading.Lock()

    def check_health(self) -> None:
        request = Request(self.health_endpoint, method="GET")
        with self._opener(request, timeout=self.timeout_s) as response:
            status = _response_status(response)
            if not 200 <= status < 300:
                raise RuntimeError(f"dashboard API health check returned HTTP {status}")

    def send(
        self,
        result: str,
        *,
        confidence: float,
        fps: float | None = None,
        latency_ms: float | None = None,
        session_mode: str = "inactivity",
    ) -> str:
        payload = detection_payload(
            result,
            machine_code=self.machine_code,
            confidence=confidence,
            fps=fps,
            latency_ms=latency_ms,
            session_mode=session_mode,
        )
        with self._lock:
            if self._closed:
                raise RuntimeError("dashboard transport is closed")
            future = self._executor.submit(self._post, payload)
        future.add_done_callback(lambda item: self._report(item, payload))
        return str(payload["eventId"])

    def send_and_wait(
        self,
        result: str,
        *,
        confidence: float,
        fps: float | None = None,
        latency_ms: float | None = None,
        session_mode: str = "inactivity",
    ) -> dict[str, Any]:
        """Synchronously post one detection and return the acknowledged session snapshot."""
        payload = detection_payload(
            result,
            machine_code=self.machine_code,
            confidence=confidence,
            fps=fps,
            latency_ms=latency_ms,
            session_mode=session_mode,
        )
        with self._lock:
            if self._closed:
                raise RuntimeError("dashboard transport is closed")
        response = self._post_json(payload)
        print(
            f"[Dashboard] acknowledged {payload['detectedType']} event {payload['eventId']}",
            file=self._stdout,
            flush=True,
        )
        return response

    def get_latest_session(self) -> dict[str, Any] | None:
        request = Request(
            f"{self.api_base}/api/sessions/latest?machineCode={self.machine_code}",
            method="GET",
        )
        return self._request_json(request)

    def finalize_session(self) -> dict[str, Any]:
        body = json.dumps({"machineCode": self.machine_code}, separators=(",", ":")).encode("utf-8")
        request = Request(
            f"{self.api_base}/api/sessions/finalize",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        return self._request_json(request)

    def _request_json(self, request: Request) -> dict[str, Any] | None:
        with self._opener(request, timeout=self.timeout_s) as response:
            status = _response_status(response)
            raw = response.read() if hasattr(response, "read") else b""
            if not 200 <= status < 300:
                detail = raw.decode("utf-8", errors="replace") if raw else ""
                raise RuntimeError(f"dashboard API returned HTTP {status}: {detail[:300]}")
            if not raw:
                return None
            value = json.loads(raw.decode("utf-8"))
            return value if isinstance(value, dict) else None

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request = Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
            },
        )
        return self._request_json(request)

    def _post(self, payload: dict[str, Any]) -> None:
        self._post_json(payload)

    def _report(self, future: Future[None], payload: dict[str, Any]) -> None:
        error = future.exception()
        if error is None:
            print(
                f"[Dashboard] sent {payload['detectedType']} event {payload['eventId']}",
                file=self._stdout,
                flush=True,
            )
        else:
            print(
                f"[Dashboard] failed event {payload['eventId']}: {error}",
                file=self._stderr,
                flush=True,
            )

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
        self._executor.shutdown(wait=True, cancel_futures=False)
