@echo off
rem GreenGuard Model 1 rebuild — double-click demo launcher.
rem Uses the local .venv if present, else falls back to system python.
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    set "PY=.venv\Scripts\python.exe"
) else (
    set "PY=python"
    echo [run_demo] no .venv found - using system python
    echo [run_demo] (create one with:  py -3.11 -m venv .venv  ^&^&  .venv\Scripts\pip install -r requirements.txt)
)

"%PY%" scripts\demo_live.py %*
echo.
echo [run_demo] exited. Press a key to close...
pause >nul
