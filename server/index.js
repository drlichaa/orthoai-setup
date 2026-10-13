// Lancement du serveur en ligne de commande (npm run server / Demarrer).
// La clé API vient de l'application (~/.orthoai/config.json) ou du fichier .env.
import { demarrerServeur } from "./app.js";
import { FICHIER_CONFIG } from "./chemins.js";

demarrerServeur({ port: Number(process.env.PORT || 8787), fichierConfig: FICHIER_CONFIG }).catch((err) => {
  console.error(`Impossible de démarrer le serveur : ${err.message}`);
  process.exit(1);
});
