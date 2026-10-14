@echo off
chcp 65001 >nul
echo Installation du serveur OrthoAI du cabinet...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer-serveur.ps1" %*
pause
