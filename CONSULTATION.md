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

Raccourcis : ⌘1 accueil · ⌘2 segmentation · ⌘3 compte rendu · ⌘4 patients.

## Application Windows OrthoAI (recommandé)

Même application, pour Windows 11. Prérequis : Node.js et Whisper installés
(voir « Installation sur Windows 11 » ci-dessous, étapes 1 à 3).

Double-cliquer sur **`creer-application.cmd`** : l'application est fabriquée (1 à 3 minutes),
installée, et une icône **OrthoAI** est ajoutée sur le Bureau et dans le menu Démarrer.
La clé API se saisit dans l'application, comme sur Mac (`%USERPROFILE%\.orthoai\config.json`).

Raccourcis : Ctrl+1 accueil · Ctrl+2 segmentation · Ctrl+3 compte rendu · Ctrl+4 patients.

## Dossiers patients

Le bouton **Patients** (ou ⌘4) ouvre les dossiers : recherche, filtres par type de traitement, statuts en couleur.
Chaque dossier regroupe l'identité, le diagnostic, le plan de traitement, les comptes rendus de consultation,
le **suivi des séances** (« ce que j'ai fait aujourd'hui / ce que je ferai la prochaine fois »), les commentaires,
les **photos et radios**. Les modifications s'enregistrent automatiquement.

- Enregistrer un compte rendu le range dans le dossier du patient (même nom, prénom et date de naissance),
  ou crée le dossier, avec le diagnostic et le plan pré-remplis.
- **Nouvelle consultation** depuis un dossier démarre une consultation déjà rattachée au patient.
- Types de traitement et statuts se personnalisent dans **Types & statuts**.
- Tout est dans le même coffre chiffré que l'historique, avec le même mot de passe, photos et radios comprises,
  et reste sur cet ordinateur.

## Courriers aux confrères

Quand la consultation évoque un adressage, le compte rendu propose le courrier correspondant
(rubrique **4. Courriers aux confrères**), rédigé de confrère à confrère :

- **Chirurgien-dentiste** : soins à réaliser avant le traitement, extractions à prévoir ;
- **Orthophoniste** : déglutition atypique, langue mal positionnée (pas au palais). C'est une
  **ordonnance** (« Bilan orthophonique + 12 séances de rééducation de la déglutition ») et non une lettre ;
- **Parodontiste** : parodontite, problème de gencives ;
- **ORL** : ventilation buccale, ronflements, pauses respiratoires, suspicion d'apnées du sommeil.

Courriers et ordonnances sont imprimés sur le papier à en-tête du cabinet : logo, coordonnées, n° ADELI/RPPS,
ville et date, âge du patient, signature et pied de page, à renseigner une fois dans **Appareils & cabinet**.
Les lettres se terminent par un résumé en tirets du diagnostic et du plan de traitement, repris du
compte rendu corrigé (case à décocher pour le retirer). Chaque courrier est modifiable et s'imprime seul (**Imprimer ce courrier**). Le nom et l'adresse du
destinataire se saisissent dans l'application et ne sont jamais envoyés. Un courrier non proposé
s'ajoute avec les boutons **+ Dentiste**, **+ Orthophoniste**… Les courriers sont enregistrés dans
l'historique avec le compte rendu.

## Accès depuis les autres ordinateurs du cabinet

Un ordinateur fait **serveur** (OrthoAI installé et ouvert) ; les autres postes ouvrent OrthoAI
dans leur navigateur. Les dossiers, l'historique et les réglages du cabinet (en-tête, logo, signature,
appareils) sont alors les mêmes partout. La liaison passe par **Tailscale**, un réseau privé chiffré :
les données ne quittent pas le cabinet et aucun site n'est publié sur internet.

1. Sur le serveur et sur chaque poste : installer **Tailscale** (https://tailscale.com/download)
   et se connecter avec le **même compte**.
2. Sur le serveur, une seule fois, dans le Terminal :
   `tailscale serve --bg 8787` (adresse affichée : `https://<nom-du-serveur>.<réseau>.ts.net`).
3. Sur chaque poste : ouvrir cette adresse dans Edge ou Chrome, puis se connecter avec le
   **mot de passe du coffre**. Dans Edge : menu ⋯ → Applications → « Installer ce site en tant
   qu'application » pour avoir une icône OrthoAI sur le bureau.

Le serveur doit rester allumé : OrthoAI continue de tourner quand on ferme sa fenêtre
(pour l'arrêter : menu OrthoAI → Quitter) et empêche la mise en veille.

## Historique des comptes rendus

Le bouton **Historique** retrouve les comptes rendus déjà rédigés (recherche par nom, prénom ou date),
pour les relire, les modifier ou les réimprimer.

- Un compte rendu s'ajoute avec **Enregistrer dans l'historique**, ou automatiquement à l'impression
  lorsque l'historique est déverrouillé.
- L'historique est **propre à chaque ordinateur** et protégé par un mot de passe choisi au premier
  enregistrement. Il est chiffré (AES-256) dans `~/.orthoai/historique.chiffre` et se verrouille seul
  après 30 minutes d'inactivité ou à la fermeture de l'application.
- **Mot de passe oublié = historique perdu** : il n'existe aucun moyen de le récupérer.
  Le seul recours est « Effacer l'historique et recommencer ».
- La transcription n'est pas conservée : seuls le patient, les notes et le compte rendu le sont,
  avec le texte des appareils tel qu'imprimé.

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

## Mettre à jour l'application

**Windows** : double-cliquer sur **`mettre-a-jour.cmd`**.

**Mac** :

Dans le Terminal :
```
cd ~/Documents/orthoai
bash mettre-a-jour.command
```
La clé, Whisper, ses modèles et l'historique sont conservés. Si l'application OrthoAI est installée,
elle est automatiquement refabriquée avec la nouvelle version.

## Fichiers

- `server/index.js` : serveur local (`/api/transcription`, `/api/compte-rendu`)
- `server/whisper.js` : lancement de whisper.cpp et transcription locale
- `server/prompt.js` : consignes de rédaction et schéma du compte rendu
- `server/historique.js` : historique chiffré des comptes rendus
- `electron/` : application de bureau ; `creer-application.command` (Mac), `creer-application.cmd` (Windows)
- `src/consultation/` : interface (enregistrement, édition, impression, catalogue)
- `scripts/installer-whisper.ps1` (Windows), `scripts/installer-whisper.sh` (Mac), `scripts/demarrer.js` : installation et lancement

## Confidentialité

- **Audio** : enregistré et transcrit uniquement sur l'ordinateur (Whisper local), jamais envoyé.
- **Texte** : la transcription pseudonymisée est envoyée à l'API Anthropic pour la rédaction du compte rendu.
- **Conservation** : ni audio ni transcription après la consultation. Les comptes rendus enregistrés dans
  l'historique restent sur l'ordinateur, chiffrés par votre mot de passe (l'API Anthropic applique sa propre
  politique de conservation des données).

Avant une utilisation avec de vrais patients : informer le patient et recueillir son accord
pour l'enregistrement, et vérifier la conformité RGPD / hébergement de données de santé (HDS)
avec votre DPO.
