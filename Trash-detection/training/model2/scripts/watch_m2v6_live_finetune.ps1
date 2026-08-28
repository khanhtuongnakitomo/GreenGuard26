param(
    [string]$Config = "config\m2v6_live_finetune.yaml",
    [string]$RunName = "m2v6_liveft_20260828_seed42_n640_e50",
    [switch]$Smoke,
    [int]$PollSeconds = 15,
    [int]$StallMinutes = 10,
    [int]$HangMinutes = 20,
    [switch]$KillOnHang
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: venv python not found at $py" -ForegroundColor Red
    exit 1
}

$logsRoot = & $py -c "from pathlib import Path; import sys; sys.path.insert(0, str(Path(r'$PWD') / 'scripts')); from live_finetune_common import load_config; cfg=load_config(r'$Config', r'$RunName'); print(cfg['_resolved']['paths']['logs_root'])"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$logsRoot = $logsRoot.Trim()
$statusPath = Join-Path $logsRoot "workflow_status.json"
$watchLog = Join-Path $logsRoot "watcher.log"
$resultsCsv = Join-Path (Join-Path $PWD "runs") (Join-Path $RunName "results.csv")

function Write-WatchLog {
    param([string]$Message)
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $line = "[$stamp] $Message"
    Add-Content -LiteralPath $watchLog -Value $line
}

function Get-StatusPayload {
    if (-not (Test-Path $statusPath)) { return $null }
    try {
        return Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-RowCount {
    if (-not (Test-Path $resultsCsv)) { return 0 }
    try {
        $rows = Import-Csv -LiteralPath $resultsCsv
        return @($rows).Count
    } catch {
        return 0
    }
}

function Get-ResultsWriteTime {
    if (-not (Test-Path $resultsCsv)) { return [datetime]::MinValue }
    try { return (Get-Item -LiteralPath $resultsCsv).LastWriteTimeUtc } catch { return [datetime]::MinValue }
}

function Test-PidAlive {
    param([int]$TargetPid)
    if ($TargetPid -le 0) { return $false }
    try {
        return [bool](Get-Process -Id $TargetPid -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Emit-State {
    param([string]$State, [string]$Detail)
    Write-WatchLog "$State :: $Detail"
}

$lastRowCount = 0
$lastResultsWriteTime = Get-ResultsWriteTime
$lastProgress = Get-Date
$stopSeen = 0
Emit-State "STARTING" "watcher attached for run $RunName"

while ($true) {
    $payload = Get-StatusPayload
    $rowCount = Get-RowCount
    $resultsWriteTime = Get-ResultsWriteTime
    if (($rowCount -gt $lastRowCount) -or ($resultsWriteTime -gt $lastResultsWriteTime)) {
        $lastRowCount = $rowCount
        $lastResultsWriteTime = $resultsWriteTime
        $lastProgress = Get-Date
    }
    $minsSince = ((Get-Date) - $lastProgress).TotalMinutes
    $status = if ($payload) { [string]$payload.status } else { "STARTING" }
    $step = if ($payload) { [string]$payload.step } else { "workflow" }
    $trainerPid = if ($payload -and $payload.PSObject.Properties.Name -contains "trainer_pid") { [int]$payload.trainer_pid } else { -1 }
    $alive = Test-PidAlive $trainerPid

    switch ($status) {
        "RUNNING" {
            if ($minsSince -ge $HangMinutes) {
                Emit-State "HUNG" "no new epoch for $([math]::Round($minsSince, 1)) minutes; pid=$trainerPid alive=$alive"
                if ($KillOnHang -and $alive) {
                    Stop-Process -Id $trainerPid -Force
                    Emit-State "STOPPED" "killed trainer pid $trainerPid after hang threshold"
                    exit 3
                }
            } elseif ($minsSince -ge $StallMinutes) {
                Emit-State "STALLED" "no new epoch for $([math]::Round($minsSince, 1)) minutes; pid=$trainerPid alive=$alive"
            } else {
                Emit-State "RUNNING" "epoch rows=$rowCount step=$step pid=$trainerPid alive=$alive"
            }
            if (($trainerPid -gt 0) -and (-not $alive) -and ($minsSince -gt 1)) {
                Emit-State "CRASHED" "trainer pid $trainerPid disappeared while workflow status was RUNNING"
                exit 2
            }
        }
        "EXPORTING" { Emit-State "EXPORTING" "exporting candidate ONNX files" }
        "VALIDATING" { Emit-State "VALIDATING" "step=$step rows=$rowCount" }
        "PROMOTING" { Emit-State "PROMOTING" "replacing active Model 2 artifacts" }
        "EARLY_STOPPED" { Emit-State "EARLY_STOPPED" "training ended before target epochs" }
        "TIME_LIMITED" { Emit-State "TIME_LIMITED" "training reached configured wall-clock cap" }
        "ROLLED_BACK" {
            Emit-State "ROLLED_BACK" "promotion rollback triggered"
            exit 4
        }
        "COMPLETED" {
            Emit-State "COMPLETED" "workflow finished successfully"
            exit 0
        }
        "CRASHED" {
            Emit-State "CRASHED" "workflow reported a failure in step $step"
            exit 2
        }
        "STOPPED" {
            Emit-State "STOPPED" "step=$step rows=$rowCount"
            $stopSeen += 1
            if ($stopSeen -ge 2) {
                exit 0
            }
        }
        default {
            Emit-State $status "step=$step"
        }
    }

    Start-Sleep -Seconds $PollSeconds
}
