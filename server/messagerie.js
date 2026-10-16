// Envoi d'e-mails depuis l'application (compte Gmail du cabinet, mot de passe
// d'application). Les réglages, dont le mot de passe, sont rangés dans le coffre
// chiffré ; le mot de passe n'est jamais renvoyé aux postes.
import nodemailer from "nodemailer";

const texte = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

export const CATEGORIES_MODELES = ["Devis", "Compte rendu", "Facturation", "Rendez-vous", "Courrier", "Autre"];

// Modèles proposés au départ (repris des messages types d'OrthoFast), modifiables.
const devis = (id, traitement) => ({
  id,
  categorie: "Devis",
  nom: `Devis ${traitement}`,
  objet: `Cabinet d'Orthodontie du {praticien} - Devis ${traitement}`,
  corps: `Bonjour,

Ci-joint votre devis d'orthodontie pour des ${traitement}.

Vous pouvez prendre un prochain RDV pour un bilan orthodontique (empreintes optiques, photographies, radiographies) via Doctolib ou par retour de mail.

Prise de RDV :
{lienRdv}

Je reste à votre disposition pour tout complément d'information.`,
});

export const MODELES_PAR_DEFAUT = [
  devis("devis-metal", "brackets métalliques"),
  devis("devis-ceramique", "brackets céramo-métalliques"),
  {
    ...devis("devis-gouttieres", "gouttières d'alignement"),
    corps: devis("", "gouttières d'alignement").corps.replace("pour des gouttières", "par gouttières"),
  },
  {
    id: "cr-patient",
    categorie: "Compte rendu",
    nom: "Compte rendu au patient",
    objet: "Compte rendu du {praticien}",
    corps:
      "Bonjour,\n\nVeuillez trouver ci-joint le compte rendu du {praticien} concernant votre consultation.\n\nBien cordialement,",
  },
  {
    id: "cr-plan",
    categorie: "Compte rendu",
    nom: "Plan de traitement",
    objet: "Plan de traitement - {praticien}",
    corps:
      "Bonjour,\n\nVeuillez trouver ci-joint le compte rendu du plan de traitement du {praticien}.\n\nBien cordialement,",
  },
  {
    id: "cr-chirurgien",
    categorie: "Courrier",
    nom: "Courrier chirurgien maxillo-facial",
    objet: "Compte rendu Chirurgien Maxillo-Facial - {praticien}",
    corps:
      "Bonjour,\n\nComme convenu, ci-joint votre courrier pour le chirurgien maxillo-facial.\n\nBien cordialement,",
  },
  {
    id: "courrier-confrere",
    categorie: "Courrier",
    nom: "Courrier pour un confrère",
    objet: "Courrier du {praticien} concernant {prenom} {nom}",
    corps:
      "Bonjour,\n\nVeuillez trouver ci-joint le courrier du {praticien} concernant {prenom} {nom}.\n\nBien cordialement,",
  },
  {
    id: "courrier-patient",
    categorie: "Courrier",
    nom: "Courrier remis au patient",
    objet: "Votre courrier - {praticien}",
    corps: "Bonjour,\n\nComme convenu, veuillez trouver ci-joint votre courrier.\n\nBien cordialement,",
  },
  {
    id: "ordonnance",
    categorie: "Courrier",
    nom: "Ordonnance",
    objet: "Votre ordonnance - {praticien}",
    corps: "Bonjour,\n\nVeuillez trouver ci-joint votre ordonnance.\n\nBien cordialement,",
  },
  {
    id: "facturation-semestre",
    categorie: "Facturation",
    nom: "Facturation d'un semestre (avant la pose et chaque semestre)",
    objet: "Votre prochain rendez-vous d'orthodontie",
    corps: `Bonjour,

Lors de votre prochain rendez-vous d'orthodontie, une facturation correspondant à un semestre de traitement sera effectuée.
Merci de vous munir de votre carte Vitale et d'un moyen de règlement.

Bien cordialement,
L'équipe du cabinet d'orthodontie`,
  },
  {
    id: "depose",
    categorie: "Facturation",
    nom: "Dépose de l'appareil et contention",
    objet: "Fin de votre traitement orthodontique",
    corps: `Bonjour,

Votre prochain rendez-vous marquera la fin de votre traitement orthodontique, avec la dépose de l'appareil et la mise en place des contentions.

Le règlement de 750 € (CB, chèque ou espèces) correspondant à cette étape vous sera demandé en début de séance.

Ce montant comprend également :
- un rendez-vous de contrôle à 1 mois,
- puis des visites de suivi tous les 4 mois pendant la première année.

NB : Conformément aux modalités de la Sécurité sociale, une télétransmission (TO75) sera effectuée lors des séances de suivi de la contention.

Bien cordialement,
L'équipe du cabinet d'orthodontie`,
  },
  {
    id: "recommandations",
    categorie: "Courrier",
    nom: "Fiche de recommandations (pose d'appareil)",
    objet: "Recommandations pour votre appareil - {praticien}",
    corps:
      "Bonjour,\n\nSuite à la pose de l'appareil, veuillez trouver ci-joint la fiche de recommandations à conserver.\n\nN'hésitez pas à contacter le cabinet pour toute question.\n\nBien cordialement,",
  },
  {
    id: "rdv-refixer",
    categorie: "Rendez-vous",
    nom: "Refixer un rendez-vous",
    objet: "Cabinet d'orthodontie du {praticien}",
    corps:
      "Bonjour,\n\nJe me permets de vous contacter pour refixer un rendez-vous concernant {prenom}.\n\nPrise de RDV :\n{lienRdv}\n\nBien cordialement,",
  },
];

