# OrthoAI — règles communes

Logiciel interne du cabinet d'orthodontie du **Dr Johana Lichaa** (Le Chesnay, 44 Ter boulevard
Saint-Antoine ; et Herblay). Elle n'est **pas développeuse** : réponses en **français simple**,
étape par étape, sans jargon informatique ; dire concrètement quoi cliquer et comment tester.

## Fonctionnement
- Application de bureau Electron (`electron/`) + serveur Node (`server/`) + pages React/Vite :
  `consultation.html` (application principale : #tableau, #consultation, #patients…),
  `mobile.html` (iPhone), `index.html` (segmentation 3D), `accueil.html`.
- Le **Mac de la praticienne est le serveur** : données dans `~/.orthoai/` (coffre chiffré
  `historique.chiffre`, `medias/`, `config.json`). Les autres postes passent par **Tailscale**
  (adresse en `.ts.net`) via une appli Chrome ; rien n'est installé sur eux.
- Mise à jour du serveur : `mettre-a-jour.command` (Mac) / `mettre-a-jour.cmd` (Windows), puis
  quitter et rouvrir OrthoAI. Les postes clients rechargent la page (F5).
- Transcription locale (whisper.cpp, `server/whisper.js`) ; compte rendu par l'API Claude
  (`server/prompt.js`), clé saisie dans l'application, jamais affichée ni écrite ailleurs.

## Règles non négociables
- **Aucune vraie donnée patient** dans le dépôt, les tests ou les messages : patients inventés.
- **Rien n'est ouvert sur Internet** : accès limité au réseau Tailscale (`server/acces.js`).
- Les données patient restent dans le coffre chiffré ; rien en clair sur les postes
  (pas de localStorage pour des données patient).
- Ne jamais afficher, copier ou committer une clé API ou un mot de passe.
- Pas de `window.prompt` (ne s'affiche pas dans Electron) : utiliser `src/consultation/demander.js`.
- Avant d'envoyer : `npm run lint` et `npm run build` sans erreur ; style existant
  (Prettier, largeur 120) ; ne pas reformater des fichiers entiers.
- Une modification = un commit clair en français. Toujours récupérer la dernière version
  avant de travailler (une autre session peut avoir modifié les mêmes fichiers).

## Références métier (à lire selon la tâche)
- `docs/references/glossaire-orthodontique.md` : vocabulaire, notations, corrections Whisper.
- `docs/references/facturation.md` : cotations, barème, sécu / HN / CMU, DEP, semestres.
- `docs/references/parcours.md` : étapes du parcours de soins et ce qu'OrthoAI vérifie.

## Agents (`.claude/agents/`)
`clinique`, `assistantes-secretariat`, `mobile-praticien`. Pour le reste, travailler sans agent.
