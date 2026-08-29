"""One-frame proof that the supported full PC workflow starts and exits cleanly."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "app.py"
FIXTURE = ROOT.parent / "validation" / "fixtures" / "m1_sample.jpg"


def test_full_workflow_headless_smoke():
    completed = subprocess.run(
        [
            sys.executable,
            str(APP),
            "--mode",
            "full",
            "--headless",
            "--source",
            str(FIXTURE),
            "--max-frames",
            "1",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=90,
    )

    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "frame=1" in completed.stdout
