[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'demo-day.ps1') @Arguments
exit $LASTEXITCODE
