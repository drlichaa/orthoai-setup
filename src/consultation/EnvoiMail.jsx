// Fenêtre d'envoi d'un e-mail depuis le dossier : destinataire, modèle d'objet et
// de message, documents joints (PDF générés par le serveur) et fichiers ajoutés.
import { useEffect, useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { cabinetPour, nomLieu } from "./lieux.js";
import { documentHtml, fichierEnBase64, remplirModele } from "./messagerie.js";

const MO = 1024 * 1024;

export default function EnvoiMail({
  patient,
  destinataire,
  cabinet,
  categorie,
  modeleInitial,
  documents = [],
  // Fichiers joints d'office : [{ nom, type, base64, taille }].
  pieces = [],
  devisId,
  onFermer,
  onEnvoye,
}) {
  const [reglages, setReglages] = useState(null);
  const [erreurReglages, setErreurReglages] = useState("");
  const [mail, setMail] = useState({
    a: destinataire || patient.email || "",
    cc: "",
    objet: "",
    corps: "",
    modele: "",
  });
  const [joints, setJoints] = useState(documents.map((d) => ({ ...d, inclus: true })));
  const [fichiers, setFichiers] = useState(pieces);
  const [etat, setEtat] = useState({ enCours: false, erreur: "", ok: "" });

  const valeurs = {
    prenom: patient.prenom || "",
    nom: patient.nom?.toUpperCase() || "",
    praticien: cabinetPour(cabinet, patient.lieu).praticien || cabinet.praticien || "",
    cabinet: nomLieu(cabinet, patient.lieu) || cabinet.cabinet || "",
    date: new Date().toLocaleDateString("fr-FR"),
  };

  function appliquer(modele, r = reglages) {
    if (!modele) return setMail((m) => ({ ...m, modele: "" }));
    const v = { ...valeurs, lienRdv: r?.liensRdv?.[patient.lieu] || Object.values(r?.liensRdv || {})[0] || "" };
    setMail((m) => ({
      ...m,
      modele: modele.id,
      objet: remplirModele(modele.objet, v),
      corps: remplirModele(modele.corps, v),
    }));
  }

  useEffect(() => {
    let actif = true;
    // Écran de consultation : l'adresse du patient est dans son dossier.
    if (!destinataire && !patient.email && patient.id)
      appelApi(`/patients/dossier/${patient.id}`)
        .then(({ patient: p }) => actif && p?.email && setMail((m) => (m.a ? m : { ...m, a: p.email })))
        .catch(() => {});
    appelApi("/patients/messagerie")
      .then(({ messagerie }) => {
        if (!actif) return;
        setReglages(messagerie);
        const modele =
          messagerie.modeles.find((m) => m.id === modeleInitial) ||
          messagerie.modeles.find((m) => m.categorie === categorie);
        if (modele) appliquer(modele, messagerie);
      })
      .catch((err) => actif && setErreurReglages(err.message));
    return () => {
      actif = false;
    };
    // Chargement unique à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ajouterFichiers(e) {
    const liste = [...(e.target.files || [])];
    e.target.value = "";
    for (const f of liste) {
      if (f.size > 20 * MO) {
        setEtat({ ...etat, erreur: `${f.name} est trop lourd (20 Mo au maximum).` });
        continue;
      }
      const base64 = await fichierEnBase64(f);
      setFichiers((l) => [...l, { nom: f.name, type: f.type || "application/octet-stream", base64, taille: f.size }]);
    }
  }

  async function envoyer() {
    setEtat({ enCours: true, erreur: "", ok: "" });
    try {
      const reponse = await appelApi("/patients/messagerie/envoyer", {
        patientId: patient.id,
        devisId,
        a: mail.a,
        cc: mail.cc,
        objet: mail.objet,
        corps: mail.corps,
        documents: joints.filter((d) => d.inclus).map((d) => ({ nom: d.nom, html: documentHtml(d.element) })),
        pieces: fichiers.map(({ nom, type, base64 }) => ({ nom, type, base64 })),
      });
      setEtat({ enCours: false, erreur: "", ok: `Message envoyé à ${mail.a}.` });
      onEnvoye?.(reponse);
    } catch (err) {
      setEtat({ enCours: false, erreur: err.message, ok: "" });
    }
  }

  const configure = reglages?.adresse && reglages?.motDePasseEnregistre;
  const categories = [...new Set((reglages?.modeles || []).map((m) => m.categorie))];
  return (
    <div className="oa-modale-fond" role="dialog" aria-modal="true" aria-label="Envoyer un e-mail">
      <section className="cr-carte oa-modale oa-mail">
        <div className="cr-titre-section">
          <h2>Envoyer un e-mail</h2>
          <button type="button" className="cr-lien" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        {erreurReglages && <p className="cr-alerte">{erreurReglages}</p>}
        {reglages && !configure && (
          <p className="cr-alerte">
            Messagerie non configurée : renseignez l'adresse Gmail et le mot de passe d'application dans Paramètres →
            Messagerie.
          </p>
        )}
        {reglages && (
          <>
            <p className="cr-aide">
              De : {reglages.nom ? `${reglages.nom} <${reglages.adresse}>` : reglages.adresse || "—"}
            </p>
            <div className="cr-champs-ligne">
              <label>
                À
                <input type="email" multiple value={mail.a} onChange={(e) => setMail({ ...mail, a: e.target.value })} />
              </label>
              <label>
                Cc
                <input value={mail.cc} onChange={(e) => setMail({ ...mail, cc: e.target.value })} />
              </label>
            </div>
            <label className="cr-bloc">
              Modèle
              <select
                value={mail.modele}
                onChange={(e) => appliquer(reglages.modeles.find((m) => m.id === e.target.value))}
              >
                <option value="">— Message libre —</option>
                {categories.map((c) => (
                  <optgroup key={c} label={c}>
                    {reglages.modeles
                      .filter((m) => m.categorie === c)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="cr-bloc">
              Objet
              <input value={mail.objet} onChange={(e) => setMail({ ...mail, objet: e.target.value })} />
            </label>
            <label className="cr-bloc">
              Message
              <textarea rows={11} value={mail.corps} onChange={(e) => setMail({ ...mail, corps: e.target.value })} />
            </label>
            {reglages.signature && <pre className="oa-mail-signature">{reglages.signature}</pre>}
            <div className="oa-mail-pieces">
              <b>Documents joints</b>
              {joints.map((d, i) => (
                <label key={d.nom} className="cr-case">
                  <input
                    type="checkbox"
                    checked={d.inclus}
                    onChange={(e) =>
                      setJoints(joints.map((x, j) => (j === i ? { ...x, inclus: e.target.checked } : x)))
                    }
                  />{" "}
                  📄 {d.nom}
                </label>
              ))}
              {fichiers.map((f, i) => (
                <span key={`${f.nom}-${i}`} className="oa-mail-fichier">
                  📎 {f.nom} ({(f.taille / MO).toFixed(2).replace(".", ",")} Mo){" "}
                  <button
                    type="button"
                    className="cr-lien"
                    onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}
                  >
                    Retirer
                  </button>
                </span>
              ))}
              <label className="cr-bouton-fichier">
                + Pièce jointe
                <input type="file" multiple onChange={ajouterFichiers} />
              </label>
            </div>
          </>
        )}
        {etat.erreur && <p className="cr-alerte">{etat.erreur}</p>}
        {etat.ok && <p className="cr-ok">{etat.ok}</p>}
        <div className="cr-actions">
          {etat.ok ? (
            <button type="button" className="principal" onClick={onFermer}>
              Fermer
            </button>
          ) : (
            <>
              <button
                type="button"
                className="principal"
                disabled={!configure || etat.enCours || !mail.a.trim() || !mail.objet.trim()}
                onClick={envoyer}
              >
                {etat.enCours ? "Envoi…" : "Envoyer"}
              </button>
              <button type="button" className="secondaire" onClick={onFermer} disabled={etat.enCours}>
                Annuler
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
