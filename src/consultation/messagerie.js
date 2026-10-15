// Messagerie : modèles (remplacement des champs) et préparation des documents
// joints (HTML autonome converti en PDF par le serveur du cabinet).
import { renderToStaticMarkup } from "react-dom/server";

export const CHAMPS_MODELES = [
  ["{prenom}", "Prénom du patient"],
  ["{nom}", "Nom du patient"],
  ["{praticien}", "Praticien (en-tête)"],
  ["{cabinet}", "Nom du cabinet du patient"],
  ["{lienRdv}", "Lien de prise de RDV du cabinet"],
  ["{date}", "Date du jour"],
];

export function remplirModele(texte, valeurs) {
  return String(texte || "").replace(/\{(\w+)\}/g, (tout, cle) => (cle in valeurs ? valeurs[cle] || "" : tout));
}

// Feuilles de style de l'application, pour que le PDF ait la même mise en page que l'impression.
function stylesDeLaPage() {
  let css = "";
  for (const feuille of document.styleSheets) {
    try {
      for (const regle of feuille.cssRules) css += `${regle.cssText}\n`;
    } catch {
      // Feuille d'une autre origine : ignorée.
    }
  }
  return css;
}

export function documentHtml(element) {
  const contenu = renderToStaticMarkup(element);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${stylesDeLaPage()}</style></head><body>${contenu}</body></html>`;
}

const SANS_ACCENTS = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "");

// « 20261016_D4561_DevisConventionnel.pdf », comme OrthoFast.
export function nomDocument(patient, libelle, date = new Date().toLocaleDateString("sv-SE")) {
  const code = SANS_ACCENTS(patient?.code) || SANS_ACCENTS(patient?.nom).toUpperCase();
  return `${date.replace(/-/g, "")}_${code}_${libelle}.pdf`;
}

export function fichierEnBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result).split(",")[1] || "");
    lecteur.onerror = () => reject(new Error(`Lecture impossible : ${fichier.name}`));
    lecteur.readAsDataURL(fichier);
  });
}
