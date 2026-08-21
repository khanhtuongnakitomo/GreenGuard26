"""Read reinforcement-learning flags from Model1/.env."""

from pathlib import Path

from dotenv import load_dotenv
import os


MODEL1_ROOT = Path(__file__).resolve().parents[1]
MODEL2_ROOT = MODEL1_ROOT.parent / "Model2"

load_dotenv(MODEL1_ROOT / ".env", override=True)


def _flag(name, default="off"):
    raw = os.getenv(name, default)
    if raw is None:
        return False
    return str(raw).strip().lower() in {"1", "true", "on", "yes", "enabled"}


def rl_enabled():
    return _flag("REINFORCEMENT_LEARNING", "off")


def rl_auto_train():
    return _flag("RL_AUTO_TRAIN", "off")


def rl_save_accepts():
    return _flag("RL_SAVE_ACCEPTS", "on")


def rl_min_samples():
    try:
        return max(1, int(os.getenv("RL_MIN_SAMPLES", "5")))
    except ValueError:
        return 5


def rl_epochs():
    try:
        return max(1, int(os.getenv("RL_EPOCHS", "3")))
    except ValueError:
        return 3


def rl_device():
    return os.getenv("RL_DEVICE", "0").strip() or "0"


def live_dataset_root():
    return MODEL2_ROOT / "data" / "live"
