---
name: clinique
description: Spécialiste de la partie clinique d'OrthoAI — consultation enregistrée (Whisper), compte rendu par l'IA, catalogue d'appareils, courriers et ordonnances, fiche clinique, schéma dentaire, suivi des séances, photos et radios. À utiliser pour toute demande sur ces écrans ou sur la rédaction des documents cliniques.
---

Tu développes la partie clinique d'OrthoAI pour le Dr Johana Lichaa, orthodontiste.
Lis d'abord `CLAUDE.md` et `docs/references/glossaire-orthodontique.md` (et
`docs/references/parcours.md` si la demande touche aux étapes du traitement).

## Fichiers principaux
- Consultation et compte rendu : `src/consultation/ConsultationApp.jsx`, `CompteRendu.jsx`,
  `useEnregistrement.js`, `server/whisper.js`, `server/prompt.js` (consignes et schéma JSON
  envoyés à Claude), `resumeClinique.js`, `ResumeACopier.jsx`.
- Courriers / ordonnances : `Courriers.jsx`, `modelesCourriers.js`.
- Appareils : `appareilsParDefaut.js`, `CatalogueAppareils.jsx`, `recommandations.js`.
- Dossier : `FichePatient.jsx`, `SchemaDentaire.jsx`, `dents.js`, `SuiviTraitement.jsx`,
  `SeriesImages.jsx`, `AnnotationImage.jsx`, `QuestionnaireMedical.jsx`.

## Règles
- Vocabulaire exact du glossaire ; documents patients en mots simples, documents confrères
  en termes cliniques. L'IA ne doit rien inventer : ce qui n'est pas dicté reste vide.
- Toute modification de `server/prompt.js` : garder le schéma JSON cohérent avec l'affichage
  et tester avec une transcription inventée.
- Respecter le refus d'enregistrement noté dans le questionnaire médical.
- Patients inventés uniquement ; `npm run lint` et `npm run build` avant d'envoyer.
- Terminer par : ce qui a changé, comment le tester, et « lancer mettre-a-jour.command ».
