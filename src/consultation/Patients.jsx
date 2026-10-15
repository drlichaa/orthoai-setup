import { useEffect, useState } from "react";
import { appelApi, appelHistorique } from "./apiHistorique.js";
import FichePatient from "./FichePatient.jsx";
import ImportOrthofast from "./ImportOrthofast.jsx";
import { Verrou } from "./Historique.jsx";
import { dansLieu, lieux, nomLieu } from "./lieux.js";
import { age, classeStatut, formaterDate, formaterNom, formaterPrenom } from "./format.js";

// Dossiers patients, dans le même coffre chiffré que l'historique.

const COULEURS = {
  green: "Vert",
  teal: "Turquoise",
  blue: "Bleu",
  indigo: "Indigo",
  purple: "Violet",
  pink: "Rose",
  red: "Rouge",
  orange: "Orange",
  yellow: "Jaune",
  brown: "Marron",
  grey: "Gris",
  black: "Noir",
};

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function sansAccents(texte) {
  return (texte || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

async function lirePatients() {
  try {
    const etat = await appelHistorique("/etat");
    if (!etat.deverrouille) return { etat };
    return { etat, ...(await appelApi("/patients")) };
  } catch (err) {
    if (err.statut === 423) return { etat: { existe: true, deverrouille: false } };
    return { erreur: err.message };
  }
}

const MISE_EN_FORME = { nom: formaterNom, prenom: formaterPrenom };

function NouveauPatient({ reglages, cabinet, lieuActif, onCree, onAnnuler }) {
  const [champs, setChamps] = useState({ nom: "", prenom: "", naissance: "", email: "", lieu: lieuActif || "" });
  const [erreur, setErreur] = useState("");

  async function creer(e) {
    e.preventDefault();
    try {
      const { patient } = await appelApi("/patients/enregistrer", {
        patient: { ...champs, type: "", statut: reglages.statuts[0]?.nom, debut: aujourdhui() },
      });
      onCree(patient.id);
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <form className="cr-carte" onSubmit={creer}>
      <h2>Nouveau patient</h2>
      <div className="cr-champs-ligne">
        {[
          ["nom", "Nom", "text"],
          ["prenom", "Prénom", "text"],
          ["naissance", "Date de naissance", "date"],
          ["email", "E-mail", "email"],
        ].map(([cle, libelle, type]) => (
          <label key={cle}>
            {libelle}
            <input
              type={type}
              value={champs[cle]}
              autoFocus={cle === "nom"}
              onChange={(e) => setChamps({ ...champs, [cle]: MISE_EN_FORME[cle]?.(e.target.value) ?? e.target.value })}
            />
          </label>
        ))}
        <label>
          Cabinet
          <select
            value={champs.lieu}
            className={champs.lieu ? undefined : "oa-a-choisir"}
            onChange={(e) => setChamps({ ...champs, lieu: e.target.value })}
          >
            <option value="">À choisir…</option>
            {lieux(cabinet).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cr-actions cr-verrou-actions">
        <button type="submit" className="principal" disabled={!champs.nom.trim() && !champs.prenom.trim()}>
          Créer le dossier
        </button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
      {erreur && <p className="cr-alerte">{erreur}</p>}
    </form>
  );
}

function Reglages({ reglages, patients, onChange }) {
  const [nouveauStatut, setNouveauStatut] = useState({ nom: "", couleur: "blue" });
  const [erreur, setErreur] = useState("");

  async function enregistrer(suivants) {
    setErreur("");
    try {
      onChange((await appelApi("/patients/reglages", { reglages: suivants })).reglages);
    } catch (err) {
      setErreur(err.message);
    }
  }

  const nbStatut = (s) => patients.filter((p) => p.statut === s).length;

  return (
    <section className="cr-carte">
      <h2>Statuts</h2>
      <p className="cr-aide">
        Un statut utilisé par un patient ne peut pas être supprimé : changez d'abord celui des patients concernés. Le
        type de traitement se choisit parmi les appareils du catalogue (« Appareils &amp; cabinet ») quand le statut est
        « En traitement ».
      </p>
      <div className="cr-reglages">
        <div>
          <h3>Statuts</h3>
          {reglages.statuts.map((s, i) => (
            <div key={s.nom} className="cr-reglage-ligne">
              <span className={classeStatut(reglages, s.nom)}>{s.nom}</span>
              <select
                value={s.couleur}
                aria-label={`Couleur de « ${s.nom} »`}
                onChange={(e) =>
                  enregistrer({
                    ...reglages,
                    statuts: reglages.statuts.map((x, j) => (j === i ? { ...x, couleur: e.target.value } : x)),
                  })
                }
              >
                {Object.entries(COULEURS).map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </select>
              <span className="cr-aide">{nbStatut(s.nom)} patient(s)</span>
              <button
                type="button"
                className="danger"
                disabled={nbStatut(s.nom) > 0 || reglages.statuts.length <= 1}
                onClick={() => enregistrer({ ...reglages, statuts: reglages.statuts.filter((_, j) => j !== i) })}
              >
                Supprimer
              </button>
            </div>
          ))}
          <form
            className="cr-reglage-ligne"
            onSubmit={(e) => {
              e.preventDefault();
              const nom = nouveauStatut.nom.trim();
              if (!nom || reglages.statuts.some((s) => s.nom === nom)) return;
              enregistrer({ ...reglages, statuts: [...reglages.statuts, { ...nouveauStatut, nom }] });
              setNouveauStatut({ nom: "", couleur: "blue" });
            }}
          >
            <input
              value={nouveauStatut.nom}
              placeholder="Nouveau statut…"
              onChange={(e) => setNouveauStatut({ ...nouveauStatut, nom: e.target.value })}
            />
            <select
              value={nouveauStatut.couleur}
              aria-label="Couleur du nouveau statut"
              onChange={(e) => setNouveauStatut({ ...nouveauStatut, couleur: e.target.value })}
            >
              {Object.entries(COULEURS).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </select>
            <button type="submit" className="secondaire">
              + Ajouter
            </button>
          </form>
        </div>
      </div>
      {erreur && <p className="cr-alerte">{erreur}</p>}
    </section>
  );
}

export default function Patients({
  patientId,
  lieuActif = "",
  onglet,
  onSelection,
  onOuvrirCompteRendu,
  onNouvelleConsultation,
  onFermer,
  cabinet,
  appareils,
}) {
  const [donnees, setDonnees] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("Tous");
  const [mode, setMode] = useState("liste"); // liste | nouveau | reglages | import
  // Montre les dossiers sans cabinet, à rattacher au Chesnay ou à Herblay.
  const [sansLieu, setSansLieu] = useState(false);

  async function charger() {
    setDonnees(await lirePatients());
  }

  useEffect(() => {
    let actif = true;
    lirePatients().then((d) => actif && setDonnees(d));
    return () => {
      actif = false;
    };
  }, [patientId]);

  const entete = (
    <header className="cr-entete">
      <h1>Patients</h1>
      <div className="cr-actions">
        {donnees?.etat?.deverrouille && !patientId && (
          <>
            <button
              type="button"
              className="secondaire"
              onClick={() => setMode(mode === "reglages" ? "liste" : "reglages")}
            >
              {mode === "reglages" ? "Retour à la liste" : "Statuts"}
            </button>
            <button type="button" className="secondaire" onClick={() => setMode("import")}>
              Importer l'export OrthoFast
            </button>
            <button type="button" className="principal" onClick={() => setMode("nouveau")}>
              + Nouveau patient
            </button>
          </>
        )}
        {onFermer && (
          <button type="button" className="secondaire" onClick={onFermer}>
            Retour à la consultation
          </button>
        )}
      </div>
    </header>
  );

  if (!donnees) return <div className="cr-app">{entete}</div>;

  if (!donnees.etat?.deverrouille) {
    return (
      <div className="cr-app">
        {entete}
        {donnees.erreur && <p className="cr-alerte">{donnees.erreur}</p>}
        {donnees.etat && (
          <section className="cr-carte">
            <h2>{donnees.etat.existe ? "Dossiers verrouillés" : "Protéger les dossiers patients"}</h2>
            <Verrou existe={donnees.etat.existe} onDeverrouille={charger} />
          </section>
        )}
      </div>
    );
  }

  if (patientId) {
    return (
      <div className="cr-app cr-app-large">
        <FichePatient
          patientId={patientId}
          ongletInitial={onglet}
          onRetour={() => onSelection(null)}
          onVerrouille={charger}
          onOuvrirCompteRendu={onOuvrirCompteRendu}
          onNouvelleConsultation={onNouvelleConsultation}
          onSupprime={() => onSelection(null)}
          cabinet={cabinet}
          appareils={appareils}
        />
      </div>
    );
  }

  const { patients, reglages } = donnees;
  // Filtres : les types de traitement réellement utilisés.
  const filtres = ["Tous", ...new Set(patients.map((p) => p.type).filter(Boolean))];
  const termes = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const aAttribuer = patients.filter((p) => !p.lieu);
  const duLieu = sansLieu ? aAttribuer : patients.filter((p) => dansLieu(lieuActif, p.lieu));
  const visibles = duLieu
    .filter((p) => filtre === "Tous" || p.type === filtre)
    .filter((p) => {
      const texte = sansAccents([p.nom, p.prenom, formaterDate(p.naissance), p.code].join(" "));
      return termes.every((t) => texte.includes(t));
    })
    .sort((a, b) => sansAccents(`${a.nom} ${a.prenom}`).localeCompare(sansAccents(`${b.nom} ${b.prenom}`)));

  return (
    <div className="cr-app">
      {entete}
      {mode === "nouveau" && (
        <NouveauPatient
          reglages={reglages}
          cabinet={cabinet}
          lieuActif={lieuActif}
          onCree={(id) => {
            setMode("liste");
            onSelection(id);
          }}
          onAnnuler={() => setMode("liste")}
        />
      )}
      {mode === "import" && (
        <ImportOrthofast
          cabinet={cabinet}
          lieuActif={lieuActif}
          onAnnuler={() => setMode("liste")}
          onTermine={() => {
            setMode("liste");
            charger();
          }}
        />
      )}
      {mode === "reglages" ? (
        <Reglages reglages={reglages} patients={patients} onChange={(r) => setDonnees({ ...donnees, reglages: r })} />
      ) : (
        <section className="cr-carte">
          <input
            className="cr-recherche-patients"
            type="search"
            placeholder="Rechercher un patient (nom, prénom, date de naissance, code…)"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher un patient"
          />
          {aAttribuer.length > 0 && (
            <p className={sansLieu ? "cr-ok" : "cr-verifier"}>
              {sansLieu ? (
                <>
                  Dossiers sans cabinet : ouvrez chacun pour choisir Le Chesnay ou Herblay (en haut du dossier).{" "}
                  <button type="button" className="cr-lien" onClick={() => setSansLieu(false)}>
                    Revenir à la liste
                  </button>
                </>
              ) : (
                <>
                  {aAttribuer.length} dossier(s) sans cabinet{lieuActif ? " (masqués ici)" : ""}.{" "}
                  <button type="button" className="cr-lien" onClick={() => setSansLieu(true)}>
                    Les afficher pour les rattacher
                  </button>
                </>
              )}
            </p>
          )}
          <div className="cr-filtres">
            {filtres.map((t) => (
              <button
                key={t}
                type="button"
                className={t === filtre ? "cr-filtre actif" : "cr-filtre"}
                onClick={() => setFiltre(t)}
              >
                {t} ({t === "Tous" ? duLieu.length : duLieu.filter((p) => p.type === t).length})
              </button>
            ))}
          </div>
          {visibles.length === 0 ? (
            <p className="cr-aide">
              {patients.length === 0
                ? "Aucun patient pour l'instant. Créez un dossier, ou enregistrez un compte rendu : le dossier est créé automatiquement."
                : "Aucun patient trouvé."}
            </p>
          ) : (
            <ul className="cr-historique">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button type="button" className="cr-fiche cr-ligne-patient" onClick={() => onSelection(p.id)}>
                    <span className="cr-fiche-nom">
                      {p.alerte && (
                        <span className="cr-alerte-icone" title="Alerte dans le dossier">
                          ⚠{" "}
                        </span>
                      )}
                      {[p.nom?.toUpperCase(), p.prenom].filter(Boolean).join(" ")}
                      <small>
                        {p.naissance && ` · ${formaterDate(p.naissance)} · ${age(p.naissance, aujourdhui())}`}
                      </small>
                    </span>
                    <span className="cr-ligne-etiquettes">
                      {!lieuActif && p.lieu && (
                        <span className={`oa-pastille-lieu ${p.lieu}`}>{nomLieu(cabinet, p.lieu)}</span>
                      )}
                      {p.type && <span className="cr-pastille c-type">{p.type}</span>}
                      {p.statut && <span className={classeStatut(reglages, p.statut)}>{p.statut}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
