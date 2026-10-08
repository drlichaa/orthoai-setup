#!/bin/bash
# Installe whisper.cpp (transcription locale) et ses modèles sur Mac.
# Usage : double-cliquer sur installer-whisper.command
#   --modele small   modèle plus léger pour un Mac peu puissant
set -euo pipefail

MODELE="large-v3-turbo-q5_0"
if [ "${1:-}" = "--modele" ] && [ -n "${2:-}" ]; then MODELE="$2"; fi

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$RACINE/whisper/models"
mkdir -p "$MODELS"

# Homebrew place ses programmes ici (Apple Silicon puis Intel)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1. Programme whisper.cpp (accéléré par la puce graphique du Mac via Metal)
if command -v whisper-server >/dev/null 2>&1; then
  echo "whisper.cpp est déjà installé."
elif command -v brew >/dev/null 2>&1; then
  echo "Installation de whisper.cpp avec Homebrew..."
  brew install whisper-cpp
else
  echo "Homebrew n'est pas installé. Installez-le depuis https://brew.sh puis relancez ce script."
  exit 1
fi
if ! command -v whisper-server >/dev/null 2>&1; then
  echo "whisper-server introuvable après l'installation de whisper-cpp."
  exit 1
fi

telecharger() {
  local url="$1" destination="$2"
  if [ -f "$destination" ]; then
    echo "  $(basename "$destination") déjà présent."
    return
  fi
  echo "  Téléchargement de $(basename "$destination")..."
  curl -L --fail --progress-bar -o "$destination.part" "$url"
  mv "$destination.part" "$destination"
}

# 2. Modèle de transcription (~550 Mo pour large-v3-turbo-q5_0)
telecharger "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODELE.bin" "$MODELS/ggml-$MODELE.bin"

# 3. Détection de voix (évite les phrases inventées pendant les silences)
telecharger "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin" "$MODELS/ggml-silero-v5.1.2.bin"

echo ""
echo "Whisper est installé. Lancez l'application avec Demarrer.command."
