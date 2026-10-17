# Parcours de soins du cabinet

Implémenté dans `src/consultation/Parcours.jsx` et `etatParcours` (`src/consultation/gestion.js`).

1. **1ʳᵉ consultation** : examen, panoramique, téléradiographie si besoin, compte rendu
   (enregistrement avec accord du patient), devis envoyé.
2. **Bilan** : 12 photos + empreintes optiques (3Shape), analyse des radios ; signature du
   devis, du consentement éclairé et de la DEP (enfant pris en charge).
3. **Pose** : **bloquée** si manquent devis signé, consentement signé ou DEP « Début de
   traitement » (enfant sécu). « Passer outre » possible avec un motif enregistré.
   Alerte si le patient a bientôt 16 ans sans pose (fin de prise en charge).
   La pose démarre le 1er semestre et la frise ; fiches de recommandations à remettre.
4. **Suivi** toutes les 6 à 8 semaines ; tâche « rappeler le patient » si non revu depuis
   12 semaines (réglable).
5. **Dépose et contention** : passage « En contention », facturation de la contention,
   contrôles de contention à 1, 4, 8 et 12 mois.

## Relances (page Relances)
Devis non signé après 1 mois, patient en attente revu après 12 mois, patient en traitement
non revu après 12 semaines (délais réglables).

## Statuts
Première consultation, Jamais vu, Devis envoyé, Sans suite (devis refusé), En attente (trop
tôt), En cours, En traitement, En surveillance, En contention, À revoir, Terminé, À archiver.
