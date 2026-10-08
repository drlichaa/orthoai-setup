@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telechargez la version LTS sur https://nodejs.org puis relancez.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Premiere utilisation : installation des dependances...
  call npm install
)
if not exist .env (
  copy .env.example .env >nul
  echo Renseignez votre cle API Anthropic dans le fichier .env qui va s'ouvrir, enregistrez, puis relancez.
  notepad .env
  exit /b 0
)
node scripts\demarrer.js
pause
