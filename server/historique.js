// Coffre chiffré de l'ordinateur : historique des comptes rendus, dossiers
// patients et leurs photos / radios, conservés sur cet ordinateur uniquement.
// Tout est chiffré (AES-256-GCM) avec une clé dérivée du mot de passe (scrypt) :
// sans le mot de passe, rien n'est lisible ni récupérable.
// Après déverrouillage, la clé reste en mémoire puis s'efface après 30 minutes
// d'inactivité ou à la fermeture.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PARAMETRES_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DELAI_VERROUILLAGE_MS = 30 * 60 * 1000;
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export const REGLAGES_PAR_DEFAUT = {
  version: 2,
  types: ["Interception", "Multi-attaches", "Aligneurs", "Disjoncteur", "Contention"],
  statuts: [
    { nom: "Première consultation", couleur: "blue" },
    { nom: "Devis envoyé", couleur: "orange" },
    { nom: "En attente (trop tôt)", couleur: "grey" },
    { nom: "En cours", couleur: "green" },
    { nom: "En traitement", couleur: "green" },
    { nom: "En surveillance", couleur: "blue" },
    { nom: "En contention", couleur: "green" },
    { nom: "À revoir", couleur: "orange" },
    { nom: "Terminé", couleur: "grey" },
    { nom: "À archiver", couleur: "red" },
  ],
};

// Réglages enregistrés avant l'ajout de nouveaux statuts par défaut : les
// statuts sont complétés et rangés dans l'ordre par défaut, en gardant les
// couleurs choisies ; les statuts personnalisés restent à la fin.
function completerReglages(reglages) {
  if (!reglages) return REGLAGES_PAR_DEFAUT;
  if (reglages.version >= REGLAGES_PAR_DEFAUT.version) return reglages;
  const existants = reglages.statuts || [];
  const statuts = [
    ...REGLAGES_PAR_DEFAUT.statuts.map((d) => existants.find((s) => s.nom === d.nom) || d),
    ...existants.filter((s) => !REGLAGES_PAR_DEFAUT.statuts.some((d) => d.nom === s.nom)),
  ];
  return { ...reglages, version: REGLAGES_PAR_DEFAUT.version, statuts };
}

// Données de gestion (devis, semestres, DEP, laboratoire, tâches…) : structure
// libre côté application, mais bornée ici (profondeur, tailles, clés simples).
export function nettoyerJson(valeur, profondeur = 0) {
  if (profondeur > 8) return null;
  if (typeof valeur === "string") return valeur.slice(0, 20000);
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur === "boolean" || valeur === null) return valeur;
  if (Array.isArray(valeur)) return valeur.slice(0, 2000).map((v) => nettoyerJson(v, profondeur + 1));
  if (typeof valeur === "object") {
    return Object.fromEntries(
      Object.entries(valeur)
        .filter(([cle]) => /^[\w-]{1,60}$/.test(cle))
        .slice(0, 500)
        .map(([cle, v]) => [cle, nettoyerJson(v, profondeur + 1)]),
    );
  }
  return null;
}

const objet = (v) => (v && typeof v === "object" && !Array.isArray(v) ? nettoyerJson(v) : {});

function deriverCle(motDePasse, sel) {
  return new Promise((resolvePromise, reject) => {
    scrypt(motDePasse.normalize("NFC"), sel, 32, PARAMETRES_SCRYPT, (err, cle) => (err ? reject(err) : resolvePromise(cle)));
  });
}

function chiffrerOctets(cle, octets) {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cle, iv);
  const contenu = Buffer.concat([chiffreur.update(octets), chiffreur.final()]);
  return { iv, tag: chiffreur.getAuthTag(), contenu };
}

function dechiffrerOctets(cle, iv, tag, contenu) {
  const dechiffreur = createDecipheriv("aes-256-gcm", cle, iv);
  dechiffreur.setAuthTag(tag);
  return Buffer.concat([dechiffreur.update(contenu), dechiffreur.final()]);
}

function chiffrer(cle, donnees) {
  const { iv, tag, contenu } = chiffrerOctets(cle, Buffer.from(JSON.stringify(donnees), "utf8"));
  return { iv: iv.toString("base64"), tag: tag.toString("base64"), contenu: contenu.toString("base64") };
}

function dechiffrer(cle, { iv, tag, contenu }) {
  const clair = dechiffrerOctets(cle, Buffer.from(iv, "base64"), Buffer.from(tag, "base64"), Buffer.from(contenu, "base64"));
  return JSON.parse(clair.toString("utf8"));
}

