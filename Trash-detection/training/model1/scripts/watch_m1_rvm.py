"""Report-only-by-default overnight watcher for Model 1 training."""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from m1_rvm_common import atomic_json_dump, load_config, model_root, run_id


def _process_identity(pid: int) -> dict:
    try:
        import psutil

        process = psutil.Process(pid)
        return {"pid": pid, "create_time": process.create_time(), "cmdline": process.cmdline(), "alive": process.is_running()}
    except Exception as exc:
        return {"pid": pid, "alive": False, "error": repr(exc)}


def _csv_state(path: Path) -> dict:
    if not path.exists():
        return {"exists": False, "mtime": None, "rows": 0}
    try:
        with path.open("r", newline="", encoding="utf-8") as handle:
            rows = max(0, sum(1 for _ in csv.reader(handle)) - 1)
    except OSError:
        rows = None
    return {"exists": True, "mtime": path.stat().st_mtime, "rows": rows}


def snapshot(run_name: str, pid: int | None = None) -> dict:
    root = model_root()
    run_root = root / "runs" / run_name
    results = run_root / "results.csv"
    checkpoint = run_root / "weights" / "last.pt"
    try:
        disk_free = shutil.disk_usage(root).free
    except OSError:
        disk_free = None
    gpu = None
    try:
        completed = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total,utilization.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, check=False)
        gpu = completed.stdout.strip() or completed.stderr.strip()
    except (OSError, subprocess.SubprocessError):
        gpu = None
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": _process_identity(pid) if pid else None,
        "results_csv": _csv_state(results),
        "checkpoint": {"exists": checkpoint.exists(), "mtime": checkpoint.stat().st_mtime if checkpoint.exists() else None, "bytes": checkpoint.stat().st_size if checkpoint.exists() else 0},
        "gpu": gpu,
        "disk_free_bytes": disk_free,
    }


def watch(config: dict, run_name: str, pid: int | None, max_hours: float, interval: int, kill_on_hang: bool) -> int:
    report_root = model_root() / "logs" / "rvm" / run_name
    report_root.mkdir(parents=True, exist_ok=True)
    heartbeat = report_root / "watcher.jsonl"
    started = time.monotonic()
    previous: dict | None = None
    while time.monotonic() - started < max_hours * 3600:
        current = snapshot(run_name, pid)
        current["mode"] = "kill_on_hang" if kill_on_hang else "report_only"
        stalled = False
        if previous:
            stalled = current["results_csv"] == previous["results_csv"] and current["checkpoint"] == previous["checkpoint"]
            current["stalled_since_previous_sample"] = stalled
        with heartbeat.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(current, sort_keys=True) + "\n")
        process = current.get("pid") or {}
        if pid and not process.get("alive", False):
            return 0
        if stalled and kill_on_hang and pid and process.get("alive"):
            try:
                import psutil

                psutil.Process(pid).terminate()
                current["action"] = "terminated_after_explicit_kill_on_hang"
            except Exception as exc:  # pragma: no cover
                current["action_error"] = repr(exc)
        previous = current
        time.sleep(min(max(1, interval), 60))
    atomic_json_dump(report_root / "watcher_summary.json", {"status": "TIME_LIMIT_REACHED", "run_id": run_name, "max_hours": max_hours, "kill_on_hang": kill_on_hang})
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path)
    parser.add_argument("--run-id")
    parser.add_argument("--pid", type=int)
    parser.add_argument("--max-hours", type=float, default=8)
    parser.add_argument("--interval", type=int, default=60)
    parser.add_argument("--kill-on-hang", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config)
    return watch(config, args.run_id or run_id(config), args.pid, args.max_hours, args.interval, args.kill_on_hang)


if __name__ == "__main__":
    raise SystemExit(main())
