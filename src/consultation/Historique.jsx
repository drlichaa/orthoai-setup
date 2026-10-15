import { useEffect, useState } from "react";
import { appelHistorique } from "./apiHistorique.js";
import { dansLieu, nomLieu } from "./lieux.js";

// Historique des comptes rendus : chiffré et conservé sur cet ordinateur par
// le serveur local, protégé par un mot de passe propre à cet ordinateur.

function formaterDate(iso) {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

function sansAccents(texte) {
  return (texte || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Création du mot de passe (premier usage) ou déverrouillage.
export function Verrou({ existe, onDeverrouille, onAnnuler }) {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function valider(e) {
    e.preventDefault();
    setErreur("");
    if (!existe && motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setEnvoi(true);
    try {
      await appelHistorique(existe ? "/deverrouiller" : "/creer", { motDePasse });
      setMotDePasse("");
      setConfirmation("");
      onDeverrouille();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="cr-verrou" onSubmit={valider}>
      {existe ? (
        <p className="cr-aide">Saisissez le mot de passe de l'historique de cet ordinateur.</p>
      ) : (
        <p className="cr-aide">
          Choisissez un mot de passe pour protéger l'historique (8 caractères minimum). Les comptes rendus sont chiffrés
          sur cet ordinateur : <strong>sans ce mot de passe, ils ne pourront pas être récupérés</strong>. Notez-le en
          lieu sûr.
        </p>
      )}
      <div className="cr-champs-ligne">
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete={existe ? "current-password" : "new-password"}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoFocus
          />
        </label>
        {!existe && (
          <label>
            Confirmer le mot de passe
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="cr-actions cr-verrou-actions">
        <button type="submit" className="principal" disabled={envoi || !motDePasse}>
          {envoi ? "Vérification…" : existe ? "Déverrouiller" : "Créer l'historique"}
        </button>
        {onAnnuler && (
          <button type="button" className="secondaire" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </div>
      {erreur && <p className="cr-alerte">{erreur}</p>}
    </form>
  );
}

function ChangerMotDePasse() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState({ type: "", message: "" });
  const [envoi, setEnvoi] = useState(false);

  async function valider(e) {
    e.preventDefault();
    if (nouveau !== confirmation) {
      setEtat({ type: "erreur", message: "Les deux nouveaux mots de passe ne sont pas identiques." });
      return;
    }
    setEnvoi(true);
    try {
      await appelHistorique("/mot-de-passe", { ancien, nouveau });
      setAncien("");
      setNouveau("");
      setConfirmation("");
      setEtat({ type: "ok", message: "Mot de passe modifié." });
    } catch (err) {
      setEtat({ type: "erreur", message: err.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={valider}>
      <div className="cr-champs-ligne">
        <label>
          Mot de passe actuel
          <input
            type="password"
            autoComplete="current-password"
            value={ancien}
            onChange={(e) => setAncien(e.target.value)}
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            type="password"
            autoComplete="new-password"
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
          />
        </label>
        <label>
          Confirmer
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
      </div>
      <button type="submit" className="principal" disabled={envoi || !ancien || !nouveau}>
        Changer le mot de passe
      </button>
      {etat.message && <p className={etat.type === "ok" ? "cr-ok" : "cr-alerte"}>{etat.message}</p>}
    </form>
  );
}

// État de l'historique et, s'il est déverrouillé, la liste des comptes rendus.
async function lireHistorique() {
  try {
    const etat = await appelHistorique("/etat");
    return { etat, fiches: etat.deverrouille ? (await appelHistorique("")).fiches : [] };
  } catch (err) {
    if (err.statut === 423) return { etat: { existe: true, deverrouille: false } };
    return { erreur: err.message };
  }
}

export default function Historique({ onOuvrir, onFermer, lieuActif = "", cabinet }) {
  const [etat, setEtat] = useState(null);
  const [fiches, setFiches] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");

  function appliquer(resultat) {
    setErreur(resultat.erreur || "");
    if (resultat.etat) setEtat(resultat.etat);
    setFiches(resultat.fiches || []);
  }

  async function charger() {
    appliquer(await lireHistorique());
  }

  useEffect(() => {
    let actif = true;
    lireHistorique().then((resultat) => actif && appliquer(resultat));
    return () => {
      actif = false;
    };
  }, []);

  async function verrouiller() {
    await appelHistorique("/verrouiller", {}).catch(() => {});
    charger();
  }

  async function supprimer(fiche) {
    const nom = [fiche.patient?.prenom, fiche.patient?.nom].filter(Boolean).join(" ") || "ce patient";
    if (!window.confirm(`Supprimer définitivement le compte rendu de ${nom} du ${formaterDate(fiche.patient?.date)} ?`))
      return;
    try {
      await appelHistorique("/supprimer", { id: fiche.id });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function ouvrir(id) {
    try {
      onOuvrir((await appelHistorique(`/fiche/${id}`)).fiche);
    } catch (err) {
      if (err.statut === 423) charger();
      else setErreur(err.message);
    }
  }

  async function reinitialiser() {
    const saisie = window.prompt(
      "Mot de passe oublié : la seule solution est d'effacer tout l'historique de cet ordinateur, définitivement.\n\nTapez EFFACER pour confirmer.",
    );
    if (saisie !== "EFFACER") return;
    try {
      await appelHistorique("/reinitialiser", { confirmation: "EFFACER" });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  const termes = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const duLieu = fiches.filter((f) => dansLieu(lieuActif, f.lieu));
  const visibles = duLieu.filter((f) => {
    const texte = sansAccents(
      [
        f.patient?.nom,
        f.patient?.prenom,
        formaterDate(f.patient?.date),
        formaterDate(f.patient?.naissance),
        f.motif,
      ].join(" "),
    );
    return termes.every((t) => texte.includes(t));
  });

  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>Historique des comptes rendus</h1>
        <div className="cr-actions">
          {etat?.deverrouille && (
            <button type="button" className="secondaire" onClick={verrouiller}>
              Verrouiller
            </button>
          )}
          {onFermer && (
            <button type="button" className="principal" onClick={onFermer}>
              Retour à la consultation
            </button>
          )}
        </div>
      </header>

      {erreur && <p className="cr-alerte">{erreur}</p>}

      {etat && !etat.deverrouille && (
        <section className="cr-carte">
          <h2>{etat.existe ? "Historique verrouillé" : "Créer l'historique de cet ordinateur"}</h2>
          <Verrou existe={etat.existe} onDeverrouille={charger} />
          {etat.existe && (
            <p className="cr-aide">
              Mot de passe oublié ?{" "}
              <button type="button" className="cr-lien" onClick={reinitialiser}>
                Effacer l'historique et recommencer
              </button>
            </p>
          )}
        </section>
      )}

      {etat?.deverrouille && (
        <>
          <section className="cr-carte">
            <div className="cr-titre-section">
              <h2>
                {duLieu.length} compte{duLieu.length > 1 ? "s" : ""} rendu{duLieu.length > 1 ? "s" : ""}
                {lieuActif && ` · ${nomLieu(cabinet, lieuActif)}`}
              </h2>
              <input
                className="cr-recherche"
                type="search"
                placeholder="Rechercher (nom, prénom, date…)"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                aria-label="Rechercher dans l'historique"
              />
            </div>
            {fiches.length === 0 ? (
              <p className="cr-aide">
                Aucun compte rendu pour l'instant. Ils s'ajoutent avec « Enregistrer dans l'historique », ou
                automatiquement à l'impression.
              </p>
            ) : visibles.length === 0 ? (
              <p className="cr-aide">Aucun résultat.</p>
            ) : (
              <ul className="cr-historique">
                {visibles.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="cr-fiche" onClick={() => ouvrir(f.id)}>
                      <span className="cr-fiche-date">{formaterDate(f.patient?.date)}</span>
                      <span className="cr-fiche-nom">
                        {[f.patient?.nom?.toUpperCase(), f.patient?.prenom].filter(Boolean).join(" ") ||
                          "Patient sans nom"}
                        {f.patient?.naissance && <small> · né(e) le {formaterDate(f.patient.naissance)}</small>}
                      </span>
                      <span className="cr-fiche-motif">{f.motif}</span>
                    </button>
                    <button type="button" className="danger" onClick={() => supprimer(f)} aria-label="Supprimer">
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="cr-aide">
              L'historique est chiffré sur cet ordinateur et se verrouille seul après 30 minutes d'inactivité.
            </p>
          </section>

          <details className="cr-carte cr-details-carte">
            <summary>Changer le mot de passe</summary>
            <ChangerMotDePasse />
          </details>
        </>
      )}
    </div>
  );
}
