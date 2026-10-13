// Catalogue initial des appareils, d'après les fiches remises aux patients par
// le cabinet. Les textes sont modifiables dans l'application (bouton
// « Appareils & cabinet ») et sauvegardés sur l'ordinateur.
const APPAREILS_PAR_DEFAUT = [
  {
    id: "disjoncteur",
    nom: "Disjoncteur",
    indication: "expansion rapide du maxillaire à l'aide d'un vérin, articulé croisé",
    texte:
      "Le disjoncteur est un appareil fixé au palais qui sert à agrandir la mâchoire supérieure à l'aide d'un vérin. Il est activé 1 fois par jour avec la clef, dans le sens de la flèche.\n\nLes premiers jours, l'appareil fait une impression bizarre, la salivation augmente pendant 1 à 2 heures et la parole peut être gênée (zozotement) : parler le plus possible, ou lire à voix haute, aide la langue à s'habituer. Il est normal de sentir une pression sur les dents à chaque activation ; elle passe avec du Doliprane® si nécessaire. Un espace peut apparaître entre les deux incisives du haut : c'est tout à fait normal.\n\nEntretien : nettoyer l'appareil et le palais matin et soir, à chaque brossage, pour éviter une inflammation ; retirer les aliments coincés avec la brosse à dents ou une brossette.\n\nRègle d'or : venir au rendez-vous de suivi 1 fois par semaine. Si un rendez-vous est manqué, il est impératif d'arrêter les tours de clef jusqu'au rendez-vous suivant.",
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
    nom: "Activateur",
    indication: "classe II, stimulation de la croissance de la mâchoire inférieure",
    texte:
      "L'activateur est un appareil amovible qui sert à stimuler la croissance de la mâchoire inférieure. Il se porte 12 à 14 heures par jour : en rentrant de l'école et toute la nuit. Ne pas hésiter à le porter plus longtemps le week-end : plus il est porté, plus la correction est rapide.\n\nLes premiers jours, l'appareil fait une impression bizarre et la salivation augmente pendant 1 à 2 heures : c'est normal.\n\nEntretien : nettoyer l'appareil matin et soir, à chaque brossage, sous l'eau froide ou tiède savonneuse avec une brosse à dents dédiée, puis le rincer à l'eau claire. Bien le sécher avant de le ranger dans sa boîte pour éviter les moisissures.\n\nRègle d'or : l'appareil est soit dans la bouche, soit dans sa boîte, jamais dans un mouchoir. Tout appareil perdu est facturé 300 euros.",
  },
  {
    id: "pul2",
    nom: "PUL (propulseur)",
    indication: "classe II, stimulation de la croissance de la mâchoire inférieure",
    texte:
      "Le PUL est un appareil amovible qui sert à stimuler la croissance de la mâchoire inférieure. Il se porte toute la journée et toute la nuit. Les 2 premiers jours, il peut être porté seulement après l'école et la nuit ; une fois habitué, il se porte aussi à l'école. Plus il est porté, plus la correction est rapide. Il doit être retiré pour manger et pour se brosser les dents, ainsi que pour jouer d'un instrument à vent ou pratiquer un sport où il risque d'être perdu (natation, judo, rugby…).\n\nLes premiers jours, l'appareil fait une impression bizarre, la salivation augmente pendant 1 à 2 heures et la parole peut être gênée (zozotement) : parler le plus possible, ou lire à voix haute, aide la langue à s'habituer. C'est un appareil mobile : il est normal qu'il se décroche si l'on ouvre grand la bouche, la langue doit le maintenir au palais. S'il comporte un élastique, le changer 2 fois par semaine ; s'il comporte un vérin, le tourner dans le sens de la flèche 1 fois par semaine selon les indications du praticien.\n\nEntretien : nettoyer l'appareil matin et soir, à chaque brossage, sous l'eau froide ou tiède savonneuse avec une brosse à dents dédiée, puis le rincer à l'eau claire. Bien le sécher avant de le ranger dans sa boîte pour éviter les moisissures.\n\nRègle d'or : l'appareil est soit dans la bouche, soit dans sa boîte, jamais dans un mouchoir. Tout appareil perdu est facturé 300 euros.",
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
    nom: "Plaque (avec vérin)",
    indication: "expansion de la mâchoire supérieure par plaque amovible",
    texte:
      "La plaque est un appareil amovible qui sert à agrandir la mâchoire supérieure à l'aide d'un vérin. Le vérin est activé 1 fois par semaine, dans le sens de la flèche.\n\nLes premiers jours, ce « faux palais » fait une impression bizarre, la salivation augmente pendant 1 à 2 heures et la parole peut être gênée (zozotement) : parler le plus possible, ou lire à voix haute, aide la langue à s'habituer. La plaque se garde pour manger : de la nourriture peut se coincer entre l'appareil et le palais, il suffit de l'enlever après le repas, de la rincer et de se rincer la bouche avant de la remettre. Avec le temps, de petits morceaux de résine peuvent se détacher : c'est l'usure normale, à signaler au prochain rendez-vous (sauf si cela blesse).\n\nEntretien : nettoyer l'appareil matin et soir, à chaque brossage, sous l'eau froide ou tiède savonneuse avec une brosse à dents dédiée, puis le rincer à l'eau claire. Bien le sécher avant de le ranger dans sa boîte pour éviter les moisissures.\n\nRègle d'or : l'appareil est soit dans la bouche, soit dans sa boîte, jamais dans un mouchoir. Tout appareil perdu est facturé 300 euros.",
  },
  {
    id: "eln",
    nom: "ELN (enveloppe linguale nocturne)",
    indication: "rééducation de la déglutition atypique (langue entre les dents)",
    texte:
      "L'ELN est un appareil amovible qui sert à rééduquer la déglutition, c'est-à-dire la manière d'avaler la salive. Il se porte 1 heure par jour en semaine, 2 heures par jour le week-end, et toutes les nuits, pendant 6 mois en moyenne.\n\nLes 3 clefs d'une bonne déglutition : la langue est en haut, contre le palais (et non en avant contre les dents) ; les dents sont en contact, serrées (la langue ne doit pas se placer entre les dents) ; les lèvres sont au repos, entrouvertes ou se touchant légèrement, sans se contracter. Le port dans la journée est très important : s'entraîner à boire un verre d'eau par petites gorgées avec l'appareil puis sans, et vérifier dans un miroir que les lèvres ne se contractent pas en avalant.\n\nEntretien : nettoyer l'appareil matin et soir, à chaque brossage, sous l'eau froide ou tiède savonneuse avec une brosse à dents dédiée, puis le rincer à l'eau claire. Bien le sécher avant de le ranger dans sa boîte pour éviter les moisissures.\n\nRègle d'or : l'appareil est soit dans la bouche, soit dans sa boîte, jamais dans un mouchoir. Tout appareil perdu est facturé 300 euros.",
  },
  {
    id: "multi_attaches_metal",
    nom: "Bagues métalliques (multi-attaches)",
    indication: "alignement complet des dents",
    texte:
      "L'appareil multi-attaches est composé de petites attaches (bagues) collées sur les dents et reliées par un fil. Il est fixe et permet de déplacer précisément chaque dent pour obtenir un alignement et une occlusion corrects. Les rendez-vous de suivi ont lieu toutes les 6 à 8 semaines. Une hygiène rigoureuse et le respect des interdits alimentaires sont indispensables pendant toute la durée du traitement.",
  },
  {
    id: "multi_attaches_ceramique",
    nom: "Bagues céramiques (multi-attaches)",
    indication: "alignement complet, option esthétique",
    texte:
      "Les bagues céramiques fonctionnent comme les bagues métalliques mais sont de couleur dent, donc plus discrètes. Les rendez-vous de suivi ont lieu toutes les 6 à 8 semaines. Une hygiène rigoureuse et le respect des interdits alimentaires sont indispensables pendant toute la durée du traitement.",
  },
  {
    id: "recommandations_bagues",
    nom: "Recommandations avec les bagues (hygiène et alimentation)",
    indication: "conseils à remettre avec tout appareil fixe (bagues, Carrière)",
    texte:
      "Technique de brossage : se brosser les dents pendant 3 minutes après chaque repas. Brosser les dents du haut et du bas séparément, au-dessus et en dessous des attaches ; avec la pointe de la brosse, faire un mouvement rotatif sur chaque attache, puis brosser de la gencive vers la dent, sans oublier le dessus des dents. Le brossage est très important avec des bagues : il évite les taches et les caries.\n\nInterdits : pas de chewing-gum, pas de bonbons durs ou collants, pas de caramel ni d'aliment collant, pas de croûtons ni de sandwichs baguette (préférer le pain de mie). Ne pas croquer dans les aliments durs (pommes, fruits à noyau) mais les couper en morceaux, et mâcher délicatement avec les dents du fond. Ne pas mordiller de stylos ni se ronger les ongles.\n\nAprès chaque rendez-vous, il est normal que les dents soient sensibles car elles prennent une nouvelle position : du Doliprane® peut être pris pour soulager.\n\nBague décollée : il est impératif de la rapporter au rendez-vous suivant. Toute bague perdue et non rapportée est facturée 25 euros.",
  },
  {
    id: "elastiques_inter_maxillaires",
    nom: "Élastiques (tractions inter-maxillaires)",
    indication: "correction du décalage entre les mâchoires, finition de l'occlusion",
    texte:
      "Les élastiques aident les dents à se déplacer dans la bonne direction. Ils s'accrochent entre les attaches du haut et du bas selon le schéma remis, et se portent selon le temps de port indiqué par le praticien (jour et/ou nuit).\n\nRecommandations : se laver les mains avant de retirer ou de replacer les élastiques. Les élastiques se dégradent rapidement : les changer après chaque repas et avant de se coucher (environ 4 fois par jour s'ils sont portés toute la journée). Ne jamais doubler les élastiques : la pression serait trop forte et pourrait endommager la racine des dents. En cas de manque d'élastiques, appeler le cabinet qui fournira un paquet de même puissance.",
  },
  {
    id: "carriere",
    nom: "Carrière + gouttière mandibulaire",
    indication: "classe II, recul des canines et molaires du haut (attaches sur canines et molaires maxillaires, gouttière en bas)",
    texte:
      "Le Carrière est un dispositif collé de chaque côté sur la canine et la molaire du haut. Associé à des élastiques accrochés à une gouttière portée sur les dents du bas, il fait reculer les dents latérales du haut pour corriger le décalage entre les mâchoires, avant la phase d'alignement.\n\nLes élastiques et la gouttière se portent 22 heures sur 24, jour et nuit, en dehors des repas et du brossage. Règle d'or : ne jamais mettre les élastiques sans la gouttière. Toute gouttière perdue est facturée 80 euros.\n\nBrossage : se brosser les dents pendant 3 minutes après chaque repas, au-dessus et en dessous des attaches, de la gencive vers la dent. Nettoyer la gouttière à chaque brossage avec une brosse à dents et de l'eau tiède savonneuse.\n\nInterdits : pas de chewing-gum, de bonbons durs ou collants, de caramel ni d'aliment collant, pas de croûtons ni de sandwichs baguette ; couper les aliments durs (pommes, fruits à noyau) en morceaux et mâcher délicatement avec les dents du fond ; ne pas mordiller de stylos ni se ronger les ongles. Si une attache se décolle, il est impératif de la rapporter au rendez-vous suivant.",
  },
  {
    id: "aligneurs",
    nom: "Gouttières (aligneurs Spark™)",
    indication: "alignement par gouttières transparentes",
    texte:
      "Les gouttières sont transparentes et fabriquées sur mesure ; elles déplacent progressivement les dents. Elles se portent 22 heures sur 24 minimum. Bien vérifier que chaque gouttière est correctement enfoncée, et mâchouiller des chewies 2 fois 15 minutes par jour. De petits taquets en résine peuvent être collés sur certaines dents pour aider les gouttières à agir.\n\nInterdits : ne pas manger avec les gouttières en bouche (risque important de caries), ne pas boire avec les gouttières (sauf de l'eau froide), ne pas fumer avec les gouttières, ne pas se ronger les ongles.\n\nAu passage à la gouttière suivante, il est normal que les dents soient sensibles car elles prennent une nouvelle position : prendre du Doliprane® si nécessaire.\n\nBrossage : enlever les gouttières, puis brosser les dents du haut et du bas séparément, par un mouvement vertical de la gencive vers la dent, pendant 3 minutes après chaque repas.",
  },
  {
    id: "stripping",
    nom: "Stripping (polissage inter-dentaire, IPR)",
    indication: "encombrement léger à modéré, harmonisation de la forme des dents",
    texte:
      "Le stripping consiste à polir très légèrement les côtés de certaines dents, sur quelques dixièmes de millimètre, pour créer un peu de place et permettre leur alignement sans extraction. Ce geste est indolore, ne nécessite pas d'anesthésie et reste dans l'épaisseur de l'émail : il n'abîme pas les dents et ne les rend pas plus fragiles aux caries. Il est réalisé au cabinet, en une ou plusieurs séances.",
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
    nom: "Contention (fil collé et gouttière)",
    indication: "stabilisation en fin de traitement",
    texte:
      "À la fin du traitement, une double contention est mise en place pour éviter que les dents ne reprennent leur position initiale : un fil fin collé à l'arrière des dents et une gouttière de contention. Un contrôle a lieu 1 mois après, puis tous les 4 mois pendant 1 an. La contention est un élément essentiel de la réussite du traitement à long terme.",
  },
];

export default APPAREILS_PAR_DEFAUT;
