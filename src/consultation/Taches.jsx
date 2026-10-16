// Tâches du cabinet (manuelles et automatiques), suivi laboratoire de tous les
// patients et alertes du tableau de bord.
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { formaterDate } from "./format.js";
import {
  TYPES_ECHEANCES,
  TYPES_RELANCES,
  automatisations,
  aujourdhui,
  delaisRelances,
  dureeLisible,
  echeancesPatient,
  identifiantUnique,
  relancesPatient,
  sansSeance,
} from "./gestion.js";
import { Verrou } from "./Historique.jsx";
import { dansLieu, nomLieu } from "./lieux.js";

async function lireGestion() {
  try {
    return await appelApi("/patients/gestion");
  } catch (err) {
    if (err.statut === 423 || err.statut === 404) return { verrouille: true, existe: err.statut === 423 };
    return { erreur: err.message };
  }
}

function useGestion() {
  const [donnees, setDonnees] = useState(null);
  const recharger = async () => setDonnees(await lireGestion());
  useEffect(() => {
    let actif = true;
    lireGestion().then((d) => actif && setDonnees(d));
    return () => {
      actif = false;
    };
  }, []);
  return [donnees, setDonnees, recharger];
}

const nom = (p) => [p?.nom?.toUpperCase(), p?.prenom].filter(Boolean).join(" ");

// Échéances actives (automatisations activées, non écartées) du cabinet affiché.
function echeances(donnees, cabinet, lieuActif = "") {
  const actives = automatisations(cabinet);
  const ignorees = new Set(donnees.ignorees || []);
  return donnees.patients
    .filter((p) => dansLieu(lieuActif, p.lieu))
    .flatMap((p) => echeancesPatient(p).map((e) => ({ ...e, patient: p })))
    .filter((e) => actives[e.type] && !ignorees.has(e.cle))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function majGestionPatient(patient, modif) {
  await appelApi("/patients/gestion/dossier", { id: patient.id, gestion: { ...patient.gestion, ...modif } });
}

// Action « fait » d'une échéance automatique : mise à jour du dossier concerné.
async function terminerEcheance(e, donnees, setDonnees) {
  const g = e.patient.gestion || {};
  const [, cle] = e.cle.split(":");
  const n = Number(cle.split("-").at(-1));
  const auj = aujourdhui();
  // Parcours : bilan, contention, carte Vitale, contrôles de contention.
  const parcours = g.parcours || {};
  const champsParcours = {
    "fact-bilan": "bilanFacture",
    "fact-contention": "contentionFacturee",
    "fact-vitale": "vitale",
  };
  if (champsParcours[cle])
    return majGestionPatient(e.patient, { parcours: { ...parcours, [champsParcours[cle]]: auj } });
  if (e.type === "contention")
    return majGestionPatient(e.patient, {
      parcours: { ...parcours, controles: { ...(parcours.controles || {}), [n]: auj } },
    });
  if (e.type === "facturation")
    return majGestionPatient(e.patient, {
      semestres: { ...g.semestres, factures: { ...(g.semestres?.factures || {}), [n]: auj } },
    });
  if (e.type === "dep" || e.type === "depRenouvellement") {
    // Une DEP vaut pour deux semestres (ou pour l'année de contention : clé « C »).
    const groupe = cle.split("-").at(-1);
    const faites = groupe === "C" ? { C: auj } : { [n]: auj, [n + 1]: auj };
    return majGestionPatient(e.patient, {
      semestres: { ...g.semestres, depFaites: { ...(g.semestres?.depFaites || {}), ...faites } },
    });
  }
  if (e.type === "depEnvoi") {
    const id = cle.replace(/^envoi-/, "");
    return majGestionPatient(e.patient, { deps: g.deps.map((d) => (d.id === id ? { ...d, envoyee: auj } : d)) });
  }
  if (e.type === "rappel") return majGestionPatient(e.patient, { rappel: { ...g.rappel, fait: auj } });
  if (e.type === "labo") {
    const id = cle.replace(/^labo-/, "");
    return majGestionPatient(e.patient, { labo: g.labo.map((l) => (l.id === id ? { ...l, recu: auj } : l)) });
  }
  const suivant = await appelApi("/patients/gestion", { ignorees: [...(donnees.ignorees || []), e.cle] });
  setDonnees({ ...donnees, ...suivant });
}

const LIBELLE_FAIT = {
  facturation: "Facturé",
  dep: "DEP faite",
  depEnvoi: "Envoyée",
  rappel: "Contacté",
  message: "Envoyé",
  contention: "Fait",
  labo: "Reçu",
  nonRevu: "Écarter",
  depRenouvellement: "Fait",
};

function NouvelleTache({ patients, onAjouter }) {
  const [tache, setTache] = useState({ titre: "", patientId: "", echeance: "", note: "" });
  return (
    <form
      className="cr-carte"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tache.titre.trim()) return;
        onAjouter({ ...tache, id: identifiantUnique(), creeLe: aujourdhui(), fait: "" });
        setTache({ titre: "", patientId: "", echeance: "", note: "" });
      }}
    >
      <h2>Nouvelle tâche</h2>
      <div className="cr-champs-ligne">
        <label>
          À faire
          <input
            value={tache.titre}
            placeholder="Ex. Envoyer l'empreinte au laboratoire"
            onChange={(e) => setTache({ ...tache, titre: e.target.value })}
          />
        </label>
        <label>
          Patient (facultatif)
          <input
            list="oa-patients"
            value={nom(patients.find((p) => p.id === tache.patientId)) || tache.recherche || ""}
            placeholder="Rechercher…"
            onChange={(e) => {
              const p = patients.find((x) => nom(x) === e.target.value);
              setTache({ ...tache, patientId: p?.id || "", recherche: e.target.value });
            }}
          />
          <datalist id="oa-patients">
            {patients.map((p) => (
              <option key={p.id} value={nom(p)} />
            ))}
          </datalist>
        </label>
        <label>
          Échéance
          <input
            type="date"
            value={tache.echeance}
            onChange={(e) => setTache({ ...tache, echeance: e.target.value })}
          />
        </label>
      </div>
      <label className="cr-bloc">
        Note
        <input value={tache.note} onChange={(e) => setTache({ ...tache, note: e.target.value })} />
      </label>
      <button type="submit" className="principal" disabled={!tache.titre.trim()}>
        Ajouter la tâche
      </button>
    </form>
  );
}

