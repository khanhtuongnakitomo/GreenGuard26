@echo off
rem Model 1 ONLY demo (PET bottle / Aluminum can) - CPU only
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    set "PY=.venv\Scripts\python.exe"
) else (
    set "PY=python"
)
"%PY%" scripts\demo_live.py %*
echo.
pause >nul
