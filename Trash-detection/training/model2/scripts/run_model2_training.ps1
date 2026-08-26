# GreenGuard Model 2 v3 - ONE-COMMAND build (data pipeline + 4h train + eval).
#
# Prereq for FULL train (ideal):
#   dataset/sources/owner-live/  with true ring OBB + your camera photos
#   (YOLOv8-OBB labels, classes 0=cap 1=label 2=ring).
#
# Cap/label-first is allowed: pass -AllowNoRing to train while ring==0
# (class 2 stays in the schema; retrain/finetune when ring data arrives).
#
# HOW TO RUN (PowerShell, from model2-rebuild\):
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -AllowNoRing
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1 -Smoke
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1
#
# Uses model1-rebuild venv (GPU machine). Full train ~3-3.5h on RTX 3060.

param(
    [switch]$Smoke,
    [switch]$AllowNoRing,
    [switch]$SkipAugment,
    [string]$RunName = "m2v4_ownerlive_seed42_n640",
    [ValidateSet("finetune", "full")]
    [string]$Mode = "finetune"
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
    Write-Host "== [0/6] Augment owner-live (offline OBB-aware, deterministic) ==" -ForegroundColor Cyan
    & $py scripts\augment_owner_live.py 2>&1 | Tee-Object -FilePath logs\m2_augment.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "== [1/6] Normalize (cap/label/ring harvest; skip mixed PET-cap-ring) ==" -ForegroundColor Cyan
& $py scripts\normalize_labels.py 2>&1 | Tee-Object -FilePath logs\m2_normalize.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [2/6] Dedupe (pHash <= 8; exact for studio sources) ==" -ForegroundColor Cyan
& $py scripts\dedupe.py 8 2>&1 | Tee-Object -FilePath logs\m2_dedupe.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [3/6] Split 70/20/10 grouped + dataset.yaml ==" -ForegroundColor Cyan
& $py scripts\split_dataset.py 2>&1 | Tee-Object -FilePath logs\m2_split.log
$splitCode = $LASTEXITCODE
if ($splitCode -eq 1) {
    Write-Host "ERROR: split integrity FAIL - see logs\m2_split.log" -ForegroundColor Red
    exit 1
}
if ($splitCode -eq 2) {
    if ($Smoke -or $AllowNoRing) {
        Write-Host "DATA_GAP ring=0 - continuing (cap/label-first). Class 2=ring kept in schema." -ForegroundColor Yellow
        Write-Host "Add true-ring later and retrain/finetune before Jetson ring demos." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "DATA_GAP: no ring class after split." -ForegroundColor Yellow
        Write-Host "Add true-ring under ..\dataset\sources\owner-live\  OR pass -AllowNoRing" -ForegroundColor Yellow
        Write-Host "for a cap/label-first train (ring class reserved, not learned yet)." -ForegroundColor Yellow
        exit 2
    }
}

if ($Smoke) {
    Write-Host "== [4/6] SMOKE train (1 epoch, imgsz 320, 5% data) ==" -ForegroundColor Cyan
    & $py scripts\train.py --seed 42 --epochs 1 --imgsz 320 --fraction 0.05 `
        --workers 0 --batch 8 --patience 1 --close-mosaic 0 --name smoke_m2v4 `
        2>&1 | Tee-Object -FilePath logs\m2_smoke.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "== [5/6] Skip full eval on smoke ==" -ForegroundColor Cyan
    Write-Host "SMOKE OK -> runs\smoke_m2v4\weights\best.pt" -ForegroundColor Green
    exit 0
}

if ($Mode -eq "finetune") {
    Write-Host "== [4/6] FINE-TUNE from m2v3 (80 ep, lr0 0.001, imgsz 640) ==" -ForegroundColor Cyan
    $trainArgs = @("--seed", "42", "--name", $RunName,
        "--weights", "runs\m2v3_seed42_n640\weights\best.pt",
        "--epochs", "80", "--patience", "25", "--lr0", "0.001")
}
else {
    Write-Host "== [4/6] FULL train (200 ep, patience 50, imgsz 640) ==" -ForegroundColor Cyan
    $trainArgs = @("--seed", "42", "--name", $RunName, "--epochs", "200", "--patience", "50")
}
Write-Host "Opening the live monitor window (loss + mAP per epoch)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-Command",
    "cd '$PWD'; & '$py' scripts\live_monitor.py"
Start-Sleep -Seconds 2
& $py scripts\train.py @trainArgs 2>&1 | Tee-Object -FilePath logs\m2_train.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [5/6] Eval val @640 + deploy-size @416 ==" -ForegroundColor Cyan
& $py scripts\eval_val.py $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval.log
& $py scripts\eval_deploy_size.py $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval_416.log

Write-Host "== [6/6] Export ONNX 640 + 416 from fresh weights (staleness guard) ==" -ForegroundColor Cyan
& $py scripts\export_onnx.py --weights "runs\$RunName\weights\best.pt" --imgsz 640 2>&1 | Tee-Object -FilePath logs\m2_export_640.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $py scripts\export_onnx.py --weights "runs\$RunName\weights\best.pt" --imgsz 416 2>&1 | Tee-Object -FilePath logs\m2_export_416.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "DONE -> runs\$RunName\weights\best.pt + fresh ONNX exports" -ForegroundColor Green
Write-Host "Next: package_models.py to push into pc-demo/ + jetson-runtime/." -ForegroundColor Yellow
