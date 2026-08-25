@echo off
rem GreenGuard full live demo (Model 1 + Model 2) from Trash-detection root
setlocal
cd /d "%~dp0"
if exist "model1-rebuild\.venv\Scripts\python.exe" (
    set "PY=model1-rebuild\.venv\Scripts\python.exe"
) else (
    set "PY=python"
    echo [run_live_demo] no model1-rebuild\.venv found - using system python
    echo [run_live_demo] create one with:
    echo   cd model1-rebuild
    echo   py -3.11 -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
)
"%PY%" run_live_demo.py %*
echo.
echo [run_live_demo] exited. Press a key to close...
pause >nul
