// Planning du Chesnay : deux fauteuils, motifs de rendez-vous (mêmes couleurs et durées
// que Doctolib) et planning type (plages d'ouverture). Réglages du cabinet, modifiables.

// lien : date reportée dans le parcours du patient (RDV de pose, de dépose, de facturation).
const m = (id, nom, duree, couleur, fauteuil, lien = "") => ({ id, nom, duree, couleur, fauteuil, lien });

export const MOTIFS_PAR_DEFAUT = [
  // Fauteuil 1 : praticienne (poses, suivis, contention).
  m("pose-metal", "Pose bagues métalliques", 45, "#ee96d5", 1, "pose"),
  m("pose-ceramique", "Pose bagues céramiques", 45, "#c983af", 1, "pose"),
  m("pose-gouttiere", "Pose gouttière SPARK ou Angel", 45, "#0796de", 1, "pose"),
  m("pose-amovible", "Pose appareil amovible", 15, "#ffa629", 1, "pose"),
  m("pose-disjoncteur", "Pose disjoncteur", 15, "#ff9e9e", 1, "pose"),
  m("suivi", "Consultation de suivi d'orthodontie", 15, "#edcc10", 1),
  m("facturation", "FACTURATION + Consultation de suivi d'orthodontie", 15, "#fe94d4", 1, "facturation"),
  m("suivi-amovible", "Consultation de suivi pour appareil amovible", 5, "#ffba18", 1),
  m("suivi-aligneurs", "Consultation de suivi pour aligneurs invisibles", 15, "#87ade5", 1),
  m("suivi-disjoncteur", "Suivi Disjoncteur", 5, "#ff5c5c", 1),
  m("suivi-contention", "Suivi contention", 5, "#cbbf9f", 1),
  m("suivi-oam", "Suivi OAM", 5, "#a3c381", 1),
  m("recol-court", "Recol court (< 2 bagues)", 15, "#ffc2c2", 1),
  m("recol-long", "Recol long (> 2 bagues)", 30, "#ffbdbd", 1),
  m("urgence", "URGENCE (fil qui pique)", 15, "#e10506", 1),
  m("reevaluation", "Réévaluation / surveillance", 15, "#f0a284", 1),
  m("dep-renouvellement", "DEP à renouvellement", 15, "#89fa03", 1),
  m("depose", "Dépose", 45, "#f0a284", 1, "depose"),
  // Fauteuil 2 : assistante (premières consultations, bilans, contrôle qualité).
  m("premiere-enfant", "Enfant - Première consultation d'orthodontie (MOINS DE 16 ANS)", 30, "#02fffb", 2),
  m("premiere-adulte", "Adulte - Première consultation d'orthodontie (PLUS DE 16 ANS)", 30, "#53df69", 2),
  m("premiere-aligneurs", "Première consultation pour aligneurs invisibles", 30, "#87ade5", 2),
  m("premiere-oam", "Première consultation pour Orthèse Avancée Mandibulaire (apnée du sommeil)", 30, "#bacb00", 2),
  m("bilan-enfant", "Enfant - Bilan Orthodontique (2ème RDV)", 30, "#c906ff", 2),
  m("bilan-adulte", "Adulte - Bilan Orthodontique (2ème RDV)", 30, "#7e06e1", 2),
  m("controle-qualite", "Contrôle Qualité : Pano / TRP / Photo", 30, "#a770f5", 2),
  m("pano-trp", "Panoramique et TRP", 15, "#c6f655", 2),
  m("plan-traitement", "Plan de traitement", 15, "#ae0a08", 2),
];

// Plages : jour (1 = lundi … 5 = vendredi), fauteuil, début, fin, genre.
// Fauteuil 1 : RDV longs (rose) le matin, courts (bleu) l'après-midi. Fauteuil 2 : créneaux de 1ère consultation.
const p = (jour, fauteuil, debut, fin, genre) => ({ jour, fauteuil, debut, fin, genre });
const creneaux = (jour, heures) => heures.map((h) => p(jour, 2, h, finDe(h, 30), "consultation"));

