// Onglet « Devis & semestres » du dossier : devis conventionnel ou HN, validation,
// semestres (facturation), DEP sur le Cerfa officiel.
import { DonneesOrthofast } from "./ImportOrthofast.jsx";
import { useState } from "react";
import { DepDocument, DevisDocument } from "./DocumentsGestion.jsx";
import EnvoiMail from "./EnvoiMail.jsx";
import FriseTraitement from "./FriseTraitement.jsx";
import { nomDocument } from "./messagerie.js";
import { formaterDate } from "./format.js";
import {
  DEP_DIAGNOSTIC,
  TRAITEMENTS,
  anneeContention,
  aujourdhui,
  bareme,
  depDepuisDiagnostic,
  facteursFonctionnels,
  planPourDep,
  euros,
  identifiantUnique,
  libelleDep,
  lignesDevis,
  premierDuGroupe,
  regimeParDefaut,
  semestres,
  totauxDevis,
} from "./gestion.js";
import { demander } from "./demander.js";

const PHASES = [
  ["actif", "Traitement actif"],
  ["attente", "Surveillance / attente"],
  ["contention", "Contention"],
  ["suspension", "Suspendu"],
];

function Administratif({ g, majGestion, patient }) {
  const champ = (cle, libelle, type = "text") => (
    <label>
      {libelle}
      <input type={type} value={g[cle] || ""} onChange={(e) => majGestion({ [cle]: e.target.value }, false)} />
    </label>
  );
  return (
    <section className="cr-carte">
      <h2>Assuré et prise en charge</h2>
      <div className="cr-champs-ligne">
        {champ("numeroSecu", "N° de Sécurité sociale de l'assuré")}
        <label>
          Nom et prénom de l'assuré
          <input
            value={g.assure || ""}
            placeholder={[patient.nom?.toUpperCase(), patient.prenom].filter(Boolean).join(" ")}
            onChange={(e) => majGestion({ assure: e.target.value }, false)}
          />
        </label>
        {champ("assureNaissance", "Date de naissance de l'assuré", "date")}
        {champ("profession", "Profession du patient")}
      </div>
      <label className="cr-bloc">
        Adresse de l'assuré
        <textarea rows={2} value={g.adresse || ""} onChange={(e) => majGestion({ adresse: e.target.value }, false)} />
      </label>
    </section>
  );
}

