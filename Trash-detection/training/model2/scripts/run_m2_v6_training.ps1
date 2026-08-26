# GreenGuard Model 2 v6 — ONE-COMMAND in-machine domain rebuild, hard 3h cap.
#   purge generic _aug/_rob -> in-machine augment -> normalize (SOURCE_CAP)
#   -> dedupe -> split (VAL_CAP) -> train (YOLO11s-OBB @640, time-capped)
#   -> eval locked test -> export ONNX candidates.
#
# Fixes v5's failures by baking the measured in-machine camera domain (low
# upward angle, ~-25deg tilt, cool steel light + the bonus-light overexposure
# regime) into the offline augmentation, and capping wall clock at ~2.1h.
#
# HOW TO RUN (PowerShell, from training\model2\):
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1 -Smoke   # ~5 min sanity
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1          # full, <=3h
#   powershell -ExecutionPolicy Bypass -File scripts\run_m2_v6_training.ps1 -SkipAugment
#
# After it finishes, demo with:  .\run_m2_demo.bat   (Model 2 only)
#                                .\run_gate_demo.bat  (full M1 -> M2 gate)
# Uses the model1 venv (GPU machine). Full train hard-capped ~2.1h on RTX 3060.

param(
    [switch]$Smoke,
    [switch]$SkipAugment,
    [switch]$SkipPackage,
    [switch]$SkipVerify,
    [switch]$KillOnHang,
    [int]$Workers = 0,
    [double]$TimeCap = 2.1,
    [string]$RunName = "m2v6_inmachine_seed42_n640"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = "..\model1\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: venv python not found at $py" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path logs | Out-Null

if (-not $SkipAugment) {
    Write-Host "== [0/7] In-machine augment (purge generic _aug/_rob, then _im domain variants) ==" -ForegroundColor Cyan
    & $py scripts\augment_inmachine.py 2>&1 | Tee-Object -FilePath logs\m2_augment_inmachine.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipVerify -and -not $Smoke) {
    Write-Host "== [0b/7] Verify _im label integrity + lighting regimes ==" -ForegroundColor Cyan
    & $py scripts\verify_inmachine.py 2>&1 | Tee-Object -FilePath logs\m2_verify.log
    if ($LASTEXITCODE -ne 0) {
        Write-Host "VERIFY FAIL - eyeball logs\render_inmachine\ before continuing." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "== [1/7] Normalize (cap/label/ring + SOURCE_CAP trim + hard negatives) ==" -ForegroundColor Cyan
& $py scripts\normalize_labels.py 2>&1 | Tee-Object -FilePath logs\m2_normalize.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [2/7] Dedupe (exact cross-source dupes only; keep _im/_aug siblings) ==" -ForegroundColor Cyan
& $py scripts\dedupe.py 8 2>&1 | Tee-Object -FilePath logs\m2_dedupe.log
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== [3/7] Split (grouped, locked-test aware, ring reserved, VAL_CAP) ==" -ForegroundColor Cyan
& $py scripts\split_dataset.py 2>&1 | Tee-Object -FilePath logs\m2_split.log
$splitCode = $LASTEXITCODE
if ($splitCode -eq 1) {
    Write-Host "ERROR: split leakage FAIL - see logs\m2_split.log" -ForegroundColor Red
    exit 1
}
if ($splitCode -eq 2) {
    Write-Host "DATA_GAP (e.g. ring scarce) - continuing; ring class stays in schema." -ForegroundColor Yellow
}

if ($Smoke) {
    Write-Host "== [4/7] SMOKE train (1 epoch, imgsz 320, 5% data) ==" -ForegroundColor Cyan
    & $py scripts\train_m2_v6.py --smoke 2>&1 | Tee-Object -FilePath logs\m2_smoke.log
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "SMOKE OK -> runs\smoke_m2v6\weights\best.pt" -ForegroundColor Green
    Write-Host "Re-run WITHOUT -Smoke for the real train." -ForegroundColor Yellow
    exit 0
}

Write-Host "== [4/7] Train YOLO11s-OBB @640 (in-machine domain, time cap ${TimeCap}h) -> $RunName ==" -ForegroundColor Cyan

# Launch the health watcher in a SEPARATE window so a frozen trainer console
# still gets babysat. It reads results.csv + GPU and detects crash/hang/stall.
$pidFile = "logs\m2v6.pid"
$watchArgs = @(
    "-ExecutionPolicy","Bypass","-Command",
    "cd '$PWD'; & '$py' scripts\watch_training.py --name '$RunName' --epochs 110 --pid-file '$pidFile'" +
        ($(if ($KillOnHang) { " --kill-on-hang" } else { "" })) +
        " 2>&1 | Tee-Object -FilePath logs\m2v6_watch_console.log"
)
Start-Process powershell -ArgumentList $watchArgs
Start-Sleep -Seconds 2

# Run the trainer as a background job, capture its PID for the watcher.
$trainJob = Start-Process -PassThru -NoNewWindow -FilePath $py `
    -ArgumentList "scripts\train_m2_v6.py","--name","$RunName","--workers","$Workers","--time","$TimeCap" `
    -RedirectStandardOutput logs\m2v6_train.log -RedirectStandardError logs\m2v6_train.err
$trainJob.Id | Out-File -FilePath $pidFile -Encoding ascii
Write-Host "trainer PID $($trainJob.Id) -> $pidFile (watcher attached)" -ForegroundColor Yellow
$trainJob.WaitForExit()
$trainCode = $trainJob.ExitCode
Write-Host "trainer exited with code $trainCode" -ForegroundColor $(if ($trainCode -eq 0) { "Green" } else { "Red" })
if ($trainCode -ne 0) {
    Write-Host "TRAIN FAILED. See logs\m2v6_train.log / .err. Resume: python scripts\train_m2_v6.py --resume" -ForegroundColor Red
    exit $trainCode
}

Write-Host "== [5/7] Eval val @640 + LOCKED test (v5 vs v6 comparison of record) ==" -ForegroundColor Cyan
& $py scripts\eval_val.py $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval.log
& $py scripts\eval_locked_test.py "m2v5_allangle_seed42_n768" $RunName 2>&1 | Tee-Object -FilePath logs\m2_eval_locked.log

Write-Host "== [6/7] Export ONNX (640 deploy + 416 Orin + 768 hi-res) as CANDIDATE ==" -ForegroundColor Cyan
foreach ($sz in 640, 416, 768) {
    & $py scripts\export_onnx.py --run $RunName --imgsz $sz --candidate 2>&1 | Tee-Object -FilePath "logs\m2_export_$sz.log"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "Candidates in export\candidates\$RunName\ (not promoted to production yet)." -ForegroundColor Yellow

if (-not $SkipPackage) {
    Write-Host "== [7/7] Package note ==" -ForegroundColor Cyan
    Write-Host "To deploy v6, promote the candidate then re-run the packager:" -ForegroundColor Yellow
    Write-Host "  copy export\candidates\$RunName\onnx_640\* export\onnx_640\" -ForegroundColor Yellow
    Write-Host "  python ..\..\scripts\package_models.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "DONE -> runs\$RunName\weights\best.pt + ONNX candidates" -ForegroundColor Green
Write-Host "Watcher log: logs\m2v6_watch.log  | status: logs\m2v6_status.json" -ForegroundColor Cyan
Write-Host "Demo now:  .\run_m2_demo.bat   or   .\run_gate_demo.bat" -ForegroundColor Cyan
