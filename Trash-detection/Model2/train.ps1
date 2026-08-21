# Train GreenGuard Model 2 (YOLO11n-OBB: cap + label + liquid).
# Run from Model2/ in a normal PowerShell window. Do not run this from the Cursor agent.
#
# Usage:
#   .\train.ps1
#   .\train.ps1 -Dataset dataset-3
#   .\train.ps1 -Dataset data\dataset-3 -Epochs 50 -Batch 8 -Device 0
#
# Base model MUST be OBB, default yolo11n-obb.pt — NOT yolo26n.pt (detect only).

param(
    [string]$Dataset = "data\dataset-3",
    [int]$Epochs = 50,
    [int]$Batch = 16,
    [int]$Imgsz = 640,
    [string]$Device = "0",
    [string]$Model = "yolo11n-obb.pt",
    [string]$Name = "cap_label_liquid_v1",
    [switch]$Resume
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Model -match "yolo26") {
    Write-Host "Model 2 needs YOLO11 OBB weights, not yolo26 detect." -ForegroundColor Red
    Write-Host "Use the default: .\train.ps1 -Dataset dataset-3" -ForegroundColor Yellow
    Write-Host "Or: .\train.ps1 -Model yolo11n-obb.pt -Dataset dataset-3" -ForegroundColor Yellow
    exit 1
}
if ($Model -notmatch "-obb") {
    Write-Host "Model must be an OBB checkpoint (e.g. yolo11n-obb.pt), got: $Model" -ForegroundColor Red
    exit 1
}

$candidates = @(
    Join-Path $PSScriptRoot "..\Model1\.venv\Scripts\python.exe"
    Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
)
$python = $null
foreach ($path in $candidates) {
    if (Test-Path $path) {
        $python = $path
        break
    }
}
if (-not $python) {
    $python = "python"
}

Write-Host "Python: $python" -ForegroundColor Cyan
Write-Host "Training Model 2 OBB" -ForegroundColor Cyan
Write-Host "  dataset=$Dataset" -ForegroundColor Cyan
Write-Host "  model=$Model  (YOLO11 OBB, not yolo26 detect)" -ForegroundColor Cyan
Write-Host "  epochs=$Epochs batch=$Batch imgsz=$Imgsz device=$Device" -ForegroundColor Cyan

$trainArgs = @(
    "src\train.py",
    "--dataset", "$Dataset",
    "--model", "$Model",
    "--name", "$Name",
    "--epochs", "$Epochs",
    "--batch", "$Batch",
    "--imgsz", "$Imgsz",
    "--device", "$Device"
)
if ($Resume) {
    $trainArgs += "--resume"
}

& $python @trainArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Training failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nTraining finished. Weights should be at models\best.pt" -ForegroundColor Green
Write-Host "Preview: $python src\run_model2.py --source data\dataset-3\test\images --conf 0.5"
Write-Host "Live:    cd ..\Model1; python src\test_webcam.py"
