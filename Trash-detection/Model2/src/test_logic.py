from decision import inspect_components


def test_reject_cap_label_or_liquid():
    cap_only = inspect_components([{"class_name": "cap", "confidence": 0.91, "bbox": [0, 0, 1, 1]}])
    assert cap_only["decision"] == "reject"
    assert cap_only["reason"] == "has_cap"

    label_only = inspect_components([{"class_name": "label", "confidence": 0.88, "bbox": [0, 0, 1, 1]}])
    assert label_only["decision"] == "reject"
    assert label_only["reason"] == "has_label"

    liquid_only = inspect_components([{"class_name": "liquid", "confidence": 0.81, "bbox": [0, 0, 1, 1]}])
    assert liquid_only["decision"] == "reject"
    assert liquid_only["reason"] == "has_liquid"
    assert liquid_only["has_liquid"] is True

    water_alias = inspect_components([{"class_name": "water", "confidence": 0.80, "bbox": [0, 0, 1, 1]}])
    assert water_alias["decision"] == "reject"
    assert water_alias["reason"] == "has_liquid"

    all_three = inspect_components(
        [
            {"class_name": "cap", "confidence": 0.91, "bbox": [0, 0, 1, 1]},
            {"class_name": "label", "confidence": 0.88, "bbox": [0, 0, 1, 1]},
            {"class_name": "liquid", "confidence": 0.70, "bbox": [0, 0, 1, 1]},
        ]
    )
    assert all_three["decision"] == "reject"
    assert all_three["reason"] == "has_cap_and_label_and_liquid"


def test_accept_when_no_violations():
    clean = inspect_components([])
    assert clean["decision"] == "accept"
    assert clean["reason"] == "no_violation"

    bottle_only = inspect_components([{"class_name": "bottle", "confidence": 0.99, "bbox": [0, 0, 1, 1]}])
    assert bottle_only["decision"] == "accept"
    assert bottle_only["reason"] == "no_violation"

    low_conf = inspect_components([{"class_name": "cap", "confidence": 0.20, "bbox": [0, 0, 1, 1]}])
    assert low_conf["decision"] == "accept"

    at_threshold = inspect_components([{"class_name": "cap", "confidence": 0.50, "bbox": [0, 0, 1, 1]}])
    assert at_threshold["decision"] == "reject"


if __name__ == "__main__":
    test_reject_cap_label_or_liquid()
    test_accept_when_no_violations()
    print("decision tests passed")
