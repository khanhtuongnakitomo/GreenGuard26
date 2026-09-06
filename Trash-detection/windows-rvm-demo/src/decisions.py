"""Public workflow result names and configurable legacy RVM routes."""
from __future__ import annotations


def command_for_result(result: str, routing: dict[str, str]) -> str | None:
    return routing.get(result)