export const MESSAGERIE_PAR_DEFAUT = {
  adresse: "",
  nom: "",
  motDePasse: "",
  signature: "",
  liensRdv: {},
  modeles: MODELES_PAR_DEFAUT,
  // Modèles fournis par défaut que le cabinet a supprimés (ne pas les rajouter).
  modelesRetires: [],
};

const IDS_PAR_DEFAUT = MODELES_PAR_DEFAUT.map((m) => m.id);

export function nettoyerMessagerie(brut, precedent = MESSAGERIE_PAR_DEFAUT, { enregistrement = false } = {}) {
  const adresse = texte(brut?.adresse, 200).trim().toLowerCase();
  const motDePasse = texte(brut?.motDePasse, 100).replace(/\s+/g, "");
  const liensRdv = {};
  for (const [lieu, lien] of Object.entries(brut?.liensRdv || {}).slice(0, 10))
    if (/^[\w-]{1,30}$/.test(lieu)) liensRdv[lieu] = texte(lien, 2000).trim();
  const modeles = Array.isArray(brut?.modeles)
    ? brut.modeles.slice(0, 200).map((m, i) => ({
        id: texte(m?.id, 60) || `modele-${Date.now()}-${i}`,
        categorie: CATEGORIES_MODELES.includes(m?.categorie) ? m.categorie : "Autre",
        nom: texte(m?.nom, 200),
        objet: texte(m?.objet, 500),
        corps: texte(m?.corps, 20000),
      }))
    : precedent.modeles;
  // Modèles par défaut supprimés à cet enregistrement : retenus pour ne pas revenir.
  const supprimes =
    enregistrement && Array.isArray(brut?.modeles)
      ? (precedent.modeles || []).map((m) => m.id).filter((id) => !modeles.some((m) => m.id === id))
      : [];
  const retires = [
    ...new Set([
      ...(Array.isArray(brut?.modelesRetires) ? brut.modelesRetires : precedent.modelesRetires || []),
      ...supprimes,
    ]),
  ].filter((id) => IDS_PAR_DEFAUT.includes(id));
  // Nouveaux modèles par défaut (ajoutés à une mise à jour) : proposés au cabinet.
  const complets = [
    ...modeles,
    ...MODELES_PAR_DEFAUT.filter((m) => !retires.includes(m.id) && !modeles.some((x) => x.id === m.id)),
  ];
  return {
    adresse: adresse || precedent.adresse,
    nom: texte(brut?.nom, 200),
    // Champ laissé vide : on garde le mot de passe déjà enregistré.
    motDePasse: motDePasse || precedent.motDePasse,
    signature: texte(brut?.signature, 5000),
    liensRdv,
    modeles: complets,
    modelesRetires: retires,
  };
}

// Version envoyée aux postes : sans le mot de passe.
export function messageriePublique(m) {
  const { motDePasse, ...reste } = m;
  return { ...reste, motDePasseEnregistre: Boolean(motDePasse) };
}

function transporteur(m) {
  if (!m.adresse || !m.motDePasse)
    throw Object.assign(
      new Error(
        "Messagerie non configurée : renseignez l'adresse Gmail et le mot de passe d'application dans Paramètres.",
      ),
      { statut: 400 },
    );
  // Tests automatiques uniquement : faux serveur local, jamais Gmail.
  const test = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(process.env.ORTHOAI_SMTP_TEST || "");
  if (test)
    return nodemailer.createTransport({
      host: test[1],
      port: Number(test[2]),
      secure: false,
      ignoreTLS: true,
      auth: { user: m.adresse, pass: m.motDePasse },
    });
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: m.adresse, pass: m.motDePasse },
  });
}

function messageErreur(err) {
  if (err?.statut) return err.message;
  if (err?.responseCode === 535 || /Invalid login|Username and Password/i.test(err?.message || ""))
    return "Gmail refuse la connexion : vérifiez l'adresse et le mot de passe d'application (16 lettres, pas le mot de passe habituel du compte).";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET/.test(err?.code || ""))
    return "Impossible de joindre Gmail : vérifiez la connexion Internet du serveur.";
  return `Envoi impossible : ${err?.message || "erreur inconnue"}`;
}

export async function verifierMessagerie(m) {
  try {
    await transporteur(m).verify();
  } catch (err) {
    throw Object.assign(new Error(messageErreur(err)), { statut: 400 });
  }
}

const ADRESSE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function listeAdresses(v) {
  const liste = String(v || "")
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  for (const a of liste)
    if (!ADRESSE.test(a)) throw Object.assign(new Error(`Adresse e-mail invalide : ${a}`), { statut: 400 });
  return liste.slice(0, 20);
}

function echapper(t) {
  return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Texte → HTML simple : paragraphes et liens cliquables.
export function texteVersHtml(t) {
  return echapper(t)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\n/g, "<br>");
}

export async function envoyerMail(m, { a, cc, objet, corps, pieces }) {
  const destinataires = listeAdresses(a);
  if (!destinataires.length) throw Object.assign(new Error("Indiquez au moins un destinataire."), { statut: 400 });
  const texteComplet = m.signature ? `${corps}\n\n${m.signature}` : corps;
  try {
    const info = await transporteur(m).sendMail({
      from: m.nom ? { name: m.nom, address: m.adresse } : m.adresse,
      to: destinataires,
      cc: listeAdresses(cc),
      subject: objet,
      text: texteComplet,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px">${texteVersHtml(texteComplet)}</div>`,
      attachments: pieces.map((p) => ({ filename: p.nom, content: p.contenu, contentType: p.type })),
    });
    return { id: info.messageId, acceptes: info.accepted?.length ?? destinataires.length };
  } catch (err) {
    throw Object.assign(new Error(messageErreur(err)), { statut: 400 });
  }
}
