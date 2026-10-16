// Fenêtre « Fiche de recommandations » : fiches illustrées du cabinet (« On vient de te
// poser… ») de l'appareil posé, envoyées telles quelles (PNG ou PDF) ou imprimées en pleine
// page ; à défaut de fiche, le texte du catalogue mis en page.
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { FicheRecommandationsDocument } from "./DocumentsGestion.jsx";
import EnvoiMail from "./EnvoiMail.jsx";
import { fichierEnBase64, nomDocument } from "./messagerie.js";
import { imagesPdf } from "./questionnaireWeclever.js";
import { appareilsSuggeres } from "./recommandations.js";

const urlFiche = (id) => `/api/cabinet/fiches/${id}`;

export default function RecommandationsAppareil({
  patient,
  cabinet,
  catalogue,
  libelle,
  onImprimer,
  onEnvoye,
  onFermer,
}) {
  const [fiches, setFiches] = useState(null);
  const disponibles = catalogue.filter((a) => (a.texte || "").trim() || fiches?.[a.id]);
  const [choisis, setChoisis] = useState(() => appareilsSuggeres({ patient, catalogue, libelle }));
  const [envoi, setEnvoi] = useState(null);
  const [etat, setEtat] = useState({ enCours: false, erreur: "" });

  useEffect(() => {
    let actif = true;
    appelApi("/cabinet/fiches")
      .then(({ fiches: f }) => actif && setFiches(f))
      .catch(() => actif && setFiches({}));
    return () => {
      actif = false;
    };
  }, []);

  const appareils = disponibles.filter((a) => choisis.includes(a.id));
  // Fiches illustrées (une seule fois la même fiche, ex. bagues) et appareils sans fiche.
  const illustrees = [];
  const groupes = new Set();
  for (const a of appareils) {
    const f = fiches?.[a.id];
    if (!f) continue;
    if (!groupes.has(f.groupe)) illustrees.push({ ...a, fiche: f });
    groupes.add(f.groupe);
  }
  const sansFiche = appareils.filter((a) => !fiches?.[a.id]);
  const texte = sansFiche.length ? (
    <FicheRecommandationsDocument patient={patient} cabinet={cabinet} appareils={sansFiche} />
  ) : null;
  const nomFichier = (a, ext) =>
    `Recommandations_${a.nom.replace(/\s*\(.*\)/, "").replace(/[^\p{L}\d]+/gu, "_")}.${ext}`;

  async function imprimer() {
    setEtat({ enCours: true, erreur: "" });
    try {
      const pages = [];
      for (const a of illustrees) {
        if (a.fiche.type === "application/pdf") {
          const octets = await (await fetch(urlFiche(a.id))).arrayBuffer();
          pages.push(...(await imagesPdf(octets)));
        } else pages.push(urlFiche(a.id));
      }
      // Attendre le chargement des images avant d'ouvrir l'impression.
      await Promise.all(
        pages.map(
          (src) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = img.onerror = resolve;
              img.src = src;
            }),
        ),
      );
      onImprimer(
        <div className="cr-imprime-seul">
          {pages.map((src, i) => (
            <img key={i} className="oa-fiche-imprimee" src={src} alt="" />
          ))}
          {texte}
        </div>,
      );
      setEtat({ enCours: false, erreur: "" });
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message });
    }
  }

  async function preparerEnvoi() {
    setEtat({ enCours: true, erreur: "" });
    try {
      const pieces = [];
      for (const a of illustrees) {
        const blob = await (await fetch(urlFiche(a.id))).blob();
        const ext = a.fiche.type === "application/pdf" ? "pdf" : a.fiche.type === "image/jpeg" ? "jpg" : "png";
        pieces.push({
          nom: nomFichier(a, ext),
          type: a.fiche.type,
          base64: await fichierEnBase64(blob),
          taille: blob.size,
        });
      }
      setEnvoi({ pieces, documents: texte ? [{ nom: nomDocument(patient, "Recommandations"), element: texte }] : [] });
      setEtat({ enCours: false, erreur: "" });
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message });
    }
  }

  if (envoi)
    return (
      <EnvoiMail
        patient={patient}
        cabinet={cabinet}
        categorie="Courrier"
        modeleInitial="recommandations"
        documents={envoi.documents}
        pieces={envoi.pieces}
        onFermer={onFermer}
        onEnvoye={onEnvoye}
      />
    );
  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="Fiche de recommandations">
      <section className="cr-carte oa-modale oa-reco">
        <div className="cr-titre-section">
          <h2>Fiche de recommandations</h2>
          <button type="button" className="cr-lien" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="cr-aide">
          {libelle ? `Appareil posé : ${libelle}. ` : ""}Cochez les fiches à remettre au patient. Les fiches illustrées
          se remplacent dans Paramètres (catalogue des appareils).
        </p>
        <ul className="oa-reco-liste">
          {disponibles.map((a) => (
            <li key={a.id}>
              <label className="cr-case">
                <input
                  type="checkbox"
                  checked={choisis.includes(a.id)}
                  onChange={(e) =>
                    setChoisis(e.target.checked ? [...choisis, a.id] : choisis.filter((id) => id !== a.id))
                  }
                />{" "}
                {a.nom}
                {fiches?.[a.id] ? " 🖼" : ""}
              </label>
            </li>
          ))}
        </ul>
        {illustrees.length > 0 && (
          <div className="oa-reco-apercus">
            {illustrees.map((a) =>
              a.fiche.type === "application/pdf" ? (
                <span key={a.id} className="oa-reco-pdf">
                  📄 {a.nom} (PDF)
                </span>
              ) : (
                <img key={a.id} src={urlFiche(a.id)} alt={a.nom} />
              ),
            )}
          </div>
        )}
        {sansFiche.length > 0 && (
          <p className="cr-aide">
            Sans fiche illustrée (texte du catalogue) : {sansFiche.map((a) => a.nom).join(", ")}.
          </p>
        )}
        {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
        <div className="cr-actions">
          <button
            type="button"
            className="principal"
            disabled={!appareils.length || etat.enCours}
            onClick={preparerEnvoi}
          >
            Envoyer par e-mail
          </button>
          <button type="button" className="secondaire" disabled={!appareils.length || etat.enCours} onClick={imprimer}>
            Imprimer
          </button>
          <button type="button" className="secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>
    </div>
  );
}
