# Jetson Nano B01 device validation

Owner-run checklist. Engines and soak tests require the physical Nano.

## Environment

```bash
sudo nvpmodel -m 0          # MAXN
sudo jetson_clocks
cat /etc/nv_tegra_release   # expect R32.7.x
```

## Bundle self-containment

```bash
# From any temp directory after copying only jetson-runtime/
cd /tmp && rm -rf greenguard-test && cp -a ~/greenguard /tmp/greenguard-test
cd /tmp/greenguard-test
./setup.sh --check
python3 -m pytest tests -q
```

Confirm no imports escape this directory.

## Build and smoke

```bash
./build_engines.sh
trtexec --loadEngine=models/engines/m1_detector_416.engine
trtexec --loadEngine=models/engines/m1_classifier_224.engine
trtexec --loadEngine=models/engines/m2_obb_416.engine
./run.sh --backend tensorrt --source 0 --headless --max-frames 30
```

Record end-to-end FPS from the HUD after warmup. Target ≥ 5 FPS on worst-case PET
(M1 + classifier + M2). If below target, record stage timings instead of lowering
image size or thresholds.

## Live camera matrix

| Scenario | Expected |
|---|---|
| Aluminum can | Can label; M2 not run |
| Clean PET | PET ACCEPT after warmup/vote |
| PET + cap | PET REJECT |
| PET + label | PET REJECT |
| PET + ring | PET REJECT |
| Empty / random | No verdict |
| Pause | No inference |

## Parity vs PC baseline

Class IDs and gate verdicts must match `validation/contracts/baseline.json`.
Confidence / polygon tolerances: conf within documented range; polygon IoU ≥ 0.85
vs Ultralytics reference (explicit, not bit-exact).

## 30-minute soak

```bash
./run.sh --backend tensorrt --source 0 --save logs/soak
# run ≥ 30 minutes; watch tegrastats for memory growth / thermal throttle
```

Pass criteria: no crash, no thermal shutdown, no growing RSS, no stale-frame lag.

## Results log (fill on device)

| Metric | Value |
|---|---|
| Date / L4T / TRT | |
| E2E FPS (PET worst case) | |
| Peak RAM | |
| Peak temp / throttle? | |
| Soak OK? | |
| Notes | |
