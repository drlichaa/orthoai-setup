// Onglet « Suivi du traitement » : progression, laboratoire, aligneurs,
// rappels, incidents et chronologie du patient.
import { useState } from "react";
import { formaterDate } from "./format.js";
import {
  ajouterJours,
  ajouterMois,
  aujourdhui,
  identifiantUnique,
  isoDepuisFr,
  moisEntre,
  nonRevuSemaines,
} from "./gestion.js";

const TYPES_INCIDENTS = ["Bague décollée", "Fil qui gêne", "Appareil cassé", "Rendez-vous manqué", "Autre"];

function Rappels({ g, majGestion }) {
  const [mois, setMois] = useState(6);
  const [motif, setMotif] = useState("");
  return (
    <section className="cr-carte">
      <h2>Rappels</h2>
      <div className="cr-champs-ligne">
        <label>
          Rappeler le patient dans (mois)
          <input type="number" min="1" max="120" value={mois} onChange={(e) => setMois(e.target.value)} />
        </label>
        <label>
          Motif
          <input
            value={motif}
            placeholder="Ex. trop tôt, attendre les canines"
            onChange={(e) => setMotif(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondaire"
          onClick={() => {
            majGestion({ rappel: { date: ajouterMois(aujourdhui(), Number(mois) || 6), motif, fait: "" } });
            setMotif("");
          }}
        >
          Programmer
        </button>
      </div>
      {g.rappel?.date && (
        <p>
          🔔 Rappel le <b>{formaterDate(g.rappel.date)}</b>
          {g.rappel.motif && ` — ${g.rappel.motif}`}
          {g.rappel.fait ? (
            ` · ✓ contacté le ${formaterDate(g.rappel.fait)}`
          ) : (
            <>
              {" "}
              <button
                type="button"
                className="cr-lien"
                onClick={() => majGestion({ rappel: { ...g.rappel, fait: aujourdhui() } })}
              >
                Marquer contacté
              </button>
            </>
          )}{" "}
          <button type="button" className="cr-lien" onClick={() => majGestion({ rappel: null })}>
            Supprimer
          </button>
        </p>
      )}
      <label className="cr-case">
        <input
          type="checkbox"
          checked={nonRevuSemaines(g) > 0}
          onChange={(e) => majGestion({ nonRevuSemaines: e.target.checked ? 12 : 0 })}
        />{" "}
        Tâche « Rappeler le patient » s'il n'est pas revu depuis{" "}
        <input
          className="oa-court"
          type="number"
          min="1"
          max="104"
          disabled={!(nonRevuSemaines(g) > 0)}
          value={nonRevuSemaines(g) || 12}
          onChange={(e) => majGestion({ nonRevuSemaines: Math.max(1, Number(e.target.value) || 1) }, false)}
        />{" "}
        semaines
      </label>
    </section>
  );
}

function Progression({ patient, g, majGestion }) {
  const debut = g.semestres?.debut || patient.debut;
  const ecoule = debut ? Math.max(0, moisEntre(debut)) : null;
  const prevu = Number(g.dureePrevue) || 0;
  const pourcentage = prevu && ecoule != null ? Math.min(100, Math.round((ecoule / prevu) * 100)) : 0;
  return (
    <section className="cr-carte">
      <h2>Progression</h2>
      <div className="cr-champs-ligne">
        <label>
          Durée prévue (mois)
          <input
            type="number"
            min="1"
            max="120"
            value={g.dureePrevue || ""}
            placeholder="Ex. 24"
            onChange={(e) => majGestion({ dureePrevue: e.target.value }, false)}
          />
        </label>
        <p>
          {ecoule == null
            ? "Début du traitement non renseigné."
            : `${ecoule} mois depuis le début (${formaterDate(debut)})`}
          {prevu ? ` sur ${prevu} prévus` : ""}
        </p>
      </div>
      {prevu > 0 && ecoule != null && (
        <>
          <div className="oa-barre">
            <div style={{ width: `${pourcentage}%` }} className={ecoule > prevu ? "depasse" : ""} />
          </div>
          <p className="cr-aide">
            {pourcentage} % de la durée prévue{ecoule > prevu ? " · durée prévue dépassée" : ""}.
          </p>
        </>
      )}
    </section>
  );
}

function Laboratoire({ g, majGestion }) {
  const liste = g.labo || [];
  const [ajout, setAjout] = useState(null);
  const majLigne = (id, modif) => majGestion({ labo: liste.map((l) => (l.id === id ? { ...l, ...modif } : l)) });
  const auj = aujourdhui();
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Laboratoire</h2>
        {!ajout && (
          <button
            type="button"
            className="secondaire"
            onClick={() => setAjout({ appareil: "", laboratoire: "", prevu: "" })}
          >
            + Commander un appareil
          </button>
        )}
      </div>
      {ajout && (
        <form
          className="cr-champs-ligne"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ajout.appareil.trim()) return;
            majGestion({
              labo: [...liste, { ...ajout, id: identifiantUnique(), commande: auj, envoye: "", recu: "", pose: "" }],
            });
            setAjout(null);
          }}
        >
          <label>
            Appareil
            <input
              autoFocus
              value={ajout.appareil}
              onChange={(e) => setAjout({ ...ajout, appareil: e.target.value })}
            />
          </label>
          <label>
            Laboratoire
            <input value={ajout.laboratoire} onChange={(e) => setAjout({ ...ajout, laboratoire: e.target.value })} />
          </label>
          <label>
            Réception prévue
            <input type="date" value={ajout.prevu} onChange={(e) => setAjout({ ...ajout, prevu: e.target.value })} />
          </label>
          <button type="submit" className="principal">
            Ajouter
          </button>
          <button type="button" className="secondaire" onClick={() => setAjout(null)}>
            Annuler
          </button>
        </form>
      )}
      {liste.length === 0 && !ajout ? (
        <p className="cr-aide">Aucun appareil commandé.</p>
      ) : (
        <table className="oa-table">
          <thead>
            <tr>
              <th>Appareil</th>
              <th>Laboratoire</th>
              <th>Prévu</th>
              <th>Envoyé</th>
              <th>Reçu</th>
              <th>Posé</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {liste.map((l) => (
              <tr key={l.id} className={!l.recu && l.prevu && l.prevu < auj ? "oa-retard" : undefined}>
                <td>{l.appareil}</td>
                <td>{l.laboratoire}</td>
                <td>{formaterDate(l.prevu)}</td>
                {["envoye", "recu", "pose"].map((cle) => (
                  <td key={cle}>
                    <label className="cr-case">
                      <input
                        type="checkbox"
                        checked={Boolean(l[cle])}
                        onChange={(e) => majLigne(l.id, { [cle]: e.target.checked ? auj : "" })}
                      />{" "}
                      {l[cle] ? formaterDate(l[cle]) : ""}
                    </label>
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="cr-lien"
                    onClick={() =>
                      window.confirm(`Supprimer « ${l.appareil} » ?`) &&
                      majGestion({ labo: liste.filter((x) => x.id !== l.id) })
                    }
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function datesAligneurs(a) {
  const total = Math.min(200, Number(a.total) || 0);
  const frequence = Number(a.frequence) || 0;
  if (!a.debut || !total || !frequence) return [];
  const dates = [];
  let date = a.debut;
  for (let i = 1; i <= total; i++) {
    if (a.corrections?.[i]) date = a.corrections[i];
    dates.push(date);
    date = ajouterJours(date, frequence);
  }
  return dates;
}

function Aligneurs({ g, majGestion }) {
  const a = g.aligneurs || {};
  const [ouvert, setOuvert] = useState(Boolean(a.total));
  const maj = (modif) => majGestion({ aligneurs: { ...a, ...modif } }, false);
  const dates = datesAligneurs(a);
  const actuel = Number(a.actuel) || 1;
  if (!ouvert)
    return (
      <section className="cr-carte">
        <div className="cr-titre-section">
          <h2>Aligneurs</h2>
          <button type="button" className="secondaire" onClick={() => setOuvert(true)}>
            + Suivre des aligneurs
          </button>
        </div>
      </section>
    );
  return (
    <section className="cr-carte">
      <h2>Aligneurs</h2>
      <div className="cr-champs-ligne">
        <label>
          Nombre d'aligneurs
          <input
            type="number"
            min="1"
            max="200"
            value={a.total || ""}
            onChange={(e) => maj({ total: e.target.value })}
          />
        </label>
        <label>
          Aligneur actuel
          <input type="number" min="1" value={a.actuel || ""} onChange={(e) => maj({ actuel: e.target.value })} />
        </label>
        <label>
          Début de l'aligneur n° 1
          <input type="date" value={a.debut || ""} onChange={(e) => maj({ debut: e.target.value, corrections: {} })} />
        </label>
        <label>
          Changement tous les (jours)
          <input
            type="number"
            min="1"
            max="60"
            value={a.frequence || ""}
            onChange={(e) => maj({ frequence: e.target.value })}
          />
        </label>
      </div>
      {dates.length > 0 && (
        <>
          <p>
            Aligneur <b>{actuel}</b> / {dates.length} · fin théorique le{" "}
            <b>{formaterDate(ajouterJours(dates.at(-1), Number(a.frequence)))}</b>
          </p>
          <details>
            <summary>Calendrier des changements (dates modifiables)</summary>
            <table className="oa-table">
              <thead>
                <tr>
                  <th>Aligneur</th>
                  <th>Début</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d, i) => (
                  <tr key={i} className={i + 1 === actuel ? "oa-actuel" : undefined}>
                    <td>n° {i + 1}</td>
                    <td>
                      <input
                        type="date"
                        value={d}
                        onChange={(e) => {
                          const corrections = Object.fromEntries(
                            Object.entries(a.corrections || {}).filter(([k]) => Number(k) < i + 1),
                          );
                          maj({ corrections: { ...corrections, [i + 1]: e.target.value } });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

function Incidents({ patient, g, majGestion }) {
  const liste = g.incidents || [];
  const [ajout, setAjout] = useState(null);
  const recollages = patient.seances.reduce((n, s) => n + (s.recollages?.length || 0), 0);
  const manques = liste.filter((i) => i.type === "Rendez-vous manqué").length;
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Incidents</h2>
        {!ajout && (
          <button
            type="button"
            className="secondaire"
            onClick={() => setAjout({ date: aujourdhui(), type: TYPES_INCIDENTS[0], dent: "", note: "" })}
          >
            + Ajouter
          </button>
        )}
      </div>
      <p className="cr-aide">
        {recollages} bague(s) recollée(s) d'après le schéma dentaire ·{" "}
        {liste.filter((i) => i.type === "Bague décollée").length} décollement(s) noté(s) ici · {manques} rendez-vous
        manqué(s)
      </p>
      {ajout && (
        <form
          className="cr-champs-ligne"
          onSubmit={(e) => {
            e.preventDefault();
            majGestion({ incidents: [...liste, { ...ajout, id: identifiantUnique() }] });
            setAjout(null);
          }}
        >
          <label>
            Date
            <input type="date" value={ajout.date} onChange={(e) => setAjout({ ...ajout, date: e.target.value })} />
          </label>
          <label>
            Type
            <select value={ajout.type} onChange={(e) => setAjout({ ...ajout, type: e.target.value })}>
              {TYPES_INCIDENTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Dent
            <input
              className="oa-court"
              value={ajout.dent}
              onChange={(e) => setAjout({ ...ajout, dent: e.target.value })}
            />
          </label>
          <label>
            Note
            <input value={ajout.note} onChange={(e) => setAjout({ ...ajout, note: e.target.value })} />
          </label>
          <button type="submit" className="principal">
            Ajouter
          </button>
          <button type="button" className="secondaire" onClick={() => setAjout(null)}>
            Annuler
          </button>
        </form>
      )}
      {liste.length > 0 && (
        <ul className="oa-liste-simple">
          {[...liste]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((i) => (
              <li key={i.id}>
                <span>
                  {formaterDate(i.date)} · <b>{i.type}</b>
                  {i.dent && ` · dent ${i.dent}`}
                  {i.note && ` — ${i.note}`}
                </span>
                <button
                  type="button"
                  className="cr-lien"
                  onClick={() => majGestion({ incidents: liste.filter((x) => x.id !== i.id) })}
                >
                  ✕
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function Chronologie({ patient, g }) {
  const evenements = [];
  const ajouter = (date, texte) => date && evenements.push({ date, texte });
  for (const d of g.devis || []) {
    ajouter(d.date, `Devis ${d.description} (${d.regime === "hn" ? "HN" : "Sécu"})`);
    if (d.valide) ajouter(d.valide, "Devis signé");
  }
  if (g.semestres?.debut) ajouter(g.semestres.debut, "Début du traitement");
  for (const s of patient.seances) {
    const texte = (s.fait || "").split("\n").find((l) => l.trim());
    ajouter(isoDepuisFr(s.date), `Séance${texte ? ` : ${texte}` : ""}`);
  }
  for (const d of g.deps || []) ajouter(d.date, `DEP ${d.nature === "suite" ? `semestre ${d.numero}` : d.nature}`);
  for (const c of patient.courriers || [])
    ajouter(c.date, `Courrier ${c.destinataire}${c.motif ? ` : ${c.motif}` : ""}`);
  for (const l of g.labo || []) {
    ajouter(l.commande, `Commande : ${l.appareil}`);
    if (l.pose) ajouter(l.pose, `Pose : ${l.appareil}`);
  }
  for (const i of g.incidents || []) ajouter(i.date, `${i.type}${i.dent ? ` (dent ${i.dent})` : ""}`);
  evenements.sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="cr-carte">
      <h2>Chronologie</h2>
      {evenements.length === 0 ? (
        <p className="cr-aide">Aucun événement.</p>
      ) : (
        <ul className="oa-chronologie">
          {evenements.map((e, i) => (
            <li key={i}>
              <span>{formaterDate(e.date)}</span> {e.texte}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SuiviTraitement({ patient, majGestion }) {
  const g = patient.gestion || {};
  return (
    <>
      <div className="oa-colonnes">
        <div>
          <Progression patient={patient} g={g} majGestion={majGestion} />
          <Laboratoire g={g} majGestion={majGestion} />
          <Aligneurs g={g} majGestion={majGestion} />
        </div>
        <div>
          <Rappels g={g} majGestion={majGestion} />
          <Incidents patient={patient} g={g} majGestion={majGestion} />
          <Chronologie patient={patient} g={g} />
        </div>
      </div>
    </>
  );
}