export const PLAGES_PAR_DEFAUT = [
  p(1, 1, "10:30", "12:00", "long"),
  p(1, 1, "12:00", "13:00", "court"),
  p(1, 1, "14:00", "16:00", "long"),
  p(1, 1, "16:00", "19:00", "court"),
  p(3, 1, "09:30", "13:00", "long"),
  p(3, 1, "14:00", "19:00", "court"),
  p(5, 1, "09:30", "15:00", "long"),
  ...creneaux(1, ["10:30", "11:30", "12:30", "14:00", "15:00", "16:00", "17:00", "18:00"]),
  ...creneaux(3, ["09:30", "10:30", "11:30", "12:30", "17:00", "18:00"]),
  ...creneaux(5, ["10:00", "11:00", "12:00", "13:00"]),
];

export const GENRES_PLAGES = {
  long: { libelle: "RDV longs (poses, dépose…)", couleur: "#f6cdee", bord: "#e879c9" },
  court: { libelle: "RDV courts (suivis, urgences, contention)", couleur: "#d2f7fc", bord: "#67d4e6" },
  consultation: { libelle: "1ère consultation / bilan", couleur: "#d2f7fc", bord: "#67d4e6" },
};

export const FAUTEUILS = { 1: "Fauteuil 1 · Cabinet ortho", 2: "Fauteuil 2 · Cabinet blanc" };

export function minutes(hhmm) {
  const [h, mn] = String(hhmm || "0:0")
    .split(":")
    .map(Number);
  return h * 60 + mn;
}

export function heure(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function finDe(hhmm, duree) {
  return heure(minutes(hhmm) + duree);
}

export function reglagesPlanning(cabinet) {
  const r = cabinet?.planning || {};
  return {
    motifs: Array.isArray(r.motifs) && r.motifs.length ? r.motifs : MOTIFS_PAR_DEFAUT,
    plages: Array.isArray(r.plages) ? r.plages : PLAGES_PAR_DEFAUT,
  };
}

// Lundi de la semaine d'une date ISO.
export function lundi(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function plusJours(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Texte lisible sur la couleur du motif.
export function texteSur(couleur) {
  const c = String(couleur || "#cccccc").replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1e293b" : "#ffffff";
}

export function chevauche(a, b) {
  return (
    a.id !== b.id &&
    a.date === b.date &&
    a.fauteuil === b.fauteuil &&
    a.statut !== "annule" &&
    b.statut !== "annule" &&
    minutes(a.debut) < minutes(b.debut) + b.duree &&
    minutes(b.debut) < minutes(a.debut) + a.duree
  );
}

// Heures proposées : pile ou au quart d'heure.
export const PAS = 15;
export const auQuart = (min) => Math.ceil(min / PAS) * PAS;

// Un motif se place dans une plage de son fauteuil : plages roses = RDV longs (30 min et plus),
// bleues = RDV courts, créneaux de 1ère consultation = tous les motifs du fauteuil 2.
export function compatible(motif, plage) {
  if (!motif || plage.fauteuil !== motif.fauteuil) return false;
  if (plage.genre === "long") return motif.duree >= 30;
  if (plage.genre === "court") return motif.duree < 30;
  return true;
}

// Créneaux libres pour un motif sur des dates (index 0 = lundi), à partir de maintenant.
export function creneauxLibres({ motif, plages, rdv, dates, maintenant = new Date() }) {
  if (!motif) return [];
  const auj = maintenant.toLocaleDateString("sv-SE");
  const minuteMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const pas = auQuart(motif.duree);
  const liste = [];
  dates.forEach((date, i) => {
    if (date < auj) return;
    const occupes = rdv.filter((r) => r.date === date && r.fauteuil === motif.fauteuil && r.statut !== "annule");
    for (const plage of plages.filter((p) => p.jour === i + 1 && compatible(motif, p))) {
      let debut = auQuart(minutes(plage.debut));
      const fin = minutes(plage.fin);
      while (debut + motif.duree <= fin) {
        const pris = occupes.some((r) => debut < minutes(r.debut) + r.duree && minutes(r.debut) < debut + motif.duree);
        const passe = date === auj && debut < minuteMaintenant;
        if (!pris && !passe) {
          liste.push({ date, debut: heure(debut), fin: heure(debut + motif.duree), fauteuil: motif.fauteuil });
          debut += pas;
        } else debut += PAS;
      }
    }
  });
  return liste;
}