function NouveauDevis({ patient, cabinet, datePremiere, onCree, onAnnuler }) {
  const b = bareme(cabinet);
  const regimeAuto = regimeParDefaut(patient.naissance, datePremiere, b);
  const [choix, setChoix] = useState({
    traitement: "metal",
    semestres: 6,
    regime: regimeAuto,
    diagnostic: false,
    contention: false,
    surveillance: false,
  });
  const [lignes, setLignes] = useState(() => lignesDevis({ ...choix }, b));
  const changer = (modif) => {
    const suivant = { ...choix, ...modif };
    setChoix(suivant);
    setLignes(lignesDevis(suivant, b));
  };
  const t = totauxDevis(lignes);
  const ageTexte =
    patient.naissance && datePremiere
      ? `Patient de ${Math.floor((new Date(datePremiere) - new Date(patient.naissance)) / 31557600000)} ans à la 1ère consultation (${formaterDate(datePremiere)})`
      : "Date de naissance ou de 1ère consultation inconnue";

  return (
    <div className="oa-devis-edition">
      <div className="cr-champs-ligne">
        <label>
          Traitement
          <select value={choix.traitement} onChange={(e) => changer({ traitement: e.target.value })}>
            {TRAITEMENTS.map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        {choix.traitement !== "contention" && (
          <label>
            Nombre de {choix.traitement === "surveillance" ? "surveillances" : "semestres"}
            <input
              type="number"
              min="1"
              max="12"
              value={choix.semestres}
              onChange={(e) => changer({ semestres: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
            />
          </label>
        )}
        <label>
          Prise en charge
          <select value={choix.regime} onChange={(e) => changer({ regime: e.target.value })}>
            <option value="secu">Avec prise en charge Sécurité sociale</option>
            <option value="hn">HN — sans prise en charge</option>
          </select>
        </label>
      </div>
      <p className="cr-aide">
        {ageTexte} → proposé : <b>{regimeAuto === "hn" ? "hors nomenclature" : "prise en charge"}</b> (
        {b.ageHorsNomenclature} ans ou plus = HN).
      </p>
      <div className="cr-filtres">
        {[
          ["diagnostic", "Ajouter le bilan (TO5 + TO15)"],
          ["contention", "Ajouter la contention"],
          ["surveillance", "Ajouter une surveillance"],
        ].map(([cle, libelle]) => (
          <label key={cle} className="cr-case">
            <input type="checkbox" checked={choix[cle]} onChange={(e) => changer({ [cle]: e.target.checked })} />{" "}
            {libelle}
          </label>
        ))}
      </div>
      <table className="oa-table">
        <thead>
          <tr>
            <th>Acte</th>
            <th>Code</th>
            <th>Honoraires</th>
            <th>Base Sécu</th>
            <th>Remboursé</th>
            <th>Reste</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const maj = (champ, valeur) => setLignes(lignes.map((x, j) => (j === i ? { ...x, [champ]: valeur } : x)));
            return (
              <tr key={i}>
                <td>
                  <input value={l.libelle} onChange={(e) => maj("libelle", e.target.value)} />
                </td>
                <td>
                  <input className="oa-court" value={l.code} onChange={(e) => maj("code", e.target.value)} />
                </td>
                <td>
                  <input
                    className="oa-court"
                    type="number"
                    value={l.honoraires}
                    onChange={(e) => maj("honoraires", Number(e.target.value))}
                  />
                </td>
                <td>{choix.regime === "hn" ? "NR" : euros(l.base)}</td>
                <td>{euros(l.rembourse)}</td>
                <td>{euros(l.honoraires - l.rembourse)}</td>
                <td>
                  <button type="button" className="cr-lien" onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="oa-table-total">
            <td colSpan={2}>Total</td>
            <td>{euros(t.honoraires)}</td>
            <td>{choix.regime === "hn" ? "" : euros(t.base)}</td>
            <td>{euros(t.rembourse)}</td>
            <td>{euros(t.reste)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <div className="cr-actions">
        <button
          type="button"
          className="principal"
          disabled={!lignes.length}
          onClick={() =>
            onCree({
              id: identifiantUnique(),
              date: aujourdhui(),
              numero: `D-${aujourdhui().slice(0, 4)}-${identifiantUnique().slice(-4).toUpperCase()}`,
              traitement: choix.traitement,
              description: TRAITEMENTS.find(([c]) => c === choix.traitement)?.[1],
              semestres: choix.traitement === "contention" ? 0 : choix.semestres,
              regime: choix.regime,
              validiteMois: b.validiteMois,
              lignes,
            })
          }
        >
          Créer le devis
        </button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function Devis({ patient, g, majGestion, maj, cabinet, datePremiere, onImprimer }) {
  const [creation, setCreation] = useState(false);
  const [envoi, setEnvoi] = useState(null);
  const liste = g.devis || [];

  // Devis signé : noté pour le bilan ; les semestres démarrent à la pose (Fiche clinique → Parcours).
  async function valider(devis) {
    const iso = await demander("Date de signature du devis :", { type: "date", defaut: aujourdhui() });
    if (!iso) return;
    majGestion({ devis: liste.map((d) => ({ ...d, valide: d.id === devis.id ? iso : "" })) });
  }

  const MODELE_PAR_TRAITEMENT = { metal: "devis-metal", ceramique: "devis-ceramique", aligneurs: "devis-gouttieres" };

  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Devis</h2>
        {!creation && (
          <button type="button" className="principal" onClick={() => setCreation(true)}>
            + Nouveau devis
          </button>
        )}
      </div>
      {creation && (
        <NouveauDevis
          patient={patient}
          cabinet={cabinet}
          datePremiere={datePremiere}
          onAnnuler={() => setCreation(false)}
          onCree={(devis) => {
            setCreation(false);
            majGestion({ devis: [...liste, devis] });
            if (/première|devis/i.test(patient.statut || "") || !patient.statut) maj({ statut: "Devis envoyé" });
          }}
        />
      )}
      {liste.length === 0 && !creation ? (
        <p className="cr-aide">Aucun devis. Le barème se règle dans Paramètres → Honoraires.</p>
      ) : (
        <ul className="oa-liste-devis">
          {[...liste].reverse().map((d) => {
            const t = totauxDevis(d.lignes);
            return (
              <li key={d.id}>
                <div>
                  <strong>
                    {d.description} · {d.semestres ? `${d.semestres} semestre(s)` : ""}
                  </strong>
                  <small>
                    {d.numero} du {formaterDate(d.date)} · {euros(t.honoraires)} ·{" "}
                    <span className={d.regime === "hn" ? "cr-pastille c-orange" : "cr-pastille c-blue"}>
                      {d.regime === "hn" ? "HN" : "Sécu"}
                    </span>
                    {d.envoye && ` · envoyé le ${formaterDate(d.envoye)}`}
                    {d.valide && <b> · ✓ validé le {formaterDate(d.valide)}</b>}
                  </small>
                </div>
                <div className="cr-actions">
                  <button
                    type="button"
                    className="secondaire"
                    onClick={() => onImprimer(<DevisDocument devis={d} patient={patient} cabinet={cabinet} />)}
                  >
                    Imprimer / PDF
                  </button>
                  <button type="button" className="secondaire" onClick={() => setEnvoi(d)}>
                    E-mail
                  </button>
                  {!d.valide && (
                    <button type="button" className="principal" onClick={() => valider(d)}>
                      Devis signé
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      window.confirm(`Supprimer le devis ${d.numero} ?`) &&
                      majGestion({ devis: liste.filter((x) => x.id !== d.id) })
                    }
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {envoi && (
        <EnvoiMail
          patient={patient}
          cabinet={cabinet}
          categorie="Devis"
          modeleInitial={MODELE_PAR_TRAITEMENT[envoi.traitement]}
          devisId={envoi.id}
          documents={[
            {
              nom: nomDocument(patient, "DevisConventionnel"),
              element: <DevisDocument devis={envoi} patient={patient} cabinet={cabinet} />,
            },
          ]}
          onFermer={() => setEnvoi(null)}
          onEnvoye={({ gestion }) => gestion && majGestion({ devis: gestion.devis, mails: gestion.mails })}
        />
      )}
    </section>
  );
}

function Semestres({ patient, g, majGestion }) {
  const liste = semestres(g);
  const auj = aujourdhui();
  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Semestres</h2>
        <label className="cr-champ-court">
          Phase{" "}
          <select
            value={g.phase || "actif"}
            onChange={(e) => majGestion({ phase: e.target.value, phaseDepuis: aujourdhui() })}
          >
            {PHASES.map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!g.semestres?.debut ? (
        <p className="cr-aide">
          Les semestres démarrent le jour de la pose de l'appareil : Fiche clinique → Parcours de traitement → « Pose
          effectuée ».
        </p>
      ) : (
        <>
          <FriseTraitement patient={patient} gestion={g} />
          {liste.some((s) => s.aVerifier) && (
            <p className="cr-aide">
              Semestres repris d'OrthoFast : cochez « Facturé » pour ceux déjà facturés. Les semestres « à vérifier » ne
              créent pas de tâche.
            </p>
          )}
          <table className="oa-table">
            <thead>
              <tr>
                <th>Semestre</th>
                <th>Période</th>
                <th>Montant</th>
                <th>Facturé</th>
                <th>DEP</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((s) => (
                <tr key={s.numero}>
                  <td>S{s.numero}</td>
                  <td>
                    {formaterDate(s.debut)} → {formaterDate(s.fin)}
                  </td>
                  <td>{s.montant != null ? euros(s.montant) : "—"}</td>
                  <td>
                    <label className="cr-case">
                      <input
                        type="checkbox"
                        checked={Boolean(s.facture)}
                        onChange={(e) =>
                          majGestion({
                            semestres: {
                              ...g.semestres,
                              factures: {
                                ...(g.semestres.factures || {}),
                                [s.numero]: e.target.checked ? aujourdhui() : "",
                              },
                            },
                          })
                        }
                      />{" "}
                      {s.facture ? `le ${formaterDate(s.facture)}` : s.debut <= auj ? "à facturer" : ""}
                    </label>
                  </td>
                  <td>{s.dep ? "✓" : s.debut <= auj ? "à faire" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cr-aide">
            Début du traitement : {formaterDate(g.semestres.debut)}.{" "}
            <button
              type="button"
              className="cr-lien"
              onClick={async () => {
                const n = await demander("Nombre de semestres prévus :", {
                  type: "number",
                  defaut: g.semestres.nombre,
                });
                if (n && Number(n) > 0)
                  majGestion({ semestres: { ...g.semestres, nombre: Math.min(20, Math.round(Number(n))) } });
              }}
            >
              Modifier le nombre de semestres
            </button>
          </p>
        </>
      )}
    </section>
  );
}

function brouillonDep(patient, g) {
  // Prochaine DEP : premier groupe de deux semestres non couvert, sinon l'année de contention.
  const liste = semestres(g);
  const prochain = liste.find((s) => !s.dep);
  const contention = !prochain && liste.length > 0 ? anneeContention(g) : null;
  const numero = prochain ? premierDuGroupe(prochain.numero) : 1;
  const debutGroupe = liste.find((s) => s.numero === numero)?.debut;
  // Première DEP : pré-remplie depuis le diagnostic du dossier ; ensuite, reprise de la précédente.
  const lu = depDepuisDiagnostic([patient.diagnostic, patient.plan].filter(Boolean).join("\n"));
  const parcours = g.parcours || {};
  return {
    // Date de la proposition : jour du bilan s'il est noté.
    date: (!liste.length && parcours.bilan) || aujourdhui(),
    nature: contention ? "contention" : numero > 1 ? "suite" : "debut",
    numero: String(numero),
    debut: contention?.debut || debutGroupe || parcours.rdv?.pose || "",
    cotation: contention ? "TO75" : "TO90",
    devisRemis: true,
    secu: g.numeroSecu || "",
    assure: g.assure || "",
    assureNaissance: g.assureNaissance || "",
    adresse: g.adresse || "",
    profession: g.profession || "",
    agenesies: patient.agenesies || "",
    incluses: lu.incluses,
    malpositions: lu.malpositions,
    facteurs: facteursFonctionnels(patient),
    plan: planPourDep(patient.plan),
    commentaires: "",
    cases: g.depDernier?.cases || lu.cases,
    molaire: g.depDernier?.molaire || lu.molaire,
    canine: g.depDernier?.canine || lu.canine,
  };
}

function Dep({ patient, g, majGestion, cabinet, onImprimer }) {
  const [dep, setDep] = useState(null);
  const champ = (cle, libelle, type = "text") => (
    <label>
      {libelle}
      <input type={type} value={dep[cle] || ""} onChange={(e) => setDep({ ...dep, [cle]: e.target.value })} />
    </label>
  );

  function editer() {
    const enregistree = {
      ...dep,
      id: identifiantUnique(),
      semestre: dep.nature === "suite" || dep.nature === "debut" ? Number(dep.numero) || 1 : "",
    };
    const document = <DepDocument dep={enregistree} patient={patient} cabinet={cabinet} />;
    onImprimer(document);
    majGestion({
      deps: [...(g.deps || []), enregistree],
      depDernier: { cases: dep.cases, molaire: dep.molaire, canine: dep.canine },
      numeroSecu: g.numeroSecu || dep.secu,
    });
    setDep(null);
  }

  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Demandes d'entente préalable (DEP)</h2>
        {!dep && (
          <button type="button" className="principal" onClick={() => setDep(brouillonDep(patient, g))}>
            + Préparer une DEP
          </button>
        )}
      </div>
      {dep && (
        <div className="oa-devis-edition">
          <div className="cr-champs-ligne">
            <label>
              Nature
              <select
                value={dep.nature}
                onChange={(e) =>
                  setDep({
                    ...dep,
                    nature: e.target.value,
                    cotation: { contention: "TO75", surveillance: "TO10" }[e.target.value] || "TO90",
                  })
                }
              >
                <option value="debut">Début de traitement (semestres 1 et 2)</option>
                <option value="suite">Suite — semestres n° (3 = S3-S4, 5 = S5-S6…)</option>
                <option value="surveillance">Surveillance</option>
                <option value="contention">Contention — année n°</option>
              </select>
            </label>
            {["suite", "contention"].includes(dep.nature) && champ("numero", "N°")}
            {champ("date", "Date de la proposition", "date")}
            {champ("debut", "Début effectif du traitement", "date")}
            {champ("cotation", "Cotation des actes")}
            {champ("secu", "N° d'immatriculation de l'assuré")}
          </div>
          <div className="cr-champs-ligne">
            {champ("assure", "Assuré (si différent du patient)")}
            {champ("assureNaissance", "Naissance de l'assuré", "date")}
            {champ("profession", "Profession du patient")}
            <label className="cr-case">
              <input
                type="checkbox"
                checked={dep.devisRemis !== false}
                onChange={(e) => setDep({ ...dep, devisRemis: e.target.checked })}
              />{" "}
              Devis remis à l'assuré
            </label>
          </div>
          <h3>Diagnostic</h3>
          <div className="oa-dep-diagnostic">
            {DEP_DIAGNOSTIC.map(([titre, cases]) => (
              <fieldset key={titre}>
                <legend>{titre}</legend>
                {cases.map(([cle, libelle]) => (
                  <label key={cle} className="cr-case">
                    <input
                      type="checkbox"
                      checked={Boolean(dep.cases?.[cle])}
                      onChange={(e) => setDep({ ...dep, cases: { ...dep.cases, [cle]: e.target.checked } })}
                    />{" "}
                    {libelle}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="cr-champs-ligne">
            {["molaire", "canine"].map((cle) => (
              <label key={cle}>
                Classe {cle}
                <select value={dep[cle]} onChange={(e) => setDep({ ...dep, [cle]: e.target.value })}>
                  <option value="">—</option>
                  <option value="I">Classe I</option>
                  <option value="II">Classe II</option>
                  <option value="III">Classe III</option>
                </select>
              </label>
            ))}
            {champ("agenesies", "Agénésie(s)")}
            {champ("incluses", "Dent(s) incl. ou surnum.")}
            {champ("malpositions", "Malposition(s)")}
          </div>
          {champ("facteurs", "Facteur(s) fonctionnel(s)")}
          <label className="cr-bloc">
            Plan de traitement
            <textarea rows={3} value={dep.plan} onChange={(e) => setDep({ ...dep, plan: e.target.value })} />
          </label>
          {champ("commentaires", "Commentaires")}
          <div className="cr-actions">
            <button type="button" className="principal" onClick={editer}>
              Éditer et imprimer la DEP
            </button>
            <button type="button" className="secondaire" onClick={() => setDep(null)}>
              Annuler
            </button>
          </div>
          <p className="cr-aide">
            Impression sur le Cerfa 10518*01 (2 pages A4, à 100 %, sans marges). Vérifiez l'aperçu, puis signez.
          </p>
        </div>
      )}
      {(g.deps || []).length > 0 && (
        <table className="oa-table">
          <thead>
            <tr>
              <th>Édition</th>
              <th>Nature</th>
              <th>Début</th>
              <th>Envoyée</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...g.deps].reverse().map((d) => (
              <tr key={d.id}>
                <td>{formaterDate(d.date)}</td>
                <td>{d.nature === "debut" ? "Début de traitement (semestres 1 et 2)" : libelleDep(d)}</td>
                <td>{formaterDate(d.debut)}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(d.envoyee)}
                    onChange={(e) =>
                      majGestion({
                        deps: g.deps.map((x) =>
                          x.id === d.id ? { ...x, envoyee: e.target.checked ? aujourdhui() : "" } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="cr-lien"
                    onClick={() => onImprimer(<DepDocument dep={d} patient={patient} cabinet={cabinet} />)}
                  >
                    Réimprimer
                  </button>{" "}
                  <button
                    type="button"
                    className="cr-lien"
                    onClick={() =>
                      window.confirm("Supprimer cette DEP de l'historique ?") &&
                      majGestion({ deps: g.deps.filter((x) => x.id !== d.id) })
                    }
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function GestionTraitement({ patient, maj, majGestion, cabinet, datePremiere, onImprimer }) {
  const g = patient.gestion || {};
  return (
    <>
      <Devis {...{ patient, g, majGestion, maj, cabinet, datePremiere, onImprimer }} />
      <Semestres patient={patient} g={g} majGestion={majGestion} />
      <DonneesOrthofast orthofast={patient.orthofast} />
      <Dep {...{ patient, g, majGestion, cabinet, onImprimer }} />
      <Administratif g={g} majGestion={majGestion} patient={patient} />
    </>
  );
}
