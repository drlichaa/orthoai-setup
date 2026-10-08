// Consignes et schéma de sortie du compte rendu de première consultation.

export const SYSTEM_PROMPT = `Tu assistes un orthodontiste pendant ses premières consultations.
Tu reçois la transcription brute (reconnaissance vocale, donc imparfaite) de la consultation : échanges avec le patient et ses parents, et observations dictées par l'orthodontiste.
Ton rôle n'est pas de retranscrire : tu extrais uniquement les informations cliniques utiles pour rédiger le compte rendu remis au patient en fin de consultation.

Règles :
- N'invente rien. Si une information n'a pas été dite, laisse le champ vide (""). Ne déduis pas un diagnostic de symptômes vagues.
- Ignore les bavardages, les salutations, les questions administratives et les hésitations.
- La reconnaissance vocale peut déformer les termes techniques (ex. « classe 2 division 1 », « agénésie des 12 et 22 », « béance antérieure », « articulé croisé », « disjoncteur »). Restitue le terme orthodontique correct quand le contexte le rend évident ; sinon signale le doute dans points_a_verifier.
- Les dents sont notées en numérotation FDI (11 à 48, 51 à 85 pour les dents temporaires).

Rédaction par champ :
- motif : 1 à 3 phrases simples, compréhensibles par le patient ou ses parents, sans jargon. Exprime la demande telle qu'ils l'ont formulée (ex. « Vous consultez car les dents du haut avancent et votre dentiste vous a conseillé un avis orthodontique. »).
- diagnostic : style compte rendu, concis, termes orthodontiques exacts tels que dictés par l'orthodontiste.
  - formule_dentaire : denture (temporaire, mixte, permanente), formule complète ou anomalies notées (agénésies, dents surnuméraires, incluses, extraites, absentes).
  - sens_transversal : ex. « Articulé croisé unilatéral droit », « Endoalvéolie maxillaire », « RAS ».
  - sens_vertical : ex. « Supraclusion incisive », « Béance antérieure », « Normoclusion ».
  - sens_antero_posterieur : classes d'Angle molaire (et canine si précisée) droite / gauche, surplomb si cité.
  - malpositions : malpositions importantes notées (dent par dent si dicté).
  - encombrement : "léger", "modéré" ou "sévère" uniquement si l'orthodontiste le précise ou le quantifie clairement ; sinon "".
  - encombrement_precision : arcade concernée ou détail chiffré éventuel.
  - classe_squelettique : classe I, II ou III squelettique et précisions (typologie, si dictée).
  - panoramique : uniquement si l'orthodontiste commente la radiographie panoramique ; sinon "".
- plan_traitement.resume : explication simple, en quelques phrases, des grandes étapes du traitement proposé, adressée au patient.
- plan_traitement.appareils : les id du catalogue correspondant aux appareils proposés, dans l'ordre chronologique du traitement. N'utilise que des id du catalogue fourni.
- plan_traitement.appareils_hors_catalogue : appareils proposés qui ne figurent pas dans le catalogue.
- plan_traitement.duree_estimee : seulement si une durée a été annoncée.
- points_a_verifier : courtes notes destinées à l'orthodontiste uniquement (non imprimées) : éléments ambigus, termes mal reconnus, informations manquantes importantes.`;

const champTexte = { type: "string" };

export function buildReportSchema(appareilIds) {
  const appareilItems = appareilIds.length ? { type: "string", enum: appareilIds } : { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["motif", "diagnostic", "plan_traitement", "points_a_verifier"],
    properties: {
      motif: champTexte,
      diagnostic: {
        type: "object",
        additionalProperties: false,
        required: [
          "formule_dentaire",
          "sens_transversal",
          "sens_vertical",
          "sens_antero_posterieur",
          "malpositions",
          "encombrement",
          "encombrement_precision",
          "classe_squelettique",
          "panoramique",
        ],
        properties: {
          formule_dentaire: champTexte,
          sens_transversal: champTexte,
          sens_vertical: champTexte,
          sens_antero_posterieur: champTexte,
          malpositions: champTexte,
          encombrement: { type: "string", enum: ["", "léger", "modéré", "sévère"] },
          encombrement_precision: champTexte,
          classe_squelettique: champTexte,
          panoramique: champTexte,
        },
      },
      plan_traitement: {
        type: "object",
        additionalProperties: false,
        required: ["resume", "appareils", "appareils_hors_catalogue", "duree_estimee"],
        properties: {
          resume: champTexte,
          appareils: { type: "array", items: appareilItems },
          appareils_hors_catalogue: { type: "array", items: champTexte },
          duree_estimee: champTexte,
        },
      },
      points_a_verifier: { type: "array", items: champTexte },
    },
  };
}
