@echo off
rem Model 1 Fix B - build crops, train classifier, export ONNX
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File scripts\run_classifier_training.ps1 %*
echo.
pause >nul
