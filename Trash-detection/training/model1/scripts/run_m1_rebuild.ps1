param(
    [string]$RunId = "",
    [switch]$Audit,
    [switch]$Prepare,
    [switch]$Smoke,
    [switch]$Train,
    [switch]$Evaluate,
    [switch]$Export,
    [switch]$Verify,
    [switch]$Full,
    [double]$MaxHours = 10
)

$ErrorActionPreference = "Stop"
$ModelRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $ModelRoot ".venv\Scripts\python.exe"
$Script = Join-Path $ModelRoot "scripts\m1_rebuild.py"
if (-not (Test-Path $Python)) { $Python = "python" }
$IdArgs = @()
if ($RunId) { $IdArgs = @("--run-id", $RunId) }

function Invoke-Stage([string]$Stage) {
    & $Python $Script $Stage @IdArgs
    if ($LASTEXITCODE -ne 0) { throw "Model 1 rebuild stage '$Stage' failed with exit code $LASTEXITCODE" }
}

if ($Full) {
    Invoke-Stage "audit"
    Invoke-Stage "prepare"
    Invoke-Stage "smoke"
    $resolved = if ($RunId) { $RunId } else { "m1rebuild_$(Get-Date -Format yyyyMMdd)_seed42_yolo11s" }
    $trainingHours = [Math]::Max(1, $MaxHours - 4)
    & $Python (Join-Path $ModelRoot "scripts\watch_m1_rebuild.py") --run-id $resolved --max-hours $trainingHours
    $watchExit = $LASTEXITCODE
    $postFailure = $watchExit -ne 0
    if ($watchExit -ne 0) {
        Write-Warning "Training supervisor ended with exit code $watchExit; preserving evidence and continuing post-training stages."
    }
    $trainReportPath = Join-Path $ModelRoot "logs\rebuild\$resolved\train_report.json"
    $hasCheckpoint = $false
    if (Test-Path $trainReportPath) {
        try {
            $trainReport = Get-Content -Raw $trainReportPath | ConvertFrom-Json
            $hasCheckpoint = [bool]($trainReport.best_checkpoint -and (Test-Path $trainReport.best_checkpoint))
        } catch {
            Write-Warning "Could not parse the training report: $($_.Exception.Message)"
        }
    }
    if (-not $hasCheckpoint) {
        Write-Warning "No valid checkpoint was produced; export and evaluation are unavailable. The training report is the failure evidence."
        exit 2
    }
    foreach ($stage in @("evaluate", "export", "verify")) {
        & $Python $Script $stage @("--run-id", $resolved)
        if ($LASTEXITCODE -ne 0) {
            $postFailure = $true
            Write-Warning "Post-training stage '$stage' failed with exit code $LASTEXITCODE; continuing to preserve later evidence."
        }
    }
    if ($postFailure) { exit 2 }
    exit 0
}

if ($Audit) { Invoke-Stage "audit" }
if ($Prepare) { Invoke-Stage "prepare" }
if ($Smoke) { Invoke-Stage "smoke" }
if ($Train) { Invoke-Stage "train" }
if ($Evaluate) { Invoke-Stage "evaluate" }
if ($Export) { Invoke-Stage "export" }
if ($Verify) { Invoke-Stage "verify" }
