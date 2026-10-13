@echo off
chcp 65001 >nul
echo Mise a jour d'OrthoAI...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\mettre-a-jour.ps1" %*
pause
