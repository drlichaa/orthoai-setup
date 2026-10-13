# Met à jour OrthoAI depuis GitHub en conservant la clé (.env), Whisper et
# ses modèles (whisper\) et les dépendances installées.
# Usage : double-cliquer sur mettre-a-jour.cmd
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Projet = Split-Path $PSScriptRoot -Parent
Set-Location $Projet
$Branche = "claude/ortho-consultation-report-app-m3evdn"
$Tmp = Join-Path $env:TEMP ("orthoai-maj-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null

try {
  Write-Host "Téléchargement de la dernière version..."
  $Zip = Join-Path $Tmp "maj.zip"
  Invoke-WebRequest -Uri "https://codeload.github.com/drlichaa/orthoai-setup/zip/refs/heads/$Branche" -OutFile $Zip -UseBasicParsing
  Expand-Archive $Zip -DestinationPath (Join-Path $Tmp "src")
  $Source = (Get-ChildItem (Join-Path $Tmp "src") -Directory | Select-Object -First 1).FullName

  # Par sécurité, ne jamais écraser la clé, Whisper ni les dépendances.
  robocopy $Source $Projet /E /NFL /NDL /NJH /NJS /NP /XD whisper node_modules /XF .env | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "La copie des fichiers a échoué (code $LASTEXITCODE)." }

  Write-Host "Installation des dépendances..."
  & npm.cmd install --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw "L'installation des dépendances a échoué." }
} finally {
  Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
if (Test-Path (Join-Path $env:LOCALAPPDATA "Programs\OrthoAI\OrthoAI.exe")) {
  Write-Host "Mise à jour de l'application OrthoAI..."
  & (Join-Path $PSScriptRoot "creer-application.ps1")
} else {
  Write-Host "Mise à jour terminée."
}
