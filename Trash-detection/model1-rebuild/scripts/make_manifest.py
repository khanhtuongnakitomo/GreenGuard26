"""Lock the test split: copy to dataset/test_locked/ + sha256 MANIFEST.

The locked copy is the canonical evaluation set for G5 (opened exactly once at
final evaluation). MANIFEST lists sha256 of every file; any later edit is
detectable by re-hashing.

Usage: python scripts/make_manifest.py
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "dataset" / "splits" / "test"
DST = ROOT / "dataset" / "test_locked"


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    if DST.exists():
        subprocess.run(["attrib", "-R", str(DST / "*"), "/S", "/D"], check=False)
    import shutil

    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    lines = []
    files = sorted(p for p in DST.rglob("*") if p.is_file())
    for p in files:
        lines.append(f"{sha256(p)}  {p.relative_to(DST).as_posix()}")
    (DST / "MANIFEST.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    # read-only lock (Windows)
    subprocess.run(["attrib", "+R", str(DST / "*"), "/S", "/D"], check=False)
    print(f"locked {len(files)} files -> {DST / 'MANIFEST.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
