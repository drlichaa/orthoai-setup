import { useEffect, useState } from "react";

// Barre de navigation à gauche, commune à toutes les pages d'OrthoAI.

const TRACES = {
  tableau: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  patients:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  consultation: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0M12 18v3",
  historique: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  segmentation: "M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  parametres:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  sortie: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export function Icone({ nom, taille = 20 }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACES[nom]} />
    </svg>
  );
}

const ENTREES = [
  ["tableau", "Tableau de bord"],
  ["patients", "Patients"],
  ["consultation", "Consultation"],
  ["historique", "Comptes rendus"],
  ["catalogue", "Paramètres", "parametres"],
];

export default function Navigation({ vue, onAller, cabinet }) {
  const [distant, setDistant] = useState(false);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setDistant(Boolean(d.distant)))
      .catch(() => {});
  }, []);

  async function deconnecter() {
    await fetch("/api/session/deconnexion", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  const initiales = (cabinet.praticien || "OrthoAI")
    .replace(/^(Docteur|Dr\.?)\s+/i, "")
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="oa-nav no-print" aria-label="Navigation principale">
      <div className="oa-marque">
        {cabinet.logo ? <img src={cabinet.logo} alt="" /> : <span className="oa-marque-icone">🦷</span>}
        <div>
          <strong>OrthoAI</strong>
          <span>{cabinet.cabinet || "Cabinet d'orthodontie"}</span>
        </div>
      </div>

      <ul className="oa-menu">
        {ENTREES.map(([cle, libelle, icone]) => (
          <li key={cle}>
            <button
              type="button"
              className={vue === cle ? "actif" : undefined}
              aria-current={vue === cle ? "page" : undefined}
              onClick={() => onAller(cle)}
            >
              <Icone nom={icone || cle} />
              {libelle}
            </button>
          </li>
        ))}
        <li className="oa-menu-separateur" />
        <li>
          <a href="/index.html">
            <Icone nom="segmentation" />
            Segmentation 3D
          </a>
        </li>
      </ul>

      <div className="oa-utilisateur">
        <span className="oa-avatar">{initiales}</span>
        <div>
          <strong>{cabinet.praticien || "Praticien"}</strong>
          <span>Orthodontiste</span>
        </div>
        {distant && (
          <button type="button" className="oa-deconnexion" title="Se déconnecter" onClick={deconnecter}>
            <Icone nom="sortie" taille={18} />
          </button>
        )}
      </div>
    </nav>
  );
}
