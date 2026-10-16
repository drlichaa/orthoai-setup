// Parcours de traitement dans la fiche clinique : consultation → bilan (DEP, devis,
// consentement) → pose (1er semestre) → suivi → dépose et contention.
// La pose est bloquée tant que le bilan n'est pas complet (sauf « Passer outre » motivé).
import { useState } from "react";
import { appelApi } from "./apiHistorique.js";
import { ConsentementDocument, FicheGouttiereDocument } from "./DocumentsGestion.jsx";
import EnvoiMail from "./EnvoiMail.jsx";
import RecommandationsAppareil from "./RecommandationsAppareil.jsx";
import { formaterDate } from "./format.js";
import {
  CONTROLES_CONTENTION,
  ajouterMois,
  aujourdhui,
  consentementEnfant,
  etatParcours,
  euros,
  gestionApresPose,
  libelleContention,
  montantsBilan,
  isoDepuisFr,
} from "./gestion.js";
import { nomLieu } from "./lieux.js";
import { nomDocument, remplirModele } from "./messagerie.js";

function CaseDatee({ libelle, valeur, onChange, children }) {
  return (
    <li className={`oa-parcours-case${valeur ? " fait" : ""}`}>
      <label className="cr-case">
        <input
          type="checkbox"
          checked={Boolean(valeur)}
          onChange={(e) => onChange(e.target.checked ? aujourdhui() : "")}
        />{" "}
        {libelle}
      </label>
      {valeur && <span className="oa-parcours-date">le {formaterDate(valeur)}</span>}
      {children}
    </li>
  );
}

function Auto({ libelle, valeur, aide, children }) {
  return (
    <li className={`oa-parcours-case${valeur ? " fait" : ""}`}>
      <span className="cr-case">
        <span className="oa-parcours-coche" aria-hidden="true">
          {valeur ? "✓" : "○"}
        </span>{" "}
        {libelle}
      </span>
      {valeur ? (
        <span className="oa-parcours-date">le {formaterDate(valeur)}</span>
      ) : (
        aide && <span className="cr-aide">{aide}</span>
      )}
      {children}
    </li>
  );
}

function Etape({ numero, titre, fait, actuelle, children }) {
  return (
    <section className={`oa-parcours-etape${fait ? " fait" : ""}${actuelle ? " actuelle" : ""}`}>
      <div className="oa-parcours-puce">{fait ? "✓" : numero}</div>
      <div className="oa-parcours-contenu">
        <h3>{titre}</h3>
        {children}
      </div>
    </section>
  );
}

// Ligne ajoutée au suivi des séances à la date donnée (séance créée à sa place si besoin).
function noterSeance(seances, iso, ligne) {
  const date = iso.split("-").reverse().join("/");
  const liste = seances || [];
  const index = liste.findIndex((s) => isoDepuisFr(s.date) === iso);
  if (index !== -1) {
    const fait = liste[index].fait || "";
    if (fait.split("\n").includes(ligne)) return liste;
    return liste.map((s, i) => (i === index ? { ...s, fait: fait ? `${fait}\n${ligne}` : ligne } : s));
  }
  const seance = { date, fait: ligne, prochaine: "", recollages: [] };
  const apres = liste.findIndex((s) => (isoDepuisFr(s.date) || "9999") > iso);
  return apres === -1 ? [...liste, seance] : [...liste.slice(0, apres), seance, ...liste.slice(apres)];
}

const demanderDate = (question, defaut) => {
  const reponse = window.prompt(question, (defaut || aujourdhui()).split("-").reverse().join("/"));
  if (reponse === null) return null;
  const iso = isoDepuisFr(reponse.trim());
  if (!iso) window.alert("Date invalide : utilisez JJ/MM/AAAA.");
  return iso || null;
};

