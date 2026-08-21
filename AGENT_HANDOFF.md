# GreenGuard26 — Agent Handoff (full chat context)

**Purpose:** Give a new agent on another machine (laptop) everything needed to continue this project without rereading the original chat.

**Workspace on the original PC:** `d:\Code\Project\bki`  
**Git repo to clone/pull:** `GreenGuard26` (`https://github.com/khanhtuongnakitomo/GreenGuard26`)  
**Date of this snapshot:** 2026-08-21  
**Language of product UI:** English labels on the kiosk overlay (`ACCEPT`, `REJECT`, `VIOLATION`, `OTHERS`). Owner often writes in Vietnamese.

If this file is not in the cloned repo yet, copy it into `GreenGuard26/AGENT_HANDOFF.md` before asking the laptop agent to work.

---

## 1. What GreenGuard is

GreenGuard is a recycling kiosk / reverse-vending prototype. A user inserts a container. Vision decides:

1. What material it is.
2. For PET bottles only: whether the bottle is still wearing a **cap** and/or **label** (preparation violation).
3. Accept (count + points/QR) or reject (do not count).

Accepted **countable** items (current product rule):

- Aluminum cans (`metal_can`)
- PET bottles (`pet_bottle`) that pass Model 2 (no cap, no label)

Everything else on screen is **`others`** (including the old class `pp_cup`). `others` is shown, not counted.

Related apps in the same `bki` folder (not all required for CV work):

- `GreenGuard26/` — kiosk CV + dashboard
- `GreenPoint-Backend/` — QR / points API (`QR_SECRET` must match Model1 `.env`)

---

## 2. Two context docs that DISAGREE — ignore them for product rules

| File | What it says | Status |
|---|---|---|
| `GreenGuard_Computer_Vision_Model_Context.md` (in `bki/`, not necessarily in the git repo) | Accept PET if bottle **has** cap + label; use two pretrained detectors; **do not train** | **OVERRIDDEN** |
| `FEAT.md` (in `bki/`) | Model 2 = binary classifier `no_violation` / `violation` | **OVERRIDDEN** for this sprint |

**Locked product rules from the owner (follow these):**

- Model 1 detects material.
- Model 2 is a **cap + label detector** (YOLO OBB), not a binary classifier.
- PET with **cap OR label** still visible → **REJECT / VIOLATION**, do not count.
- PET with **neither** cap nor label → **ACCEPT / NO VIOLATION**, count.
- Cans skip Model 2.
- Deadline strategy originally said “don’t train”; the owner later chose **local YOLO11n-OBB training** on the Roboflow dataset. Weights are in git: `Trash-detection/Model2/models/best.pt`.

---

## 3. Architecture (how the two models run)

**Linear / gated, not parallel.**

Both models are **loaded at startup**. Each camera frame:

```text
webcam frame
  → Model 1 (always): metal_can | pet_bottle | others
  → pick best detection (prefer can/PET over others)
  → if chosen class is pet_bottle:
        crop that bounding box (+15% margin)
        Model 2 runs ONLY on the crop (never the full frame)
        cap or label ≥ 0.5 → reject
        else → accept
  → else skip Model 2
  → session state machine → OpenCV UI
```

Not two models on every frame. Not Model 2 replacing Model 1.

Entry points:

- PC demo: `Trash-detection/Model1/src/test_webcam.py`
- Pi / TFLite: `Trash-detection/Model1/src/inference_tflite.py` (same session + Model 2 hook)

---

## 4. Repo layout (Trash-detection)

```text
GreenGuard26/Trash-detection/
  README.md                 # clone / detect-only / train / RL
  Model1/                   # kiosk: material YOLO + session + UI + RL trigger
    .env.example
    setup.ps1
    models/best.pt          # Model 1 weights (committed)
    models/best_float16.tflite
    src/test_webcam.py
    src/inference_tflite.py
    src/session.py
    src/ui.py
    src/point_rules.py      # ACCEPTED_CLASSES, others mapping
    src/model2_bridge.py    # load Model 2, inspect_chosen_pet
    src/rl_config.py
    src/rl_learner.py
  Model2/                   # PET cap/label OBB
    train.ps1 / src/train.py
    src/finetune_live.py    # fine-tune from kiosk live crops
    src/pipeline.py         # crop + detect + decision
    src/crop_utils.py
    src/decision.py
    src/component_detector.py
    models/best.pt          # Model 2 weights (committed, ~5.6MB)
    configs/data.yaml
```

**Gitignored (not on laptop after clone):**

