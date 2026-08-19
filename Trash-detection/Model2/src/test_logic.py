from decision import inspect_components


def test_reject_cap_or_label():
    cap_only = inspect_components([{"class_name": "cap", "confidence": 0.91, "bbox": [0, 0, 1, 1]}])
    assert cap_only["decision"] == "reject"
    assert cap_only["reason"] == "has_cap"

    label_only = inspect_components([{"class_name": "label", "confidence": 0.88, "bbox": [0, 0, 1, 1]}])
    assert label_only["decision"] == "reject"
    assert label_only["reason"] == "has_label"

    both = inspect_components(
        [
            {"class_name": "cap", "confidence": 0.91, "bbox": [0, 0, 1, 1]},
            {"class_name": "label", "confidence": 0.88, "bbox": [0, 0, 1, 1]},
        ]
    )
    assert both["decision"] == "reject"
    assert both["reason"] == "has_cap_and_label"


def test_accept_when_neither_found():
    clean = inspect_components([])
    assert clean["decision"] == "accept"
    assert clean["reason"] == "no_violation"

    low_conf = inspect_components([{"class_name": "cap", "confidence": 0.20, "bbox": [0, 0, 1, 1]}])
    assert low_conf["decision"] == "accept"


if __name__ == "__main__":
    test_reject_cap_or_label()
    test_accept_when_neither_found()
    print("decision tests passed")
