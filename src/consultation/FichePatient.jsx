import { useEffect, useRef, useState } from "react";
import ImportQuestionnaire from "./ImportQuestionnaire.jsx";
import QuestionnaireMedical from "./QuestionnaireMedical.jsx";
import Parcours from "./Parcours.jsx";
import EnvoiMail from "./EnvoiMail.jsx";
import { modeleCourrier } from "./messagerie.js";
import FriseTraitement from "./FriseTraitement.jsx";
import { DonneesOrthofast } from "./ImportOrthofast.jsx";
import { flushSync } from "react-dom";
import { CourrierDocument, CourriersEdition } from "./Courriers.jsx";
import { texteExtractions } from "./modelesCourriers.js";
import { appelApi, envoyerFichier, envoyerImage } from "./apiHistorique.js";
import { SCENARIOS_PAR_DEFAUT, ligneSuivi } from "./scenarios.js";
import GestionTraitement from "./GestionTraitement.jsx";
import SuiviTraitement from "./SuiviTraitement.jsx";
import { cabinetPour, lieux } from "./lieux.js";
import SeriesImages, { PlancheDocument } from "./SeriesImages.jsx";
import {
  STATUT_TRAITEMENT,
  accorder,
  age,
  classeStatut,
  depuis,
  formaterDate,
  formaterNom,
  formaterPrenom,
  refusQuestionnaire,
} from "./format.js";
import { dentsAvecEtat } from "./dents.js";
import SchemaDentaire from "./SchemaDentaire.jsx";

// Dossier d'un patient : identité, diagnostic, plan, comptes rendus, suivi des
// séances, commentaires, photos et radios. Les modifications s'enregistrent
// automatiquement dans le coffre chiffré.

const ARCS = [
  ["arcSup", "Arc supérieur", "cr-fils", "Ex. : NiTi .014"],
  ["arcInf", "Arc inférieur", "cr-fils", "Ex. : NiTi .014"],
  ["aux1", "Auxiliaire 1 (élastiques)", "cr-elastiques", "Ex. : Moose force 1"],
  ["aux2", "Auxiliaire 2 (tractions)", "cr-tractions", "Ex. : TIM 2"],
];

// Élastiques inter-maxillaires, par modèle et par force.
const ELASTIQUES = ["Moose", "Parrot", "Rabbit", "Ram", "Walrus"].flatMap((m) => [`${m} force 1`, `${m} force 2`]);
const TRACTIONS = ["TIM 2", "TIM 3", "TIM Rectangle", "Criss-Cross"];

const MISE_EN_FORME = { nom: formaterNom, prenom: formaterPrenom };

// Appareils proposables comme type de traitement (hors conseils et gestes ponctuels).
const TYPES_APPAREILS = (appareils) =>
  appareils.filter((a) => !["recommandations_bagues", "stripping"].includes(a.id)).map((a) => a.nom);

// Libellés repris dans le suivi des séances, comme dans OrthoFast.
const ARCS_SUIVI = { arcSup: "Arc Sup.", arcInf: "Arc Inf.", aux1: "Aux. 1", aux2: "Aux. 2" };

// Séance du jour (créée si besoin), transformée par « modifier ».
function majSeance(seances, modifier) {
  const date = dateCourte();
  const index = seances.findLastIndex((s) => s.date === date);
  const seance = index === -1 ? { date, fait: "", prochaine: "", recollages: [] } : seances[index];
  const suivante = modifier(seance);
  return index === -1 ? [...seances, suivante] : seances.map((s, i) => (i === index ? suivante : s));
}

// Séance du jour dont le texte « fait » est transformé ligne par ligne.
function majSeanceDuJour(seances, transformer) {
  return majSeance(seances, (seance) => {
    const lignes = seance.fait ? seance.fait.split("\n") : [];
    return { ...seance, fait: transformer(lignes).join("\n") };
  });
}

// Ajoute ou retire une dent des recollages du jour (affichés en rouge).
function basculerRecollage(seances, dent) {
  return majSeance(seances, (seance) => {
    const actuels = seance.recollages || [];
    const suivants = actuels.includes(dent) ? actuels.filter((d) => d !== dent) : [...actuels, dent];
    return { ...seance, recollages: suivants };
  });
}

// Une seule ligne par sujet (arc, dents à extraire…) dans la séance du jour,
// mise à jour au fil des modifications ; supprimée si la valeur est vide.
function noterLigne(seances, prefixe, valeur) {
  return majSeanceDuJour(seances, (lignes) => {
    const position = lignes.findIndex((l) => l.startsWith(prefixe));
    const autres = lignes.filter((l) => !l.startsWith(prefixe));
    if (!valeur.trim()) return autres;
    const ligne = prefixe + valeur.trim();
    if (position === -1) return [...autres, ligne];
    return [...autres.slice(0, position), ligne, ...autres.slice(position)];
  });
}

function noterArc(seances, cle, fil) {
  return noterLigne(seances, `${ARCS_SUIVI[cle]} `, fil);
}

