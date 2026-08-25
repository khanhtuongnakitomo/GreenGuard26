"""Jetson environment checks (Python 3.6 compatible)."""
import platform
import sys


def main():
    print("python:", sys.version.split()[0], platform.machine())
    ok = True
    for mod in ("cv2", "numpy"):
        try:
            __import__(mod)
            print(mod, "ok")
        except ImportError as exc:
            print(mod, "MISSING:", exc)
            ok = False
    for mod in ("tensorrt", "pycuda"):
        try:
            __import__(mod)
            print(mod, "ok")
        except ImportError:
            print(mod, "optional/not installed")
    try:
        import onnxruntime  # noqa: F401

        print("onnxruntime ok")
    except ImportError:
        print("onnxruntime optional/not installed")
    try:
        with open("/etc/nv_tegra_release") as handle:
            print("L4T:", handle.read().strip().splitlines()[0])
    except Exception:
        print("L4T: not detected (not on Jetson?)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
