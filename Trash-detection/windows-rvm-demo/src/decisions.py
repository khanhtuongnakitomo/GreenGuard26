"""Public workflow result names and numeric RVM v2 signals."""
from __future__ import annotations

from decision_core import SIGNAL_ALUMINUM, SIGNAL_BAD_PET, SIGNAL_GOOD_PET


RESULT_TO_SIGNAL = {
    "ALUMINUM_CAN": SIGNAL_ALUMINUM,
    "PET_CLEAN": SIGNAL_GOOD_PET,
    "PET_REJECT": SIGNAL_BAD_PET,
}


def signal_for_result(result: str) -> int | None:
    return RESULT_TO_SIGNAL.get(result)


def command_for_result(result: str, routing: dict[str, str] | None = None) -> str | None:
    """Return the ASCII v2 byte, retaining the old helper name for callers."""
    signal = signal_for_result(result)
    if signal is None:
        return None
    return str(signal)
