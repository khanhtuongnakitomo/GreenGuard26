r"""Live training monitor — shows the training progress on screen as it runs.

Opens a matplotlib window with per-epoch curves (losses + mAP) read from the
run's results.csv (Ultralytics writes one row per epoch). Auto-picks the
newest m2_* run, or pass a run dir explicitly.

Usage:
  python scripts/live_monitor.py                 # auto: newest runs/m2_* (or given)
  python scripts/live_monitor.py runs\m2_seed42_n640
Run it while training — the window refreshes every 2 seconds.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"


def pick_run(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if not p.is_absolute():
            p = ROOT / p
        return p
    cands = sorted([d for d in RUNS.glob("m2_*") if d.is_dir()],
                   key=lambda d: d.stat().st_mtime)
    if not cands:
        print("no runs/m2_* yet — start training first, or pass a run dir")
        raise SystemExit(1)
    return cands[-1]


def load(run: Path) -> pd.DataFrame | None:
    csv = run / "results.csv"
    if not csv.is_file():
        return None
    try:
        df = pd.read_csv(csv)
        df.columns = [c.strip() for c in df.columns]
        return df
    except Exception:
        return None


def render(ax_loss, ax_map, df: pd.DataFrame) -> None:
    ep = df["epoch"] + 1
    ax_loss.clear()
    for col, label, color in (("train/box_loss", "box_loss", "#e74c3c"),
                              ("train/cls_loss", "cls_loss", "#e67e22"),
                              ("train/dfl_loss", "dfl_loss", "#f1c40f")):
        if col in df:
            ax_loss.plot(ep, df[col], label=label, color=color, linewidth=2)
    ax_loss.set_xlabel("epoch")
    ax_loss.set_ylabel("train loss (lower = better)")
    ax_loss.set_title(f"epoch {int(ep.iloc[-1])} — losses")
    ax_loss.legend(loc="upper right", fontsize=8)
    ax_loss.grid(alpha=0.3)

    ax_map.clear()
    for col, label, color in (("metrics/mAP50(B)", "mAP50", "#2ecc71"),
                              ("metrics/mAP50-95(B)", "mAP50-95", "#3498db")):
        if col in df:
            ax_map.plot(ep, df[col], label=label, color=color, linewidth=2)
    if "metrics/mAP50(B)" in df:
        best = df["metrics/mAP50(B)"].max()
        ax_map.axhline(best, color="#2ecc71", linestyle="--", alpha=0.5)
        ax_map.text(0.02, best, f" best mAP50={best:.3f}", fontsize=8,
                    color="#2ecc71", va="bottom", transform=ax_map.get_yaxis_transform())
    ax_map.set_xlabel("epoch")
    ax_map.set_ylabel("val mAP (higher = better)")
    ax_map.set_ylim(0, 1)
    ax_map.legend(loc="lower right", fontsize=8)
    ax_map.grid(alpha=0.3)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", nargs="?", default=None)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--once", action="store_true",
                    help="render one PNG instead of a live window (headless test)")
    args = ap.parse_args()

    run = pick_run(args.run)
    print(f"[monitor] watching: {run}  (results.csv refreshes each epoch)")

    if args.once:
        df = load(run)
        if df is None or df.empty:
            print("no data yet")
            return 1
        fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
        render(a1, a2, df)
        out = ROOT / "logs" / "monitor_snapshot.png"
        fig.savefig(out, dpi=110, bbox_inches="tight")
        print(f"saved {out}")
        return 0

    plt.ion()
    fig, (ax_loss, ax_map) = plt.subplots(1, 2, figsize=(11, 4.5))
    fig.canvas.manager.set_window_title(f"Model 2 training — {run.name}")
    stable = 0
    while True:
        df = load(run)
        if df is None or df.empty:
            ax_loss.clear()
            ax_loss.text(0.5, 0.5, "waiting for the first epoch to finish...",
                         ha="center", va="center", transform=ax_loss.transAxes)
            ax_map.clear()
        else:
            render(ax_loss, ax_map, df)
        fig.canvas.draw()
        fig.canvas.flush_events()
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
