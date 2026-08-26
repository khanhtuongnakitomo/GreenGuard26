# GreenGuard Model 2 v5 — ONE-COMMAND build: augment -> normalize -> dedupe
#   -> split -> train (YOLO11s-OBB all-angle/all-light) -> eval -> export -> package.
#
# Fixes m2v4's two measured failures:
#   * dark / bright lighting   (offline gamma/exposure/CLAHE + in-train hsv_v=0.5)
#   * tilted / off-center      (degrees=180, perspective, translate, scale, flips)
#
# HOW TO RUN (PowerShell, from training\model2\):
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v5_training.ps1            # full pipeline + fine-tune
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v5_training.ps1 -Smoke     # 5-min sanity (no eval/export)
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v5_training.ps1 -Full      # from yolo11s-obb.pt scratch
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v5_training.ps1 -SkipAugment
#
# After it finishes, demo with:  .\run_m2_demo.bat   (Model 2 only)
#                                .\run_gate_demo.bat  (full M1 -> M2 gate)
# Uses the model1 venv (GPU machine). Full train ~1.5-2.5h on RTX 3060.

param(
    [switch]$Smoke,
    [switch]$Full,
    [switch]$SkipAugment,
    [switch]$SkipPackage,
    [string]$RunName = "m2v5_allangle_seed42_n768"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: venv python not found at $py" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path logs | Out-Null

if (-not $SkipAugment) {
    Write-Host "== [0/7] Augment (lighting + pose, OBB-aware, deterministic) ==" -ForegroundColor Cyan
    & $py scripts\augment_m2.py 2>&1 | Tee-Object -FilePath logs\m2_augment.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "== [1/7] Normalize (cap/label/ring + hard negatives) ==" -ForegroundColor Cyan
& $py scripts\normalize_labels.py 2>&1 | Tee-Object -FilePath logs\m2_normalize.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [2/7] Dedupe (exact cross-source dupes only; keep _aug siblings) ==" -ForegroundColor Cyan
& $py scripts\dedupe.py 8 2>&1 | Tee-Object -FilePath logs\m2_dedupe.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [3/7] Split (grouped, locked-test aware, ring reserved) ==" -ForegroundColor Cyan
& $py scripts\split_dataset.py 2>&1 | Tee-Object -FilePath logs\m2_split.log
$splitCode = $LASTEXITCODE
if ($splitCode -eq 1) {
    Write-Host "ERROR: split leakage FAIL - see logs\m2_split.log" -ForegroundColor Red
    exit 1
}
if ($splitCode -eq 2) {
    Write-Host "DATA_GAP (e.g. ring scarce) - continuing; ring class stays in schema." -ForegroundColor Yellow
}

if ($Smoke) {
    Write-Host "== [4/7] SMOKE train (1 epoch, imgsz 320, 5% data) ==" -ForegroundColor Cyan
    & $py scripts\train_m2_v5.py --smoke 2>&1 | Tee-Object -FilePath logs\m2_smoke.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "SMOKE OK -> runs\smoke_m2v5\weights\best.pt" -ForegroundColor Green
    Write-Host "Re-run WITHOUT -Smoke for the real train." -ForegroundColor Yellow
    exit 0
}

$modeArg = @()
if ($Full) { $modeArg += "--full" }
Write-Host "== [4/7] Train YOLO11s-OBB @768 (all-angle/all-light) -> $RunName ==" -ForegroundColor Cyan
Write-Host "Opening live monitor (loss + mAP per epoch)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-Command",
    "cd '$PWD'; & '$py' scripts\live_monitor.py"
Start-Sleep -Seconds 2
& $py scripts\train_m2_v5.py --name $RunName @modeArg 2>&1 | Tee-Object -FilePath logs\m2_train.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [5/7] Eval val @768 + deploy-size @640 ==" -ForegroundColor Cyan
& $py scripts\eval_val.py $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval.log
& $py scripts\eval_deploy_size.py $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval_deploy.log

Write-Host "== [6/7] Export ONNX (768 PC + 640/416 Orin) as CANDIDATE ==" -ForegroundColor Cyan
foreach ($sz in 768, 640, 416) {
    & $py scripts\export_onnx.py --run $RunName --imgsz $sz --candidate 2>&1 | Tee-Object -FilePath "logs\m2_export_$sz.log"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "Candidates in export\candidates\$RunName\ (not promoted to production yet)." -ForegroundColor Yellow

if (-not $SkipPackage) {
    Write-Host "== [7/7] Package into pc-demo + jetson-runtime ==" -ForegroundColor Cyan
    Write-Host "NOTE: packager reads export\onnx_640 + onnx_416. To deploy v5, first promote" -ForegroundColor Yellow
    Write-Host "      the candidate:  copy export\candidates\$RunName\onnx_640\* export\onnx_640\" -ForegroundColor Yellow
    Write-Host "      then re-run:    python ..\..\scripts\package_models.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "DONE -> runs\$RunName\weights\best.pt + ONNX candidates" -ForegroundColor Green
Write-Host "Demo now:  .\run_m2_demo.bat   or   .\run_gate_demo.bat" -ForegroundColor Cyan
