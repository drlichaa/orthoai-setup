// Tâches : lecture de la vue « gestion », échéances actives et action « fait »,
// partagées par l'application et la version iPhone.
import { appelApi } from "./apiHistorique.js";
import { aujourdhui, automatisations, echeancesPatient } from "./gestion.js";
import { dansLieu } from "./lieux.js";

export async function lireGestion() {
  try {
    return await appelApi("/patients/gestion");
  } catch (err) {
    if (err.statut === 423 || err.statut === 404) return { verrouille: true, existe: err.statut === 423 };
    return { erreur: err.message };
  }
}

export const nom = (p) => [p?.nom?.toUpperCase(), p?.prenom].filter(Boolean).join(" ");

// Échéances actives (automatisations activées, non écartées) du cabinet affiché.
export function echeances(donnees, cabinet, lieuActif = "") {
  const actives = automatisations(cabinet);
  const ignorees = new Set(donnees.ignorees || []);
  return donnees.patients
    .filter((p) => dansLieu(lieuActif, p.lieu))
    .flatMap((p) => echeancesPatient(p).map((e) => ({ ...e, patient: p })))
    .filter((e) => actives[e.type] && !ignorees.has(e.cle))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function majGestionPatient(patient, modif) {
  await appelApi("/patients/gestion/dossier", { id: patient.id, gestion: { ...patient.gestion, ...modif } });
}

// Action « fait » d'une échéance automatique : mise à jour du dossier concerné.
export async function terminerEcheance(e, donnees, setDonnees) {
  const g = e.patient.gestion || {};
  const [, cle] = e.cle.split(":");
  const n = Number(cle.split("-").at(-1));
  const auj = aujourdhui();
  // Parcours : bilan, contention, carte Vitale, contrôles de contention.
  const parcours = g.parcours || {};
  const champsParcours = {
    "fact-bilan": "bilanFacture",
    "fact-contention": "contentionFacturee",
    "fact-vitale": "vitale",
  };
  if (champsParcours[cle])
    return majGestionPatient(e.patient, { parcours: { ...parcours, [champsParcours[cle]]: auj } });
  if (e.type === "contention")
    return majGestionPatient(e.patient, {
      parcours: { ...parcours, controles: { ...(parcours.controles || {}), [n]: auj } },
    });
  if (e.type === "facturation")
    return majGestionPatient(e.patient, {
      semestres: { ...g.semestres, factures: { ...(g.semestres?.factures || {}), [n]: auj } },
    });
  if (e.type === "dep" || e.type === "depRenouvellement") {
    // Une DEP vaut pour deux semestres (ou pour l'année de contention : clé « C »).
    const groupe = cle.split("-").at(-1);
    const faites = groupe === "C" ? { C: auj } : { [n]: auj, [n + 1]: auj };
    return majGestionPatient(e.patient, {
      semestres: { ...g.semestres, depFaites: { ...(g.semestres?.depFaites || {}), ...faites } },
    });
  }
  if (e.type === "depEnvoi") {
    const id = cle.replace(/^envoi-/, "");
    return majGestionPatient(e.patient, { deps: g.deps.map((d) => (d.id === id ? { ...d, envoyee: auj } : d)) });
  }
  if (e.type === "rappel") return majGestionPatient(e.patient, { rappel: { ...g.rappel, fait: auj } });
  if (e.type === "labo") {
    const id = cle.replace(/^labo-/, "");
    return majGestionPatient(e.patient, { labo: g.labo.map((l) => (l.id === id ? { ...l, recu: auj } : l)) });
  }
  const suivant = await appelApi("/patients/gestion", { ignorees: [...(donnees.ignorees || []), e.cle] });
  setDonnees({ ...donnees, ...suivant });
}

export const LIBELLE_FAIT = {
  facturation: "Facturé",
  dep: "DEP faite",
  depEnvoi: "Envoyée",
  rappel: "Contacté",
  message: "Envoyé",
  contention: "Fait",
  labo: "Reçu",
  nonRevu: "Écarter",
  depRenouvellement: "Fait",
};

