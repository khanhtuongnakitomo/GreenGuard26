# GreenGuard Model 2 — ONE-COMMAND build (data pipeline + fast train + eval).
# Prereq: ring dataset already unzipped at  dataset\incoming\ring-dataset\
#         (Roboflow export, YOLOv8-OBB format, with train/valid/test).
# Uses the model1-rebuild venv (GPU machine). Expected: ~40-60 min total.
#
# HOW TO RUN (PowerShell, from model2-rebuild\):
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_training.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = "..\model1-rebuild\.venv\Scripts\python.exe"

Write-Host "== [1/5] Normalize (cap/label + ring -> 3 classes) ==" -ForegroundColor Cyan
& $py scripts\normalize_labels.py 2>&1 | Tee-Object -FilePath logs\m2_normalize.log

Write-Host "== [2/5] Dedupe (pHash <= 8) ==" -ForegroundColor Cyan
& $py scripts\dedupe.py 8 2>&1 | Tee-Object -FilePath logs\m2_dedupe.log

Write-Host "== [3/5] Split 70/20/10 grouped + dataset.yaml ==" -ForegroundColor Cyan
& $py scripts\split_dataset.py 2>&1 | Tee-Object -FilePath logs\m2_split.log

Write-Host "== [4/5] Train (50 epochs, patience 15, cosine LR) ==" -ForegroundColor Cyan
Write-Host "Opening the live monitor window (loss + mAP per epoch)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-Command","cd '$PSScriptRoot\..'; & '..\model1-rebuild\.venv\Scripts\python.exe' scripts\live_monitor.py"
Start-Sleep -Seconds 2
& $py scripts\train.py --seed 42 2>&1 | Tee-Object -FilePath logs\m2_train.log

Write-Host "== [5/5] Eval on val (targets cap/label/ring >= 0.80) ==" -ForegroundColor Cyan
& $py scripts\eval_val.py 2>&1 | Tee-Object -FilePath logs\m2_eval.log

Write-Host ""
Write-Host "DONE -> runs\m2_seed42_n640\weights\best.pt" -ForegroundColor Green
Write-Host "Tell the agent 'model2 xong' to export ONNX + wire the gating demo." -ForegroundColor Yellow
