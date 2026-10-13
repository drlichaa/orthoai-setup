# Compte rendu de première consultation orthodontique

Application qui écoute la consultation et rédige automatiquement un compte rendu
à remettre au patient (motif, diagnostic, plan de traitement et textes des appareils).

La transcription se fait **en local** sur l'ordinateur avec Whisper : l'audio ne quitte jamais le cabinet.

## Application Mac OrthoAI (recommandé)

Une application à double-cliquer qui regroupe la segmentation 3D et le compte rendu,
dans sa propre fenêtre : plus besoin de Terminal ni de navigateur.

Prérequis : Node.js, Homebrew et Whisper installés (voir « Installation sur Mac » ci-dessous).

```
cd ~/Documents/orthoai
bash creer-application.command
```

L'application est installée dans **Applications** et s'ouvre. La clé API se saisit dans
**Compte rendu → Appareils & cabinet → Clé API Anthropic** ; elle est vérifiée puis
enregistrée sur l'ordinateur (`~/.orthoai/config.json`, lisible par vous seul).

Raccourcis : ⌘1 accueil · ⌘2 segmentation · ⌘3 compte rendu.

## Installation sur Windows 11 (une seule fois)

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

## Installation sur Mac (une seule fois)

1. Installer **Node.js** (version LTS) : https://nodejs.org
2. Installer **Homebrew** : https://brew.sh (copier la commande indiquée dans le Terminal).
3. Télécharger ce projet dans un dossier.
4. Double-cliquer sur **`installer-whisper.command`** : installe whisper.cpp (accéléré par la puce
   du Mac) et télécharge le modèle de transcription (~550 Mo).
5. Double-cliquer sur **`Demarrer.command`**. Au premier lancement, le fichier `.env` s'ouvre :
   y coller la clé API Anthropic, enregistrer, puis relancer `Demarrer.command`.

Si macOS refuse d'ouvrir un fichier `.command` (« développeur non identifié ») : clic droit → **Ouvrir**,
puis confirmer. Si le double-clic ne fait rien, ouvrir le Terminal dans le dossier et taper
`bash Demarrer.command`.

Un Mac Apple Silicon (M1 ou plus récent) transcrit très rapidement. Sur un Mac Intel, préférer
le modèle léger : `bash scripts/installer-whisper.sh --modele small`.

## Utilisation

Double-cliquer sur `Demarrer.cmd` (Windows) ou `Demarrer.command` (Mac) : l'application s'ouvre dans
le navigateur (Edge, Chrome, Firefox ou Safari). Fermer la fenêtre du terminal pour tout arrêter.

1. Saisir le patient (nom/prénom restent sur l'ordinateur : ils sont remplacés par « [patient] » avant l'envoi).
2. **Démarrer** l'enregistrement. L'audio est découpé aux silences (~20–45 s) et transcrit au fur et à mesure.
3. Dicter clairement les constats cliniques ; le reste de la conversation est filtré.
4. **Arrêter**, puis **Générer le compte rendu** : relire, corriger, cocher/décocher les appareils.
5. **Imprimer / PDF**.

Le bouton « Appareils & cabinet » permet de modifier l'en-tête et les textes pré-enregistrés
de chaque appareil (sauvegardés dans le navigateur).

## Mettre à jour l'application (Mac)

Dans le Terminal :
```
cd ~/Documents/orthoai
bash mettre-a-jour.command
```
La clé, Whisper et ses modèles sont conservés. Si l'application OrthoAI est installée,
elle est automatiquement refabriquée avec la nouvelle version.

## Fichiers

- `server/index.js` : serveur local (`/api/transcription`, `/api/compte-rendu`)
- `server/whisper.js` : lancement de whisper.cpp et transcription locale
- `server/prompt.js` : consignes de rédaction et schéma du compte rendu
- `src/consultation/` : interface (enregistrement, édition, impression, catalogue)
- `scripts/installer-whisper.ps1` (Windows), `scripts/installer-whisper.sh` (Mac), `scripts/demarrer.js` : installation et lancement

## Confidentialité

- **Audio** : enregistré et transcrit uniquement sur l'ordinateur (Whisper local), jamais envoyé.
- **Texte** : la transcription pseudonymisée est envoyée à l'API Anthropic pour la rédaction du compte rendu.
- L'application ne conserve rien : ni audio ni transcription après la consultation (l'API Anthropic applique sa propre politique de conservation des données).

Avant une utilisation avec de vrais patients : informer le patient et recueillir son accord
pour l'enregistrement, et vérifier la conformité RGPD / hébergement de données de santé (HDS)
avec votre DPO.
