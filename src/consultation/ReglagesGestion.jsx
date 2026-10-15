// Paramètres → Honoraires (barème des devis) et Automatisations (tâches).
import { lieux } from "./lieux.js";
import { AUTOMATISATIONS, BAREME_PAR_DEFAUT, automatisations, bareme } from "./gestion.js";

const PRIX_SEMESTRE = [
  ["interception", "Semestre d'interception"],
  ["metal", "Semestre bagues métalliques"],
  ["ceramique", "Semestre bagues céramique"],
  ["aligneurs", "Semestre aligneurs"],
];

const ACTES_SECU = [
  ["diagnostic", "Diagnostic"],
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
          <label>
            Diagnostic (€)
            {nombre(b.diagnostic, (v) => majBareme({ diagnostic: v }))}
          </label>
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
