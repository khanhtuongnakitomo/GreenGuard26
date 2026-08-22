# GreenGuard Model 1 rebuild - full Phase G training (user-run)
# Runs BOTH seeds (42, 7) with the kit config, then the val evaluation + seed-gap.
# Expected duration on RTX 3060: roughly 2-3 h per seed (~4-6 h total).
#
# HOW TO RUN (PowerShell):
#   cd D:\Code\Project\bki\Detection-rebuild\model1-rebuild
#   powershell -ExecutionPolicy Bypass -File scripts\run_training.ps1
#
# Everything is logged to logs\train_seed*.log. You can close this window only
# when both seeds and the eval are done; use logs to follow progress.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = ".\.venv\Scripts\python.exe"

Write-Host "== [1/3] Training seed 42 (150 epochs, imgsz 640) ==" -ForegroundColor Cyan
& $py scripts\train.py --seed 42 2>&1 | Tee-Object -FilePath logs\train_seed42.log

Write-Host "== [2/3] Training seed 7 (150 epochs, imgsz 640) ==" -ForegroundColor Cyan
& $py scripts\train.py --seed 7 2>&1 | Tee-Object -FilePath logs\train_seed7.log

Write-Host "== [3/3] Validation eval + seed-stability (gate G3 inputs) ==" -ForegroundColor Cyan
& $py scripts\eval_val.py 2>&1 | Tee-Object -FilePath logs\eval_val.log

Write-Host ""
Write-Host "DONE. Results: runs\seed42_n640\results.csv, runs\seed7_n640\results.csv" -ForegroundColor Green
Write-Host "When finished, tell the build agent: 'train xong' to continue with Phase H (export)." -ForegroundColor Yellow
