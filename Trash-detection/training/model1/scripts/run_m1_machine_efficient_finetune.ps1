[CmdletBinding()]
param(
    [string]$RunId = "m1efficientft_20260909_seed42_r1",
    [double]$WallMinutes = 480,
    [double]$TargetMinutes = 420,
    [switch]$PackageCandidate,
    [switch]$Publish
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$modelRoot = Join-Path $repoRoot "Trash-detection\training\model1"
$python = Join-Path $repoRoot "Trash-detection\pc-demo\.venv\Scripts\python.exe"
$runner = Join-Path $modelRoot "scripts\m1_machine_quick_finetune.py"
$config = Join-Path $modelRoot "config\m1_machine_efficient_finetune.yaml"

if (-not (Test-Path -LiteralPath $python)) { throw "PC runtime Python is missing: $python" }
if (-not (Test-Path -LiteralPath $runner)) { throw "Training runner is missing: $runner" }
if (-not (Test-Path -LiteralPath $config)) { throw "Efficient configuration is missing: $config" }
if ($WallMinutes -le 0 -or $TargetMinutes -le 0 -or $TargetMinutes -gt $WallMinutes) { throw "TargetMinutes must be positive and no greater than WallMinutes" }

if (-not ("GreenGuard.ExecutionState" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace GreenGuard {
  public static class ExecutionState {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint flags);
  }
}
"@
}
[GreenGuard.ExecutionState]::SetThreadExecutionState([uint32]0x80000003) | Out-Null
try {
    Set-Location -LiteralPath $repoRoot
    Write-Host "Starting Model 1 efficient challenger run $RunId"
    Write-Host "Target: $TargetMinutes minutes; hard limit: $WallMinutes minutes"
    & $python $runner full --config $config --run-id $RunId --wall-minutes $WallMinutes --publish
    $trainingExit = $LASTEXITCODE

    $reportRoot = Join-Path $modelRoot "logs\rebuild\$RunId"
    $null = New-Item -ItemType Directory -Force -Path $reportRoot
    $exportReport = Join-Path $reportRoot "export_report.json"
    $publishExit = 0
    if ($PackageCandidate -and (Test-Path -LiteralPath $exportReport)) {
        $publisher = Join-Path $modelRoot "scripts\publish_m1_candidate.py"
        & $python $publisher --run-id $RunId --report-root $reportRoot
        if ($LASTEXITCODE -ne 0) { throw "Candidate packaging failed" }
        if ($Publish) {
            $publisherPs = Join-Path $modelRoot "scripts\publish_m1_machine_efficient_run.ps1"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $publisherPs -RunId $RunId -ReportRoot $reportRoot
            $publishExit = $LASTEXITCODE
        }
    }

    $summary = [ordered]@{
        schema = "greenguard-m1-efficient-run-v1"
        run_id = $RunId
        wall_minutes = $WallMinutes
        target_minutes = $TargetMinutes
        training_exit_code = $trainingExit
        publish_exit_code = $publishExit
        package_candidate = [bool]$PackageCandidate
        publish_requested = [bool]$Publish
        report_root = $reportRoot
        finished_at = [DateTime]::UtcNow.ToString("o")
    }
    $summaryPath = Join-Path $reportRoot "efficient_run_summary.json"
    $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
    $finalExit = if ($trainingExit -ne 0) { $trainingExit } else { $publishExit }
    exit $finalExit
} finally {
    [GreenGuard.ExecutionState]::SetThreadExecutionState([uint32]0x80000000) | Out-Null
}