// Fichier média chiffré : iv (12 octets) + tag (16 octets) + contenu.
function chiffrerMedia(cle, octets) {
  const { iv, tag, contenu } = chiffrerOctets(cle, octets);
  return Buffer.concat([iv, tag, contenu]);
}

function dechiffrerMedia(cle, brut) {
  return dechiffrerOctets(cle, brut.subarray(0, 12), brut.subarray(12, 28), brut.subarray(28));
}

export class ErreurHistorique extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

const texte = (v, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");

// Nom en majuscules ; prénom avec seulement l'initiale en majuscule
// (« jean-pierre » → « Jean-Pierre »).
export function formaterNom(nom) {
  return texte(nom, 200).toLocaleUpperCase("fr-FR");
}

export function formaterPrenom(prenom) {
  return texte(prenom, 200)
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separateur, lettre) => separateur + lettre.toLocaleUpperCase("fr-FR"));
}

// Schéma dentaire : numéro FDI → états de la dent.
const ETATS_DENT = ["agenesie", "aExtraire", "extraite", "incluse"];
const DENT_FDI = /^[1-8][1-8]$/;

function nettoyerDents(brut) {
  const dents = {};
  for (const [dent, etats] of Object.entries(brut && typeof brut === "object" ? brut : {})) {
    const valides = Array.isArray(etats) ? [...new Set(etats.filter((e) => ETATS_DENT.includes(e)))] : [];
    if (DENT_FDI.test(dent) && valides.length) dents[dent] = valides;
  }
  return dents;
}

