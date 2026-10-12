import { useCallback, useEffect, useState } from "react";
import APPAREILS_PAR_DEFAUT from "./appareilsParDefaut.js";
import useEnregistrement, { enregistrementDisponible } from "./useEnregistrement.js";
import CompteRendu from "./CompteRendu.jsx";
import CatalogueAppareils from "./CatalogueAppareils.jsx";

const CLE_APPAREILS = "cr-ortho:appareils";
const CLE_CABINET = "cr-ortho:cabinet";
const CABINET_VIDE = { praticien: "", cabinet: "", coordonnees: "", telephone: "", email: "" };

const CHAMPS_DIAGNOSTIC = [
  ["formule_dentaire", "Formule dentaire"],
  ["sens_transversal", "Sens transversal"],
  ["sens_vertical", "Sens vertical"],
  ["sens_antero_posterieur", "Sens antéro-postérieur (classe d'Angle)"],
  ["malpositions", "Malpositions importantes"],
  ["classe_squelettique", "Classe squelettique"],
  ["panoramique", "Radiographie panoramique"],
];

const RAPPORT_VIDE = {
  motif: "",
  diagnostic: {
    formule_dentaire: "",
    sens_transversal: "",
    sens_vertical: "",
    sens_antero_posterieur: "",
    malpositions: "",
    encombrement: "",
    encombrement_precision: "",
    classe_squelettique: "",
    panoramique: "",
  },
  plan_traitement: { resume: "", appareils: [], appareils_hors_catalogue: [], duree_estimee: "" },
  points_a_verifier: [],
};

