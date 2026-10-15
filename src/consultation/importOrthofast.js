// Lecture de l'export « liste des patients » d'OrthoFast (.xlsx), dans l'application :
// le fichier ne quitte pas l'ordinateur. Les colonnes sont retrouvées par leur titre ;
// certaines apparaissent deux fois (Montant, Reste à payer, Acte, Semestre) et sont lues dans l'ordre.
// Résultat : une liste d'objets patient « bruts » à rattacher aux dossiers du coffre (cabinet + code patient).
import { readSheet } from "read-excel-file/browser";

function normaliser(titre) {
  return String(titre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function indexer(entete) {
  const positions = new Map();
  entete.forEach((titre, i) => {
    const cle = normaliser(titre);
    if (!cle) return;
    if (!positions.has(cle)) positions.set(cle, []);
    positions.get(cle).push(i);
  });
  return (titre, occurrence = 0) => positions.get(normaliser(titre))?.[occurrence] ?? -1;
}

function dateIso(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  const m = typeof v === "string" && v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

function texte(v) {
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function montant(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(texte(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function lireExportOrthofast(fichier) {
  const lignes = await readSheet(fichier);
  const indexEntete = lignes.findIndex((l) => l.some((c) => normaliser(c) === "nom patient"));
  if (indexEntete === -1) {
    throw new Error("Ce fichier ne ressemble pas à l'export « liste des patients » d'OrthoFast (colonne « Nom patient » introuvable).");
  }
  const col = indexer(lignes[indexEntete]);
  if (col("Code Patient") === -1) throw new Error("Colonne « Code Patient » introuvable dans le fichier.");

  const lire = (ligne, titre, occurrence = 0) => {
    const i = col(titre, occurrence);
    return i === -1 ? null : ligne[i];
  };
  // Colonne sans titre placée juste après une colonne connue (détail d'une DEP).
  const lireApres = (ligne, titre) => {
    const i = col(titre);
    return i === -1 ? null : ligne[i + 1];
  };

  const patients = [];
  for (const ligne of lignes.slice(indexEntete + 1)) {
    const code = texte(lire(ligne, "Code Patient"));
    const nom = texte(lire(ligne, "Nom patient"));
    if (!code || !nom) continue;

    const reglements = [
      ["Plus ancien règlement dû", "Plus ancien regl du", 0],
      ["Prochain règlement dû", "Prochain regl du", 1],
    ]
      .map(([libelle, titreDate, n]) => ({
        libelle,
        date: dateIso(lire(ligne, titreDate)),
        montant: montant(lire(ligne, "Montant", n)),
        reste: montant(lire(ligne, "Reste a payer", n)),
        acte: texte(lire(ligne, "Acte", n)),
        semestre: texte(lire(ligne, "Semestre", n)),
      }))
      .filter((r) => r.date || r.montant != null);

    patients.push({
      code,
      nom,
      prenom: texte(lire(ligne, "Prénom patient")),
      sexe: texte(lire(ligne, "Sexe")),
      naissance: dateIso(lire(ligne, "Date de naissance")),
      dossier: texte(lire(ligne, "Dossier")),
      telephone: texte(lire(ligne, "Téléphone")),
      portable: texte(lire(ligne, "Téléphone portable")),
      email: texte(lire(ligne, "Adresse email")),
      envoyePar: texte(lire(ligne, "Envoyé par")),
      dentiste: texte(lire(ligne, "Dentiste")),
      autreCorrespondant: texte(lire(ligne, "Autre correspondant")),
      typeTraitement: texte(lire(ligne, "Type de traitement")),
      depuis: dateIso(lire(ligne, "Depuis le")),
      orthodontiste: texte(lire(ligne, "Orthodontiste")),
      debutTraitement: dateIso(lire(ligne, "Début traitement")),
      miseEnAttente: dateIso(lire(ligne, "Mise en attente")),
      derniereDep: dateIso(lire(ligne, "Dernière DEP faite")),
      derniereDepDetail: texte(lireApres(ligne, "Dernière DEP faite")),
      prochaineDep: dateIso(lire(ligne, "Prochaine DEP")),
      prochaineDepDetail: texte(lireApres(ligne, "Prochaine DEP")),
      reglements,
    });
  }
  return patients;
}
