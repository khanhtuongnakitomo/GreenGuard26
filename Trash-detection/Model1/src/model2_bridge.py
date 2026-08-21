import sys
from pathlib import Path

from point_rules import pick_best_detection


MODEL2_ROOT = Path(__file__).resolve().parents[2] / "Model2"
MODEL2_SRC = MODEL2_ROOT / "src"
DEFAULT_WEIGHTS = MODEL2_ROOT / "models" / "best.pt"
PET_CLASS = "pet_bottle"


def default_model2_path():
    return DEFAULT_WEIGHTS


def load_component_pipeline(model_path, conf_threshold=0.5, crop_margin=0.15):
    src = str(MODEL2_SRC)
    if src not in sys.path:
        sys.path.insert(0, src)
    from pipeline import ComponentPipeline

    pipeline = ComponentPipeline(
        model_path=model_path,
        conf_threshold=conf_threshold,
        crop_margin=crop_margin,
    )
    return pipeline


def inspect_chosen_pet(pipeline, frame, detections, conf_threshold):
    """Run Model 2 only on the on-screen PET crop. Never on the full frame."""
    if pipeline is None:
        return None
    best = pick_best_detection(detections, conf_threshold)
    if best is None or best.get("class_name") != PET_CLASS:
        return None
    return pipeline.inspect_pet(frame, best)