function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch {
    return defaut;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // stockage indisponible : les réglages ne seront simplement pas conservés
  }
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function formaterDuree(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Remplace le nom et le prénom du patient avant l'envoi au serveur.
function pseudonymiser(texte, patient) {
  let resultat = texte;
  for (const mot of [patient.nom, patient.prenom]) {
    const m = mot.trim();
    if (m.length < 2) continue;
    const echappe = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    resultat = resultat.replace(new RegExp(`(?<!\\p{L})${echappe}(?!\\p{L})`, "giu"), "[patient]");
  }
  return resultat;
}

function EtatServeur({ sante }) {
  if (!sante) return null;
  if (sante.horsLigne) {
    return <p className="cr-alerte">Serveur local injoignable : lancez l'application avec Demarrer (.cmd sur Windows, .command sur Mac).</p>;
  }
  const messages = [];
  const etat = sante.whisper?.etat;
  if (etat === "absent") messages.push("Whisper n'est pas installé : lancez installer-whisper (.cmd sur Windows, .command sur Mac) puis relancez.");
  if (etat === "demarrage") messages.push("Chargement du modèle de transcription…");
  if (etat === "erreur") messages.push(sante.whisper.erreur || "Whisper est indisponible.");
  if (!sante.cle) messages.push("Clé API absente : renseignez ANTHROPIC_API_KEY dans le fichier .env.");
  if (messages.length === 0) return <p className="cr-ok">Transcription locale prête — l'audio ne quitte pas cet ordinateur.</p>;
  return messages.map((m) => (
    <p key={m} className="cr-alerte">
      {m}
    </p>
  ));
}

export default function ConsultationApp() {
  const [appareils, setAppareils] = useState(() => lireStockage(CLE_APPAREILS, APPAREILS_PAR_DEFAUT));
  const [cabinet, setCabinet] = useState(() => ({ ...CABINET_VIDE, ...lireStockage(CLE_CABINET, {}) }));
  const [patient, setPatient] = useState({ nom: "", prenom: "", naissance: "", date: aujourdhui() });
  const [transcription, setTranscription] = useState("");
  const [notes, setNotes] = useState("");
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreurApi, setErreurApi] = useState("");
  const [vue, setVue] = useState("consultation");
  const [secondes, setSecondes] = useState(0);

  useEffect(() => ecrireStockage(CLE_APPAREILS, appareils), [appareils]);
  useEffect(() => ecrireStockage(CLE_CABINET, cabinet), [cabinet]);

  const ajouterTexte = useCallback((texte) => {
    if (!texte) return;
    setTranscription((t) => (t ? `${t} ${texte}` : texte));
  }, []);
  const micro = useEnregistrement({ onTexte: ajouterTexte });
  const [whisper, setWhisper] = useState(null);

  useEffect(() => {
    if (!micro.enCours) return undefined;
    const id = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [micro.enCours]);

  // État du serveur local (Whisper prêt ? clé API configurée ?)
  useEffect(() => {
    let actif = true;
    let minuteur;
    async function verifier() {
      try {
        const rep = await fetch("/api/health");
        const donnees = await rep.json();
        if (!actif) return;
        setWhisper(donnees);
        if (donnees.whisper?.etat === "demarrage") minuteur = setTimeout(verifier, 2000);
      } catch {
        if (actif) setWhisper({ horsLigne: true });
      }
    }
    verifier();
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, []);

  async function genererCompteRendu() {
    setChargement(true);
    setErreurApi("");
    try {
      const reponse = await fetch("/api/compte-rendu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: pseudonymiser(transcription, patient),
          notes: pseudonymiser(notes, patient),
          appareils: appareils.map(({ id, nom, indication }) => ({ id, nom, indication })),
        }),
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(donnees.error || `Erreur ${reponse.status}`);
      setRapport({
        ...RAPPORT_VIDE,
        ...donnees.report,
        diagnostic: { ...RAPPORT_VIDE.diagnostic, ...donnees.report.diagnostic },
        plan_traitement: { ...RAPPORT_VIDE.plan_traitement, ...donnees.report.plan_traitement },
      });
    } catch (err) {
      setErreurApi(err.message);
    } finally {
      setChargement(false);
    }
  }

  function nouvelleConsultation() {
    if (!window.confirm("Effacer la consultation en cours ?")) return;
    micro.arreter();
    micro.oublierEchecs();
    setPatient({ nom: "", prenom: "", naissance: "", date: aujourdhui() });
    setTranscription("");
    setNotes("");
    setRapport(null);
    setSecondes(0);
    setErreurApi("");
  }

  const majDiagnostic = (cle, valeur) =>
    setRapport((r) => ({ ...r, diagnostic: { ...r.diagnostic, [cle]: valeur } }));
  const majPlan = (cle, valeur) =>
    setRapport((r) => ({ ...r, plan_traitement: { ...r.plan_traitement, [cle]: valeur } }));
  const basculerAppareil = (id) =>
    setRapport((r) => {
      const actuels = r.plan_traitement.appareils;
      const suivants = actuels.includes(id) ? actuels.filter((a) => a !== id) : [...actuels, id];
      return { ...r, plan_traitement: { ...r.plan_traitement, appareils: suivants } };
    });

  if (vue === "catalogue") {
    return (
      <CatalogueAppareils
        appareils={appareils}
        onChange={setAppareils}
        onReinitialiser={() => setAppareils(APPAREILS_PAR_DEFAUT)}
        cabinet={cabinet}
        onCabinetChange={setCabinet}
        onFermer={() => setVue("consultation")}
      />
    );
  }

  return (
    <div className="cr-app">
      <header className="cr-entete no-print">
        <h1>Compte rendu · 1<sup>re</sup> consultation</h1>
        <div className="cr-actions">
          <button type="button" className="secondaire" onClick={() => setVue("catalogue")}>
            Appareils &amp; cabinet
          </button>
          <button type="button" className="secondaire" onClick={nouvelleConsultation}>
            Nouvelle consultation
          </button>
        </div>
      </header>

      <main className="cr-grille no-print">
        <section className="cr-carte">
          <h2>Patient</h2>
          <div className="cr-champs-ligne">
            <label>
              Nom
              <input value={patient.nom} onChange={(e) => setPatient({ ...patient, nom: e.target.value })} />
            </label>
            <label>
              Prénom
              <input value={patient.prenom} onChange={(e) => setPatient({ ...patient, prenom: e.target.value })} />
            </label>
            <label>
              Date de naissance
              <input
                type="date"
                value={patient.naissance}
                onChange={(e) => setPatient({ ...patient, naissance: e.target.value })}
              />
            </label>
            <label>
              Date de consultation
              <input type="date" value={patient.date} onChange={(e) => setPatient({ ...patient, date: e.target.value })} />
            </label>
          </div>
          <p className="cr-aide">Le nom et le prénom restent sur cet appareil : ils sont remplacés par « [patient] » avant l'envoi.</p>
        </section>

        <section className="cr-carte">
          <h2>Enregistrement</h2>
          <EtatServeur sante={whisper} />
          {!enregistrementDisponible && (
            <p className="cr-alerte">L'enregistrement audio n'est pas disponible dans ce navigateur.</p>
          )}
          <div className="cr-enregistrement">
            <button
              type="button"
              className={micro.enCours ? "cr-micro actif" : "cr-micro"}
              onClick={micro.enCours ? micro.arreter : micro.demarrer}
              disabled={!enregistrementDisponible}
            >
              {micro.enCours ? "■ Arrêter" : transcription ? "● Reprendre" : "● Démarrer"}
            </button>
            <span className="cr-chrono">{formaterDuree(secondes)}</span>
            {micro.enCours && (
              <span className="cr-niveau" aria-hidden="true">
                <span style={{ width: `${Math.round(micro.niveau * 100)}%` }} />
              </span>
            )}
            <span className="cr-etat">
              {micro.enCours ? "Écoute en cours…" : transcription ? "En pause" : "Prêt"}
              {micro.enAttente > 0 && ` · transcription de ${micro.enAttente} segment${micro.enAttente > 1 ? "s" : ""}…`}
            </span>
          </div>
          {micro.erreur && <p className="cr-alerte">{micro.erreur}</p>}
          {micro.echecs > 0 && (
            <p className="cr-alerte">
              {micro.echecs} segment{micro.echecs > 1 ? "s" : ""} non transcrit{micro.echecs > 1 ? "s" : ""}.{" "}
              <button type="button" className="secondaire" onClick={micro.reessayer}>
                Réessayer
              </button>
            </p>
          )}
          <p className="cr-aide">
            Astuce : dictez clairement vos constats cliniques (« formule dentaire complète », « classe II division 1
            molaire bilatérale », « encombrement modéré à la mandibule »…) ; le reste de la conversation est filtré.
          </p>

          <details className="cr-details">
            <summary>Transcription brute ({transcription.split(/\s+/).filter(Boolean).length} mots)</summary>
            <textarea
              rows={8}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              readOnly={micro.enCours || micro.enAttente > 0}
            />
          </details>

          <label className="cr-bloc">
            Notes complémentaires (facultatif)
            <textarea
              rows={3}
              value={notes}
              placeholder="Ex. : agénésie 35 confirmée sur la panoramique, proposition disjoncteur puis multi-attaches"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="principal"
            onClick={genererCompteRendu}
            disabled={chargement || micro.enCours || micro.enAttente > 0 || (!transcription.trim() && !notes.trim())}
          >
            {chargement
              ? "Rédaction du compte rendu…"
              : micro.enAttente > 0
                ? "Transcription en cours…"
                : rapport
                  ? "Régénérer le compte rendu"
                  : "Générer le compte rendu"}
          </button>
          {erreurApi && <p className="cr-alerte">{erreurApi}</p>}
        </section>

        {rapport && (
          <section className="cr-carte cr-pleine">
            <div className="cr-titre-section">
              <h2>Compte rendu (modifiable)</h2>
              <button type="button" className="principal" onClick={() => window.print()}>
                Imprimer / PDF
              </button>
            </div>

            {rapport.points_a_verifier.length > 0 && (
              <div className="cr-verifier">
                <strong>À vérifier avant impression</strong>
                <ul>
                  {rapport.points_a_verifier.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <label className="cr-bloc">
              1. Motif de consultation
              <textarea rows={3} value={rapport.motif} onChange={(e) => setRapport({ ...rapport, motif: e.target.value })} />
            </label>

            <h3>2. Diagnostic</h3>
            <div className="cr-diagnostic">
              {CHAMPS_DIAGNOSTIC.slice(0, 5).map(([cle, libelle]) => (
                <label key={cle}>
                  {libelle}
                  <textarea rows={2} value={rapport.diagnostic[cle]} onChange={(e) => majDiagnostic(cle, e.target.value)} />
                </label>
              ))}
              <label>
                Encombrement
                <div className="cr-encombrement">
                  <select
                    value={rapport.diagnostic.encombrement}
                    onChange={(e) => majDiagnostic("encombrement", e.target.value)}
                  >
                    <option value="">Non précisé</option>
                    <option value="léger">Léger</option>
                    <option value="modéré">Modéré</option>
                    <option value="sévère">Sévère</option>
                  </select>
                  <input
                    placeholder="Précision (arcade, mm…)"
                    value={rapport.diagnostic.encombrement_precision}
                    onChange={(e) => majDiagnostic("encombrement_precision", e.target.value)}
                  />
                </div>
              </label>
              {CHAMPS_DIAGNOSTIC.slice(5).map(([cle, libelle]) => (
                <label key={cle}>
                  {libelle}
                  <textarea rows={2} value={rapport.diagnostic[cle]} onChange={(e) => majDiagnostic(cle, e.target.value)} />
                </label>
              ))}
            </div>

            <h3>3. Plan de traitement</h3>
            <label className="cr-bloc">
              Explication au patient
              <textarea rows={4} value={rapport.plan_traitement.resume} onChange={(e) => majPlan("resume", e.target.value)} />
            </label>
            <label className="cr-bloc">
              Durée estimée
              <input value={rapport.plan_traitement.duree_estimee} onChange={(e) => majPlan("duree_estimee", e.target.value)} />
            </label>
            {rapport.plan_traitement.appareils_hors_catalogue.length > 0 && (
              <p className="cr-alerte">
                Appareils évoqués absents du catalogue : {rapport.plan_traitement.appareils_hors_catalogue.join(", ")}. Ajoutez-les
                dans « Appareils &amp; cabinet » pour qu'ils aient leur texte.
              </p>
            )}
            <fieldset className="cr-appareils">
              <legend>Appareils proposés (le texte pré-enregistré sera ajouté au compte rendu)</legend>
              {appareils.map((a) => (
                <label key={a.id} className="cr-case">
                  <input
                    type="checkbox"
                    checked={rapport.plan_traitement.appareils.includes(a.id)}
                    onChange={() => basculerAppareil(a.id)}
                  />
                  {a.nom}
                </label>
              ))}
            </fieldset>
          </section>
        )}
      </main>

      {rapport && <CompteRendu rapport={rapport} patient={patient} cabinet={cabinet} appareils={appareils} />}
    </div>
  );
}
