// Fenêtre « Fiche de recommandations » : appareils du catalogue (proposés d'après
// l'appareil posé), puis impression ou envoi par e-mail en PDF.
import { useState } from "react";
import { FicheRecommandationsDocument } from "./DocumentsGestion.jsx";
import EnvoiMail from "./EnvoiMail.jsx";
import { nomDocument } from "./messagerie.js";
import { appareilsSuggeres } from "./recommandations.js";

export default function RecommandationsAppareil({
  patient,
  cabinet,
  catalogue,
  libelle,
  onImprimer,
  onEnvoye,
  onFermer,
}) {
  const disponibles = catalogue.filter((a) => (a.texte || "").trim());
  const [choisis, setChoisis] = useState(() => appareilsSuggeres({ patient, catalogue: disponibles, libelle }));
  const [envoi, setEnvoi] = useState(false);
  const appareils = disponibles.filter((a) => choisis.includes(a.id));
  const document = <FicheRecommandationsDocument patient={patient} cabinet={cabinet} appareils={appareils} />;

  if (envoi)
    return (
      <EnvoiMail
        patient={patient}
        cabinet={cabinet}
        categorie="Courrier"
        modeleInitial="recommandations"
        documents={[{ nom: nomDocument(patient, "Recommandations"), element: document }]}
        onFermer={onFermer}
        onEnvoye={onEnvoye}
      />
    );
  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="Fiche de recommandations">
      <section className="cr-carte oa-modale">
        <div className="cr-titre-section">
          <h2>Fiche de recommandations</h2>
          <button type="button" className="cr-lien" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="cr-aide">
          {libelle ? `Appareil posé : ${libelle}. ` : ""}Cochez les fiches à remettre au patient (textes modifiables
          dans Paramètres → catalogue des appareils).
        </p>
        <ul className="oa-reco-liste">
          {disponibles.map((a) => (
            <li key={a.id}>
              <label className="cr-case">
                <input
                  type="checkbox"
                  checked={choisis.includes(a.id)}
                  onChange={(e) =>
                    setChoisis(e.target.checked ? [...choisis, a.id] : choisis.filter((id) => id !== a.id))
                  }
                />{" "}
                {a.nom}
              </label>
            </li>
          ))}
        </ul>
        <div className="cr-actions">
          <button type="button" className="principal" disabled={!appareils.length} onClick={() => setEnvoi(true)}>
            Envoyer par e-mail (PDF)
          </button>
          <button
            type="button"
            className="secondaire"
            disabled={!appareils.length}
            onClick={() => onImprimer(document)}
          >
            Imprimer
          </button>
          <button type="button" className="secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>
    </div>
  );
}
