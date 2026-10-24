[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = 'Stop'
$detectionRoot = $PSScriptRoot
$fullDemo = Join-Path $detectionRoot 'full_demo.bat'
$apiUrl = if ($env:DASHBOARD_API_URL) { $env:DASHBOARD_API_URL.TrimEnd('/') } else { 'http://127.0.0.1:3003' }
$webUrl = if ($env:DASHBOARD_WEB_URL) { $env:DASHBOARD_WEB_URL.TrimEnd('/') } else { 'http://127.0.0.1:8081' }
$machineCode = if ($env:DASHBOARD_MACHINE_CODE) { $env:DASHBOARD_MACHINE_CODE } else { '0001' }
$cameraSource = if ($env:DEMO_CAMERA_SOURCE) { $env:DEMO_CAMERA_SOURCE } else { '1' }

function Test-ApiHealth {
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            return $false
        }
        return (($response.Content | ConvertFrom-Json).status -eq 'ok')
    }
    catch {
        return $false
    }
}

function Test-WebReady {
    try {
        $response = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    }
    catch {
        return $false
    }
}

function Select-OutputMode {
    Write-Host ''
    Write-Host 'GreenGuard Demo Day output mode'
    Write-Host '  1. Terminal signal output'
    Write-Host '  2. ESP USB serial output'
    $choice = Read-Host 'Choose 1 or 2'
    if ($choice -eq '1') { return 'terminal' }
    if ($choice -eq '2') { return 'esp' }
    throw 'Invalid output mode. Choose 1 or 2.'
}

try {
    if (-not (Test-Path $fullDemo)) {
        throw "Full-demo launcher is missing: $fullDemo"
    }

    $remaining = @($Arguments)
    $mode = $null
    $port = $null
    if ($remaining.Count -gt 0 -and $remaining[0].ToLowerInvariant() -in @('terminal', 'esp')) {
        $mode = $remaining[0].ToLowerInvariant()
        $remaining = @($remaining | Select-Object -Skip 1)
    }
    else {
        $mode = Select-OutputMode
    }

    # `esp` is the public launcher name; the Python runtime calls its strict
    # USB controller transport `serial`.
    $controllerOutput = if ($mode -eq 'esp') { 'serial' } else { $mode }

    if ($controllerOutput -eq 'serial' -and $remaining.Count -gt 0) {
        if ($remaining[0] -match '^(COM\d+|\\\\\.\\COM\d+)$') {
            $port = $remaining[0]
            $remaining = @($remaining | Select-Object -Skip 1)
        }
    }

    if (-not (Test-ApiHealth)) {
        throw "Dashboard API is not ready at $apiUrl. Run ..\Dashboard\run-dashboard.bat first."
    }
    if (-not (Test-WebReady)) {
        throw "Dashboard frontend is not ready at $webUrl. Run ..\Dashboard\run-dashboard.bat first."
    }

    Start-Process $webUrl | Out-Null
    Write-Host "[Demo Day] Dashboard: $webUrl"
    Write-Host "[Demo Day] API:       $apiUrl"
    Write-Host "[Demo Day] Output:    $mode$(if ($port) { " ($port)" } else { '' })"
    Write-Host "[Demo Day] Camera:    source $cameraSource (set DEMO_CAMERA_SOURCE to override)"
    Write-Host "[Demo Day] Signals:   0 emergency stop, 1 aluminum, 2 good PET, 3 bad PET"
    Write-Host '[Demo Day] After each result: paused. S/Space/Run = next, M = ESP emergency stop, F = finalize, Q = QR, X = exit.'

    $fullDemoArgs = @(
        '--publish-dashboard',
        '--require-dashboard',
        '--dashboard-api-url', $apiUrl,
        '--machine-code', $machineCode,
        '--source', $cameraSource,
        '--controller-output', $controllerOutput,
        '--start-paused',
        '--pause-after-result',
        '--session-mode', 'manual'
    )
    if ($port) {
        $fullDemoArgs += @('--controller-port', $port)
    }
    $fullDemoArgs += $remaining

    Push-Location $detectionRoot
    try {
        & $fullDemo @fullDemoArgs
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    exit $exitCode
}
catch {
    [Console]::Error.WriteLine("ERROR: " + $_.Exception.Message)
    exit 2
}