export default function Parcours({
  patient,
  maj,
  majGestion,
  cabinet,
  datePremiere,
  onImprimer,
  onOnglet,
  catalogue = [],
}) {
  const g = patient.gestion || {};
  const e = etatParcours(patient, g, datePremiere);
  const enfant = consentementEnfant(patient, datePremiere);
  const [envoi, setEnvoi] = useState(null);
  const [blocage, setBlocage] = useState(null);
  const [motif, setMotif] = useState("");
  const [copie, setCopie] = useState("");
  // Fiche de recommandations, proposée dès la pose validée.
  const [recommandations, setRecommandations] = useState(false);
  const majParcours = (modif) => majGestion({ parcours: { ...(g.parcours || {}), ...modif } });
  const majRdv = (modif) => majParcours({ rdv: { ...(g.parcours?.rdv || {}), ...modif } });
  const devis = (g.devis || []).find((d) => d.valide) || (g.devis || []).at(-1);
  const bilan = devis?.lignes?.filter((l) => /bilan|diagnostic/i.test(l.libelle)) || [];
  const montantBilan = bilan.length
    ? bilan.reduce((t, l) => t + (Number(l.honoraires) || 0), 0)
    : Object.values(montantsBilan(devis?.traitement)).reduce((t, v) => t + v, 0);
  const seances = (patient.seances || [])
    .map((s) => isoDepuisFr(s.date))
    .filter(Boolean)
    .sort();
  const enContention = Boolean(e.depose);

  async function copier(idModele) {
    try {
      const { messagerie } = await appelApi("/patients/messagerie");
      const modele = messagerie.modeles.find((m) => m.id === idModele);
      if (!modele) throw new Error("Modèle introuvable : vérifiez Paramètres → Messagerie.");
      const texte = remplirModele(modele.corps, {
        prenom: patient.prenom || "",
        nom: patient.nom?.toUpperCase() || "",
        praticien: cabinet.praticien || "",
        cabinet: nomLieu(cabinet, patient.lieu) || "",
        lienRdv: messagerie.liensRdv?.[patient.lieu] || "",
        date: new Date().toLocaleDateString("fr-FR"),
      });
      await navigator.clipboard.writeText(texte);
      setCopie(idModele);
      setTimeout(() => setCopie(""), 2500);
    } catch (err) {
      window.alert(err.message);
    }
  }
  const message = (idModele, libelle) => (
    <span className="oa-parcours-message">
      {libelle} :{" "}
      <button type="button" className="cr-lien" onClick={() => copier(idModele)}>
        {copie === idModele ? "Copié ✓" : "Copier"}
      </button>{" "}
      ·{" "}
      <button
        type="button"
        className="cr-lien"
        onClick={() => setEnvoi({ categorie: "Facturation", modeleInitial: idModele, documents: [] })}
      >
        E-mail
      </button>
    </span>
  );

  function poser(date, derogation = null) {
    const appareil = devis?.description || patient.type || "";
    maj(
      {
        statut: "En traitement",
        debut: date,
        seances: noterSeance(patient.seances, date, `Pose de l'appareil${appareil ? ` (${appareil})` : ""}`),
        gestion: { ...g, ...gestionApresPose(g, date, derogation) },
      },
      { immediat: true },
    );
    setBlocage(null);
    setMotif("");
    setRecommandations(true);
  }
  function demanderPose() {
    const date = demanderDate("Date de la pose de l'appareil (JJ/MM/AAAA) :", e.rdv.pose);
    if (!date) return;
    if (e.manquants.length) setBlocage({ date });
    else poser(date);
  }
  function deposer() {
    const date = demanderDate("Date de la dépose de l'appareil (JJ/MM/AAAA) :", e.rdv.depose);
    if (!date) return;
    maj(
      {
        statut: "En contention",
        seances: noterSeance(patient.seances, date, "Dépose de l'appareil, mise en place des contentions"),
        gestion: { ...g, phase: "contention", phaseDepuis: date, parcours: { ...(g.parcours || {}), depose: date } },
      },
      { immediat: true },
    );
  }

  const consentement = <ConsentementDocument patient={patient} cabinet={cabinet} enfant={enfant} />;
  const gouttiere = <FicheGouttiereDocument patient={patient} cabinet={cabinet} depose={e.depose} />;
  const etapeActuelle = !e.bilan ? 2 : !e.pose ? 3 : !e.depose ? 4 : 5;

  return (
    <section className="cr-carte oa-parcours">
      <div className="cr-titre-section">
        <h2>Parcours de traitement</h2>
        <span className={`cr-pastille ${e.secu ? "c-blue" : "c-orange"}`}>
          {e.secu ? "Prise en charge Sécurité sociale" : "Hors nomenclature (pas de DEP)"}
        </span>
      </div>
      {e.alertes.map((a) => (
        <p key={a} className="cr-alerte">
          ⚠ {a}
        </p>
      ))}

      <Etape numero={1} titre="Consultation (1er rendez-vous)" fait={Boolean(datePremiere)}>
        <ul>
          <Auto libelle="Première consultation" valeur={datePremiere} />
          <CaseDatee
            libelle="Radio panoramique et téléradiographie de profil"
            valeur={g.parcours?.radios}
            onChange={(v) => majParcours({ radios: v })}
          />
          <Auto libelle="Devis remis" valeur={(g.devis || [])[0]?.date} aide="Aucun devis">
            <button type="button" className="cr-lien" onClick={() => onOnglet("gestion")}>
              Devis →
            </button>
          </Auto>
        </ul>
      </Etape>

      <Etape
        numero={2}
        titre="Bilan orthodontique (2e rendez-vous)"
        fait={Boolean(e.bilan) && !e.manquants.length}
        actuelle={etapeActuelle === 2}
      >
        <label className="oa-parcours-champ">
          Date du bilan{" "}
          <input type="date" value={e.bilan || ""} onChange={(ev) => majParcours({ bilan: ev.target.value })} />
        </label>
        <ul>
          <CaseDatee
            libelle="12 photos initiales"
            valeur={g.parcours?.photos}
            onChange={(v) => majParcours({ photos: v })}
          />
          <CaseDatee
            libelle="Empreinte optique 3Shape"
            valeur={g.parcours?.empreinte}
            onChange={(v) => majParcours({ empreinte: v })}
          />
          {e.secu ? (
            <Auto libelle="DEP « Début de traitement » remplie et imprimée" valeur={e.depDebut} aide="à faire">
              {!e.depDebut && (
                <button type="button" className="cr-lien" onClick={() => onOnglet("gestion")}>
                  Préparer la DEP →
                </button>
              )}
            </Auto>
          ) : (
            <li className="oa-parcours-case cr-aide">DEP non exigée (hors prise en charge)</li>
          )}
          <Auto libelle="Devis signé" valeur={e.devisSigne} aide="à faire">
            {!e.devisSigne && (
              <button type="button" className="cr-lien" onClick={() => onOnglet("gestion")}>
                Devis →
              </button>
            )}
          </Auto>
          <CaseDatee
            libelle={`Consentement éclairé signé (${enfant ? "enfant" : "adulte"})`}
            valeur={g.parcours?.consentement}
            onChange={(v) => majParcours({ consentement: v })}
          >
            <span className="oa-parcours-message">
              <button type="button" className="cr-lien" onClick={() => onImprimer(consentement)}>
                Imprimer
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="cr-lien"
                onClick={() =>
                  setEnvoi({
                    categorie: "Courrier",
                    modeleInitial: "courrier-patient",
                    documents: [{ nom: nomDocument(patient, "ConsentementEclaire"), element: consentement }],
                  })
                }
              >
                E-mail
              </button>
            </span>
          </CaseDatee>
          <CaseDatee
            libelle={`Bilan facturé (${euros(montantBilan)}${e.secu ? ", TO5 + TO15" : " HN"})`}
            valeur={g.parcours?.bilanFacture}
            onChange={(v) => majParcours({ bilanFacture: v })}
          />
        </ul>
      </Etape>

      <Etape
        numero={3}
        titre="Pose de l'appareil (3e rendez-vous)"
        fait={Boolean(e.pose)}
        actuelle={etapeActuelle === 3}
      >
        {e.pose ? (
          <>
            <p>
              Appareil posé le <b>{formaterDate(e.pose)}</b>
              {e.poseReprise && " (traitement repris, sans contrôle du bilan)"} : le 1er semestre commence ce jour-là.
            </p>
            <div className="cr-actions">
              <button type="button" className="secondaire" onClick={() => setRecommandations(true)}>
                Fiche de recommandations (PDF)
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="oa-parcours-champ">
              RDV de pose{" "}
              <input type="date" value={e.rdv.pose || ""} onChange={(ev) => majRdv({ pose: ev.target.value })} />
            </label>
            {message("facturation-semestre", "Message de facturation (3 jours avant)")}
            {e.manquants.length > 0 && (
              <div className="cr-alerte oa-parcours-bloquant">
                <b>Pose bloquée : il manque</b>
                <ul>
                  {e.manquants.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="cr-actions">
              <button type="button" className="principal" onClick={demanderPose}>
                Pose effectuée : démarrer le 1er semestre
              </button>
            </div>
            {blocage && (
              <div className="oa-parcours-derogation">
                <p>
                  Le bilan n'est pas complet. Pour poser quand même le {formaterDate(blocage.date)}, indiquez le motif
                  (il sera enregistré dans le dossier) :
                </p>
                <textarea rows={2} value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Motif" />
                <div className="cr-actions">
                  <button
                    type="button"
                    className="danger"
                    disabled={!motif.trim()}
                    onClick={() =>
                      poser(blocage.date, { date: aujourdhui(), motif: motif.trim(), manquants: e.manquants })
                    }
                  >
                    Passer outre et poser
                  </button>
                  <button type="button" className="secondaire" onClick={() => setBlocage(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {(g.parcours?.derogations || []).map((d) => (
          <p key={d.date + d.motif} className="cr-aide">
            Pose sans bilan complet (le {formaterDate(d.date)}) — manquait : {d.manquants?.join(", ")}. Motif :{" "}
            {d.motif}
          </p>
        ))}
      </Etape>

      <Etape numero={4} titre="Suivi (toutes les 6 à 8 semaines)" fait={enContention} actuelle={etapeActuelle === 4}>
        {e.pose ? (
          <>
            <p className="cr-aide">
              Dernière séance saisie : {seances.length ? formaterDate(seances.at(-1)) : "aucune"} · semestres facturés
              au début de chaque semestre (frise ci-dessus).
            </p>
            <label className="oa-parcours-champ">
              Prochain RDV de facturation{" "}
              <input
                type="date"
                value={e.rdv.facturation || ""}
                onChange={(ev) => majRdv({ facturation: ev.target.value })}
              />
            </label>
            {message("facturation-semestre", "Message de facturation (3 jours avant)")}
          </>
        ) : (
          <p className="cr-aide">Après la pose.</p>
        )}
      </Etape>

      <Etape
        numero={5}
        titre="Fin de traitement et contention"
        fait={enContention && Boolean(g.parcours?.contentionFacturee)}
        actuelle={etapeActuelle === 5}
      >
        {!e.depose ? (
          e.pose ? (
            <>
              <label className="oa-parcours-champ">
                RDV de dépose{" "}
                <input type="date" value={e.rdv.depose || ""} onChange={(ev) => majRdv({ depose: ev.target.value })} />
              </label>
              {message("depose", "Message de dépose (3 jours avant)")}
              <div className="cr-actions">
                <button type="button" className="secondaire" onClick={deposer}>
                  Dépose effectuée : passer en contention
                </button>
              </div>
            </>
          ) : (
            <p className="cr-aide">En fin de traitement.</p>
          )
        ) : (
          <>
            <p>
              Appareil déposé le <b>{formaterDate(e.depose)}</b>.
            </p>
            <ul>
              <CaseDatee
                libelle={`Contention réglée : ${libelleContention(e.secu, g.semestres?.contention ?? 750)}`}
                valeur={g.parcours?.contentionFacturee}
                onChange={(v) => majParcours({ contentionFacturee: v })}
              />
              <CaseDatee
                libelle="Fil de contention collé en haut"
                valeur={g.parcours?.filHaut}
                onChange={(v) => majParcours({ filHaut: v })}
              />
              <CaseDatee
                libelle="Fil de contention collé en bas"
                valeur={g.parcours?.filBas}
                onChange={(v) => majParcours({ filBas: v })}
              />
              <CaseDatee
                libelle="Empreinte pour la gouttière de nuit"
                valeur={g.parcours?.empreinteGouttiere}
                onChange={(v) => majParcours({ empreinteGouttiere: v })}
              >
                <span className="oa-parcours-message">
                  Fiche « Port de la gouttière » :{" "}
                  <button type="button" className="cr-lien" onClick={() => onImprimer(gouttiere)}>
                    Imprimer
                  </button>{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="cr-lien"
                    onClick={() =>
                      setEnvoi({
                        categorie: "Courrier",
                        modeleInitial: "courrier-patient",
                        documents: [{ nom: nomDocument(patient, "PortGouttiere"), element: gouttiere }],
                      })
                    }
                  >
                    E-mail
                  </button>
                </span>
              </CaseDatee>
              {CONTROLES_CONTENTION.map((m) => (
                <CaseDatee
                  key={m}
                  libelle={`Contrôle de contention à ${m} mois (vers le ${formaterDate(ajouterMois(e.depose, m))})`}
                  valeur={g.parcours?.controles?.[m]}
                  onChange={(v) => majParcours({ controles: { ...(g.parcours?.controles || {}), [m]: v } })}
                />
              ))}
              {e.secu && (
                <CaseDatee
                  libelle={`Carte Vitale passée : télétransmission TO75 (dernière visite, vers le ${formaterDate(ajouterMois(e.depose, 12))})`}
                  valeur={g.parcours?.vitale}
                  onChange={(v) => majParcours({ vitale: v })}
                />
              )}
            </ul>
          </>
        )}
      </Etape>

      {recommandations && (
        <RecommandationsAppareil
          patient={patient}
          cabinet={cabinet}
          catalogue={catalogue}
          onImprimer={onImprimer}
          onEnvoye={({ gestion }) => gestion && majGestion({ mails: gestion.mails })}
          onFermer={() => setRecommandations(false)}
        />
      )}
      {envoi && (
        <EnvoiMail
          patient={patient}
          cabinet={cabinet}
          categorie={envoi.categorie}
          modeleInitial={envoi.modeleInitial}
          documents={envoi.documents}
          onFermer={() => setEnvoi(null)}
          onEnvoye={({ gestion }) => gestion && majGestion({ mails: gestion.mails })}
        />
      )}
    </section>
  );
}
