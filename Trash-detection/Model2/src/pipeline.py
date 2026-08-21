from component_detector import ComponentDetector
from crop_utils import crop_detection
from decision import inspect_components

PET_CLASS = "pet_bottle"


def best_pet_detection(detections, conf_threshold):
    pets = [
        item for item in detections
        if item["class_name"] == PET_CLASS and item["confidence"] >= conf_threshold
    ]
    if not pets:
        return None
    return max(pets, key=lambda item: item["confidence"])


class ComponentPipeline:
    def __init__(self, model_path, conf_threshold=0.5, crop_margin=0.15, min_conf=0.05):
        self.conf_threshold = conf_threshold
        self.crop_margin = crop_margin
        self.detector = ComponentDetector(model_path, min_conf=min_conf)

    def inspect_pet(self, frame, pet_detection):
        crop, (x1, y1, x2, y2) = crop_detection(frame, pet_detection, margin=self.crop_margin)
        if crop is None or crop.size == 0:
            return inspect_components([], self.conf_threshold)

        detections = self.detector.predict(crop, offset_x=x1, offset_y=y1)
        inspection = inspect_components(detections, self.conf_threshold)
        inspection["crop_bbox"] = [x1, y1, x2, y2]
        return inspection

    def reload_weights(self, model_path=None):
        return self.detector.reload_weights(model_path)
