// Onglet Patient : questionnaire médical importé de WeClever (réponses validées, PDF chiffré).
import { useState } from "react";
import { formaterDate } from "./format.js";
import VisionneusePdf from "./VisionneusePdf.jsx";

const ACCORD = { accepte: "Accepte", refuse: "Refuse" };

export default function QuestionnaireMedical({ questionnaire: q, onImporter }) {
  const [apercu, setApercu] = useState(false);
  const ligne = (libelle, valeur, alerte = false) =>
    valeur ? (
      <tr>
        <th>{libelle}</th>
        <td className={alerte ? "oa-q-refus" : undefined}>{Array.isArray(valeur) ? valeur.join(", ") : valeur}</td>
      </tr>
    ) : null;
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Questionnaire médical</h2>
        <div className="cr-actions">
          {q?.pdf && (
            <button
              type="button"
              className="secondaire"
              onClick={() => setApercu(true)}
            >
              Ouvrir le PDF
            </button>
          )}
          <button type="button" className="secondaire" onClick={onImporter}>
            {q?.importeLe ? "Importer un nouveau questionnaire" : "Importer le questionnaire WeClever (PDF)"}
          </button>
        </div>
      </div>
      {apercu && (
        <VisionneusePdf
          mediaId={q.pdf}
          nom={`questionnaire-medical-${(q.importeLe || "").slice(0, 10)}.pdf`}
          onFermer={() => setApercu(false)}
        />
      )}
      {!q?.importeLe ? (
        <p className="cr-aide">Aucun questionnaire importé.</p>
      ) : (
        <table className="oa-table oa-table-fiche">
          <tbody>
            {ligne(
              "Questionnaire",
              `${q.type === "adulte" ? "Adulte" : "Enfant"} · importé le ${formaterDate(q.importeLe.slice(0, 10))}${q.signature ? ` · signé le ${q.signature}` : ""}`,
            )}
            {ligne("Motif(s)", q.motifs)}
            {ligne("Prise de RDV", q.priseRdv)}
            {ligne("Dernière visite chez le dentiste", q.derniereVisiteDentiste)}
            {ligne(
              "Poids / taille",
              [q.poids && `${q.poids} kg`, q.taille && `${q.taille} cm`].filter(Boolean).join(" · "),
            )}
            {ligne("Problème de santé", q.sante)}
            {ligne("Médicaments", q.medicaments)}
            {ligne("Allergie", q.allergie)}
            {ligne("Déglutition (mal à avaler)", q.deglutition)}
            {ligne("Élocution / dyslexie", q.elocution)}
            {ligne("Succion", q.succion)}
            {ligne("ORL", q.orl)}
            {(q.autres || []).filter((a) => a.question?.trim()).map((a) => ligne(a.question, a.reponse))}
            {ligne(
              "Radiographies",
              q.accords?.radiographies &&
                `${ACCORD[q.accords.radiographies]}${q.accords.radiographiesHonoraires ? ` (${q.accords.radiographiesHonoraires})` : ""}`,
              q.accords?.radiographies === "refuse",
            )}
            {ligne(
              "Enregistrement de la consultation",
              ACCORD[q.accords?.enregistrement],
              q.accords?.enregistrement === "refuse",
            )}
            {ligne("Départ seul après les soins", ACCORD[q.accords?.departSeul])}
          </tbody>
        </table>
      )}
    </section>
  );
}
