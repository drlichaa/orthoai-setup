# Installe OrthoAI en serveur du cabinet sur ce PC Windows :
# Whisper, application OrthoAI, lancement au démarrage du PC, et publication
# sur le réseau privé Tailscale pour les autres postes.
# Usage : double-cliquer sur installer-serveur.cmd (à relancer sans risque).
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Projet = Split-Path $PSScriptRoot -Parent
Set-Location $Projet

function Etape($Texte) { Write-Host ""; Write-Host "== $Texte" -ForegroundColor Cyan }
function Arret($Texte) { Write-Host ""; Write-Host $Texte -ForegroundColor Red; exit 1 }

Etape "1/5 Vérifications"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Arret "Node.js n'est pas installé : installez la version LTS depuis https://nodejs.org puis relancez ce script."
}
$Tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $Tailscale -and (Test-Path "C:\Program Files\Tailscale\tailscale.exe")) { $Tailscale = "C:\Program Files\Tailscale\tailscale.exe" }
if (-not $Tailscale) {
  Arret "Tailscale n'est pas installé : installez-le depuis https://tailscale.com/download/windows, connectez-vous, puis relancez ce script."
}
Write-Host "Node.js $(node --version) et Tailscale trouvés."

Etape "2/5 Transcription locale (Whisper)"
if (Test-Path (Join-Path $Projet "whisper\models\*.bin")) {
  Write-Host "Whisper déjà installé."
} else {
  & (Join-Path $PSScriptRoot "installer-whisper.ps1")
}

Etape "3/5 Application OrthoAI"
& (Join-Path $PSScriptRoot "creer-application.ps1")

Etape "4/5 Lancement automatique au démarrage du PC"
$Exe = Join-Path $env:LOCALAPPDATA "Programs\OrthoAI\OrthoAI.exe"
$Demarrage = Join-Path ([Environment]::GetFolderPath("Startup")) "OrthoAI.lnk"
$Lien = (New-Object -ComObject WScript.Shell).CreateShortcut($Demarrage)
$Lien.TargetPath = $Exe
$Lien.WorkingDirectory = Split-Path $Exe -Parent
$Lien.Description = "Serveur OrthoAI du cabinet"
$Lien.Save()
Write-Host "OrthoAI démarrera à chaque ouverture de session Windows."

Etape "5/5 Publication sur le réseau privé du cabinet (Tailscale)"
$Etat = & $Tailscale status --json | ConvertFrom-Json
if ($Etat.BackendState -ne "Running") {
  Arret "Tailscale n'est pas connecté : ouvrez Tailscale (icône près de l'horloge), connectez-vous, puis relancez ce script."
}
Write-Host "Si un lien s'affiche ci-dessous, ouvrez-le pour autoriser les certificats HTTPS, puis revenez ici."
& $Tailscale serve --bg 8787
if ($LASTEXITCODE -ne 0) { Arret "La publication a échoué : envoyez les messages ci-dessus à votre assistant." }
$Adresse = "https://" + $Etat.Self.DNSName.TrimEnd(".")

Write-Host ""
Write-Host "Serveur OrthoAI prêt." -ForegroundColor Green
Write-Host ""
Write-Host "Adresse à ouvrir sur les autres postes (avec Tailscale connecté au même compte) :" -ForegroundColor Green
Write-Host "    $Adresse" -ForegroundColor Yellow
Write-Host ""
Write-Host "Important : créez d'abord le mot de passe du coffre dans OrthoAI sur CE PC"
Write-Host "(Compte rendu > Historique), il servira à se connecter depuis les autres postes."
Set-Clipboard -Value $Adresse
Write-Host "(L'adresse est copiée dans le presse-papiers.)"
