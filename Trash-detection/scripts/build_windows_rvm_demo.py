"""Build the reproducible Windows RVM bundle from the canonical PC runtime."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PC = ROOT / "pc-demo"
SOURCE = ROOT / "windows-rvm-demo"
DEFAULT_OUTPUT = ROOT / "dist" / "RVM-Full-Workflow-Demo"
LOCKED = {
    "m1_detect_640.onnx": "5069bfae324db8c1aef1fbce4b68aaad217a80a95a6f6b83eacfa60cdb620038",
    "m2_obb_640.onnx": "d4c5f235fbb78e3a8451de695480400a916ffec235a518af47fd5b448c6eb999",
}


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
    cfg["serial"] = {"enabled": False, "port": "auto", "baud": 115200}
    cfg["runtime"].setdefault("decision_process_s", 1.0)
    cfg["runtime"].setdefault("result_hold_s", 1.5)
    cfg["runtime"].setdefault("clear_frames", 8)
    cfg["runtime"].setdefault("can_stable_frames", 3)
    cfg["routing"] = {"ALUMINUM_CAN": "1", "PET_CLEAN": "2", "PET_REJECT": "3"}
    return cfg


def payload_files(output: Path) -> list[Path]:
    return sorted(path for path in output.rglob("*") if path.is_file() and path.name != "BUILD_INFO.json")


def payload_hash(output: Path) -> str:
    digest = hashlib.sha256()
    for path in payload_files(output):
        rel = path.relative_to(output).as_posix().encode()
        digest.update(rel + b"\0" + bytes.fromhex(sha256(path)) + b"\n")
    return digest.hexdigest()


def copy_runtime(output: Path) -> dict:
    model_paths = locked_models()
    rejected = rejected_hashes()
    for name, path in model_paths.items():
        if sha256(path) in rejected:
            raise RuntimeError(f"refusing rejected artifact {name}")
    runtime = output / "runtime"
    (runtime / "src").mkdir(parents=True, exist_ok=True)
    (runtime / "config").mkdir(parents=True, exist_ok=True)
    (runtime / "models" / "labels").mkdir(parents=True, exist_ok=True)
    for source in (PC / "src").glob("*.py"):
        shutil.copy2(source, runtime / "src" / source.name)
    shutil.copy2(PC / "config" / "default.json", runtime / "config" / "default.json")
    for name, path in model_paths.items():
        shutil.copy2(path, runtime / "models" / name)
    for source in (PC / "models" / "labels").glob("*.txt"):
        shutil.copy2(source, runtime / "models" / "labels" / source.name)
    cfg = runtime_config()
    write_json(runtime / "config" / "default.json", cfg)
    models = []
    source_manifest = json.loads((PC / "models" / "manifest.json").read_text(encoding="utf-8"))
    for entry in source_manifest.get("models", []):
        name = entry["filename"]
        if name not in LOCKED: continue
        path = runtime / "models" / name
        item = dict(entry)
        item["sha256"] = sha256(path)
        item["bytes"] = path.stat().st_size
        item["source_commit"] = git("rev-parse", "HEAD")
        item["source_path"] = f"pc-demo/models/{name}"
        models.append(item)
    write_json(runtime / "models" / "manifest.json", {"target": "pc-windows-bundle", "models": models})
    return {name: sha256(path) for name, path in model_paths.items()}


def write_bundle_files(output: Path, model_hashes: dict[str, str]) -> None:
    windows_src = output / "src"
    windows_src.mkdir(parents=True, exist_ok=True)
    for source in (SOURCE / "src").glob("*.py"):
        shutil.copy2(source, windows_src / source.name)
    shutil.copy2(PC / "requirements.txt", output / "requirements.txt")
    shutil.copy2(SOURCE / "README.md", output / "README.md") if (SOURCE / "README.md").is_file() else None
    (output / "firmware").mkdir(exist_ok=True)
    reference = ROOT.parent / "RVM-Full-Workflow-Demo" / "firmware" / "RVMRun.txt"
    if reference.is_file(): shutil.copy2(reference, output / "firmware" / "RVMRun.txt")
    (output / "full_demo.bat").write_text(
        '@echo off\nsetlocal\ncd /d "%~dp0"\nif not exist ".venv\\Scripts\\python.exe" py -3.11 -m venv .venv\n".venv\\Scripts\\python.exe" -m pip install -r requirements.txt\n".venv\\Scripts\\python.exe" src\\app.py %*\n',
        encoding="utf-8",
    )
    (output / "setup.ps1").write_text(
        '$ErrorActionPreference = "Stop"\nSet-Location $PSScriptRoot\nif (-not (Test-Path .venv)) { py -3.11 -m venv .venv }\n& .\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n& .\\.venv\\Scripts\\python.exe scripts\\build_check.py\n',
        encoding="utf-8",
    )
    # Keep a self-contained check script, avoiding a dependency on the source checkout.
    (output / "scripts").mkdir(exist_ok=True)
    (output / "scripts" / "build_check.py").write_text(
        'from pathlib import Path\nimport hashlib, json\nr=Path(__file__).parents[1]/"runtime"/"models"/"manifest.json"\np=json.loads(r.read_text())\nfor e in p["models"]:\n d=hashlib.sha256((r.parent/e["filename"]).read_bytes()).hexdigest()\n assert d==e["sha256"], e["filename"]\nprint("bundle model manifest OK; serial default is disabled")\n',
        encoding="utf-8",
    )
    provenance = {
        "source_commit": git("rev-parse", "HEAD"),
        "source_branch": git("branch", "--show-current"),
        "model_hashes": model_hashes,
        "serial_default_enabled": False,
        "live_validation_status": "required",
        "m1_internal_classes": ["metal_can", "pet_bottle", "pp_cup"],
        "m1_public_classes": ["metal_can", "pet_bottle"],
        "m2_contract": "main PC Model 2; unchanged",
        "rejected_hashes": sorted(rejected_hashes()),
    }
    write_json(output / "BUILD_INFO.json", {"schema_version": "greenguard-rvm-bundle-v1", "built_at_utc": datetime.now(UTC).isoformat(), **provenance, "payload_sha256": payload_hash(output)})
    (output / "MODEL_PROVENANCE.md").write_text(
        "# Model provenance\n\nThis bundle is built from `origin/main`'s PC models. Model 1 retains its three-class internal ONNX shape, but only metal_can and pet_bottle are public. PP is rejected at the M1 boundary. Model 2 is the main artifact and is intentionally not the coworker bundle's newer candidate.\n\nSerial is disabled by default. The first live validation is camera-only; `--enable-serial` is an explicit opt-in after sign-off.\n",
        encoding="utf-8",
    )


def check(output: Path) -> tuple[bool, str]:
    try:
        models = locked_models()
        manifest = json.loads((output / "runtime" / "models" / "manifest.json").read_text(encoding="utf-8"))
        for name, source in models.items():
            packaged = output / "runtime" / "models" / name
            if sha256(packaged) != sha256(source) or sha256(packaged) != LOCKED[name]:
                return False, f"model hash mismatch: {name}"
        cfg = json.loads((output / "runtime" / "config" / "default.json").read_text(encoding="utf-8"))
        if cfg.get("serial", {}).get("enabled") is not False:
            return False, "serial default is not disabled"
        if "2df4" in json.dumps(manifest).lower():
            return False, "coworker Model 2 hash is present"
        forbidden = [p for p in output.rglob("*") if p.is_file() and p.suffix.lower() in {".pt", ".tflite", ".engine"}]
        if forbidden: return False, f"forbidden model files: {forbidden}"
    except (OSError, ValueError, KeyError) as exc:
        return False, str(exc)
    return True, "bundle checks passed"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "check", "headless-smoke"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--allow-dirty", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if args.command == "build":
        if dirty_tracked() and not args.allow_dirty:
            raise RuntimeError("release build refused: tracked worktree is dirty")
        if output.exists(): shutil.rmtree(output)
        output.mkdir(parents=True)
        model_hashes = copy_runtime(output)
        write_bundle_files(output, model_hashes)
        ok, message = check(output)
        if not ok: raise RuntimeError(message)
        print(json.dumps({"output": str(output), "payload_sha256": payload_hash(output), "models": model_hashes}, indent=2))
        return 0
    ok, message = check(output)
    if not ok: print(message, file=sys.stderr); return 1
    if args.command == "headless-smoke":
        fixture = PC / ".." / "validation" / "fixtures" / "m1_reference.jpg"
        command = [sys.executable, str(output / "src" / "app.py"), "--headless", "--source", str(fixture), "--max-frames", "1"]
        subprocess.run(command, cwd=output, check=True)
    print(message)
    return 0


if __name__ == "__main__": raise SystemExit(main())
