#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Téléchargez la version LTS sur https://nodejs.org puis relancez."
  read -n 1 -s -r -p "Appuyez sur une touche pour fermer."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Première utilisation : installation des dépendances..."
  npm install
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Renseignez votre clé API Anthropic dans le fichier .env qui va s'ouvrir, enregistrez, puis relancez."
  open -e .env
  exit 0
fi
node scripts/demarrer.js
