[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]$RunId,
    [Parameter(Mandatory = $true)] [string]$ReportRoot
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$modelRoot = Join-Path $repoRoot "Trash-detection\training\model1"
$reportPath = [IO.Path]::GetFullPath($ReportRoot)
$packagePath = Join-Path $reportPath "candidate_package_report.json"
$preflightPath = Join-Path $reportPath "preflight_report.json"
$activeModel = Join-Path $repoRoot "Trash-detection\pc-demo\models\m1_detect_640.onnx"
$pcM2 = Join-Path $repoRoot "Trash-detection\pc-demo\models\m2_obb_640.onnx"
$jetsonM2 = Join-Path $repoRoot "Trash-detection\jetson-runtime\models\m2_obb_416.onnx"

function Get-Sha256([string]$PathValue) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $PathValue).Hash.ToLowerInvariant()
}

function Write-Report([hashtable]$Value) {
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $reportPath "git_publish_report.json") -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $packagePath)) {
    Write-Report @{ status = "NOT_RUN"; reason = "candidate package report is missing"; run_id = $RunId }
    exit 2
}
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ([string]$package.status -eq "FAILED_EXPORT_NO_RUNNABLE_CANDIDATE") {
    Write-Report @{ status = "NOT_RUN"; reason = "candidate is not runnable"; run_id = $RunId }
    exit 2
}

if (-not (Test-Path -LiteralPath $preflightPath)) { throw "preflight report is missing" }
$preflight = Get-Content -LiteralPath $preflightPath -Raw | ConvertFrom-Json
$currentHashes = @{
    m1 = Get-Sha256 $activeModel
    pc_m2 = Get-Sha256 $pcM2
    jetson_m2 = Get-Sha256 $jetsonM2
}
$expectedHashes = $preflight.active_hashes
if ($currentHashes.m1 -ne [string]$expectedHashes.m1 -or $currentHashes.pc_m2 -ne [string]$expectedHashes.pc_m2 -or $currentHashes.jetson_m2 -ne [string]$expectedHashes.jetson_m2) {
    Write-Report @{ status = "NOT_RUN"; reason = "protected active model hash changed during run"; run_id = $RunId; current = $currentHashes; expected = $expectedHashes }
    exit 3
}

Set-Location -LiteralPath $repoRoot
$branch = (git branch --show-current).Trim()
if ($branch -ne "main") { Write-Report @{ status = "NOT_RUN"; reason = "not on main"; branch = $branch; run_id = $RunId }; exit 4 }
git fetch origin main | Out-Null
$head = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()
if ($head -ne $remote) {
    $remoteContainsHead = git merge-base --is-ancestor $head $remote
    if ($LASTEXITCODE -eq 0) {
        git merge --ff-only origin/main | Out-Null
        $head = (git rev-parse HEAD).Trim()
    } else {
        Write-Report @{ status = "NOT_RUN"; reason = "origin/main diverged; no automatic merge or force push"; head = $head; remote = $remote; run_id = $RunId }
        exit 5
    }
}

$allowed = @(
    "Trash-detection/pc-demo/config/m1_candidate.json",
    "Trash-detection/pc-demo/models/m1_candidate_manifest.json",
    "Trash-detection/pc-demo/models/candidates/m1_efficient_current.onnx",
    "Trash-detection/training/model1/reports/$RunId.md"
)
git add -- $allowed
$staged = @(git diff --cached --name-only)
$unexpected = @($staged | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -gt 0) {
    git reset -- $allowed | Out-Null
    Write-Report @{ status = "NOT_RUN"; reason = "unexpected staged paths"; unexpected = $unexpected; run_id = $RunId }
    exit 6
}
if ($staged.Count -eq 0) {
    Write-Report @{ status = "NOT_RUN"; reason = "candidate package produced no Git changes"; run_id = $RunId }
    exit 7
}
$message = "train(model1): publish efficient machine challenger"
git commit -m $message | Out-Null
$commit = (git rev-parse HEAD).Trim()
git fetch origin main | Out-Null
$remoteAfterFetch = (git rev-parse origin/main).Trim()
if ($remoteAfterFetch -ne $commit) {
    $remoteStillAncestor = git merge-base --is-ancestor $remoteAfterFetch $commit
    if ($LASTEXITCODE -ne 0) {
        Write-Report @{ status = "COMMITTED_NOT_PUSHED"; reason = "origin/main advanced after commit"; commit = $commit; remote = $remoteAfterFetch; run_id = $RunId }
        exit 8
    }
}
git push origin main | Out-Null
$remoteCommit = (git ls-remote origin refs/heads/main).Split("`t")[0].Trim()
$status = if ($remoteCommit -eq $commit) { "PUSHED" } else { "PUSH_FAILED_VERIFICATION" }
Write-Report @{ status = $status; run_id = $RunId; commit = $commit; remote_commit = $remoteCommit; staged = $staged; protected_hashes = $currentHashes }
if ($status -ne "PUSHED") { exit 9 }
