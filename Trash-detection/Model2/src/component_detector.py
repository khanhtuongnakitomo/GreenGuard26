from pathlib import Path

from ultralytics import YOLO


def _class_name(names, class_id):
    class_id = int(class_id)
    if isinstance(names, dict):
        return names.get(class_id, str(class_id))
    if 0 <= class_id < len(names):
        return names[class_id]
    return str(class_id)


def _polygon_points(polygon):
    """Normalize Ultralytics OBB corners to [[x, y], ...].

    xyxyxyxy is (N, 4, 2) — already four [x, y] points — or rarely a flat (N, 8).
    """
    if not polygon:
        return []
    first = polygon[0]
    if isinstance(first, (list, tuple)):
        return [list(point[:2]) for point in polygon if point]
    return [[polygon[i], polygon[i + 1]] for i in range(0, len(polygon) - 1, 2)]


def _shift_polygon(polygon, offset_x, offset_y):
    shifted = []
    for x, y in polygon:
        shifted.append([float(x + offset_x), float(y + offset_y)])
    return shifted


def _detections_from_obb(result, offset_x=0, offset_y=0):
    if result.obb is None or len(result.obb) == 0:
        return []

    names = result.names
    polygons = result.obb.xyxyxyxy.cpu().tolist()
    boxes = result.obb.xyxy.cpu().tolist()
    confidences = result.obb.conf.cpu().tolist()
    classes = result.obb.cls.cpu().tolist()

    detections = []
    for polygon, bbox, confidence, class_id in zip(polygons, boxes, confidences, classes):
        x1, y1, x2, y2 = bbox
        detections.append(
            {
                "class_name": _class_name(names, class_id),
                "confidence": float(confidence),
                "bbox": [
                    float(x1 + offset_x),
                    float(y1 + offset_y),
                    float(x2 + offset_x),
                    float(y2 + offset_y),
                ],
                "polygon": _shift_polygon(_polygon_points(polygon), offset_x, offset_y),
            }
        )
    return detections


def _detections_from_boxes(result, offset_x=0, offset_y=0):
    if result.boxes is None or len(result.boxes) == 0:
        return []

    names = result.names
    boxes = result.boxes.xyxy.cpu().tolist()
    confidences = result.boxes.conf.cpu().tolist()
    classes = result.boxes.cls.cpu().tolist()

    detections = []
    for bbox, confidence, class_id in zip(boxes, confidences, classes):
        x1, y1, x2, y2 = bbox
        detections.append(
            {
                "class_name": _class_name(names, class_id),
                "confidence": float(confidence),
                "bbox": [
                    float(x1 + offset_x),
                    float(y1 + offset_y),
                    float(x2 + offset_x),
                    float(y2 + offset_y),
                ],
                "polygon": [
                    [float(x1 + offset_x), float(y1 + offset_y)],
                    [float(x2 + offset_x), float(y1 + offset_y)],
                    [float(x2 + offset_x), float(y2 + offset_y)],
                    [float(x1 + offset_x), float(y2 + offset_y)],
                ],
            }
        )
    return detections


class ComponentDetector:
    def __init__(self, model_path, min_conf=0.05):
        self.model_path = Path(model_path)
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model 2 weights not found: {self.model_path}")
        self.min_conf = min_conf
        self.model = YOLO(str(self.model_path))

    def reload_weights(self, model_path=None):
        path = Path(model_path) if model_path else self.model_path
        if not path.exists():
            return False
        self.model_path = path
        self.model = YOLO(str(path))
        return True

    def predict(self, image, offset_x=0, offset_y=0):
        results = self.model.predict(source=image, conf=self.min_conf, verbose=False)
        if not results:
            return []
        result = results[0]
        detections = _detections_from_obb(result, offset_x, offset_y)
        if detections:
            return detections
        return _detections_from_boxes(result, offset_x, offset_y)
