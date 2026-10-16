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

## Photos, radios et empreintes 3D

Onglet **Photos & radios** du dossier : chaque **série** suit un scénario (comme dans OrthoFast).

- **Bilan initial** (12 photos) et **Contrôle qualité** (7 photos) : « Déposer toutes les photos » range
  les photos dans l'ordre de prise de vue et applique les rotations / symétries du scénario ; une photo
  peut aussi être glissée dans sa case et corrigée (⟲ ⟳ ⇅ ⇆). **Imprimer la planche** : A4 paysage avec
  logo, praticien, patient et âge.
- **Radiographies** : panoramique et téléradiographie de profil, avec leur date.
- **Empreintes 3D** : fichiers **.stl** (exportés de 3Shape), visibles en 3D.
- Chaque ajout est noté dans la séance du jour (« Bilan initial : 12 photos »).
- Opérations des scénarios modifiables dans **Appareils & cabinet → Scénarios photos**.

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

**Serveur Windows (installation en une fois)** : installer Node.js (LTS) et Tailscale (connecté),
télécharger ce projet, puis double-cliquer sur **`installer-serveur.cmd`** : Whisper, application,
lancement au démarrage du PC et publication Tailscale sont faits, et l'adresse des postes s'affiche.

Étapes détaillées (ou serveur Mac) :

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

## Gestion du traitement (reprise d'OrthoManage)

- **Devis** (onglet du dossier) : devis conventionnel au format officiel, avec ou sans prise en charge (HN proposé automatiquement à partir de 16 ans à la 1ère consultation). Barème réglable dans Paramètres → Honoraires (semestre interception / bagues métal 980 €, céramique 1080 €, aligneurs 1750 €, contention 750 €). Impression / PDF, envoi par e-mail, « Signé : démarrer » crée les semestres tous les 6 mois avec leurs montants.
- **DEP** : formulaire Cerfa 10518*01 rempli automatiquement (diagnostic en cases à cocher), imprimé sur le fond officiel (`public/dep-page1.jpg`, `dep-page2.jpg`), historique et case « envoyée ».
- **Suivi du traitement** (onglet) : progression, laboratoire (envoyé / reçu / posé), aligneurs avec calendrier modifiable, rappels différés, alerte « non revu depuis X mois », incidents, chronologie.
- **Tâches** et **Laboratoire** (menu) : tâches manuelles partagées par le cabinet + échéances automatiques (facturation, DEP, envoi et renouvellement de DEP, non revus, rappels, appareils en retard), réglables dans Paramètres → Automatisations. Alertes résumées sur le tableau de bord.
- Données : champ `gestion` de chaque dossier et `gestion.taches` du coffre, chiffrés comme le reste.

## Import de l'export OrthoFast

Écran **Patients → Importer l'export OrthoFast** : choisir le cabinet (Le Chesnay ou Herblay), puis le fichier Excel « liste des patients » exporté d'OrthoFast. Le fichier est lu dans l'application, sur l'ordinateur ; seules les données des patients partent vers le serveur du cabinet, qui les enregistre dans le coffre chiffré. Le fichier n'est ni conservé ni envoyé ailleurs.

- Clé de rattachement : cabinet + code patient. Un dossier OrthoAI sans code, de même nom, prénom et date de naissance (dans ce cabinet ou sans cabinet), est rattaché au lieu d'être dupliqué.
- Les champs déjà remplis dans OrthoAI ne sont jamais écrasés ; l'import ne fait que compléter les champs vides (téléphone, e-mail, correspondants, début du traitement…).
- Le dernier état OrthoFast (type de traitement, DEP faite et prochaine, règlements dus) est remplacé à chaque import et s'affiche dans les onglets **Patient** et **Devis** de la fiche.
- Les exports Excel/CSV sont exclus du dépôt (`.gitignore`) : ne jamais les y ajouter.

## Frise du traitement

Créée dès qu'un devis est validé (« Signé : démarrer ») : un segment par semestre (6 mois à partir du début du traitement), puis l'année de contention (C1). Elle s'affiche en haut de la **Fiche clinique** et dans **Devis**.

- Le temps écoulé remplit les segments en bleu (jaune pour la contention) ; un trait rouge marque aujourd'hui.
- Une DEP couvre deux semestres (S1-S2, S3-S4, S5-S6), puis une DEP pour la contention. Dès qu'une DEP est imprimée, un point vert apparaît sur les semestres qu'elle couvre ; un rond orange signale une DEP due. « Préparer une DEP » propose automatiquement la suivante.
- Sous la frise : semestre en cours et date de fin, durée restante du traitement, reste à facturer.
- Tâches : « Faire la DEP des semestres 3 et 4 » au début du groupe, rappel un mois avant.

## Relances

Page **Relances** (menu) : trois listes, filtrées par cabinet.

