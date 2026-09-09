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

rem Model 1-B is the isolated challenger. It never constructs Model 2 or the full workflow.
".venv\Scripts\python.exe" src\app.py --mode model1 --config m1_candidate %*
exit /b %ERRORLEVEL%
