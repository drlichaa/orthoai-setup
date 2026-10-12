#!/bin/bash
# Met à jour l'application depuis GitHub en conservant la clé (.env),
# Whisper et ses modèles (whisper/) et les dépendances installées.
set -euo pipefail
cd "$(dirname "$0")"
BRANCHE="claude/ortho-consultation-report-app-m3evdn"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Téléchargement de la dernière version..."
curl -fsSL "https://codeload.github.com/drlichaa/orthoai-setup/zip/refs/heads/$BRANCHE" -o "$TMP/maj.zip"
unzip -q "$TMP/maj.zip" -d "$TMP/src"
SOURCE="$(find "$TMP/src" -mindepth 1 -maxdepth 1 -type d | head -1)"
# Par sécurité, ne jamais écraser la clé, Whisper ni les dépendances
rm -rf "$SOURCE/.env" "$SOURCE/whisper" "$SOURCE/node_modules"
cp -R "$SOURCE"/. ./

echo "Installation des dépendances..."
npm install --no-audit --no-fund --loglevel=error
echo ""
echo "Mise à jour terminée. Relancez l'application avec Demarrer.command."