// Courrier au dentiste tenu à jour avec les dents « À extraire » du schéma,
// tant qu'il n'a pas été modifié à la main.
function majCourrierExtractions(courriers, avant, apres) {
  const index = courriers.findIndex((c) => c.auto === "extractions" && c.corps === texteExtractions(avant));
  if (index !== -1) {
    if (!apres.length) return courriers.filter((_, i) => i !== index);
    return courriers.map((c, i) => (i === index ? { ...c, corps: texteExtractions(apres) } : c));
  }
  const nouvelles = apres.filter((d) => !avant.includes(d));
  if (!nouvelles.length) return courriers;
  return [
    ...courriers,
    {
      date: aujourdhui(),
      destinataire: "dentiste",
      motif: "Extractions dans le cadre du traitement orthodontique",
      corps: texteExtractions(apres),
      nom_destinataire: "",
      auto: "extractions",
    },
  ];
}

// Suggestions de fils (saisie libre possible).
const FILS = [
  "NiTi .012",
  "NiTi .014",
  "NiTi .016",
  "NiTi .018",
  "NiTi .016x.022",
  "NiTi .018x.018",
  "NiTi .018x.025",
  "NiTi .019x.025",
  "NiTi .014x.025",
  "TMA .017x.025",
  "TMA .019x.025",
  "Acier .016",
  "Acier .018",
  "Acier .016x.022",
  "Acier .018x.025",
  "Acier .019x.025",
];

// Dossiers créés avant l'ajout de certains champs.
const ARC_VIDE = { fil: "", depuis: "" };
const DEFAUTS = {
  gestion: {},
  series: [],
  courriers: [],
  dents: {},
  dentsTemporaires: false,
  securiteSociale: true,
  tutoiement: false,
  arcSup: ARC_VIDE,
  arcInf: ARC_VIDE,
  aux1: ARC_VIDE,
  aux2: ARC_VIDE,
};

function libelleDepuis(date) {
  const duree = depuis(date);
  if (!duree) return "";
  return duree === "aujourd'hui" ? "Posé aujourd'hui" : `Depuis ${duree}`;
}

// Ancienneté d'une image : « < 1 mois », « 3 mois », « 1 an et 2 mois ».
function anciennete(date) {
  if (!date) return "";
  const jours = (Date.now() - new Date(`${date}T12:00:00`)) / 86400000;
  return jours < 31 ? "< 1 mois" : depuis(date);
}