- `Model1/data/`, `Model2/data/` — datasets
- `.venv/`, `.env`, `runs/`, logs
- Live RL samples: `Model2/data/live/`

**Committed for laptop testing without retraining:**

- `Model1/models/best.pt`
- `Model2/models/best.pt`

---

## 5. Model 1

- Classes in the neural net still include `pp_cup`.
- After inference, `remap_detections()` maps anything that is not `metal_can` or `pet_bottle` → `others`.
- `pick_best_detection()` **prefers** can/PET so extra classes do not steal the overlay every frame (this was a flicker bug).
- Display names: `aluminum can`, `PET bottle`, `others`.
- Default Model 1 accept threshold: `--conf 0.65`.

---

## 6. Model 2

- Task: YOLO **OBB** (oriented boxes), classes `0: cap`, `1: label`.
- Dataset used to train: Roboflow `mohammed-essam-iz1ve/bottle-cap-label-detection` v3, YOLO OBB export, ~1558 images, in `Model2/data/dataset-2/` locally (not in git).
- Base: `yolo11n-obb.pt`. Must use OBB, not plain `yolo11n.pt`. Labels are 8 corner numbers per object.
- Inference: `ComponentPipeline.inspect_pet(frame, pet_detection)` crops then predicts on the crop.
- Decision (`decision.py`): if **cap OR label** confidence ≥ **0.5** → `reject`. Else `accept` / `no_violation`.
- Model 2 is only called when the **on-screen best class** is `pet_bottle` (`inspect_chosen_pet` in `model2_bridge.py`).

**Do not** add a third COCO YOLO11n “bottle” model. Bottle presence comes from Model 1 `pet_bottle`.

---

## 7. UI contract (kiosk, not debugger)

Default: **no cap/label polygons, no score chips**.

| Situation | Overlay |
|---|---|
| PET, cap or label on | `REJECT` / `VIOLATION` |
| PET, prepared | `ACCEPT` / `NO VIOLATION` |
| Can | `ACCEPT` / `aluminum can` |
| Not can/PET | `OTHERS` |

Debug boxes (developers only):

```powershell
python src\test_webcam.py --debug-boxes
```

Session states: `idle` | `detecting` | `accepted` | `rejected` | `countdown` | `loading` | `qr_display`.

Demo mode (`--demo` default **True**): `F` toggle detection, `G` QR, `Q` quit. Demo can stay in `detecting` while counting; UI still shows ACCEPT/NO VIOLATION for a clean PET from inspection.

---

## 8. Laptop: detection-only (what you should do first)

```powershell
git clone https://github.com/khanhtuongnakitomo/GreenGuard26.git
cd GreenGuard26\Trash-detection\Model1
.\setup.ps1
copy .env.example .env
# edit QR_SECRET / backend only if you need QR
python src\test_webcam.py
```

No dataset download needed. GPU not required for this path.

If OpenCV window fails: re-run `setup.ps1` (headless vs GUI opencv conflict).

---

## 9. Training Model 2 (only if retraining)

`uv pip install -r requirements.txt` installs **CPU** PyTorch (`2.x+cpu`). Then `train.ps1` fails with “CUDA GPU not visible” even if an RTX is present.

Fix:

