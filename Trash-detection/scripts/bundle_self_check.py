"""Self-check used by the generated Windows bundle without source checkout."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_LEGACY = "60eb1cea1befe9a963524a19167bb78e7b350f81898109fe9773d3e1e9458f2e"


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
    if cfg.get("serial", {}).get("enabled") is not False:
        raise SystemExit("serial must remain disabled by default")
    contract = cfg.get("decision_contract", {})
    if (contract.get("window_size"), contract.get("quorum"), contract.get("clear_frames_to_rearm")) != (7, 4, 8):
        raise SystemExit("decision contract is not 7/4/eight-clear")
    firmware = ROOT / "firmware" / "reference" / "RVMRun.txt"
    if digest(firmware) != EXPECTED_LEGACY:
        raise SystemExit("legacy firmware hash mismatch")
    print("GreenGuard bundle self-check OK; serial disabled; protocol RVM-V2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
