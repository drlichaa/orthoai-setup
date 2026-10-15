// Mini-frise des semestres (liste des patients) ; la grande frise est FriseTraitement.
// Frise des semestres d'un traitement : facturés, à facturer, en cours, à venir,
// à vérifier (semestres passés repris d'OrthoFast). Point vert : DEP imprimée,
// pour les traitements pris en charge par la Sécurité sociale.
import { aujourdhui, priseEnChargeSecu, semestres } from "./gestion.js";
import { formaterDate } from "./format.js";

function etat(s, auj) {
  if (s.facture) return ["fait", "Facturé"];
  const enCours = s.debut <= auj && auj < s.fin;
  if (enCours) return s.aVerifier ? ["encours verifier", "En cours · à vérifier"] : ["encours", "En cours"];
  if (s.aVerifier) return ["verifier", "À vérifier"];
  if (s.debut <= auj) return ["du", "À facturer"];
  return ["avenir", "À venir"];
}

export default function FriseSemestres({ patient, gestion }) {
  const liste = semestres(gestion);
  if (!liste.length) return null;
  const auj = aujourdhui();
  const secu = priseEnChargeSecu(patient, gestion);

  return (
    <span className="oa-frise-mini" aria-label="Semestres du traitement">
      {liste.map((s) => {
        const [classe, libelle] = etat(s, auj);
        const depOk = secu && s.dep;
        return (
          <span
            key={s.numero}
            className={`oa-frise-mini-case ${classe}`}
            title={`Semestre ${s.numero} · ${formaterDate(s.debut)} · ${libelle}${secu ? (s.dep ? " · DEP imprimée" : " · DEP à faire") : ""}`}
          >
            {s.numero}
            {depOk && <i className="oa-point-dep" aria-label="DEP imprimée" />}
          </span>
        );
      })}
    </span>
  );
}
