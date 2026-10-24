@echo off
setlocal
cd /d "%~dp0pc-demo"
if not exist ".venv\Scripts\python.exe" (
    echo Run pc-demo\setup.ps1 first
    exit /b 1
)
if not exist "models\candidates\m1_efficient_current.onnx" (
    echo Model 1-B candidate model is missing: models\candidates\m1_efficient_current.onnx
    exit /b 1
)

rem Candidate preview only: Model 1-B and Model 2 run in parallel; no signal is sent.
".venv\Scripts\python.exe" src\app.py --mode parallel-preview --config default --m1-config m1_candidate --auto-start %*
exit /b %ERRORLEVEL%
