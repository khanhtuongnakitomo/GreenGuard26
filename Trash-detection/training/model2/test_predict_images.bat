@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Running Visual Predictions for Model 2
echo ========================================================

if not "%~1"=="" (
    echo Testing custom input: %~1
    ..\model1\.venv\Scripts\python.exe scripts\predict_test.py --source "%~1" --save-dir logs\predictions
) else (
    ..\model1\.venv\Scripts\python.exe scripts\predict_test.py --save-dir logs\predictions
)

echo.
echo All annotated test images have been saved to:
echo   logs\predictions\
echo.
pause
