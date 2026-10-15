// Documents imprimés de la gestion : devis conventionnel et DEP (Cerfa 10518*01).
import { DEP_CASES, euros, totauxDevis } from "./gestion.js";
import { formaterDate } from "./format.js";

const montant = (n) => (Number(n) ? euros(n).replace(/\s?€/, "") : "");

export function DevisDocument({ devis, patient, cabinet }) {
  const t = totauxDevis(devis.lignes);
  const hn = devis.regime === "hn";
  const vides = Math.max(0, 9 - devis.lignes.length);
  return (
    <article className="cr-imprime-seul oa-devis">
      <div className="oa-devis-titre">
        DEVIS POUR LES TRAITEMENTS BUCCO-DENTAIRES ET ACTES BUCCO-DENTAIRES FAISANT L'OBJET D'UNE ENTENTE DIRECTE
        <small>(Les soins à tarifs opposables ne sont pas compris dans ce devis)</small>
      </div>
      <p className="oa-devis-centre">
        Ce devis est la propriété du patient ou de son représentant légal. La communication de ce document à un tiers se
        fait sous sa seule responsabilité
      </p>
      <div className="oa-devis-entete">
        <div className="oa-devis-cadre">
          <p>Identification du chirurgien-dentiste traitant</p>
          <p>
            Identifiant du praticien RPPS : <b>{cabinet.identifiant}</b>
          </p>
          <div className="oa-devis-structure">
            <span>Identification de la structure (raison sociale et adresse du cabinet) :</span>
            <span className="oa-devis-adresse">
              {cabinet.praticien}
              {"\n"}
              {cabinet.coordonnees}
            </span>
          </div>
          <p>N° de la structure (AM, FINESS ou SIRET) : {cabinet.finess}</p>
        </div>
        <div>
          <div className="oa-devis-cadre">
            Date du devis : <b>{formaterDate(devis.date)}</b>
            <br />
            Durée de validité : <b>{devis.validiteMois || 6} mois</b>
          </div>
          <div className="oa-devis-cadre">
            Identification du patient
            <br />
            Nom et prénom : <b>{[patient.nom?.toUpperCase(), patient.prenom].filter(Boolean).join(" ")}</b>
            <br />
            Date de naissance : <b>{formaterDate(patient.naissance)}</b>
            <br />
            N° de Sécurité sociale de l'assuré : <b>{patient.gestion?.numeroSecu}</b>
          </div>
        </div>
      </div>
      <div className="oa-devis-entete oa-devis-petit">
        <div>
          A remplir par l'assuré si celui-ci souhaite envoyer ce devis à son organisme complémentaire :
          <br />
          Adresse de l'assuré :<br />
          Tél : {patient.portable || patient.telephone} &nbsp; Adresse mail : {patient.email}
          <br />
          Nom de l'organisme complémentaire : &nbsp;&nbsp;&nbsp;&nbsp; N° de contrat ou d'adhérent :
        </div>
        <div>
          A remplir par le chirurgien-dentiste. Description du traitement proposé :
          <br />
          <b>{devis.description || "Traitement d'orthodontie"}</b>
          <br />
          Dispositions particulières : ☐ oui ☒ non
          <br />
          Nombre de semestres estimés : <b>{devis.semestres}</b>
        </div>
      </div>
      <div className="oa-devis-cadre oa-devis-petit">
        Lieu de fabrication du dispositif médical : ☐ en France ☐ au sein de l'Union Européenne ☐ hors Union Européenne
        (Pays) :<br />A l'issue du traitement, il vous sera remis la déclaration de conformité du dispositif médical.
      </div>
      <p className="oa-devis-centre">Description précise et détaillée des actes</p>
      <table className="oa-devis-table">
        <thead>
          <tr>
            <th>N° dent ou localisation</th>
            <th>Libellé de l'acte ou libellé Orthodontique</th>
            <th>Matériaux utilisés</th>
            <th>Code CCAM ou pour l'orthodontie cotation NGAP</th>
            <th>(A) Prix de vente du dispositif médical sur mesure*</th>
            <th>(B1) Montant des prestations de soins</th>
            <th>(C=A+B1) Montant des honoraires du devis</th>
            <th>(D) Base de remboursement Assurance Maladie Obligatoire ou NR</th>
            <th>Montant remboursé Assurance Maladie Obligatoire</th>
            <th>(E=C-D) Montant non remboursable par l'Assurance Maladie Obligatoire</th>
            <th>Réservé à l'organisme complémentaire</th>
          </tr>
        </thead>
        <tbody>
          {devis.lignes.map((l, i) => (
            <tr key={i}>
              <td />
              <td>{l.libelle}</td>
              <td />
              <td>{l.code}</td>
              <td />
              <td />
              <td className="n">{montant(l.honoraires)}</td>
              <td className="n">{hn ? "NR" : montant(l.base)}</td>
              <td className="n">{hn ? "" : montant(l.rembourse)}</td>
              <td className="n">{montant((Number(l.honoraires) || 0) - (Number(l.rembourse) || 0))}</td>
              <td />
            </tr>
          ))}
          {Array.from({ length: vides }, (_, i) => (
            <tr key={`v${i}`}>
              {Array.from({ length: 11 }, (_, j) => (
                <td key={j}>&nbsp;</td>
              ))}
            </tr>
          ))}
          <tr className="oa-devis-total">
            <td colSpan={6}>*Coût d'élaboration du dispositif &nbsp;&nbsp;&nbsp; Total</td>
            <td className="n">{montant(t.honoraires)}</td>
            <td className="n">{hn ? "" : montant(t.base)}</td>
            <td className="n">{hn ? "" : montant(t.rembourse)}</td>
            <td className="n">{montant(t.reste)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      {devis.notes && <p className="oa-devis-notes">{devis.notes}</p>}
      <div className="oa-devis-pied">
        <p className="oa-devis-mentions">
          Ce devis s'applique à tout traitement pour lequel un dispositif médical sur mesure est nécessaire. Votre
          chirurgien-dentiste vous informera des différentes possibilités de traitement qui vous sont offertes. Si vous
          désirez transmettre ce devis à votre organisme complémentaire, vous pouvez renseigner le pavé correspondant.
          Ce devis vous informe du coût des traitements proposés. Les honoraires (C = A + B1) correspondent à la somme
          de ces montants. Le devis précise le montant restant à votre charge avant remboursement par votre organisme
          complémentaire, si vous en avez un (E).
        </p>
        <div>
          <div className="oa-devis-cadre oa-devis-signature">
            Total des honoraires : <b>{euros(t.honoraires)}</b>
            <br />
            Signature du praticien
            {cabinet.signature && <img src={cabinet.signature} alt="" />}
          </div>
          <div className="oa-devis-cadre oa-devis-signature">
            Le patient ou son représentant légal reconnaît avoir eu la possibilité du choix de son traitement
            <br />
            Date et signature du patient ou du (des) responsable(s) légal (légaux)
          </div>
        </div>
      </div>
    </article>
  );
}

// Texte placé sur le formulaire : coordonnées en pixels de l'image (1100 × 1524).
function Zone({ x, y, l, h = 20, taille = 11, children }) {
  return (
    <div
      className="oa-dep-zone"
      style={{
        left: `${(x / 1100) * 100}%`,
        top: `${(y / 1524) * 100}%`,
        width: `${(l / 1100) * 100}%`,
        height: `${(h / 1524) * 100}%`,
        fontSize: `${taille}px`,
      }}
    >
      {children}
    </div>
  );
}

function Croix({ cle }) {
  const position = DEP_CASES[cle];
  if (!position) return null;
  return (
    <div
      className="oa-dep-croix"
      style={{ left: `${(position[0] / 1100) * 100}%`, top: `${(position[1] / 1524) * 100}%` }}
    >
      ×
    </div>
  );
}

export function DepDocument({ dep, patient, cabinet }) {
  const cases = Object.entries(dep.cases || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (dep.molaire) cases.push(`molaire_${dep.molaire}`);
  if (dep.canine) cases.push(`canine_${dep.canine}`);
  cases.push(dep.nature || "debut", dep.devisRemis === false ? "devis_non" : "devis_oui");
  if (dep.hr) cases.push("HR");
  const identification = [cabinet.praticien, cabinet.coordonnees].filter(Boolean).join("\n");
  const nomPatient = [patient.nom?.toUpperCase(), patient.prenom].filter(Boolean).join(" ");
  const assure = dep.assure || nomPatient;
  return (
    <div className="cr-imprime-seul oa-dep">
      <section className="oa-dep-page">
        <img src="/dep-page1.jpg" alt="" />
        <Zone x={78} y={150} l={460} h={140} taille={12}>
          {identification}
        </Zone>
        <Zone x={808} y={206} l={215} h={18} taille={10}>
          {cabinet.praticien}
        </Zone>
        <Zone x={808} y={246} l={215} h={18} taille={10}>
          {cabinet.identifiant}
        </Zone>
        <Zone x={388} y={412} l={210}>
          {formaterDate(dep.date)}
        </Zone>
        <Zone x={388} y={453} l={210}>
          {formaterDate(dep.debut)}
        </Zone>
        <Zone x={388} y={495} l={210}>
          {dep.cotation}
        </Zone>
        <Zone x={78} y={645} l={460} h={140} taille={12}>
          {identification}
        </Zone>
        <Zone x={808} y={700} l={215} h={18} taille={10}>
          {cabinet.praticien}
        </Zone>
        <Zone x={808} y={740} l={215} h={18} taille={10}>
          {cabinet.identifiant}
        </Zone>
        <Zone x={390} y={804} l={595}>
          {nomPatient}
        </Zone>
        <Zone x={290} y={824} l={110}>
          {formaterDate(patient.naissance)}
        </Zone>
        <Zone x={646} y={824} l={318}>
          {dep.secu}
        </Zone>
        {["suite", "contention"].includes(dep.nature) && (
          <Zone x={636} y={dep.nature === "suite" ? 905 : 927} l={56}>
            {dep.numero}
          </Zone>
        )}
        <Zone x={165} y={1133} l={180} taille={10}>
          {dep.agenesies}
        </Zone>
        <Zone x={536} y={1133} l={180} taille={10}>
          {dep.incluses}
        </Zone>
        <Zone x={845} y={1133} l={180} taille={10}>
          {dep.malpositions}
        </Zone>
        <Zone x={313} y={1195} l={700} taille={10}>
          {dep.facteurs}
        </Zone>
        <Zone x={84} y={1250} l={928} h={66} taille={10}>
          {dep.plan}
        </Zone>
        <Zone x={84} y={1352} l={928} h={44} taille={10}>
          {dep.commentaires}
        </Zone>
        <Zone x={735} y={1426} l={200}>
          {formaterDate(dep.date)}
        </Zone>
        {cabinet.signature && <img className="oa-dep-signature" src={cabinet.signature} alt="" />}
        {cases.map((c) => (
          <Croix key={c} cle={c} />
        ))}
      </section>
      <section className="oa-dep-page">
        <img src="/dep-page2.jpg" alt="" />
        <Zone x={256} y={124} l={235}>
          {dep.secu}
        </Zone>
        <Zone x={204} y={144} l={115}>
          {formaterDate(dep.assureNaissance)}
        </Zone>
        <Zone x={178} y={172} l={350}>
          {assure}
        </Zone>
        <Zone x={178} y={194} l={350} h={60} taille={10}>
          {dep.adresse}
        </Zone>
        <Zone x={846} y={124} l={175} taille={10}>
          {dep.profession}
        </Zone>
        {dep.assure && dep.assure !== nomPatient && (
          <>
            <Zone x={630} y={247} l={390}>
              {patient.nom?.toUpperCase()}
            </Zone>
            <Zone x={630} y={268} l={175}>
              {patient.prenom}
            </Zone>
            <Zone x={932} y={268} l={90} taille={10}>
              {formaterDate(patient.naissance)}
            </Zone>
          </>
        )}
      </section>
    </div>
  );
}
