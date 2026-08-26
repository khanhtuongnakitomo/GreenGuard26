@echo off
setlocal
cd /d "%~dp0"

if "%1"=="--smoke" (
    echo Running Model 2 v4 SMOKE Pipeline...
    powershell -ExecutionPolicy Bypass -File scripts\run_m2v4_training.ps1 -Smoke -AllowNoRing
) else if "%1"=="-s" (
    echo Running Model 2 v4 SMOKE Pipeline...
    powershell -ExecutionPolicy Bypass -File scripts\run_m2v4_training.ps1 -Smoke -AllowNoRing
) else (
    echo Running Model 2 v4 FULL Fine-Tuning Pipeline...
    powershell -ExecutionPolicy Bypass -File scripts\run_m2v4_training.ps1 -AllowNoRing
)

pause
