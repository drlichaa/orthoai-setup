import { useState } from "react";
import { age, formaterDate } from "./format.js";
import { OPERATIONS, transformerImage, trierFichiers } from "./scenarios.js";
import VisionneuseSTL from "./VisionneuseSTL.jsx";

// Séries d'images du dossier (bilan, contrôle, radios, empreintes 3D), sur le
// modèle des scénarios d'OrthoFast : chaque photo a sa case, ses opérations
// (rotation, symétrie) sont appliquées à l'envoi, et la planche s'imprime.

const LIBELLES_OPERATIONS = Object.fromEntries(OPERATIONS);
const CORRECTIONS = [
  ["rotG", "⟲", "Tourner à gauche"],
  ["rotD", "⟳", "Tourner à droite"],
  ["symH", "⇅", "Retourner haut / bas"],
  ["symV", "⇆", "Retourner gauche / droite"],
];

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

const url = (id) => `/api/patients/media/${id}`;

function Case({ element, valeur, scenario, envoi, onFichiers, onCorriger, onRetirer, onDate, onVoir }) {
  const [survol, setSurvol] = useState(false);
  const stl = scenario.genre === "stl";
  const deposer = (e) => {
    e.preventDefault();
    setSurvol(false);
    if (e.dataTransfer.files.length) onFichiers([...e.dataTransfer.files].slice(0, 1));
  };
  return (
    <div
      className={`cr-case-image${survol ? " survol" : ""}${valeur ? " remplie" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={deposer}
    >
      <div className="cr-case-titre">
        {element.nom}
        {element.operations.length > 0 && (
          <span title={element.operations.map((o) => LIBELLES_OPERATIONS[o]).join(" puis ")}> ↻</span>
        )}
      </div>
      {valeur ? (
        stl ? (
          <button type="button" className="cr-case-stl" onClick={onVoir}>
            🦷 Voir en 3D
          </button>
        ) : (
          <button type="button" className="cr-case-apercu" onClick={onVoir}>
            <img src={url(valeur.media)} alt={element.nom} loading="lazy" />
          </button>
        )
      ) : (
        <label className="cr-case-vide">
          {envoi ? "Envoi…" : stl ? "Glisser le fichier .stl ici ou cliquer" : "Glisser la photo ici ou cliquer"}
          <input
            type="file"
            accept={stl ? ".stl" : "image/*"}
            onChange={(e) => {
              onFichiers([...e.target.files]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {valeur && (
        <div className="cr-case-outils">
          {!stl &&
            CORRECTIONS.map(([op, symbole, titre]) => (
              <button key={op} type="button" title={titre} aria-label={titre} onClick={() => onCorriger(op)}>
                {symbole}
              </button>
            ))}
          <button type="button" className="danger" title="Retirer" aria-label="Retirer" onClick={onRetirer}>
            ✕
          </button>
        </div>
      )}
      {scenario.genre !== "photos" && valeur && (
        <label className="cr-case-date">
          Date
          <input type="date" value={valeur.date || ""} onChange={(e) => onDate(e.target.value)} />
        </label>
      )}
    </div>
  );
}

export function PlancheDocument({ serie, scenario, patient, cabinet }) {
  const nom = [patient.prenom, patient.nom?.toUpperCase()].filter(Boolean).join(" ");
  return (
    <article className="cr-imprime-seul cr-planche">
      <div className="cr-planche-date">{formaterDate(serie.date)}</div>
      {scenario.planche.map((ligne, i) => (
        <div key={i} className={`cr-planche-ligne${ligne.length === 1 ? " seule" : ""}`}>
          {ligne.map((cle) =>
            cle === "INFO" ? (
              <div key={cle} className="cr-planche-info">
                {cabinet.logo && <img src={cabinet.logo} alt="" />}
                {cabinet.praticien && <strong>{cabinet.praticien}</strong>}
                <span>{nom}</span>
                {patient.naissance && <span>{age(patient.naissance, serie.date)}</span>}
              </div>
            ) : (
              <div key={cle} className="cr-planche-photo">
                {serie.elements[cle] && <img src={url(serie.elements[cle].media)} alt="" />}
              </div>
            ),
          )}
        </div>
      ))}
    </article>
  );
}

export default function SeriesImages({ patient, scenarios, televerser, supprimerMedia, changerSeries, onImprimer }) {
  const [nouvelle, setNouvelle] = useState({ scenario: scenarios[0]?.id || "", date: aujourdhui() });
  const [envois, setEnvois] = useState({});
  const [erreur, setErreur] = useState("");
  const [vue, setVue] = useState(null);

  const scenarioDe = (serie) => scenarios.find((s) => s.id === serie.scenario);
  const series = [...patient.series].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  function creer() {
    const scenario = scenarios.find((s) => s.id === nouvelle.scenario);
    const serie = {
      id: crypto.randomUUID(),
      scenario: scenario.id,
      nom: scenario.nom,
      date: nouvelle.date,
      elements: {},
    };
    changerSeries([...patient.series, serie]);
  }

  // Remplit des cases : un fichier par case, dans l'ordre du scénario.
  async function remplir(serie, cles, fichiers) {
    const scenario = scenarioDe(serie);
    setErreur("");
    let courante = serie;
    const anciens = [];
    for (const [i, fichier] of fichiers.entries()) {
      const cle = cles[i];
      if (!cle) break;
      const element = scenario.elements.find((e) => e.cle === cle);
      setEnvois((e) => ({ ...e, [`${serie.id}/${cle}`]: true }));
      try {
        let aEnvoyer;
        if (scenario.genre === "stl") {
          if (!/\.stl$/i.test(fichier.name)) throw new Error(`« ${fichier.name} » n'est pas un fichier .stl.`);
          aEnvoyer = new File([fichier], fichier.name, { type: "model/stl" });
        } else {
          // Radios : meilleure définition, sans compression forte.
          const radio = scenario.genre === "radios";
          aEnvoyer = await transformerImage(fichier, element.operations, {
            tailleMax: radio ? 4000 : 2400,
            qualite: radio ? 0.95 : 0.9,
          });
        }
        const media = await televerser(aEnvoyer);
        if (courante.elements[cle]) anciens.push(courante.elements[cle].media);
        courante = {
          ...courante,
          elements: {
            ...courante.elements,
            [cle]: { media: media.id, date: scenario.genre === "photos" ? "" : courante.date },
          },
        };
        changerSeries(
          patient.series.map((s) => (s.id === serie.id ? courante : s)),
          courante,
        );
      } catch (err) {
        setErreur(err.message);
      } finally {
        setEnvois((e) => ({ ...e, [`${serie.id}/${cle}`]: false }));
      }
    }
    for (const id of anciens) await supprimerMedia(id).catch(() => {});
  }

  async function remplirTout(serie, fichiers) {
    const scenario = scenarioDe(serie);
    const cles = scenario.elements.map((e) => e.cle);
    const tries = trierFichiers(fichiers);
    if (tries.length !== cles.length && scenario.genre === "photos") {
      const ok = window.confirm(
        `${tries.length} photo(s) pour ${cles.length} case(s) dans « ${scenario.nom} ». ` +
          "Elles seront placées dans l'ordre du scénario. Continuer ?",
      );
      if (!ok) return;
    }
    await remplir(serie, cles, tries);
  }

  // Correction manuelle : l'image enregistrée est retournée puis remplacée.
  async function corriger(serie, cle, operation) {
    setErreur("");
    try {
      const blob = await (await fetch(url(serie.elements[cle].media))).blob();
      const fichier = new File([blob], `${cle}.jpg`, { type: blob.type });
      await remplirAvecOperations(serie, cle, fichier, [operation]);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function remplirAvecOperations(serie, cle, fichier, operations) {
    const ancien = serie.elements[cle].media;
    const media = await televerser(await transformerImage(fichier, operations, { tailleMax: 4000, qualite: 0.95 }));
    const suivante = { ...serie, elements: { ...serie.elements, [cle]: { ...serie.elements[cle], media: media.id } } };
    changerSeries(
      patient.series.map((s) => (s.id === serie.id ? suivante : s)),
      suivante,
    );
    await supprimerMedia(ancien).catch(() => {});
  }

  async function retirer(serie, cle) {
    if (!window.confirm("Retirer cette image de la série ?")) return;
    const { media } = serie.elements[cle];
    const elements = { ...serie.elements };
    delete elements[cle];
    const suivante = { ...serie, elements };
    changerSeries(
      patient.series.map((s) => (s.id === serie.id ? suivante : s)),
      suivante,
    );
    await supprimerMedia(media).catch(() => {});
  }

  async function supprimerSerie(serie) {
    if (!window.confirm(`Supprimer la série « ${serie.nom} » du ${formaterDate(serie.date)} et ses images ?`)) return;
    changerSeries(patient.series.filter((s) => s.id !== serie.id));
    for (const { media } of Object.values(serie.elements)) await supprimerMedia(media).catch(() => {});
  }

  const majSerie = (serie, modifs) => {
    const suivante = { ...serie, ...modifs };
    changerSeries(patient.series.map((s) => (s.id === serie.id ? suivante : s)));
  };

  return (
    <>
      <section className="cr-carte">
        <h2>Nouvelle série</h2>
        <div className="cr-champs-ligne">
          <label>
            Scénario
            <select value={nouvelle.scenario} onChange={(e) => setNouvelle({ ...nouvelle, scenario: e.target.value })}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={nouvelle.date}
              onChange={(e) => setNouvelle({ ...nouvelle, date: e.target.value })}
            />
          </label>
          <button type="button" className="principal cr-bouton-aligne" onClick={creer}>
            + Créer la série
          </button>
        </div>
      </section>

      {erreur && <p className="cr-alerte">{erreur}</p>}

      {series.map((serie) => {
        const scenario = scenarioDe(serie);
        if (!scenario) return null;
        const remplis = Object.keys(serie.elements).length;
        return (
          <section key={serie.id} className="cr-carte">
            <div className="cr-titre-section">
              <h2>
                {serie.nom}{" "}
                <span className="cr-aide">
                  · {remplis}/{scenario.elements.length}
                  {patient.naissance && serie.date && ` · ${age(patient.naissance, serie.date)}`}
                </span>
              </h2>
              <div className="cr-actions">
                <input
                  type="date"
                  className="cr-date-serie"
                  value={serie.date}
                  aria-label="Date de la série"
                  onChange={(e) => majSerie(serie, { date: e.target.value })}
                />
                {scenario.genre === "photos" && (
                  <>
                    <label className="cr-bouton-fichier">
                      Déposer toutes les photos
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          remplirTout(serie, [...e.target.files]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button type="button" className="secondaire" disabled={!remplis} onClick={() => onImprimer(serie)}>
                      Imprimer la planche
                    </button>
                  </>
                )}
                <button type="button" className="danger" onClick={() => supprimerSerie(serie)}>
                  Supprimer
                </button>
              </div>
            </div>
            {scenario.genre === "photos" && (
              <p className="cr-aide">
                Sélectionnez toutes les photos prises dans l'ordre du scénario : elles sont rangées et retournées
                automatiquement (↻). Ou glissez chaque photo dans sa case.
              </p>
            )}
            <div className={`cr-cases cr-cases-${scenario.genre}`}>
              {scenario.elements.map((element) => (
                <Case
                  key={element.cle}
                  element={element}
                  scenario={scenario}
                  valeur={serie.elements[element.cle]}
                  envoi={envois[`${serie.id}/${element.cle}`]}
                  onFichiers={(fichiers) => remplir(serie, [element.cle], fichiers)}
                  onCorriger={(op) => corriger(serie, element.cle, op)}
                  onRetirer={() => retirer(serie, element.cle)}
                  onDate={(date) =>
                    majSerie(serie, {
                      elements: { ...serie.elements, [element.cle]: { ...serie.elements[element.cle], date } },
                    })
                  }
                  onVoir={() => setVue({ serie, element })}
                />
              ))}
            </div>
          </section>
        );
      })}

      {vue && scenarioDe(vue.serie)?.genre === "stl" && (
        <VisionneuseSTL
          src={url(vue.serie.elements[vue.element.cle].media)}
          nom={vue.element.nom}
          onFermer={() => setVue(null)}
        />
      )}
      {vue && scenarioDe(vue.serie)?.genre !== "stl" && (
        <div className="cr-visionneuse" role="dialog" aria-label={vue.element.nom} onClick={() => setVue(null)}>
          <img src={url(vue.serie.elements[vue.element.cle].media)} alt={vue.element.nom} />
          <div className="cr-visionneuse-barre">
            <span>
              {vue.element.nom} · {formaterDate(vue.serie.elements[vue.element.cle].date || vue.serie.date)}
            </span>
            <button type="button" className="secondaire" onClick={() => setVue(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
