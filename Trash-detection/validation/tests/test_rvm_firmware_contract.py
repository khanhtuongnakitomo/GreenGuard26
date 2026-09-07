from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_v2_firmware_latches_emergency_and_waits_background_seek_before_done():
    source = (ROOT / "firmware" / "rvm-v2" / "RVMRun_v2.ino").read_text(encoding="utf-8")
    assert "if (isEmergencyStop)" in source
    assert "ERR:EMERGENCY_LATCHED" in source
    assert "RESET-OK" in source
    assert "if (!isEmergencyStop && waitForBackgroundCompletion())" in source
    assert "while (isM2SeekingS3 && !isEmergencyStop)" in source
    category = re.search(r"if \(command == '0'.*?\n    }\n  }", source, re.DOTALL)
    assert category is not None
    assert "isEmergencyStop = false" not in category.group(0)
