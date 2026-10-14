// Appels au serveur local pour le coffre chiffré (historique et patients).
export async function appelApi(chemin, corps) {
  const rep = await fetch(`/api${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const donnees = await rep.json().catch(() => ({}));
  // Poste distant dont la session a expiré : retour à l'écran de connexion.
  if (rep.status === 401 && donnees.connexion) window.location.reload();
  if (!rep.ok) {
    const erreur = new Error(donnees.error || `Erreur ${rep.status}`);
    erreur.statut = rep.status;
    throw erreur;
  }
  return donnees;
}

export function appelHistorique(chemin, corps) {
  return appelApi(`/historique${chemin}`, corps);
}

// Réduit la photo ou la radio (2400 px max) puis l'envoie, chiffrée par le serveur.
export async function envoyerImage(patientId, fichier) {
  const bitmap = await createImageBitmap(fichier).catch(() => {
    throw new Error(`« ${fichier.name} » n'est pas une image lisible (JPG, PNG…).`);
  });
  const echelle = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(bitmap.width * echelle);
  toile.height = Math.round(bitmap.height * echelle);
  toile.getContext("2d").drawImage(bitmap, 0, 0, toile.width, toile.height);
  const blob = await new Promise((resolve) => toile.toBlob(resolve, "image/jpeg", 0.9));
  const parametres = new URLSearchParams({ patient: patientId, nom: fichier.name });
  const rep = await fetch(`/api/patients/media?${parametres}`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(donnees.error || `Erreur ${rep.status}`);
  return donnees.media;
}
