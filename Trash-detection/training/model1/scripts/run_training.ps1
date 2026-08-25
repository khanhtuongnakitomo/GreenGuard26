# GreenGuard Model 1 rebuild - refactor v2 training (user-run)
# Single fast run: 2 classes (bottle/aluminum), 80 epochs, patience 20, cos_lr.
# Expected duration on RTX 3060: roughly 60-80 minutes.
#
# HOW TO RUN (PowerShell):
#   cd <model1-rebuild folder>
#   powershell -ExecutionPolicy Bypass -File scripts\run_training.ps1
#
# GPU here is for TRAINING ONLY - the app itself always runs on CPU (demo_live).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = ".\.venv\Scripts\python.exe"

Write-Host "== [1/2] Training seed 42 (80 epochs, imgsz 640, 2 classes) ==" -ForegroundColor Cyan
& $py scripts\train.py --seed 42 2>&1 | Tee-Object -FilePath logs\train_v2_seed42.log

Write-Host "== [2/2] Validation eval (targets: bottle/aluminum >= 0.90) ==" -ForegroundColor Cyan
& $py scripts\eval_val.py 2>&1 | Tee-Object -FilePath logs\eval_val_v2.log

Write-Host ""
Write-Host "DONE. results: runs\seed42_n640\results.csv + curves in the same folder" -ForegroundColor Green
Write-Host "Tell the build agent 'train v2 xong' to continue (export ONNX + demo update)." -ForegroundColor Yellow
