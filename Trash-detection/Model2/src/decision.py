CAP_CLASS = "cap"
LABEL_CLASS = "label"


def inspect_components(detections, conf_threshold=0.75):
    """Decide accept/reject from cap/label detections.

    Presence of cap OR label at/above the threshold is a preparation violation.
    PET is acceptable only when neither class is found.
    """
    cap_hits = [
        item for item in detections
        if item["class_name"] == CAP_CLASS and item["confidence"] >= conf_threshold
    ]
    label_hits = [
        item for item in detections
        if item["class_name"] == LABEL_CLASS and item["confidence"] >= conf_threshold
    ]

    has_cap = bool(cap_hits)
    has_label = bool(label_hits)
    visible = [item for item in detections if item["confidence"] >= conf_threshold]

    if has_cap and has_label:
        reason = "has_cap_and_label"
        decision = "reject"
    elif has_cap:
        reason = "has_cap"
        decision = "reject"
    elif has_label:
        reason = "has_label"
        decision = "reject"
    else:
        reason = "no_violation"
        decision = "accept"

    return {
        "decision": decision,
        "reason": reason,
        "has_cap": has_cap,
        "has_label": has_label,
        "cap_confidence": max((item["confidence"] for item in cap_hits), default=0.0),
        "label_confidence": max((item["confidence"] for item in label_hits), default=0.0),
        "detections": visible,
        "conf_threshold": conf_threshold,
    }