function PageVerrouillee({ donnees, titre, recharger }) {
  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>{titre}</h1>
      </header>
      {donnees?.erreur && <p className="cr-alerte">{donnees.erreur}</p>}
      {donnees?.verrouille && (
        <section className="cr-carte">
          <h2>Dossiers verrouillés</h2>
          <Verrou existe={donnees.existe} onDeverrouille={recharger} />
        </section>
      )}
    </div>
  );
}

export default function Taches({ cabinet, lieuActif = "", onOuvrirPatient }) {
  const [donnees, setDonnees, recharger] = useGestion();
  const [vue, setVue] = useState("afaire");
  if (!donnees || donnees.verrouille || donnees.erreur)
    return <PageVerrouillee donnees={donnees} titre="Tâches" recharger={recharger} />;

  const auj = aujourdhui();
  const taches = donnees.taches || [];
  const auto = echeances(donnees, cabinet, lieuActif);
  const patient = (id) => donnees.patients.find((p) => p.id === id);
  async function enregistrer(suivantes) {
    setDonnees({ ...donnees, ...(await appelApi("/patients/gestion", { taches: suivantes })) });
  }
  // Tâche d'un patient de l'autre cabinet : masquée ; tâche générale : toujours visible.
  const duLieu = (t) => !t.patientId || !lieuActif || dansLieu(lieuActif, patient(t.patientId)?.lieu);
  const ouvertes = taches
    .filter((t) => !t.fait && duLieu(t))
    .sort((a, b) => (a.echeance || "9").localeCompare(b.echeance || "9"));
  const finies = taches.filter((t) => t.fait && duLieu(t)).sort((a, b) => b.fait.localeCompare(a.fait));

  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>Tâches</h1>
      </header>
      <div className="oa-chiffres oa-chiffres-4">
        <div className="oa-chiffre">
          <strong>{ouvertes.length}</strong>
          <span>tâche(s) à faire</span>
        </div>
        <div className="oa-chiffre">
          <strong>{auto.length}</strong>
          <span>échéance(s) automatique(s)</span>
        </div>
        <div className="oa-chiffre">
          <strong>{ouvertes.filter((t) => t.echeance && t.echeance < auj).length}</strong>
          <span>en retard</span>
        </div>
      </div>
      <div className="cr-filtres">
        {[
          ["afaire", "À faire"],
          ["finies", `Terminées (${finies.length})`],
        ].map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            className={vue === cle ? "cr-filtre actif" : "cr-filtre"}
            onClick={() => setVue(cle)}
          >
            {libelle}
          </button>
        ))}
      </div>
      <div className="oa-colonnes">
        <div>
          {vue === "afaire" ? (
            <>
              <section className="cr-carte">
                <h2>Mes tâches</h2>
                {ouvertes.length === 0 ? (
                  <p className="cr-aide">Aucune tâche.</p>
                ) : (
                  <ul className="oa-taches">
                    {ouvertes.map((t) => (
                      <li key={t.id} className={t.echeance && t.echeance < auj ? "oa-retard" : undefined}>
                        <input
                          type="checkbox"
                          aria-label="Terminée"
                          onChange={() => enregistrer(taches.map((x) => (x.id === t.id ? { ...x, fait: auj } : x)))}
                        />
                        <div>
                          <strong>{t.titre}</strong>
                          <small>
                            {t.echeance ? `Pour le ${formaterDate(t.echeance)}` : "Sans échéance"}
                            {t.patientId && (
                              <>
                                {" · "}
                                <button type="button" className="cr-lien" onClick={() => onOuvrirPatient(t.patientId)}>
                                  {nom(patient(t.patientId)) || "Patient supprimé"}
                                </button>
                              </>
                            )}
                            {t.note && ` · ${t.note}`}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="cr-lien"
                          onClick={() =>
                            window.confirm("Supprimer cette tâche ?") &&
                            enregistrer(taches.filter((x) => x.id !== t.id))
                          }
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <NouvelleTache patients={donnees.patients} onAjouter={(t) => enregistrer([...taches, t])} />
            </>
          ) : (
            <section className="cr-carte">
              <h2>Tâches terminées</h2>
              <ul className="oa-taches">
                {finies.map((t) => (
                  <li key={t.id} className="fait">
                    <input
                      type="checkbox"
                      checked
                      aria-label="Rouvrir"
                      onChange={() => enregistrer(taches.map((x) => (x.id === t.id ? { ...x, fait: "" } : x)))}
                    />
                    <div>
                      <strong>{t.titre}</strong>
                      <small>
                        Terminée le {formaterDate(t.fait)}
                        {t.patientId && ` · ${nom(patient(t.patientId))}`}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <section className="cr-carte">
          <h2>Échéances automatiques</h2>
          <p className="cr-aide">Choisissez lesquelles apparaissent dans Paramètres → Automatisations.</p>
          {auto.length === 0 ? (
            <p className="cr-aide">Aucune échéance en attente.</p>
          ) : (
            <ul className="oa-taches">
              {auto.map((e) => (
                <li key={e.cle}>
                  <span className="cr-pastille c-blue">{TYPES_ECHEANCES[e.type]}</span>
                  <div>
                    <strong>
                      {e.titre} —{" "}
                      <button
                        type="button"
                        className="cr-lien"
                        onClick={() => onOuvrirPatient(e.patient.id, "gestion")}
                      >
                        {nom(e.patient)}
                      </button>
                    </strong>
                    <small>
                      {formaterDate(e.date)}
                      {e.detail && ` · ${e.detail}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondaire"
                    onClick={async () => {
                      await terminerEcheance(e, donnees, setDonnees);
                      recharger();
                    }}
                  >
                    {LIBELLE_FAIT[e.type]}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function Laboratoire({ lieuActif = "", onOuvrirPatient }) {
  const [donnees, , recharger] = useGestion();
  const [vue, setVue] = useState("attente");
  if (!donnees || donnees.verrouille || donnees.erreur)
    return <PageVerrouillee donnees={donnees} titre="Laboratoire" recharger={recharger} />;
  const auj = aujourdhui();
  const commandes = donnees.patients
    .filter((p) => dansLieu(lieuActif, p.lieu))
    .flatMap((p) => (p.gestion?.labo || []).map((l) => ({ ...l, patient: p })));
  const enAttente = commandes.filter((l) => !l.recu);
  const affichees = (vue === "attente" ? enAttente : commandes.filter((l) => l.recu)).sort((a, b) =>
    (a.prevu || "9").localeCompare(b.prevu || "9"),
  );
  async function cocher(l, cle, valeur) {
    const g = l.patient.gestion;
    await majGestionPatient(l.patient, {
      labo: g.labo.map((x) => (x.id === l.id ? { ...x, [cle]: valeur ? auj : "" } : x)),
    });
    recharger();
  }
  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>Laboratoire</h1>
      </header>
      <div className="oa-chiffres oa-chiffres-4">
        <div className="oa-chiffre">
          <strong>{enAttente.length}</strong>
          <span>en attente</span>
        </div>
        <div className="oa-chiffre">
          <strong>{enAttente.filter((l) => l.prevu && l.prevu < auj).length}</strong>
          <span>en retard</span>
        </div>
        <div className="oa-chiffre">
          <strong>{commandes.filter((l) => l.recu && !l.pose).length}</strong>
          <span>reçu(s), à poser</span>
        </div>
      </div>
      <section className="cr-carte">
        <div className="cr-filtres">
          {[
            ["attente", "En attente"],
            ["recus", "Reçus"],
          ].map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              className={vue === cle ? "cr-filtre actif" : "cr-filtre"}
              onClick={() => setVue(cle)}
            >
              {libelle}
            </button>
          ))}
        </div>
        {affichees.length === 0 ? (
          <p className="cr-aide">
            Aucun appareil. Les commandes s'ajoutent dans le dossier du patient, onglet « Suivi du traitement ».
          </p>
        ) : (
          <table className="oa-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Appareil</th>
                <th>Laboratoire</th>
                <th>Prévu</th>
                <th>Envoyé</th>
                <th>Reçu</th>
                <th>Posé</th>
              </tr>
            </thead>
            <tbody>
              {affichees.map((l) => (
                <tr key={l.id} className={!l.recu && l.prevu && l.prevu < auj ? "oa-retard" : undefined}>
                  <td>
                    <button type="button" className="cr-lien" onClick={() => onOuvrirPatient(l.patient.id, "suivi")}>
                      {nom(l.patient)}
                    </button>
                  </td>
                  <td>{l.appareil}</td>
                  <td>{l.laboratoire}</td>
                  <td>{formaterDate(l.prevu)}</td>
                  {["envoye", "recu", "pose"].map((cle) => (
                    <td key={cle}>
                      <input
                        type="checkbox"
                        checked={Boolean(l[cle])}
                        onChange={(e) => cocher(l, cle, e.target.checked)}
                      />{" "}
                      {l[cle] ? formaterDate(l[cle]) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// Encart du tableau de bord : échéances par catégorie.
export function AlertesSuivi({ cabinet, lieuActif = "", onOuvrirPatient, onAller }) {
  const [donnees] = useGestion();
  const [type, setType] = useState("facturation");
  if (!donnees || donnees.verrouille || donnees.erreur) return null;
  const auto = echeances(donnees, cabinet, lieuActif);
  const types = Object.keys(TYPES_ECHEANCES).filter((t) => auto.some((e) => e.type === t));
  const actif = types.includes(type) ? type : types[0];
  const taches = (donnees.taches || []).filter((t) => !t.fait);
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Alertes &amp; suivis</h2>
        <button type="button" className="cr-lien" onClick={() => onAller("taches")}>
          {taches.length} tâche(s) à faire →
        </button>
      </div>
      {types.length === 0 ? (
        <p className="cr-aide">Aucune échéance en attente.</p>
      ) : (
        <>
          <div className="cr-filtres">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                className={t === actif ? "cr-filtre actif" : "cr-filtre"}
                onClick={() => setType(t)}
              >
                {TYPES_ECHEANCES[t]} ({auto.filter((e) => e.type === t).length})
              </button>
            ))}
          </div>
          <ul className="oa-liste">
            {auto
              .filter((e) => e.type === actif)
              .slice(0, 8)
              .map((e) => (
                <li key={e.cle}>
                  <button
                    type="button"
                    onClick={() => onOuvrirPatient(e.patient.id, e.type === "labo" ? "suivi" : "gestion")}
                  >
                    <span className="oa-liste-date">{formaterDate(e.date)}</span>
                    <span className="oa-liste-texte">
                      <strong>{nom(e.patient)}</strong>
                      <small>
                        {e.titre}
                        {e.detail && ` · ${e.detail}`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}

// Relances : devis non validés, patients en attente (trop tôt), patients en traitement non revus.
export function Relances({ cabinet, lieuActif = "", onOuvrirPatient, onCabinetChange }) {
  const [donnees, setDonnees, recharger] = useGestion();
  const [vue, setVue] = useState("devis");
  if (!donnees || donnees.verrouille || donnees.erreur)
    return <PageVerrouillee donnees={donnees} titre="Relances" recharger={recharger} />;

  const auj = aujourdhui();
  const delais = delaisRelances(cabinet);
  const patients = donnees.patients.filter((p) => dansLieu(lieuActif, p.lieu));
  const dues = patients
    .flatMap((p) => relancesPatient(p, delais, auj).map((r) => ({ ...r, patient: p })))
    .sort((a, b) => a.reference.localeCompare(b.reference));
  const parType = (type) => dues.filter((r) => r.type === type);
  const sansSuivi = patients.filter(sansSeance);

  async function majRelances(patient, modif) {
    const g = patient.gestion || {};
    const gestion = { ...g, relances: modif(g.relances || {}) };
    await appelApi("/patients/gestion/dossier", { id: patient.id, gestion });
    setDonnees({
      ...donnees,
      patients: donnees.patients.map((p) => (p.id === patient.id ? { ...p, gestion } : p)),
    });
  }
  function relance(r) {
    const note = window.prompt("Relance effectuée. Note (facultatif) :", "");
    if (note === null) return;
    majRelances(r.patient, (rel) => ({
      ...rel,
      historique: {
        ...(rel.historique || {}),
        [r.type]: [...(rel.historique?.[r.type] || []), { date: auj, note: note.trim() }],
      },
    }));
  }
  function arreter(r) {
    if (!window.confirm(`Ne plus proposer cette relance pour ${nom(r.patient)} ?`)) return;
    majRelances(r.patient, (rel) => ({ ...rel, stop: { ...(rel.stop || {}), [r.type]: auj } }));
  }
  const delai = (cle, libelle, unite) => (
    <label className="cr-champ-court">
      {libelle}
      <span className="oa-delai">
        <input
          type="number"
          min="1"
          max="60"
          value={delais[cle]}
          onChange={(e) =>
            onCabinetChange({ ...cabinet, relances: { ...delais, [cle]: Math.max(1, Number(e.target.value) || 1) } })
          }
        />{" "}
        {unite}
      </span>
    </label>
  );

  const liste = parType(vue);
  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>Relances</h1>
      </header>
      <div className="oa-chiffres oa-chiffres-4">
        {Object.entries(TYPES_RELANCES).map(([type, t]) => (
          <button
            key={type}
            type="button"
            className={`oa-chiffre oa-chiffre-bouton${vue === type ? " actif" : ""}`}
            onClick={() => setVue(type)}
          >
            <strong>{parType(type).length}</strong>
            <span>{t.titre}</span>
          </button>
        ))}
      </div>

      <section className="cr-carte">
        <div className="cr-titre-section">
          <h2>{TYPES_RELANCES[vue].titre}</h2>
          {vue === "devis" && delai("devisMois", "Relancer après", "mois sans validation")}
          {vue === "attente" && delai("attenteMois", "Revoir après", "mois d'attente")}
          {vue === "suivi" && delai("suiviSemaines", "Alerter après", "semaines sans séance")}
        </div>
        {liste.length === 0 ? (
          <p className="cr-aide">Aucune relance à faire.</p>
        ) : (
          <table className="oa-table oa-relances">
            <thead>
              <tr>
                <th>Patient</th>
                <th>{TYPES_RELANCES[vue].depuis}</th>
                <th>Dernière relance</th>
                <th>Contact</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.map((r) => {
                const tel = r.patient.portable || r.patient.telephone;
                const historique = r.patient.gestion?.relances?.historique?.[r.type] || [];
                const derniere = historique.at(-1);
                return (
                  <tr key={`${r.patient.id}-${r.type}`}>
                    <td>
                      <button type="button" className="cr-lien" onClick={() => onOuvrirPatient(r.patient.id)}>
                        {nom(r.patient)}
                      </button>
                      {!lieuActif && r.patient.lieu && (
                        <span className={`oa-pastille-lieu ${r.patient.lieu}`}>{nomLieu(cabinet, r.patient.lieu)}</span>
                      )}
                      {r.detail && <small className="oa-relance-detail">{r.detail}</small>}
                    </td>
                    <td>
                      {formaterDate(r.reference)}
                      <small className="oa-relance-detail">
                        il y a {dureeLisible(r.reference, auj) || "moins d'un jour"}
                      </small>
                    </td>
                    <td>
                      {derniere ? (
                        <>
                          {formaterDate(derniere.date)}
                          {historique.length > 1 && ` (${historique.length} relances)`}
                          {derniere.note && <small className="oa-relance-detail">{derniere.note}</small>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {tel && <a href={`tel:${tel.replace(/[^\d+]/g, "")}`}>{tel}</a>}
                      {r.patient.email && (
                        <small className="oa-relance-detail">
                          <a href={`mailto:${r.patient.email}`}>{r.patient.email}</a>
                        </small>
                      )}
                    </td>
                    <td className="oa-relance-actions">
                      <button type="button" className="principal" onClick={() => relance(r)}>
                        Relancé
                      </button>
                      <button type="button" className="cr-lien" onClick={() => arreter(r)}>
                        Ne plus relancer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="cr-aide">
          Après « Relancé », le patient revient dans la liste{" "}
          {vue === "suivi"
            ? `si aucune séance n'est saisie dans les ${delais.suiviSemaines} semaines`
            : `au bout de ${delais[TYPES_RELANCES[vue].delai]} mois s'il n'a pas donné suite`}
          {vue === "devis" && " (devis non validé ou statut « Devis envoyé »)"}.
        </p>
        {vue === "suivi" && sansSuivi.length > 0 && (
          <details className="oa-sans-seance">
            <summary>
              {sansSuivi.length} patient(s) en traitement sans aucune séance saisie dans OrthoAI (suivi tenu dans
              OrthoFast) : non comptés ci-dessus
            </summary>
            <ul>
              {sansSuivi.map((p) => (
                <li key={p.id}>
                  <button type="button" className="cr-lien" onClick={() => onOuvrirPatient(p.id)}>
                    {nom(p)}
                  </button>
                  {p.gestion?.semestres?.debut && ` · début ${formaterDate(p.gestion.semestres.debut)}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
