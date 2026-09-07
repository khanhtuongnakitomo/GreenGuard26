from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_source_checkout_app_help_works_without_built_runtime():
    app = Path(__file__).resolve().parents[1] / "src" / "app.py"
    result = subprocess.run([sys.executable, str(app), "--help"], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "GreenGuard Windows RVM workflow" in result.stdout
