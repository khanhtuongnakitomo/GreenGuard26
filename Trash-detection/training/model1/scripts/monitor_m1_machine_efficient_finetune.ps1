[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$RunId,
    [int]$StaleMinutes = 20
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$runRoot = Join-Path $repoRoot "Trash-detection\training\model1\logs\rebuild\$RunId"
if (-not (Test-Path -LiteralPath $runRoot)) { exit 0 }

$heartbeatPath = Join-Path $runRoot "heartbeat.json"
$orchestrationPath = Join-Path $runRoot "orchestration_report.json"
$now = [DateTimeOffset]::UtcNow
$heartbeat = $null
$heartbeatAge = $null
if (Test-Path -LiteralPath $heartbeatPath) {
    try {
        $heartbeat = Get-Content -LiteralPath $heartbeatPath -Raw | ConvertFrom-Json
        $heartbeatAge = ($now - [DateTimeOffset]::Parse($heartbeat.updated_at)).TotalMinutes
    } catch {
        $heartbeatAge = $null
    }
}

$pidValue = if ($heartbeat) { [int]$heartbeat.pid } else { 0 }
$processAlive = $false
if ($pidValue -gt 0) {
    $processAlive = $null -ne (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)
}

$gpu = $null
$nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidia) {
    try {
        $gpu = (& $nvidia.Source --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>$null | Out-String).Trim()
    } catch {
        $gpu = $null
    }
}

$status = "UNKNOWN"
if (Test-Path -LiteralPath $orchestrationPath) {
    try {
        $orchestration = Get-Content -LiteralPath $orchestrationPath -Raw | ConvertFrom-Json
        $status = [string]$orchestration.status
    } catch {
        $status = "REPORT_UNREADABLE"
    }
} elseif ($heartbeat -and $heartbeatAge -le $StaleMinutes) {
    $status = if ($processAlive) { "RUNNING" } else { "CHECKPOINT_ACTIVITY" }
} elseif ($heartbeat) {
    $status = "STALE"
}

$payload = [ordered]@{
    schema = "greenguard-m1-efficient-monitor-v1"
    run_id = $RunId
    checked_at = $now.ToString("o")
    status = $status
    heartbeat_age_minutes = $heartbeatAge
    process_id = $pidValue
    process_alive = $processAlive
    stage = if ($heartbeat) { $heartbeat.stage } else { $null }
    epoch = if ($heartbeat) { $heartbeat.epoch } else { $null }
    batch = if ($heartbeat) { $heartbeat.batch } else { $null }
    gpu = $gpu
}
$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $runRoot "scheduled_status.json") -Encoding UTF8
if ($status -in @("STALE", "FAILED", "TIME_BUDGET_EXPIRED")) {
    Write-Warning ("Model 1 run $RunId status: $status")
}
