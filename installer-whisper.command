#!/bin/bash
cd "$(dirname "$0")"
echo "Installation de la transcription locale (Whisper)..."
bash scripts/installer-whisper.sh "$@"
echo ""
read -n 1 -s -r -p "Appuyez sur une touche pour fermer."