- **Devis à relancer** : devis non validé depuis plus d'1 mois (ou statut « Devis envoyé » repris d'OrthoFast, à partir de la date « Depuis le »).
- **Patients en attente (trop tôt)** depuis plus d'1 an (date de mise en attente OrthoFast).
- **Patients en traitement non revus** : dernière séance saisie dans OrthoAI il y a plus de 3 mois. Les patients sans aucune séance saisie (suivi tenu dans OrthoFast) sont listés à part.

« Relancé » enregistre la date et une note ; le patient revient au bout du même délai s'il n'a pas donné suite. « Ne plus relancer » l'écarte définitivement. Les délais se règlent en haut de chaque liste.

## Envoi d'e-mails (Gmail du cabinet)

**Réglage (une fois)** : Paramètres → Messagerie. Adresse Gmail du cabinet, nom affiché, **mot de passe d'application** Gmail (compte Google → Sécurité → Validation en deux étapes → Mots de passe des applications ; 16 lettres, pas le mot de passe habituel), signature, lien de prise de RDV de chaque cabinet. La connexion est vérifiée auprès de Gmail avant l'enregistrement. Ces réglages sont rangés dans le coffre chiffré du serveur ; le mot de passe n'est jamais réaffiché ni envoyé aux postes. Ne jamais le copier ailleurs (message, discussion, dépôt).

**Modèles** : objets et messages types classés par catégorie (Devis, Compte rendu, Rendez-vous, Courrier, Autre), modifiables. Champs remplacés : `{prenom}`, `{nom}`, `{praticien}`, `{cabinet}`, `{lienRdv}`, `{date}`.

**Envoyer un devis** : Devis → bouton « E-mail » du devis. Le modèle correspondant au traitement (métal, céramique, gouttières) est proposé, le devis est joint en PDF (`AAAAMMJJ_Code_DevisConventionnel.pdf`), d'autres fichiers peuvent être ajoutés. Après l'envoi, le devis est marqué « envoyé » et l'envoi est noté dans le dossier (date, destinataire, objet, pièces).

**Envoyer un compte rendu ou un courrier** : bouton « E-mail » à côté de « Imprimer / PDF » (compte rendu de consultation), et sur chaque courrier ou ordonnance (consultation et dossier patient). Le document est joint en PDF, avec ses images. Destinataire : l'« E-mail du destinataire » saisi sur le courrier (confrère, modèle « Courrier pour un confrère »), sinon l'adresse du patient (modèle « Courrier remis au patient »). La consultation est enregistrée avant l'envoi pour que l'envoi soit noté dans le dossier.

Le PDF est créé par l'application du cabinet (Electron) ; les tests automatiques utilisent un faux serveur de messagerie local (`ORTHOAI_SMTP_TEST`), jamais Gmail.

## Parcours de traitement (onglet du dossier)

Onglet « Parcours de traitement » (après Patient et Fiche clinique), sous la frise, étapes cochables et datées :

