// Appels au serveur local pour l'historique chiffré des comptes rendus.
export async function appelHistorique(chemin, corps) {
  const rep = await fetch(`/api/historique${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: corps ? { "Content-Type": "application/json" } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const erreur = new Error(donnees.error || `Erreur ${rep.status}`);
    erreur.statut = rep.status;
    throw erreur;
  }
  return donnees;
}
