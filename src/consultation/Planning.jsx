// Planning du Chesnay : semaine, deux fauteuils (praticienne / assistante), planning type en
// fond (plages roses : RDV longs, bleues : RDV courts ou 1ères consultations), rendez-vous aux
// couleurs des motifs Doctolib. Saisie interne (pas de synchronisation avec Doctolib).
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { formaterDate } from "./format.js";
import { Verrou } from "./Historique.jsx";
import {
  FAUTEUILS,
  GENRES_PLAGES,
  chevauche,
  heure,
  lundi,
  minutes,
  plusJours,
  reglagesPlanning,
  texteSur,
} from "./planning.js";

const OUVERTURE = 9 * 60;
const FERMETURE = 19 * 60 + 30;
const PX = 1.5; // pixels par minute
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const STATUTS = { prevu: "Prévu", venu: "Venu", absent: "Absent", annule: "Annulé" };
const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const nomPatient = (p) =>
  `${(p.nom || "").toUpperCase()} ${p.prenom || ""}${p.naissance ? ` (${formaterDate(p.naissance)})` : ""}`.trim();

function FenetreRdv({ rdv, motifs, patients, tous, plages, onEnregistrer, onSupprimer, onOuvrirPatient, onFermer }) {
  const [r, setR] = useState(rdv);
  const [recherche, setRecherche] = useState(() => {
    const p = patients.find((x) => x.id === rdv.patientId);
    return p ? nomPatient(p) : rdv.nom || "";
  });
  const [etat, setEtat] = useState({ enCours: false, erreur: "" });
  const motif = motifs.find((x) => x.id === r.motif);
  const duFauteuil = motifs.filter((x) => x.fauteuil === r.fauteuil);
  const patient = patients.find((x) => nomPatient(x) === recherche);
  const conflits = tous.filter((x) => chevauche({ ...r, id: r.id || "nouveau" }, x));
  const jour = (new Date(`${r.date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const ouvert = plages.some(
    (p) =>
      p.fauteuil === r.fauteuil &&
      p.jour === jour + 1 &&
      minutes(p.debut) <= minutes(r.debut) &&
      minutes(r.debut) + r.duree <= minutes(p.fin),
  );

  async function enregistrer() {
    if (!r.motif) return setEtat({ enCours: false, erreur: "Choisissez le motif." });
    if (!patient && !recherche.trim()) return setEtat({ enCours: false, erreur: "Indiquez le patient." });
    setEtat({ enCours: true, erreur: "" });
    try {
      await onEnregistrer({ ...r, patientId: patient?.id || "", nom: patient ? "" : recherche.trim() }, motif?.lien);
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message });
    }
  }

  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="Rendez-vous">
      <section className="cr-carte oa-modale oa-fenetre-rdv">
        <div className="cr-titre-section">
          <h2>{rdv.id ? "Rendez-vous" : "Nouveau rendez-vous"}</h2>
          <button type="button" className="cr-lien" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cr-champs-ligne">
          <label>
            Date
            <input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
          </label>
          <label>
            Heure
            <input type="time" step="300" value={r.debut} onChange={(e) => setR({ ...r, debut: e.target.value })} />
          </label>
          <label>
            Fauteuil
            <select
              value={r.fauteuil}
              onChange={(e) => {
                const f = Number(e.target.value);
                const premier = motifs.find((x) => x.fauteuil === f);
                setR({ ...r, fauteuil: f, motif: premier?.id || "", duree: premier?.duree || r.duree });
              }}
            >
              {Object.entries(FAUTEUILS).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="cr-bloc">
          Motif
          <select
            value={r.motif}
            style={motif ? { borderLeft: `10px solid ${motif.couleur}` } : undefined}
            onChange={(e) => {
              const choisi = motifs.find((x) => x.id === e.target.value);
              setR({ ...r, motif: e.target.value, duree: choisi?.duree || r.duree });
            }}
          >
            <option value="">— Choisir —</option>
            {duFauteuil.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom} · {x.duree} min
              </option>
            ))}
          </select>
        </label>
        <div className="cr-champs-ligne">
          <label>
            Patient
            <input
              list="oa-rdv-patients"
              value={recherche}
              placeholder="Rechercher un dossier, ou nom d'un nouveau patient"
              onChange={(e) => setRecherche(e.target.value)}
            />
            <datalist id="oa-rdv-patients">
              {patients.map((p) => (
                <option key={p.id} value={nomPatient(p)} />
              ))}
            </datalist>
          </label>
          <label className="cr-champ-court">
            Durée (min)
            <input
              type="number"
              min="5"
              step="5"
              value={r.duree}
              onChange={(e) => setR({ ...r, duree: Math.max(5, Number(e.target.value) || 5) })}
            />
          </label>
        </div>
        {!patient && recherche.trim() && (
          <label className="cr-bloc">
            Téléphone (nouveau patient, sans dossier)
            <input value={r.telephone || ""} onChange={(e) => setR({ ...r, telephone: e.target.value })} />
          </label>
        )}
        <label className="cr-bloc">
          Note
          <input value={r.note || ""} onChange={(e) => setR({ ...r, note: e.target.value })} />
        </label>
        {rdv.id && (
          <div className="oa-rdv-statuts" role="group" aria-label="Statut">
            {Object.entries(STATUTS).map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                className={r.statut === cle ? "principal" : "secondaire"}
                onClick={() => setR({ ...r, statut: cle })}
              >
                {libelle}
              </button>
            ))}
          </div>
        )}
        {motif?.lien && patient && (
          <p className="cr-aide">
            Ce rendez-vous renseigne le RDV de{" "}
            {{ pose: "pose", depose: "dépose", facturation: "facturation" }[motif.lien]} dans le parcours du patient
            (message 3 jours avant).
          </p>
        )}
        {conflits.length > 0 && (
          <p className="cr-alerte">
            Chevauche : {conflits.map((x) => `${x.debut} ${x.nom}`).join(", ")} (même fauteuil).
          </p>
        )}
        {!ouvert && <p className="cr-aide oa-hors-plage">Hors des plages d'ouverture de ce fauteuil.</p>}
        {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
        <div className="cr-actions">
          <button type="button" className="principal" disabled={etat.enCours} onClick={enregistrer}>
            Enregistrer
          </button>
          {rdv.patientId && (
            <button type="button" className="secondaire" onClick={() => onOuvrirPatient(rdv.patientId)}>
              Ouvrir le dossier
            </button>
          )}
          {rdv.id && (
            <button
              type="button"
              className="danger"
              onClick={() => window.confirm("Supprimer ce rendez-vous ?") && onSupprimer(rdv.id)}
            >
              Supprimer
            </button>
          )}
          <button type="button" className="secondaire" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Planning({ cabinet, onOuvrirPatient }) {
  const { motifs, plages } = reglagesPlanning(cabinet);
  const [semaine, setSemaine] = useState(() => lundi(aujourdhui()));
  const [donnees, setDonnees] = useState(null);
  const [patients, setPatients] = useState([]);
  const [edition, setEdition] = useState(null);
  const [tousJours, setTousJours] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    Promise.all([appelApi("/patients/agenda"), appelApi("/patients")])
      .then(([a, p]) => {
        if (!actif) return;
        setDonnees({ rdv: a.rdv || [] });
        setPatients((p.patients || []).filter((x) => !x.lieu || x.lieu === "chesnay"));
      })
      .catch(
        (err) =>
          actif &&
          setDonnees({
            erreur: err.message,
            verrou: err.statut === 423 || err.statut === 404,
            existe: err.statut === 423,
          }),
      );
    return () => {
      actif = false;
    };
  }, [version]);

  if (!donnees)
    return (
      <div className="cr-app">
        <p className="cr-aide">Chargement du planning…</p>
      </div>
    );
  if (donnees.verrou || donnees.erreur)
    return (
      <div className="cr-app">
        <header className="cr-entete">
          <h1>Planning</h1>
        </header>
        {donnees.verrou ? (
          <section className="cr-carte">
            <h2>Dossiers verrouillés</h2>
            <Verrou existe={donnees.existe} onDeverrouille={() => setVersion((v) => v + 1)} />
          </section>
        ) : (
          <p className="cr-alerte">{donnees.erreur}</p>
        )}
      </div>
    );

  const dates = JOURS.map((_, i) => plusJours(semaine, i));
  const rdvSemaine = donnees.rdv.filter((r) => dates.includes(r.date));
  const joursAffiches = JOURS.map((nom, i) => ({ nom, i, date: dates[i] })).filter(
    (j) => tousJours || plages.some((p) => p.jour === j.i + 1) || rdvSemaine.some((r) => r.date === j.date),
  );
  const motifDe = (id) => motifs.find((x) => x.id === id);
  const auj = aujourdhui();
  const maintenant = new Date();
  const minuteMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

  async function enregistrer(r, lien) {
    const { rdv } = await appelApi("/patients/agenda/rdv", { rdv: r, lien });
    setDonnees((d) => ({ rdv: [...d.rdv.filter((x) => x.id !== rdv.id), rdv] }));
    setEdition(null);
  }
  async function supprimer(id) {
    await appelApi("/patients/agenda/supprimer", { id });
    setDonnees((d) => ({ rdv: d.rdv.filter((x) => x.id !== id) }));
    setEdition(null);
  }
  function nouveau(e, date, fauteuil, jour) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const debut = Math.min(FERMETURE - 5, OUVERTURE + Math.floor(y / PX / 5) * 5);
    const plage = plages.find(
      (p) => p.fauteuil === fauteuil && p.jour === jour + 1 && minutes(p.debut) <= debut && debut < minutes(p.fin),
    );
    // Motif proposé selon la plage : long → pose, court → suivi, créneau → 1ère consultation.
    const parDefaut =
      motifs.find(
        (x) =>
          x.fauteuil === fauteuil &&
          (plage?.genre === "long" ? x.duree >= 30 : plage?.genre === "court" ? x.duree < 30 : true),
      ) || motifs.find((x) => x.fauteuil === fauteuil);
    setEdition({
      date,
      debut: plage?.genre === "consultation" ? plage.debut : heure(debut),
      fauteuil,
      motif: parDefaut?.id || "",
      duree: parDefaut?.duree || 15,
      statut: "prevu",
      lieu: "chesnay",
    });
  }

  const hauteur = (FERMETURE - OUVERTURE) * PX;
  const heures = [];
  for (let t = OUVERTURE; t <= FERMETURE; t += 30) heures.push(t);

  return (
    <div className="cr-app cr-app-large oa-planning">
      <header className="cr-entete">
        <h1>Planning · Le Chesnay</h1>
      </header>
      <div className="oa-planning-barre">
        <button
          type="button"
          className="secondaire"
          onClick={() => setSemaine(plusJours(semaine, -7))}
          aria-label="Semaine précédente"
        >
          ◀
        </button>
        <button type="button" className="secondaire" onClick={() => setSemaine(lundi(auj))}>
          Aujourd'hui
        </button>
        <button
          type="button"
          className="secondaire"
          onClick={() => setSemaine(plusJours(semaine, 7))}
          aria-label="Semaine suivante"
        >
          ▶
        </button>
        <b>
          Semaine du {formaterDate(semaine)} au {formaterDate(plusJours(semaine, 5))}
        </b>
        <label className="cr-case">
          <input type="checkbox" checked={tousJours} onChange={(e) => setTousJours(e.target.checked)} /> Afficher tous
          les jours
        </label>
        <span className="oa-planning-legende-plages">
          {Object.entries(GENRES_PLAGES)
            .filter(([cle]) => cle !== "consultation")
            .map(([cle, g]) => (
              <span key={cle}>
                <i style={{ background: g.couleur, borderColor: g.bord }} /> {g.libelle}
              </span>
            ))}
        </span>
      </div>

      <div
        className="oa-planning-grille"
        style={{ gridTemplateColumns: `52px repeat(${joursAffiches.length * 2}, minmax(120px, 1fr))` }}
      >
        <div className="oa-planning-coin" />
        {joursAffiches.map((j) => (
          <div
            key={j.date}
            className={`oa-planning-jour${j.date === auj ? " aujourdhui" : ""}`}
            style={{ gridColumn: "span 2" }}
          >
            {j.nom} {formaterDate(j.date).slice(0, 5)}
          </div>
        ))}
        <div className="oa-planning-coin" />
        {joursAffiches.map((j) =>
          [1, 2].map((f) => (
            <div key={`${j.date}-${f}`} className="oa-planning-fauteuil">
              {f === 1 ? "Fauteuil 1 · ortho" : "Fauteuil 2 · blanc"}
            </div>
          )),
        )}
        <div className="oa-planning-heures" style={{ height: hauteur }}>
          {heures.map((t) => (
            <span key={t} style={{ top: (t - OUVERTURE) * PX }}>
              {t % 60 === 0 ? heure(t) : ""}
            </span>
          ))}
        </div>
        {joursAffiches.map((j) =>
          [1, 2].map((f) => (
            <div
              key={`${j.date}-${f}-col`}
              className={`oa-planning-colonne f${f}`}
              style={{ height: hauteur }}
              onClick={(e) =>
                e.target === e.currentTarget || e.target.dataset.plage ? nouveau(e, j.date, f, j.i) : null
              }
              role="presentation"
            >
              {plages
                .filter((p) => p.fauteuil === f && p.jour === j.i + 1)
                .map((p) => (
                  <div
                    key={`${p.debut}-${p.genre}`}
                    data-plage="1"
                    className={`oa-planning-plage ${p.genre}`}
                    style={{
                      top: (minutes(p.debut) - OUVERTURE) * PX,
                      height: (minutes(p.fin) - minutes(p.debut)) * PX,
                      background: GENRES_PLAGES[p.genre]?.couleur,
                      borderColor: GENRES_PLAGES[p.genre]?.bord,
                    }}
                  />
                ))}
              {j.date === auj && minuteMaintenant > OUVERTURE && minuteMaintenant < FERMETURE && (
                <div className="oa-planning-maintenant" style={{ top: (minuteMaintenant - OUVERTURE) * PX }} />
              )}
              {rdvSemaine
                .filter((r) => r.date === j.date && r.fauteuil === f)
                .sort((a, b) => a.debut.localeCompare(b.debut))
                .map((r) => {
                  const mo = motifDe(r.motif);
                  const couleur = mo?.couleur || "#cbd5e1";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`oa-rdv ${r.statut}`}
                      title={`${r.debut} · ${r.nom} · ${mo?.nom || r.motif}${r.note ? ` · ${r.note}` : ""}`}
                      style={{
                        top: (minutes(r.debut) - OUVERTURE) * PX,
                        height: Math.max(14, r.duree * PX - 2),
                        background: couleur,
                        color: texteSur(couleur),
                      }}
                      onClick={() => setEdition(r)}
                    >
                      <b>{r.debut}</b> {r.nom}
                      {r.duree >= 15 && <small>{mo?.nom || r.motif}</small>}
                    </button>
                  );
                })}
            </div>
          )),
        )}
      </div>

      <details className="oa-planning-motifs">
        <summary>Motifs et couleurs</summary>
        {[1, 2].map((f) => (
          <div key={f}>
            <b>{FAUTEUILS[f]}</b>
            <ul>
              {motifs
                .filter((x) => x.fauteuil === f)
                .map((x) => (
                  <li key={x.id}>
                    <i style={{ background: x.couleur }} /> {x.nom} · {x.duree} min
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </details>

      {edition && (
        <FenetreRdv
          rdv={edition}
          motifs={motifs}
          patients={patients}
          tous={donnees.rdv}
          plages={plages}
          onEnregistrer={enregistrer}
          onSupprimer={supprimer}
          onOuvrirPatient={onOuvrirPatient}
          onFermer={() => setEdition(null)}
        />
      )}
    </div>
  );
}
