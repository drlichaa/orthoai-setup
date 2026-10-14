import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import APPAREILS_PAR_DEFAUT from "./appareilsParDefaut.js";
import ANCIENS_TEXTES from "./anciensTextes.js";
import useEnregistrement, { enregistrementDisponible } from "./useEnregistrement.js";
import CompteRendu from "./CompteRendu.jsx";
import { CourrierDocument, CourriersEdition } from "./Courriers.jsx";
import CatalogueAppareils from "./CatalogueAppareils.jsx";
import Historique, { Verrou } from "./Historique.jsx";
import Patients from "./Patients.jsx";
import { appelHistorique } from "./apiHistorique.js";
import { resumeClinique } from "./resumeClinique.js";
import { formaterNom, formaterPrenom } from "./format.js";

const CLE_APPAREILS = "cr-ortho:appareils";
const CLE_CABINET = "cr-ortho:cabinet";
const CLE_APPAREILS_CONNUS = "cr-ortho:appareils-connus";
const CABINET_VIDE = {
  praticien: "",
  cabinet: "",
  coordonnees: "",
  telephone: "",
  email: "",
  ville: "",
  identifiant: "",
  // Accord des courriers : « reconnaissante », « informée »…
  genre: "F",
  logo: "",
  signature: "",
};

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
  dents: { agenesies: [], a_extraire: [], incluses: [] },
  courriers: [],
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

// Appareils du tout premier catalogue (avant le suivi des appareils connus).
const CATALOGUE_INITIAL = [
  "disjoncteur", "quad_helix", "activateur", "masque_delaire", "plaque_amovible",
  "multi_attaches_metal", "multi_attaches_ceramique", "aligneurs", "mainteneur_espace", "contention",
];

// Ajoute au catalogue enregistré les appareils par défaut apparus depuis
// (mise à jour) et actualise les textes par défaut restés intacts, sans toucher
// aux textes modifiés ni réajouter les appareils supprimés.
function completerAppareils(enregistres, connus = CATALOGUE_INITIAL) {
  const nouveaux = APPAREILS_PAR_DEFAUT.filter((a) => !connus.includes(a.id) && !enregistres.some((e) => e.id === a.id));
  const actualises = enregistres.map((a) =>
    ANCIENS_TEXTES[a.id]?.includes(a.texte) ? APPAREILS_PAR_DEFAUT.find((d) => d.id === a.id) : a,
  );
  return [...actualises, ...nouveaux];
}

function chargerAppareils() {
  const enregistres = lireStockage(CLE_APPAREILS, null);
  if (!enregistres) return APPAREILS_PAR_DEFAUT;
  return completerAppareils(enregistres, lireStockage(CLE_APPAREILS_CONNUS, CATALOGUE_INITIAL));
}

const IDS_PAR_DEFAUT = APPAREILS_PAR_DEFAUT.map((a) => a.id);

// En-tête et catalogue sont gardés par le serveur, pour être identiques sur
// tous les postes du cabinet (copie locale pour un affichage immédiat).
function envoyerReglagesCabinet(cabinet, appareils) {
  fetch("/api/cabinet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cabinet, appareils, appareilsConnus: IDS_PAR_DEFAUT }),
  }).catch(() => {});
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

// Liste de dents FDI saisie « 12, 22 » ; le texte saisi est gardé tel quel
// pendant la frappe, seules les dents valides sont enregistrées.
function ChampDents({ libelle, dents, onChange }) {
  const [texte, setTexte] = useState(dents.join(", "));
  const [dentsAffichees, setDentsAffichees] = useState(dents);
  if (dents !== dentsAffichees) {
    setDentsAffichees(dents);
    setTexte(dents.join(", "));
  }
  return (
    <label>
      {libelle}
      <input
        value={texte}
        placeholder="Ex. : 12, 22"
        onChange={(e) => {
          setTexte(e.target.value);
          const liste = [...new Set(e.target.value.match(/\b[1-8][1-8]\b/g) || [])];
          setDentsAffichees(liste);
          onChange(liste);
        }}
      />
    </label>
  );
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
  if (!sante.cle) messages.push("Clé API absente : ajoutez-la dans « Appareils & cabinet » → Clé API Anthropic.");
  if (messages.length === 0) return <p className="cr-ok">Transcription locale prête — l'audio ne quitte pas cet ordinateur.</p>;
  return messages.map((m) => (
    <p key={m} className="cr-alerte">
      {m}
    </p>
  ));
}

