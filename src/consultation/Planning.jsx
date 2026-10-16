// Planning du Chesnay : semaine, deux fauteuils (praticienne / assistante), planning type en
// fond (plages roses : RDV longs, bleues : RDV courts ou 1ères consultations), rendez-vous aux
// couleurs des motifs Doctolib. Saisie interne (pas de synchronisation avec Doctolib).
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { formaterDate } from "./format.js";
import { Verrou } from "./Historique.jsx";
import { normaliser } from "./questionnaireWeclever.js";
import {
  FAUTEUILS,
  GENRES_PLAGES,
  PAS,
  chevauche,
  compatible,
  creneauxLibres,
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
            <input type="time" step="900" value={r.debut} onChange={(e) => setR({ ...r, debut: e.target.value })} />
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

// Motif proposé pour un créneau cliqué : selon la plage (longue → pose, courte → suivi…).
function motifPourPlage(motifs, plage, fauteuil) {
  return (
    motifs.find((x) => x.fauteuil === fauteuil && (plage ? compatible(x, plage) : true)) ||
    motifs.find((x) => x.fauteuil === fauteuil)
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
  // « Trouver un créneau » : motif recherché et texte de recherche.
  const [motifRecherche, setMotifRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  // Créneau survolé : { date, fauteuil, debut (minutes), jour }.
  const [survol, setSurvol] = useState(null);
  const [messageDispo, setMessageDispo] = useState("");

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

  const datesDe = (lundiSemaine) => JOURS.map((_, i) => plusJours(lundiSemaine, i));
  const dates = datesDe(semaine);
  const rdvSemaine = donnees.rdv.filter((r) => dates.includes(r.date));
  const joursAffiches = JOURS.map((nom, i) => ({ nom, i, date: dates[i] })).filter(
    (j) => tousJours || plages.some((p) => p.jour === j.i + 1) || rdvSemaine.some((r) => r.date === j.date),
  );
  const motifDe = (id) => motifs.find((x) => x.id === id);
  const recherche = motifDe(motifRecherche);
  const libres = creneauxLibres({ motif: recherche, plages, rdv: donnees.rdv, dates });
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

  // Créneau sous la souris : début au quart d'heure, durée du motif recherché ou proposé par la plage.
  function creneauSous(e, date, fauteuil, jour) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minute = OUVERTURE + Math.floor(y / PX / PAS) * PAS;
    const plage = plages.find(
      (p) => p.fauteuil === fauteuil && p.jour === jour + 1 && minutes(p.debut) <= minute && minute < minutes(p.fin),
    );
    const motif = recherche?.fauteuil === fauteuil ? recherche : motifPourPlage(motifs, plage, fauteuil);
    // Créneau de 1ère consultation : il commence au début du créneau.
    const debut = plage?.genre === "consultation" ? minutes(plage.debut) : minute;
    const fin = debut + (motif?.duree || 15);
    const libre =
      Boolean(plage) &&
      fin <= minutes(plage.fin) &&
      !donnees.rdv.some(
        (r) =>
          r.date === date &&
          r.fauteuil === fauteuil &&
          r.statut !== "annule" &&
          debut < minutes(r.debut) + r.duree &&
          minutes(r.debut) < fin,
      );
    return { date, fauteuil, jour, debut, fin, motif, libre };
  }
  function ouvrir(c) {
    setEdition({
      date: c.date,
      debut: heure(c.debut),
      fauteuil: c.fauteuil,
      motif: c.motif?.id || "",
      duree: c.motif?.duree || 15,
      statut: "prevu",
      lieu: "chesnay",
    });
  }
  function prochaineDispo() {
    for (let k = 0; k < 26; k++) {
      const lundiK = plusJours(lundi(auj), 7 * k);
      if (creneauxLibres({ motif: recherche, plages, rdv: donnees.rdv, dates: datesDe(lundiK) }).length) {
        setSemaine(lundiK);
        setMessageDispo("");
        return;
      }
    }
    setMessageDispo("Aucun créneau libre dans les 6 prochains mois pour ce motif.");
  }

  const hauteur = (FERMETURE - OUVERTURE) * PX;
  const heures = [];
  for (let t = OUVERTURE; t <= FERMETURE; t += 30) heures.push(t);
  const motifsFiltres = motifs.filter((x) => normaliser(x.nom).includes(normaliser(filtre)));
  const creneauxDuJour = (date, f) => libres.filter((c) => c.date === date && c.fauteuil === f);

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

      <div className="oa-planning-corps">
        <aside className="oa-planning-cote">
          <h2>Trouver un créneau</h2>
          {recherche ? (
            <>
              <div className="oa-motif-choisi" style={{ borderLeftColor: recherche.couleur }}>
                <span>
                  <b>{recherche.nom}</b>
                  <small>
                    {recherche.duree} min · {FAUTEUILS[recherche.fauteuil]}
                  </small>
                </span>
                <button
                  type="button"
                  className="cr-lien"
                  aria-label="Retirer le motif"
                  onClick={() => {
                    setMotifRecherche("");
                    setMessageDispo("");
                  }}
                >
                  ✕
                </button>
              </div>
              <button type="button" className="principal oa-prochaine-dispo" onClick={prochaineDispo}>
                Prochaine dispo →
              </button>
              {messageDispo && <p className="cr-aide">{messageDispo}</p>}
              <p className="cr-aide">
                {libres.length
                  ? `${libres.length} créneau(x) libre(s) cette semaine, en vert dans le planning :`
                  : "Aucun créneau libre cette semaine."}
              </p>
              <ul className="oa-propositions">
                {libres.slice(0, 40).map((c) => (
                  <li key={`${c.date}-${c.debut}`}>
                    <button
                      type="button"
                      className="cr-lien"
                      onClick={() => ouvrir({ ...c, debut: minutes(c.debut), motif: recherche })}
                    >
                      {JOURS[(new Date(`${c.date}T12:00:00Z`).getUTCDay() + 6) % 7].slice(0, 3)}{" "}
                      {formaterDate(c.date).slice(0, 5)} · {c.debut} → {c.fin}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <input
                type="search"
                className="oa-recherche-motif"
                placeholder="Motif (ex. dépose, pose, suivi…)"
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
              />
              <ul className="oa-liste-motifs">
                {motifsFiltres.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => setMotifRecherche(x.id)}>
                      <i style={{ background: x.couleur }} /> {x.nom}
                      <small>
                        {x.duree} min · F{x.fauteuil}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

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
            [1, 2].map((f) => {
              const fantome = survol && survol.date === j.date && survol.fauteuil === f ? survol : null;
              return (
                <div
                  key={`${j.date}-${f}-col`}
                  className={`oa-planning-colonne f${f}`}
                  style={{ height: hauteur }}
                  onMouseMove={(e) => {
                    if (e.target.closest(".oa-rdv, .oa-creneau-libre")) return setSurvol(null);
                    const c = creneauSous(e, j.date, f, j.i);
                    if (!survol || survol.date !== c.date || survol.fauteuil !== c.fauteuil || survol.debut !== c.debut)
                      setSurvol(c);
                  }}
                  onMouseLeave={() => setSurvol(null)}
                  onClick={(e) => {
                    if (e.target.closest(".oa-rdv, .oa-creneau-libre")) return;
                    ouvrir(creneauSous(e, j.date, f, j.i));
                  }}
                  role="presentation"
                >
                  {plages
                    .filter((p) => p.fauteuil === f && p.jour === j.i + 1)
                    .map((p) => (
                      <div
                        key={`${p.debut}-${p.genre}`}
                        className={`oa-planning-plage ${p.genre}`}
                        style={{
                          top: (minutes(p.debut) - OUVERTURE) * PX,
                          height: (minutes(p.fin) - minutes(p.debut)) * PX,
                          background: GENRES_PLAGES[p.genre]?.couleur,
                          borderColor: GENRES_PLAGES[p.genre]?.bord,
                        }}
                      />
                    ))}
                  {creneauxDuJour(j.date, f).map((c, k) => (
                    <button
                      key={c.debut}
                      type="button"
                      className={`oa-creneau-libre${k % 2 ? " clair" : ""}`}
                      style={{
                        top: (minutes(c.debut) - OUVERTURE) * PX,
                        height: recherche.duree * PX - 2,
                      }}
                      onClick={() => ouvrir({ ...c, debut: minutes(c.debut), motif: recherche })}
                    >
                      {c.debut} → {c.fin} <span aria-hidden="true">+</span>
                    </button>
                  ))}
                  {fantome && (
                    <div
                      className={`oa-creneau-survol${fantome.libre ? "" : " occupe"}`}
                      style={{
                        top: (fantome.debut - OUVERTURE) * PX,
                        height: (fantome.fin - fantome.debut) * PX - 2,
                        borderColor: fantome.motif?.couleur,
                      }}
                    >
                      {heure(fantome.debut)} → {heure(fantome.fin)}
                      {fantome.motif && <small>{fantome.motif.nom}</small>}
                    </div>
                  )}
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
              );
            }),
          )}
        </div>
      </div>

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