function sansAccents(t) {
  return (t || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function dateFrancaise(iso) {
  const [a, m, j] = (iso || "").split("-");
  return a && m && j ? `${j}/${m}/${a}` : "";
}

// « jj/mm/aaaa » → nombre comparable (0 si la date n'est pas reconnue).
function valeurDate(date) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((date || "").trim());
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

// Séance « 1ère consultation » déduite d'un compte rendu enregistré.
function seanceConsultation(fiche) {
  return {
    date: dateFrancaise(fiche.patient?.date) || dateFrancaise(fiche.creeLe.slice(0, 10)),
    fait: "1ère consultation",
    prochaine: "",
    compteRendu: fiche.id,
  };
}

// Séance « 1ère consultation » saisie à la main (« 1 ère », « 1re »…).
const PREMIERE_CONSULTATION = /^\s*1\s*(?:è|e)?re\s+consultation/i;

export function creerHistorique(fichier) {
  const dossierMedias = join(dirname(fichier), "medias");
  let cle = null;
  let sel = null;
  let fiches = [];
  let patients = [];
  let reglages = REGLAGES_PAR_DEFAUT;
  // Tâches du cabinet et échéances écartées, partagées par tous les postes.
  let gestion = { taches: [], ignorees: [] };
  let minuteur = null;

  function verrouiller() {
    if (cle) cle.fill(0);
    cle = null;
    fiches = [];
    patients = [];
    reglages = REGLAGES_PAR_DEFAUT;
    gestion = { taches: [], ignorees: [] };
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
  function ecrireAtomique(chemin, contenu) {
    mkdirSync(dirname(chemin), { recursive: true });
    const temporaire = `${chemin}.tmp`;
    writeFileSync(temporaire, contenu, { mode: 0o600 });
    renameSync(temporaire, chemin);
  }

  function sauvegarder() {
    const enveloppe = { version: 2, sel: sel.toString("base64"), ...chiffrer(cle, { fiches, patients, reglages, gestion }) };
    ecrireAtomique(fichier, JSON.stringify(enveloppe));
  }

  function charger(donnees) {
    // Version 1 : le fichier ne contenait que la liste des comptes rendus.
    if (Array.isArray(donnees)) {
      fiches = donnees;
      patients = [];
      reglages = REGLAGES_PAR_DEFAUT;
    } else {
      fiches = donnees.fiches || [];
      patients = donnees.patients || [];
      reglages = completerReglages(donnees.reglages);
      gestion = { taches: [], ignorees: [], ...(donnees.gestion || {}) };
    }
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
      patientId: f.patientId || null,
      motif: (f.rapport?.motif || "").slice(0, 160),
    };
  }

  function resumePatient(p) {
    return {
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      naissance: p.naissance,
      code: p.code || "",
      alerte: Boolean(p.alerte),
      type: p.type,
      statut: p.statut,
      modifieLe: p.modifieLe,
    };
  }

  function trouverPatient(id) {
    const patient = patients.find((p) => p.id === id);
    if (!patient) throw new ErreurHistorique(404, "Patient introuvable.");
    return patient;
  }

  // Seuls les champs connus sont conservés ; les médias sont gérés par le serveur.
  function nettoyerPatient(brut, existant) {
    const liste = (v) => (Array.isArray(v) ? v : []);
    const arc = (a) => ({ fil: texte(a?.fil, 100), depuis: texte(a?.depuis, 10) });
    return {
      id: existant?.id || randomUUID(),
      creeLe: existant?.creeLe || new Date().toISOString(),
      modifieLe: new Date().toISOString(),
      nom: formaterNom(brut.nom),
      prenom: formaterPrenom(brut.prenom),
      naissance: texte(brut.naissance, 10),
      // Identifiants repris d'OrthoFast : le code relie aux dossiers photos.
      code: texte(brut.code, 20),
      dossier: texte(brut.dossier, 20),
      sexe: texte(brut.sexe, 1),
      telephone: texte(brut.telephone, 100),
      telephone2: texte(brut.telephone2, 100),
      portable: texte(brut.portable, 100),
      email: texte(brut.email, 200),
      tutoiement: Boolean(brut.tutoiement),
      securiteSociale: brut.securiteSociale !== false,
      orthodontiste: texte(brut.orthodontiste, 200),
      envoyePar: texte(brut.envoyePar, 300),
      dentiste: texte(brut.dentiste, 300),
      autreCorrespondant: texte(brut.autreCorrespondant, 300),
      miseEnAttente: texte(brut.miseEnAttente, 200),
      notesAdministratives: texte(brut.notesAdministratives),
      type: texte(brut.type, 100),
      statut: texte(brut.statut, 100),
      debut: texte(brut.debut, 10),
      diagnostic: texte(brut.diagnostic),
      plan: texte(brut.plan),
      // Textes repris de la première consultation : remplacés si elle est
      // modifiée, sauf si le praticien les a changés entre-temps.
      diagnosticAuto: texte(brut.diagnosticAuto),
      planAuto: texte(brut.planAuto),
      alerte: texte(brut.alerte, 2000),
      penseBete: texte(brut.penseBete),
      dentsAExtraire: texte(brut.dentsAExtraire, 300),
      agenesies: texte(brut.agenesies, 300),
      dents: nettoyerDents(brut.dents),
      // Courriers rédigés depuis le dossier (hors comptes rendus).
      courriers: liste(brut.courriers).map((c) => ({
        date: texte(c?.date, 10),
        destinataire: ["dentiste", "orthophoniste", "parodontiste", "orl"].includes(c?.destinataire)
          ? c.destinataire
          : "dentiste",
        motif: texte(c?.motif, 500),
        corps: texte(c?.corps),
        nom_destinataire: texte(c?.nom_destinataire, 500),
        sans_resume: Boolean(c?.sans_resume),
        image: /^[\w-]{1,100}$/.test(c?.image || "") ? c.image : "",
        ...(c?.auto ? { auto: texte(c.auto, 30) } : {}),
      })),
      dentsTemporaires: Boolean(brut.dentsTemporaires),
      arcSup: arc(brut.arcSup),
      arcInf: arc(brut.arcInf),
      aux1: arc(brut.aux1),
      aux2: arc(brut.aux2),
      commentaires: liste(brut.commentaires).map((c) => ({ date: texte(c?.date, 20), texte: texte(c?.texte) })),
      seances: liste(brut.seances).map((s) => ({
        date: texte(s?.date, 20),
        fait: texte(s?.fait),
        prochaine: texte(s?.prochaine),
        // Dents dont la bague a été recollée ce jour-là (affiché en rouge).
        recollages: liste(s?.recollages).filter((d) => DENT_FDI.test(d)),
        // Séance créée depuis un compte rendu : évite de l'ajouter deux fois.
        ...(s?.compteRendu ? { compteRendu: texte(s.compteRendu, 100) } : {}),
      })),
      medias: existant?.medias || [],
      // Devis, semestres, DEP, laboratoire, aligneurs, rappels, incidents…
      gestion: objet(brut.gestion),
      // Séries de photos, radios ou empreintes 3D : élément du scénario → média.
      series: liste(brut.series)
        .filter((s) => /^[\w-]{1,100}$/.test(s?.id || ""))
        .map((s) => ({
          id: s.id,
          scenario: texte(s.scenario, 50),
          nom: texte(s.nom, 100),
          date: texte(s.date, 10),
          elements: Object.fromEntries(
            Object.entries(s.elements && typeof s.elements === "object" ? s.elements : {})
              .filter(([cle, e]) => /^[\w-]{1,50}$/.test(cle) && /^[\w-]{1,100}$/.test(e?.media || ""))
              .map(([cle, e]) => [cle, { media: e.media, date: texte(e.date, 10) }]),
          ),
        })),
    };
  }

  // Rattache un compte rendu à un dossier patient (même nom, prénom et date
  // de naissance), ou crée le dossier avec le diagnostic et le plan résumés.
  function rattacherPatient(patientId, identite, resumeClinique) {
    if (patientId && patients.some((p) => p.id === patientId)) return patientId;
    const identifiant = (p) => [p.nom, p.prenom, p.naissance].map(sansAccents).join("|");
    // Les dossiers sont enregistrés nom en majuscules : même mise en forme pour comparer.
    identite = { ...identite, nom: formaterNom(identite?.nom), prenom: formaterPrenom(identite?.prenom) };
    if (!identite?.nom?.trim() && !identite?.prenom?.trim()) return null;
    const existant = patients.find((p) => identifiant(p) === identifiant(identite));
    if (existant) {
      if (!existant.sexe && ["F", "M"].includes(identite.sexe)) existant.sexe = identite.sexe;
      return existant.id;
    }
    const nouveau = nettoyerPatient(
      {
        nom: identite.nom,
        prenom: identite.prenom,
        naissance: identite.naissance,
        sexe: ["F", "M"].includes(identite.sexe) ? identite.sexe : "",
        statut: reglages.statuts[0]?.nom || "",
        diagnostic: resumeClinique?.diagnostic,
        plan: resumeClinique?.plan,
        diagnosticAuto: resumeClinique?.diagnostic,
        planAuto: resumeClinique?.plan,
      },
      null,
    );
    patients = [...patients, nouveau];
    return nouveau.id;
  }

  // Chaque compte rendu rattaché a sa séance « 1ère consultation » dans le suivi,
  // insérée à sa date. Une séance existante garde son texte ; seule la date suit.
  function assurerSeancesConsultation(patient) {
    let modifie = false;
    for (const fiche of fiches.filter((f) => f.patientId === patient.id)) {
      const seance = seanceConsultation(fiche);
      const existante =
        patient.seances.find((s) => s.compteRendu === fiche.id) ||
        patient.seances.find(
          (s) => !s.compteRendu && s.date === seance.date && PREMIERE_CONSULTATION.test(s.fait),
        );
      if (existante && !existante.compteRendu) {
        existante.compteRendu = fiche.id;
        modifie = true;
      }
      if (existante) {
        if (existante.date !== seance.date) {
          existante.date = seance.date;
          modifie = true;
        }
        continue;
      }
      const position = patient.seances.findIndex((s) => valeurDate(s.date) >= valeurDate(seance.date));
      patient.seances.splice(position === -1 ? patient.seances.length : position, 0, seance);
      modifie = true;
    }
    return modifie;
  }

  // Dents relevées dans le compte rendu → schéma dentaire du patient. Seules
  // les dents ajoutées depuis le dernier enregistrement du compte rendu sont
  // reportées : une dent retirée ensuite à la main sur le schéma n'y revient pas.
  function reporterDents(patient, ancien, nouveau) {
    const correspondance = [
      ["agenesies", "agenesie"],
      ["a_extraire", "aExtraire"],
      ["incluses", "incluse"],
    ];
    const dents = { ...(patient.dents || {}) };
    for (const [champ, etat] of correspondance) {
      const avant = new Set(ancien?.dents?.[champ] || []);
      for (const dent of nouveau?.dents?.[champ] || []) {
        if (avant.has(dent) || !DENT_FDI.test(dent)) continue;
        dents[dent] = [...new Set([...(dents[dent] || []), etat])];
      }
    }
    patient.dents = dents;
    const liste = (etat) =>
      Object.keys(dents)
        .filter((d) => dents[d].includes(etat))
        .sort()
        .join(", ");
    patient.agenesies = liste("agenesie") || patient.agenesies || "";
    patient.dentsAExtraire = liste("aExtraire") || patient.dentsAExtraire || "";
  }

  // Diagnostic et plan de la fiche clinique = ceux de la première consultation.
  function reprendrePremiereConsultation(patient, fiche, resumeClinique) {
    const premiere = fiches
      .filter((f) => f.patientId === patient.id)
      .sort((a, b) => (a.patient?.date || a.creeLe).localeCompare(b.patient?.date || b.creeLe))[0];
    if (premiere?.id !== fiche.id || !resumeClinique) return;
    for (const [champ, auto] of [
      ["diagnostic", "diagnosticAuto"],
      ["plan", "planAuto"],
    ]) {
      const nouveau = texte(resumeClinique[champ === "diagnostic" ? "diagnostic" : "plan"]);
      const intact = !patient[champ] || patient[champ] === patient[auto];
      if (nouveau && intact) {
        patient[champ] = nouveau;
        patient[auto] = nouveau;
      }
    }
  }

  function cheminMedia(id) {
    if (!/^[\w-]+$/.test(id)) throw new ErreurHistorique(400, "Identifiant invalide.");
    return join(dossierMedias, `${id}.chiffre`);
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
      charger({});
      sauvegarder();
      prolonger();
    },

    async deverrouiller(motDePasse) {
      if (!existsSync(fichier)) throw new ErreurHistorique(404, "Aucun historique sur cet ordinateur.");
      const enveloppe = JSON.parse(readFileSync(fichier, "utf8"));
      const selFichier = Buffer.from(enveloppe.sel, "base64");
      const cleEssai = await deriverCle(String(motDePasse || ""), selFichier);
      let donnees;
      try {
        donnees = dechiffrer(cleEssai, enveloppe);
      } catch {
        cleEssai.fill(0);
        // Freine les essais successifs de mots de passe.
        await new Promise((r) => setTimeout(r, 1000));
        throw new ErreurHistorique(401, "Mot de passe incorrect.");
      }
      charger(donnees);
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
      // Les photos et radios sont rechiffrées avec la nouvelle clé.
      if (existsSync(dossierMedias)) {
        for (const nom of readdirSync(dossierMedias).filter((n) => n.endsWith(".chiffre"))) {
          const chemin = join(dossierMedias, nom);
          const clair = dechiffrerMedia(cle, readFileSync(chemin));
          ecrireAtomique(chemin, chiffrerMedia(nouvelleCle, clair));
        }
      }
      cle.fill(0);
      sel = nouveauSel;
      cle = nouvelleCle;
      sauvegarder();
    },

    // Mot de passe oublié : seule solution, tout effacer.
    reinitialiser() {
      verrouiller();
      rmSync(fichier, { force: true });
      rmSync(dossierMedias, { recursive: true, force: true });
    },

    // ----- Comptes rendus -----

    lister() {
      exiger();
      return fiches
        .map(resume)
        .sort(
          (a, b) => (b.patient?.date || "").localeCompare(a.patient?.date || "") || b.modifieLe.localeCompare(a.modifieLe),
        );
    },

    lire(id) {
      exiger();
      const fiche = fiches.find((f) => f.id === id);
      if (!fiche) throw new ErreurHistorique(404, "Compte rendu introuvable.");
      return fiche;
    },

    enregistrer({ id, patientId, patient, rapport, notes, appareils, resumeClinique }) {
      exiger();
      if (!rapport || typeof rapport !== "object") throw new ErreurHistorique(400, "Compte rendu absent.");
      const maintenant = new Date().toISOString();
      const existante = id ? fiches.find((f) => f.id === id) : null;
      const fiche = {
        id: existante?.id || randomUUID(),
        creeLe: existante?.creeLe || maintenant,
        modifieLe: maintenant,
        patientId: rattacherPatient(patientId || existante?.patientId, patient, resumeClinique),
        patient: patient || {},
        rapport,
        notes: typeof notes === "string" ? notes : "",
        // Textes des appareils tels qu'imprimés, même si le catalogue change ensuite.
        appareils: Array.isArray(appareils) ? appareils : [],
      };
      fiches = existante ? fiches.map((f) => (f.id === fiche.id ? fiche : f)) : [...fiches, fiche];
      const patientRattache = patients.find((p) => p.id === fiche.patientId);
      if (patientRattache) {
        assurerSeancesConsultation(patientRattache);
        reporterDents(patientRattache, existante?.rapport, rapport);
        reprendrePremiereConsultation(patientRattache, fiche, resumeClinique);
      }
      sauvegarder();
      return resume(fiche);
    },

    supprimer(id) {
      exiger();
      fiches = fiches.filter((f) => f.id !== id);
      sauvegarder();
    },

    // ----- Dossiers patients -----

    patients() {
      exiger();
      return { patients: patients.map(resumePatient), reglages };
    },

    patient(id) {
      exiger();
      const patient = trouverPatient(id);
      if (assurerSeancesConsultation(patient)) sauvegarder();
      const comptesRendus = fiches.filter((f) => f.patientId === id).map(resume);
      return { patient, comptesRendus, reglages };
    },

    enregistrerPatient(brut) {
      exiger();
      if (!brut || typeof brut !== "object") throw new ErreurHistorique(400, "Patient absent.");
      if (!texte(brut.nom).trim() && !texte(brut.prenom).trim()) {
        throw new ErreurHistorique(400, "Renseignez au moins un nom ou un prénom.");
      }
      const existant = brut.id ? trouverPatient(brut.id) : null;
      const patient = nettoyerPatient(brut, existant);
      patients = existant ? patients.map((p) => (p.id === patient.id ? patient : p)) : [...patients, patient];
      sauvegarder();
      return patient;
    },

    // Supprime le dossier, ses photos / radios et ses comptes rendus.
    supprimerPatient(id) {
      exiger();
      const patient = trouverPatient(id);
      for (const media of patient.medias) rmSync(cheminMedia(media.id), { force: true });
      patients = patients.filter((p) => p.id !== id);
      fiches = fiches.filter((f) => f.patientId !== id);
      sauvegarder();
    },

    // Vue d'ensemble pour les tâches, le laboratoire et les alertes.
    gestion() {
      exiger();
      return {
        ...gestion,
        patients: patients.map((p) => ({
          ...resumePatient(p),
          gestion: p.gestion || {},
          seances: (p.seances || []).map((s) => s.date),
        })),
      };
    },

    enregistrerGestion(brut) {
      exiger();
      gestion = {
        taches: Array.isArray(brut?.taches) ? nettoyerJson(brut.taches) : gestion.taches,
        ignorees: Array.isArray(brut?.ignorees) ? nettoyerJson(brut.ignorees) : gestion.ignorees,
      };
      sauvegarder();
      return gestion;
    },

    // Modifie seulement la partie « gestion » d'un dossier (depuis les tâches).
    enregistrerGestionPatient(id, brut) {
      exiger();
      const patient = trouverPatient(id);
      patient.gestion = objet(brut);
      patient.modifieLe = new Date().toISOString();
      sauvegarder();
      return patient.gestion;
    },

    enregistrerReglages(brut) {
      exiger();
      const types = Array.isArray(brut?.types) ? brut.types.map((t) => texte(t, 100).trim()).filter(Boolean) : [];
      const statuts = Array.isArray(brut?.statuts)
        ? brut.statuts
            .map((s) => ({ nom: texte(s?.nom, 100).trim(), couleur: texte(s?.couleur, 20) || "grey" }))
            .filter((s) => s.nom)
        : [];
      if (!types.length || !statuts.length) throw new ErreurHistorique(400, "Gardez au moins un type et un statut.");
      reglages = { version: REGLAGES_PAR_DEFAUT.version, types, statuts };
      sauvegarder();
      return reglages;
    },

    ajouterMedia(patientId, nom, typeMime, octets) {
      exiger();
      const patient = trouverPatient(patientId);
      const media = { id: randomUUID(), nom: texte(nom, 200) || "image", type: texte(typeMime, 50), ajouteLe: new Date().toISOString() };
      ecrireAtomique(cheminMedia(media.id), chiffrerMedia(cle, octets));
      patient.medias = [...patient.medias, media];
      sauvegarder();
      return media;
    },

    lireMedia(id) {
      exiger();
      const media = patients.flatMap((p) => p.medias).find((m) => m.id === id);
      if (!media) throw new ErreurHistorique(404, "Image introuvable.");
      return { type: media.type || "image/jpeg", octets: dechiffrerMedia(cle, readFileSync(cheminMedia(id))) };
    },

    supprimerMedia(patientId, id) {
      exiger();
      const patient = trouverPatient(patientId);
      patient.medias = patient.medias.filter((m) => m.id !== id);
      rmSync(cheminMedia(id), { force: true });
      sauvegarder();
    },
  };
}
