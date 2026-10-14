// Résumé en tirets du diagnostic et du plan de traitement, joint aux courriers
// aux confrères. Construit à partir du compte rendu tel que corrigé.

const LIGNES_DIAGNOSTIC = [
  ["formule_dentaire", ""],
  ["sens_transversal", "Sens transversal"],
  ["sens_vertical", "Sens vertical"],
  ["sens_antero_posterieur", "Sens antéro-postérieur"],
  ["malpositions", "Malpositions"],
  ["classe_squelettique", "Classe squelettique"],
  ["panoramique", "Panoramique"],
];

// Conseils remis au patient, pas une étape du traitement.
const HORS_PLAN = ["recommandations_bagues"];

function ligne(libelle, valeur) {
  const texte = (valeur || "").trim().replace(/\.$/, "");
  if (!texte) return null;
  return libelle ? `${libelle} : ${texte}` : texte[0].toUpperCase() + texte.slice(1);
}

export function resumeClinique(rapport, appareils) {
  const d = rapport.diagnostic;
  const plan = rapport.plan_traitement;
  const encombrement = [d.encombrement, d.encombrement_precision].filter(Boolean).join(" – ");

  const diagnostic = [
    ...LIGNES_DIAGNOSTIC.slice(0, 5).map(([cle, libelle]) => ligne(libelle, d[cle])),
    ligne("Encombrement", encombrement),
    ...LIGNES_DIAGNOSTIC.slice(5).map(([cle, libelle]) => ligne(libelle, d[cle])),
  ].filter(Boolean);

  const traitement = [
    ...plan.appareils
      .filter((id) => !HORS_PLAN.includes(id))
      .map((id) => appareils.find((a) => a.id === id)?.nom)
      .filter(Boolean),
    ...plan.appareils_hors_catalogue,
    plan.duree_estimee && `Durée estimée : ${plan.duree_estimee}`,
  ].filter(Boolean);

  return { diagnostic, traitement };
}
