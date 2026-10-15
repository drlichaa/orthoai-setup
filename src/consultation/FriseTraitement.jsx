// Frise du traitement : semestres (une DEP pour deux) puis année de contention,
// remplie en bleu au fil du temps ; point vert quand la DEP a été imprimée.
import { formaterDate } from "./format.js";
import { aujourdhui, dureeLisible, euros, frise, libelleDep, priseEnChargeSecu } from "./gestion.js";

function infoDep(s) {
  if (!s.depDetail) return s.dep ? "DEP faite" : "DEP à faire";
  const d = s.depDetail;
  if (d.nature === "orthofast")
    return `DEP faite dans OrthoFast (dernière le ${formaterDate(d.date)}${d.detail ? ` · ${d.detail}` : ""})`;
  return `${libelleDep(d)} imprimée le ${formaterDate(d.date)}${d.envoyee ? `, envoyée le ${formaterDate(d.envoyee)}` : " (pas encore envoyée)"}`;
}

export default function FriseTraitement({ patient, gestion, compacte = false }) {
  const auj = aujourdhui();
  const f = frise(gestion, auj);
  if (!f) return null;
  const secu = priseEnChargeSecu(patient, gestion);
  const { courant } = f;
  const enSemestre = courant && !courant.contention;
  const debut = f.segments[0].debut;
  return (
    <div className={`oa-frise-tt${compacte ? " compacte" : ""}`}>
      <div
        className="oa-frise-barre"
        style={{ gridTemplateColumns: `repeat(${f.segments.length}, minmax(64px, 1fr))` }}
      >
        {f.segments.map((s) => {
          const etat = s.remplissage >= 1 ? "passe" : s.remplissage > 0 ? "courant" : "avenir";
          const premierDuGroupe = s.contention || s.numero % 2 === 1;
          return (
            <div
              key={s.cle}
              className={`oa-frise-seg ${etat}${s.contention ? " contention" : ""}${premierDuGroupe ? " groupe" : ""}${s.aVerifier ? " verifier" : ""}`}
              title={`${s.contention ? "Année de contention" : `Semestre ${s.numero}`} : ${formaterDate(s.debut)} → ${formaterDate(s.fin)}${s.montant != null ? ` · ${euros(s.montant)}` : ""}${s.facture ? ` · facturé le ${formaterDate(s.facture)}` : s.aVerifier ? " · repris d'OrthoFast, à vérifier" : ""}${secu ? `\n${infoDep(s)}` : ""}`}
            >
              <span className="oa-frise-rempli" style={{ width: `${s.remplissage * 100}%` }} />
              {etat === "courant" && <span className="oa-frise-auj" style={{ left: `${s.remplissage * 100}%` }} />}
              <span className="oa-frise-date">{formaterDate(s.debut)}</span>
              <span className="oa-frise-num">{s.libelle}</span>
              {secu && (s.dep || (s.debut <= auj && !s.aVerifier)) && (
                <span className={`oa-frise-dep ${s.dep ? "faite" : "due"}`} aria-label={infoDep(s)} />
              )}
            </div>
          );
        })}
      </div>
      <div className="oa-frise-infos">
        <span>
          {enSemestre ? (
            <>
              Semestre en cours :{" "}
              <b>
                {courant.numero}/{f.nombre}
              </b>{" "}
              · fin dans {dureeLisible(auj, courant.fin)} ({formaterDate(ajouterJour(courant.fin))})
            </>
          ) : courant?.contention ? (
            <>
              <b>Contention</b> · fin dans {dureeLisible(auj, courant.fin)} ({formaterDate(courant.fin)})
            </>
          ) : auj < debut ? (
            <>Début du traitement le {formaterDate(debut)}</>
          ) : (
            <>Traitement terminé</>
          )}
        </span>
        {enSemestre && (
          <span>
            Traitement actif · fin dans <b>{dureeLisible(auj, f.finSemestres)}</b>
          </span>
        )}
        {f.resteAFacturer > 0 && (
          <span className="oa-frise-solde">
            Reste à facturer : {euros(f.resteAFacturer)} ({f.semestresAFacturer} semestre
            {f.semestresAFacturer > 1 ? "s" : ""})
          </span>
        )}
      </div>
      {!compacte && (
        <div className="oa-frise-legende">
          {secu ? (
            <>
              <span>
                <i className="oa-frise-dep faite" /> DEP imprimée
              </span>
              <span>
                <i className="oa-frise-dep due" /> DEP à faire
              </span>
            </>
          ) : (
            <span>Hors nomenclature : pas de DEP</span>
          )}
          {f.segments.some((s) => s.aVerifier) && <span>Pointillés : semestre repris d'OrthoFast, à vérifier</span>}
          <span>
            <i className="oa-frise-auj-legende" /> Aujourd'hui
          </span>
        </div>
      )}
    </div>
  );
}

// Dernier jour du semestre (la veille du suivant).
function ajouterJour(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
