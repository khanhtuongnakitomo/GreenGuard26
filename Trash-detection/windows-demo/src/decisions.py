"""Public detection result names and their numeric output values."""
from __future__ import annotations

from decision_core import SIGNAL_ALUMINUM, SIGNAL_BAD_PET, SIGNAL_GOOD_PET


RESULT_TO_SIGNAL = {
    "ALUMINUM_CAN": SIGNAL_ALUMINUM,
    "PET_CLEAN": SIGNAL_GOOD_PET,
    "PET_REJECT": SIGNAL_BAD_PET,
}


def signal_for_result(result: str) -> int | None:
    """Return the public detection value, or ``None`` for no result."""
    return RESULT_TO_SIGNAL.get(result)
