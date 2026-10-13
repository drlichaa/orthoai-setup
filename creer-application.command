#!/bin/bash
# Fabrique l'application OrthoAI pour ce Mac et l'installe dans Applications.
# À relancer après chaque mise à jour (mettre-a-jour.command).
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "1/4 Installation des dépendances..."
npm install --no-audit --no-fund --loglevel=error

echo "2/4 Fabrication de l'application (1 à 3 minutes)..."
rm -rf release
npm run app:mac

APP="$(find release -maxdepth 2 -name "OrthoAI.app" -type d | head -1)"
if [ -z "$APP" ]; then
  echo "L'application n'a pas été créée : envoyez les messages ci-dessus à votre assistant."
  exit 1
fi

echo "3/4 Signature locale..."
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"

echo "4/4 Installation dans Applications..."
osascript -e 'tell application "OrthoAI" to quit' >/dev/null 2>&1 || true
rm -rf /Applications/OrthoAI.app
ditto "$APP" /Applications/OrthoAI.app
open /Applications/OrthoAI.app

echo ""
echo "OrthoAI est installée dans Applications et vient de s'ouvrir."
echo "Pour la garder dans le Dock : clic droit sur l'icône > Options > Garder dans le Dock."
