// Consentements éclairés du cabinet (modèles fournis par la praticienne).
// « enfant » : patient de moins de 16 ans à la 1ère consultation (prise en charge) ;
// « adulte » : 16 ans ou plus. **texte** = gras. Les différences de tarif sont voulues.
import { ajouterMois } from "./gestion.js";

const COMMUN_DEBUT = [
  { titre: "BUTS DU TRAITEMENT" },
  {
    texte:
      "Un traitement orthodontique se fixe comme objectif de corriger des **dysmorphoses dento-maxillo-faciales** dont le patient ne perçoit que l'aspect esthétique. En réalité le praticien cherche à améliorer les **fonctions** vitales qui sont souvent perturbées du fait de ces dysmorphoses : la respiration, la phonation, la mastication, la déglutition. C'est ainsi que s'établiront l'harmonie et l'équilibre des fonctions dont découle la beauté d'un sourire. La correction des anomalies dento-maxillo-faciales constitue de plus une excellente mesure de prévention des « déchaussements dentaires » et des caries par l'amélioration de l'hygiène dentaire que ce type de traitement induit.",
  },
];

const duree = (enfant) => [
  { section: "Durée du traitement" },
  {
    texte:
      "Elle est **variable** selon l'importance de la déformation, l'amplitude des déplacements dentaires ou alvéolaires à effectuer, le stade d'évolution des dents et elle dépend en grande partie de votre coopération. Elle varie donc d'un patient à l'autre et est très difficilement chiffrable précisément.",
  },
  ...(enfant
    ? [
        {
          texte:
            "__A noter__ : si le traitement débute avant le 16ème anniversaire, la sécurité sociale autorise une prise en charge pour **6 semestres** à hauteur de 193,5 euros / semestre. Le reste à charge est déterminé en fonction du remboursement de la mutuelle.",
        },
      ]
    : []),
  { texte: "La facturation des semestres a lieu en début de semestre. Chaque semestre entamé est entièrement dû." },
];

const HYGIENE = [
  { section: "Maintenir une bouche saine" },
  {
    texte:
      "Toute **lésion carieuse** doit être soignée préalablement au traitement orthodontique, mais pendant le traitement un contrôle devra être effectué tous les **6 mois** par un chirurgien-dentiste.",
  },
  { section: "Maintenir une bouche propre" },
  {
    texte:
      "**L'hygiène** dentaire doit être rigoureuse : des conseils pratiques seront donnés et des vérifications effectuées à chaque visite.",
  },
  {
    texte:
      "Les traces de **décalcifications** relevées quelquefois après un traitement ne sont pas imputables à celui-ci mais à la **plaque dentaire** accumulée par négligence autour des différentes pièces de l'appareil. Il faut savoir que ces traces, toujours dues à une hygiène insuffisante, deviennent rapidement irréversibles.",
  },
  {
    texte:
      "Il en va de même des **gingivites** ou **inflammation** des gencives qui sont une complication due à une insuffisance de brossage.",
  },
];

const rendezVous = (enfant) => [
  { section: "Les rendez-vous" },
  { sousTitre: "1ère consultation :" },
  {
    texte:
      "Les parents accompagnent les enfants lors de la **première consultation**. Ils y exposent le motif de la consultation. Un premier diagnostic est posé et un devis estimatif est remis au patient (en général +/- 6 mois).",
  },
  { sousTitre: "Bilan orthodontique :" },
  {
    texte: `Lors du rendez-vous suivant, un bilan orthodontique est réalisé (empreinte, photo, analyse des radiographies). Ainsi, le diagnostic et le plan de traitement sont exposés au patient (et aux parents si le patient est mineur). A la fin du rdv de bilan __**${enfant ? 4 : 3} documents doivent être signés**__ :`,
  },
  {
    liste: [
      "Questionnaire médical",
      "Consentement éclairé",
      "Devis",
      ...(enfant ? ["DEP (Demande d'Entente Préalable) pour les patients de moins de 16 ans à envoyer à la CPAM"] : []),
    ],
  },
  { sousTitre: "La pose de l'appareil :" },
  {
    texte:
      "Le rdv de pose des bagues (début du traitement) et de dépose des bagues (fin de traitement) sont des RDV d'une heure et quart. Ils sont planifiés en **matinée** ou en **début d'après-midi.**",
  },
  { texte: "Une **attestation de présence** est donnée au patient si nécessaire." },
  { sousTitre: "Les RDV de suivi :" },
  {
    texte:
      "La périodicité des rdv de suivi est établie par les nécessités du traitement (+/- toutes les 8 semaines). La présence des **parents en salle de soin**, lors des rdv de suivi, **n'est pas nécessaire.**",
  },
  {
    texte:
      "Les rendez-vous **fixés** doivent être respectés pour optimiser le traitement. Le report d'un rendez-vous manqué peut être de l'ordre de plusieurs semaines, ce qui prolonge d'autant la durée du traitement.",
  },
  { texte: "Merci de bien vouloir vous présenter **5 minutes avant l'heure de votre rendez-vous.**" },
  { texte: "Notez qu'il est possible de **se brosser les dents** dans la salle d'hygiène du cabinet." },
  {
    texte:
      "Dans le cas d'un retard, la visite s'effectuera ultérieurement pour ne pas pénaliser un autre patient arrivé à l'heure.",
  },
];

