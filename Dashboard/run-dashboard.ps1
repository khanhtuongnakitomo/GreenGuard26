[CmdletBinding()]
param(
    [ValidateSet('run', 'repair', 'status')]
    [string]$Command = 'run'
)

$ErrorActionPreference = 'Stop'
$dashboardRoot = $PSScriptRoot
$backendRoot = Join-Path $dashboardRoot 'backend'
$frontendRoot = Join-Path $dashboardRoot 'frontend'
$apiUrl = if ($env:DASHBOARD_API_URL) { $env:DASHBOARD_API_URL.TrimEnd('/') } else { 'http://127.0.0.1:3003' }
$webUrl = if ($env:DASHBOARD_WEB_URL) { $env:DASHBOARD_WEB_URL.TrimEnd('/') } else { 'http://127.0.0.1:8081' }
$logRoot = Join-Path $env:TEMP 'greenguard-dashboard-local'

function Get-PnpmCommand {
    # Do not prefer the user-global pnpm shim. On managed Windows machines it
    # commonly points to AppData\Roaming\npm\pnpm.exe, which Device Guard can
    # block even though Node and this project are otherwise usable.
    $bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $bundledPnpm) {
        return $bundledPnpm
    }

    if (-not [string]::IsNullOrWhiteSpace($env:GREENGUARD_PNPM_PATH)) {
        if (Test-Path -LiteralPath $env:GREENGUARD_PNPM_PATH) {
            return $env:GREENGUARD_PNPM_PATH
        }
        throw "GREENGUARD_PNPM_PATH does not exist: $($env:GREENGUARD_PNPM_PATH)"
    }

    $command = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if (-not $command) { $command = Get-Command pnpm -ErrorAction SilentlyContinue }
    if ($command -and $command.Source -match '\\AppData\\Roaming\\npm\\pnpm(\.cmd)?$') {
        throw 'The global pnpm installation is blocked by Device Guard. The dashboard can still run when dependencies already exist; for repair, install an organization-approved pnpm or set GREENGUARD_PNPM_PATH.'
    }
    if ($command) { return $command.Source }
    throw 'pnpm was not found. Install an organization-approved pnpm or set GREENGUARD_PNPM_PATH.'
}

function Get-ProjectCommand([string]$ProjectRoot, [string]$CommandName) {
    $commandPath = Join-Path $ProjectRoot "node_modules\.bin\$CommandName"
    if (-not (Test-Path -LiteralPath $commandPath)) {
        throw "Missing project command: $commandPath. Run .\run-dashboard.bat repair after installing an organization-approved pnpm."
    }
    return $commandPath
}

function Quote-PowerShell([string]$Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

function Test-ApiHealth {
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            return $false
        }
        $body = $response.Content | ConvertFrom-Json
        return $body.status -eq 'ok'
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

function Wait-Ready([scriptblock]$Check, [int]$TimeoutSeconds, [string]$Name) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (& $Check) {
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not become ready. Check the visible service window and logs in $logRoot"
}

function Assert-SafeNodeModulesPath([string]$ProjectRoot) {
    $expected = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'node_modules'))
    $resolvedRoot = [IO.Path]::GetFullPath($ProjectRoot)
    if (-not $expected.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify an unsafe dependency path: $expected"
    }
    return $expected
}

