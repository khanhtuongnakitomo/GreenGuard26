from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_source_checkout_app_help_works_without_built_runtime():
    app = Path(__file__).resolve().parents[1] / "src" / "app.py"
    result = subprocess.run([sys.executable, str(app), "--help"], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "GreenGuard Windows detection workflow" in result.stdout


def test_old_machine_options_are_rejected():
    app = Path(__file__).resolve().parents[1] / "src" / "app.py"
    for option in ("--enable-serial", "--serial-port", "COM5"):
        result = subprocess.run([sys.executable, str(app), option], capture_output=True, text=True)
        assert result.returncode != 0
        assert "unrecognized arguments" in result.stderr or "error" in result.stderr.lower()
