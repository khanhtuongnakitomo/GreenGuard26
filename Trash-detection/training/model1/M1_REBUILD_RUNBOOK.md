# Model 1 rebuild and morning validation runbook

This workflow creates a candidate two-class Model 1 for the measured GreenGuard
camera environment. It reads incoming data without modifying it, starts from
the general yolo11s.pt weights, and never writes the active
pc-demo/models/m1_detect_640.onnx or any Model 2 artifact. The candidate is
never activated automatically.

## Complete overnight command

Run from Trash-detection/training/model1:

~~~powershell
powershell -ExecutionPolicy Bypass -File scripts/run_m1_rebuild.ps1 -Full -MaxHours 10
~~~

The script audits, prepares, smoke-tests, starts the report-only supervisor for
the available GPU window, evaluates, exports, and verifies. The supervisor
keeps the computer awake only while its own child run is active, allows at
most two bounded recovery attempts, and writes compact status to
logs/rebuild/<run-id>/watcher_status.json.

The default run ID is m1rebuild_YYYYMMDD_seed42_yolo11s. Existing generated
datasets and candidate directories are never overwritten. Use a new run ID
for a fresh attempt.

## Individual stages

~~~powershell
$RunId = "m1rebuild_20260907_seed42_yolo11s_v4"
.\.venv\Scripts\python.exe scripts/m1_rebuild.py audit --run-id $RunId
.\.venv\Scripts\python.exe scripts/m1_rebuild.py prepare --run-id $RunId --audit-run-id $RunId
.\.venv\Scripts\python.exe scripts/m1_rebuild.py smoke --run-id $RunId --batch 16
.\.venv\Scripts\python.exe scripts/m1_rebuild.py train --run-id $RunId
.\.venv\Scripts\python.exe scripts/m1_rebuild.py evaluate --run-id $RunId
.\.venv\Scripts\python.exe scripts/m1_rebuild.py export --run-id $RunId
.\.venv\Scripts\python.exe scripts/m1_rebuild.py verify --run-id $RunId
~~~

To continue a valid interrupted checkpoint explicitly:

~~~powershell
.\.venv\Scripts\python.exe scripts/m1_rebuild.py train --run-id $RunId --resume-from "D:\Code\Project\bki\GreenGuard26\Trash-detection\training\model1\runs\<run>\weights\last.pt"
~~~

The generated data manifest freezes image hashes, converted labels, groups,
splits, calibration/selection membership, and augmentation examples. Dynamic
augmentation creates no new independent source images; it is sampled during
training and records its seed and mode in the training path.

## What the audit admits

The target classes are exactly 0=metal_can and 1=pet_bottle. Model 1
dataset-1 numeric classes 3 and 4 are mapped to metal_can after checking its
source documentation and representative can images; numeric classes 0 to 2
remain excluded. Whole-object annotations are admitted from the reviewed Model 1 sources and the three
whole-bottle Model 2 collections. Part-only cap/label/ring rows, ambiguous
metal, food tins, missing labels, and unreviewed empty labels are not
reinterpreted as target or negative examples. Valid OBBs are converted to
enclosing HBBs. The five reviewed empty-machine frames are explicit negatives;
they are not evidence for a reliable operational false-positive rate by
themselves.

## Candidate files and status

After export, inspect:

~~~powershell
$Candidate = "m1rebuild_20260907_seed42_yolo11s_v4"
Get-Content -Raw "logs/rebuild/$Candidate/evaluation_report.json"
Get-Content -Raw "logs/rebuild/$Candidate/export_report.json"
Get-Content -Raw "logs/rebuild/$Candidate/verify_report.json"
Get-Content -Raw "export/candidates/$Candidate/candidate_manifest.json"
Get-FileHash "export/candidates/$Candidate/m1_rebuild_640.onnx" -Algorithm SHA256
Get-Content -Raw "..\..\pc-demo\config\m1_rebuild_$Candidate.json"
~~~

CAMERA_VALIDATION_REQUIRED means offline gates passed but the owner’s fresh
camera session is still required. FAILED_ACCEPTANCE means at least one
offline gate, export/parity check, or required evidence item failed. Both are
candidate-only states and leave the active baseline untouched.

## Candidate tests

Change to Trash-detection/pc-demo. Replace <run-id> below with the actual
run ID. The export stage creates the named candidate configuration; it keeps
the active Model 2 path and gate values from config/default.json.

Verify candidate hash and classes:

~~~powershell
$RunId = "<run-id>"
Get-FileHash ".\..\training\model1\export\candidates\$RunId\m1_rebuild_640.onnx" -Algorithm SHA256
Get-Content -Raw ".\..\training\model1\export\candidates\$RunId\candidate_manifest.json"
Get-Content ".\..\training\model1\export\candidates\$RunId\labels.txt"
~~~

Run the candidate on one saved image:

~~~powershell
.\.venv\Scripts\python.exe src\app.py --config "m1_rebuild_$RunId" --mode model1 --source "D:\path\to\saved-image.jpg" --headless --auto-start --save ".\validation\candidate-saved-image" --max-frames 1
~~~

Run the candidate on the real camera:

~~~powershell
.\.venv\Scripts\python.exe src\app.py --config "m1_rebuild_$RunId" --mode model1 --source 0 --auto-start --m1-conf 0.001
~~~

Run the complete candidate M1 plus unchanged M2 workflow:

~~~powershell
.\.venv\Scripts\python.exe src\app.py --config "m1_rebuild_$RunId" --mode full --source 0 --auto-start
~~~

Compare baseline and candidate on the same recorded clip. Run the same source
with identical frame limits and save directories; inspect detections and
decision traces side by side:

~~~powershell
.\.venv\Scripts\python.exe src\app.py --config default --mode full --source "D:\path\to\recorded-clip.mp4" --headless --auto-start --save ".\validation\baseline-clip" --max-frames 300
.\.venv\Scripts\python.exe src\app.py --config "m1_rebuild_$RunId" --mode full --source "D:\path\to\recorded-clip.mp4" --headless --auto-start --save ".\validation\candidate-clip" --max-frames 300
~~~

Return to the baseline at any time by selecting --config default; do not
edit or replace the active model for this comparison:

~~~powershell
.\.venv\Scripts\python.exe src\app.py --config default --mode full --source 0 --auto-start
~~~

## Owner camera acceptance session

Use distinct physical items and fresh capture sessions: at least ten beverage
cans and ten PET bottles, each tested in normal, bright, and dim lighting.
Include intact and crushed cans, transparent PET, caps and labels present and
absent, remaining contents, partial insertion, reflective surfaces, hands,
empty-machine periods, PP cups, and unrelated machinery. This session must not
be used for training or calibration.

Record for every item and lighting condition: predicted class, confidence,
abstention, wrong-class result, decision latency, repeated signals, whether a
result was emitted once, and whether eight clear observations were required
before the next item. A successful session permits a later activation decision;
it does not prove visually indeterminate darkness or saturation is solved.
