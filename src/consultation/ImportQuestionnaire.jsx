// Import du questionnaire médical WeClever (PDF), lu sur cet ordinateur : écran de
// vérification obligatoire (PDF à gauche, champs proposés à droite, « à vérifier » en orange).
// Rien n'est enregistré sans validation ; un champ déjà rempli n'est remplacé que sur demande.
import { useState } from "react";
import { appelApi, envoyerFichier } from "./apiHistorique.js";
import { formaterDate } from "./format.js";
import { lieux } from "./lieux.js";
import { lireQuestionnaire, memePatient, propositions } from "./questionnaireWeclever.js";

const IDENTITE = [
  ["nom", "Nom"],
  ["prenom", "Prénom"],
  ["naissance", "Date de naissance"],
  ["sexe", "Sexe"],
  ["portable", "Portable"],
  ["telephone", "Téléphone"],
  ["email", "E-mail"],
  ["envoyePar", "Adressé par / prise de RDV"],
];
const ADMINISTRATIF = [
  ["numeroSecu", "N° de sécurité sociale"],
  ["adresse", "Adresse"],
  ["mutuelle", "Mutuelle"],
  ["professionParents", "Profession des parents"],
  ["profession", "Profession"],
];
const ACCORDS = [
  ["radiographies", "Radiographies"],
  ["enregistrement", "Enregistrement de la consultation"],
  ["departSeul", "Départ seul après les soins"],
];
const ENGAGEMENTS = [
  ["certifie", "Informations sincères, exactes et complètes"],
  ["donnees", "Accord d'utilisation des données"],
  ["informe", "Informé(e) de signaler toute modification de santé"],
  ["representant", "Rempli par un représentant"],
];

const liste = (v) => (Array.isArray(v) ? v.join(" ; ") : v || "");
const versListe = (t) =>
  String(t || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);

