# Setup script for Trash-detection
# Usage: .\setup.ps1

Write-Host "1. Creating Python 3.12 virtual environment..." -ForegroundColor Cyan
uv venv .venv --python 3.12 --clear
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create virtual environment." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n2. Activating virtual environment & installing requirements..." -ForegroundColor Cyan
uv pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install requirements." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n3. Fixing OpenCV Headless Conflict..." -ForegroundColor Cyan
Write-Host "Removing both opencv packages to clean the cv2 directory..."
uv pip uninstall opencv-python opencv-python-headless

Write-Host "Reinstalling only the GUI-enabled opencv-python cleanly..."
uv pip install "opencv-python>=4.6.0,<5.0.0"

Write-Host "`n4. Verifying OpenCV installation..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe -c "import cv2; print(f'OpenCV Version: {cv2.__version__}'); cv2.namedWindow('test'); cv2.destroyAllWindows(); print('GUI window test: OK')"

Write-Host "`nSetup complete! You can now activate the environment and run the detection:" -ForegroundColor Green
Write-Host ".venv\Scripts\activate"
Write-Host "python src\test_webcam.py"
