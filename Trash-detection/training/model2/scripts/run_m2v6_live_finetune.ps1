param(
    [switch]$PreflightOnly,
    [switch]$Smoke,
    [switch]$Resume,
    [switch]$NoPromote,
    [string]$RunName = "m2v6_liveft_20260828_seed42_n640_e50",
    [string]$Config = "config\m2v6_live_finetune.yaml"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: venv python not found at $py" -ForegroundColor Red
    exit 1
}

$effectiveRunName = if ($Smoke) { "${RunName}_smoke" } else { $RunName }
$logsRoot = & $py -c "from pathlib import Path; import sys; sys.path.insert(0, str(Path(r'$PWD') / 'scripts')); from live_finetune_common import load_config; cfg=load_config(r'$Config', r'$effectiveRunName'); print(cfg['_resolved']['paths']['logs_root'])"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$logsRoot = $logsRoot.Trim()
New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
$statusPath = Join-Path $logsRoot "workflow_status.json"
$historyPath = Join-Path $logsRoot "workflow_status_history.jsonl"
$workflowLogPath = Join-Path $logsRoot "workflow.log"
$watcherLogPath = Join-Path $logsRoot "watcher.log"
foreach ($path in @($historyPath, $workflowLogPath, $watcherLogPath)) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Force
    }
}

$status = @{
    run_name = $effectiveRunName
    status = "STARTING"
    updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    step = "workflow"
    smoke = [bool]$Smoke
    promote_requested = [bool](-not $NoPromote -and -not $Smoke)
}
$statusJson = $status | ConvertTo-Json
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($statusPath, $statusJson, $utf8NoBom)

if (-not $PreflightOnly) {
    $watchScript = Join-Path $PSScriptRoot "watch_m2v6_live_finetune.ps1"
    $watchArgs = @(
        "-ExecutionPolicy", "Bypass",
        "-File", $watchScript,
        "-Config", $Config,
        "-RunName", $effectiveRunName
    )
    if ($Smoke) { $watchArgs += "-Smoke" }
    Start-Process powershell -WindowStyle Hidden -ArgumentList $watchArgs | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "== [1/4] Prepare live-machine fine-tune dataset ==" -ForegroundColor Cyan
$prepArgs = @("scripts\prepare_live_finetune.py", "--config", $Config, "--run", $effectiveRunName)
if ($PreflightOnly) { $prepArgs += "--preflight-only" }
& $py @prepArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($PreflightOnly) {
    Write-Host "Preflight-only preparation completed." -ForegroundColor Green
    exit 0
}

Write-Host "== [2/4] Train candidate ==" -ForegroundColor Cyan
$trainArgs = @("scripts\train_m2v6_live_finetune.py", "--config", $Config, "--run", $effectiveRunName)
if ($Resume) { $trainArgs += "--resume" }
if ($Smoke) { $trainArgs += "--smoke" }
& $py @trainArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Smoke) {
    Write-Host "Smoke run completed." -ForegroundColor Green
    exit 0
}

Write-Host "== [3/4] Evaluate candidate ==" -ForegroundColor Cyan
& $py scripts\evaluate_m2v6_live_finetune.py --config $Config --run $effectiveRunName
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $NoPromote) {
    Write-Host "== [4/4] Export, validate, and promote candidate if all gates pass ==" -ForegroundColor Cyan
    & $py scripts\promote_m2_candidate.py --config $Config --run $effectiveRunName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "== [4/4] Promotion skipped (-NoPromote was supplied) ==" -ForegroundColor Yellow
}

Write-Host "Workflow complete. Reports are under $logsRoot" -ForegroundColor Green
