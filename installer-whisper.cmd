@echo off
chcp 65001 >nul
echo Installation de la transcription locale (Whisper)...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer-whisper.ps1" %*
pause
