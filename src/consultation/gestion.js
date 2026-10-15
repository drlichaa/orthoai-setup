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

// Une DEP couvre deux semestres (S1-S2, S3-S4, S5-S6…), puis une DEP pour l'année de contention.
export function premierDuGroupe(numero) {
  return numero % 2 ? numero : numero - 1;
}

// Paires couvertes par la « Dernière DEP faite » d'OrthoFast : la DEP vaut pour la paire
// qui commence dans les 45 jours suivant sa date (ou en cours), et toutes les paires
// précédentes ; au-delà de la fin des semestres, elle couvre aussi la contention.
function couvertureOrthofast(gestion, couverts) {
  const s = gestion?.semestres;
  const d = gestion?.depOrthofast;
  if (!s?.debut || !s.nombre || !/^\d{4}-\d{2}-\d{2}$/.test(d?.date || "")) return;
  const reference = ajouterJours(d.date, 45);
  const dep = { nature: "orthofast", date: d.date, detail: d.detail || "" };
  let dernier = 0;
  for (let i = 1; i <= s.nombre; i++) if (ajouterMois(s.debut, (i - 1) * 6) <= reference) dernier = i;
  if (!dernier) return;
  const fin = ajouterMois(s.debut, s.nombre * 6);
  const contention = /conten/i.test(dep.detail) || reference >= fin;
  const jusqua = contention ? s.nombre : Math.min(s.nombre, premierDuGroupe(dernier) + 1);
  for (let i = 1; i <= jusqua; i++) if (!couverts.has(i)) couverts.set(i, dep);
  if (contention && !couverts.has("C")) couverts.set("C", dep);
}

function couverture(gestion) {
  const couverts = new Map();
  for (const d of gestion?.deps || []) {
    if (d.nature === "contention") couverts.set("C", d);
    else if (d.nature === "debut" || d.nature === "suite") {
      const n = premierDuGroupe(Number(d.numero || d.semestre) || 1);
      couverts.set(n, d).set(n + 1, d);
    } else if (Number(d.semestre)) couverts.set(Number(d.semestre), d);
  }
  if (gestion?.semestres?.depFaites?.C && !couverts.has("C"))
    couverts.set("C", { nature: "contention", date: gestion.semestres.depFaites.C });
  couvertureOrthofast(gestion, couverts);
  return couverts;
}

export function semestres(gestion) {
  const s = gestion?.semestres;
  if (!s?.debut || !s.nombre) return [];
  const fin = ["contention", "suspension"].includes(gestion.phase) ? gestion.phaseDepuis : "";
  const couverts = couverture(gestion);
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
      dep: couverts.has(i) || Boolean(s.depFaites?.[i]),
      depDetail: couverts.get(i) || null,
      // Semestre passé créé à l'import OrthoFast : facturation et DEP à vérifier
      // par le praticien (pas de tâche automatique).
      aVerifier: Boolean(s.aVerifier?.[i]) && !s.factures?.[i],
    });
  }
  return liste;
}

// Année de contention qui suit les semestres (ou commence au passage en phase contention).
export function anneeContention(gestion) {
  const s = gestion?.semestres;
  if (!s?.debut || !s.nombre || gestion.phase === "suspension") return null;
  const debut =
    gestion.phase === "contention" && gestion.phaseDepuis ? gestion.phaseDepuis : ajouterMois(s.debut, s.nombre * 6);
  const dep = couverture(gestion).get("C") || null;
  return { debut, fin: ajouterMois(debut, 12), montant: s.contention ?? null, dep: Boolean(dep), depDetail: dep };
}

function jours(debut, fin) {
  return (new Date(`${fin}T12:00:00Z`) - new Date(`${debut}T12:00:00Z`)) / 86400000;
}

