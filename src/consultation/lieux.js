// Cabinets où exercent les praticiens : chaque patient est rattaché à l'un d'eux.

export const LIEUX_PAR_DEFAUT = [
  { id: "chesnay", nom: "Cabinet dentaire du Chesnay", court: "Le Chesnay", coordonnees: "", telephone: "" },
  { id: "herblay", nom: "Espace Médico-Dentaire Herblay", court: "Herblay", coordonnees: "", telephone: "" },
];

export function lieux(cabinet) {
  return cabinet?.lieux?.length ? cabinet.lieux : LIEUX_PAR_DEFAUT;
}

export function nomLieu(cabinet, id) {
  return lieux(cabinet).find((l) => l.id === id)?.court || "";
}

// En-tête des documents : adresse et téléphone du cabinet du patient s'ils sont renseignés.
export function cabinetPour(cabinet, lieuId) {
  const lieu = lieux(cabinet).find((l) => l.id === lieuId);
  if (!lieu) return cabinet;
  return {
    ...cabinet,
    cabinet: lieu.nom || cabinet.cabinet,
    coordonnees: lieu.coordonnees?.trim() || cabinet.coordonnees,
    telephone: lieu.telephone?.trim() || cabinet.telephone,
  };
}

// Choix du cabinet affiché (« » = tous), gardé sur ce poste.
const CLE = "cr-ortho:lieu";
export function lieuMemorise() {
  try {
    return localStorage.getItem(CLE) || "";
  } catch {
    return "";
  }
}
export function memoriserLieu(id) {
  try {
    localStorage.setItem(CLE, id);
  } catch {
    // Stockage indisponible : le choix ne sera simplement pas retenu.
  }
}

// Filtre d'une liste selon le cabinet choisi.
export function dansLieu(lieuActif, lieu) {
  return !lieuActif || lieu === lieuActif;
}
