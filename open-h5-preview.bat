@echo off
setlocal

set "ROOT=%~dp0"
set "FRONTEND_DIR=%ROOT%frontend"
set "READY_URL=http://127.0.0.1:5173/index.html"
set "PREVIEW_URL=http://127.0.0.1:5173/index.html#/control"

if not exist "%FRONTEND_DIR%\package.json" (
  echo frontend directory not found: "%FRONTEND_DIR%"
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND_DIR%"
  call npm.cmd install
  if errorlevel 1 (
    popd
    echo npm install failed.
    pause
    exit /b 1
  )
  popd
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference = 'SilentlyContinue';" ^
  "try {" ^
  "  $r = Invoke-WebRequest -Uri '%READY_URL%' -UseBasicParsing -TimeoutSec 2;" ^
  "  if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 }" ^
  "} catch { exit 1 }" >nul 2>nul

if errorlevel 1 (
  echo Starting frontend preview server...
  start "MCSManager H5 Preview" cmd /k "cd /d ""%FRONTEND_DIR%"" & title MCSManager H5 Preview & npm.cmd run dev -- --port 5173 --strictPort"
  timeout /t 2 /nobreak >nul
) else (
  echo Frontend preview server is already running.
)

echo Waiting for frontend to be ready...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference = 'SilentlyContinue';" ^
  "$ready = $false;" ^
  "for ($i = 0; $i -lt 60; $i++) {" ^
  "  try {" ^
  "    $r = Invoke-WebRequest -Uri '%READY_URL%' -UseBasicParsing -TimeoutSec 2;" ^
  "    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 1" ^
  "}" ^
  "if ($ready) { exit 0 } else { exit 1 }"

if errorlevel 1 (
  echo Preview server did not become ready in time.
  echo Check the "MCSManager H5 Preview" window for errors.
  pause
  exit /b 1
)

start "" "%PREVIEW_URL%"
echo Opened: %PREVIEW_URL%
exit /b 0
