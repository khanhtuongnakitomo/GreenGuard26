# Must match app/backend/src/config/constants.ts POINT_RULES
POINT_RULES = {
    "pet_bottle": 10,
    "metal_can": 8,
}

# Live kiosk only accepts aluminum cans and PET bottles.
ACCEPTED_CLASSES = {"metal_can", "pet_bottle"}
OTHER_CLASS = "others"

# The detector may still output extra classes such as pp_cup.
CLASS_NAME_MAP = {
    "pet_bottle": "pet_bottle",
    "metal_can": "metal_can",
}


def map_class_name(class_name):
    if class_name in ACCEPTED_CLASSES:
        return class_name
    return OTHER_CLASS


def is_accepted_class(class_name):
    return class_name in ACCEPTED_CLASSES


def remap_detections(detections):
    remapped = []
    for item in detections:
        updated = dict(item)
        updated["class_name"] = map_class_name(item.get("class_name"))
        remapped.append(updated)
    return remapped


def pick_best_detection(detections, conf_threshold):
    """Prefer can/PET so extra classes do not steal the overlay every frame."""
    above = [item for item in detections if item.get("confidence", 0) >= conf_threshold]
    if not above:
        return None
    accepted = [item for item in above if is_accepted_class(item["class_name"])]
    pool = accepted if accepted else above
    return max(pool, key=lambda item: item["confidence"])


def calculate_points(items):
    """
    items: list of dicts like [{"itemType": "plastic_bottle", "quantity": 2}, ...]
    """
    return sum(POINT_RULES.get(i["itemType"], 0) * i["quantity"] for i in items)
