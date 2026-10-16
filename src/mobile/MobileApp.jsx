// OrthoAI sur iPhone : planning du jour, dossier patient en un écran, tâches et relances.
// Même serveur et même coffre chiffré que l'application (accès distant par Tailscale).
import { useCallback, useEffect, useState } from "react";
import { appelApi } from "../consultation/apiHistorique.js";
import { demander } from "../consultation/demander.js";
import { age, formaterDate } from "../consultation/format.js";
import FriseTraitement from "../consultation/FriseTraitement.jsx";
import {
  TYPES_ECHEANCES,
  TYPES_RELANCES,
  aujourdhui,
  delaisRelances,
  etatParcours,
  relancesPatient,
} from "../consultation/gestion.js";
import { Verrou } from "../consultation/Historique.jsx";
import { nomLieu } from "../consultation/lieux.js";
import { FAUTEUILS, minutes, plusJours, reglagesPlanning, texteSur } from "../consultation/planning.js";
import { normaliser } from "../consultation/questionnaireWeclever.js";
import { LIBELLE_FAIT, echeances, terminerEcheance } from "../consultation/tachesActions.js";

const nomComplet = (p) => [p?.nom?.toUpperCase(), p?.prenom].filter(Boolean).join(" ");
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const jourLong = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${formaterDate(iso)}`;
};
const STATUTS_RDV = { venu: "Venu", absent: "Absent", annule: "Annulé" };

function Onglets({ onglet, onChange, nbTaches }) {
  const liste = [
    ["jour", "Aujourd'hui", "📅"],
    ["patients", "Patients", "👤"],
    ["taches", "Tâches", "✓"],
  ];
  return (
    <nav className="m-onglets" aria-label="Sections">
      {liste.map(([cle, libelle, icone]) => (
        <button key={cle} type="button" className={onglet === cle ? "actif" : ""} onClick={() => onChange(cle)}>
          <span className="m-icone" aria-hidden="true">
            {icone}
          </span>
          {libelle}
          {cle === "taches" && nbTaches > 0 && <span className="m-badge">{nbTaches}</span>}
        </button>
      ))}
    </nav>
  );
}

// ----- Planning du jour -----
function Jour({ agenda, motifs, onOuvrirPatient, onMajRdv }) {
  const [date, setDate] = useState(aujourdhui());
  const rdv = agenda
    .filter((r) => r.date === date)
    .sort((a, b) => a.debut.localeCompare(b.debut) || a.fauteuil - b.fauteuil);
  const motif = (id) => motifs.find((m) => m.id === id);
  return (
    <section>
      <div className="m-barre-date">
        <button type="button" onClick={() => setDate(plusJours(date, -1))} aria-label="Jour précédent">
          ‹
        </button>
        <button type="button" className="m-date" onClick={() => setDate(aujourdhui())}>
          {date === aujourdhui() ? "Aujourd'hui" : jourLong(date)}
        </button>
        <button type="button" onClick={() => setDate(plusJours(date, 1))} aria-label="Jour suivant">
          ›
        </button>
      </div>
      <p className="m-aide">
        {rdv.filter((r) => r.statut !== "annule").length} rendez-vous · {jourLong(date)}
      </p>
      {rdv.length === 0 && <p className="m-vide">Aucun rendez-vous.</p>}
      <ul className="m-liste">
        {rdv.map((r) => {
          const m = motif(r.motif);
          const fin = minutes(r.debut) + r.duree;
          return (
            <li key={r.id} className={`m-rdv ${r.statut}`} style={{ borderLeftColor: m?.couleur || "#cbd5e1" }}>
              <button type="button" className="m-rdv-corps" onClick={() => r.patientId && onOuvrirPatient(r.patientId)}>
                <span className="m-rdv-heure">
                  {r.debut}
                  <small>
                    {String(Math.floor(fin / 60)).padStart(2, "0")}:{String(fin % 60).padStart(2, "0")}
                  </small>
                </span>
                <span className="m-rdv-texte">
                  <b>{r.nom || "—"}</b>
                  <span className="m-pastille" style={{ background: m?.couleur, color: texteSur(m?.couleur) }}>
                    {m?.nom || r.motif}
                  </span>
                  <small>
                    {FAUTEUILS[r.fauteuil]}
                    {r.note ? ` · ${r.note}` : ""}
                  </small>
                </span>
              </button>
              <div className="m-rdv-actions">
                {r.telephone && <a href={`tel:${r.telephone.replace(/[^\d+]/g, "")}`}>Appeler</a>}
                {Object.entries(STATUTS_RDV).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    className={r.statut === cle ? "actif" : ""}
                    onClick={() => onMajRdv({ ...r, statut: r.statut === cle ? "prevu" : cle })}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ----- Dossier patient en un écran -----
function FicheMobile({ id, agenda, cabinet, onRetour }) {
  const [dossier, setDossier] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    appelApi(`/patients/dossier/${id}`)
      .then((d) => actif && setDossier(d))
      .catch((err) => actif && setErreur(err.message));
    return () => {
      actif = false;
    };
  }, [id]);
  if (erreur) return <p className="cr-alerte">{erreur}</p>;
  if (!dossier) return <p className="m-aide">Chargement…</p>;
  const p = dossier.patient;
  const g = p.gestion || {};
  const datePremiere = [
    ...(dossier.comptesRendus || []).map((c) => c.patient?.date),
    ...(g.devis || []).map((d) => d.date),
    p.debut,
    p.creeLe?.slice(0, 10),
  ]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""))
    .sort()[0];
  const e = etatParcours(p, g, datePremiere);
  const etape = e.depose
    ? "Contention"
    : e.pose
      ? "En traitement"
      : e.bilan
        ? "Bilan fait, pose à venir"
        : "Avant le bilan";
  const auj = aujourdhui();
  const prochains = agenda
    .filter((r) => r.patientId === id && r.date >= auj && r.statut !== "annule")
    .sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut));
  const seances = [...(p.seances || [])].reverse().slice(0, 3);
  const tel = p.portable || p.telephone;
  return (
    <section className="m-fiche">
      <button type="button" className="m-retour" onClick={onRetour}>
        ‹ Patients
      </button>
      <h2>{nomComplet(p)}</h2>
      <p className="m-aide">
        {p.naissance ? `${formaterDate(p.naissance)} · ${age(p.naissance, auj)}` : ""}
        {p.lieu ? ` · ${nomLieu(cabinet, p.lieu)}` : ""}
      </p>
      <div className="m-chips">
        {p.statut && <span className="m-chip">{p.statut}</span>}
        {p.type && <span className="m-chip">{p.type}</span>}
        <span className="m-chip">{etape}</span>
      </div>
      {p.alerte && <p className="cr-alerte m-alerte">⚠ {p.alerte}</p>}
      {e.alertes.map((a) => (
        <p key={a} className="cr-alerte m-alerte">
          {a}
        </p>
      ))}
      <div className="m-contacts">
        {tel && <a href={`tel:${tel.replace(/[^\d+]/g, "")}`}>📞 Appeler</a>}
        {tel && <a href={`sms:${tel.replace(/[^\d+]/g, "")}`}>💬 SMS</a>}
        {p.email && <a href={`mailto:${p.email}`}>✉️ E-mail</a>}
      </div>

      <div className="m-carte">
        <h3>Prochain rendez-vous</h3>
        {prochains.length ? (
          prochains.slice(0, 2).map((r) => (
            <p key={r.id}>
              <b>{jourLong(r.date)}</b> à {r.debut} ·{" "}
              {reglagesPlanning(cabinet).motifs.find((m) => m.id === r.motif)?.nom}
            </p>
          ))
        ) : (
          <p className="m-aide">Aucun RDV prévu dans le planning.</p>
        )}
      </div>

      {g.semestres?.debut && (
        <div className="m-carte">
          <h3>Frise du traitement</h3>
          <FriseTraitement patient={p} gestion={g} compacte />
        </div>
      )}
      {!e.pose && e.manquants.length > 0 && (
        <div className="m-carte">
          <h3>Avant la pose, il manque</h3>
          <ul>
            {e.manquants.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="m-carte">
        <h3>Dernières séances</h3>
        {seances.length ? (
          seances.map((s, i) => (
            <div key={i} className="m-seance">
              <b>{s.date}</b>
              <span>{s.fait || "—"}</span>
              {s.prochaine && <small>Prochaine fois : {s.prochaine}</small>}
            </div>
          ))
        ) : (
          <p className="m-aide">Aucune séance saisie.</p>
        )}
      </div>

      {(p.diagnostic || p.plan) && (
        <div className="m-carte">
          <h3>Diagnostic et plan</h3>
          {p.diagnostic && <p className="m-pre">{p.diagnostic}</p>}
          {p.plan && <p className="m-pre">{p.plan}</p>}
        </div>
      )}
    </section>
  );
}

function Patients({ patients, agenda, cabinet, ouvert, onOuvrir }) {
  const [recherche, setRecherche] = useState("");
  if (ouvert) return <FicheMobile id={ouvert} agenda={agenda} cabinet={cabinet} onRetour={() => onOuvrir(null)} />;
  const n = normaliser(recherche);
  const liste = n
    ? patients.filter((p) => normaliser(`${p.nom} ${p.prenom} ${p.prenom} ${p.nom} ${p.code || ""}`).includes(n))
    : [];
  return (
    <section>
      <input
        type="search"
        className="m-recherche"
        placeholder="Nom, prénom ou code…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        autoFocus
      />
      {!n && <p className="m-aide">Tapez au moins une lettre du nom.</p>}
      <ul className="m-liste">
        {liste.slice(0, 50).map((p) => (
          <li key={p.id}>
            <button type="button" className="m-ligne" onClick={() => onOuvrir(p.id)}>
              <b>{nomComplet(p)}</b>
              <small>
                {[p.naissance && formaterDate(p.naissance), p.statut, p.lieu && nomLieu(cabinet, p.lieu)]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ----- Tâches et relances -----
function Taches({ donnees, cabinet, setDonnees, recharger, onOuvrirPatient }) {
  const [vue, setVue] = useState("echeances");
  const auj = aujourdhui();
  const auto = echeances(donnees, cabinet, "").filter((e) => e.date <= auj);
  const manuelles = (donnees.taches || []).filter((t) => !t.fait);
  const delais = delaisRelances(cabinet);
  const relances = donnees.patients.flatMap((p) => relancesPatient(p, delais, auj).map((r) => ({ ...r, patient: p })));
  async function fait(e) {
    await terminerEcheance(e, donnees, setDonnees);
    recharger();
  }
  async function tacheFaite(t) {
    const suivantes = donnees.taches.map((x) => (x.id === t.id ? { ...x, fait: auj } : x));
    setDonnees({ ...donnees, ...(await appelApi("/patients/gestion", { taches: suivantes })) });
  }
  async function relance(r) {
    const note = await demander("Relance effectuée. Note (facultatif) :");
    if (note === null) return;
    const g = r.patient.gestion || {};
    const rel = g.relances || {};
    await appelApi("/patients/gestion/dossier", {
      id: r.patient.id,
      gestion: {
        ...g,
        relances: {
          ...rel,
          historique: {
            ...(rel.historique || {}),
            [r.type]: [...(rel.historique?.[r.type] || []), { date: auj, note: note.trim() }],
          },
        },
      },
    });
    recharger();
  }
  return (
    <section>
      <div className="m-segments">
        <button type="button" className={vue === "echeances" ? "actif" : ""} onClick={() => setVue("echeances")}>
          À faire ({auto.length + manuelles.length})
        </button>
        <button type="button" className={vue === "relances" ? "actif" : ""} onClick={() => setVue("relances")}>
          Relances ({relances.length})
        </button>
      </div>
      {vue === "echeances" ? (
        <ul className="m-liste">
          {manuelles.map((t) => (
            <li key={t.id} className="m-tache">
              <span>
                <b>{t.titre}</b>
                <small>
                  {[t.echeance && `Échéance ${formaterDate(t.echeance)}`, t.note].filter(Boolean).join(" · ")}
                </small>
              </span>
              <button type="button" onClick={() => tacheFaite(t)}>
                Fait
              </button>
            </li>
          ))}
          {auto.map((e) => (
            <li key={e.cle} className="m-tache">
              <span>
                <button type="button" className="m-lien" onClick={() => onOuvrirPatient(e.patient.id)}>
                  {nomComplet(e.patient)}
                </button>
                <b>{e.titre}</b>
                <small>
                  {TYPES_ECHEANCES[e.type]} · {formaterDate(e.date)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </small>
              </span>
              <button type="button" onClick={() => fait(e)}>
                {LIBELLE_FAIT[e.type] || "Fait"}
              </button>
            </li>
          ))}
          {auto.length + manuelles.length === 0 && <p className="m-vide">Rien à faire aujourd'hui.</p>}
        </ul>
      ) : (
        <ul className="m-liste">
          {relances.map((r) => {
            const tel = r.patient.portable || r.patient.telephone;
            return (
              <li key={`${r.patient.id}-${r.type}`} className="m-tache">
                <span>
                  <button type="button" className="m-lien" onClick={() => onOuvrirPatient(r.patient.id)}>
                    {nomComplet(r.patient)}
                  </button>
                  <b>{TYPES_RELANCES[r.type].titre}</b>
                  <small>
                    {TYPES_RELANCES[r.type].depuis} {formaterDate(r.reference)}
                  </small>
                  {tel && (
                    <a className="m-lien" href={`tel:${tel.replace(/[^\d+]/g, "")}`}>
                      📞 {tel}
                    </a>
                  )}
                </span>
                <button type="button" onClick={() => relance(r)}>
                  Relancé
                </button>
              </li>
            );
          })}
          {relances.length === 0 && <p className="m-vide">Aucune relance.</p>}
        </ul>
      )}
    </section>
  );
}

export default function MobileApp() {
  const [onglet, setOnglet] = useState("jour");
  const [donnees, setDonnees] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [cabinet, setCabinet] = useState({});
  const [patientOuvert, setPatientOuvert] = useState(null);
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const [g, a, c] = await Promise.all([
          appelApi("/patients/gestion"),
          appelApi("/patients/agenda"),
          fetch("/api/cabinet").then((r) => (r.ok ? r.json() : {})),
        ]);
        if (!actif) return;
        setDonnees(g);
        setAgenda(a.rdv || []);
        setCabinet(c.cabinet || {});
      } catch (err) {
        if (actif)
          setDonnees({
            verrou: err.statut === 423 || err.statut === 404,
            existe: err.statut === 423,
            erreur: err.message,
          });
      }
    })();
    return () => {
      actif = false;
    };
  }, [version]);

  async function majRdv(r) {
    const { rdv } = await appelApi("/patients/agenda/rdv", { rdv: r });
    setAgenda((l) => [...l.filter((x) => x.id !== rdv.id), rdv]);
  }
  const ouvrirPatient = (id) => {
    setPatientOuvert(id);
    setOnglet("patients");
  };

  const pret = donnees && !donnees.verrou && !donnees.erreur;
  const nbTaches = pret
    ? echeances(donnees, cabinet, "").filter((e) => e.date <= aujourdhui()).length +
      (donnees.taches || []).filter((t) => !t.fait).length
    : 0;
  return (
    <div className="m-app">
      <header className="m-entete">
        <b>OrthoAI</b>
        <a href="/consultation.html?complet=1">Version complète</a>
      </header>
      <main className="m-contenu">
        {!donnees && <p className="m-aide">Chargement…</p>}
        {donnees?.verrou && (
          <section className="cr-carte">
            <h2>Dossiers verrouillés</h2>
            <Verrou existe={donnees.existe} onDeverrouille={recharger} />
          </section>
        )}
        {donnees?.erreur && !donnees.verrou && <p className="cr-alerte">{donnees.erreur}</p>}
        {pret && onglet === "jour" && (
          <Jour
            agenda={agenda}
            motifs={reglagesPlanning(cabinet).motifs}
            onOuvrirPatient={ouvrirPatient}
            onMajRdv={majRdv}
          />
        )}
        {pret && onglet === "patients" && (
          <Patients
            patients={donnees.patients}
            agenda={agenda}
            cabinet={cabinet}
            ouvert={patientOuvert}
            onOuvrir={setPatientOuvert}
          />
        )}
        {pret && onglet === "taches" && (
          <Taches
            donnees={donnees}
            cabinet={cabinet}
            setDonnees={setDonnees}
            recharger={recharger}
            onOuvrirPatient={ouvrirPatient}
          />
        )}
      </main>
      <Onglets
        onglet={onglet}
        onChange={(o) => {
          setOnglet(o);
          if (o === "patients") setPatientOuvert(null);
        }}
        nbTaches={nbTaches}
      />
    </div>
  );
}