export default function ImportQuestionnaire({ cabinet, lieuActif = "", patientId = null, onFermer, onTermine }) {
  const [etape, setEtape] = useState({ enCours: false, erreur: "" });
  const [fichier, setFichier] = useState(null);
  const [pages, setPages] = useState([]);
  const [prop, setProp] = useState(null);
  const [cible, setCible] = useState(null);
  const [mode, setMode] = useState("creer");
  const [remplacer, setRemplacer] = useState({});
  const [lieu, setLieu] = useState(lieuActif || "");

  async function lire(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setEtape({ enCours: true, erreur: "" });
    try {
      const lu = await lireQuestionnaire(await f.arrayBuffer());
      const p = propositions(lu);
      if (!p.identite.nom && !p.identite.prenom)
        throw new Error("Ce PDF ne ressemble pas à un questionnaire médical WeClever (nom et prénom introuvables).");
      let dossier = null;
      if (patientId) dossier = (await appelApi(`/patients/dossier/${patientId}`)).patient;
      else {
        const { patients } = await appelApi("/patients");
        const trouve = patients.find((x) => memePatient(x, p.identite));
        if (trouve) dossier = (await appelApi(`/patients/dossier/${trouve.id}`)).patient;
      }
      setFichier(f);
      setPages(lu.pages);
      setProp(p);
      setCible(dossier);
      setMode(dossier ? "completer" : "creer");
      setRemplacer({});
      setEtape({ enCours: false, erreur: "" });
    } catch (err) {
      setEtape({ enCours: false, erreur: err.message });
    }
  }

  const majProp = (partie, modif) => setProp((p) => ({ ...p, [partie]: { ...p[partie], ...modif } }));
  const majQ = (modif) => majProp("questionnaire", modif);
  const orange = (cle) => (prop?.aVerifier?.[cle] ? "oa-a-verifier" : undefined);
  const completer = mode === "completer" && cible;

  // Valeur finale d'un champ : remplie si vide, remplacée seulement si demandé.
  const valeurFinale = (cle, nouvelle, actuelle) =>
    !nouvelle ? actuelle : !actuelle || remplacer[cle] ? nouvelle : actuelle;

  async function valider() {
    setEtape({ enCours: true, erreur: "" });
    try {
      const id = completer
        ? cible.id
        : (
            await appelApi("/patients/enregistrer", {
              patient: {
                nom: prop.identite.nom,
                prenom: prop.identite.prenom,
                naissance: prop.identite.naissance,
                lieu,
              },
            })
          ).patient.id;
      const pdf = await envoyerFichier(
        id,
        new File([fichier], fichier.name || "questionnaire-medical.pdf", { type: "application/pdf" }),
      );
      // Relecture du dossier (photos, PDF ajouté) avant d'y fusionner les réponses.
      const actuel = (await appelApi(`/patients/dossier/${id}`)).patient;
      const g = actuel.gestion || {};
      const suivant = { ...actuel };
      for (const [cle] of IDENTITE) suivant[cle] = valeurFinale(cle, prop.identite[cle], actuel[cle]);
      const administratif = {};
      for (const [cle] of ADMINISTRATIF)
        if (prop.administratif[cle] !== undefined)
          administratif[cle] = valeurFinale(cle, prop.administratif[cle], g[cle]);
      suivant.gestion = { ...g, ...administratif };
      if (prop.alerte.trim() && !(actuel.alerte || "").includes(prop.alerte.trim()))
        suivant.alerte = [actuel.alerte, prop.alerte.trim()].filter(Boolean).join(" · ");
      const precedents = actuel.questionnaire?.importeLe
        ? [
            { importeLe: actuel.questionnaire.importeLe, pdf: actuel.questionnaire.pdf },
            ...(actuel.questionnaire.precedents || []),
          ].slice(0, 5)
        : [];
      suivant.questionnaire = { ...prop.questionnaire, pdf: pdf.id, importeLe: new Date().toISOString(), precedents };
      await appelApi("/patients/enregistrer", { patient: suivant });
      onTermine(id);
    } catch (err) {
      setEtape({ enCours: false, erreur: err.message });
    }
  }

  const ligne = (partie, cle, libelle, actuelle) => {
    const valeur = prop[partie][cle] ?? "";
    const different = actuelle && valeur && String(actuelle) !== String(valeur);
    return (
      <tr key={cle} className={cle === "sexe" ? orange("sexe") : undefined}>
        <th>{libelle}</th>
        <td>
          {cle === "sexe" ? (
            <select value={valeur} onChange={(e) => majProp(partie, { sexe: e.target.value })}>
              <option value="">—</option>
              <option value="F">Féminin</option>
              <option value="M">Masculin</option>
            </select>
          ) : cle === "adresse" ? (
            <textarea rows={3} value={valeur} onChange={(e) => majProp(partie, { [cle]: e.target.value })} />
          ) : (
            <input
              type={cle === "naissance" ? "date" : "text"}
              value={valeur}
              onChange={(e) => majProp(partie, { [cle]: e.target.value })}
            />
          )}
          {completer && different && (
            <label className="cr-case oa-q-remplacer">
              <input
                type="checkbox"
                checked={Boolean(remplacer[cle])}
                onChange={(e) => setRemplacer({ ...remplacer, [cle]: e.target.checked })}
              />{" "}
              Remplacer « {String(actuelle).replace(/\n/g, ", ")} »
            </label>
          )}
          {completer && actuelle && !different && valeur && <small className="cr-aide"> identique au dossier</small>}
        </td>
      </tr>
    );
  };
  const choix = (cle, libelle, options) => (
    <tr className={orange(cle)}>
      <th>{libelle}</th>
      <td>
        <select value={prop.questionnaire[cle] || ""} onChange={(e) => majQ({ [cle]: e.target.value })}>
          <option value="">—</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </td>
    </tr>
  );
  const texte = (cle, libelle, estListe = false) => (
    <tr className={orange(cle)}>
      <th>{libelle}</th>
      <td>
        <input
          value={estListe ? liste(prop.questionnaire[cle]) : prop.questionnaire[cle] || ""}
          onChange={(e) => majQ({ [cle]: estListe ? versListe(e.target.value) : e.target.value })}
        />
      </td>
    </tr>
  );

  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="Questionnaire médical WeClever">
      <section className="cr-carte oa-modale oa-questionnaire">
        <div className="cr-titre-section">
          <h2>Questionnaire médical WeClever</h2>
          <button type="button" className="cr-lien" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        {!prop && (
          <>
            <p className="cr-aide">
              Choisissez le PDF exporté de WeClever. Il est lu sur cet ordinateur (aucun envoi en ligne), puis vous
              vérifiez les réponses avant tout enregistrement. Le PDF est ensuite rangé, chiffré, dans le dossier du
              patient.
            </p>
            <label className="cr-bouton-fichier">
              {etape.enCours ? "Lecture du PDF…" : "Choisir le PDF du questionnaire"}
              <input type="file" accept="application/pdf,.pdf" onChange={lire} disabled={etape.enCours} />
            </label>
          </>
        )}
        {prop && (
          <div className="oa-q-grille">
            <div className="oa-q-pdf" aria-label="PDF importé">
              {pages.map((src, i) => (
                <img key={i} src={src} alt={`Page ${i + 1}`} />
              ))}
            </div>
            <div className="oa-q-champs">
              <p>
                Questionnaire <b>{prop.type}</b>
                {prop.questionnaire.signature && <> · signé le {prop.questionnaire.signature}</>}. Les champs en{" "}
                <span className="oa-a-verifier oa-q-legende">orange</span> sont à vérifier sur le PDF.
              </p>
              <fieldset className="oa-q-cible">
                <legend>Dossier</legend>
                {cible && (
                  <label className="cr-case">
                    <input type="radio" checked={mode === "completer"} onChange={() => setMode("completer")} />{" "}
                    Compléter le dossier de{" "}
                    <b>
                      {cible.prenom} {cible.nom}
                    </b>
                    {cible.naissance && <> (né(e) le {formaterDate(cible.naissance)})</>}
                  </label>
                )}
                {!patientId && (
                  <label className="cr-case">
                    <input type="radio" checked={mode === "creer"} onChange={() => setMode("creer")} /> Créer un nouveau
                    dossier{" "}
                    {mode === "creer" && (
                      <select
                        value={lieu}
                        onChange={(e) => setLieu(e.target.value)}
                        className={lieu ? undefined : "oa-a-choisir"}
                      >
                        <option value="">Cabinet à choisir…</option>
                        {lieux(cabinet).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nom}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                )}
                {patientId && cible && !memePatient(cible, prop.identite) && (
                  <p className="cr-alerte">
                    Attention : le nom, le prénom ou la date de naissance du questionnaire diffèrent de ce dossier.
                  </p>
                )}
              </fieldset>

              <h3>Identité et contacts</h3>
              <table className="oa-table oa-q-table">
                <tbody>
                  {IDENTITE.filter(([cle]) => prop.identite[cle] !== undefined).map(([cle, libelle]) =>
                    ligne("identite", cle, libelle, completer ? cible[cle] : ""),
                  )}
                </tbody>
              </table>
              <h3>Administratif (DEP, devis)</h3>
              <table className="oa-table oa-q-table">
                <tbody>
                  {ADMINISTRATIF.filter(([cle]) => prop.administratif[cle] !== undefined).map(([cle, libelle]) =>
                    ligne("administratif", cle, libelle, completer ? cible.gestion?.[cle] : ""),
                  )}
                </tbody>
              </table>

              <h3>Consultation et antécédents</h3>
              <table className="oa-table oa-q-table">
                <tbody>
                  {texte("motifs", "Motif(s) de la visite", true)}
                  {texte("priseRdv", "Prise de RDV", true)}
                  {texte("derniereVisiteDentiste", "Dernière consultation chez le dentiste")}
                  {texte("poids", "Poids (kg)")}
                  {texte("taille", "Taille (cm)")}
                  {texte("sante", "Problème de santé général")}
                  {texte("medicaments", "Médicaments quotidiens")}
                  {texte("allergie", "Allergie reconnue")}
                  {choix("deglutition", "Déglutition : mal à avaler sa salive", ["Oui", "Non"])}
                  {choix("elocution", "Élocution / dyslexie", ["Oui", "Non"])}
                  {choix("succion", "Succion", ["Pouce", "Doigt", "Tétine", "Aucun"])}
                  {texte("orl", "ORL", true)}
                  {(prop.questionnaire.autres || []).map((a, i) => (
                    <tr key={a.question} className={a.aVerifier ? "oa-a-verifier" : undefined}>
                      <th>{a.question}</th>
                      <td>
                        <input
                          value={a.reponse}
                          onChange={(e) =>
                            majQ({
                              autres: prop.questionnaire.autres.map((x, j) =>
                                j === i ? { ...x, reponse: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Accords et engagements</h3>
              <table className="oa-table oa-q-table">
                <tbody>
                  {ACCORDS.filter(([cle]) => prop.questionnaire.accords[cle] !== undefined).map(([cle, libelle]) => (
                    <tr key={cle} className={orange(cle)}>
                      <th>
                        {libelle}
                        {cle === "radiographies" && prop.questionnaire.accords.radiographiesHonoraires && (
                          <small className="cr-aide"> ({prop.questionnaire.accords.radiographiesHonoraires})</small>
                        )}
                      </th>
                      <td>
                        <select
                          value={prop.questionnaire.accords[cle] || ""}
                          onChange={(e) => majQ({ accords: { ...prop.questionnaire.accords, [cle]: e.target.value } })}
                        >
                          <option value="">—</option>
                          <option value="accepte">Accepte</option>
                          <option value="refuse">Refuse</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {ENGAGEMENTS.map(([cle, libelle]) => (
                    <tr key={cle} className={orange("engagements")}>
                      <th>{libelle}</th>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(prop.questionnaire.engagements[cle])}
                          onChange={(e) =>
                            majQ({ engagements: { ...prop.questionnaire.engagements, [cle]: e.target.checked } })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th>Date de signature</th>
                    <td>
                      <input
                        value={prop.questionnaire.signature}
                        onChange={(e) => majQ({ signature: e.target.value })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>Alerte du dossier</h3>
              <textarea
                className="oa-q-alerte"
                rows={2}
                value={prop.alerte}
                placeholder="Aucune allergie, aucun médicament ni problème de santé signalé"
                onChange={(e) => setProp({ ...prop, alerte: e.target.value })}
              />
              {completer && cible.alerte && <p className="cr-aide">Ajoutée à l'alerte actuelle : « {cible.alerte} »</p>}
              {completer && cible.questionnaire?.importeLe && (
                <p className="cr-aide">
                  Remplace le questionnaire importé le {formaterDate(cible.questionnaire.importeLe.slice(0, 10))} (son
                  PDF reste dans le dossier).
                </p>
              )}
            </div>
          </div>
        )}
        {etape.erreur && <p className="cr-alerte">{etape.erreur}</p>}
        <div className="cr-actions">
          {prop && (
            <button
              type="button"
              className="principal"
              disabled={etape.enCours || (mode === "creer" && !lieu)}
              onClick={valider}
            >
              {etape.enCours
                ? "Enregistrement…"
                : completer
                  ? "Valider et compléter le dossier"
                  : lieu
                    ? "Valider et créer le dossier"
                    : "Choisissez le cabinet"}
            </button>
          )}
          <button type="button" className="secondaire" onClick={onFermer} disabled={etape.enCours}>
            Annuler
          </button>
        </div>
      </section>
    </div>
  );
}
