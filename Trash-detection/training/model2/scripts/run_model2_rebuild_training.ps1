# GreenGuard Model 2 rebuild (horizontal robustness) — ONE-COMMAND pipeline.
# NO -AllowNoRing here by design: this rebuild exists to improve true ring
# detection. Hard-stops when verified ring labels are missing or below minimum.
# audit -> data -> eval sets -> appearance sim -> smoke -> fine-tune
# -> eval gates -> export ONLY on pass. m2v3_seed42_n640 stays the rollback.
#
# HOW TO RUN (PowerShell, from model2-rebuild\):
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_rebuild_training.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_rebuild_training.ps1 -Smoke
#   powershell -ExecutionPolicy Bypass -File scripts\run_model2_rebuild_training.ps1 -EvalOnly

param(
    [switch]$Smoke,
    [switch]$EvalOnly
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$py = "..\model1\.venv\Scripts\python.exe"
$logdir = "logs\m2_orient"
New-Item -ItemType Directory -Force -Path logs, $logdir | Out-Null
$sw = [System.Diagnostics.Stopwatch]::StartNew()

function Stage {
    param([string]$name, [scriptblock]$block)
    Write-Host ""
    Write-Host "== $name ==" -ForegroundColor Cyan
    & $block
    if ($LASTEXITCODE -ne 0) { Write-Host "STAGE FAILED: $name" -ForegroundColor Red; exit $LASTEXITCODE }
}

# ---- 1. Preflight ----
Stage "1/10 Preflight" {
    if (-not (Test-Path $py)) { Write-Host "ERROR: venv python missing"; exit 1 }
    & $py -c "import torch; assert torch.cuda.is_available(); torch.zeros(1).cuda(); print('CUDA compute OK')"
    if (-not (Test-Path "runs\m2v3_seed42_n640\weights\best.pt")) { Write-Host "ERROR: m2v3 baseline weights missing"; exit 1 }
    if (-not (Test-Path "..\dataset\sources")) { Write-Host "ERROR: dataset\sources missing"; exit 1 }
    $free = (Get-PSDrive D).Free / 1GB; Write-Host ("disk free: {0:N1} GB" -f $free)
    if ($free -lt 20) { Write-Host "ERROR: <20GB free"; exit 1 }
}

if (-not $EvalOnly) {

# ---- 2. Data pipeline ----
Stage "2/10 Data pipeline" {
    & $py scripts\normalize_labels.py 2>&1 | Tee-Object "$logdir\normalize.log"
    & $py scripts\dedupe.py 8 2>&1 | Tee-Object "$logdir\dedupe.log"
    if (-not $Smoke) {
        & $py scripts\appearance_sim.py --model 2 --fraction 0.25 2>&1 | Tee-Object "$logdir\appearance_sim.log"
    }
    & $py scripts\split_dataset.py 2>&1 | Tee-Object "$logdir\split.log"
}

# ---- 3. Audits + ring gate ----
Stage "3/10 Audits + ring gate" {
    & $py scripts\orientation_audit.py --model 2 2>&1 | Tee-Object "$logdir\orientation.log"
    & $py scripts\check_ring_gate.py 2>&1 | Tee-Object "$logdir\ring_gate.log"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "RING GATE FAIL — need verified ring in train/val/test (owner-live)." -ForegroundColor Red
        exit 1
    }
}

# ---- 4. Eval sets ----
Stage "4/10 Locked eval sets" {
    & $py scripts\rotated_control.py --model 2 2>&1 | Tee-Object "$logdir\rotated_control.log"
}

# ---- 5. Smoke ----
Stage "5/10 Smoke train" {
    & $py scripts\train.py --weights runs\m2v3_seed42_n640\weights\best.pt --epochs 1 --imgsz 320 --fraction 0.05 --workers 0 --batch 8 --patience 1 --close-mosaic 0 --degrees 90 --name smoke_m2_orient 2>&1 | Tee-Object "$logdir\smoke.log"
}

if ($Smoke) {
    Write-Host "SMOKE OK — pipeline validated, no full training." -ForegroundColor Green
    exit 0
}

# ---- 6. Fine-tune ----
Stage "6/10 Fine-tune" {
    & $py scripts\train.py --weights runs\m2v3_seed42_n640\weights\best.pt --epochs 100 --patience 25 --lr0 0.001 --degrees 90 --flipud 0.5 --fliplr 0.5 --close-mosaic 20 --name m2_orient_seed42_n640 2>&1 | Tee-Object "$logdir\train.log"
}

} # end not EvalOnly

# ---- 7-8. Eval gates ----
Stage "7/10 Eval baseline vs candidate" {
    & $py scripts\eval_val.py m2v3_seed42_n640 2>&1 | Tee-Object "$logdir\eval_base.log"
    & $py scripts\eval_val.py m2_orient_seed42_n640 2>&1 | Tee-Object "$logdir\eval_cand.log"
}

Stage "8/10 Gate decision" {
    & $py scripts\gate_compare.py m2_orient_seed42_n640 2>&1 | Tee-Object "$logdir\gate.log"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "GATE FAIL — candidate NOT promoted. Current deploy files unchanged." -ForegroundColor Red
        exit 1
    }
}

# ---- 9. Export (only after gates pass) ----
Stage "9/10 Export ONNX 640 + 416" {
    & $py scripts\export_onnx.py --weights runs\m2_orient_seed42_n640\weights\best.pt --imgsz 640 2>&1 | Tee-Object "$logdir\export_640.log"
    & $py scripts\export_onnx.py --weights runs\m2_orient_seed42_n640\weights\best.pt --imgsz 416 2>&1 | Tee-Object "$logdir\export_416.log"
}

$sw.Stop()
Write-Host ""
Write-Host ("DONE in {0:N1} min -> runs\m2_orient_seed42_n640 + fresh ONNX" -f $sw.Elapsed.TotalMinutes) -ForegroundColor Green
Write-Host "Tell the agent 'm2 orient xong' to sync exports to GreenGuard26." -ForegroundColor Yellow
