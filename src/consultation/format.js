// Mise en forme partagée par les documents imprimés.

export function formaterDate(iso) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export function nomPatient(patient) {
  return [patient.prenom, patient.nom.toUpperCase()].filter(Boolean).join(" ");
}

// « 20 juin 2025 »
export function dateLongue(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Âge à la date de consultation : « 41 ans et 2 mois », « 8 mois ».
export function age(naissance, date) {
  if (!naissance || !date) return "";
  const [an, mn, jn] = naissance.split("-").map(Number);
  const [ac, mc, jc] = date.split("-").map(Number);
  let mois = (ac - an) * 12 + (mc - mn) - (jc < jn ? 1 : 0);
  if (mois < 0) return "";
  const ans = Math.floor(mois / 12);
  mois %= 12;
  const texteMois = mois ? `${mois} mois` : "";
  if (!ans) return texteMois;
  const texteAns = `${ans} an${ans > 1 ? "s" : ""}`;
  return texteMois ? `${texteAns} et ${texteMois}` : texteAns;
}

// Pastille colorée d'un statut patient (couleur choisie dans les réglages).
export function classeStatut(reglages, statut) {
  return `cr-pastille c-${reglages.statuts.find((s) => s.nom === statut)?.couleur || "grey"}`;
}

// Durée écoulée depuis une date : « 7 jours », « 13 mois », « 2 ans et 1 mois ».
export function depuis(iso, aujourdhui = new Date().toISOString().slice(0, 10)) {
  if (!iso) return "";
  const jours = Math.round((new Date(`${aujourdhui}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);
  if (jours < 0) return "";
  if (jours === 0) return "aujourd'hui";
  if (jours < 31) return `${jours} jour${jours > 1 ? "s" : ""}`;
  return age(iso, aujourdhui);
}

// Accords des formes inclusives « vu(e) », « né(e) »… selon le sexe du patient
// (« F » ou « M »), sauf les mots qui désignent le praticien, accordés selon
// son genre. Sans information, la forme « (e) » est conservée.
const MOTS_PRATICIEN = ["reconnaissant", "informé", "tenu", "certain"];

export function accorder(texte, sexePatient, genrePraticien) {
  return (texte || "").replace(/(\p{L}+)\(e\)(s?)/gu, (forme, mot, pluriel) => {
    const genre = MOTS_PRATICIEN.includes(mot.toLowerCase()) ? genrePraticien : sexePatient;
    if (genre === "F") return `${mot}e${pluriel}`;
    if (genre === "M") return `${mot}${pluriel}`;
    return forme;
  });
}
