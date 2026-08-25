# Model 1 Fix B - PET/can crop classifier (yolov8n-cls @224)
# One command: build crops -> train -> export ONNX
#
# HOW TO RUN (PowerShell):
#   cd D:\Code\Project\bki\Detection-rebuild\model1-rebuild
#   powershell -ExecutionPolicy Bypass -File scripts\run_classifier_training.ps1
#
# Smoke (about 2 min):
#   powershell -ExecutionPolicy Bypass -File scripts\run_classifier_training.ps1 -Smoke

param(
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = ".\.venv\Scripts\python.exe"

Write-Host "== [1/4] Build PET/can crops from OBB splits ==" -ForegroundColor Cyan
& $py scripts\make_crops.py 2>&1 | Tee-Object -FilePath logs\make_crops.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Smoke) {
    Write-Host "== [2/4] Smoke train (1 epoch, 5% data) ==" -ForegroundColor Cyan
    & $py scripts\train_cls.py --epochs 1 --fraction 0.05 --patience 1 --name smoke_cls `
        2>&1 | Tee-Object -FilePath logs\smoke_cls.log
    Write-Host "SMOKE DONE (skipped export)." -ForegroundColor Yellow
    exit 0
}

Write-Host "== [2/4] Train yolov8n-cls (60 epochs, imgsz 224) ==" -ForegroundColor Cyan
& $py scripts\train_cls.py --seed 42 2>&1 | Tee-Object -FilePath logs\train_cls_seed42.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [3/4] Export classifier ONNX @224 ==" -ForegroundColor Cyan
& $py scripts\export_classifier_onnx.py 2>&1 | Tee-Object -FilePath logs\export_cls_onnx.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [4/4] Quick val sanity (top-1 on val crops) ==" -ForegroundColor Cyan
& $py scripts\eval_cls_crops.py 2>&1 | Tee-Object -FilePath logs\eval_cls_crops.log

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "  weights: runs\cls_pet_can_seed42_n224\weights\best.pt"
Write-Host "  onnx:    export\cls_onnx_224\model.onnx"
Write-Host "  demo:    run_m1_demo.bat   (uses two-stage when classifier exists)"
