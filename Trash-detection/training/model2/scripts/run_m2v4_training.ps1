# GreenGuard Model 2 v4 — Cap/Label Retrain Pipeline
#
# HOW TO RUN (PowerShell, from training/model2):
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2v4_training.ps1 -Smoke -AllowNoRing
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2v4_training.ps1 -AllowNoRing

param(
    [switch]$Smoke,
    [switch]$AllowNoRing
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: venv python not found at $py" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path logs, dataset\test_locked | Out-Null

$candidate = if ($Smoke) { "smoke_m2v4" } else { "m2v4_caplabel_seed42_n640" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GreenGuard Model 2 v4 Pipeline ($candidate) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Preflight
Write-Host "`n== [1/7] Preflight ==" -ForegroundColor Cyan
& $py -c "import torch; print(f'PyTorch {torch.__version__}, CUDA available: {torch.cuda.is_available()}')"
if (-not (Test-Path "dataset\test_locked\images")) {
    Write-Host "WARNING: dataset\test_locked\images not found. Initializing lock from current test split..." -ForegroundColor Yellow
    & $py C:\Users\tuong\.gemini\antigravity-ide\brain\39f303f8-4503-42f0-b7ac-4a209f5b569e\scratch\lock_test_set.py
    Copy-Item -Path "dataset\splits\test" -Destination "dataset\test_locked" -Recurse -Force
}

# 2. Normalize
Write-Host "`n== [2/7] Normalize Labels ==" -ForegroundColor Cyan
& $py scripts\normalize_labels.py 2>&1 | Tee-Object -FilePath logs\m2_normalize.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 3. Dedupe
Write-Host "`n== [3/7] Dedupe (pHash <= 8) ==" -ForegroundColor Cyan
& $py scripts\dedupe.py 8 2>&1 | Tee-Object -FilePath logs\m2_dedupe.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. Split (with Test Set Lock)
Write-Host "`n== [4/7] Split (Leakage-Safe Grouped + Locked Test) ==" -ForegroundColor Cyan
& $py scripts\split_dataset.py 2>&1 | Tee-Object -FilePath logs\m2_split.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 5. Train / Fine-tune
Write-Host "`n== [5/7] Train / Fine-Tune Model 2 ==" -ForegroundColor Cyan
if ($Smoke) {
    Write-Host "Running SMOKE training (1 epoch, imgsz 320, 5% data)..." -ForegroundColor Yellow
    & $py scripts\train.py --name $candidate --epochs 1 --imgsz 320 --fraction 0.05 `
        --workers 0 --batch 8 --patience 1 --close-mosaic 0 --lr0 0.001 `
        2>&1 | Tee-Object -FilePath logs\m2_smoke.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "Running fine-tuning (80 epochs, imgsz 640, lr0 0.001, batch 24, patience 25)..." -ForegroundColor Yellow
    & $py scripts\train.py --name $candidate --epochs 80 --imgsz 640 --lr0 0.001 `
        --batch 24 --patience 25 2>&1 | Tee-Object -FilePath logs\m2_train.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# 6. Evaluation on Val Split & Locked Test Set
Write-Host "`n== [6/7] Evaluation & Benchmark Comparison ==" -ForegroundColor Cyan
& $py scripts\eval_val.py $candidate 2>&1 | Tee-Object -FilePath logs\m2_eval.log
& $py scripts\eval_deploy_size.py $candidate 2>&1 | Tee-Object -FilePath logs\m2_eval_416.log

Write-Host "`nComparing against baseline on LOCKED TEST SET..." -ForegroundColor Yellow
& $py scripts\eval_locked_test.py m2v3_seed42_n640 $candidate 2>&1 | Tee-Object -FilePath logs\m2_locked_comparison.log

# 7. Candidate ONNX Export
Write-Host "`n== [7/7] Candidate ONNX Export ==" -ForegroundColor Cyan
& $py scripts\export_onnx.py --run $candidate --imgsz 640 --candidate 2>&1 | Tee-Object -FilePath logs\m2_export_640.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $py scripts\export_onnx.py --run $candidate --imgsz 416 --candidate 2>&1 | Tee-Object -FilePath logs\m2_export_416.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Pipeline Finished Successfully for $candidate! " -ForegroundColor Green
Write-Host " Weights: runs\$candidate\weights\best.pt" -ForegroundColor Green
Write-Host " ONNX:    export\candidates\$candidate\onnx_640\ and onnx_416\" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
