"""Accept/reject PET from Model 2 detections.

A bottle is accepted only when cap, label, and liquid/water are all absent.
The `bottle` class is ignored for the verdict.
"""

VIOLATION_ORDER = ("cap", "label", "liquid")
VIOLATION_ALIASES = {
    "cap": "cap",
    "label": "label",
    "liquid": "liquid",
    "water": "liquid",
}


def canonical_violation(class_name):
    if not class_name:
        return None
    return VIOLATION_ALIASES.get(str(class_name).strip().lower())


def inspect_components(detections, conf_threshold=0.5):
    """Decide accept/reject from cap / label / liquid detections."""
    hits = {name: [] for name in VIOLATION_ORDER}
    visible = []

    for item in detections:
        if item.get("confidence", 0.0) < conf_threshold:
            continue
        visible.append(item)
        violation = canonical_violation(item.get("class_name"))
        if violation:
            hits[violation].append(item)

    present = [name for name in VIOLATION_ORDER if hits[name]]
    if present:
        decision = "reject"
        reason = "has_" + "_and_".join(present)
    else:
        decision = "accept"
        reason = "no_violation"

    scores = {
        name: max((item["confidence"] for item in hits[name]), default=0.0)
        for name in VIOLATION_ORDER
    }

    return {
        "decision": decision,
        "reason": reason,
        "has_cap": bool(hits["cap"]),
        "has_label": bool(hits["label"]),
        "has_liquid": bool(hits["liquid"]),
        "cap_confidence": scores["cap"],
        "label_confidence": scores["label"],
        "liquid_confidence": scores["liquid"],
        "detections": visible,
        "conf_threshold": conf_threshold,
    }
