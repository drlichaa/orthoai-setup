// Fiches illustrées remises au patient à la pose d'un appareil (« On vient de te poser… »).
// Documents du cabinet (aucune donnée patient) : fiches fournies avec l'application, que le
// cabinet peut remplacer par ses originaux (PNG, JPG ou PDF), rangés à côté des réglages.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Appareil du catalogue → fiche fournie (dossier public/fiches).
export const FICHES_PAR_DEFAUT = {
  plaque_amovible: "plaque.png",
  multi_attaches_metal: "bagues.png",
  multi_attaches_ceramique: "bagues.png",
  recommandations_bagues: "bagues.png",
  disjoncteur: "disjoncteur.png",
  eln: "eln.png",
  pul2: "pul.png",
  carriere: "carriere.png",
  aligneurs: "spark.png",
};

const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf" };
const EXTENSIONS = { "image/png": ".png", "image/jpeg": ".jpg", "application/pdf": ".pdf" };
const ID = /^[\w-]{1,60}$/;

export function creerFiches({ dossierStatique, dossierPerso }) {
  const perso = (id) =>
    dossierPerso && existsSync(dossierPerso)
      ? readdirSync(dossierPerso).find((f) => f.replace(/\.\w+$/, "") === id)
      : undefined;
  const defaut = (id) => {
    const nom = FICHES_PAR_DEFAUT[id];
    const chemin = nom && dossierStatique ? join(dossierStatique, "fiches", nom) : "";
    return chemin && existsSync(chemin) ? { chemin, type: "image/png", nom } : null;
  };
  function fiche(id) {
    if (!ID.test(id || "")) return null;
    const f = perso(id);
    if (f) return { chemin: join(dossierPerso, f), type: TYPES[f.slice(f.lastIndexOf("."))], nom: f, perso: true };
    return defaut(id);
  }
  return {
    lister() {
      const ids = new Set([
        ...Object.keys(FICHES_PAR_DEFAUT),
        ...(dossierPerso && existsSync(dossierPerso)
          ? readdirSync(dossierPerso).map((f) => f.replace(/\.\w+$/, ""))
          : []),
      ]);
      const liste = {};
      for (const id of ids) {
        const f = fiche(id);
        // Même fiche pour plusieurs appareils (bagues) : « groupe » évite de l'envoyer deux fois.
        if (f) liste[id] = { type: f.type, perso: Boolean(f.perso), groupe: f.perso ? id : f.nom };
      }
      return liste;
    },
    lire(id) {
      const f = fiche(id);
      return f ? { type: f.type, octets: readFileSync(f.chemin) } : null;
    },
    enregistrer(id, type, octets) {
      if (!dossierPerso) throw new Error("Remplacement des fiches impossible ici.");
      if (!ID.test(id || "")) throw new Error("Appareil inconnu.");
      const ext = EXTENSIONS[type];
      if (!ext) throw new Error("Format non pris en charge (PNG, JPG ou PDF).");
      mkdirSync(dossierPerso, { recursive: true });
      const ancienne = perso(id);
      if (ancienne) rmSync(join(dossierPerso, ancienne), { force: true });
      writeFileSync(join(dossierPerso, `${id}${ext}`), octets);
    },
    supprimer(id) {
      const ancienne = ID.test(id || "") ? perso(id) : undefined;
      if (ancienne) rmSync(join(dossierPerso, ancienne), { force: true });
    },
  };
}