1. **Consultation** : date de la 1ère consultation, radios (panoramique, téléradio de profil), devis remis.
2. **Bilan** : date du bilan, 12 photos, empreinte 3Shape, DEP « Début de traitement » (cochée dès qu'elle est imprimée), devis signé (bouton « Devis signé »), consentement éclairé signé (enfant si moins de 16 ans à la 1ère consultation, adulte sinon ; imprimable ou envoyé par e-mail), bilan facturé (TO5 + TO15 : 200 €, 350 € pour les gouttières).
3. **Pose** : RDV de pose, message de facturation (copier ou e-mail). « Pose effectuée » démarre le 1er semestre ce jour-là (frise). **Bloquée** tant que DEP (si prise en charge), devis signé et consentement ne sont pas faits ; « Passer outre » exige un motif, enregistré dans le dossier.
4. **Suivi** : prochain RDV de facturation et message de facturation.
5. **Fin de traitement** : RDV de dépose, message de dépose, « Dépose effectuée » (statut En contention, année de contention C1). Puis : contention 750 € (« TO75 » si prise en charge, « HN (TO75) » pour un adulte, facturé à la fin du dernier semestre), fils collés haut et bas, empreinte de la gouttière de nuit et fiche « Port de la gouttière » (imprimable), contrôles à 1, 4, 8 et 12 mois, carte Vitale (TO75) à la dernière visite de l'année de contention.

Alertes : patient qui approche de 16 ans sans pose (prise en charge), DEP de plus de 5 mois sans pose. Hors prise en charge, la DEP n'est pas exigée. Patients déjà en traitement (import OrthoFast, semestres existants) : pose considérée comme faite, aucun blocage rétroactif.

Tâches automatiques : facturer le bilan ; message de facturation 3 jours avant la pose et avant chaque semestre (ou le prochain RDV de facturation) ; message de dépose 3 jours avant ; encaisser la contention ; carte Vitale ; contrôles de contention ; « Rappeler le patient » après 12 semaines sans séance (réglable dans Suivi du traitement). Messages types « Facturation » et « Dépose » dans Paramètres → Messagerie.

## Questionnaire médical WeClever (PDF)

Patients → « Questionnaire WeClever (PDF) » (crée ou complète un dossier), ou fiche → onglet Patient → « Importer le questionnaire WeClever (PDF) ».

- **100 % local** : le PDF est lu dans l'application avec pdf.js (texte et positions) ; les cases cochées sont mesurées sur le rendu de la page (part de pixels sombres à gauche de chaque option). Aucun service en ligne, pas d'API Anthropic.
- **Écran de vérification obligatoire** : PDF à gauche, champs proposés à droite, réponses douteuses en orange. Rien n'est enregistré avant « Valider ». Un champ déjà rempli n'est remplacé que si « Remplacer » est coché.
- Dossier existant (mêmes nom, prénom, date de naissance) : proposé pour être complété ; sinon création (cabinet à choisir).
- Correspondance : identité et contacts, « Adressé par » (prise de RDV), n° de sécurité sociale, adresse, mutuelle et profession (onglet Devis → assuré, utilisés pour la DEP), questionnaire (motifs, antécédents, ORL, accords, engagements, signature, questions propres à la version adulte), alerte du dossier (allergie, médicaments, problème de santé, sauf « RAS »/« non », ajoutés à l'alerte existante).
- Version adulte (« Ortho adulte ») : nom de naissance, profession, grossesse (avec le nombre de mois, ajoutée à l'alerte), motif en texte libre, antécédent orthodontique, antécédents parodontaux, tabac ; pas de questions propres à l'enfant (déglutition, élocution, succion, ORL, radiographies, départ seul).
- Refus d'enregistrement de la consultation : avertissement à côté du bouton « Démarrer » de la consultation de ce patient.
- Le PDF est rangé chiffré dans le dossier (« Ouvrir le PDF » dans l'onglet Patient).
- Tests : faux questionnaires générés (patients inventés), jamais de vrais.

## Fiches de recommandations (pose d'appareil)

Fiches illustrées du cabinet (« On vient de te poser… ») : plaque, bagues (métal, céramique), disjoncteur, ELN, PUL, Carrière, gouttières Spark. À la validation de « Pose effectuée » (Parcours) ou en cochant « Posé » dans Suivi → Laboratoire, la fenêtre « Fiche de recommandations » propose la fiche de l'appareil posé (aperçu). « Envoyer par e-mail » joint la fiche telle quelle (PNG ou PDF) ; « Imprimer » l'imprime en pleine page A4 paysage. Un appareil sans fiche illustrée utilise le texte du catalogue (PDF généré).

Paramètres → catalogue des appareils : pour chaque appareil, aperçu de la fiche, « Remplacer (PNG, JPG ou PDF) » par l'original du cabinet, ou « Revenir à la fiche fournie ». Les fiches remplacées sont rangées à côté des réglages du serveur (dossier fiches-patients) ; ce sont des documents du cabinet, sans donnée patient.

## Onglets du dossier patient

Dans l'ordre : Patient (informations administratives, questionnaire médical), Fiche clinique, Parcours de traitement (frise et étapes), Photos & radios, Devis (devis, semestres, DEP), Suivi du traitement. Le dossier s'ouvre sur la fiche clinique.

## Planning (Le Chesnay)

Menu « Planning » : semaine du cabinet du Chesnay sur deux fauteuils — **fauteuil 1 · cabinet ortho** (praticienne : poses, suivis, contention, urgences, dépose) et **fauteuil 2 · cabinet blanc** (assistante : premières consultations, bilans, contrôle qualité, radios). Planning interne, saisi à la main (pas de synchronisation possible avec Doctolib).

- Planning type en fond : fauteuil 1 — plages roses (RDV longs) et bleues (RDV courts) : lundi 10h30-12h, 12h-13h, 14h-16h, 16h-19h ; mercredi 9h30-13h, 14h-19h ; vendredi 9h30-15h. Fauteuil 2 — créneaux de 30 min de 1ère consultation le lundi, le mercredi et le vendredi.
- Motifs, couleurs et durées repris de Doctolib (modifiables : Paramètres → Planning).
- Clic sur un créneau : nouveau RDV (motif proposé selon la plage), patient choisi parmi les dossiers ou nouveau patient (nom, téléphone). Chevauchement et hors plage signalés. Statut : prévu, venu, absent, annulé.
- Un RDV de pose, de dépose ou « FACTURATION + suivi » relié à un dossier renseigne la date prévue dans son parcours (messages 3 jours avant).
- Les rendez-vous sont rangés dans le coffre chiffré.
