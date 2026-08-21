# Run current Model 2 by itself (no Model 1).
# Usage from Model2/:
#   .\run.ps1
#   .\run.ps1 -Source 0 -Conf 0.5
#   .\run.ps1 -Source data\dataset-2\test\images

param(
    [string]$Source = "0",
    [double]$Conf = 0.5,
    [string]$Model = "models\best.pt"
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
Write-Host "Running Model 2 only  source=$Source  conf=$Conf" -ForegroundColor Cyan

& $python "src\run_model2.py" --source "$Source" --conf "$Conf" --model "$Model"
exit $LASTEXITCODE
