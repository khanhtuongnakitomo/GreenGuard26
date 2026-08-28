from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

MODEL2_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = MODEL2_ROOT / "scripts"
PACKAGE_SCRIPTS = MODEL2_ROOT.parents[1] / "scripts"
for entry in (SCRIPTS, PACKAGE_SCRIPTS):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

import package_models  # noqa: E402
from live_finetune_common import load_config, parse_label_line, quad_from_polygon, validate_points  # noqa: E402
from prepare_live_finetune import assign_splits, build_groups  # noqa: E402


def test_parse_label_line_supports_multi_corner_polygons():
    raw_class, points = parse_label_line("2 0.1 0.1 0.3 0.1 0.35 0.2 0.3 0.3 0.1 0.3")
    assert raw_class == 2
    assert points.shape == (5, 2)

    quad = quad_from_polygon(points, 1920, 1080)
    assert quad.shape == (4, 2)
    ok, error = validate_points(
        quad,
        width=1920,
        height=1080,
        min_polygon_area_fraction=0.00001,
        min_side_pixels=2.0,
    )
    assert ok, error


def test_validate_points_rejects_out_of_bounds():
    _, points = parse_label_line("1 0.1 0.1 0.2 -0.01 0.3 0.2 0.1 0.2")
    ok, error = validate_points(
        points,
        width=1920,
        height=1080,
        min_polygon_area_fraction=0.00001,
        min_side_pixels=2.0,
    )
    assert not ok
    assert error == "coordinate_out_of_bounds"


def test_build_groups_and_assign_splits_respects_sequence_gap():
    cfg = load_config()
    samples = []
    for name, cls_name in [
        ("WIN_20260827_14_41_22_Pro.jpg", "cap"),
        ("WIN_20260827_14_41_36_Pro.jpg", "cap"),
        ("WIN_20260827_14_42_31_Pro.jpg", "label"),
        ("WIN_20260827_14_43_41_Pro.jpg", "ring"),
    ]:
        presence = {"cap": 0, "label": 0, "ring": 0}
        presence[cls_name] = 1
        samples.append(
            {
                "image_name": name,
                "image_stem": Path(name).stem,
                "class_presence": presence,
                "metrics": {
                    "lighting_bucket": "normal",
                    "highlight_bucket": "low",
                    "orientation_bucket": "vertical",
                    "pose_bucket": "tilted_negative",
                },
                "is_negative": False,
            }
        )
    groups = build_groups(samples, gap_seconds=45)
    assert len(groups) == 3
    assert groups[0]["sample_names"] == ["WIN_20260827_14_41_22_Pro.jpg", "WIN_20260827_14_41_36_Pro.jpg"]

    assignment = assign_splits(cfg, groups)
    assert set(assignment) == {group["group_id"] for group in groups}


def test_package_models_stage_root_supports_m2_only_snapshot():
    with tempfile.TemporaryDirectory() as tmp_dir:
        stage_root = Path(tmp_dir)
        code, info = package_models.package_target("pc", scope="m2", check_only=False, stage_root=stage_root)
        assert code == 0, info
        staged_dir = stage_root / "pc" / "models"
        assert (staged_dir / "manifest.json").is_file()
        assert (staged_dir / "m2_obb_640.onnx").is_file()
        assert (staged_dir / "m1_detect_640.onnx").is_file()

        check_code, check_info = package_models.package_target("pc", scope="m2", check_only=True, stage_root=stage_root)
        assert check_code == 0, check_info
