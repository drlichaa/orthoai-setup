// Courriers d'adressage aux confrères (ordonnance pour l'orthophoniste) :
// formules propres à chaque destinataire et modèles pour un ajout à la main.

const CONFRERE = {
  appel: "Chère Consœur, Cher Confrère,",
  politesse:
    "Avec mes remerciements, je vous prie d'agréer, Chère Consœur, Cher Confrère, l'expression de mes salutations confraternelles.",
};

export const TYPES_COURRIER = {
  dentiste: {
    libelle: "Chirurgien-dentiste",
    attention: "À l'attention du chirurgien-dentiste",
    ...CONFRERE,
    motif: "Soins dentaires avant traitement orthodontique",
    corps:
      "Je vous adresse [patient], que j'ai vu(e) en première consultation d'orthodontie.\n\nAvant de débuter le traitement orthodontique, je vous remercie de bien vouloir réaliser les soins suivants : …\n\nJe vous serais reconnaissant(e) de me tenir informé(e) de la fin des soins afin de programmer la pose de l'appareil.",
  },
  // Pour l'orthophoniste, une ordonnance (bilan + séances) et non une lettre.
  orthophoniste: {
    libelle: "Orthophoniste",
    ordonnance: true,
    motif: "Bilan orthophonique et rééducation de la déglutition",
    corps: "Bilan orthophonique +\n12 séances de rééducation de la déglutition",
  },
  parodontiste: {
    libelle: "Parodontiste",
    attention: "À l'attention du parodontiste",
    ...CONFRERE,
    motif: "Bilan parodontal avant traitement orthodontique",
    corps:
      "Je vous adresse [patient], que j'ai vu(e) en première consultation d'orthodontie.\n\nL'examen clinique révèle : …\n\nJe vous remercie de bien vouloir réaliser un bilan parodontal et la prise en charge que vous jugerez nécessaire. Le traitement orthodontique ne débutera qu'après stabilisation de la situation parodontale, et je reste à votre disposition pour en coordonner le suivi.",
  },
  orl: {
    libelle: "ORL",
    attention: "À l'attention du médecin ORL",
    ...CONFRERE,
    motif: "Ventilation buccale et troubles respiratoires du sommeil",
    corps:
      "Je vous adresse [patient], que j'ai vu(e) en première consultation d'orthodontie.\n\nJ'ai relevé : …\n\nJe vous remercie de bien vouloir réaliser un bilan ORL de la perméabilité des voies aériennes supérieures et, si vous le jugez utile, un examen du sommeil. Une ventilation nasale rétablie est importante pour la croissance des maxillaires et la stabilité du traitement orthodontique.",
  },
};

// Courrier au dentiste créé depuis le schéma dentaire (dents « À extraire »).
export function texteExtractions(dents) {
  const pluriel = dents.length > 1;
  return [
    "Je vous adresse [patient], suivi(e) en orthodontie au cabinet.",
    `Dans le cadre du traitement orthodontique, je vous remercie de bien vouloir procéder à l'extraction de${
      pluriel ? "s dents suivantes" : " la dent suivante"
    } : ${dents.join(", ")}.`,
    "Je vous serais reconnaissant(e) de me tenir informé(e) une fois les extractions réalisées, afin de poursuivre le traitement.",
  ].join("\n\n");
}

export function nouveauCourrier(destinataire) {
  const { motif, corps } = TYPES_COURRIER[destinataire];
  return { destinataire, motif, corps, nom_destinataire: "" };
}