```powershell
uv pip uninstall torch torchvision
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

Then from `Model2/`:

```powershell
.\train.ps1
# VRAM tight: .\train.ps1 -Batch 8
```

Need `data/dataset-2/` locally (Roboflow OBB export). `data.yaml` must have `path: data/dataset-2`.

Do **not** run long GPU training inside the Cursor agent chat (blocks the session).

---

## 10. “Reinforcement learning” (live improvement)

**Honest name:** outcome-driven **online data collection + optional fine-tune**. Not DQN / policy gradient.

Toggle in `Model1/.env` (not scattered in code):

```text
REINFORCEMENT_LEARNING=on   # or off
RL_AUTO_TRAIN=off           # keep off during demos
RL_SAVE_ACCEPTS=on
RL_MIN_SAMPLES=5
RL_EPOCHS=3
RL_DEVICE=0
```

When ON:

- Each PET **reject** or **accept** (once per item, not every frame) saves the **crop** Model 2 saw.
- Reject: YOLO OBB label file from cap/label polygons, remapped into crop coordinates.
- Accept: empty label file (prepared bottle).
- Files: `Model2/data/live/images|labels/` plus a small JSON sidecar.
- HUD: `RL ON`.

`RL_AUTO_TRAIN=on`: after `RL_MIN_SAMPLES` new items, spawn **`python Model2/src/finetune_live.py`** as a **subprocess** (so the webcam loop does not freeze), then reload `Model2/models/best.pt` via `reload.flag`.

Manual fine-tune:

```powershell
cd GreenGuard26\Trash-detection\Model2
python src\finetune_live.py --epochs 3 --device 0
```

Default for demos: `REINFORCEMENT_LEARNING=on`, `RL_AUTO_TRAIN=off`.

---

## 11. Important files (where to edit)

| Concern | File |
|---|---|
| Material whitelist / others | `Model1/src/point_rules.py` |
| Accept/reject session, learning events | `Model1/src/session.py` |
| Verdict-only overlay | `Model1/src/ui.py` |
| Webcam loop | `Model1/src/test_webcam.py` |
| Call Model 2 on chosen PET crop | `Model1/src/model2_bridge.py` |
| Crop geometry | `Model2/src/crop_utils.py` |
| Cap/label → violation rule | `Model2/src/decision.py` |
| Env flags for RL | `Model1/src/rl_config.py`, `Model1/.env.example` |
| Save live samples / spawn fine-tune | `Model1/src/rl_learner.py` |
| Fine-tune job | `Model2/src/finetune_live.py` |
| Points / API item names | `Model1/src/point_rules.py` (`pet_bottle`, `metal_can` only) |

---

## 12. Constraints for the next agent

1. Do not replace Model 1 with Model 2.
2. Do not run Model 2 on the full frame; crop PET first.
3. Do not draw cap/label boxes unless `--debug-boxes`.
4. Do not count `others` or rejected PET.
5. Do not commit datasets, `.env`, or `data/live/`.
6. Do not train inside the camera loop.
7. Do not assume Roboflow Universe `.pt` download (often paid); local `best.pt` is the source of truth.
8. Ultralytics default `torch` on Windows is CPU-only.
9. Owner may say “reinforcement learning” meaning **save kiosk crops and fine-tune**.
10. Smallest change that matches existing architecture.

---

## 13. How to test after a change

```powershell
cd GreenGuard26\Trash-detection\Model1
python src\test_webcam.py
```

| Input | Expect |
|---|---|
| PET with cap or label | REJECT / VIOLATION, not counted |
| PET cap off, label off | ACCEPT / NO VIOLATION, counted |
| Aluminum can | ACCEPT, Model 2 skipped |
| Cup / random object | OTHERS, not counted |

With RL on: insert PET reject → a new jpg/txt under `Model2/data/live/`.

---

## 14. Chat history — decisions in order

1. Owner asked for understanding of `GreenGuard_Computer_Vision_Model_Context.md` (pretrained two-model, no train).
2. Then asked for a plan after inspecting `GreenGuard26/` and Model2 data.
3. Clarified: **train YOLO11n-OBB locally**, hook into Model 1, PET only, conf 0.75, laptop webcam.
4. **Inverted** the first context doc: cap/label present = **reject**.
5. Agent implemented Model2 train scripts + Model1 hook; owner trains on GPU (not in chat).
6. First train failed: `torch==...+cpu` despite RTX 3060.
7. Git: datasets gitignored, commit+push Model2 weights + layout + README.
8. Owner asked: sequential or parallel? **Sequential, PET-gated.**
9. Flicker / wrong classes: only can + PET countable; rest `others`; prefer those two for “best box”.
10. Crop → Model 2; UI verdict-only (built).
11. Env-gated live learning (`REINFORCEMENT_LEARNING=on`) (built).
12. This file: handoff for the laptop agent.

---

## 15. Suggested first message for the laptop agent

> Read `GreenGuard26/AGENT_HANDOFF.md` then `Trash-detection/README.md`. Work in `Trash-detection/Model1` and `Model2`. Do not retrain unless asked. Preserve crop-only Model 2, verdict-only UI, and env-gated live learning.

---

## 16. What is still unfinished / risk

- Live kiosk camera vs laptop webcam domain gap (Roboflow photos ≠ machine lighting).
- `pp_cup` still exists in Model 1 weights; it is remapped to `others` in software, not removed from the net.
- RL auto-train on a weak GPU will still be slow; keep `RL_AUTO_TRAIN=off` on the laptop unless they have CUDA torch.
- QR/backend needs a valid `Model1/.env`; detection works without it.
- Some README lines in `Model1/README.md` still describe the **old** 3-class / old folder layout; prefer this handoff + `Trash-detection/README.md` as source of truth for the current two-model kiosk.
