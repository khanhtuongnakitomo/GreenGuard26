"""Phase A environment check — GreenGuard Model 1 rebuild.

Verifies GPU, Python, and required packages; writes results to logs/env.txt.
Read-only with respect to the outside world: everything stays in this folder.

Usage:  python scripts/env_check.py
Exit code 0 = all checks pass, 1 = any failure (CPU-only training is a blocker
per 04-BUILD-PIPELINE Phase A).
"""
from __future__ import annotations

import datetime as _dt
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = ROOT / "logs" / "env.txt"

REQUIRED = [
    "ultralytics",
    "PIL",
    "imagehash",
    "pandas",
    "numpy",
    "yaml",
    "matplotlib",
    "supervision",
    "pytest",
    "tqdm",
]


def gpu_info() -> tuple[str, str]:
    """Return (gpu_name_or_NONE, driver_output_text)."""
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return "NONE", "nvidia-smi not found on PATH"
    try:
        out = subprocess.run(
            [nvidia_smi], capture_output=True, text=True, timeout=30
        ).stdout
    except subprocess.TimeoutExpired:
        return "NONE", "nvidia-smi timed out"
    name = "UNKNOWN"
    for line in out.splitlines():
        if "NVIDIA" not in line or "|" not in line or "Fan" in line:
            continue
        if "NVIDIA-SMI" in line or "Driver Version" in line:
            continue
        for segment in line.split("|"):
            if "NVIDIA" not in segment:
                continue
            parts = [
                p for p in segment.replace("WDDM", " ").split() if p != "0"
            ]
            if parts:
                name = " ".join(parts)
            break
        break
    return name, out


def main() -> int:
    lines: list[str] = []
    fail = False

    def log(msg: str) -> None:
        print(msg)
        lines.append(msg)

    log(f"env_check run at {_dt.datetime.now().isoformat(timespec='seconds')}")
    log(f"python       : {sys.version.replace(chr(10), ' ')}")
    log(f"platform     : {platform.platform()}")
    if sys.version_info < (3, 10):
        log("FAIL: Python < 3.10")
        fail = True
    else:
        log("python check : OK (>= 3.10)")

    # --- GPU ---
    import torch  # noqa: PLC0415 (imported here so the report has package info first)

    gpu_name, smi_out = gpu_info()
    log(f"nvidia-smi   : {gpu_name}")
    cuda_available = torch.cuda.is_available()
    log(f"torch        : {torch.__version__}")
    log(f"cuda available: {cuda_available}")
    if cuda_available:
        log(f"cuda device  : {torch.cuda.get_device_name(0)}")
        log(f"cuda version : {torch.version.cuda}")
        log(f"vram total   : {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GiB")
    else:
        log("FAIL: CUDA not available to torch — CPU-only training is a blocker")
        fail = True

    # --- packages ---
    for mod in REQUIRED:
        try:
            m = __import__(mod)
            ver = getattr(m, "__version__", "?")
            log(f"package {mod:<12}: {ver}")
        except ImportError as exc:
            log(f"FAIL: package {mod} import error: {exc}")
            fail = True

    log(f"RESULT: {'FAIL' if fail else 'PASS'}")
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwritten -> {LOG_PATH}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
