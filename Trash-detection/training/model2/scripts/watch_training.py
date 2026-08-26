r"""Model 2 training watcher — periodic report + crash / hang / stall detection.

Unlike live_monitor.py (a matplotlib window that only plots), this is a health
watchdog: it detects the three failure modes that cost hours on the v5 run:
  * CRASH — trainer process died before the final epoch.
  * HANG  — no new epoch AND no log growth for --stall-min minutes (esp. with
            GPU util at 0%, the Windows dataloader deadlock). Can auto-kill.
  * STALL — val mAP50 flat for K epochs (informational; patience handles it).

It reads runs/<name>/results.csv (one row per epoch), the trainer log mtime,
and nvidia-smi. Writes logs/m2v6_watch.log + logs/m2v6_status.json.

Usage (from training/model2/, model1 venv) — run in a SEPARATE window:
  python scripts/watch_training.py --name m2v6_inmachine_seed42_n640
  python scripts/watch_training.py --name <run> --pid-file logs\\m2v6.pid --kill-on-hang
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"
LOGS = ROOT / "logs"


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _read_results(csv_path: Path) -> list[dict]:
    if not csv_path.is_file():
        return []
    try:
        with csv_path.open(encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        # normalize keys (Ultralytics pads with spaces)
        return [{k.strip(): v for k, v in r.items()} for r in rows]
    except Exception:
        return []


def _gpu() -> dict:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=15)
        util, mu, mt, temp = [x.strip() for x in out.stdout.strip().split(",")]
        return {"util": int(util), "mem_used": int(mu), "mem_total": int(mt), "temp": int(temp)}
    except Exception:
        return {"util": -1, "mem_used": -1, "mem_total": -1, "temp": -1}


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"],
                             capture_output=True, text=True, timeout=15)
        return str(pid) in out.stdout
    except Exception:
        # fallback: os.kill signal 0 (works for same-user procs on Windows)
        try:
            os.kill(pid, 0)
            return True
        except Exception:
            return False


def _fmt_map(row: dict) -> str:
    parts = []
    for key, label in (("metrics/mAP50(B)", "mAP50"), ("metrics/mAP50-95(B)", "mAP50-95")):
        if key in row and row[key] not in (None, ""):
            try:
                parts.append(f"{label}={float(row[key]):.4f}")
            except ValueError:
                pass
    return " ".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="m2v6_inmachine_seed42_n640")
    ap.add_argument("--epochs", type=int, default=110)
    ap.add_argument("--interval", type=int, default=300, help="report every N sec (default 5 min)")
    ap.add_argument("--stall-min", type=int, default=12, help="no-progress minutes -> HANG")
    ap.add_argument("--pid-file", default=None)
    ap.add_argument("--kill-on-hang", action="store_true")
    ap.add_argument("--metric-stall", type=int, default=12, help="epochs w/o mAP gain -> STALL note")
    args = ap.parse_args()

    LOGS.mkdir(parents=True, exist_ok=True)
    log_file = LOGS / "m2v6_watch.log"
    status_file = LOGS / "m2v6_status.json"
    run = RUNS / args.name
    csv_path = run / "results.csv"
    pid = -1
    if args.pid_file and Path(args.pid_file).is_file():
        try:
            pid = int(Path(args.pid_file).read_text().strip())
        except Exception:
            pid = -1

    def log(msg: str) -> None:
        line = f"[{_now()}] {msg}"
        print(line, flush=True)
        with log_file.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    log(f"watcher start: run={run.name} epochs={args.epochs} pid={pid} "
        f"interval={args.interval}s stall={args.stall_min}min kill_on_hang={args.kill_on_hang}")

    last_n = 0
    last_progress = time.time()
    best_map = 0.0
    best_epoch = 0
    warned_stall = False

    while True:
        rows = _read_results(csv_path)
        n = len(rows)
        g = _gpu()
        alive = _pid_alive(pid) if pid > 0 else None
        now = time.time()

        if n > last_n:
            last_progress = now
            last_n = n
            warned_stall = False

        cur_map = best_map
        if rows:
            try:
                cur_map = float(rows[-1].get("metrics/mAP50(B)", 0) or 0)
            except ValueError:
                cur_map = 0.0
            if cur_map > best_map:
                best_map = cur_map
                best_epoch = n

        # ---- periodic report ----
        ep = rows[-1].get("epoch", "?") if rows else "0"
        try:
            epn = int(float(ep)) + 1
        except Exception:
            epn = n
        mins_since = (now - last_progress) / 60.0
        per_class = ""
        status = {
            "time": _now(), "run": args.name, "epoch": epn, "epochs_target": args.epochs,
            "last_row": n, "best_mAP50": round(best_map, 4), "best_epoch": best_epoch,
            "gpu": g, "trainer_alive": alive, "min_since_progress": round(mins_since, 1),
        }
        status_file.write_text(json.dumps(status, indent=2))
        log(f"REPORT epoch {epn}/{args.epochs} | best mAP50={best_map:.4f}@{best_epoch} | "
            f"{_fmt_map(rows[-1]) if rows else 'no epochs yet'} | "
            f"GPU {g['util']}% mem {g['mem_used']}/{g['mem_total']}MiB {g['temp']}C | "
            f"alive={alive} | no-progress {mins_since:.1f}min")

        # ---- CRASH: trainer gone before final epoch, and csv stopped ----
        if alive is False and n < args.epochs and mins_since > 1:
            tail = ""
            log_file_train = LOGS / "m2v6_train.log"
            if log_file_train.is_file():
                tail = " | last log lines:\n" + "\n".join(
                    log_file_train.read_text(encoding="utf-8", errors="ignore")
                    .splitlines()[-20:])
            log(f"CRASH DETECTED: trainer pid {pid} not alive at epoch {epn}/{args.epochs}."
                f" Resume with:  python scripts/train_m2_v6.py --resume{tail}")
            return 2

        # ---- done ----
        if n >= args.epochs:
            log(f"COMPLETE: epoch {epn} reached target {args.epochs}. best mAP50={best_map:.4f}")
            return 0

        # ---- HANG: no progress for stall-min ----
        if mins_since >= args.stall_min and not warned_stall:
            log(f"STALL WARNING: no new epoch for {mins_since:.1f} min (GPU util {g['util']}%). "
                f"If util=0% this is likely the Windows dataloader deadlock.")
            warned_stall = True
        if mins_since >= 2 * args.stall_min:
            log(f"HUNG: no progress for {mins_since:.1f} min (2x stall threshold), "
                f"GPU util {g['util']}%, pid={pid}.")
            if args.kill_on_hang and pid > 0:
                log(f"kill-on-hang: terminating pid {pid}")
                try:
                    subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                                   capture_output=True, timeout=20)
                    log(f"killed pid {pid}. Resume:  python scripts/train_m2_v6.py --resume")
                except Exception as e:
                    log(f"kill failed: {e}")
                return 3
            warned_stall = True

        # ---- metric STALL (informational) ----
        if n - best_epoch >= args.metric_stall and n > args.metric_stall:
            log(f"note: mAP50 flat for {n - best_epoch} epochs (best {best_map:.4f}@{best_epoch}); "
                f"patience will early-stop if no recovery.")

        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
