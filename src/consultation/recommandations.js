// Fiches de recommandations remises au patient à la pose d'un appareil :
// appareils du catalogue proposés d'après le devis, le type du patient ou l'appareil posé.
import { normaliser } from "./questionnaireWeclever.js";

// Mots qui désignent chaque appareil du catalogue (texte libre : type, laboratoire…).
const MOTS = {
  disjoncteur: /disjoncteur/,
  quad_helix: /quad.?helix/,
  activateur: /activateur/,
  pul2: /\bpul\b|pul ?2|propulseur/,
  masque_delaire: /masque|delaire/,
  plaque_amovible: /plaque/,
  eln: /\beln\b|enveloppe linguale/,
  multi_attaches_ceramique: /ceram/,
  multi_attaches_metal: /multi.?attache|bagues? metal|metalliques?|brackets?/,
  elastiques_inter_maxillaires: /elastique/,
  carriere: /carriere/,
  aligneurs: /aligneur|gouttieres? d'alignement|spark|invisalign|tt gouttiere/,
  mainteneur_espace: /mainteneur/,
  contention: /contention/,
};

const PAR_TRAITEMENT = {
  metal: ["multi_attaches_metal"],
  ceramique: ["multi_attaches_ceramique"],
  aligneurs: ["aligneurs"],
};

export function appareilsSuggeres({ patient, catalogue, libelle }) {
  const ids = new Set();
  const ajouterDepuis = (texte) => {
    const t = normaliser(texte);
    if (!t) return;
    for (const [id, re] of Object.entries(MOTS)) if (re.test(t)) ids.add(id);
    // « Multi-attaches » céramique : pas de fiche métal en plus.
    if (ids.has("multi_attaches_ceramique")) ids.delete("multi_attaches_metal");
  };
  if (libelle) ajouterDepuis(libelle);
  else {
    const devis = (patient.gestion?.devis || []).find((d) => d.valide) || (patient.gestion?.devis || []).at(-1);
    for (const id of PAR_TRAITEMENT[devis?.traitement] || []) ids.add(id);
    if (!ids.size) ajouterDepuis([patient.type, devis?.description].filter(Boolean).join(" "));
  }
  if (ids.has("multi_attaches_metal") || ids.has("multi_attaches_ceramique")) ids.add("recommandations_bagues");
  return catalogue.filter((a) => ids.has(a.id)).map((a) => a.id);
}
