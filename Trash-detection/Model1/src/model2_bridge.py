import sys
from pathlib import Path


MODEL2_ROOT = Path(__file__).resolve().parents[2] / "Model2"
MODEL2_SRC = MODEL2_ROOT / "src"
DEFAULT_WEIGHTS = MODEL2_ROOT / "models" / "best.pt"


def default_model2_path():
    return DEFAULT_WEIGHTS


def load_component_pipeline(model_path, conf_threshold=0.75, crop_margin=0.15):
    src = str(MODEL2_SRC)
    if src not in sys.path:
        sys.path.insert(0, src)
    from pipeline import ComponentPipeline, best_pet_detection

    pipeline = ComponentPipeline(
        model_path=model_path,
        conf_threshold=conf_threshold,
        crop_margin=crop_margin,
    )
    return pipeline, best_pet_detection
