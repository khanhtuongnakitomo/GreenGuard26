@echo off
setlocal
cd /d "%~dp0pc-demo"
if not exist ".venv\Scripts\python.exe" (
    echo Run pc-demo\setup.ps1 first
    exit /b 1
)
".venv\Scripts\python.exe" src\machine_app.py %*
exit /b %ERRORLEVEL%
