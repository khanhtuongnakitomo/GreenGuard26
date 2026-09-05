param(
    [switch]$AuditOnly,
    [switch]$PrepareOnly,
    [switch]$Smoke,
    [switch]$Overnight,
    [double]$MaxHours = 8,
    [int]$Batch = 0,
    [switch]$KillOnHang
)

$ErrorActionPreference = 'Stop'
$ModelRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Python = Join-Path $ModelRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { throw "Model 1 virtual environment is missing: $Python" }
$Config = Join-Path $ModelRoot 'config\m1_rvm_finetune.yaml'
$RunId = & $Python -c "from pathlib import Path; import sys; sys.path.insert(0, str(Path(r'$PSScriptRoot'))); from m1_rvm_common import load_config, run_id; print(run_id(load_config(Path(r'$Config'))))"
if ($LASTEXITCODE -ne 0) { throw "Could not determine run id" }

function Invoke-Stage([string]$Script, [string[]]$Arguments) {
    & $Python (Join-Path $PSScriptRoot $Script) '--config' $Config '--run-id' $RunId @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Script stopped with exit code $LASTEXITCODE" }
}

Invoke-Stage 'audit_m1_rvm.py' @()
if ($AuditOnly) { exit 0 }

Invoke-Stage 'prepare_m1_rvm.py' @()
if ($PrepareOnly) { exit 0 }

if (-not ($Smoke -or $Overnight)) { throw 'Choose -AuditOnly, -PrepareOnly, -Smoke, or -Overnight.' }

$TrainArguments = if ($Smoke) { @('--smoke') } else { @() }
if ($Batch -gt 0) { $TrainArguments += @('--batch', [string]$Batch) }

if ($Overnight) {
    $Stdout = Join-Path $ModelRoot "logs\rvm\$RunId\train.stdout.log"
    $Stderr = Join-Path $ModelRoot "logs\rvm\$RunId\train.stderr.log"
    New-Item -ItemType Directory -Force -Path (Split-Path $Stdout) | Out-Null
    $Train = Start-Process -FilePath $Python -ArgumentList @((Join-Path $PSScriptRoot 'train_m1_rvm.py'), '--config', $Config, '--run-id', $RunId) + $TrainArguments -PassThru -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr
    $WatcherArguments = @((Join-Path $PSScriptRoot 'watch_m1_rvm.py'), '--config', $Config, '--run-id', $RunId, '--pid', [string]$Train.Id, '--max-hours', [string]$MaxHours)
    if ($KillOnHang) { $WatcherArguments += '--kill-on-hang' }
    & $Python @WatcherArguments
    if ($LASTEXITCODE -ne 0) { throw "watcher stopped with exit code $LASTEXITCODE" }
    $Train.Refresh()
    if (-not $Train.HasExited) { Write-Warning "Watcher time limit reached while training is still running; no automatic termination was requested." }
    exit 0
}

Invoke-Stage 'train_m1_rvm.py' $TrainArguments
Write-Host "TRAINING_COMPLETE run=$RunId"
