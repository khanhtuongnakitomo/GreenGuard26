param(
    [string]$RunId = "",
    [string]$Config = "",
    [switch]$Preflight,
    [switch]$AuditNew,
    [switch]$PrepareReplay,
    [switch]$Baseline,
    [switch]$Smoke,
    [switch]$FreezeHead,
    [switch]$FullFinetune,
    [switch]$Calibrate,
    [switch]$Evaluate,
    [switch]$Export,
    [switch]$Verify,
    [switch]$Activate,
    [switch]$Publish,
    [switch]$Full,
    [double]$WallMinutes = 90
)

$ErrorActionPreference = "Stop"
$ModelRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Python = Join-Path $ModelRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) { $Python = "python" }
$Script = Join-Path $ModelRoot "scripts\m1_machine_quick_finetune.py"

$Common = @()
if ($RunId) { $Common += @("--run-id", $RunId) }
if ($Config) { $Common += @("--config", $Config) }

function Invoke-QuickStage([string]$Stage, [string[]]$Extra = @()) {
    & $Python $Script $Stage @Common @Extra
    if ($LASTEXITCODE -ne 0) { throw "Model 1 quick fine-tune stage '$Stage' failed with exit code $LASTEXITCODE" }
}

if ($Full) {
    $Extra = @("--wall-minutes", [string]$WallMinutes)
    if ($Activate) { $Extra += "--activate" }
    if ($Publish) { $Extra += "--publish" }
    Invoke-QuickStage "full" $Extra
    exit 0
}

$Selected = $false
if ($Preflight) { Invoke-QuickStage "preflight"; $Selected = $true }
if ($AuditNew) { Invoke-QuickStage "audit-new"; $Selected = $true }
if ($PrepareReplay) { Invoke-QuickStage "prepare-replay"; $Selected = $true }
if ($Baseline) { Invoke-QuickStage "baseline"; $Selected = $true }
if ($Smoke) { Invoke-QuickStage "smoke" @("--wall-minutes", [string]$WallMinutes); $Selected = $true }
if ($FreezeHead) { Invoke-QuickStage "freeze-head" @("--wall-minutes", [string]$WallMinutes); $Selected = $true }
if ($FullFinetune) { Invoke-QuickStage "full-finetune" @("--wall-minutes", [string]$WallMinutes); $Selected = $true }
if ($Calibrate) { Invoke-QuickStage "calibrate"; $Selected = $true }
if ($Evaluate) { Invoke-QuickStage "evaluate"; $Selected = $true }
if ($Export) { Invoke-QuickStage "export"; $Selected = $true }
if ($Verify) { Invoke-QuickStage "verify"; $Selected = $true }
if ($Activate) { Invoke-QuickStage "activate"; $Selected = $true }
if ($Publish) { Invoke-QuickStage "publish"; $Selected = $true }

if (-not $Selected) {
    Write-Host "Use -Full for the bounded orchestration, or select an individual stage."
    Write-Host "Example: powershell -ExecutionPolicy Bypass -File .\scripts\run_m1_machine_quick_finetune.ps1 -RunId m1quickft_20260909_seed42_r1 -WallMinutes 90 -Full"
}
