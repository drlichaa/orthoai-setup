// Catalogue initial des appareils. Les textes sont modifiables dans l'application
// (bouton « Appareils ») et sauvegardés dans le navigateur.
const APPAREILS_PAR_DEFAUT = [
  {
    id: "disjoncteur",
    nom: "Disjoncteur (expanseur palatin rapide)",
    indication: "élargissement du maxillaire, articulé croisé",
    texte:
      "Le disjoncteur est un appareil fixé sur les molaires du haut. Il sert à élargir la mâchoire supérieure lorsqu'elle est trop étroite. Il est activé à la maison à l'aide d'une petite clé selon le rythme indiqué, pendant quelques semaines, puis laissé en place plusieurs mois pour stabiliser le résultat. Un écart peut apparaître temporairement entre les incisives du haut : c'est normal et attendu.",
  },
  {
    id: "quad_helix",
    nom: "Quad Helix",
    indication: "expansion maxillaire lente",
    texte:
      "Le Quad Helix est un appareil fixe en fil métallique placé contre le palais et fixé sur les molaires. Il élargit progressivement l'arcade supérieure. Il est réglé au cabinet lors des rendez-vous de contrôle. Les premiers jours, la parole et l'alimentation peuvent être un peu gênées, puis on s'y habitue rapidement.",
  },
  {
    id: "activateur",
    nom: "Activateur / orthèse fonctionnelle",
    indication: "classe II, stimulation de la croissance mandibulaire",
    texte:
      "L'activateur est un appareil amovible qui guide la croissance des mâchoires en positionnant la mâchoire du bas vers l'avant. Il doit être porté le soir et toute la nuit, au minimum 12 heures par jour. Son efficacité dépend directement du port régulier : plus il est porté, plus le résultat est rapide.",
  },
  {
    id: "masque_delaire",
    nom: "Masque de Delaire (masque facial)",
    indication: "classe III, traction antérieure du maxillaire",
    texte:
      "Le masque de Delaire est un appareil extra-buccal qui prend appui sur le front et le menton. Relié par des élastiques à un appareil placé dans la bouche, il stimule l'avancée de la mâchoire supérieure. Il se porte le soir et la nuit, idéalement 12 à 14 heures par jour.",
  },
  {
    id: "plaque_amovible",
    nom: "Plaque amovible",
    indication: "corrections simples, interception",
    texte:
      "La plaque amovible est un appareil en résine et en fil métallique que l'on peut retirer pour manger et pour se brosser les dents. Elle doit être portée jour et nuit, sauf indication contraire. Elle se nettoie chaque jour avec une brosse à dents.",
  },
  {
    id: "multi_attaches_metal",
    nom: "Appareil multi-attaches (bagues métalliques)",
    indication: "alignement complet des dents",
    texte:
      "L'appareil multi-attaches est composé de petites attaches (bagues) collées sur les dents et reliées par un fil. Il permet de déplacer précisément chaque dent pour obtenir un alignement et une occlusion corrects. Des contrôles ont lieu toutes les 4 à 8 semaines. Une hygiène bucco-dentaire rigoureuse est indispensable pendant toute la durée du traitement.",
  },
  {
    id: "multi_attaches_ceramique",
    nom: "Appareil multi-attaches (bagues céramiques)",
    indication: "alignement complet, option esthétique",
    texte:
      "Les bagues céramiques fonctionnent comme les bagues métalliques mais sont de couleur dent, donc plus discrètes. Elles sont collées sur la face visible des dents du haut. Une hygiène rigoureuse est indispensable, ainsi que des contrôles toutes les 4 à 8 semaines.",
  },
  {
    id: "aligneurs",
    nom: "Aligneurs transparents",
    indication: "alignement par gouttières",
    texte:
      "Les aligneurs sont des gouttières transparentes, fabriquées sur mesure, qui déplacent progressivement les dents. Elles doivent être portées au moins 22 heures par jour et retirées uniquement pour manger, boire autre chose que de l'eau et se brosser les dents. Une nouvelle série de gouttières est utilisée à intervalles réguliers selon le planning remis.",
  },
  {
    id: "mainteneur_espace",
    nom: "Mainteneur d'espace",
    indication: "perte prématurée d'une dent de lait",
    texte:
      "Le mainteneur d'espace conserve la place laissée par une dent de lait perdue trop tôt, afin que la dent définitive puisse sortir correctement. Il reste en place jusqu'à l'éruption de la dent définitive.",
  },
  {
    id: "contention",
    nom: "Contention (fil collé et/ou gouttière)",
    indication: "stabilisation en fin de traitement",
    texte:
      "À la fin du traitement, une contention est mise en place pour éviter que les dents ne reprennent leur position initiale : un fil fin collé à l'arrière des dents et/ou une gouttière à porter la nuit. La contention est un élément essentiel de la réussite du traitement à long terme.",
  },
];

export default APPAREILS_PAR_DEFAUT;
