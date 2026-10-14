// Dents en numérotation FDI et états notés sur le schéma dentaire.

export const ETATS = [
  ["agenesie", "Agénésie"],
  ["aExtraire", "À extraire"],
  ["extraite", "Extraite"],
  ["incluse", "Incluse"],
];

export const ARCADES_PERMANENTES = [
  [
    ["18", "17", "16", "15", "14", "13", "12", "11"],
    ["21", "22", "23", "24", "25", "26", "27", "28"],
  ],
  [
    ["48", "47", "46", "45", "44", "43", "42", "41"],
    ["31", "32", "33", "34", "35", "36", "37", "38"],
  ],
];

export const ARCADES_TEMPORAIRES = [
  [
    ["55", "54", "53", "52", "51"],
    ["61", "62", "63", "64", "65"],
  ],
  [
    ["85", "84", "83", "82", "81"],
    ["71", "72", "73", "74", "75"],
  ],
];

// Dents triées dans l'ordre de lecture du schéma : 18 → 28, puis 48 → 38.
const ORDRE = [...ARCADES_PERMANENTES, ...ARCADES_TEMPORAIRES].flat(2);

export function dentsAvecEtat(dents, etat) {
  return Object.keys(dents)
    .filter((d) => dents[d].includes(etat))
    .sort((a, b) => ORDRE.indexOf(a) - ORDRE.indexOf(b));
}
