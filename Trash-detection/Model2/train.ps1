# Train GreenGuard Model 2 (cap + label YOLO11n-OBB) on this PC.
# Run from Model2/ in a normal PowerShell window. Do not run this from the Cursor agent.
#
# Usage:
#   .\train.ps1
#   .\train.ps1 -Epochs 50 -Batch 8 -Device 0

param(
    [int]$Epochs = 50,
    [int]$Batch = 16,
    [int]$Imgsz = 640,
    [string]$Device = "0",
    [switch]$Resume
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

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
Write-Host "Training Model 2 OBB: epochs=$Epochs batch=$Batch imgsz=$Imgsz device=$Device" -ForegroundColor Cyan

$trainArgs = @(
    "src\train.py",
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
Write-Host "Preview: $python src\predict_folder.py --conf 0.5"
Write-Host "Live:    cd ..\Model1; python src\test_webcam.py"
