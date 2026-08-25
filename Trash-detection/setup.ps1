$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "pc-demo")
& powershell -ExecutionPolicy Bypass -File setup.ps1
exit $LASTEXITCODE
