@echo off
echo Starting Finance Tracker...
echo.

echo [1/3] Starting Backend Server (FastAPI on port 3001)...
cd /d "%~dp0server"
start "Backend Server" cmd /k "python main.py"

echo.
echo [2/3] Installing frontend dependencies (first time only)...
cd /d "%~dp0client_react"
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
)

echo.
echo [3/3] Starting Frontend Server (Vite on port 3000)...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ================================================
echo   Finance Tracker is starting up!
echo ================================================
echo.
echo   Backend API:  http://localhost:3001
echo   Frontend:     http://localhost:3000
echo.
echo   The frontend will automatically open in your browser.
echo.
echo   Press Ctrl+C in each window to stop the servers
echo   or close the terminal windows.
echo.
echo ================================================
echo.

timeout /t 5 /nobreak >nul
start http://localhost:3000