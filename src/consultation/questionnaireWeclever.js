// Lecture locale du « questionnaire médical » exporté de WeClever (PDF) : texte et positions
// avec pdf.js, cases cochées mesurées sur le rendu de la page (part de pixels sombres à
// gauche de chaque option). Aucun service en ligne. Résultat à faire valider par le praticien.
import * as pdfjs from "pdfjs-dist";
import urlTravailleur from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = urlTravailleur;

const ECHELLE = 2;
// Part de pixels sombres : cochée ≈ 0,32-0,43 ; vide ≈ 0,11-0,20 (mesures sur un vrai export).
const SEUIL_COCHE = 0.26;
const SEUIL_DOUTE = 0.22;
const ECART_UNIQUE = 0.08;
const SEUIL_MARQUE = 0.06;

// Ligatures « fi », « fl »… parfois extraites en morceaux séparés (« certi fi e ») : recollées.
export function reparer(t) {
  return String(t || "")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB00/g, "ff")
    .replace(/(\p{L}|^|\s) ?(ffi|ffl|fi|fl|ff) (?=\p{L})/gu, (_, avant, lig) => avant + lig);
}

export function normaliser(t) {
  return reparer(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const vide = (t) => !t || /^[.…_\s-]*$/.test(t);
const nettoyer = (t) => {
  const v = reparer(t)
    // Astérisque des champs obligatoires (morceau de texte à part dans l'export) et « : ».
    .replace(/^[\s:*]+/, "")
    .replace(/[.…]{3,}/g, "")
    .trim();
  return vide(v) ? "" : v;
};

// Champs texte : libellé (texte normalisé, début de ligne) → clé.
const CHAMPS = [
  [/^nom de votre mutuelle/, "mutuelle"],
  [/^nom de naissance/, "nomNaissance"],
  [/^nom\b/, "nom"],
  [/^pr[eé]nom\b/, "prenom"],
  [/^date de naissance/, "naissance"],
  [/^poids/, "poids"],
  [/^taille/, "taille"],
  [/^profession des parents/, "professionParents"],
  [/^profession\b/, "profession"],
  [/^numero de telephone/, "telephone"],
  [/^e-?mail\b/, "email"],
  [/^complement d'adresse/, "complementAdresse"],
  [/^adresse\b/, "adresse"],
  [/^code postal/, "codePostal"],
  [/^ville\b/, "ville"],
  [/^numero securite sociale|^numero de securite sociale/, "numeroSecu"],
  [/^probleme de sante general/, "sante"],
  [/^medicaments quotidien/, "medicaments"],
  [/^allergie reconnue/, "allergie"],
  // Questionnaire adulte.
  [/^quel est le motif de votre consultation/, "motifTexte"],
  [/^antecedent orthodontique/, "antecedentOrtho"],
  [/^etes-vous fumeur/, "tabac"],
  [/^date de signature/, "signature"],
];
// Libellé complet (pour séparer la valeur) : fin de la partie « question » du libellé.
const FIN_LIBELLE =
  /^(.*?(\*|\?|\(kg\)|\(cm\)|:|parents|d'adresse|postal|ville|sociale|mutuelle|email|adresse|nom|prenom))\s*(.*)$/;

function noirceur(img, x, yb, h) {
  const x0 = Math.round(x - 1.1 * h);
  const x1 = Math.round(x - 0.25 * h);
  const haut = yb - 0.8 * h;
  const y0 = Math.round(haut + 0.15 * h);
  const y1 = Math.round(haut + h - 0.15 * h);
  let sombres = 0;
  let total = 0;
  for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
    for (let xx = Math.max(0, x0); xx < Math.min(img.width, x1); xx++) {
      const i = (y * img.width + xx) * 4;
      const gris = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      if (gris < 110) sombres++;
      total++;
    }
  }
  return total ? sombres / total : 0;
}

async function lirePage(page) {
  const vue = page.getViewport({ scale: ECHELLE });
  const toile = document.createElement("canvas");
  toile.width = Math.ceil(vue.width);
  toile.height = Math.ceil(vue.height);
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, toile.width, toile.height);
  await page.render({ canvasContext: ctx, viewport: vue }).promise;
  const img = ctx.getImageData(0, 0, toile.width, toile.height);
  const contenu = await page.getTextContent();
  const morceaux = contenu.items
    .filter((it) => it.str && it.str.trim() && it.str.trim() !== "*")
    .map((it) => {
      const [, , c, d, e, f] = it.transform;
      const [x, yb] = vue.convertToViewportPoint(e, f);
      const h = Math.hypot(c, d) * ECHELLE;
      return { s: it.str.trim(), x, yb, h, fin: x + it.width * ECHELLE };
    })
    .sort((a, b) => a.yb - b.yb || a.x - b.x);
  // Lignes (même ligne de base), puis colonnes gauche / droite d'après la position horizontale.
  const lignes = [];
  for (const m of morceaux) {
    const l = lignes.find((x) => Math.abs(x.yb - m.yb) < 0.4 * m.h);
    if (l) l.morceaux.push(m);
    else lignes.push({ yb: m.yb, morceaux: [m] });
  }
  const milieu = toile.width / 2;
  const colonnes = [[], []];
  for (const l of lignes.sort((a, b) => a.yb - b.yb)) {
    const tries = l.morceaux.sort((a, b) => a.x - b.x);
    const gauche = tries.filter((m) => m.x < milieu - 4);
    const droite = tries.filter((m) => m.x >= milieu - 4);
    // Une ligne de gauche qui déborde (pointillés, texte long) reste entière à gauche.
    if (gauche.length && droite.length && gauche.at(-1).fin > milieu) colonnes[0].push(tries);
    else {
      if (gauche.length) colonnes[0].push(gauche);
      if (droite.length) colonnes[1].push(droite);
    }
  }
  const versLigne = (colonne) => (ms, i) => ({
    colonne,
    morceaux: ms,
    texte: reparer(ms.map((m) => m.s).join(" ")),
    x: ms[0].x,
    yb: ms[0].yb,
    h: ms[0].h,
    // Début de colonne : la question en cours ne continue pas d'une colonne à l'autre.
    debutColonne: i === 0,
  });
  return {
    image: toile.toDataURL("image/png"),
    lignes: [...colonnes[0].map(versLigne(0)), ...colonnes[1].map(versLigne(1))],
    mesurer: (m) => noirceur(img, m.x, m.yb, m.h),
  };
}

function decider(question) {
  const opts = question.options;
  if (question.multiple) {
    let doute = false;
    for (const o of opts) {
      o.coche = o.score >= SEUIL_COCHE;
      if (o.score >= SEUIL_DOUTE && o.score < SEUIL_COCHE + 0.02) doute = true;
    }
    question.aVerifier = doute;
    return;
  }
  const tries = [...opts].sort((a, b) => b.score - a.score);
  const [m1, m2] = [tries[0]?.score || 0, tries[1]?.score || 0];
  for (const o of opts) o.coche = false;
  if (!opts.length || m1 < SEUIL_DOUTE) {
    question.aVerifier = false;
    return;
  }
  tries[0].coche = true;
  question.aVerifier = !(m1 >= SEUIL_COCHE && m1 - m2 >= ECART_UNIQUE);
}

// Puce « ▸ » devant certaines questions (parfois lue comme un caractère de contrôle).
// eslint-disable-next-line no-control-regex
const PUCE = /^[\u0000-\u001f▸►•]+\s*/;
const SECTIONS = /^(informations generales|consultation|antecedents medicaux|allergies & pathologies)$/;

export async function lireQuestionnaire(octets) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) pages.push(await lirePage(await pdf.getPage(n)));
  const champs = {};
  const questions = [];
  let tampon = [];
  // Question en bas de la colonne de gauche : ses cases peuvent être en haut de la page suivante.
  let finGauche = [];
  let bloc = null;
  const terminer = (multiple) => {
    if (!bloc) return;
    bloc.multiple = multiple;
    decider(bloc);
    questions.push(bloc);
    bloc = null;
  };
  for (const [numeroPage, page] of pages.entries()) {
    for (let i = 0; i < page.lignes.length; i++) {
      const l = page.lignes[i];
      if (l.debutColonne) {
        if (l.colonne === 1) finGauche = tampon;
        terminer(true);
        tampon = l.colonne === 0 && numeroPage > 0 ? finGauche : [];
      }
      const n = normaliser(l.texte.replace(PUCE, ""));
      if (/^cochez une seule reponse/.test(n) || /^cochez une ou plusieurs reponses/.test(n)) {
        if (!bloc) bloc = { question: tampon.join(" "), options: [] };
        terminer(/plusieurs/.test(n));
        tampon = [];
        continue;
      }
      if (SECTIONS.test(n) || /^page \d+\/\d+$/.test(n)) {
        terminer(true);
        tampon = [];
        continue;
      }
      // Sexe, grossesse : choix sur la même ligne que le libellé (« Oui : ☐ Non …… mois »).
      const enLigne = /^(sexe|grossesse)\b/.exec(n);
      if (enLigne) {
        const avecScore = l.morceaux.slice(1).map((m) => ({ m, score: page.mesurer(m) }));
        const options = avecScore
          .filter((x) => x.score > SEUIL_MARQUE)
          .map((x) => ({ texte: reparer(x.m.s).replace(/\s*:\s*$/, ""), score: x.score }));
        const derniere = avecScore.findLastIndex((x) => x.score > SEUIL_MARQUE);
        const precision = nettoyer(
          avecScore
            .slice(derniere + 1)
            .map((x) => x.m.s)
            .filter((s) => !/^mois$/i.test(s))
            .join(" "),
        );
        const q = { question: enLigne[1] === "sexe" ? "Sexe" : "Grossesse", options, multiple: false, precision };
        decider(q);
        questions.push(q);
        tampon = [];
        continue;
      }
      const score = page.mesurer(l.morceaux[0]);
      if (score > SEUIL_MARQUE) {
        if (!bloc) bloc = { question: tampon.join(" "), options: [] };
        tampon = [];
        const [premier, ...reste] = l.morceaux;
        const autre = /^autre\s*:?/i.test(premier.s);
        bloc.options.push({
          texte: autre ? "Autre" : l.texte,
          ...(autre
            ? { valeur: nettoyer(reste.map((m) => m.s).join(" ") || premier.s.replace(/^autre\s*:?/i, "")) }
            : {}),
          score,
          x: premier.x,
        });
        continue;
      }
      // Suite d'une option sur plusieurs lignes (même alignement que le texte de l'option).
      if (bloc?.options.length && Math.abs(l.x - bloc.options.at(-1).x) < 3) {
        bloc.options.at(-1).texte += ` ${l.texte}`;
        continue;
      }
      if (bloc) terminer(true);
      const champ = CHAMPS.find(([re]) => re.test(n));
      if (champ) {
        const [, cle] = champ;
        if (cle === "signature") {
          const suivante = page.lignes[i + 1];
          champs.signature = nettoyer(suivante && !/signature/i.test(suivante.texte) ? suivante.texte : "");
        } else {
          // Libellé : premiers morceaux jusqu'à reconnaître le champ ; la valeur est le reste.
          let finLibelle = 0;
          let cumul = "";
          for (let k = 0; k < l.morceaux.length; k++) {
            cumul = `${cumul} ${l.morceaux[k].s}`;
            if (champ[0].test(normaliser(cumul.trim().replace(PUCE, "")))) {
              finLibelle = k;
              break;
            }
          }
          let valeur = l.morceaux
            .slice(finLibelle + 1)
            .map((m) => m.s)
            .join(" ");
          if (l.morceaux.length === 1) valeur = (FIN_LIBELLE.exec(l.texte)?.[3] || "").trim();
          if (cle === "poids" || cle === "taille") valeur = valeur.replace(/\s*(kg|cm)\s*$/i, "");
          if (!champs[cle]) champs[cle] = nettoyer(valeur);
        }
        tampon = [];
        continue;
      }
      // Ligne de question (« ▸ » ouvre une nouvelle question sur une ou deux lignes).
      if (PUCE.test(l.texte)) tampon = [l.texte.replace(PUCE, "")];
      else tampon = [...tampon, l.texte].slice(-2);
    }
    // Page sans colonne de droite : la question en attente continue sur la page suivante.
    if (!page.lignes.some((x) => x.colonne === 1)) finGauche = tampon;
  }
  terminer(true);
  // Titre de la page 1 : « QUESTIONNAIRE MEDICAL ENFANT ORTHODONTIE » ou « Ortho adulte ».
  const titres = pages[0]?.lignes.slice(0, 8).map((l) => normaliser(l.texte)) || [];
  const type =
    titres.some((t) => /\badulte\b/.test(t)) && !titres.some((t) => /\benfant\b/.test(t)) ? "adulte" : "enfant";
  return { type, champs, questions, pages: pages.map((p) => p.image) };
}

// ----- Correspondance vers le dossier OrthoAI -----

const RIEN = /^(ras|r\.a\.s\.?|non|aucun|aucune|neant|rien|-|\/)$/i;

function chercher(questions, re) {
  return questions.find((q) => re.test(normaliser(q.question)));
}
const cochees = (q) =>
  (q?.options || [])
    .filter((o) => o.coche)
    .map((o) => (o.texte === "Autre" ? `Autre : ${o.valeur || ""}`.trim() : o.texte));
const unique = (q) => cochees(q)[0] || "";
const accord = (q) => {
  const r = normaliser(unique(q));
  return r.startsWith("j'accepte") ? "accepte" : r.startsWith("je refuse") ? "refuse" : "";
};
const ouiNon = (q) => {
  const r = normaliser(unique(q));
  return r === "oui" ? "Oui" : r === "non" ? "Non" : "";
};

function dateIso(v) {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  if (iso) return iso[0];
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || "");
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

// Résultat de lecture → propositions pour le dossier (à valider dans l'écran de vérification).
export function propositions(lu) {
  const { champs: c, questions } = lu;
  const sexe = normaliser(unique(questions.find((q) => q.question === "Sexe")));
  const telephone = (c.telephone || "").replace(/\s+/g, "");
  const portable = /^(\+33|0033|0)[67]/.test(telephone);
  const qRdv = chercher(questions, /comment avez-vous pris rdv/);
  const qMotif = chercher(questions, /motif de votre visite/);
  const qDerniere = chercher(questions, /consulte un dentiste/);
  const qDeglutition = chercher(questions, /^deglu/);
  const qElocution = chercher(questions, /^elocution/);
  const qSuccion = chercher(questions, /^succion/);
  const qOrl = chercher(questions, /^orl/);
  const qRadios = chercher(questions, /radiographies/);
  const qEnregistrement = chercher(questions, /enregistrer la consultation/);
  const qDepart = chercher(questions, /partir seul/);
  const compact = (t) => normaliser(t).replace(/[^a-z]/g, "");
  const qParo = chercher(questions, /parodont/);
  const qGrossesse = questions.find((q) => q.question === "Grossesse");
  const qEngagements = questions.find((q) => q.options.some((o) => compact(o.texte).startsWith("jecertifie")));
  const connues = [
    qRdv,
    qMotif,
    qDerniere,
    qDeglutition,
    qElocution,
    qSuccion,
    qOrl,
    qRadios,
    qEnregistrement,
    qDepart,
    qEngagements,
    qParo,
    qGrossesse,
  ];
  const grossesse = qGrossesse
    ? ouiNon(qGrossesse) === "Oui"
      ? `Oui${qGrossesse.precision ? ` (${qGrossesse.precision} mois)` : ""}`
      : ouiNon(qGrossesse)
    : undefined;
  const engagement = (debut) => Boolean(qEngagements?.options.find((o) => compact(o.texte).startsWith(debut))?.coche);
  const aVerifier = (q) => Boolean(q?.aVerifier);

  const priseRdv = cochees(qRdv);
  const sante = c.sante || "";
  const medicaments = c.medicaments || "";
  const allergie = c.allergie || "";
  const alerte = [
    ...(grossesse?.startsWith("Oui")
      ? [[qGrossesse.precision ? `${qGrossesse.precision} mois` : "oui", "Grossesse"]]
      : []),
    [allergie, "Allergie"],
    [sante, "Problème de santé"],
    [medicaments, "Médicaments"],
  ]
    .filter(([v]) => v && !RIEN.test(v.trim()))
    .map(([v, l]) => `${l} : ${v}`)
    .join(" · ");

  return {
    type: lu.type,
    identite: {
      nom: (c.nom || "").toUpperCase(),
      prenom: c.prenom || "",
      naissance: dateIso(c.naissance),
      sexe: sexe.startsWith("fem") ? "F" : sexe.startsWith("mas") ? "M" : "",
      [portable ? "portable" : "telephone"]: telephone,
      email: c.email || "",
      envoyePar: priseRdv.join(", "),
    },
    administratif: {
      numeroSecu: (c.numeroSecu || "").replace(/\s+/g, ""),
      adresse: [c.adresse, c.complementAdresse, [c.codePostal, c.ville].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join("\n"),
      mutuelle: c.mutuelle || "",
      ...(lu.type === "adulte" ? { profession: c.profession || "" } : { professionParents: c.professionParents || "" }),
      ...(c.nomNaissance !== undefined ? { nomNaissance: c.nomNaissance } : {}),
    },
    questionnaire: {
      type: lu.type,
      poids: c.poids || "",
      taille: c.taille || "",
      motifs: qMotif ? cochees(qMotif) : c.motifTexte ? [c.motifTexte] : [],
      priseRdv,
      derniereVisiteDentiste: unique(qDerniere),
      sante,
      medicaments,
      allergie,
      deglutition: ouiNon(qDeglutition),
      elocution: ouiNon(qElocution),
      succion: unique(qSuccion),
      orl: cochees(qOrl).map((t) => t.replace(/\s*\?$/, "")),
      // Questionnaire adulte.
      ...(grossesse !== undefined ? { grossesse } : {}),
      ...(c.antecedentOrtho !== undefined ? { antecedentOrtho: c.antecedentOrtho } : {}),
      ...(qParo ? { parodontal: cochees(qParo) } : {}),
      ...(c.tabac !== undefined ? { tabac: c.tabac } : {}),
      accords: {
        radiographies: accord(qRadios),
        radiographiesHonoraires: (qRadios?.question.match(/\(honoraire\s*:?\s*([^)]*)\)/i)?.[1] || "").trim(),
        enregistrement: accord(qEnregistrement),
        ...(qDepart ? { departSeul: accord(qDepart) } : {}),
      },
      engagements: {
        certifie: engagement("jecertifie"),
        donnees: engagement("jacceptequecesinformations"),
        informe: engagement("jereconnaisavoireteinforme"),
        representant: engagement("acochersiremplipar"),
      },
      signature: c.signature || "",
      autres: questions
        .filter((q) => !connues.includes(q) && q.question !== "Sexe" && q.question.trim() && q.options.length)
        .map((q) => ({ question: q.question, reponse: cochees(q).join(", "), aVerifier: aVerifier(q) })),
    },
    alerte,
    aVerifier: {
      sexe: aVerifier(questions.find((q) => q.question === "Sexe")),
      motifs: aVerifier(qMotif),
      priseRdv: aVerifier(qRdv),
      derniereVisiteDentiste: aVerifier(qDerniere),
      deglutition: aVerifier(qDeglutition),
      elocution: aVerifier(qElocution),
      succion: aVerifier(qSuccion),
      orl: aVerifier(qOrl),
      radiographies: aVerifier(qRadios),
      enregistrement: aVerifier(qEnregistrement),
      departSeul: aVerifier(qDepart),
      engagements: aVerifier(qEngagements),
      grossesse: aVerifier(qGrossesse),
      parodontal: aVerifier(qParo),
    },
  };
}

// Même patient : nom, prénom et date de naissance identiques (accents et majuscules ignorés).
// (Un dossier sans date de naissance, ou avec « * » d'un ancien import, est aussi reconnu.)
const sansEtoile = (t) => normaliser(t).replace(/^[*\s]+/, "");
export function memePatient(p, identite) {
  return (
    sansEtoile(p.nom) === sansEtoile(identite.nom) &&
    sansEtoile(p.prenom) === sansEtoile(identite.prenom) &&
    (!p.naissance || p.naissance === identite.naissance)
  );
}

// Aperçu d'un PDF (pages en images), pour l'afficher dans l'application.
export async function imagesPdf(octets) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false }).promise;
  const images = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vue = page.getViewport({ scale: 1.6 });
    const toile = document.createElement("canvas");
    toile.width = Math.ceil(vue.width);
    toile.height = Math.ceil(vue.height);
    await page.render({ canvasContext: toile.getContext("2d"), viewport: vue }).promise;
    images.push(toile.toDataURL("image/png"));
  }
  return images;
}
