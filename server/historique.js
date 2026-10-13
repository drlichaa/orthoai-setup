// Historique des comptes rendus, conservé sur cet ordinateur uniquement.
// Le fichier est chiffré (AES-256-GCM) avec une clé dérivée du mot de passe
// (scrypt) : sans le mot de passe, il est illisible et ne peut pas être récupéré.
// Après déverrouillage, la clé reste en mémoire puis s'efface après 30 minutes
// d'inactivité ou à la fermeture.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const PARAMETRES_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DELAI_VERROUILLAGE_MS = 30 * 60 * 1000;
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

function deriverCle(motDePasse, sel) {
  return new Promise((resolvePromise, reject) => {
    scrypt(motDePasse.normalize("NFC"), sel, 32, PARAMETRES_SCRYPT, (err, cle) => (err ? reject(err) : resolvePromise(cle)));
  });
}

function chiffrer(cle, donnees) {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cle, iv);
  const contenu = Buffer.concat([chiffreur.update(JSON.stringify(donnees), "utf8"), chiffreur.final()]);
  return { iv: iv.toString("base64"), tag: chiffreur.getAuthTag().toString("base64"), contenu: contenu.toString("base64") };
}

function dechiffrer(cle, { iv, tag, contenu }) {
  const dechiffreur = createDecipheriv("aes-256-gcm", cle, Buffer.from(iv, "base64"));
  dechiffreur.setAuthTag(Buffer.from(tag, "base64"));
  const clair = Buffer.concat([dechiffreur.update(Buffer.from(contenu, "base64")), dechiffreur.final()]);
  return JSON.parse(clair.toString("utf8"));
}

export class ErreurHistorique extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

export function creerHistorique(fichier) {
  let cle = null;
  let sel = null;
  let fiches = [];
  let minuteur = null;

  function verrouiller() {
    if (cle) cle.fill(0);
    cle = null;
    fiches = [];
    clearTimeout(minuteur);
  }

  function prolonger() {
    clearTimeout(minuteur);
    minuteur = setTimeout(verrouiller, DELAI_VERROUILLAGE_MS);
    minuteur.unref();
  }

  function exiger() {
    if (!existsSync(fichier)) throw new ErreurHistorique(404, "Aucun historique sur cet ordinateur : créez-le.");
    if (!cle) throw new ErreurHistorique(423, "Historique verrouillé : saisissez votre mot de passe.");
    prolonger();
  }

  // Écriture atomique : un fichier temporaire remplace l'ancien d'un seul coup.
  function sauvegarder() {
    mkdirSync(dirname(fichier), { recursive: true });
    const enveloppe = { version: 1, sel: sel.toString("base64"), ...chiffrer(cle, fiches) };
    const temporaire = `${fichier}.tmp`;
    writeFileSync(temporaire, JSON.stringify(enveloppe), { mode: 0o600 });
    renameSync(temporaire, fichier);
  }

  function valider(motDePasse) {
    if (typeof motDePasse !== "string" || motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      throw new ErreurHistorique(400, `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    }
  }

  function resume(f) {
    return {
      id: f.id,
      creeLe: f.creeLe,
      modifieLe: f.modifieLe,
      patient: f.patient,
      motif: (f.rapport?.motif || "").slice(0, 160),
    };
  }

  return {
    etat() {
      return { existe: existsSync(fichier), deverrouille: Boolean(cle) };
    },

    async creer(motDePasse) {
      if (existsSync(fichier)) throw new ErreurHistorique(409, "Un historique existe déjà sur cet ordinateur.");
      valider(motDePasse);
      sel = randomBytes(16);
      cle = await deriverCle(motDePasse, sel);
      fiches = [];
      sauvegarder();
      prolonger();
    },

    async deverrouiller(motDePasse) {
      if (!existsSync(fichier)) throw new ErreurHistorique(404, "Aucun historique sur cet ordinateur.");
      const enveloppe = JSON.parse(readFileSync(fichier, "utf8"));
      const selFichier = Buffer.from(enveloppe.sel, "base64");
      const cleEssai = await deriverCle(String(motDePasse || ""), selFichier);
      try {
        fiches = dechiffrer(cleEssai, enveloppe);
      } catch {
        cleEssai.fill(0);
        // Freine les essais successifs de mots de passe.
        await new Promise((r) => setTimeout(r, 1000));
        throw new ErreurHistorique(401, "Mot de passe incorrect.");
      }
      sel = selFichier;
      cle = cleEssai;
      prolonger();
    },

    verrouiller,

    async changerMotDePasse(ancien, nouveau) {
      await this.deverrouiller(ancien);
      valider(nouveau);
      const nouveauSel = randomBytes(16);
      const nouvelleCle = await deriverCle(nouveau, nouveauSel);
      cle.fill(0);
      sel = nouveauSel;
      cle = nouvelleCle;
      sauvegarder();
    },

    // Mot de passe oublié : seule solution, tout effacer.
    reinitialiser() {
      verrouiller();
      rmSync(fichier, { force: true });
    },

    lister() {
      exiger();
      return fiches.map(resume).sort((a, b) => (b.patient?.date || "").localeCompare(a.patient?.date || "") || b.modifieLe.localeCompare(a.modifieLe));
    },

    lire(id) {
      exiger();
      const fiche = fiches.find((f) => f.id === id);
      if (!fiche) throw new ErreurHistorique(404, "Compte rendu introuvable.");
      return fiche;
    },

    enregistrer({ id, patient, rapport, notes, appareils }) {
      exiger();
      if (!rapport || typeof rapport !== "object") throw new ErreurHistorique(400, "Compte rendu absent.");
      const maintenant = new Date().toISOString();
      const existante = id ? fiches.find((f) => f.id === id) : null;
      const fiche = {
        id: existante?.id || randomUUID(),
        creeLe: existante?.creeLe || maintenant,
        modifieLe: maintenant,
        patient: patient || {},
        rapport,
        notes: typeof notes === "string" ? notes : "",
        // Textes des appareils tels qu'imprimés, même si le catalogue change ensuite.
        appareils: Array.isArray(appareils) ? appareils : [],
      };
      fiches = existante ? fiches.map((f) => (f.id === fiche.id ? fiche : f)) : [...fiches, fiche];
      sauvegarder();
      return resume(fiche);
    },

    supprimer(id) {
      exiger();
      fiches = fiches.filter((f) => f.id !== id);
      sauvegarder();
    },
  };
}
