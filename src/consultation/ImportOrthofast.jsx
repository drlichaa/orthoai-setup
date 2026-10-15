// Import de l'export Excel « liste des patients » d'OrthoFast : le fichier est lu
// dans l'application, puis seules les données utiles sont envoyées au serveur du
// cabinet, qui les enregistre dans le coffre chiffré.
import { useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { formaterDate } from "./format.js";
import { euros } from "./gestion.js";
import { lireExportOrthofast } from "./importOrthofast.js";
import { lieux } from "./lieux.js";

export default function ImportOrthofast({ cabinet, lieuActif, onTermine, onAnnuler }) {
  const [lieu, setLieu] = useState(lieuActif || "");
  const [lus, setLus] = useState(null);
  const [nomFichier, setNomFichier] = useState("");
  const [doublons, setDoublons] = useState(0);
  const [etat, setEtat] = useState({ enCours: false, erreur: "", bilan: null });

  async function lire(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setEtat({ enCours: true, erreur: "", bilan: null });
    setLus(null);
    try {
      const lignes = await lireExportOrthofast(fichier);
      const codes = new Set();
      const patients = lignes.filter((p) => !codes.has(p.code) && codes.add(p.code));
      setDoublons(lignes.length - patients.length);
      setNomFichier(fichier.name);
      setLus(patients);
      setEtat({ enCours: false, erreur: patients.length ? "" : "Aucun patient trouvé dans ce fichier.", bilan: null });
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message, bilan: null });
    }
  }

  async function importer() {
    setEtat({ enCours: true, erreur: "", bilan: null });
    try {
      const bilan = await appelApi("/patients/importer-orthofast", { lieu, patients: lus });
      setEtat({ enCours: false, erreur: "", bilan });
      setLus(null);
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message, bilan: null });
    }
  }

  const nomCabinet = lieux(cabinet).find((l) => l.id === lieu)?.nom;

  return (
    <section className="cr-carte">
      <h2>Importer l'export OrthoFast</h2>
      <p className="cr-aide">
        Dans OrthoFast, exportez la « liste des patients » en Excel, puis choisissez le cabinet concerné. Le fichier est
        lu sur cet ordinateur ; les dossiers sont enregistrés chiffrés sur le serveur du cabinet. Un patient déjà
        présent (même cabinet et même code) est mis à jour sans effacer ce qui a été saisi dans OrthoAI.
      </p>
      <div className="cr-champs-ligne">
        <label>
          Cabinet de cet export
          <select
            value={lieu}
            className={lieu ? undefined : "oa-a-choisir"}
            onChange={(e) => setLieu(e.target.value)}
            disabled={etat.enCours}
          >
            <option value="">À choisir…</option>
            {lieux(cabinet).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="cr-bouton-fichier">
          {etat.enCours && !lus ? "Lecture…" : "Choisir le fichier Excel (.xlsx)"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={lire}
            disabled={etat.enCours}
          />
        </label>
      </div>

      {lus?.length > 0 && (
        <>
          <p>
            <b>{lus.length}</b> patient(s) lus dans « {nomFichier} »
            {doublons > 0 && ` (${doublons} ligne(s) en double écartée(s))`}. Aperçu :
          </p>
          <table className="oa-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Patient</th>
                <th>Naissance</th>
                <th>Traitement</th>
                <th>Prochaine DEP</th>
                <th>Prochain règlement</th>
              </tr>
            </thead>
            <tbody>
              {lus.slice(0, 5).map((p, i) => {
                const prochain = p.reglements.find((r) => /prochain/i.test(r.libelle));
                return (
                  <tr key={`${p.code}-${i}`}>
                    <td>{p.code}</td>
                    <td>{[p.nom.toUpperCase(), p.prenom].join(" ")}</td>
                    <td>{formaterDate(p.naissance)}</td>
                    <td>{p.typeTraitement}</td>
                    <td>{formaterDate(p.prochaineDep)}</td>
                    <td>{prochain ? `${formaterDate(prochain.date)} · ${euros(prochain.montant)}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="cr-actions">
            <button type="button" className="principal" disabled={!lieu || etat.enCours} onClick={importer}>
              {etat.enCours
                ? "Import…"
                : lieu
                  ? `Importer ${lus.length} patient(s) dans « ${nomCabinet} »`
                  : "Choisissez d'abord le cabinet"}
            </button>
          </div>
        </>
      )}

      {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
      {etat.bilan && (
        <p className="cr-ok">
          Import terminé : {etat.bilan.crees} dossier(s) créé(s), {etat.bilan.misAJour} mis à jour
          {etat.bilan.ignores ? `, ${etat.bilan.ignores} ligne(s) ignorée(s) (sans code ou en double)` : ""}.
        </p>
      )}
      <div className="cr-actions">
        <button type="button" className="secondaire" onClick={etat.bilan ? onTermine : onAnnuler}>
          {etat.bilan ? "Voir la liste des patients" : "Fermer"}
        </button>
      </div>
    </section>
  );
}

// Encart du dossier : dernier état lu dans OrthoFast (DEP et règlements).
export function DonneesOrthofast({ orthofast }) {
  if (!orthofast?.importeLe) return null;
  const o = orthofast;
  const ligne = (libelle, valeur) =>
    valeur ? (
      <tr>
        <th>{libelle}</th>
        <td>{valeur}</td>
      </tr>
    ) : null;
  return (
    <section className="cr-carte oa-orthofast">
      <div className="cr-titre-section">
        <h2>OrthoFast</h2>
        <span className="cr-aide">Importé le {formaterDate(o.importeLe.slice(0, 10))}</span>
      </div>
      <table className="oa-table oa-table-fiche">
        <tbody>
          {ligne(
            "Type de traitement",
            [o.typeTraitement, o.depuis && `depuis le ${formaterDate(o.depuis)}`].filter(Boolean).join(" "),
          )}
          {ligne("Début du traitement", formaterDate(o.debutTraitement))}
          {ligne("Mise en attente", formaterDate(o.miseEnAttente))}
          {ligne("Orthodontiste", o.orthodontiste)}
          {ligne("Dernière DEP faite", [formaterDate(o.derniereDep), o.derniereDepDetail].filter(Boolean).join(" · "))}
          {ligne("Prochaine DEP", [formaterDate(o.prochaineDep), o.prochaineDepDetail].filter(Boolean).join(" · "))}
        </tbody>
      </table>
      {o.reglements?.length > 0 && (
        <>
          <h3>Règlements</h3>
          <table className="oa-table">
            <thead>
              <tr>
                <th />
                <th>Date</th>
                <th>Montant</th>
                <th>Reste à payer</th>
                <th>Acte</th>
                <th>Semestre</th>
              </tr>
            </thead>
            <tbody>
              {o.reglements.map((r, i) => (
                <tr key={i}>
                  <td>{r.libelle}</td>
                  <td>{formaterDate(r.date)}</td>
                  <td>{r.montant != null ? euros(r.montant) : ""}</td>
                  <td>{r.reste != null ? euros(r.reste) : ""}</td>
                  <td>{r.acte}</td>
                  <td>{r.semestre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
