# Fabrique l'application OrthoAI pour ce PC Windows et l'installe
# (raccourcis sur le Bureau et dans le menu Démarrer).
# Usage : double-cliquer sur creer-application.cmd, à relancer après chaque mise à jour.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
# Lancée depuis VS Code, cette variable ferait démarrer Electron comme simple Node.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

$Projet = Split-Path $PSScriptRoot -Parent
Set-Location $Projet

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js n'est pas installé : téléchargez la version LTS sur https://nodejs.org puis relancez." -ForegroundColor Red
  exit 1
}

function Npm {
  & npm.cmd @args
  if ($LASTEXITCODE -ne 0) { throw "La commande « npm $args » a échoué : envoyez les messages ci-dessus à votre assistant." }
}

Write-Host "1/4 Installation des dépendances..."
Npm install --no-audit --no-fund --loglevel=error

Write-Host "2/4 Fabrication de l'application (1 à 3 minutes)..."
if (Test-Path release) { Remove-Item release -Recurse -Force }
Npm run app:win

$Exe = Get-ChildItem release -Recurse -Filter "OrthoAI.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Exe) {
  Write-Host "L'application n'a pas été créée : envoyez les messages ci-dessus à votre assistant." -ForegroundColor Red
  exit 1
}

# L'application cherche Whisper dans %USERPROFILE%\.orthoai\whisper : on y relie
# le dossier whisper du projet, où qu'il soit (Documents, OneDrive, Téléchargements...).
$WhisperProjet = Join-Path $Projet "whisper"
$WhisperApp = Join-Path $env:USERPROFILE ".orthoai\whisper"
if ((Test-Path (Join-Path $WhisperProjet "models")) -and -not (Test-Path $WhisperApp)) {
  Write-Host "3/4 Liaison de Whisper..."
  New-Item -ItemType Directory -Force -Path (Split-Path $WhisperApp -Parent) | Out-Null
  New-Item -ItemType Junction -Path $WhisperApp -Target $WhisperProjet | Out-Null
} elseif (-not (Test-Path (Join-Path $WhisperProjet "models"))) {
  Write-Host "3/4 Attention : Whisper n'est pas installé. Lancez installer-whisper.cmd puis relancez ce script." -ForegroundColor Yellow
} else {
  Write-Host "3/4 Whisper déjà relié."
}

Write-Host "4/4 Installation..."
Get-Process OrthoAI -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$Destination = Join-Path $env:LOCALAPPDATA "Programs\OrthoAI"
if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
Copy-Item $Exe.DirectoryName $Destination -Recurse
$Cible = Join-Path $Destination "OrthoAI.exe"

$Shell = New-Object -ComObject WScript.Shell
$MenuDemarrer = Join-Path ([Environment]::GetFolderPath("Programs")) "OrthoAI.lnk"
$Bureau = Join-Path ([Environment]::GetFolderPath("Desktop")) "OrthoAI.lnk"
foreach ($Raccourci in @($MenuDemarrer, $Bureau)) {
  $Lien = $Shell.CreateShortcut($Raccourci)
  $Lien.TargetPath = $Cible
  $Lien.WorkingDirectory = $Destination
  $Lien.Description = "OrthoAI : segmentation 3D et compte rendu de consultation"
  $Lien.Save()
}

Start-Process $Cible
Write-Host ""
Write-Host "OrthoAI est installée (icône sur le Bureau et dans le menu Démarrer) et vient de s'ouvrir." -ForegroundColor Green
Write-Host "Pour l'épingler : clic droit sur l'icône dans la barre des tâches > Épingler à la barre des tâches."
