"""Bounded supervisor for one Model 1 training process.

The supervisor is independent of the chat session. It records progress and
GPU activity, allows two in-budget recoveries, and only stops the child it
started for this run.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


MODEL_ROOT = Path(__file__).resolve().parents[1]
TRAIN_SCRIPT = Path(__file__).resolve().parent / "m1_rebuild.py"


def keep_awake(enabled: bool) -> None:
    """Use a process-scoped Windows execution request; do not change power plans."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        continuous = 0x80000000
        system_required = 0x00000001
        display_required = 0x00000002
        ctypes.windll.kernel32.SetThreadExecutionState(continuous | (system_required | display_required if enabled else 0))
    except Exception:
        pass


def training_snapshot(run_id: str, child_pid: int) -> dict[str, Any]:
    run_root = MODEL_ROOT / "runs"
    result_files = sorted(run_root.glob(f"{run_id}_batch*/results.csv"), key=lambda path: path.stat().st_mtime)
    latest_results = result_files[-1] if result_files else None
    epoch = None
    if latest_results and latest_results.is_file():
        try:
            with latest_results.open(encoding="utf-8", newline="") as handle:
                epoch = sum(1 for _ in csv.DictReader(handle))
        except (OSError, csv.Error):
            pass
    checkpoints = sorted(run_root.glob(f"{run_id}_batch*/weights/*.pt"), key=lambda path: path.stat().st_mtime)
    latest_checkpoint = checkpoints[-1] if checkpoints else None
    gpu: dict[str, Any] = {"query": "NOT_MEASURED"}
    try:
        output = subprocess.run(
            ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        rows = []
        for line in output.stdout.splitlines():
            fields = [field.strip() for field in line.split(",")]
            if len(fields) >= 2 and fields[0].isdigit():
                rows.append({"pid": int(fields[0]), "used_memory_mib": fields[1]})
        gpu = {"query": "OK", "child": next((row for row in rows if row["pid"] == child_pid), None), "processes": rows}
    except (OSError, subprocess.SubprocessError) as exc:
        gpu = {"query": "ERROR", "error": str(exc)}
    return {
        "epoch": epoch,
        "results_csv": str(latest_results) if latest_results else None,
        "latest_checkpoint": str(latest_checkpoint) if latest_checkpoint else None,
        "checkpoint_time": latest_checkpoint.stat().st_mtime if latest_checkpoint else None,
        "gpu": gpu,
    }


def write_status(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    temporary.replace(path)


def stop_child(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=60)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=30)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--max-hours", type=float, default=6.0)
    parser.add_argument("--max-restarts", type=int, default=2)
    parser.add_argument("--resume-from", type=Path)
    parser.add_argument("--elapsed-offset-seconds", type=float, default=0.0)
    args = parser.parse_args()
    report = MODEL_ROOT / "logs" / "rebuild" / args.run_id
    report.mkdir(parents=True, exist_ok=True)
    status_path = report / "watcher_status.json"
    stdout_path = report / "train_supervisor.stdout.log"
    stderr_path = report / "train_supervisor.stderr.log"
    # A resumed supervisor can carry forward time already spent by an earlier
    # supervisor instance, preserving the original wall-clock budget.
    started = time.time() - max(0.0, args.elapsed_offset_seconds)
    recovery_count = 0
    epoch_times: list[float] = []
    last_epoch: int | None = None
    last_progress_at = started
    previous_progress_at = started

    keep_awake(True)
    with stdout_path.open("a", encoding="utf-8", newline="\n") as out, stderr_path.open("a", encoding="utf-8", newline="\n") as err:
        command = [sys.executable, str(TRAIN_SCRIPT), "train", "--run-id", args.run_id]
        if args.resume_from:
            command.extend(["--resume-from", str(args.resume_from)])
        process = subprocess.Popen(command, cwd=MODEL_ROOT, stdout=out, stderr=err, text=True)
        while process.poll() is None:
            now = time.time()
            snapshot = training_snapshot(args.run_id, process.pid)
            epoch = snapshot.get("epoch")
            if isinstance(epoch, int) and epoch != last_epoch:
                if last_epoch is not None:
                    epoch_times.append(now - previous_progress_at)
                last_epoch = epoch
                previous_progress_at = now
                last_progress_at = now
            checkpoint_time = snapshot.get("checkpoint_time")
            if checkpoint_time and checkpoint_time >= last_progress_at:
                last_progress_at = now
            epoch_duration = sum(epoch_times[-3:]) / len(epoch_times[-3:]) if epoch_times else 0.0
            stall_limit = max(20 * 60, 3 * epoch_duration if epoch_duration else 20 * 60)
            elapsed = now - started
            payload = {
                "schema": "greenguard-m1-rebuild-watcher-v2",
                "run_id": args.run_id,
                "pid": process.pid,
                "status": "RUNNING",
                "elapsed_seconds": elapsed,
                "elapsed_offset_seconds": max(0.0, args.elapsed_offset_seconds),
                "max_hours": args.max_hours,
                "recovery_attempts": recovery_count,
                "last_progress_seconds_ago": now - last_progress_at,
                "probable_stall_after_seconds": stall_limit,
                "epoch_duration_seconds": epoch_duration or None,
                "training": snapshot,
            }
            write_status(status_path, payload)
            if int(elapsed // 300) != int((elapsed - 60) // 300):
                print(json.dumps(payload, sort_keys=True), flush=True)

            if elapsed >= args.max_hours * 3600:
                stop_child(process)
                write_status(status_path, {**payload, "status": "TIME_BUDGET_EXPIRED", "finished_at": time.time()})
                keep_awake(False)
                return 3

            if now - last_progress_at >= stall_limit:
                if recovery_count >= args.max_restarts:
                    stop_child(process)
                    write_status(status_path, {**payload, "status": "FAILED_PROBABLE_STALL", "finished_at": time.time()})
                    keep_awake(False)
                    return 4
                checkpoint = snapshot.get("latest_checkpoint")
                stop_child(process)
                recovery_count += 1
                if checkpoint:
                    command = [sys.executable, str(TRAIN_SCRIPT), "train", "--run-id", args.run_id, "--resume-from", checkpoint]
                    match = re.search(r"_batch(\d+)", checkpoint)
                    if match:
                        command.extend(["--batch", match.group(1)])
                process = subprocess.Popen(command, cwd=MODEL_ROOT, stdout=out, stderr=err, text=True)
                last_progress_at = time.time()
                last_epoch = None
                epoch_times.clear()
                previous_progress_at = last_progress_at
                continue
            time.sleep(60)

    final_status = "COMPLETED" if process.returncode == 0 else "FAILED"
    write_status(status_path, {"schema": "greenguard-m1-rebuild-watcher-v2", "run_id": args.run_id, "status": final_status, "pid": process.pid, "returncode": process.returncode, "recovery_attempts": recovery_count, "elapsed_seconds": time.time() - started, "elapsed_offset_seconds": max(0.0, args.elapsed_offset_seconds), "finished_at": time.time()})
    keep_awake(False)
    return process.returncode or 0


if __name__ == "__main__":
    raise SystemExit(main())
