# Installe whisper.cpp (transcription locale) et ses modèles dans le dossier whisper\
# Usage : double-cliquer sur installer-whisper.cmd
#   -Cpu           force la version processeur (sans carte graphique NVIDIA)
#   -Modele small  modèle plus léger pour un ordinateur peu puissant
param(
  [switch]$Cpu,
  [string]$Modele = "large-v3-turbo-q5_0"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Version = "b5454"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Racine = Join-Path (Split-Path $PSScriptRoot -Parent) "whisper"
$Bin = Join-Path $Racine "bin"
$Models = Join-Path $Racine "models"
New-Item -ItemType Directory -Force -Path $Bin, $Models | Out-Null

function Telecharger($Url, $Destination) {
  Write-Host "  Téléchargement de $(Split-Path $Destination -Leaf)..."
  try {
    Start-BitsTransfer -Source $Url -Destination $Destination -DisplayName "Whisper" -Description $Url
  } catch {
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  }
}

# 1. Programme whisper.cpp
$Nvidia = (-not $Cpu) -and [bool](Get-Command nvidia-smi -ErrorAction SilentlyContinue)
if ($Nvidia) {
  # Noms possibles selon les publications de whisper.cpp.
  $Archives = @("whisper-bin-win-cuda-12.4.0-x64.zip", "whisper-cublas-12.4.0-bin-x64.zip")
  Write-Host "Carte graphique NVIDIA détectée : version accélérée (CUDA)."
} else {
  $Archives = @("whisper-blas-bin-x64.zip", "whisper-bin-x64.zip")
  Write-Host "Version processeur (pas de carte NVIDIA détectée)."
}

# whisper.cpp publie ses programmes Windows dans des publications « bNNNN »
# (les versions « v1.x » n'en contiennent plus) : on prend la plus récente
# qui fournit l'archive voulue, sinon une publication connue.
function TrouverArchive($Noms) {
  try {
    $Publications = Invoke-RestMethod "https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=20" -UseBasicParsing
    foreach ($Publication in $Publications) {
      foreach ($Nom in $Noms) {
        $Fichier = $Publication.assets | Where-Object { $_.name -eq $Nom } | Select-Object -First 1
        if ($Fichier) { return @{ Nom = $Nom; Url = $Fichier.browser_download_url } }
      }
    }
  } catch {
    Write-Host "  Liste des publications indisponible, utilisation d'une version connue."
  }
  return @{ Nom = $Noms[0]; Url = "https://github.com/ggml-org/whisper.cpp/releases/download/$Version/$($Noms[0])" }
}

$Archive = TrouverArchive $Archives
$Zip = Join-Path $env:TEMP $Archive.Nom
Telecharger $Archive.Url $Zip
Remove-Item -Recurse -Force (Join-Path $Bin "*") -ErrorAction SilentlyContinue
Expand-Archive -Path $Zip -DestinationPath $Bin -Force
Remove-Item $Zip
$Exe = Get-ChildItem -Path $Bin -Recurse -Filter "whisper-server.exe" | Select-Object -First 1
if (-not $Exe) { throw "whisper-server.exe introuvable dans l'archive $($Archive.Nom)." }

# 2. Modèle de transcription (~550 Mo pour large-v3-turbo-q5_0)
$FichierModele = Join-Path $Models "ggml-$Modele.bin"
if (-not (Test-Path $FichierModele)) {
  Telecharger "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$Modele.bin" $FichierModele
} else {
  Write-Host "  Modèle $Modele déjà présent."
}

# 3. Détection de voix (évite les phrases inventées pendant les silences)
$FichierVad = Join-Path $Models "ggml-silero-v5.1.2.bin"
if (-not (Test-Path $FichierVad)) {
  Telecharger "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin" $FichierVad
}

# 4. Vérification : le programme démarre-t-il ?
# Whisper écrit des messages d'information sur la sortie d'erreur : Windows
# PowerShell les prendrait pour des erreurs, seul le code de sortie compte ici.
$Preference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $Exe.FullName --help 2>&1 | Out-Null
$CodeSortie = $LASTEXITCODE
$ErrorActionPreference = $Preference
if ($CodeSortie -ne 0 -and $Nvidia) {
  Write-Warning "La version CUDA ne démarre pas (pilote NVIDIA trop ancien ?). Relancez avec : installer-whisper.cmd -Cpu"
}

Write-Host ""
Write-Host "Whisper est installé." -ForegroundColor Green
