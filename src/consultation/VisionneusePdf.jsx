// PDF du dossier (déchiffré par le serveur du cabinet) affiché dans l'application :
// l'application n'ouvre pas de nouvelles fenêtres.
import { useEffect, useState } from "react";
import { imagesPdf } from "./questionnaireWeclever.js";

export default function VisionneusePdf({ mediaId, nom = "document.pdf", onFermer }) {
  const [etat, setEtat] = useState({ pages: [], erreur: "", url: "" });
  useEffect(() => {
    let actif = true;
    let url = "";
    (async () => {
      try {
        const rep = await fetch(`/api/patients/media/${mediaId}`);
        if (!rep.ok) throw new Error(rep.status === 423 ? "Dossiers verrouillés." : "PDF introuvable.");
        const blob = await rep.blob();
        url = URL.createObjectURL(blob);
        const pages = await imagesPdf(await blob.arrayBuffer());
        if (actif) setEtat({ pages, erreur: "", url });
      } catch (err) {
        if (actif) setEtat({ pages: [], erreur: err.message, url: "" });
      }
    })();
    return () => {
      actif = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaId]);
  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="PDF">
      <section className="cr-carte oa-modale oa-visionneuse">
        <div className="cr-titre-section">
          <h2>{nom}</h2>
          <div className="cr-actions">
            {etat.url && (
              <a className="secondaire oa-bouton-lien" href={etat.url} download={nom}>
                Enregistrer le PDF
              </a>
            )}
            <button type="button" className="secondaire" onClick={onFermer}>
              Fermer
            </button>
          </div>
        </div>
        {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
        {!etat.erreur && !etat.pages.length && <p className="cr-aide">Ouverture du PDF…</p>}
        <div className="oa-visionneuse-pages">
          {etat.pages.map((src, i) => (
            <img key={i} src={src} alt={`Page ${i + 1}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