// Colonne de droite de la fiche clinique : dernières photos (série la plus
// récente) et dernières radios, avec leur ancienneté.
function PhotosLaterales({ patient, scenarios, onOuvrir, onAjouter }) {
  const recentes = (genre) =>
    patient.series
      .filter((s) => scenarios.find((x) => x.id === s.scenario)?.genre === genre)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const photos = recentes("photos")[0];
  const scenarioPhotos = photos
    ? scenarios.find((x) => x.id === photos.scenario)
    : scenarios.find((x) => x.genre === "photos");
  const scenarioRadios = scenarios.find((x) => x.genre === "radios");
  const cases = [
    ...(scenarioPhotos?.elements || []).map((e) => ({
      cle: e.cle,
      nom: e.nom,
      valeur: photos?.elements[e.cle] && { ...photos.elements[e.cle], date: photos.date },
    })),
    // Pour chaque radio, la plus récente parmi les séries de radios.
    ...(scenarioRadios?.elements || []).map((e) => {
      const serie = recentes("radios").find((s) => s.elements[e.cle]);
      return {
        cle: e.cle,
        nom: e.nom,
        valeur: serie && { ...serie.elements[e.cle], date: serie.elements[e.cle].date || serie.date },
      };
    }),
  ];
  return (
    <aside className="cr-photos-laterales" aria-label="Photos et radios">
      <div className="cr-photos-laterales-titre">
        <strong>{photos ? photos.nom : "Photos"}</strong>
        {photos && <span>{formaterDate(photos.date)}</span>}
      </div>
      <div className="cr-photos-grille">
        {cases.map(({ cle, nom, valeur }) =>
          valeur ? (
            <button
              key={cle}
              type="button"
              className="cr-photo-laterale"
              onClick={() => onOuvrir({ media: valeur.media, titre: nom, date: valeur.date })}
            >
              <img src={`/api/patients/media/${valeur.media}`} alt={nom} loading="lazy" />
              <span className="cr-photo-badge">{anciennete(valeur.date)}</span>
              <span className="cr-photo-nom">{nom}</span>
            </button>
          ) : (
            <button
              key={cle}
              type="button"
              className="cr-photo-laterale vide"
              onClick={onAjouter}
              title="Ajouter dans Photos & radios"
            >
              <span className="cr-photo-plus">+</span>
              <span className="cr-photo-nom">{nom}</span>
            </button>
          ),
        )}
      </div>
    </aside>
  );
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function dateCourte() {
  return new Date().toLocaleDateString("fr-FR");
}

export default function FichePatient({
  ongletInitial,
  patientId,
  onRetour,
  onVerrouille,
  onOuvrirCompteRendu,
  onNouvelleConsultation,
  onSupprime,
  cabinet,
  appareils = [],
}) {
  const [dossier, setDossier] = useState(null);
  const [patient, setPatient] = useState(null);
  // Dernière version du dossier, à jour même entre deux rendus (envois d'images).
  const dernier = useRef(null);
  const definir = (suivant) => {
    dernier.current = suivant;
    setPatient(suivant);
  };
  const [sauvegarde, setSauvegarde] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoiImages, setEnvoiImages] = useState(0);
  const [imageOuverte, setImageOuverte] = useState(null);
  // Photo ou radio agrandie depuis la colonne de la fiche clinique.
  const [apercu, setApercu] = useState(null);
  const [onglet, setOnglet] = useState(ongletInitial || "clinique");
  const [courrierEnvoye, setCourrierEnvoye] = useState(null);
  // Import du questionnaire WeClever, puis relecture du dossier (version).
  const [importQuestionnaire, setImportQuestionnaire] = useState(false);
  const [version, setVersion] = useState(0);
  // Courrier du dossier en cours d'impression (index).
  const [courrierImprime, setCourrierImprime] = useState(null);
  // Planche photos en cours d'impression.
  const [plancheImprimee, setPlancheImprimee] = useState(null);
  // Devis ou DEP en cours d'impression.
  const [documentImprime, setDocumentImprime] = useState(null);
  const enAttente = useRef(null);
  const minuteur = useRef(null);
  // Rappel du parent conservé à part : le recharger ne doit pas relire la fiche.
  const surVerrou = useRef(onVerrouille);
  useEffect(() => {
    surVerrou.current = onVerrouille;
  });

  useEffect(() => {
    let actif = true;
    appelApi(`/patients/dossier/${patientId}`)
      .then((d) => {
        if (!actif) return;
        setDossier(d);
        definir({ ...DEFAUTS, ...d.patient });
      })
      .catch((err) => {
        if (!actif) return;
        if (err.statut === 423) surVerrou.current();
        else setErreur(err.message);
      });
    return () => {
      actif = false;
    };
  }, [patientId, version]);

  async function enregistrer(suivant) {
    clearTimeout(minuteur.current);
    enAttente.current = null;
    setSauvegarde("enCours");
    try {
      await appelApi("/patients/enregistrer", { patient: suivant });
      setSauvegarde("ok");
    } catch (err) {
      setSauvegarde("");
      if (err.statut === 423) surVerrou.current();
      else setErreur(err.message);
    }
  }

  // Enregistre les modifications en attente en quittant la fiche.
  useEffect(
    () => () => {
      clearTimeout(minuteur.current);
      if (enAttente.current) appelApi("/patients/enregistrer", { patient: enAttente.current }).catch(() => {});
    },
    [],
  );

  function maj(modifications, { immediat = false } = {}) {
    const suivant = { ...dernier.current, ...modifications };
    definir(suivant);
    setSauvegarde("modifie");
    enAttente.current = suivant;
    clearTimeout(minuteur.current);
    if (immediat) enregistrer(suivant);
    else minuteur.current = setTimeout(() => enregistrer(suivant), 700);
  }

  // Modifie la partie gestion (devis, semestres, labo…) à partir de la dernière version.
  const majGestion = (modif, immediat = true) =>
    maj({ gestion: { ...(dernier.current.gestion || {}), ...modif } }, { immediat });

  function imprimerDocument(element) {
    flushSync(() => setDocumentImprime(element));
    window.print();
    setDocumentImprime(null);
  }

  const majLigne = (liste, index, champ, valeur) =>
    maj({ [liste]: patient[liste].map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)) });
  const supprimerLigne = (liste, index, message) =>
    window.confirm(message) && maj({ [liste]: patient[liste].filter((_, i) => i !== index) }, { immediat: true });

  async function ajouterImages(fichiers) {
    setErreur("");
    let ajoutees = 0;
    for (const fichier of fichiers) {
      setEnvoiImages((n) => n + 1);
      try {
        const media = await envoyerImage(patientId, fichier);
        definir({ ...dernier.current, medias: [...dernier.current.medias, media] });
        ajoutees += 1;
      } catch (err) {
        setErreur(err.message);
      } finally {
        setEnvoiImages((n) => n - 1);
      }
    }
    if (ajoutees) {
      const ligne = `Photos/radios ajoutées : ${ajoutees} image${ajoutees > 1 ? "s" : ""}`;
      maj({ seances: majSeanceDuJour(dernier.current.seances, (lignes) => [...lignes, ligne]) }, { immediat: true });
    }
  }

  async function supprimerImage(media) {
    if (!window.confirm(`Supprimer « ${media.nom} » ?`)) return;
    try {
      await appelApi("/patients/media/supprimer", { patient: patientId, id: media.id });
      definir({ ...dernier.current, medias: dernier.current.medias.filter((m) => m.id !== media.id) });
      setImageOuverte(null);
    } catch (err) {
      setErreur(err.message);
    }
  }

  function imprimerCourrier(index) {
    flushSync(() => setCourrierImprime(index));
    window.print();
    setCourrierImprime(null);
  }

  // Diagnostic et plan du dossier, ligne par ligne, joints aux courriers.
  const lignes = (texte) =>
    (texte || "")
      .split("\n")
      .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);

  async function supprimerPatient() {
    const nom = [patient.prenom, patient.nom].filter(Boolean).join(" ");
    const message = `Supprimer définitivement le dossier de ${nom}, avec ses comptes rendus, photos et radios ?\nCette action est irréversible.`;
    if (!window.confirm(message)) return;
    try {
      clearTimeout(minuteur.current);
      enAttente.current = null;
      await appelApi("/patients/supprimer", { id: patientId });
      onSupprime();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (!patient) {
    return (
      <>
        <button type="button" className="secondaire" onClick={onRetour}>
          ← Liste des patients
        </button>
        {erreur && <p className="cr-alerte">{erreur}</p>}
      </>
    );
  }

  const { reglages, comptesRendus } = dossier;
  const champ = (cle, libelle, type = "text") => (
    <label>
      {libelle}
      <input
        type={type}
        value={patient[cle] ?? ""}
        onChange={(e) => maj({ [cle]: MISE_EN_FORME[cle]?.(e.target.value) ?? e.target.value })}
      />
    </label>
  );

  // En-tête des documents : adresse du cabinet où le patient est suivi.
  const cabinetPatient = cabinetPour(cabinet, patient.lieu);
  // Date de la 1ère consultation : la plus ancienne connue (compte rendu, devis, début, création du dossier).
  const datePremiere = [
    ...(dossier?.comptesRendus || []).map((c) => c.patient?.date),
    ...(patient.gestion?.devis || []).map((d) => d.date),
    patient.orthofast?.debutTraitement,
    patient.debut,
    patient.creeLe?.slice(0, 10),
  ]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""))
    .sort()[0];
  const courrierAImprimer = courrierImprime === null ? null : patient.courriers[courrierImprime];
  const scenarios = cabinet?.scenarios?.length ? cabinet.scenarios : SCENARIOS_PAR_DEFAUT;
  // Images hors séries (anciennes, radios annotées…) et sans les empreintes 3D.
  const mediasSeries = new Set(patient.series.flatMap((s) => Object.values(s.elements).map((e) => e.media)));
  const images = patient.medias.filter((m) => (m.type || "image/jpeg").startsWith("image/"));
  const refus = refusQuestionnaire(patient.questionnaire);
  const autresImages = images.filter((m) => !mediasSeries.has(m.id));

  return (
    <>
      <div className={courrierAImprimer || plancheImprimee || documentImprime ? "no-print" : undefined}>
        <header className="cr-entete">
          <button type="button" className="secondaire" onClick={onRetour}>
            ← Liste des patients
          </button>
          <div className="cr-actions">
            <span className="cr-sauvegarde-etat ok">
              {sauvegarde === "ok" ? "✓ Enregistré" : sauvegarde === "enCours" ? "Enregistrement…" : ""}
            </span>
            <button type="button" className="principal" onClick={() => onNouvelleConsultation(patient)}>
              Nouvelle consultation
            </button>
            <button type="button" className="danger" onClick={supprimerPatient}>
              Supprimer le dossier
            </button>
          </div>
        </header>
        {erreur && <p className="cr-alerte">{erreur}</p>}

        <section className="cr-carte">
          <div className="cr-identite">
            <div className="cr-avatar" aria-hidden="true">
              {(patient.prenom || "?")[0]}
              {(patient.nom || "?")[0]}
            </div>
            <div>
              <h2>{[patient.prenom, patient.nom?.toUpperCase()].filter(Boolean).join(" ") || "Patient sans nom"}</h2>
              <p className="cr-aide">
                {patient.naissance
                  ? `${accorder("Né(e)", patient.sexe)} le ${formaterDate(patient.naissance)} · ${age(patient.naissance, aujourdhui())}`
                  : "Date de naissance non renseignée"}
                {patient.code && ` · Code ${patient.code}`}
                {patient.dossier && ` · Dossier n° ${patient.dossier}`}
              </p>
            </div>
            <div className="cr-identite-etat">
              <select
                className={patient.lieu ? `oa-pastille-lieu ${patient.lieu}` : "oa-pastille-lieu oa-a-choisir"}
                value={patient.lieu || ""}
                aria-label="Cabinet"
                onChange={(e) => maj({ lieu: e.target.value }, { immediat: true })}
              >
                <option value="">Cabinet à choisir…</option>
                {lieux(cabinet).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
              </select>
              {/* L'appareil (type de traitement) n'est demandé que pour un patient en traitement. */}
              {patient.statut === STATUT_TRAITEMENT && (
                <select
                  className="cr-pastille c-type"
                  value={patient.type}
                  aria-label="Appareil (type de traitement)"
                  onChange={(e) => maj({ type: e.target.value }, { immediat: true })}
                >
                  <option value="">Choisir l'appareil…</option>
                  {[...new Set([...TYPES_APPAREILS(appareils), patient.type].filter(Boolean))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
              <select
                className={classeStatut(reglages, patient.statut)}
                value={patient.statut}
                aria-label="Statut"
                onChange={(e) =>
                  maj(
                    { statut: e.target.value, ...(e.target.value === STATUT_TRAITEMENT ? {} : { type: "" }) },
                    { immediat: true },
                  )
                }
              >
                {[...new Set([...reglages.statuts.map((s) => s.nom), patient.statut].filter(Boolean))].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          {patient.alerte && <p className="cr-alerte cr-alerte-patient">⚠ {patient.alerte}</p>}
          {refus.length > 0 && (
            <p className="cr-alerte cr-alerte-patient">⛔ Refus (questionnaire médical) : {refus.join(" · ")}</p>
          )}
        </section>

        <nav className="cr-onglets" aria-label="Sections du dossier">
          {[
            ["clinique", "Fiche clinique"],
            ["patient", "Patient"],
            ["images", `Photos & radios (${images.length})`],
            ["gestion", "Devis & semestres"],
            ["suivi", "Suivi du traitement"],
          ].map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              className={onglet === cle ? "cr-onglet actif" : "cr-onglet"}
              onClick={() => setOnglet(cle)}
            >
              {libelle}
            </button>
          ))}
        </nav>

        {onglet === "clinique" && (
          <div className="cr-fiche-clinique">
            <div className="cr-fiche-clinique-principal">
              {patient.gestion?.semestres?.debut && (
                <section className="cr-carte">
                  <div className="cr-titre-section">
                    <h2>Frise du traitement</h2>
                    <button type="button" className="cr-lien" onClick={() => setOnglet("gestion")}>
                      Devis &amp; semestres →
                    </button>
                  </div>
                  <FriseTraitement patient={patient} gestion={patient.gestion} />
                </section>
              )}
              <Parcours
                patient={patient}
                maj={maj}
                majGestion={majGestion}
                cabinet={cabinetPatient}
                datePremiere={datePremiere}
                onImprimer={imprimerDocument}
                onOnglet={setOnglet}
                catalogue={appareils}
              />
              <section className="cr-carte">
                <h2>Traitement en cours</h2>
                <div className="cr-champs-ligne">{champ("debut", "Début du traitement", "date")}</div>
                <div className="cr-arcs cr-bloc">
                  {ARCS.map(([cle, libelle, liste, exemple]) => (
                    <div key={cle} className="cr-arc">
                      <label>
                        {libelle}
                        <input
                          list={liste}
                          value={patient[cle].fil}
                          placeholder={exemple}
                          onChange={(e) =>
                            maj({
                              // Nouveau fil : posé aujourd'hui (modifiable) et noté dans la séance du jour.
                              [cle]: { fil: e.target.value, depuis: aujourdhui() },
                              seances: noterArc(dernier.current.seances, cle, e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Posé le
                        <input
                          type="date"
                          value={patient[cle].depuis}
                          onChange={(e) => maj({ [cle]: { ...patient[cle], depuis: e.target.value } })}
                        />
                      </label>
                      <span className="cr-arc-depuis">{patient[cle].fil && libelleDepuis(patient[cle].depuis)}</span>
                    </div>
                  ))}
                  <datalist id="cr-fils">
                    {FILS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <datalist id="cr-elastiques">
                    {ELASTIQUES.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <datalist id="cr-tractions">
                    {TRACTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </section>

              <section className="cr-carte">
                <div className="cr-titre-section">
                  <h2>Schéma dentaire</h2>
                  <span className="cr-aide">Clic ou clic droit sur une dent</span>
                </div>
                <SchemaDentaire
                  dents={patient.dents}
                  temporaires={patient.dentsTemporaires}
                  recollagesDuJour={patient.seances.findLast((x) => x.date === dateCourte())?.recollages || []}
                  onChange={(dents) => {
                    const avant = dentsAvecEtat(dernier.current.dents, "aExtraire");
                    const apres = dentsAvecEtat(dents, "aExtraire");
                    const extractions =
                      avant.join() === apres.join()
                        ? {}
                        : {
                            // Noté dans la séance du jour, et courrier au dentiste préparé.
                            seances: noterLigne(dernier.current.seances, "À extraire : ", apres.join(", ")),
                            courriers: majCourrierExtractions(dernier.current.courriers, avant, apres),
                          };
                    maj(
                      {
                        dents,
                        // Champs texte tenus à jour pour les courriers et l'export.
                        agenesies: dentsAvecEtat(dents, "agenesie").join(", "),
                        dentsAExtraire: apres.join(", "),
                        ...extractions,
                      },
                      { immediat: true },
                    );
                  }}
                  onRecollage={(dent) =>
                    maj({ seances: basculerRecollage(dernier.current.seances, dent) }, { immediat: true })
                  }
                  onTemporaires={(dentsTemporaires) => maj({ dentsTemporaires }, { immediat: true })}
                />
                <dl className="cr-resume-dents">
                  <dt>Agénésies</dt>
                  <dd>{dentsAvecEtat(patient.dents, "agenesie").join(", ") || patient.agenesies || "—"}</dd>
                  <dt>Dents à extraire</dt>
                  <dd>{dentsAvecEtat(patient.dents, "aExtraire").join(", ") || patient.dentsAExtraire || "—"}</dd>
                  <dt>Extraites</dt>
                  <dd>{dentsAvecEtat(patient.dents, "extraite").join(", ") || "—"}</dd>
                  <dt>Incluses</dt>
                  <dd>{dentsAvecEtat(patient.dents, "incluse").join(", ") || "—"}</dd>
                </dl>
              </section>

              <div className="cr-grille cr-grille-fiche">
                <section className="cr-carte">
                  <h2>Alerte</h2>
                  <textarea
                    rows={3}
                    value={patient.alerte}
                    placeholder="Affichée en rouge en haut du dossier (allergie, précaution…)"
                    onChange={(e) => maj({ alerte: e.target.value })}
                  />
                </section>
                <section className="cr-carte">
                  <h2>Pense-bête</h2>
                  <textarea rows={3} value={patient.penseBete} onChange={(e) => maj({ penseBete: e.target.value })} />
                </section>
              </div>
              <div className="cr-grille cr-grille-fiche">
                <section className="cr-carte">
                  <h2>Diagnostic</h2>
                  <textarea
                    rows={7}
                    value={patient.diagnostic}
                    placeholder="Diagnostic orthodontique…"
                    onChange={(e) => maj({ diagnostic: e.target.value })}
                  />
                </section>
                <section className="cr-carte">
                  <h2>Plan de traitement</h2>
                  <textarea
                    rows={7}
                    value={patient.plan}
                    placeholder="Plan de traitement…"
                    onChange={(e) => maj({ plan: e.target.value })}
                  />
                </section>
              </div>
              <section className="cr-carte">
                <h2>Comptes rendus de consultation</h2>
                {comptesRendus.length === 0 ? (
                  <p className="cr-aide">
                    Aucun compte rendu. « Nouvelle consultation » en démarre un pour ce patient.
                  </p>
                ) : (
                  <ul className="cr-historique">
                    {[...comptesRendus]
                      .sort((a, b) => (b.patient?.date || "").localeCompare(a.patient?.date || ""))
                      .map((f) => (
                        <li key={f.id}>
                          <button type="button" className="cr-fiche" onClick={() => onOuvrirCompteRendu(f.id)}>
                            <span className="cr-fiche-date">{formaterDate(f.patient?.date)}</span>
                            <span className="cr-fiche-nom">Compte rendu de consultation</span>
                            <span className="cr-fiche-motif">{f.motif}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
              <section className="cr-carte">
                <div className="cr-titre-section">
                  <h2>Suivi du traitement</h2>
                  <button
                    type="button"
                    className="secondaire"
                    onClick={() =>
                      maj({ seances: [...patient.seances, { date: dateCourte(), fait: "", prochaine: "" }] })
                    }
                  >
                    + Ajouter une séance
                  </button>
                </div>
                {patient.seances.length === 0 ? (
                  <p className="cr-aide">Aucune séance enregistrée.</p>
                ) : (
                  <div className="cr-tableau-defilant">
                    <table className="cr-seances">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ce que j'ai fait aujourd'hui</th>
                          <th>Ce que je ferai la prochaine fois</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {patient.seances
                          .map((s, i) => ({ s, i }))
                          .reverse()
                          .map(({ s, i }) => (
                            <tr key={i}>
                              <td>
                                <input
                                  value={s.date}
                                  aria-label="Date"
                                  onChange={(e) => majLigne("seances", i, "date", e.target.value)}
                                />
                              </td>
                              <td>
                                {s.recollages?.length > 0 && (
                                  <p className="cr-suivi-rouge">Recollage : {s.recollages.join(", ")}</p>
                                )}
                                <textarea
                                  rows={2}
                                  value={s.fait}
                                  aria-label="Ce que j'ai fait aujourd'hui"
                                  onChange={(e) => majLigne("seances", i, "fait", e.target.value)}
                                />
                              </td>
                              <td>
                                <textarea
                                  rows={2}
                                  value={s.prochaine}
                                  aria-label="Ce que je ferai la prochaine fois"
                                  onChange={(e) => majLigne("seances", i, "prochaine", e.target.value)}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="danger"
                                  aria-label="Supprimer la séance"
                                  onClick={() => supprimerLigne("seances", i, "Supprimer cette séance ?")}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="cr-carte">
                <h2>Courriers</h2>
                <CourriersEdition
                  courriers={patient.courriers}
                  onChange={(courriers) => maj({ courriers: courriers.map((c) => ({ date: aujourdhui(), ...c })) })}
                  onImprimer={imprimerCourrier}
                  onEnvoyer={setCourrierEnvoye}
                  medias={images}
                  onJoindreImage={async (index, fichier) => {
                    // L'image annotée est rangée avec les autres, chiffrée, sans ligne de suivi.
                    const media = await envoyerImage(patientId, fichier);
                    definir({ ...dernier.current, medias: [...dernier.current.medias, media] });
                    maj(
                      {
                        courriers: dernier.current.courriers.map((c, i) =>
                          i === index ? { ...c, image: media.id } : c,
                        ),
                      },
                      { immediat: true },
                    );
                  }}
                  vide="Aucun courrier. Marquer une dent « À extraire » sur le schéma prépare le courrier au dentiste."
                  dater
                />
              </section>

              <section className="cr-carte">
                <div className="cr-titre-section">
                  <h2>Commentaires</h2>
                  <button
                    type="button"
                    className="secondaire"
                    onClick={() => maj({ commentaires: [...patient.commentaires, { date: dateCourte(), texte: "" }] })}
                  >
                    + Ajouter
                  </button>
                </div>
                {patient.commentaires.length === 0 ? (
                  <p className="cr-aide">Aucun commentaire.</p>
                ) : (
                  patient.commentaires
                    .map((c, i) => ({ c, i }))
                    .reverse()
                    .map(({ c, i }) => (
                      <div key={i} className="cr-commentaire">
                        <div className="cr-titre-section">
                          <span className="cr-aide">{c.date}</span>
                          <button
                            type="button"
                            className="danger"
                            aria-label="Supprimer le commentaire"
                            onClick={() => supprimerLigne("commentaires", i, "Supprimer ce commentaire ?")}
                          >
                            ×
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={c.texte}
                          aria-label="Commentaire"
                          onChange={(e) => majLigne("commentaires", i, "texte", e.target.value)}
                        />
                      </div>
                    ))
                )}
              </section>
            </div>
            <PhotosLaterales
              patient={patient}
              scenarios={scenarios}
              onOuvrir={setApercu}
              onAjouter={() => setOnglet("images")}
            />
          </div>
        )}

        {onglet === "patient" && (
          <>
            <QuestionnaireMedical
              questionnaire={patient.questionnaire}
              onImporter={() => setImportQuestionnaire(true)}
            />
            <DonneesOrthofast orthofast={patient.orthofast} />
            <section className="cr-carte">
              <h2>Identité</h2>
              <div className="cr-champs-ligne">
                {champ("nom", "Nom")}
                {champ("prenom", "Prénom")}
                {champ("naissance", "Date de naissance", "date")}
                <label>
                  Sexe
                  <select value={patient.sexe} onChange={(e) => maj({ sexe: e.target.value }, { immediat: true })}>
                    <option value="">—</option>
                    <option value="F">Féminin</option>
                    <option value="M">Masculin</option>
                  </select>
                </label>
                {champ("code", "Code (OrthoFast)")}
                {champ("dossier", "N° de dossier")}
              </div>
            </section>

            <section className="cr-carte">
              <h2>Contact</h2>
              <div className="cr-champs-ligne">
                {champ("portable", "Portable", "tel")}
                {champ("telephone", "Téléphone 1", "tel")}
                {champ("telephone2", "Téléphone 2", "tel")}
                {champ("email", "E-mail", "email")}
              </div>
              <div className="cr-choix cr-bloc">
                <span>E-mails :</span>
                {[
                  [false, "Vouvoiement"],
                  [true, "Tutoiement"],
                ].map(([valeur, libelle]) => (
                  <label key={libelle} className="cr-case">
                    <input
                      type="radio"
                      name="tutoiement"
                      checked={patient.tutoiement === valeur}
                      onChange={() => maj({ tutoiement: valeur }, { immediat: true })}
                    />
                    {libelle}
                  </label>
                ))}
              </div>
            </section>

            <section className="cr-carte">
              <h2>Correspondants</h2>
              <div className="cr-champs-ligne">
                {champ("orthodontiste", "Orthodontiste")}
                {champ("envoyePar", "Envoyé par")}
                {champ("dentiste", "Dentiste")}
                {champ("autreCorrespondant", "Autre correspondant")}
              </div>
            </section>

            <section className="cr-carte">
              <h2>Administratif</h2>
              <div className="cr-choix">
                <span>Sécurité sociale :</span>
                {[
                  [true, "Oui"],
                  [false, "Non"],
                ].map(([valeur, libelle]) => (
                  <label key={libelle} className="cr-case">
                    <input
                      type="radio"
                      name="secu"
                      checked={patient.securiteSociale === valeur}
                      onChange={() => maj({ securiteSociale: valeur }, { immediat: true })}
                    />
                    {libelle}
                  </label>
                ))}
              </div>
              <div className="cr-champs-ligne cr-bloc">
                {champ("miseEnAttente", "Mise en attente")}
                {champ("debut", "Début du traitement", "date")}
              </div>
              <label className="cr-bloc">
                Commentaires administratifs
                <textarea
                  rows={3}
                  value={patient.notesAdministratives}
                  onChange={(e) => maj({ notesAdministratives: e.target.value })}
                />
              </label>
              <p className="cr-aide">Dossier créé le {formaterDate(patient.creeLe.slice(0, 10))}.</p>
            </section>
          </>
        )}

        {onglet === "gestion" && (
          <GestionTraitement
            patient={patient}
            maj={maj}
            majGestion={majGestion}
            cabinet={cabinetPatient}
            datePremiere={datePremiere}
            onImprimer={imprimerDocument}
          />
        )}

        {onglet === "suivi" && (
          <SuiviTraitement
            patient={patient}
            majGestion={majGestion}
            cabinet={cabinetPatient}
            catalogue={appareils}
            onImprimer={imprimerDocument}
          />
        )}

        {onglet === "images" && (
          <>
            <SeriesImages
              patient={patient}
              scenarios={scenarios}
              televerser={async (fichier) => {
                const media = await envoyerFichier(patientId, fichier);
                definir({ ...dernier.current, medias: [...dernier.current.medias, media] });
                return media;
              }}
              supprimerMedia={async (id) => {
                await appelApi("/patients/media/supprimer", { patient: patientId, id });
                definir({ ...dernier.current, medias: dernier.current.medias.filter((m) => m.id !== id) });
              }}
              changerSeries={(series, serie) => {
                const scenario = serie && scenarios.find((x) => x.id === serie.scenario);
                maj(
                  {
                    series,
                    // Noté dans la séance du jour : « Bilan initial : 12 photos ».
                    ...(scenario
                      ? { seances: noterLigne(dernier.current.seances, `${serie.nom} : `, ligneSuivi(serie, scenario)) }
                      : {}),
                  },
                  { immediat: true },
                );
              }}
              onImprimer={(serie) => {
                flushSync(() => setPlancheImprimee(serie));
                window.print();
                setPlancheImprimee(null);
              }}
            />
            <section className="cr-carte">
              <div className="cr-titre-section">
                <h2>Autres images</h2>
                <label className="cr-bouton-fichier">
                  {envoiImages > 0 ? "Envoi…" : "+ Ajouter des images"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      ajouterImages([...e.target.files]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {autresImages.length === 0 ? (
                <p className="cr-aide">
                  Aucune autre image. Toutes les images sont chiffrées sur le serveur du cabinet.
                </p>
              ) : (
                <div className="cr-galerie">
                  {autresImages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="cr-vignette"
                      onClick={() => setImageOuverte(m)}
                      title={m.nom}
                    >
                      <img src={`/api/patients/media/${m.id}`} alt={m.nom} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {imageOuverte && (
          <div
            className="cr-visionneuse"
            role="dialog"
            aria-label={imageOuverte.nom}
            onClick={() => setImageOuverte(null)}
          >
            <img src={`/api/patients/media/${imageOuverte.id}`} alt={imageOuverte.nom} />
            <div className="cr-visionneuse-barre" onClick={(e) => e.stopPropagation()}>
              <span>
                {imageOuverte.nom} · ajoutée le {formaterDate(imageOuverte.ajouteLe.slice(0, 10))}
              </span>
              <button type="button" className="danger" onClick={() => supprimerImage(imageOuverte)}>
                Supprimer
              </button>
              <button type="button" className="secondaire" onClick={() => setImageOuverte(null)}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
      {apercu && (
        <div className="cr-visionneuse" role="dialog" aria-label={apercu.titre} onClick={() => setApercu(null)}>
          <img src={`/api/patients/media/${apercu.media}`} alt={apercu.titre} />
          <div className="cr-visionneuse-barre">
            <span>
              {apercu.titre} · {formaterDate(apercu.date)}
            </span>
            <button type="button" className="secondaire" onClick={() => setApercu(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {plancheImprimee && (
        <PlancheDocument
          serie={plancheImprimee}
          scenario={scenarios.find((x) => x.id === plancheImprimee.scenario)}
          patient={patient}
          cabinet={cabinetPatient}
        />
      )}
      {documentImprime}
      {importQuestionnaire && (
        <ImportQuestionnaire
          cabinet={cabinet}
          patientId={patientId}
          onFermer={() => setImportQuestionnaire(false)}
          onTermine={() => {
            setImportQuestionnaire(false);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {courrierEnvoye !== null && patient.courriers[courrierEnvoye] && (
        <EnvoiMail
          patient={patient}
          cabinet={cabinet}
          {...modeleCourrier(
            patient.courriers[courrierEnvoye],
            () => (
              <CourrierDocument
                courrier={patient.courriers[courrierEnvoye]}
                patient={{ ...patient, date: patient.courriers[courrierEnvoye].date || aujourdhui() }}
                cabinet={cabinetPatient}
                resume={{ diagnostic: lignes(patient.diagnostic), traitement: lignes(patient.plan) }}
              />
            ),
            patient,
          )}
          onFermer={() => setCourrierEnvoye(null)}
          onEnvoye={({ gestion }) => gestion && majGestion({ mails: gestion.mails })}
        />
      )}
      {courrierAImprimer && (
        <CourrierDocument
          courrier={courrierAImprimer}
          patient={{ ...patient, date: courrierAImprimer.date || aujourdhui() }}
          cabinet={cabinetPatient}
          resume={{ diagnostic: lignes(patient.diagnostic), traitement: lignes(patient.plan) }}
        />
      )}
    </>
  );
}
