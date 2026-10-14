import { useState } from "react";
import AnnotationImage from "./AnnotationImage.jsx";
import { accorder, age, dateLongue, formaterDate, nomPatient } from "./format.js";
import { TYPES_COURRIER, nouveauCourrier } from "./modelesCourriers.js";

// Édition des courriers aux confrères proposés dans le compte rendu.
export function CourriersEdition({
  courriers,
  onChange,
  onImprimer,
  vide = "Aucun courrier proposé : aucun adressage n'a été évoqué pendant la consultation.",
  dater = false,
  // Dossier patient : images à joindre (annotées) aux courriers.
  medias = null,
  onJoindreImage,
}) {
  // Image en cours de choix pour un courrier : { index, media? }.
  const [choix, setChoix] = useState(null);
  const modifier = (index, champ, valeur) =>
    onChange(courriers.map((c, i) => (i === index ? { ...c, [champ]: valeur } : c)));
  const supprimer = (index) => {
    if (window.confirm("Supprimer ce courrier ?")) onChange(courriers.filter((_, i) => i !== index));
  };

  return (
    <>
      {courriers.length === 0 && <p className="cr-aide">{vide}</p>}
      {courriers.map((c, i) => (
        <div key={i} className="cr-courrier">
          <div className="cr-titre-section">
            <strong>
              {TYPES_COURRIER[c.destinataire]?.ordonnance ? "Ordonnance" : "Courrier"} ·{" "}
              {TYPES_COURRIER[c.destinataire]?.libelle || c.destinataire}
              {dater && c.date && <span className="cr-aide"> · {formaterDate(c.date)}</span>}
            </strong>
            <div className="cr-actions">
              <button type="button" className="secondaire" onClick={() => onImprimer(i)}>
                {TYPES_COURRIER[c.destinataire]?.ordonnance ? "Imprimer l'ordonnance" : "Imprimer ce courrier"}
              </button>
              <button type="button" className="danger" onClick={() => supprimer(i)}>
                Supprimer
              </button>
            </div>
          </div>
          {!TYPES_COURRIER[c.destinataire]?.ordonnance && (
            <div className="cr-champs-ligne">
              <label>
                Destinataire (facultatif, reste sur cet ordinateur)
                <textarea
                  rows={2}
                  value={c.nom_destinataire || ""}
                  placeholder={"Ex. : Dr Martin\n12 rue de Versailles, 78150 Le Chesnay"}
                  onChange={(e) => modifier(i, "nom_destinataire", e.target.value)}
                />
              </label>
              <label>
                Objet
                <input value={c.motif} onChange={(e) => modifier(i, "motif", e.target.value)} />
              </label>
            </div>
          )}
          <label className="cr-bloc">
            {TYPES_COURRIER[c.destinataire]?.ordonnance
              ? "Ordonnance (le nom et l'âge du patient sont ajoutés automatiquement)"
              : "Texte du courrier ([patient] sera remplacé par le nom du patient)"}
            <textarea rows={8} value={c.corps} onChange={(e) => modifier(i, "corps", e.target.value)} />
          </label>
          {medias && !TYPES_COURRIER[c.destinataire]?.ordonnance && (
            <div className="cr-courrier-image-edition cr-bloc">
              {c.image ? (
                <>
                  <img src={`/api/patients/media/${c.image}`} alt="Image jointe" />
                  <span>Image annotée jointe au courrier</span>
                  <button type="button" className="danger" onClick={() => modifier(i, "image", "")}>
                    Retirer
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondaire"
                  disabled={!medias.length}
                  title={medias.length ? "" : "Ajoutez d'abord des radios dans l'onglet Photos & radios"}
                  onClick={() => setChoix({ index: i })}
                >
                  + Joindre une radio annotée
                </button>
              )}
            </div>
          )}
          {!TYPES_COURRIER[c.destinataire]?.ordonnance && (
            <label className="cr-case cr-bloc">
              <input
                type="checkbox"
                checked={!c.sans_resume}
                onChange={(e) => modifier(i, "sans_resume", !e.target.checked)}
              />
              Joindre le résumé du diagnostic et du plan de traitement (repris du compte rendu)
            </label>
          )}
        </div>
      ))}
      {choix && !choix.media && (
        <div className="cr-visionneuse" role="dialog" aria-label="Choisir une image" onClick={() => setChoix(null)}>
          <div className="cr-choix-image" onClick={(e) => e.stopPropagation()}>
            <h2>Choisir la radio à joindre</h2>
            <div className="cr-galerie">
              {medias.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="cr-vignette"
                  title={m.nom}
                  onClick={() => setChoix({ ...choix, media: m })}
                >
                  <img src={`/api/patients/media/${m.id}`} alt={m.nom} loading="lazy" />
                </button>
              ))}
            </div>
            <button type="button" className="secondaire cr-bloc" onClick={() => setChoix(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {choix?.media && (
        <AnnotationImage
          src={`/api/patients/media/${choix.media.id}`}
          nom={choix.media.nom}
          onAnnuler={() => setChoix(null)}
          onValider={async (fichier) => {
            await onJoindreImage(choix.index, fichier);
            setChoix(null);
          }}
        />
      )}
      <div className="cr-ajout-courrier">
        <span>Ajouter un courrier :</span>
        {Object.entries(TYPES_COURRIER).map(([type, { libelle }]) => (
          <button
            key={type}
            type="button"
            className="secondaire"
            onClick={() => onChange([...courriers, nouveauCourrier(type)])}
          >
            + {libelle}
          </button>
        ))}
      </div>
    </>
  );
}

// Courrier ou ordonnance imprimé sur le papier à en-tête du cabinet.
function ResumeClinique({ resume }) {
  const { diagnostic, traitement } = resume;
  return (
    <>
      <ListeTirets titre="Diagnostic orthodontique :" lignes={diagnostic} />
      <ListeTirets titre="Plan de traitement envisagé :" lignes={traitement} />
    </>
  );
}

function ListeTirets({ titre, lignes }) {
  if (!lignes.length) return null;
  return (
    <div className="cr-resume-clinique">
      <strong>{titre}</strong>
      <ul>
        {lignes.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

// « resume » : lignes du diagnostic et du plan de traitement jointes à la lettre.
export function CourrierDocument({ courrier, patient, cabinet, resume }) {
  const type = TYPES_COURRIER[courrier.destinataire] || TYPES_COURRIER.dentiste;
  const nom = nomPatient(patient);
  const agePatient = age(patient.naissance, patient.date);
  const corps = accorder(courrier.corps.replaceAll("[patient]", nom || "le patient"), patient.sexe, cabinet.genre);
  const date = dateLongue(patient.date);

  return (
    <article className="cr-document cr-imprime-seul cr-lettre">
      <header className="cr-lettre-entete">
        {cabinet.logo ? <img className="cr-lettre-logo" src={cabinet.logo} alt="" /> : <span />}
        <div className="cr-lettre-praticien">
          {cabinet.praticien && <strong>{cabinet.praticien}</strong>}
          {cabinet.cabinet && <div>{cabinet.cabinet}</div>}
          {cabinet.coordonnees && <div>{cabinet.coordonnees}</div>}
          {cabinet.telephone && <div>{cabinet.telephone}</div>}
          {cabinet.email && <div>{cabinet.email}</div>}
          {cabinet.identifiant && <div>{cabinet.identifiant}</div>}
        </div>
      </header>

      <p className="cr-lettre-date">{cabinet.ville ? `${cabinet.ville}, le ${date}` : `Le ${date}`}</p>

      {type.ordonnance ? (
        <>
          <p className="cr-lettre-patient-titre">Prénom et Nom du patient :</p>
          <p>{[nom, agePatient].filter(Boolean).join(", ")}</p>
          <div className="cr-courrier-corps cr-ordonnance">{corps}</div>
        </>
      ) : (
        <>
          <div className="cr-courrier-destinataire">{courrier.nom_destinataire || type.attention}</div>
          <p className="cr-courrier-objet">
            <strong>Objet :</strong> {courrier.motif}
            {nom && (
              <>
                {" "}
                — {nom}
                {agePatient && <>, {agePatient}</>}
              </>
            )}
          </p>
          <p>{type.appel}</p>
          <div className="cr-courrier-corps">{corps}</div>
          {!courrier.sans_resume && resume && <ResumeClinique resume={resume} />}
          {courrier.image && (
            <figure className="cr-courrier-figure">
              <img src={`/api/patients/media/${courrier.image}`} alt="" />
            </figure>
          )}
          <p>{type.politesse}</p>
        </>
      )}

      <div className="cr-lettre-signature">
        {cabinet.praticien && <div>{cabinet.praticien}</div>}
        {cabinet.signature && <img src={cabinet.signature} alt="" />}
      </div>

      {(cabinet.coordonnees || cabinet.email) && (
        <footer className="cr-lettre-pied">
          {cabinet.coordonnees && <div>{cabinet.coordonnees}</div>}
          {cabinet.email && <div>{cabinet.email}</div>}
        </footer>
      )}
    </article>
  );
}
