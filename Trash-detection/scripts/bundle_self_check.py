"""Self-check used by the generated Windows bundle without source checkout."""
from __future__ import annotations

import os
import sys

os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().lower()


def main() -> int:
    manifest_path = ROOT / "runtime" / "models" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for entry in manifest["models"]:
        path = ROOT / "runtime" / entry["path"]
        if digest(path) != entry["sha256"].lower():
            raise SystemExit(f"model hash mismatch: {path}")
    cfg = json.loads((ROOT / "runtime" / "config" / "default.json").read_text(encoding="utf-8"))
    if "serial" in cfg or "routing" in cfg:
        raise SystemExit("machine-control configuration is present")
    contract = cfg.get("decision_contract", {})
    if (contract.get("window_size"), contract.get("quorum"), contract.get("clear_frames_to_rearm")) != (7, 4, 8):
        raise SystemExit("decision contract is not 7/4/eight-clear")
    info = json.loads((ROOT / "BUILD_INFO.json").read_text(encoding="utf-8"))
    expected = {
        "mechanical_control_included": False,
        "output_transport": "stdout-line",
        "output_encoding": "ASCII",
        "allowed_values": [0, 1, 2],
        "one_signal_per_item": True,
        "stdout_contains_signals_only": True,
    }
    if any(info.get(key) != value for key, value in expected.items()):
        raise SystemExit("detection-only output contract is incomplete")
    forbidden = {"firmware", "serial" + "_controller.py", "py" + "serial"}
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT).as_posix().lower()
        if any(part in forbidden for part in rel.split("/")):
            raise SystemExit(f"forbidden machine-control path: {rel}")
        if path.name in {"BUILD_INFO.json", "manifest.json"}:
            continue
        if path.is_file() and path.name != Path(__file__).name and path.suffix.lower() in {".py", ".json", ".bat", ".ps1", ".txt"}:
            text = path.read_text(encoding="utf-8", errors="ignore").lower()
            tokens = ("py" + "serial", "rvm-" + "v2", "ack:<", "done:<", "--enable-" + "serial", "--serial-" + "port")
            if any(token in text for token in tokens):
                raise SystemExit(f"forbidden machine-control reference: {rel}")
    print("GreenGuard detection bundle self-check OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