const appareil = (enfant) => [
  { section: "Vérifier l'intégrité de l'appareil" },
  { centre: "__Toute détérioration est évitée en :__" },
  {
    liste: [
      "Arrêtant la succion du pouce ou des doigts",
      "Arrêtant de se ronger les ongles",
      "Suivant rigoureusement les **recommandations alimentaires** (interdiction : chewing-gums, bonbons, caramels, nougats…)",
      "Si une bague a été décollée, il faut le préciser à la secrétaire lors de la confirmation du rdv et il est **impératif de la ramener au cabinet**. Toute bague perdue est facturée **25 euros.**",
      `Un appareil amovible perdu est facturé **300 euros**${enfant ? " (hors PUL 2 facturé 550 euros)" : ""}`,
    ],
  },
];

const fin = (enfant) => [
  { titre: "LES COMPLICATIONS ÉVENTUELLES, LES LIMITES ET LES RISQUES" },
  {
    texte:
      "Dans certains cas, heureusement fort rares, les racines des dents peuvent se **raccourcir** ou se **rétrécir** pendant le traitement, amenant le praticien à modifier, suspendre, voire interrompre le traitement.",
  },
  {
    texte:
      "Si de nombreux **troubles de l'articulation temporo-mandibulaire** peuvent être corrigés par un traitement orthodontique, il en existe des rebelles qui peuvent même s'aggraver ou apparaître avec le temps, même si les anomalies dento-maxillaires ont été éliminées.",
  },
  {
    texte:
      "Les contre-indications relèvent de raisons souvent médicales, mais aussi d'un refus des contraintes évoquées plus haut. Si ce refus devait apparaître en cours de traitement, le praticien se verrait contraint, certes après plusieurs avertissements, **d'interrompre** ledit traitement.",
  },
  { titre: "LE STRIPPING" },
  {
    texte:
      "Un **stripping inter-dentaire** permet une légère réduction amélaire (entre les dents). En effet, lorsque la **taille** des **dents** est trop **importante** comparée à la taille des **mâchoires** cela permet d'éviter des extractions de dents ou de nuire à l'os et à la gencive qui ne supporteraient pas cette différence de taille. Le stripping n'est pas douloureux et peut être réalisé au cours du traitement lors des rdv de suivi.",
  },
  { titre: "LES MINIVIS" },
  {
    texte: `Le traitement orthodontique pourra nécessiter la pose de **mini-vis** (HN = ${enfant ? 150 : 200} euros/minivis). Si l'hygiène autour des mini-vis n'est pas efficace, il peut y avoir inflammation, infection et hyperplasie gingivales. Événement particulièrement rare, les racines des dents adjacentes peuvent être lésées lors de la mise en place chirurgicale de mini-vis orthodontiques.`,
  },
  { titre: "CONTENTION" },
  {
    texte:
      "Il faut savoir cependant qu'une fois **atteints les objectifs** que le praticien s'est fixé, il convient de maintenir pendant quelque temps les acquis du traitement pour permettre au système dento-maxillaire de se stabiliser.",
  },
  { texte: "C'est la période de contention qui est aussi importante que le traitement lui-même." },
  {
    texte:
      "Ainsi, un fil de contention est systématiquement mis en place de canine à canine au niveau de l'arcade inférieure. Lorsque cela est possible, un fil est également collé à l'arcade supérieure. Toutefois, dans certains cas, une gouttière (nocturne) sera plus indiquée pour maintenir les résultats.",
  },
  {
    texte:
      "En cas de dépose de l'appareil **avant** la fin du traitement orthodontique, aucune contention ne sera mise en place. Une décharge doit être signée et des honoraires (**HN = 500 euros**) seront à régler en début de séance.",
  },
  { texte: "**Le succès du traitement repose essentiellement sur votre coopération.**" },
  { centre: "C'est pourquoi, dans les cas suivants :" },
  {
    liste: [
      "**mauvaise hygiène dentaire** persistante",
      "**non-respect** des rendez-vous fixés",
      "**casses répétées** des appareils",
      "port de l'appareil **absent ou irrégulier**",
    ],
  },
  { centre: "**Le traitement pourra être arrêté.**" },
  { texte: "Ainsi informé, je souhaite que soit effectué le traitement orthodontique proposé." },
];

export function texteConsentement(enfant) {
  const blocs = [
    ...(enfant
      ? [
          { texte: "Madame, Monsieur," },
          {
            texte:
              "Votre enfant ou vous-même allez débuter un traitement d'orthodontie, dont l'objectif est de bénéficier de dents saines, afin d'avoir un sentiment de bien-être et de confiance en soi.",
          },
        ]
      : []),
    ...COMMUN_DEBUT,
    ...duree(enfant),
    ...HYGIENE,
    ...rendezVous(enfant),
    ...appareil(enfant),
    ...fin(enfant),
  ];
  let numero = 0;
  return blocs.map((b) => (b.section ? { ...b, numero: ++numero } : b));
}

// Port de la gouttière de contention, à partir de la date de dépose.
export const PORT_GOUTTIERE = [
  { mois: 6, consigne: "Toutes les nuits" },
  { mois: 6, consigne: "Une nuit sur deux" },
  { mois: null, consigne: "Au minimum 2 nuits par semaine" },
];

export function etapesGouttiere(depose) {
  let debut = depose;
  return PORT_GOUTTIERE.map((e) => {
    const etape = { ...e, debut, fin: e.mois && debut ? ajouterMois(debut, e.mois) : "" };
    debut = etape.fin;
    return etape;
  });
}
