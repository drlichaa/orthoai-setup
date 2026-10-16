import { useEffect, useRef, useState } from "react";
import { demander } from "./demander.js";

// Annotation d'une radio ou d'une photo : flèches, cercles, trait libre et
// texte, dessinés sur une copie de l'image (l'original n'est pas modifié).

const OUTILS = [
  ["fleche", "↗ Flèche"],
  ["cercle", "◯ Cercle"],
  ["trait", "✎ Trait libre"],
  ["texte", "T Texte"],
];
const COULEURS = { "#e02424": "Rouge", "#f5b800": "Jaune", "#1f6feb": "Bleu", "#ffffff": "Blanc" };
const TAILLE_MAX = 2400;

function dessiner(ctx, forme, epaisseur) {
  ctx.strokeStyle = forme.couleur;
  ctx.fillStyle = forme.couleur;
  ctx.lineWidth = epaisseur;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [a, b] = [forme.points[0], forme.points.at(-1)];
  if (forme.type === "trait") {
    ctx.beginPath();
    forme.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  } else if (forme.type === "cercle") {
    ctx.beginPath();
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (forme.type === "fleche") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const pointe = epaisseur * 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - pointe * Math.cos(angle - 0.45), b.y - pointe * Math.sin(angle - 0.45));
    ctx.lineTo(b.x - pointe * Math.cos(angle + 0.45), b.y - pointe * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (forme.type === "texte") {
    ctx.font = `bold ${epaisseur * 8}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    // Contour sombre pour rester lisible sur une radio claire ou foncée.
    ctx.lineWidth = epaisseur * 1.2;
    ctx.strokeStyle = forme.couleur === "#ffffff" ? "#000000" : "rgba(0,0,0,0.6)";
    ctx.strokeText(forme.texte, a.x, a.y);
    ctx.fillText(forme.texte, a.x, a.y);
  }
}

export default function AnnotationImage({ src, nom, onValider, onAnnuler }) {
  const toile = useRef(null);
  const [image, setImage] = useState(null);
  const [erreur, setErreur] = useState("");
  const [formes, setFormes] = useState([]);
  const [enCours, setEnCours] = useState(null);
  // Tracé en cours, lu à chaque mouvement sans attendre le rendu suivant.
  const trace = useRef(null);
  const tracer = (forme) => {
    trace.current = forme;
    setEnCours(forme);
  };
  const [outil, setOutil] = useState("fleche");
  const [couleur, setCouleur] = useState("#e02424");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setErreur("Image illisible.");
    img.src = src;
  }, [src]);

  const echelle = image ? Math.min(1, TAILLE_MAX / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
  const largeur = image ? Math.round(image.naturalWidth * echelle) : 0;
  const hauteur = image ? Math.round(image.naturalHeight * echelle) : 0;
  const epaisseur = Math.max(3, Math.round(Math.max(largeur, hauteur) / 300));

  useEffect(() => {
    if (!image || !toile.current) return;
    const ctx = toile.current.getContext("2d");
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    for (const forme of enCours ? [...formes, enCours] : formes) dessiner(ctx, forme, epaisseur);
  }, [image, formes, enCours, largeur, hauteur, epaisseur]);

  // Coordonnées dans l'image, quelle que soit la taille d'affichage.
  function point(e) {
    const r = toile.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * largeur, y: ((e.clientY - r.top) / r.height) * hauteur };
  }

  async function appui(e) {
    if (outil === "texte") {
      const ou = point(e);
      const texte = await demander("Texte à afficher sur l'image :");
      if (texte?.trim()) setFormes((f) => [...f, { type: "texte", couleur, texte: texte.trim(), points: [ou] }]);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    tracer({ type: outil, couleur, points: [point(e)] });
  }

  function deplacement(e) {
    const f = trace.current;
    if (!f) return;
    const p = point(e);
    tracer({ ...f, points: f.type === "trait" ? [...f.points, p] : [f.points[0], p] });
  }

  function relachement() {
    const f = trace.current;
    if (!f) return;
    if (f.points.length > 1) setFormes((formes) => [...formes, f]);
    tracer(null);
  }

  async function valider() {
    setEnvoi(true);
    try {
      const blob = await new Promise((resolve) => toile.current.toBlob(resolve, "image/jpeg", 0.92));
      await onValider(new File([blob], `${nom.replace(/\.[^.]+$/, "")} (annotée).jpg`, { type: "image/jpeg" }));
    } catch (err) {
      setErreur(err.message);
      setEnvoi(false);
    }
  }

  return (
    <div className="cr-visionneuse cr-annotation" role="dialog" aria-label="Annoter l'image">
      <div className="cr-annotation-barre">
        {OUTILS.map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            className={outil === cle ? "principal" : "secondaire"}
            onClick={() => setOutil(cle)}
          >
            {libelle}
          </button>
        ))}
        <span className="cr-annotation-couleurs">
          {Object.entries(COULEURS).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              className={couleur === valeur ? "cr-couleur actif" : "cr-couleur"}
              style={{ background: valeur }}
              aria-label={libelle}
              title={libelle}
              onClick={() => setCouleur(valeur)}
            />
          ))}
        </span>
        <button
          type="button"
          className="secondaire"
          disabled={!formes.length}
          onClick={() => setFormes((f) => f.slice(0, -1))}
        >
          ↶ Annuler
        </button>
      </div>
      {erreur && <p className="cr-alerte">{erreur}</p>}
      {image && (
        <canvas
          ref={toile}
          width={largeur}
          height={hauteur}
          className="cr-annotation-toile"
          onPointerDown={appui}
          onPointerMove={deplacement}
          onPointerUp={relachement}
          onPointerCancel={relachement}
        />
      )}
      <div className="cr-annotation-barre">
        <button type="button" className="secondaire" onClick={onAnnuler} disabled={envoi}>
          Fermer sans joindre
        </button>
        <button type="button" className="principal" onClick={valider} disabled={!image || envoi}>
          {envoi ? "Enregistrement…" : "Joindre au courrier"}
        </button>
      </div>
    </div>
  );
}
