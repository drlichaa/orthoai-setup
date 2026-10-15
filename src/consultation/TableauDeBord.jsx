import { useEffect, useState } from "react";
import { appelApi, appelHistorique } from "./apiHistorique.js";
import { classeStatut, dateLongue, formaterDate } from "./format.js";
import { Verrou } from "./Historique.jsx";
import { Icone } from "./Navigation.jsx";

// Page d'accueil : actions rapides, patients par statut, alertes et derniers
// comptes rendus.

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

async function lireTableau() {
  try {
    const etat = await appelHistorique("/etat");
    if (!etat.deverrouille) return { etat };
    const [{ patients, reglages }, { fiches }] = await Promise.all([appelApi("/patients"), appelHistorique("")]);
    return { etat, patients, reglages, fiches };
  } catch (err) {
    if (err.statut === 423) return { etat: { existe: true, deverrouille: false } };
    return { erreur: err.message };
  }
}

function salutation() {
  const heure = new Date().getHours();
  return heure < 18 ? "Bonjour" : "Bonsoir";
}

export default function TableauDeBord({
  cabinet,
  onAller,
  onOuvrirPatient,
  onOuvrirCompteRendu,
  onNouvelleConsultation,
}) {
  const [donnees, setDonnees] = useState(null);

  async function charger() {
    setDonnees(await lireTableau());
  }

  useEffect(() => {
    let actif = true;
    lireTableau().then((d) => actif && setDonnees(d));
    return () => {
      actif = false;
    };
  }, []);

  const nomPraticien = (cabinet.praticien || "").replace(/^(Docteur|Dr\.?)\s+/i, "");

  const actions = [
    ["consultation", "Nouvelle consultation", "Enregistrer et rédiger le compte rendu", onNouvelleConsultation],
    ["patients", "Patients", "Rechercher ou créer un dossier", () => onAller("patients")],
    ["historique", "Comptes rendus", "Retrouver un compte rendu", () => onAller("historique")],
  ];

  const { patients = [], reglages, fiches = [] } = donnees || {};
  const parStatut = reglages
    ? reglages.statuts
        .map((s) => ({ ...s, nombre: patients.filter((p) => p.statut === s.nom).length }))
        .filter((s) => s.nombre)
    : [];
  const alertes = patients.filter((p) => p.alerte);
  const derniers = fiches.slice(0, 6);

  return (
    <div className="cr-app">
      <header className="oa-bienvenue">
        <div>
          <p className="oa-date">{dateLongue(aujourdhui())}</p>
          <h1>
            {salutation()}
            {nomPraticien ? ` Dr ${nomPraticien}` : ""}
          </h1>
        </div>
      </header>

      <div className="oa-actions">
        {actions.map(([icone, titre, texte, action]) => (
          <button key={titre} type="button" className="oa-action" onClick={action}>
            <span className="oa-action-icone">
              <Icone nom={icone} taille={22} />
            </span>
            <span>
              <strong>{titre}</strong>
              <small>{texte}</small>
            </span>
          </button>
        ))}
      </div>

      {donnees?.erreur && <p className="cr-alerte">{donnees.erreur}</p>}

      {donnees?.etat && !donnees.etat.deverrouille && (
        <section className="cr-carte">
          <h2>{donnees.etat.existe ? "Dossiers verrouillés" : "Protéger les dossiers patients"}</h2>
          <Verrou existe={donnees.etat.existe} onDeverrouille={charger} />
        </section>
      )}

      {donnees?.etat?.deverrouille && (
        <>
          <div className="oa-chiffres">
            <button type="button" className="oa-chiffre" onClick={() => onAller("patients")}>
              <strong>{patients.length}</strong>
              <span>patient{patients.length > 1 ? "s" : ""}</span>
            </button>
            <button type="button" className="oa-chiffre" onClick={() => onAller("historique")}>
              <strong>{fiches.length}</strong>
              <span>
                compte{fiches.length > 1 ? "s" : ""} rendu{fiches.length > 1 ? "s" : ""}
              </span>
            </button>
            <div className="oa-chiffre oa-chiffre-statuts">
              <span className="oa-chiffre-titre">Patients par statut</span>
              <div className="oa-statuts">
                {parStatut.length === 0 && <span className="cr-aide">Aucun patient pour l'instant.</span>}
                {parStatut.map((s) => (
                  <span key={s.nom} className={classeStatut(reglages, s.nom)}>
                    {s.nom} · {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="oa-colonnes">
            <section className="cr-carte">
              <div className="cr-titre-section">
                <h2>Derniers comptes rendus</h2>
                <button type="button" className="cr-lien" onClick={() => onAller("historique")}>
                  Tout voir →
                </button>
              </div>
              {derniers.length === 0 ? (
                <p className="cr-aide">Aucun compte rendu pour l'instant.</p>
              ) : (
                <ul className="oa-liste">
                  {derniers.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => onOuvrirCompteRendu(f.id)}>
                        <span className="oa-liste-date">{formaterDate(f.patient?.date)}</span>
                        <span className="oa-liste-texte">
                          <strong>
                            {[f.patient?.nom?.toUpperCase(), f.patient?.prenom].filter(Boolean).join(" ") || "Patient"}
                          </strong>
                          <small>{f.motif}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cr-carte">
              <h2>Alertes patients</h2>
              {alertes.length === 0 ? (
                <p className="cr-aide">Aucune alerte en cours.</p>
              ) : (
                <ul className="oa-liste">
                  {alertes.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => onOuvrirPatient(p.id)}>
                        <span className="oa-liste-alerte">⚠</span>
                        <span className="oa-liste-texte">
                          <strong>{[p.nom?.toUpperCase(), p.prenom].filter(Boolean).join(" ")}</strong>
                          {p.statut && <small>{p.statut}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
