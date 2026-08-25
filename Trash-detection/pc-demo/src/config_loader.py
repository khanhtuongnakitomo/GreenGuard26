"""Load pc-demo configuration and resolve paths relative to runtime root."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def app_root() -> Path:
    return ROOT


def load_config(name: str = "default") -> dict:
    path = ROOT / "config" / f"{name}.json"
    if not path.is_file():
        raise FileNotFoundError(f"config not found: {path}")
    with path.open(encoding="utf-8") as handle:
        cfg = json.load(handle)
    cfg["_root"] = str(ROOT)
    return cfg


def resolve_path(rel: str) -> Path:
    candidate = ROOT / rel
    if candidate.is_file():
        return candidate
    path = Path(rel)
    if path.is_file():
        return path
    return candidate


def load_manifest() -> dict:
    path = ROOT / "models" / "manifest.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def validate_manifest(manifest: dict) -> None:
    if not manifest:
        raise RuntimeError(
            "models/manifest.json is missing. Run: python ..\\scripts\\package_models.py --target pc"
        )
    for entry in manifest.get("models", []):
        path = ROOT / entry["path"]
        if not path.is_file():
            raise RuntimeError(f"missing packaged model: {path}")
