param(
    [string]$DatasetRun = "m2revamped_20260829_seed42_n640",
    [switch]$Smoke,
    [switch]$Resume,
    [switch]$ManualMachineAcceptance,
    [string]$AcceptanceReason = "Explicit fixed-camera machine-specific acceptance requested by the operator.",
    [string]$Device = "0",
    [int]$Batch = 24
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $py)) {
    throw "Training environment not found: $py"
}

$config = "config\m2_revamped.yaml"
$stageA = "${DatasetRun}_stage_a"
$stageB = "${DatasetRun}_stage_b"
$logsRoot = Join-Path $PWD "logs\revamped\$DatasetRun"
$runLogRoot = Join-Path $logsRoot "trainer"
New-Item -ItemType Directory -Force -Path $runLogRoot | Out-Null

Write-Host "== Prepare revamped dataset: $DatasetRun ==" -ForegroundColor Cyan
& $py scripts\prepare_live_finetune.py --config $config --run $DatasetRun
if ($LASTEXITCODE -ne 0) { throw "Dataset preparation failed with exit code $LASTEXITCODE" }

function Invoke-Stage {
    param(
        [string]$StageName,
        [string]$Weights = "",
        [int]$Epochs = 60,
        [int]$Patience = 12,
        [double]$LearningRate = 0.0002,
        [switch]$StageResume
    )
    $stageLog = Join-Path $runLogRoot "$StageName.stdout.log"
    $stageErr = Join-Path $runLogRoot "$StageName.stderr.log"
    $pidFile = Join-Path $runLogRoot "$StageName.pid"
    $args = @(
        "scripts\train_m2_revamped.py", "--config", $config,
        "--dataset-run", $DatasetRun, "--run", $StageName,
        "--device", $Device, "--batch", $Batch,
        "--epochs", $Epochs, "--patience", $Patience, "--lr0", $LearningRate
    )
    if ($Weights) { $args += @("--weights", $Weights) }
    if ($StageResume) { $args += "--resume" }

    $trainer = Start-Process -FilePath $py -ArgumentList $args -PassThru -WindowStyle Hidden -RedirectStandardOutput $stageLog -RedirectStandardError $stageErr
    Set-Content -LiteralPath $pidFile -Value $trainer.Id -Encoding ascii
    $watcherArgs = @(
        "scripts\watch_training.py", "--name", $StageName,
        "--epochs", $Epochs, "--interval", 300, "--stall-min", 12,
        "--pid-file", $pidFile
    )
    $watcherLog = Join-Path $runLogRoot "$StageName.watcher.log"
    $watcherErr = Join-Path $runLogRoot "$StageName.watcher.err.log"
    $watcher = Start-Process -FilePath $py -ArgumentList $watcherArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $watcherLog -RedirectStandardError $watcherErr
    Wait-Process -Id $trainer.Id
    $trainer.Refresh()
    $exitCode = $trainer.ExitCode
    if ($null -eq $exitCode) {
        # Start-Process can expose a null ExitCode after Wait-Process on some
        # PowerShell builds; the trainer report is written only after a
        # successful return and is therefore safer than a partial checkpoint.
        $trainReport = Join-Path $logsRoot "reports\${StageName}_train_report.json"
        $exitCode = if (Test-Path -LiteralPath $trainReport) { 0 } else { 1 }
    }
    if (Get-Process -Id $watcher.Id -ErrorAction SilentlyContinue) {
        Stop-Process -Id $watcher.Id -ErrorAction SilentlyContinue
    }
    if ($exitCode -ne 0) { throw "$StageName failed with exit code $exitCode. See $stageErr" }
}

if ($Smoke) {
    Write-Host "== Smoke training ==" -ForegroundColor Cyan
    & $py scripts\train_m2_revamped.py --config $config --dataset-run $DatasetRun --run "${DatasetRun}_stage_a_smoke" --device $Device --batch 8 --smoke
    if ($LASTEXITCODE -ne 0) { throw "Smoke training failed with exit code $LASTEXITCODE" }
    Write-Host "Smoke complete. Full training was not started." -ForegroundColor Green
    exit 0
}

Write-Host "== Stage A: machine-dominant full training ==" -ForegroundColor Cyan
Invoke-Stage -StageName $stageA -Epochs 60 -Patience 12 -LearningRate 0.0002 -StageResume:$Resume

Write-Host "== Stage B: cap/label specialization continuation ==" -ForegroundColor Cyan
$stageAWeights = Join-Path $PWD "runs\$stageA\weights\best.pt"
if (-not (Test-Path -LiteralPath $stageAWeights)) { throw "Stage A checkpoint missing: $stageAWeights" }
Invoke-Stage -StageName $stageB -Weights $stageAWeights -Epochs 25 -Patience 8 -LearningRate 0.00007

Write-Host "== Evaluate both stages ==" -ForegroundColor Cyan
$evaluationArgs = @("scripts\evaluate_m2_revamped.py", "--config", $config, "--dataset-run", $DatasetRun, "--stage-a", $stageA, "--stage-b", $stageB)
if ($ManualMachineAcceptance) {
    $evaluationArgs += @("--manual-machine-acceptance", "--acceptance-reason", $AcceptanceReason)
}
& $py @evaluationArgs
if ($LASTEXITCODE -ne 0) { throw "Evaluation failed with exit code $LASTEXITCODE" }

Write-Host "== Export and stage selected candidate ==" -ForegroundColor Cyan
& $py scripts\export_m2_revamped.py --config $config --dataset-run $DatasetRun
if ($LASTEXITCODE -ne 0) { throw "Candidate export failed with exit code $LASTEXITCODE" }

Write-Host "Complete. No production model was modified. Reports: $logsRoot" -ForegroundColor Green
