// Gestion du traitement : barème, devis, semestres, DEP, laboratoire et
// échéances (alertes et tâches automatiques). Calculs sans interface.

export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export function identifiantUnique() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Date ISO + n mois (le 31 devient le dernier jour du mois si besoin).
export function ajouterMois(iso, mois) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [a, m, j] = iso.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + Number(mois), 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

export function ajouterJours(iso, jours) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(jours));
  return d.toISOString().slice(0, 10);
}

// « 12/03/2026 » (séances) → « 2026-03-12 ».
export function isoDepuisFr(texte) {
  const m = String(texte || "")
    .trim()
    .match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(texte || "") ? texte : "";
  const an = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${an}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function moisEntre(debut, fin = aujourdhui()) {
  if (!debut) return null;
  const [a1, m1, j1] = debut.split("-").map(Number);
  const [a2, m2, j2] = fin.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (j2 < j1 ? 1 : 0);
}

export function euros(n) {
  return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// ----- Barème (modifiable dans Paramètres) -----

export const TRAITEMENTS = [
  ["interception", "Traitement d'interception"],
  ["metal", "Bagues métalliques"],
  ["ceramique", "Bagues céramique"],
  ["aligneurs", "Aligneurs (gouttières)"],
  ["contention", "Contention seule"],
  ["surveillance", "Surveillance"],
];

export const BAREME_PAR_DEFAUT = {
  semestre: { interception: 980, metal: 980, ceramique: 1080, aligneurs: 1750 },
  contention: 750,
  diagnostic: 200,
  surveillance: 100,
  // Cotations et bases Assurance maladie (devis « avec prise en charge »).
  secu: {
    diagnostic: { code: "TO15+5", base: 43, rembourse: 25.8 },
    semestre: { code: "TO90", base: 193.5, rembourse: 193.5 },
    contention: { code: "TO75", base: 161.25, rembourse: 161.25 },
    surveillance: { code: "TO10", base: 21.5, rembourse: 12.9 },
  },
  ageHorsNomenclature: 16,
  validiteMois: 6,
};

export function bareme(cabinet) {
  const b = cabinet?.bareme || {};
  return {
    ...BAREME_PAR_DEFAUT,
    ...b,
    semestre: { ...BAREME_PAR_DEFAUT.semestre, ...(b.semestre || {}) },
    secu: {
      ...BAREME_PAR_DEFAUT.secu,
      ...Object.fromEntries(Object.entries(b.secu || {}).map(([k, v]) => [k, { ...BAREME_PAR_DEFAUT.secu[k], ...v }])),
    },
  };
}

export const AUTOMATISATIONS = [
  [
    "facturation",
    "Semestres à facturer",
    "Une tâche dès qu'un semestre du devis validé arrive à échéance sans être facturé.",
  ],
  ["dep", "DEP à faire", "Une tâche pour chaque semestre commencé sans DEP éditée."],
  [
    "depEnvoi",
    "Envoi de la DEP",
    "Une tâche « Envoyer la DEP » après chaque DEP éditée, jusqu'à ce qu'elle soit cochée.",
  ],
  [
    "depRenouvellement",
    "Renouvellement de la DEP",
    "Une tâche 5 mois après le début de chaque semestre, pour préparer la DEP suivante.",
  ],
  ["nonRevu", "Patients non revus", "Une tâche si un patient en traitement n'est pas venu depuis le délai choisi."],
  ["rappel", "Patients à rappeler", "Une tâche à la date du rappel programmé dans le dossier."],
  ["labo", "Appareils en retard", "Une tâche si un appareil commandé n'est pas reçu à la date prévue."],
];

export function automatisations(cabinet) {
  const a = cabinet?.automatisations || {};
  return Object.fromEntries(AUTOMATISATIONS.map(([cle]) => [cle, a[cle] !== false]));
}

// ----- Devis -----

const ORDINAL = (n) => (n === 1 ? "1er" : `${n}e`);

// Hors nomenclature si le patient a 16 ans ou plus à la première consultation.
export function regimeParDefaut(naissance, datePremiereConsultation, b) {
  if (!naissance || !datePremiereConsultation) return "secu";
  const ans = moisEntre(naissance, datePremiereConsultation) / 12;
  return ans >= b.ageHorsNomenclature ? "hn" : "secu";
}

function ligne(libelle, honoraires, acte, regime) {
  return regime === "hn"
    ? { libelle, code: "HN", honoraires, base: 0, rembourse: 0 }
    : { libelle, code: acte.code, honoraires, base: acte.base, rembourse: acte.rembourse };
}

export function lignesDevis(
  { traitement, semestres, regime, diagnostic, contention, surveillance, premierSemestre = 1 },
  b,
) {
  const lignes = [];
  if (diagnostic) lignes.push(ligne("Diagnostic", b.diagnostic, b.secu.diagnostic, regime));
  if (traitement === "surveillance") {
    for (let i = 0; i < Math.max(1, semestres); i++)
      lignes.push(ligne(`Surveillance ${i + 1}`, b.surveillance, b.secu.surveillance, regime));
  } else if (traitement !== "contention") {
    const prix = b.semestre[traitement] ?? 0;
    for (let i = 0; i < semestres; i++) {
      const n = premierSemestre + i;
      lignes.push(ligne(`${ORDINAL(n)} Semestre ODF`, prix, b.secu.semestre, regime));
    }
  }
  if (contention || traitement === "contention")
    lignes.push(ligne("Contention 1ère année", b.contention, b.secu.contention, regime));
  if (surveillance && traitement !== "surveillance")
    lignes.push(ligne("Surveillance 1", b.surveillance, b.secu.surveillance, regime));
  return lignes;
}

export function totauxDevis(lignes) {
  const t = { honoraires: 0, base: 0, rembourse: 0, reste: 0 };
  for (const l of lignes) {
    t.honoraires += Number(l.honoraires) || 0;
    t.base += Number(l.base) || 0;
    t.rembourse += Number(l.rembourse) || 0;
  }
  t.reste = t.honoraires - t.rembourse;
  return t;
}

// ----- Semestres (à partir du devis validé) -----

export function semestres(gestion) {
  const s = gestion?.semestres;
  if (!s?.debut || !s.nombre) return [];
  const fin = ["contention", "suspension"].includes(gestion.phase) ? gestion.phaseDepuis : "";
  const liste = [];
  for (let i = 1; i <= s.nombre; i++) {
    const debut = ajouterMois(s.debut, (i - 1) * 6);
    if (fin && debut >= fin) break;
    liste.push({
      numero: i,
      debut,
      fin: ajouterMois(s.debut, i * 6),
      montant: s.montants?.[i - 1] ?? null,
      facture: s.factures?.[i] || "",
      dep: (gestion.deps || []).some((d) => Number(d.semestre) === i) || Boolean(s.depFaites?.[i]),
      // Semestre passé créé à l'import OrthoFast : facturation et DEP à vérifier
      // par le praticien (pas de tâche automatique).
      aVerifier: Boolean(s.aVerifier?.[i]) && !s.factures?.[i],
    });
  }
  return liste;
}

// Traitement pris en charge par la Sécurité sociale : devis validé « Sécu »,
// ou, pour les semestres repris d'OrthoFast, patient assuré de moins de
// l'âge limite (16 ans) au début du traitement.
export function priseEnChargeSecu(patient, gestion, ageLimite = BAREME_PAR_DEFAUT.ageHorsNomenclature) {
  const s = gestion?.semestres;
  if (!s?.debut) return false;
  const devis = (gestion.devis || []).find((d) => d.id === s.devisId);
  if (devis) return devis.regime !== "hn";
  if (patient?.securiteSociale === false || !patient?.naissance) return false;
  return moisEntre(patient.naissance, s.debut) / 12 < ageLimite;
}

// Date de la dernière séance (« jj/mm/aaaa » ou ISO), ou du début du traitement.
export function derniereVisite(seances, gestion) {
  const dates = (seances || []).map(isoDepuisFr).filter(Boolean).sort();
  return dates.at(-1) || gestion?.semestres?.debut || "";
}

const EN_TRAITEMENT = /traitement|en cours/i;

// Échéances d'un dossier : { cle, type, titre, date, patientId }.
export function echeancesPatient(p, auj = aujourdhui()) {
  const g = p.gestion || {};
  const liste = [];
  const ajouter = (cle, type, titre, date, detail = "") =>
    liste.push({ cle: `${p.id}:${cle}`, type, titre, date, detail, patientId: p.id });
  const actif = !["attente", "contention", "suspension"].includes(g.phase || "actif");
  if (actif) {
    for (const s of semestres(g)) {
      if (s.debut > auj || s.aVerifier) continue;
      if (!s.facture)
        ajouter(
          `fact-${s.numero}`,
          "facturation",
          `Facturer le semestre ${s.numero}`,
          s.debut,
          s.montant ? euros(s.montant) : "",
        );
      if (!s.dep) ajouter(`dep-${s.numero}`, "dep", `Faire la DEP du semestre ${s.numero}`, s.debut);
      const renouvellement = ajouterMois(s.debut, 5);
      if (renouvellement <= auj && s.numero < (g.semestres?.nombre || 0))
        ajouter(
          `renouv-${s.numero}`,
          "depRenouvellement",
          `Préparer la DEP du semestre ${s.numero + 1}`,
          renouvellement,
        );
    }
  }
  for (const d of g.deps || []) {
    if (!d.envoyee) ajouter(`envoi-${d.id}`, "depEnvoi", `Envoyer la DEP du semestre ${d.semestre || "?"}`, d.date);
  }
  const delai = Number(g.nonRevuMois) || 0;
  const derniere = derniereVisite(p.seances, g);
  if (delai > 0 && derniere && EN_TRAITEMENT.test(p.statut || "") && ajouterMois(derniere, delai) <= auj)
    ajouter(
      `nonrevu-${derniere}`,
      "nonRevu",
      `Non revu depuis ${delai} mois`,
      ajouterMois(derniere, delai),
      `Dernière visite le ${derniere.split("-").reverse().join("/")}`,
    );
  if (g.rappel?.date && !g.rappel.fait && g.rappel.date <= auj)
    ajouter(`rappel-${g.rappel.date}`, "rappel", "Rappeler le patient", g.rappel.date, g.rappel.motif || "");
  for (const l of g.labo || []) {
    if (!l.recu && l.prevu && l.prevu < auj)
      ajouter(`labo-${l.id}`, "labo", `${l.appareil} non reçu`, l.prevu, l.laboratoire || "");
  }
  return liste;
}

export const TYPES_ECHEANCES = {
  facturation: "À facturer",
  dep: "DEP à faire",
  depEnvoi: "DEP à envoyer",
  depRenouvellement: "DEP à renouveler",
  nonRevu: "Non revus",
  rappel: "À rappeler",
  labo: "Laboratoire",
};

// ----- DEP (Cerfa 10518*01) -----

export const DEP_DIAGNOSTIC = [
  [
    "Anomalies basales — maxillaire",
    [
      ["bm_pro", "Pro"],
      ["bm_retro", "Rétro"],
      ["bm_endo", "Endo"],
      ["bm_exo", "Exo"],
    ],
  ],
  [
    "Anomalies basales — mandibulaire",
    [
      ["bd_pro", "Pro"],
      ["bd_retro", "Rétro"],
      ["bd_endo", "Endo"],
      ["bd_exo", "Exo"],
    ],
  ],
  [
    "Anomalies alvéolaires — maxillaire",
    [
      ["am_pro", "Pro"],
      ["am_retro", "Rétro"],
      ["am_endo", "Endo"],
      ["am_exo", "Exo"],
    ],
  ],
  [
    "Anomalies alvéolaires — mandibulaire",
    [
      ["ad_pro", "Pro"],
      ["ad_retro", "Rétro"],
      ["ad_endo", "Endo"],
      ["ad_exo", "Exo"],
    ],
  ],
  [
    "Sens vertical",
    [
      ["hypo", "Hypodivergence"],
      ["hyper", "Hyperdivergence"],
      ["supra", "Supraclusion"],
      ["infra", "Infraclusion"],
    ],
  ],
  [
    "Autres",
    [
      ["ddm", "Dysharmonie dento-maxillaire"],
      ["ddd", "Dysharmonie dento-dentaire"],
      ["inv_d", "Occlusion inversée droite"],
      ["inv_g", "Occlusion inversée gauche"],
      ["inv_a", "Occlusion inversée antérieure"],
    ],
  ],
];

// Centres des cases sur le formulaire (pixels de l'image 1100 × 1524).
export const DEP_CASES = {
  bm_pro: [259, 1017],
  bm_retro: [358, 1017],
  bm_endo: [259, 1038],
  bm_exo: [358, 1038],
  bd_pro: [445, 1017],
  bd_retro: [556, 1017],
  bd_endo: [445, 1038],
  bd_exo: [556, 1038],
  am_pro: [679, 1017],
  am_retro: [778, 1017],
  am_endo: [679, 1038],
  am_exo: [778, 1038],
  ad_pro: [865, 1017],
  ad_retro: [976, 1017],
  ad_endo: [865, 1038],
  ad_exo: [976, 1038],
  hypo: [259, 1059],
  hyper: [445, 1059],
  supra: [679, 1059],
  infra: [865, 1059],
  ddm: [87, 1120],
  ddd: [642, 1120],
  inv_d: [333, 1161],
  inv_g: [445, 1161],
  inv_a: [568, 1161],
  molaire_I: [247, 1100],
  molaire_II: [310, 1100],
  molaire_III: [371, 1100],
  canine_I: [741, 1100],
  canine_II: [803, 1100],
  canine_III: [865, 1100],
  debut: [87, 913],
  surveillance: [87, 935],
  suite: [420, 913],
  contention: [420, 935],
  devis_oui: [556, 544],
  devis_non: [791, 544],
  R: [716, 378],
  HR: [902, 378],
};
