// Document remis au patient : aperçu à l'écran et seule partie imprimée.

function formaterDate(iso) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

function Ligne({ libelle, valeur }) {
  if (!valeur || !valeur.trim()) return null;
  return (
    <tr>
      <th scope="row">{libelle}</th>
      <td>{valeur}</td>
    </tr>
  );
}

export default function CompteRendu({ rapport, patient, cabinet, appareils }) {
  const { diagnostic: d, plan_traitement: plan } = rapport;
  const encombrement = [d.encombrement && d.encombrement[0].toUpperCase() + d.encombrement.slice(1), d.encombrement_precision]
    .filter(Boolean)
    .join(" – ");
  const appareilsChoisis = plan.appareils.map((id) => appareils.find((a) => a.id === id)).filter(Boolean);
  const nomPatient = [patient.prenom, patient.nom.toUpperCase()].filter(Boolean).join(" ");

  return (
    <article className="cr-document">
      <header className="cr-doc-entete">
        <div>
          {cabinet.praticien && <strong>{cabinet.praticien}</strong>}
          {cabinet.cabinet && <div>{cabinet.cabinet}</div>}
          {cabinet.coordonnees && <div className="cr-doc-coord">{cabinet.coordonnees}</div>}
          {(cabinet.telephone || cabinet.email) && (
            <div className="cr-doc-coord">
              {[cabinet.telephone && `Tél. ${cabinet.telephone}`, cabinet.email].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div className="cr-doc-date">Le {formaterDate(patient.date)}</div>
      </header>

      <h1>Compte rendu de première consultation orthodontique</h1>
      {(nomPatient || patient.naissance) && (
        <p className="cr-doc-patient">
          Patient : <strong>{nomPatient}</strong>
          {patient.naissance && <> — né(e) le {formaterDate(patient.naissance)}</>}
        </p>
      )}

      {rapport.motif && (
        <section>
          <h2>Motif de consultation</h2>
          <p>{rapport.motif}</p>
        </section>
      )}

      <section>
        <h2>Diagnostic</h2>
        <table className="cr-doc-table">
          <tbody>
            <Ligne libelle="Formule dentaire" valeur={d.formule_dentaire} />
            <Ligne libelle="Sens transversal" valeur={d.sens_transversal} />
            <Ligne libelle="Sens vertical" valeur={d.sens_vertical} />
            <Ligne libelle="Sens antéro-postérieur" valeur={d.sens_antero_posterieur} />
            <Ligne libelle="Malpositions" valeur={d.malpositions} />
            <Ligne libelle="Encombrement" valeur={encombrement} />
            <Ligne libelle="Classe squelettique" valeur={d.classe_squelettique} />
            <Ligne libelle="Radiographie panoramique" valeur={d.panoramique} />
          </tbody>
        </table>
      </section>

      {(plan.resume || appareilsChoisis.length > 0) && (
        <section>
          <h2>Plan de traitement proposé</h2>
          {plan.resume && <p>{plan.resume}</p>}
          {plan.duree_estimee && (
            <p>
              <strong>Durée estimée :</strong> {plan.duree_estimee}
            </p>
          )}
          {appareilsChoisis.map((a) => (
            <div key={a.id} className="cr-doc-appareil">
              <h3>{a.nom}</h3>
              <p>{a.texte}</p>
            </div>
          ))}
        </section>
      )}

      {cabinet.praticien && <p className="cr-doc-signature">{cabinet.praticien}</p>}
    </article>
  );
}
