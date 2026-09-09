@echo off
setlocal
cd /d "%~dp0pc-demo"
if not exist ".venv\Scripts\python.exe" (
    echo Run pc-demo\setup.ps1 first
    exit /b 1
)
".venv\Scripts\python.exe" src\app.py --mode model1 --config m1_candidate %*
exit /b %ERRORLEVEL%
