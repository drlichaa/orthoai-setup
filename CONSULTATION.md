# Compte rendu de première consultation orthodontique

Application qui écoute la consultation et rédige automatiquement un compte rendu
à remettre au patient (motif, diagnostic, plan de traitement et textes des appareils).

La transcription se fait **en local** sur l'ordinateur avec Whisper : l'audio ne quitte jamais le cabinet.

## Installation (Windows 11, une seule fois)

1. Installer **Node.js** (version LTS) : https://nodejs.org
2. Télécharger ce projet dans un dossier (ex. `Documents\orthoai`).
3. Double-cliquer sur **`installer-whisper.cmd`**. Le script télécharge :
   - whisper.cpp, en version accélérée si une carte graphique NVIDIA est détectée ;
   - le modèle de transcription `large-v3-turbo` (~550 Mo) ;
   - le petit modèle de détection de voix.
4. Double-cliquer sur **`Demarrer.cmd`**. Au premier lancement, le fichier `.env` s'ouvre :
   y coller la clé API Anthropic après `ANTHROPIC_API_KEY=`, enregistrer, puis relancer `Demarrer.cmd`.

Options de l'installateur (dans un terminal) :
- `installer-whisper.cmd -Cpu` : force la version processeur (si la version NVIDIA ne démarre pas) ;
- `installer-whisper.cmd -Modele small` : modèle plus léger pour un ordinateur peu puissant
  (supprimer alors `whisper\models\ggml-large-v3-turbo-q5_0.bin`, qui reste prioritaire).

## Utilisation

Double-cliquer sur `Demarrer.cmd` : l'application s'ouvre dans le navigateur (Edge, Chrome ou Firefox).
Fermer la fenêtre noire pour tout arrêter.

1. Saisir le patient (nom/prénom restent sur l'ordinateur : ils sont remplacés par « [patient] » avant l'envoi).
2. **Démarrer** l'enregistrement. L'audio est découpé aux silences (~20–45 s) et transcrit au fur et à mesure.
3. Dicter clairement les constats cliniques ; le reste de la conversation est filtré.
4. **Arrêter**, puis **Générer le compte rendu** : relire, corriger, cocher/décocher les appareils.
5. **Imprimer / PDF**.

Le bouton « Appareils & cabinet » permet de modifier l'en-tête et les textes pré-enregistrés
de chaque appareil (sauvegardés dans le navigateur).

## Fichiers

- `server/index.js` : serveur local (`/api/transcription`, `/api/compte-rendu`)
- `server/whisper.js` : lancement de whisper.cpp et transcription locale
- `server/prompt.js` : consignes de rédaction et schéma du compte rendu
- `src/consultation/` : interface (enregistrement, édition, impression, catalogue)
- `scripts/installer-whisper.ps1`, `scripts/demarrer.js` : installation et lancement

## Confidentialité

- **Audio** : enregistré et transcrit uniquement sur l'ordinateur (Whisper local), jamais envoyé.
- **Texte** : la transcription pseudonymisée est envoyée à l'API Anthropic pour la rédaction du compte rendu.
- L'application ne conserve rien : ni audio ni transcription après la consultation (l'API Anthropic applique sa propre politique de conservation des données).

Avant une utilisation avec de vrais patients : informer le patient et recueillir son accord
pour l'enregistrement, et vérifier la conformité RGPD / hébergement de données de santé (HDS)
avec votre DPO.
