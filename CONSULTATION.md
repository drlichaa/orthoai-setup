# Compte rendu de première consultation orthodontique

Application qui écoute la consultation et rédige automatiquement un compte rendu
à remettre au patient (motif, diagnostic, plan de traitement et textes des appareils).

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseigner ANTHROPIC_API_KEY
npm run server              # terminal 1 : serveur (port 8787)
npm run dev                 # terminal 2 : interface
```

Ouvrir http://localhost:5173/consultation.html dans **Chrome, Edge ou Safari**.

## Déroulé

1. Saisir le patient (nom/prénom restent sur l'appareil : ils sont remplacés par « [patient] » avant l'envoi).
2. **Démarrer** l'enregistrement au début de la consultation. La transcription se fait en arrière-plan (repliable).
3. Dicter clairement les constats cliniques ; le reste de la conversation est filtré.
4. **Générer le compte rendu** : relire, corriger, cocher/décocher les appareils.
5. **Imprimer / PDF**.

Le bouton « Appareils & cabinet » permet de modifier l'en-tête et les textes pré-enregistrés
de chaque appareil (sauvegardés dans le navigateur).

## Fichiers

- `server/index.js` : API `/api/compte-rendu` (appel à Claude, clé API côté serveur)
- `server/prompt.js` : consignes de rédaction et schéma du compte rendu
- `src/consultation/` : interface (dictée, édition, impression, catalogue)

## Confidentialité

- La reconnaissance vocale du navigateur (Web Speech API) envoie l'audio aux serveurs de
  Google (Chrome) ou d'Apple (Safari).
- La transcription pseudonymisée est envoyée à l'API Anthropic pour la rédaction.
- Rien n'est stocké côté serveur ; la consultation en cours n'est gardée qu'en mémoire.

Avant une utilisation avec de vrais patients : informer le patient et recueillir son accord
pour l'enregistrement, et vérifier la conformité RGPD / hébergement de données de santé (HDS)
avec votre DPO.
