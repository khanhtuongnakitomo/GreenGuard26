@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe src\app.py %*
) else (
    echo Run setup.ps1 first
    exit /b 1
)
