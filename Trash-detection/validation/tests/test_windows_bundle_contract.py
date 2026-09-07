from __future__ import annotations

import hashlib
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import build_windows_rvm_demo as builder  # noqa: E402


def test_builder_rejects_deletion_target_outside_dist():
    with pytest.raises(RuntimeError):
        builder.ensure_output_path(ROOT / "outside-release")


def test_builder_rejects_forbidden_files_and_absolute_paths():
    output = ROOT / "dist" / "_contract-test"
    shutil.rmtree(output, ignore_errors=True)
    try:
        output.mkdir(parents=True)
        bad = output / "runtime" / "training" / "weights.pt"
        bad.parent.mkdir(parents=True)
        bad.write_bytes(b"bad")
        assert "forbidden" in builder._scan_forbidden(output)
        bad.unlink()
        clean = output / "README.md"
        clean.write_text("D:\\Code\\Project\\bki\\GreenGuard26", encoding="utf-8")
        assert "absolute development path" in builder._scan_forbidden(output)
    finally:
        shutil.rmtree(output, ignore_errors=True)


def test_payload_hash_and_zip_are_reproducible():
    output = ROOT / "dist" / "_contract-test"
    shutil.rmtree(output, ignore_errors=True)
    try:
        output.mkdir(parents=True)
        (output / "README.md").write_text("stable\n", encoding="utf-8")
        (output / "BUILD_INFO.json").write_text("{}\n", encoding="utf-8")
        first = builder.deterministic_zip(output).read_bytes()
        second = builder.deterministic_zip(output).read_bytes()
        assert hashlib.sha256(first).hexdigest() == hashlib.sha256(second).hexdigest()
    finally:
        shutil.rmtree(output, ignore_errors=True)
        zip_path = output.with_suffix(".zip")
        if zip_path.exists():
            zip_path.unlink()


def test_recovered_legacy_firmware_hash_is_locked():
    path = ROOT / "firmware" / "reference" / "RVMRun.txt"
    assert builder.sha256(path) == builder.LEGACY_FIRMWARE_SHA256


def test_smoke_interpreter_selection_and_worktree_provenance():
    output = ROOT / "dist" / "_contract-test"
    portable = builder.smoke_interpreter(output, {"offline_ready": True})
    online = builder.smoke_interpreter(output, {"offline_ready": False})
    assert portable == output / "runtime" / "python" / "python.exe"
    assert online == Path(sys.executable)
    state = builder.worktree_state()
    assert {"clean", "tracked_dirty", "untracked"} <= set(state)
