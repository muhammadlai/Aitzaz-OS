@echo off
rem ===========================================================================
rem  Aitzaz AI Pro — Windows one-shot installer for the DESKTOP CLIENT + HUD
rem  --------------------------------------------------------------------------
rem  This sets up a Python venv with the desktop client dependencies and
rem  creates "Aitzaz Assistant" shortcuts that:
rem    1. launch the desktop voice client  (continuous listening, no Listen
rem       button — talks to your voice-pipeline server over the LAN), and
rem    2. open the Aitzaz HUD in your default browser.
rem
rem  The voice pipeline server itself runs on the machine that hosts Hermes
rem  Agent (see README "Installation"). Point the shortcut at it with
rem  AITZAZ_SERVER below.
rem
rem  Privacy: the client forwards live mic audio to YOUR server only. Nothing
rem  is recorded or stored, and the OS shows its normal microphone indicator.
rem ===========================================================================
@echo off
setlocal

set AITZAZ_SERVER=ws://YOUR_SERVER_IP:8765/ws

echo.
echo  AITZAZ AI PRO - Windows desktop client installer
echo  -------------------------------------------------
echo  Requires Python 3.11+ from https://www.python.org/downloads/
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Python not found on PATH. Install it first, then re-run.
  pause & exit /b 1
)

cd /d "%~dp0.."

echo  [1/4] Creating Python environment...
python -m venv .venv-client
if errorlevel 1 ( echo  [ERROR] venv creation failed & pause & exit /b 1 )

echo  [2/4] Installing client dependencies...
".venv-client\Scripts\python.exe" -m pip install --quiet --upgrade pip
".venv-client\Scripts\python.exe" -m pip install --quiet -r client\requirements-client.txt
if errorlevel 1 ( echo  [ERROR] dependency install failed & pause & exit /b 1 )

echo  [3/4] Creating shortcuts...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Aitzaz Assistant.lnk');" ^
  "$sc.TargetPath = '%CD%\.venv-client\Scripts\pythonw.exe';" ^
  "$sc.Arguments = '%CD%\client\client.py --server %AITZAZ_SERVER%';" ^
  "$sc.WorkingDirectory = '%CD%\client';" ^
  "$sc.Description = 'Aitzaz AI Pro desktop voice assistant (continuous listening)';" ^
  "$sc.Save();" ^
  "$sc2 = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Aitzaz HUD.lnk');" ^
  "$sc2.TargetPath = 'https://YOUR_SERVER_IP/hud/';" ^
  "$sc2.Description = 'Open the Aitzaz AI Pro control HUD';" ^
  "$sc2.Save();"

echo  [4/4] Done.
echo.
echo  Desktop shortcuts created:
echo    - Aitzaz Assistant   (continuous voice client)
echo    - Aitzaz HUD         (control HUD in your browser)
echo.
echo  NOTE: edit install.bat and replace YOUR_SERVER_IP with the LAN IP of the
echo  machine running the Aitzaz voice pipeline server.
echo.
pause
