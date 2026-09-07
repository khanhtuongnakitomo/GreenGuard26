param(
    [switch]$PreflightOnly,
    [switch]$Smoke,
    [switch]$Resume,
    [string]$Device = "0",
    [int]$Batch = 16
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $py)) { throw "Training environment not found: $py" }

$config = "config\m2_edge_finetune.yaml"
$run = "m2edgeft_20260830_seed42_n640_e30"
$logsRoot = Join-Path $PWD "logs\edge_finetune\$run"
$trainerLogRoot = Join-Path $logsRoot "trainer"
New-Item -ItemType Directory -Force -Path $trainerLogRoot | Out-Null

Write-Host "== Stage and validate edge dataset ==" -ForegroundColor Cyan
& $py scripts\stage_m2_edge_dataset.py --config $config --run $run --preflight-only
if ($LASTEXITCODE -ne 0) { throw "Edge dataset staging/preflight failed with exit code $LASTEXITCODE" }
if ($PreflightOnly) { Write-Host "Preflight complete. Training was not started." -ForegroundColor Green; exit 0 }

if ($Smoke) {
    Write-Host "== Smoke training ==" -ForegroundColor Cyan
    & $py scripts\train_m2_revamped.py --config $config --dataset-run $run --run "${run}_smoke" --device $Device --batch 8 --smoke
    if ($LASTEXITCODE -ne 0) { throw "Smoke training failed with exit code $LASTEXITCODE" }
    Write-Host "Smoke complete. Full training was not started." -ForegroundColor Green
    exit 0
}

$trainRun = $run
$trainLog = Join-Path $trainerLogRoot "$trainRun.stdout.log"
$trainErr = Join-Path $trainerLogRoot "$trainRun.stderr.log"
$pidFile = Join-Path $trainerLogRoot "$trainRun.pid"
$trainArgs = @(
    "scripts\train_m2_revamped.py", "--config", $config,
    "--dataset-run", $run, "--run", $trainRun,
    "--device", $Device, "--batch", $Batch,
    "--epochs", 30, "--patience", 8, "--lr0", 0.00005
)
if ($Resume) { $trainArgs += "--resume" }

Write-Host "== Start guarded PC-only fine-tune ==" -ForegroundColor Cyan
$trainer = Start-Process -FilePath $py -ArgumentList $trainArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $trainLog -RedirectStandardError $trainErr
Set-Content -LiteralPath $pidFile -Value $trainer.Id -Encoding ascii
$watchLog = Join-Path $trainerLogRoot "$trainRun.watcher.log"
$watchErr = Join-Path $trainerLogRoot "$trainRun.watcher.err.log"
$watcher = Start-Process -FilePath $py -ArgumentList @(
    "scripts\watch_training.py", "--name", $trainRun, "--epochs", 30,
    "--interval", 300, "--stall-min", 12, "--pid-file", $pidFile
) -PassThru -WindowStyle Hidden -RedirectStandardOutput $watchLog -RedirectStandardError $watchErr
Wait-Process -Id $trainer.Id
$trainer.Refresh()
$exitCode = $trainer.ExitCode
if ($null -eq $exitCode) {
    $exitCode = if (Test-Path -LiteralPath (Join-Path $logsRoot "reports\${trainRun}_train_report.json")) { 0 } else { 1 }
}
if (Get-Process -Id $watcher.Id -ErrorAction SilentlyContinue) { Stop-Process -Id $watcher.Id -ErrorAction SilentlyContinue }
if ($exitCode -ne 0) { throw "Training failed with exit code $exitCode. See $trainErr" }

Write-Host "== Evaluate edge, previous-machine, locked, negative, gate, and stress surfaces ==" -ForegroundColor Cyan
& $py scripts\evaluate_m2_edge_finetune.py --config $config --run $run --device $Device
if ($LASTEXITCODE -ne 0) { throw "Edge evaluation failed with exit code $LASTEXITCODE" }

Write-Host "== Export PC-only candidate and create webcam test configuration ==" -ForegroundColor Cyan
& $py scripts\export_m2_edge_finetune.py --config $config --run $run
if ($LASTEXITCODE -ne 0) { throw "PC candidate export failed with exit code $LASTEXITCODE" }

Write-Host "Complete. Active production files and Jetson/Orin files were not modified." -ForegroundColor Green