function Install-Dependencies([string]$ProjectRoot, [string]$Name, $PnpmCommand) {
    $nodeModules = Assert-SafeNodeModulesPath $ProjectRoot
    if (Test-Path -LiteralPath $nodeModules) {
        Write-Host "[Dashboard] Repairing $Name dependencies at $nodeModules"
        Remove-Item -LiteralPath $nodeModules -Recurse -Force
    }
    Push-Location $ProjectRoot
    try {
        & $PnpmCommand install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            throw "$Name dependency installation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Ensure-Dependencies([bool]$Repair) {
    $backendReady = Test-Path (Join-Path $backendRoot 'node_modules\.bin\tsx.cmd')
    $frontendReady = Test-Path (Join-Path $frontendRoot 'node_modules\.bin\expo.cmd')
    if ($backendReady -and $frontendReady) {
        return
    }

    $pnpm = Get-PnpmCommand

    $missing = @()
    if (-not $backendReady) { $missing += 'backend' }
    if (-not $frontendReady) { $missing += 'frontend' }
    $shouldRepair = $Repair
    if (-not $shouldRepair) {
        $answer = Read-Host "Missing or broken $($missing -join ' and ') dependencies. Repair now? [Y/N]"
        $shouldRepair = $answer -match '^(y|yes)$'
    }
    if (-not $shouldRepair) {
        throw "Dashboard dependencies are not ready. Run .\run-dashboard.bat repair to repair them."
    }

    if (-not $backendReady) {
        Install-Dependencies $backendRoot 'backend' $pnpm
    }
    if (-not $frontendReady) {
        Install-Dependencies $frontendRoot 'frontend' $pnpm
    }
    if (-not (Test-Path (Join-Path $frontendRoot 'node_modules\.bin\expo.cmd'))) {
        throw 'Frontend repair completed without creating node_modules\.bin\expo.cmd'
    }
    return $pnpm
}

function Start-VisibleService(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$EnvironmentScript,
    [string]$CommandArguments,
    [string]$CommandPath
) {
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $logPath = Join-Path $logRoot "$Name-$stamp.log"
    $title = "GreenGuard Dashboard $Name"
$command = @"
`$Host.UI.RawUI.WindowTitle = $(Quote-PowerShell $title)
$EnvironmentScript
Set-Location $(Quote-PowerShell $WorkingDirectory)
& $(Quote-PowerShell $CommandPath) $CommandArguments 2>&1 | Tee-Object -FilePath $(Quote-PowerShell $logPath)
Write-Host "[$Name] stopped. Log: $logPath" -ForegroundColor Yellow
Read-Host 'Press Enter to close this window'
"@
    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command', $command) `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Normal `
        -PassThru
    Write-Host "[Dashboard] Started $Name window (PID $($process.Id)); log: $logPath"
}

function Assert-MongoConfiguration {
    $backendEnv = Join-Path $backendRoot '.env'
    $fromProcess = -not [string]::IsNullOrWhiteSpace($env:MONGODB_URI) -or
        -not [string]::IsNullOrWhiteSpace($env:MONGO_URI)
    $fromFile = (Test-Path $backendEnv) -and [bool](
        Select-String -Path $backendEnv -Pattern '^\s*(MONGODB_URI|MONGO_URI)\s*=\s*\S+' -Quiet
    )
    if (-not $fromProcess -and -not $fromFile) {
        throw "Dashboard MongoDB is not configured. Set MONGODB_URI in $backendEnv"
    }
}

function Get-ConfiguredQrSecret {
    $candidates = @(
        $env:QR_SECRET,
        (Join-Path $backendRoot '.env'),
        # Support the current repository layout (GreenPoint-Backend is next
        # to GreenGuard26) and the older layout where it lived inside it.
        (Join-Path $dashboardRoot '..\..\GreenPoint-Backend\.env'),
        (Join-Path $dashboardRoot '..\GreenPoint-Backend\.env')
    )
    foreach ($candidate in $candidates) {
        # An unset QR_SECRET contributes a null item to $candidates. Do not
        # pass it to Test-Path because LiteralPath does not accept null.
        if ([string]::IsNullOrWhiteSpace([string]$candidate)) {
            continue
        }
        $candidate = [string]$candidate
        if ($candidate.Length -ge 16 -and -not ($candidate -match '\\|=')) {
            return $candidate.Trim()
        }
        if (Test-Path -LiteralPath $candidate) {
            $line = Get-Content -LiteralPath $candidate | Where-Object { $_ -match '^\s*QR_SECRET\s*=\s*(\S+)\s*$' } | Select-Object -First 1
            if ($line -and $line -match '^\s*QR_SECRET\s*=\s*(\S+)\s*$' -and $Matches[1].Length -ge 16) {
                return $Matches[1]
            }
        }
    }
    return $null
}

function Assert-QrConfiguration {
    if (-not (Get-ConfiguredQrSecret)) {
        throw "QR_SECRET is not configured. Set the same QR_SECRET used by GreenPoint-Backend in $backendRoot\.env"
    }
}

try {
    if ($Command -eq 'status') {
        Write-Host "API:      $apiUrl  $(if (Test-ApiHealth) { 'READY' } else { 'NOT READY' })"
        Write-Host "Frontend: $webUrl  $(if (Test-WebReady) { 'READY' } else { 'NOT READY' })"
        Write-Host "Logs:     $logRoot"
        exit 0
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js was not found in PATH.'
    }
    if ($Command -eq 'repair') {
        Ensure-Dependencies $true
    }
    if (-not (Test-ApiHealth)) {
        Assert-MongoConfiguration
        Assert-QrConfiguration
        Ensure-Dependencies ($Command -eq 'repair')
        $apiUri = [Uri]$apiUrl
        $qrSecret = Get-ConfiguredQrSecret
        $backendEnvironment = @(
            "Set-Item Env:PORT '$($apiUri.Port)'"
            "Set-Item Env:HOST $(Quote-PowerShell $apiUri.Host)"
            "Set-Item Env:QR_SECRET $(Quote-PowerShell $qrSecret)"
        ) -join "`n"
        Start-VisibleService 'backend' $backendRoot $backendEnvironment 'watch src/server.ts' (Get-ProjectCommand $backendRoot 'tsx.cmd')
        Wait-Ready ${function:Test-ApiHealth} 60 'Dashboard backend'
    }

    if (-not (Test-WebReady)) {
        Ensure-Dependencies ($Command -eq 'repair')
        $webUri = [Uri]$webUrl
        $frontendEnvironment = @(
            "Set-Item Env:EXPO_PUBLIC_DEMO_MODE $(Quote-PowerShell 'false')"
            "Set-Item Env:EXPO_PUBLIC_API_URL $(Quote-PowerShell $apiUrl)"
            "Set-Item Env:BROWSER $(Quote-PowerShell 'none')"
        ) -join "`n"
        Start-VisibleService 'frontend' $frontendRoot $frontendEnvironment "start --web --port $($webUri.Port)" (Get-ProjectCommand $frontendRoot 'expo.cmd')
        Wait-Ready ${function:Test-WebReady} 120 'Dashboard frontend'
    }

    Start-Process $webUrl | Out-Null
    Write-Host "[Dashboard] Live Dashboard: $webUrl" -ForegroundColor Green
    Write-Host "[Dashboard] API: $apiUrl" -ForegroundColor Green
    Write-Host "[Dashboard] Service windows remain open for monitoring."
}
catch {
    [Console]::Error.WriteLine("ERROR: " + $_.Exception.Message)
    exit 2
}
