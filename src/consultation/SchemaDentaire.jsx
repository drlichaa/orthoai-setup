import { useEffect, useState } from "react";
import { ARCADES_PERMANENTES, ARCADES_TEMPORAIRES, ETATS } from "./dents.js";

// Schéma dentaire en numérotation FDI. Clic (ou clic droit) sur une dent :
// menu pour noter agénésie, dent à extraire, extraite, incluse, ou un
// recollage de bague (noté en rouge dans la séance du jour).

function Dent({ numero, etats, recollee, onMenu }) {
  const classes = ["cr-dent", ...etats.map((e) => `cr-dent-${e}`), recollee ? "cr-dent-recollee" : ""];
  const titre = [numero, ...ETATS.filter(([cle]) => etats.includes(cle)).map(([, libelle]) => libelle)].join(" · ");
  const ouvrir = (e) => {
    e.preventDefault();
    onMenu(numero, e.clientX, e.clientY);
  };
  return (
    <button type="button" className={classes.join(" ")} title={titre} onClick={ouvrir} onContextMenu={ouvrir}>
      {numero}
      {etats.includes("agenesie") && <span className="cr-dent-marque">A</span>}
      {etats.includes("aExtraire") && <span className="cr-dent-marque">✕</span>}
    </button>
  );
}

function Arcade({ lignes, dents, recollages, onMenu, petite }) {
  return lignes.map((ligne, i) => (
    <div key={i} className={petite ? "cr-arcade cr-arcade-temporaire" : "cr-arcade"}>
      {ligne.map((cote, j) => (
        <div key={j} className="cr-quadrant">
          {cote.map((n) => (
            <Dent key={n} numero={n} etats={dents[n] || []} recollee={recollages.includes(n)} onMenu={onMenu} />
          ))}
        </div>
      ))}
    </div>
  ));
}

export default function SchemaDentaire({ dents, temporaires, recollagesDuJour, onChange, onRecollage, onTemporaires }) {
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (!menu) return undefined;
    const fermer = () => setMenu(null);
    const touche = (e) => e.key === "Escape" && fermer();
    window.addEventListener("click", fermer);
    window.addEventListener("scroll", fermer, true);
    window.addEventListener("keydown", touche);
    return () => {
      window.removeEventListener("click", fermer);
      window.removeEventListener("scroll", fermer, true);
      window.removeEventListener("keydown", touche);
    };
  }, [menu]);

  function ouvrirMenu(numero, x, y) {
    // Le menu reste dans la fenêtre.
    setMenu({ numero, x: Math.min(x, window.innerWidth - 240), y: Math.min(y, window.innerHeight - 260) });
  }

  function basculer(numero, etat) {
    const actuels = dents[numero] || [];
    const suivants = actuels.includes(etat) ? actuels.filter((e) => e !== etat) : [...actuels, etat];
    const copie = { ...dents };
    if (suivants.length) copie[numero] = suivants;
    else delete copie[numero];
    onChange(copie);
    setMenu(null);
  }

  const etatsMenu = menu ? dents[menu.numero] || [] : [];

  return (
    <div className="cr-schema">
      <div className="cr-schema-machoire">
        {temporaires && (
          <Arcade
            lignes={[ARCADES_TEMPORAIRES[0]]}
            dents={dents}
            recollages={recollagesDuJour}
            onMenu={ouvrirMenu}
            petite
          />
        )}
        <Arcade lignes={ARCADES_PERMANENTES} dents={dents} recollages={recollagesDuJour} onMenu={ouvrirMenu} />
        {temporaires && (
          <Arcade
            lignes={[ARCADES_TEMPORAIRES[1]]}
            dents={dents}
            recollages={recollagesDuJour}
            onMenu={ouvrirMenu}
            petite
          />
        )}
      </div>
      <div className="cr-schema-pied">
        <label className="cr-case">
          <input type="checkbox" checked={temporaires} onChange={(e) => onTemporaires(e.target.checked)} />
          Dents temporaires
        </label>
        <span className="cr-legende">
          <span className="cr-dent cr-dent-agenesie cr-legende-dent">A</span> agénésie
          <span className="cr-dent cr-dent-aExtraire cr-legende-dent">✕</span> à extraire
          <span className="cr-dent cr-dent-extraite cr-legende-dent" /> extraite
          <span className="cr-dent cr-dent-incluse cr-legende-dent" /> incluse
          <span className="cr-dent cr-dent-recollee cr-legende-dent" /> recollée aujourd'hui
        </span>
      </div>

      {menu && (
        <div
          className="cr-menu-dent"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cr-menu-titre">Dent {menu.numero}</div>
          {ETATS.map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="menuitemcheckbox"
              aria-checked={etatsMenu.includes(cle)}
              onClick={() => basculer(menu.numero, cle)}
            >
              <span className="cr-menu-coche">{etatsMenu.includes(cle) ? "✓" : ""}</span>
              {libelle}
            </button>
          ))}
          <hr />
          <button
            type="button"
            role="menuitem"
            className="cr-menu-rouge"
            onClick={() => {
              onRecollage(menu.numero);
              setMenu(null);
            }}
          >
            <span className="cr-menu-coche">{recollagesDuJour.includes(menu.numero) ? "✓" : ""}</span>
            Recollage de bague
          </button>
        </div>
      )}
    </div>
  );
}
