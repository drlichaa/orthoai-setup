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
- dents : dents citées dans la consultation, en numérotation FDI (« 12 », « 55 »…), reportées sur le schéma dentaire du patient. Uniquement les dents explicitement nommées par l'orthodontiste ; sinon tableaux vides.
  - agenesies : dents absentes par agénésie.
  - a_extraire : dents dont l'extraction est demandée ou prévue (dents temporaires, prémolaires, dents de sagesse…).
  - incluses : dents incluses.
- courriers : lettres d'adressage à des confrères, uniquement pour les situations évoquées pendant la consultation (sinon tableau vide). Un seul courrier par destinataire.
  - "dentiste" : soins à réaliser avant le traitement (caries, contrôle, détartrage) ou extractions à prévoir (dents de lait, prémolaires, dents incluses, dents de sagesse).
  - "orthophoniste" : déglutition atypique ou dysfonctionnelle, langue mal positionnée (en avant, entre les dents, basse, pas au palais), interposition linguale, troubles de l'articulation liés.
  - "parodontiste" : parodontite, gencives inflammatoires ou qui saignent, récessions, perte d'attache, mobilités, bilan parodontal avant traitement.
  - "orl" : ventilation buccale au lieu de nasale, obstruction nasale, végétations ou amygdales volumineuses, ronflements, pauses respiratoires, suspicion d'apnées du sommeil (SAHOS), fatigue ou somnolence associées.
  Pour chaque courrier :
  - motif : objet court (ex. « Soins dentaires avant traitement orthodontique », « Suspicion de troubles respiratoires du sommeil »).
  - corps pour "orthophoniste" : c'est une ordonnance, pas une lettre. Uniquement les lignes de prescription, sur le modèle : « Bilan orthophonique +\n12 séances de rééducation de la déglutition ». Utilise le nombre de séances s'il est dicté (sinon 12) et précise la rééducation si elle a été évoquée (posture linguale, ventilation nasale…). Pas de nom de patient, pas de phrase.
  - corps pour les autres destinataires : le texte de la lettre, de confrère à confrère, ton professionnel et courtois, termes cliniques exacts, 2 à 4 courts paragraphes séparés par une ligne vide. Désigne le patient uniquement par « [patient] » et n'utilise aucun pronom ni accord genré pour lui ni pour l'orthodontiste : écris les accords sous la forme inclusive « vu(e) », « suivi(e) », « âgé(e) », « reconnaissant(e) », « informé(e) » (ils sont accordés automatiquement selon le sexe du patient et du praticien), et reformule pour éviter « il » / « elle » (ex. « [patient] présente… », « on note… ») (ex. « Je vous adresse [patient], que j'ai vu(e) en première consultation d'orthodontie. »). Indique les constats cliniques qui motivent l'adressage, la demande précise (dents concernées en numérotation FDI, soins ou extractions demandés, bilan, rééducation, avis, examen du sommeil…) et le lien avec le traitement orthodontique (à réaliser avant la pose de l'appareil, en parallèle…). Ne recopie pas tout le diagnostic orthodontique ni le plan de traitement : un résumé en tirets est ajouté automatiquement sous la lettre ; limite-toi aux constats qui motivent l'adressage. N'écris ni formule d'appel (« Cher confrère ») ni formule de politesse finale ni signature : elles sont ajoutées automatiquement. N'invente aucun constat qui n'a pas été dit.
- points_a_verifier : courtes notes destinées à l'orthodontiste uniquement (non imprimées) : éléments ambigus, termes mal reconnus, informations manquantes importantes.`;

const champTexte = { type: "string" };

// Dents permanentes (11 à 48) et temporaires (51 à 85) en numérotation FDI.
const DENTS_FDI = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((q) =>
  Array.from({ length: q <= 4 ? 8 : 5 }, (_, i) => `${q}${i + 1}`),
);
const listeDents = { type: "array", items: { type: "string", enum: DENTS_FDI } };

export function buildReportSchema(appareilIds) {
  const appareilItems = appareilIds.length ? { type: "string", enum: appareilIds } : { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["motif", "diagnostic", "plan_traitement", "dents", "courriers", "points_a_verifier"],
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
      dents: {
        type: "object",
        additionalProperties: false,
        required: ["agenesies", "a_extraire", "incluses"],
        properties: {
          agenesies: listeDents,
          a_extraire: listeDents,
          incluses: listeDents,
        },
      },
      courriers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["destinataire", "motif", "corps"],
          properties: {
            destinataire: { type: "string", enum: ["dentiste", "orthophoniste", "parodontiste", "orl"] },
            motif: champTexte,
            corps: champTexte,
          },
        },
      },
      points_a_verifier: { type: "array", items: champTexte },
    },
  };
}
