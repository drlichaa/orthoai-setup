// Correspondance entre la colonne « Type de traitement » de l'export OrthoFast
// (qui sert de statut dans OrthoFast) et les statuts / types d'OrthoAI.
// La valeur d'origine reste visible dans la fiche (bloc « orthofast »).
// Pour changer une correspondance : modifier cette table puis réimporter.

const CORRESPONDANCES = [
  // [valeur OrthoFast (sans accents, minuscules), statut OrthoAI, type OrthoAI]
  ["a archiver", "À archiver", ""],
  ["devis envoye", "Devis envoyé", ""],
  ["attente (trop tot)", "En attente (trop tôt)", ""],
  ["attente", "En attente (trop tôt)", ""],
  ["jamais vu", "Première consultation", ""],
  ["1ere fois", "Première consultation", ""],
  ["bilan", "Première consultation", ""],
  ["plantt", "Devis envoyé", ""],
  ["sans suite", "À archiver", ""],
  ["transfert", "À archiver", ""],
  ["suspension", "À revoir", ""],
  ["surveillance", "En surveillance", ""],
  ["contention", "En contention", "Contention"],
  ["disjoncteur", "En traitement", "Disjoncteur"],
  ["tt interceptif", "En traitement", "Interception"],
  ["cmu amovible enfant", "En traitement", "Interception"],
  ["oam", "En traitement", "Interception"],
  ["tt gouttieres", "En traitement", "Aligneurs"],
  ["tt metal enfant", "En traitement", "Multi-attaches"],
  ["tt metal adulte", "En traitement", "Multi-attaches"],
  ["tt ceram enfant", "En traitement", "Multi-attaches"],
  ["tt ceram adulte", "En traitement", "Multi-attaches"],
  ["cmu metal enfant", "En traitement", "Multi-attaches"],
  ["pul 2", "En traitement", ""],
  ["pul2", "En traitement", ""],
  ["carriere", "À revoir", ""],
];

function cle(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const TABLE = new Map(CORRESPONDANCES.map(([source, statut, type]) => [cle(source), { statut, type }]));

// Statut et type OrthoAI pour une valeur OrthoFast ; null si la valeur est
// inconnue ou si le statut n'existe pas dans les réglages du cabinet.
export function statutDepuisOrthofast(typeTraitement, statutsDisponibles) {
  const trouve = TABLE.get(cle(typeTraitement));
  if (!trouve) return null;
  const existe = statutsDisponibles.some((s) => s.nom === trouve.statut);
  return existe ? trouve : null;
}