export default function ConsultationApp() {
  const [appareils, setAppareils] = useState(chargerAppareils);
  const [cabinet, setCabinet] = useState(() => ({ ...CABINET_VIDE, ...lireStockage(CLE_CABINET, {}) }));
  const [patient, setPatient] = useState({ nom: "", prenom: "", naissance: "", date: aujourdhui() });
  const [transcription, setTranscription] = useState("");
  const [notes, setNotes] = useState("");
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreurApi, setErreurApi] = useState("");
  // « #patients » dans l'adresse ouvre directement les dossiers patients (menu, accueil).
  const [vue, setVue] = useState(() => (window.location.hash === "#patients" ? "patients" : "consultation"));
  // Dossier patient rattaché à la consultation, et dossier affiché dans « Patients ».
  const [patientId, setPatientId] = useState(null);
  const [patientSelectionne, setPatientSelectionne] = useState(null);
  const [secondes, setSecondes] = useState(0);
  // Fiche de l'historique en cours d'édition et état de son enregistrement.
  const [idHistorique, setIdHistorique] = useState(null);
  const [appareilsFiges, setAppareilsFiges] = useState([]);
  const [signatureEnregistree, setSignatureEnregistree] = useState("");
  const [sauvegarde, setSauvegarde] = useState({ enCours: false, erreur: "", verrou: null });
  // Courrier en cours d'impression (index), sinon le compte rendu est imprimé.
  const [courrierImprime, setCourrierImprime] = useState(null);

  // Réglages du cabinet : lus sur le serveur au démarrage, puis renvoyés à chaque modification.
  const reglagesCharges = useRef(false);
  useEffect(() => {
    let actif = true;
    fetch("/api/cabinet")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!actif || !d) return;
        if (d.cabinet) setCabinet({ ...CABINET_VIDE, ...d.cabinet });
        if (d.appareils) setAppareils(completerAppareils(d.appareils, d.appareilsConnus || CATALOGUE_INITIAL));
        // Premier lancement en mode partagé : les réglages de ce poste deviennent ceux du cabinet.
        if (!d.cabinet || !d.appareils) {
          envoyerReglagesCabinet(d.cabinet || cabinetInitial.current, d.appareils || appareilsInitiaux.current);
        }
        reglagesCharges.current = true;
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);
  const cabinetInitial = useRef(cabinet);
  const appareilsInitiaux = useRef(appareils);
  useEffect(() => {
    ecrireStockage(CLE_APPAREILS, appareils);
    ecrireStockage(CLE_APPAREILS_CONNUS, IDS_PAR_DEFAUT);
    ecrireStockage(CLE_CABINET, cabinet);
    if (!reglagesCharges.current) return undefined;
    const minuteur = setTimeout(() => envoyerReglagesCabinet(cabinet, appareils), 600);
    return () => clearTimeout(minuteur);
  }, [cabinet, appareils]);

  useEffect(() => {
    const surHash = () => {
      if (window.location.hash === "#patients") setVue("patients");
    };
    window.addEventListener("hashchange", surHash);
    return () => window.removeEventListener("hashchange", surHash);
  }, []);

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
        dents: { ...RAPPORT_VIDE.dents, ...donnees.report.dents },
      });
    } catch (err) {
      setErreurApi(err.message);
    } finally {
      setChargement(false);
    }
  }

  // Textes des appareils tels qu'enregistrés dans l'historique, prioritaires sur le catalogue actuel.
  const appareilsAffiches = [
    ...appareils.map((a) => appareilsFiges.find((f) => f.id === a.id) || a),
    ...appareilsFiges.filter((f) => !appareils.some((a) => a.id === f.id)),
  ];
  const signature = rapport ? JSON.stringify({ patient, rapport, notes }) : "";
  const enregistre = Boolean(rapport) && signature === signatureEnregistree;

  async function enregistrerHistorique({ silencieux = false } = {}) {
    setSauvegarde({ enCours: true, erreur: "", verrou: null });
    try {
      const resume = resumeClinique(rapport, appareilsAffiches);
      const { fiche } = await appelHistorique("/enregistrer", {
        id: idHistorique,
        patientId,
        // Pré-remplit le dossier patient s'il est créé à cette occasion.
        resumeClinique: {
          diagnostic: resume.diagnostic.map((l) => `- ${l}`).join("\n"),
          plan: resume.traitement.map((l) => `- ${l}`).join("\n"),
        },
        patient,
        rapport,
        notes,
        appareils: appareilsAffiches.filter((a) => rapport.plan_traitement.appareils.includes(a.id)),
      });
      setIdHistorique(fiche.id);
      setPatientId(fiche.patientId);
      setSignatureEnregistree(signature);
      setSauvegarde({ enCours: false, erreur: "", verrou: null });
      return true;
    } catch (err) {
      // Historique verrouillé (423) ou pas encore créé (404) : proposer le mot de passe.
      const verrou = err.statut === 423 || err.statut === 404 ? { existe: err.statut === 423 } : null;
      setSauvegarde({ enCours: false, erreur: silencieux || verrou ? "" : err.message, verrou: silencieux ? null : verrou });
      return false;
    }
  }

  async function imprimer(indexCourrier = null) {
    // Enregistre au passage si l'historique est déverrouillé.
    if (!enregistre) await enregistrerHistorique({ silencieux: true });
    flushSync(() => setCourrierImprime(indexCourrier));
    window.print();
    setCourrierImprime(null);
  }

  const consultationEnCours = (rapport && !enregistre) || (!rapport && transcription.trim());

  function ouvrirFiche(fiche) {
    if (
      consultationEnCours &&
      !window.confirm("La consultation en cours n'est pas enregistrée. L'abandonner pour ouvrir ce compte rendu ?")
    )
      return;
    micro.arreter();
    micro.oublierEchecs();
    const rapportOuvert = {
      ...RAPPORT_VIDE,
      ...fiche.rapport,
      diagnostic: { ...RAPPORT_VIDE.diagnostic, ...fiche.rapport.diagnostic },
      plan_traitement: { ...RAPPORT_VIDE.plan_traitement, ...fiche.rapport.plan_traitement },
      dents: { ...RAPPORT_VIDE.dents, ...fiche.rapport.dents },
    };
    const patientOuvert = { nom: "", prenom: "", naissance: "", date: aujourdhui(), ...fiche.patient };
    const notesOuvertes = fiche.notes || "";
    setPatient(patientOuvert);
    setRapport(rapportOuvert);
    setNotes(notesOuvertes);
    setTranscription("");
    setSecondes(0);
    setErreurApi("");
    setIdHistorique(fiche.id);
    setPatientId(fiche.patientId || null);
    setAppareilsFiges(fiche.appareils || []);
    setSignatureEnregistree(JSON.stringify({ patient: patientOuvert, rapport: rapportOuvert, notes: notesOuvertes }));
    setSauvegarde({ enCours: false, erreur: "", verrou: null });
    setVue("consultation");
  }

  async function ouvrirCompteRendu(id) {
    try {
      ouvrirFiche((await appelHistorique(`/fiche/${id}`)).fiche);
    } catch (err) {
      window.alert(err.message);
    }
  }

  function viderConsultation(identite = {}, idPatient = null) {
    micro.arreter();
    micro.oublierEchecs();
    setPatient({ nom: "", prenom: "", naissance: "", ...identite, date: aujourdhui() });
    setPatientId(idPatient);
    setTranscription("");
    setNotes("");
    setRapport(null);
    setSecondes(0);
    setErreurApi("");
    setIdHistorique(null);
    setAppareilsFiges([]);
    setSignatureEnregistree("");
    setSauvegarde({ enCours: false, erreur: "", verrou: null });
  }

  function nouvelleConsultation() {
    const message =
      rapport && !enregistre
        ? "Le compte rendu n'est pas enregistré dans l'historique. Effacer quand même la consultation ?"
        : "Effacer la consultation en cours ?";
    if (!window.confirm(message)) return;
    viderConsultation();
  }

  // Depuis un dossier patient : nouvelle consultation déjà rattachée au dossier.
  function consultationPour(p) {
    if (
      consultationEnCours &&
      !window.confirm("La consultation en cours n'est pas enregistrée. L'abandonner pour commencer celle-ci ?")
    )
      return;
    viderConsultation({ nom: p.nom, prenom: p.prenom, naissance: p.naissance, sexe: p.sexe || "" }, p.id);
    setVue("consultation");
  }

  function fermerPatients() {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setVue("consultation");
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

  if (vue === "patients") {
    return (
      <Patients
        patientId={patientSelectionne}
        onSelection={setPatientSelectionne}
        onOuvrirCompteRendu={ouvrirCompteRendu}
        onNouvelleConsultation={consultationPour}
        onFermer={fermerPatients}
        cabinet={cabinet}
        appareils={appareils}
      />
    );
  }

  if (vue === "historique") {
    return <Historique onOuvrir={ouvrirFiche} onFermer={() => setVue("consultation")} />;
  }

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
          <a className="cr-lien-accueil" href="/accueil.html">
            ← Accueil
          </a>
          {patientId && (
            <button
              type="button"
              className="secondaire"
              onClick={() => {
                setPatientSelectionne(patientId);
                setVue("patients");
              }}
            >
              Dossier du patient
            </button>
          )}
          <button
            type="button"
            className="secondaire"
            onClick={() => {
              setPatientSelectionne(null);
              setVue("patients");
            }}
          >
            Patients
          </button>
          <button type="button" className="secondaire" onClick={() => setVue("historique")}>
            Historique
          </button>
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
              <input value={patient.nom} onChange={(e) => setPatient({ ...patient, nom: formaterNom(e.target.value) })} />
            </label>
            <label>
              Prénom
              <input
                value={patient.prenom}
                onChange={(e) => setPatient({ ...patient, prenom: formaterPrenom(e.target.value) })}
              />
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
            <label>
              Sexe
              <select value={patient.sexe || ""} onChange={(e) => setPatient({ ...patient, sexe: e.target.value })}>
                <option value="">—</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
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
              <div className="cr-sauvegarde">
                <span className={enregistre ? "cr-sauvegarde-etat ok" : "cr-sauvegarde-etat"}>
                  {enregistre ? "✓ Enregistré dans l'historique" : idHistorique ? "Modifications non enregistrées" : ""}
                </span>
                <button
                  type="button"
                  className="secondaire"
                  onClick={() => enregistrerHistorique()}
                  disabled={sauvegarde.enCours || enregistre}
                >
                  {sauvegarde.enCours ? "Enregistrement…" : "Enregistrer dans l'historique"}
                </button>
                <button type="button" className="principal" onClick={() => imprimer()}>
                  Imprimer / PDF
                </button>
              </div>
            </div>
            {sauvegarde.verrou && (
              <div className="cr-carte">
                <h3>{sauvegarde.verrou.existe ? "Déverrouiller l'historique" : "Créer l'historique de cet ordinateur"}</h3>
                <Verrou
                  existe={sauvegarde.verrou.existe}
                  onDeverrouille={() => enregistrerHistorique()}
                  onAnnuler={() => setSauvegarde({ enCours: false, erreur: "", verrou: null })}
                />
              </div>
            )}
            {sauvegarde.erreur && <p className="cr-alerte">{sauvegarde.erreur}</p>}

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

            <div className="cr-champs-ligne cr-bloc">
              {[
                ["agenesies", "Agénésies (schéma dentaire)"],
                ["a_extraire", "Dents à extraire (schéma dentaire)"],
                ["incluses", "Dents incluses (schéma dentaire)"],
              ].map(([cle, libelle]) => (
                <ChampDents
                  key={cle}
                  libelle={libelle}
                  dents={rapport.dents[cle]}
                  onChange={(liste) => setRapport((r) => ({ ...r, dents: { ...r.dents, [cle]: liste } }))}
                />
              ))}
            </div>
            <p className="cr-aide">Reportées sur le schéma dentaire du patient à l'enregistrement dans l'historique.</p>

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
              {appareilsAffiches.map((a) => (
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

            <h3>4. Courriers aux confrères</h3>
            <CourriersEdition
              courriers={rapport.courriers}
              onChange={(courriers) => setRapport({ ...rapport, courriers })}
              onImprimer={imprimer}
            />
          </section>
        )}
      </main>

      {rapport && (
        <div className={courrierImprime === null ? undefined : "no-print"}>
          <CompteRendu rapport={rapport} patient={patient} cabinet={cabinet} appareils={appareilsAffiches} />
        </div>
      )}
      {rapport?.courriers[courrierImprime] && (
        <CourrierDocument
          courrier={rapport.courriers[courrierImprime]}
          patient={patient}
          cabinet={cabinet}
          resume={resumeClinique(rapport, appareilsAffiches)}
        />
      )}
    </div>
  );
}
