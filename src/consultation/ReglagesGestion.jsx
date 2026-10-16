// Paramètres → Honoraires (barème des devis) et Automatisations (tâches).
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { lieux } from "./lieux.js";
import { CHAMPS_MODELES } from "./messagerie.js";
import { MOTIFS_PAR_DEFAUT, reglagesPlanning } from "./planning.js";
import { AUTOMATISATIONS, BAREME_PAR_DEFAUT, automatisations, bareme, identifiantUnique } from "./gestion.js";

const PRIX_SEMESTRE = [
  ["interception", "Semestre d'interception"],
  ["metal", "Semestre bagues métalliques"],
  ["ceramique", "Semestre bagues céramique"],
  ["aligneurs", "Semestre aligneurs"],
];

const ACTES_SECU = [
  ["to5", "Bilan (TO5)"],
  ["to15", "Bilan (TO15)"],
  ["semestre", "Semestre ODF"],
  ["contention", "Contention (année)"],
  ["surveillance", "Surveillance"],
];

export default function ReglagesGestion({ cabinet, onCabinetChange }) {
  const b = bareme(cabinet);
  const majBareme = (modif) => onCabinetChange({ ...cabinet, bareme: { ...b, ...modif } });
  const nombre = (valeur, onChange) => (
    <input type="number" min="0" step="0.01" value={valeur} onChange={(e) => onChange(Number(e.target.value) || 0)} />
  );
  const actives = automatisations(cabinet);
  return (
    <>
      <section className="cr-carte">
        <div className="cr-titre-section">
          <h2>Honoraires (devis)</h2>
          <button
            type="button"
            className="secondaire"
            onClick={() =>
              window.confirm("Revenir au barème par défaut ?") &&
              onCabinetChange({ ...cabinet, bareme: BAREME_PAR_DEFAUT })
            }
          >
            Réinitialiser
          </button>
        </div>
        <div className="cr-champs-ligne">
          {PRIX_SEMESTRE.map(([cle, libelle]) => (
            <label key={cle}>
              {libelle} (€)
              {nombre(b.semestre[cle], (v) => majBareme({ semestre: { ...b.semestre, [cle]: v } }))}
            </label>
          ))}
        </div>
        <div className="cr-champs-ligne">
          <label>
            Année de contention (€)
            {nombre(b.contention, (v) => majBareme({ contention: v }))}
          </label>
          {[
            ["standard", "Bilan interception / bagues"],
            ["aligneurs", "Bilan gouttières"],
          ].map(([cle, libelle]) =>
            ["to5", "to15"].map((acte) => (
              <label key={cle + acte}>
                {libelle} — {acte.toUpperCase()} (€)
                {nombre(b.bilan[cle][acte], (v) =>
                  majBareme({ bilan: { ...b.bilan, [cle]: { ...b.bilan[cle], [acte]: v } } }),
                )}
              </label>
            )),
          )}
          <label>
            Surveillance (€)
            {nombre(b.surveillance, (v) => majBareme({ surveillance: v }))}
          </label>
          <label>
            Âge à partir duquel le devis est HN
            {nombre(b.ageHorsNomenclature, (v) => majBareme({ ageHorsNomenclature: v }))}
          </label>
          <label>
            Validité du devis (mois)
            {nombre(b.validiteMois, (v) => majBareme({ validiteMois: v }))}
          </label>
        </div>
        <h3>Prise en charge Assurance maladie</h3>
        <table className="oa-table">
          <thead>
            <tr>
              <th>Acte</th>
              <th>Cotation</th>
              <th>Base de remboursement</th>
              <th>Montant remboursé</th>
            </tr>
          </thead>
          <tbody>
            {ACTES_SECU.map(([cle, libelle]) => {
              const maj = (champ, v) => majBareme({ secu: { ...b.secu, [cle]: { ...b.secu[cle], [champ]: v } } });
              return (
                <tr key={cle}>
                  <td>{libelle}</td>
                  <td>
                    <input
                      className="oa-court"
                      value={b.secu[cle].code}
                      onChange={(e) => maj("code", e.target.value)}
                    />
                  </td>
                  <td>{nombre(b.secu[cle].base, (v) => maj("base", v))}</td>
                  <td>{nombre(b.secu[cle].rembourse, (v) => maj("rembourse", v))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="cr-carte">
        <h2>Automatisations</h2>
        <p className="cr-aide">
          Échéances affichées dans Tâches et dans les alertes du tableau de bord, calculées à partir des dossiers.
        </p>
        {AUTOMATISATIONS.map(([cle, libelle, aide]) => (
          <label key={cle} className="oa-reglage-auto">
            <input
              type="checkbox"
              checked={actives[cle]}
              onChange={(e) =>
                onCabinetChange({ ...cabinet, automatisations: { ...actives, [cle]: e.target.checked } })
              }
            />
            <span>
              <strong>{libelle}</strong>
              <small>{aide}</small>
            </span>
          </label>
        ))}
      </section>
    </>
  );
}

// Paramètres → Cabinets : nom et en-tête propres au Chesnay et à Herblay.
export function ReglagesLieux({ cabinet, onCabinetChange }) {
  const liste = lieux(cabinet);
  const maj = (id, modif) =>
    onCabinetChange({ ...cabinet, lieux: liste.map((l) => (l.id === id ? { ...l, ...modif } : l)) });
  return (
    <section className="cr-carte">
      <h2>Cabinets</h2>
      <p className="cr-aide">
        Chaque patient est rattaché à un cabinet. Son adresse et son téléphone remplacent ceux de l'en-tête sur les
        courriers, comptes rendus, devis et DEP du patient (laisser vide pour garder l'en-tête général).
      </p>
      {liste.map((l) => (
        <div key={l.id} className="cr-appareil-edition">
          <div className="cr-champs-ligne">
            <label>
              Nom
              <input value={l.nom} onChange={(e) => maj(l.id, { nom: e.target.value })} />
            </label>
            <label>
              Nom court (menu)
              <input value={l.court} onChange={(e) => maj(l.id, { court: e.target.value })} />
            </label>
            <label>
              Téléphone
              <input value={l.telephone || ""} onChange={(e) => maj(l.id, { telephone: e.target.value })} />
            </label>
          </div>
          <label className="cr-bloc">
            Adresse (en-tête des documents)
            <textarea
              rows={2}
              value={l.coordonnees || ""}
              onChange={(e) => maj(l.id, { coordonnees: e.target.value })}
            />
          </label>
        </div>
      ))}
    </section>
  );
}

const CATEGORIES = ["Devis", "Compte rendu", "Facturation", "Rendez-vous", "Courrier", "Autre"];

// Paramètres → Messagerie : compte Gmail du cabinet (réglages rangés dans le coffre chiffré),
// signature, liens de prise de RDV et modèles d'objet / de message.
export function ReglagesMessagerie({ cabinet }) {
  const [m, setM] = useState(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [etat, setEtat] = useState({ enCours: false, erreur: "", ok: "", verrouille: false });

  async function charger() {
    try {
      const { messagerie } = await appelApi("/patients/messagerie");
      setM({ ...messagerie, adresse: messagerie.adresse || "orthochesnay@gmail.com" });
      setEtat((e) => ({ ...e, verrouille: false }));
    } catch (err) {
      setEtat((e) => ({
        ...e,
        verrouille: err.statut === 423 || err.statut === 404,
        erreur: err.statut === 423 || err.statut === 404 ? "" : err.message,
      }));
    }
  }
  useEffect(() => {
    charger();
  }, []);

  async function enregistrer() {
    setEtat({ ...etat, enCours: true, erreur: "", ok: "" });
    try {
      const { messagerie } = await appelApi("/patients/messagerie", { messagerie: { ...m, motDePasse } });
      setM(messagerie);
      setMotDePasse("");
      setEtat({
        ...etat,
        enCours: false,
        erreur: "",
        ok: motDePasse ? "Connexion à Gmail réussie, réglages enregistrés." : "Réglages enregistrés.",
      });
    } catch (err) {
      setEtat({ ...etat, enCours: false, erreur: err.message, ok: "" });
    }
  }
  const majModele = (i, modif) => setM({ ...m, modeles: m.modeles.map((x, j) => (j === i ? { ...x, ...modif } : x)) });

  return (
    <section className="cr-carte">
      <h2>Messagerie (Gmail)</h2>
      {etat.verrouille && (
        <p className="cr-aide">
          Déverrouillez les dossiers patients (page Patients) pour régler la messagerie : ses réglages sont rangés dans
          le coffre chiffré.{" "}
          <button type="button" className="cr-lien" onClick={charger}>
            Réessayer
          </button>
        </p>
      )}
      {m && (
        <>
          <details className="cr-aide">
            <summary>Comment obtenir le mot de passe d'application Gmail ?</summary>
            <ol>
              <li>Connectez-vous au compte Gmail du cabinet, puis ouvrez myaccount.google.com → Sécurité.</li>
              <li>Activez la « Validation en deux étapes » si ce n'est pas déjà fait.</li>
              <li>Cherchez « Mots de passe des applications », créez-en un nommé « OrthoAI ».</li>
              <li>
                Copiez les 16 lettres affichées et collez-les ci-dessous (ce n'est pas le mot de passe habituel du
                compte).
              </li>
            </ol>
            Il est conservé chiffré sur le serveur du cabinet et n'est jamais réaffiché. Ne le communiquez à personne.
          </details>
          <div className="cr-champs-ligne">
            <label>
              Adresse Gmail
              <input type="email" value={m.adresse} onChange={(e) => setM({ ...m, adresse: e.target.value })} />
            </label>
            <label>
              Nom affiché
              <input
                value={m.nom}
                placeholder={cabinet.praticien || "Cabinet d'orthodontie"}
                onChange={(e) => setM({ ...m, nom: e.target.value })}
              />
            </label>
            <label>
              Mot de passe d'application
              <input
                type="password"
                autoComplete="new-password"
                value={motDePasse}
                placeholder={m.motDePasseEnregistre ? "Enregistré (laisser vide pour le garder)" : "16 lettres"}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
            </label>
          </div>
          <label className="cr-bloc">
            Signature (ajoutée à la fin de chaque message)
            <textarea rows={4} value={m.signature} onChange={(e) => setM({ ...m, signature: e.target.value })} />
          </label>
          <div className="cr-champs-ligne">
            {lieux(cabinet).map((l) => (
              <label key={l.id}>
                Lien de prise de RDV — {l.court || l.nom}
                <input
                  value={m.liensRdv?.[l.id] || ""}
                  placeholder="https://www.doctolib.fr/…"
                  onChange={(e) => setM({ ...m, liensRdv: { ...m.liensRdv, [l.id]: e.target.value } })}
                />
              </label>
            ))}
          </div>

          <div className="cr-titre-section">
            <h3>Modèles de messages</h3>
            <button
              type="button"
              className="secondaire"
              onClick={() =>
                setM({
                  ...m,
                  modeles: [
                    ...m.modeles,
                    {
                      id: `modele-${Date.now()}`,
                      categorie: "Autre",
                      nom: "Nouveau modèle",
                      objet: "",
                      corps: "Bonjour,\n\n",
                    },
                  ],
                })
              }
            >
              + Modèle
            </button>
          </div>
          <p className="cr-aide">
            Champs remplacés à l'envoi : {CHAMPS_MODELES.map(([c, l]) => `${c} (${l.toLowerCase()})`).join(", ")}.
          </p>
          <div className="oa-modeles">
            {m.modeles.map((modele, i) => (
              <details key={modele.id} className="oa-modele">
                <summary>
                  <b>{modele.categorie}</b> · {modele.nom || "Sans nom"}
                </summary>
                <div className="cr-champs-ligne">
                  <label>
                    Catégorie
                    <select value={modele.categorie} onChange={(e) => majModele(i, { categorie: e.target.value })}>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nom
                    <input value={modele.nom} onChange={(e) => majModele(i, { nom: e.target.value })} />
                  </label>
                </div>
                <label className="cr-bloc">
                  Objet
                  <input value={modele.objet} onChange={(e) => majModele(i, { objet: e.target.value })} />
                </label>
                <label className="cr-bloc">
                  Message
                  <textarea rows={8} value={modele.corps} onChange={(e) => majModele(i, { corps: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="cr-lien"
                  onClick={() =>
                    window.confirm(`Supprimer le modèle « ${modele.nom} » ?`) &&
                    setM({ ...m, modeles: m.modeles.filter((_, j) => j !== i) })
                  }
                >
                  Supprimer ce modèle
                </button>
              </details>
            ))}
          </div>
          {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
          {etat.ok && <p className="cr-ok">{etat.ok}</p>}
          <div className="cr-actions">
            <button type="button" className="principal" disabled={etat.enCours} onClick={enregistrer}>
              {etat.enCours ? (motDePasse ? "Connexion à Gmail…" : "Enregistrement…") : "Enregistrer la messagerie"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// Paramètres → Planning : motifs de rendez-vous (couleurs et durées de Doctolib par défaut).
export function ReglagesPlanning({ cabinet, onCabinetChange }) {
  const { motifs, plages } = reglagesPlanning(cabinet);
  const maj = (liste) =>
    onCabinetChange({ ...cabinet, planning: { ...(cabinet.planning || {}), motifs: liste, plages } });
  const majMotif = (i, modif) => maj(motifs.map((m, j) => (j === i ? { ...m, ...modif } : m)));
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Planning : motifs de rendez-vous</h2>
        <div className="cr-actions">
          <button
            type="button"
            className="secondaire"
            onClick={() =>
              maj([
                ...motifs,
                {
                  id: `motif-${identifiantUnique()}`,
                  nom: "Nouveau motif",
                  duree: 15,
                  couleur: "#94a3b8",
                  fauteuil: 1,
                  lien: "",
                },
              ])
            }
          >
            + Motif
          </button>
          <button
            type="button"
            className="secondaire"
            onClick={() => window.confirm("Revenir aux motifs et couleurs de Doctolib ?") && maj(MOTIFS_PAR_DEFAUT)}
          >
            Réinitialiser
          </button>
        </div>
      </div>
      <table className="oa-table oa-motifs-table">
        <thead>
          <tr>
            <th>Couleur</th>
            <th>Motif</th>
            <th>Durée</th>
            <th>Fauteuil</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {motifs.map((m, i) => (
            <tr key={m.id}>
              <td>
                <input type="color" value={m.couleur} onChange={(e) => majMotif(i, { couleur: e.target.value })} />
              </td>
              <td>
                <input value={m.nom} onChange={(e) => majMotif(i, { nom: e.target.value })} />
              </td>
              <td>
                <input
                  type="number"
                  min="5"
                  step="5"
                  className="oa-court"
                  value={m.duree}
                  onChange={(e) => majMotif(i, { duree: Math.max(5, Number(e.target.value) || 5) })}
                />{" "}
                min
              </td>
              <td>
                <select value={m.fauteuil} onChange={(e) => majMotif(i, { fauteuil: Number(e.target.value) })}>
                  <option value={1}>1 · ortho</option>
                  <option value={2}>2 · blanc</option>
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className="cr-lien"
                  onClick={() => window.confirm(`Supprimer « ${m.nom} » ?`) && maj(motifs.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
