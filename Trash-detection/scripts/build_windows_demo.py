"""Build and validate the movable Windows detection-only demo.

The default ``portable`` profile is fail-closed: it only succeeds when a
staged Python 3.11 x64 runtime and local wheels are present.  The explicit
``online-source`` profile is useful for development checks, but its output is
never labelled offline or portable.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PC = ROOT / "pc-demo"
SOURCE = ROOT / "windows-demo"
DIST = ROOT / "dist"
DEFAULT_OUTPUT = DIST / "GreenGuard-Windows-Detection-Demo"
PORTABLE_STAGE = SOURCE / "portable-runtime"
LOCKED = {
    "m1_detect_640.onnx": "cf7baf1c4a917c7f8ecbd1e30bf92ca5e3a38869b99ccbfb6b94a0b95111eb24",
    "m2_obb_640.onnx": "2df4f8f9f7d941998029e65809eb53bbf401199eb4d0a8489e7b259503ad1449",
}
RUNTIME_FILES = ("config_loader.py", "decision_core.py", "gate.py", "pipeline.py", "ui.py")
WINDOW_FILES = ("app.py", "decisions.py", "kiosk_ui.py", "signal_sink.py", "workflow.py")
FORBIDDEN_SUFFIXES = {".pt", ".tflite", ".engine", ".pyc", ".pyo"}
# A full Python runtime legitimately includes the stdlib ``Lib/venv`` module;
# only copied developer environments (``.venv``) are forbidden.
FORBIDDEN_PARTS = {".venv", "training", "__pycache__", ".cache", "cache"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def dirty_tracked() -> list[str]:
    return [line for line in git("status", "--porcelain=v1").splitlines() if line and not line.startswith("??")]


def worktree_state() -> dict:
    """Capture tracked and untracked state for provenance and release gates."""
    rows = git("status", "--porcelain=v1").splitlines()
    tracked = [line for line in rows if line and not line.startswith("??")]
    untracked = [line for line in rows if line.startswith("??")]
    return {
        "clean": not rows,
        "tracked_dirty": tracked,
        "untracked": untracked,
    }


def ensure_output_path(output: Path) -> Path:
    output = output.resolve()
    dist = DIST.resolve()
    if output == dist or dist not in output.parents:
        raise RuntimeError(f"refusing build target outside {dist}: {output}")
    return output


def locked_models() -> dict[str, Path]:
    paths = {name: PC / "models" / name for name in LOCKED}
    for name, path in paths.items():
        if not path.is_file():
            raise FileNotFoundError(path)
        digest = sha256(path)
        if digest != LOCKED[name]:
            raise RuntimeError(f"{name} is not the locked main artifact: {digest}")
    return paths


def rejected_hashes() -> set[str]:
    path = ROOT / "validation" / "contracts" / "rejected_models.json"
    if not path.is_file():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {str(value).lower() for model in payload.get("models", []) for value in model.get("sha256", [])}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def runtime_config() -> dict:
    cfg = json.loads((PC / "config" / "default.json").read_text(encoding="utf-8"))
    cfg["decision_contract"] = {
        "version": "seven-observation-v1",
        "window_size": 7,
        "quorum": 4,
        "signals": {"ALUMINUM_CAN": 0, "PET_CLEAN": 1, "PET_REJECT": 2},
        "clear_frames_to_rearm": 8,
    }
    return cfg


def payload_files(output: Path) -> list[Path]:
    return sorted(
        path for path in output.rglob("*")
        if path.is_file() and path.name not in {"BUILD_INFO.json", "payload.zip"}
    )


def payload_hash(output: Path) -> str:
    digest = hashlib.sha256()
    for path in payload_files(output):
        rel = path.relative_to(output).as_posix().encode()
        digest.update(rel + b"\0" + bytes.fromhex(sha256(path)) + b"\n")
    return digest.hexdigest()


def _copy_allowlisted(source_dir: Path, target_dir: Path, names: tuple[str, ...]) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    for name in names:
        source = source_dir / name
        if not source.is_file():
            raise FileNotFoundError(source)
        shutil.copy2(source, target_dir / name)


def _remove_generated_caches(root: Path) -> None:
    """Remove bytecode/cache files created while validating a bundle runtime."""
    # ``root`` is always a generated directory below Trash-detection/dist;
    # deleting only these generated cache entries cannot affect source or the
    # operator's dataset.
    for path in sorted(root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if path.is_dir() and path.name == "__pycache__":
            shutil.rmtree(path)
        elif path.is_file() and path.suffix.lower() in {".pyc", ".pyo"}:
            path.unlink()


def _validate_stage() -> tuple[Path, Path]:
    runtime = PORTABLE_STAGE / "python"
    wheels = PORTABLE_STAGE / "wheels"
    executable = runtime / "python.exe"
    if not executable.is_file():
        raise RuntimeError(
            "portable profile refused: stage windows-demo/portable-runtime/python/python.exe "
            "(Python 3.11 x64) before building"
        )
    try:
        probe = subprocess.check_output(
            [str(executable), "-c", "import json,platform,sys; print(json.dumps({'version':sys.version_info[:2], 'machine':platform.machine()}))"],
            text=True,
        ).strip()
        details = json.loads(probe)
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        raise RuntimeError(f"portable profile refused: staged Python runtime could not be inspected: {exc}") from exc
    if tuple(details.get("version", ())) != (3, 11):
        raise RuntimeError(f"portable profile refused: staged runtime is not Python 3.11: {details}")
    if str(details.get("machine", "")).lower() not in {"amd64", "x86_64", "amd64\n"}:
        raise RuntimeError(f"portable profile refused: staged runtime is not Windows x64: {details}")
    if not wheels.is_dir() or not any(wheels.iterdir()):
        raise RuntimeError("portable profile refused: local portable-runtime/wheels is missing or empty")
    manifest_path = wheels / "MANIFEST.json"
    if not manifest_path.is_file():
        raise RuntimeError("portable profile refused: wheels/MANIFEST.json with SHA-256 entries is required")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries = manifest["wheels"]
    except (OSError, ValueError, KeyError) as exc:
        raise RuntimeError(f"portable profile refused: invalid wheel manifest: {exc}") from exc
    actual = {path.name for path in wheels.glob("*.whl")}
    declared = {str(entry["filename"]) for entry in entries}
    if actual != declared:
        raise RuntimeError("portable profile refused: wheel manifest does not match wheelhouse contents")
    for entry in entries:
        filename = str(entry["filename"])
        if Path(filename).name != filename:
            raise RuntimeError(f"portable profile refused: invalid wheel filename: {filename}")
        path = wheels / filename
        if sha256(path) != str(entry["sha256"]).lower():
            raise RuntimeError(f"portable profile refused: wheel hash mismatch: {filename}")
    for path in runtime.rglob("*"):
        # Importing stdlib modules for the probe above can legitimately create
        # __pycache__ in the staging tree.  Those generated files are omitted
        # by copytree below and remain forbidden in the finished bundle.
        stage_parts = {part.lower() for part in path.relative_to(runtime).parts}
        disallowed = FORBIDDEN_PARTS - {"__pycache__"}
        if path.is_file() and stage_parts.intersection(disallowed):
            raise RuntimeError(f"portable runtime contains forbidden cache/environment path: {path}")
    return runtime, wheels


def stage_portable_runtime(output: Path) -> None:
    runtime_source, wheels = _validate_stage()
    embedded = output / "runtime" / "python"
    shutil.copytree(
        runtime_source,
        embedded,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"),
    )
    # Install only from the staged wheelhouse. This command is intentionally
    # never attempted for online-source or against the developer .venv.
    lock = PORTABLE_STAGE / "requirements.lock"
    command = [
        str(embedded / "python.exe"), "-m", "pip", "install",
        # The staged uv CPython distribution carries PEP 668 metadata.  This
        # is a disposable copied runtime, never the operator's installation,
        # so installing into it is the deliberate and isolated exception.
        "--break-system-packages",
        "--no-index", "--no-cache-dir", "--no-compile",
        "--find-links", str(wheels), "-r", str(lock),
    ]
    subprocess.run(command, cwd=output, check=True)
    subprocess.run([str(embedded / "python.exe"), "-m", "pip", "check"], cwd=output, check=True)
    _remove_generated_caches(output)


def copy_runtime(output: Path, profile: str, source_state: dict) -> dict[str, str]:
    model_paths = locked_models()
    rejected = rejected_hashes()
    for name, path in model_paths.items():
        if sha256(path) in rejected:
            raise RuntimeError(f"refusing rejected artifact {name}")
    runtime = output / "runtime"
    _copy_allowlisted(PC / "src", runtime / "src", RUNTIME_FILES)
    (runtime / "config").mkdir(parents=True, exist_ok=True)
    (runtime / "models" / "labels").mkdir(parents=True, exist_ok=True)
    write_json(runtime / "config" / "default.json", runtime_config())
    for name, path in model_paths.items():
        shutil.copy2(path, runtime / "models" / name)
    for name in ("m1_detector.txt", "m2_obb.txt"):
        shutil.copy2(PC / "models" / "labels" / name, runtime / "models" / "labels" / name)
    source_manifest = json.loads((PC / "models" / "manifest.json").read_text(encoding="utf-8"))
    models = []
    for entry in source_manifest.get("models", []):
        name = entry["filename"]
        if name not in LOCKED:
            continue
        path = runtime / "models" / name
        item = dict(entry)
        item.update({"sha256": sha256(path), "bytes": path.stat().st_size, "source_commit": git("rev-parse", "HEAD"), "source_path": f"pc-demo/models/{name}", "source_worktree": source_state})
        models.append(item)
    write_json(runtime / "models" / "manifest.json", {"target": "pc-windows-bundle", "models": models})
    if profile == "portable":
        stage_portable_runtime(output)
        shutil.copy2(PORTABLE_STAGE / "requirements.lock", output / "requirements.lock")
        shutil.copy2(PORTABLE_STAGE / "wheels" / "MANIFEST.json", output / "wheelhouse-manifest.json")
    else:
        shutil.copy2(PC / "requirements.txt", output / "requirements.txt")
    return {name: sha256(path) for name, path in model_paths.items()}


def write_bundle_files(output: Path, model_hashes: dict[str, str], profile: str, source_state: dict) -> None:
    _copy_allowlisted(SOURCE / "src", output / "src", WINDOW_FILES)
    shutil.copy2(SOURCE / "README.md", output / "README.md")
    for name in ("CONTEXT.md", "RUN_WINDOWS_DEMO.md"):
        shutil.copy2(SOURCE / name, output / name)
    offline_ready = profile == "portable"
    python_command = "runtime\\python\\python.exe" if offline_ready else "py -3.11"
    (output / "setup.ps1").write_text(
        "$ErrorActionPreference = 'Stop'\nSet-Location $PSScriptRoot\n" +
        "$env:PYTHONDONTWRITEBYTECODE = '1'\n" +
        ("if (-not (Test-Path 'runtime/python/python.exe')) { throw 'Portable runtime is missing.' }\n" if offline_ready else "Write-Warning 'ONLINE-SOURCE FALLBACK: internet/system Python may be required.'\n") +
        (("& .\\runtime\\python\\python.exe -B" if offline_ready else "& py -3.11 -B") + " .\\scripts\\self_check.py\n"), encoding="utf-8"
    )
    scripts = output / "scripts"
    scripts.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "scripts" / "bundle_self_check.py", scripts / "self_check.py")
    provenance = {
        "schema_version": "greenguard-detection-bundle-v1",
        "profile": profile,
        "offline_ready": offline_ready,
        "source_commit": git("rev-parse", "HEAD"),
        "source_branch": git("branch", "--show-current"),
        "source_worktree": source_state,
        "build_kind": "development" if not source_state["clean"] else "release",
        "release_ready": bool(source_state["clean"]),
        "model_hashes": model_hashes,
        "decision_contract": "seven-observation-v1 (4/7, eight-clear rearm)",
        "mechanical_control_included": False,
        "output_transport": "stdout-line",
        "output_encoding": "ASCII",
        "allowed_values": [0, 1, 2],
        "one_signal_per_item": True,
        "stdout_contains_signals_only": True,
        "signal_contract": "0=aluminum can, 1=good PET, 2=bad PET",
        "m1_internal_classes": ["metal_can", "pet_bottle"],
        "m1_public_classes": ["metal_can", "pet_bottle"],
        "m2_contract": "main PC Model 2; unchanged",
        "rejected_hashes": sorted(rejected_hashes()),
    }
    (output / "OFFLINE_STATUS.md").write_text(
        "# Runtime status\n\n" +
        ("This is a self-contained Windows x64 bundle. It contains the staged Python runtime and locked dependencies; no system Python or internet is required after build.\n" if offline_ready else "This is an ONLINE-SOURCE FALLBACK, not a portable/offline bundle. It does not contain an embedded Python runtime or installed dependencies.\n"), encoding="utf-8"
    )
    (output / "run_demo.bat").write_text(
        "@echo off\nsetlocal\ncd /d \"%~dp0\"\n" +
        "set \"PYTHONDONTWRITEBYTECODE=1\"\n" +
        ("if not exist \"runtime\\python\\python.exe\" (echo Portable runtime missing.& exit /b 2)\n"
         if offline_ready else "") +
        f"{python_command} src\\app.py %*\n", encoding="utf-8"
    )
    write_json(output / "BUILD_INFO.json", {**provenance, "payload_sha256": payload_hash(output)})


def _scan_forbidden(output: Path) -> str | None:
    for path in output.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in FORBIDDEN_SUFFIXES:
            return f"forbidden file type: {path.relative_to(output)}"
        # Third-party Python distributions may contain compiler diagnostics
        # with their own build-host paths (for example numpy/__config__.py).
        # Textual developer-path leakage is relevant to our project-owned
        # source/config/docs, not vendor runtime code.
        rel_parts = path.relative_to(output).parts
        lowered_parts = {part.lower() for part in rel_parts}
        if "firmware" in lowered_parts:
            return f"forbidden firmware path: {path.relative_to(output)}"
        if path.name.lower() in {"serial_controller.py", "pyserial"}:
            return f"forbidden machine-control module: {path.relative_to(output)}"
        if path.name in {"BUILD_INFO.json", "manifest.json"}:
            continue
        is_vendor_runtime = len(rel_parts) >= 2 and rel_parts[0].lower() == "runtime" and rel_parts[1].lower() == "python"
        if not is_vendor_runtime and any(part.lower() in FORBIDDEN_PARTS for part in rel_parts):
            return f"forbidden path component: {path.relative_to(output)}"
        if path.as_posix().lower().endswith("scripts/self_check.py"):
            continue
        if not is_vendor_runtime and path.suffix.lower() in {".json", ".md", ".py", ".bat", ".ps1", ".txt", ".ino"}:
            text = path.read_text(encoding="utf-8", errors="ignore")
            if "D:\\Code\\Project" in text or "C:\\Users\\" in text:
                return f"absolute development path leaked: {path.relative_to(output)}"
            if any(token in text.lower() for token in ("pyserial", "rvm-v2", "ack:<", "done:<", "--enable-serial", "--serial-port")):
                return f"forbidden machine-control reference: {path.relative_to(output)}"
    return None


def check(output: Path, require_offline: bool = False) -> tuple[bool, str]:
    try:
        output = ensure_output_path(output)
        models = locked_models()
        runtime_manifest = output / "runtime" / "models" / "manifest.json"
        manifest = json.loads(runtime_manifest.read_text(encoding="utf-8"))
        for name, source in models.items():
            packaged = output / "runtime" / "models" / name
            if sha256(packaged) != sha256(source) or sha256(packaged) != LOCKED[name]:
                return False, f"model hash mismatch: {name}"
        cfg = json.loads((output / "runtime" / "config" / "default.json").read_text(encoding="utf-8"))
        if "serial" in cfg or "routing" in cfg:
            return False, "machine-control configuration is present"
        contract = cfg.get("decision_contract", {})
        if contract.get("window_size") != 7 or contract.get("quorum") != 4 or contract.get("clear_frames_to_rearm") != 8:
            return False, "decision contract is not 7/4/eight-clear"
        if any(name not in LOCKED for name in (entry.get("filename") for entry in manifest.get("models", []))):
            return False, "manifest contains an unapproved model"
        forbidden = _scan_forbidden(output)
        if forbidden:
            return False, forbidden
        info = json.loads((output / "BUILD_INFO.json").read_text(encoding="utf-8"))
        required_info = {
            "mechanical_control_included": False,
            "output_transport": "stdout-line",
            "output_encoding": "ASCII",
            "allowed_values": [0, 1, 2],
            "one_signal_per_item": True,
            "stdout_contains_signals_only": True,
        }
        if any(info.get(key) != value for key, value in required_info.items()):
            return False, "detection-only output contract is incomplete"
        if require_offline and info.get("offline_ready") is not True:
            return False, "bundle is not offline-ready"
        if info.get("offline_ready") and not (output / "runtime" / "python" / "python.exe").is_file():
            return False, "offline bundle is missing embedded runtime/python/python.exe"
        if info.get("payload_sha256") != payload_hash(output):
            return False, "payload hash mismatch"
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        return False, str(exc)
    return True, "bundle checks passed"


def deterministic_zip(output: Path) -> Path:
    target = output.with_suffix(".zip")
    if target.exists():
        target.unlink()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in payload_files(output) + [output / "BUILD_INFO.json"]:
            info = zipfile.ZipInfo(path.relative_to(output).as_posix(), date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    return target


def smoke_interpreter(output: Path, info: dict) -> Path:
    """Select embedded Python for portable bundles and host Python otherwise."""
    if info.get("offline_ready"):
        return output / "runtime" / "python" / "python.exe"
    return Path(sys.executable)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "check", "headless-smoke"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--profile", choices=["portable", "online-source"], default="portable")
    parser.add_argument("--allow-dirty", action="store_true")
    parser.add_argument("--require-offline", action="store_true")
    parser.add_argument("--zip", action="store_true", dest="make_zip")
    args = parser.parse_args()
    output = ensure_output_path(args.output)
    if args.command == "build":
        source_state = worktree_state()
        if not source_state["clean"] and not args.allow_dirty:
            raise RuntimeError("release build refused: tracked or untracked worktree is dirty")
        if output.exists():
            shutil.rmtree(output)
        output.mkdir(parents=True)
        try:
            model_hashes = copy_runtime(output, args.profile, source_state)
            write_bundle_files(output, model_hashes, args.profile, source_state)
        except Exception:
            # A failed build must not leave a plausible-looking partial release.
            if output.exists():
                shutil.rmtree(output)
            raise
        ok, message = check(output, require_offline=args.profile == "portable")
        if not ok:
            raise RuntimeError(message)
        archive = deterministic_zip(output) if args.make_zip else None
        print(json.dumps({"output": str(output), "profile": args.profile, "offline_ready": args.profile == "portable", "payload_sha256": payload_hash(output), "zip": str(archive) if archive else None}, indent=2))
        return 0
    ok, message = check(output, require_offline=args.require_offline)
    if not ok:
        print(message, file=sys.stderr)
        return 1
    if args.command == "headless-smoke":
        fixture = PC / ".." / "validation" / "fixtures" / "m1_reference.jpg"
        info = json.loads((output / "BUILD_INFO.json").read_text(encoding="utf-8"))
        interpreter = smoke_interpreter(output, info)
        command = [str(interpreter), "-B", str(output / "src" / "app.py"), "--headless", "--source", str(fixture), "--max-frames", "1"]
        smoke_env = os.environ.copy()
        smoke_env["PYTHONDONTWRITEBYTECODE"] = "1"
        subprocess.run(command, cwd=output, check=True, env=smoke_env)
    print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
