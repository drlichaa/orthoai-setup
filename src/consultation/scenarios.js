// Scénarios de prise de vue (repris d'OrthoFast) : ordre des photos, opérations
// appliquées automatiquement (rotation, symétrie) et disposition de la planche.
// « INFO » : case centrale de la planche (logo, praticien, patient, âge).

export const OPERATIONS = [
  ["", "—"],
  ["symH", "Symétrie horizontale (haut ↔ bas)"],
  ["symV", "Symétrie verticale (gauche ↔ droite)"],
  ["rotG", "Rotation à gauche (-90°)"],
  ["rotD", "Rotation à droite (+90°)"],
  ["rot180", "Rotation 180°"],
];

export const SCENARIOS_PAR_DEFAUT = [
  {
    id: "bilan_initial",
    nom: "Bilan initial",
    genre: "photos",
    elements: [
      { cle: "smile", nom: "Sourire rapproché", operations: [] },
      { cle: "occF", nom: "Occlusion face", operations: [] },
      { cle: "desocc", nom: "Occlusion face entre-ouverte", operations: [] },
      { cle: "occD", nom: "Occlusion droite", operations: [] },
      { cle: "occG", nom: "Occlusion gauche", operations: [] },
      { cle: "max", nom: "Maxillaire", operations: ["symH"] },
      { cle: "mand", nom: "Mandibulaire", operations: ["symH"] },
      { cle: "visFace", nom: "Visage face", operations: ["rotG"] },
      { cle: "visSourire", nom: "Visage face sourire", operations: ["rotG"] },
      { cle: "visProfil", nom: "Visage profil", operations: ["rotG"] },
      { cle: "profilSourire", nom: "Profil sourire", operations: ["rotG"] },
      { cle: "vis34", nom: "Visage 3/4", operations: ["rotG"] },
    ],
    planche: [
      ["visFace", "visSourire", "visProfil"],
      ["max", "INFO", "mand"],
      ["occD", "occF", "occG"],
    ],
  },
  {
    id: "controle",
    nom: "Contrôle qualité",
    genre: "photos",
    elements: [
      { cle: "smile", nom: "Sourire rapproché", operations: [] },
      { cle: "occF", nom: "Occlusion face", operations: [] },
      { cle: "desocc", nom: "Occlusion face entre-ouverte", operations: [] },
      { cle: "occD", nom: "Occlusion droite", operations: [] },
      { cle: "occG", nom: "Occlusion gauche", operations: [] },
      { cle: "max", nom: "Maxillaire", operations: ["symH"] },
      { cle: "mand", nom: "Mandibulaire", operations: ["symH"] },
    ],
    planche: [
      ["max", "smile", "mand"],
      ["INFO"],
      ["occD", "occF", "occG"],
    ],
  },
  {
    id: "radios",
    nom: "Radiographies",
    genre: "radios",
    elements: [
      { cle: "pano", nom: "Radio panoramique", operations: [] },
      { cle: "tele", nom: "Téléradiographie de profil", operations: [] },
    ],
  },
  {
    id: "empreintes",
    nom: "Empreintes 3D",
    genre: "stl",
    elements: [
      { cle: "stlMax", nom: "Arcade maxillaire", operations: [] },
      { cle: "stlMand", nom: "Arcade mandibulaire", operations: [] },
    ],
  },
];

// Applique les opérations dans l'ordre sur une image ; renvoie un JPEG.
export async function transformerImage(fichier, operations = [], { tailleMax = 2400, qualite = 0.9 } = {}) {
  const bitmap = await createImageBitmap(fichier).catch(() => {
    throw new Error(`« ${fichier.name} » n'est pas une image lisible (JPG, PNG…).`);
  });
  const echelle = Math.min(1, tailleMax / Math.max(bitmap.width, bitmap.height));
  let toile = document.createElement("canvas");
  toile.width = Math.round(bitmap.width * echelle);
  toile.height = Math.round(bitmap.height * echelle);
  toile.getContext("2d").drawImage(bitmap, 0, 0, toile.width, toile.height);

  for (const operation of operations.filter(Boolean)) {
    const quart = operation === "rotG" || operation === "rotD";
    const suivante = document.createElement("canvas");
    suivante.width = quart ? toile.height : toile.width;
    suivante.height = quart ? toile.width : toile.height;
    const ctx = suivante.getContext("2d");
    ctx.translate(suivante.width / 2, suivante.height / 2);
    if (operation === "rotG") ctx.rotate(-Math.PI / 2);
    if (operation === "rotD") ctx.rotate(Math.PI / 2);
    if (operation === "rot180") ctx.rotate(Math.PI);
    if (operation === "symH") ctx.scale(1, -1);
    if (operation === "symV") ctx.scale(-1, 1);
    ctx.drawImage(toile, -toile.width / 2, -toile.height / 2);
    toile = suivante;
  }
  const blob = await new Promise((resolve) => toile.toBlob(resolve, "image/jpeg", qualite));
  return new File([blob], fichier.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

// Tri « naturel » des fichiers de l'appareil photo (IMG_2 avant IMG_10).
export function trierFichiers(fichiers) {
  return [...fichiers].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
}

// Ligne notée dans la séance du jour pour une série.
export function ligneSuivi(serie, scenario) {
  const remplis = scenario.elements.filter((e) => serie.elements[e.cle]);
  if (!remplis.length) return "";
  if (scenario.genre === "photos") return `${remplis.length} photo${remplis.length > 1 ? "s" : ""}`;
  return remplis.map((e) => e.nom.toLowerCase()).join(", ");
}
