@echo off
rem GreenGuard two-model gating demo (CPU only)
setlocal
cd /d "%~dp0"
if exist "..\model1\.venv\Scripts\python.exe" (
    set "PY=..\model1\.venv\Scripts\python.exe"
) else (
    set "PY=python"
)
"%PY%" scripts\pipeline_demo.py %*
pause >nul
