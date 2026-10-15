// Onglet « Résumé à copier » : diagnostic et plan de traitement en texte
// simple, à coller dans l'ancien logiciel (OrthoFast).
import { useState } from "react";
import { resumeClinique } from "./resumeClinique.js";

function texteDents(libelle, dents) {
  return dents?.length ? `${libelle} : ${dents.join(", ")}` : null;
}

function blocsACopier(rapport, appareils) {
  const { diagnostic, traitement } = resumeClinique(rapport, appareils);
  const tirets = (lignes) =>
    lignes
      .filter(Boolean)
      .map((l) => `- ${l}`)
      .join("\n");
  return [
    ["motif", "Motif", (rapport.motif || "").trim()],
    [
      "diagnostic",
      "Diagnostic",
      tirets([
        ...diagnostic,
        texteDents("Agénésies", rapport.dents?.agenesies),
        texteDents("Dents incluses", rapport.dents?.incluses),
      ]),
    ],
    ["plan", "Plan de traitement", tirets([texteDents("Extractions", rapport.dents?.a_extraire), ...traitement])],
  ];
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    // Ancien navigateur ou page non sécurisée : copie par une zone de texte cachée.
    const zone = document.createElement("textarea");
    zone.value = texte;
    document.body.appendChild(zone);
    zone.select();
    document.execCommand("copy");
    zone.remove();
  }
}

export default function ResumeACopier({ rapport, appareils }) {
  // Retouches faites ici ; sinon le texte suit le compte rendu (même régénéré).
  const [retouches, setRetouches] = useState({});
  const [copie, setCopie] = useState("");
  const blocs = blocsACopier(rapport, appareils);
  const textes = Object.fromEntries(blocs.map(([c, , t]) => [c, retouches[c] ?? t]));

  async function copierBloc(cle, texte) {
    await copier(texte);
    setCopie(cle);
    setTimeout(() => setCopie((c) => (c === cle ? "" : c)), 2000);
  }

  const tout = blocs
    .filter(([cle]) => textes[cle]?.trim())
    .map(([cle, titre]) => `${titre.toUpperCase()}\n${textes[cle].trim()}`)
    .join("\n\n");

  return (
    <div className="oa-copier">
      <p className="cr-aide">
        Texte simple, prêt à coller dans votre logiciel. Vous pouvez l'ajuster ici avant de copier ; ces retouches ne
        modifient pas le compte rendu.
      </p>
      {blocs.map(([cle, titre]) => (
        <div key={cle} className="oa-copier-bloc">
          <div className="cr-titre-section">
            <h3>{titre}</h3>
            <button
              type="button"
              className={copie === cle ? "principal" : "secondaire"}
              onClick={() => copierBloc(cle, textes[cle])}
            >
              {copie === cle ? "✓ Copié" : "Copier"}
            </button>
          </div>
          <textarea
            rows={Math.max(2, (textes[cle] || "").split("\n").length + 1)}
            value={textes[cle]}
            placeholder="Rien pour cette partie."
            onChange={(e) => setRetouches({ ...retouches, [cle]: e.target.value })}
          />
        </div>
      ))}
      <div className="cr-actions">
        <button
          type="button"
          className={copie === "tout" ? "principal" : "secondaire"}
          onClick={() => copierBloc("tout", tout)}
        >
          {copie === "tout" ? "✓ Tout copié" : "Tout copier"}
        </button>
        <button type="button" className="cr-lien" onClick={() => setRetouches({})}>
          Reprendre le texte du compte rendu
        </button>
      </div>
    </div>
  );
}
