# Facturation — règles du cabinet

Source de vérité dans le code : `BAREME_PAR_DEFAUT` (`src/consultation/gestion.js`), modifiable
dans Paramètres. Ce résumé sert à comprendre ; en cas d'écart, le code et la praticienne priment.

## Barème par défaut
- Semestre : interception 980 €, métallique 980 €, céramique 1 080 €, aligneurs 1 750 €.
- Contention : 750 € (cotation TO75).
- Bilan orthodontique (jour du bilan) : TO5 + TO15 — standard 50 € + 150 € ; aligneurs 150 € + 200 €.
- Surveillance : 100 € (TO10).
- Devis valable 6 mois.

## Cotations Assurance maladie
TO5 (base 10,75 €), TO15 (32,25 €), TO90 = semestre de traitement actif (193,50 €),
TO75 = année de contention (161,25 €), TO10 = surveillance (21,50 €).

## Prise en charge
- Enfant : prise en charge sécu si le traitement **commence avant 16 ans** ; sinon HN
  (hors nomenclature). Adulte : HN.
- **CMU** (Complémentaire santé solidaire) : case « CMU » sur le dossier ; le type de
  traitement reste l'appareil. Import OrthoFast : valeur commençant par « CMU » → case cochée.
- **DEP** (demande d'entente préalable, Cerfa) obligatoire pour les enfants pris en charge :
  DEP « Début de traitement » avant la pose, puis une DEP par groupe de 2 semestres, puis
  contention. Point vert sur la frise quand la DEP est imprimée.

## Semestres
- Démarrent à la **pose** (bouton « Pose effectuée »). 6 semestres par défaut, ajustables.
- Message de facturation 3 jours avant chaque échéance.
- Contention : enfant sécu → carte Vitale (TO75) à la fin de l'année de contention ;
  adulte → HN (TO75) facturé à la fin du dernier semestre.