// « 3 mois et 2 semaines », « 2 ans et 3 mois ».
export function dureeLisible(debut, fin) {
  if (!debut || !fin || fin <= debut) return "";
  const mois = moisEntre(debut, fin);
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 && !mot.endsWith("s") ? "s" : ""}`;
  if (mois >= 12) {
    const ans = Math.floor(mois / 12);
    const reste = mois % 12;
    return pluriel(ans, "an") + (reste ? ` et ${reste} mois` : "");
  }
  const semaines = Math.floor(jours(ajouterMois(debut, mois), fin) / 7);
  if (!mois) return semaines ? pluriel(semaines, "semaine") : pluriel(Math.round(jours(debut, fin)), "jour");
  return `${mois} mois` + (semaines ? ` et ${pluriel(semaines, "semaine")}` : "");
}

// Frise du traitement : semestres puis contention, remplis selon le temps écoulé.
export function frise(gestion, auj = aujourdhui()) {
  const liste = semestres(gestion);
  if (!liste.length) return null;
  const remplissage = (debut, fin) => Math.min(1, Math.max(0, jours(debut, auj) / jours(debut, fin)));
  const segments = liste.map((s) => ({ ...s, cle: String(s.numero), libelle: String(s.numero), contention: false }));
  const c = anneeContention(gestion);
  if (c) segments.push({ ...c, cle: "C", libelle: "C1", contention: true, numero: null, facture: "" });
  for (const s of segments) s.remplissage = remplissage(s.debut, s.fin);
  const courant = segments.find((s) => s.debut <= auj && auj < s.fin) || null;
  const finSemestres = liste.at(-1).fin;
  const aFacturer = liste.filter((s) => s.debut <= auj && !s.facture && !s.aVerifier);
  return {
    segments,
    nombre: liste.length,
    courant,
    finSemestres,
    resteAFacturer: aFacturer.reduce((t, s) => t + (Number(s.montant) || 0), 0),
    semestresAFacturer: aFacturer.length,
  };
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
    }
  }
  if (g.phase !== "suspension" && priseEnChargeSecu(p, g)) {
    // DEP (traitement pris en charge) : une pour deux semestres, puis une pour la contention ; rappel un mois avant.
    const nombre = g.semestres?.nombre || 0;
    const groupes = semestres(g)
      .filter((s) => s.numero % 2 === 1)
      .map((s) => ({
        cle: s.numero,
        titre: s.numero + 1 <= nombre ? `semestres ${s.numero} et ${s.numero + 1}` : `semestre ${s.numero}`,
        debut: s.debut,
        dep: s.dep || s.aVerifier,
      }));
    const c = anneeContention(g);
    if (c) groupes.push({ cle: "C", titre: "l'année de contention", debut: c.debut, dep: c.dep });
    for (const groupe of groupes) {
      if (groupe.dep) continue;
      if (groupe.debut <= auj && (actif || groupe.cle === "C"))
        ajouter(
          `dep-${groupe.cle}`,
          "dep",
          `Faire la DEP des ${groupe.titre}`.replace("des l'", "de l'").replace("des semestre ", "du semestre "),
          groupe.debut,
        );
      else if (ajouterMois(groupe.debut, -1) <= auj && groupe.debut > auj)
        ajouter(
          `renouv-${groupe.cle}`,
          "depRenouvellement",
          `Préparer la DEP des ${groupe.titre}`.replace("des l'", "de l'").replace("des semestre ", "du semestre "),
          ajouterMois(groupe.debut, -1),
        );
    }
  }
  for (const d of g.deps || []) {
    if (!d.envoyee) ajouter(`envoi-${d.id}`, "depEnvoi", `Envoyer la ${libelleDep(d)}`, d.date);
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

export function libelleDep(d) {
  if (d.nature === "contention") return "DEP de contention";
  if (d.nature === "surveillance") return "DEP de surveillance";
  const n = premierDuGroupe(Number(d.numero || d.semestre) || 1);
  return `DEP des semestres ${n} et ${n + 1}`;
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

// ----- Relances (devis, attente, suivi) -----

export const RELANCES_PAR_DEFAUT = { devisMois: 1, attenteMois: 12, suiviMois: 3 };

export function delaisRelances(cabinet) {
  return { ...RELANCES_PAR_DEFAUT, ...(cabinet?.relances || {}) };
}

export const TYPES_RELANCES = {
  devis: { titre: "Devis à relancer", delai: "devisMois", depuis: "Devis du" },
  attente: { titre: "Patients en attente (trop tôt) à revoir", delai: "attenteMois", depuis: "En attente depuis le" },
  suivi: { titre: "Patients en traitement non revus", delai: "suiviMois", depuis: "Dernière séance le" },
};

const dateValide = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : isoDepuisFr(v || ""));
const EN_COURS_DE_TRAITEMENT = /^(en traitement|en cours)$/i;

// Relances dues d'un dossier : [{ type, reference, echeance, derniereRelance, detail }].
// Après une relance, le dossier revient au bout du même délai.
export function relancesPatient(p, delais, auj = aujourdhui()) {
  const g = p.gestion || {};
  const r = g.relances || {};
  const liste = [];
  const statut = p.statut || "";
  const ajouter = (type, reference, detail = "") => {
    if (!reference || r.stop?.[type]) return;
    const derniere =
      (r.historique?.[type] || [])
        .map((h) => h.date)
        .sort()
        .at(-1) || "";
    const depart = derniere > reference ? derniere : reference;
    const echeance = ajouterMois(depart, Number(delais[TYPES_RELANCES[type].delai]) || 0);
    if (echeance <= auj) liste.push({ type, reference, echeance, derniereRelance: derniere, detail });
  };

  // Devis : dernier devis non validé (OrthoAI), sinon statut « Devis envoyé » repris d'OrthoFast.
  const devis = g.devis || [];
  const enTraitement = EN_COURS_DE_TRAITEMENT.test(statut) || devis.some((d) => d.valide) || g.semestres?.debut;
  if (!enTraitement && !/sans suite|archiv|termin/i.test(statut)) {
    const dernier = [...devis]
      .sort((a, b) => (a.envoye || a.date || "").localeCompare(b.envoye || b.date || ""))
      .at(-1);
    if (dernier) ajouter("devis", dernier.envoye || dernier.date, dernier.description || "");
    else if (/devis envoy/i.test(statut))
      ajouter("devis", dateValide(p.orthofast?.depuis) || p.derniereFiche, p.orthofast?.typeTraitement || "");
  }

  if (/attente/i.test(statut))
    ajouter(
      "attente",
      dateValide(p.orthofast?.miseEnAttente) ||
        dateValide(p.miseEnAttente) ||
        dateValide(p.orthofast?.depuis) ||
        p.derniereFiche,
    );

  if (EN_COURS_DE_TRAITEMENT.test(statut) && g.phase !== "suspension") {
    const derniere = (p.seances || []).map(dateValide).filter(Boolean).sort().at(-1);
    if (derniere) ajouter("suivi", derniere, p.type || "");
  }
  return liste;
}

// Patients en traitement dont aucune séance n'est saisie dans OrthoAI (suivi tenu dans OrthoFast).
export function sansSeance(p) {
  return EN_COURS_DE_TRAITEMENT.test(p.statut || "") && !(p.seances || []).some((s) => dateValide(s));
}
