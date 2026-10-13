@echo off
chcp 65001 >nul
echo Fabrication et installation de l'application OrthoAI...
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\creer-application.ps1" %*
pause
