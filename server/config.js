// Réglages persistants du serveur (clé API saisie dans l'application).
// Le fichier est créé avec des droits restreints : seul l'utilisateur peut le lire.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function creerConfig(fichier) {
  function lire() {
    if (!fichier || !existsSync(fichier)) return {};
    try {
      return JSON.parse(readFileSync(fichier, "utf8"));
    } catch {
      return {};
    }
  }

  function ecrire(valeurs) {
    if (!fichier) throw new Error("Aucun fichier de configuration.");
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, JSON.stringify({ ...lire(), ...valeurs }, null, 2), { mode: 0o600 });
    chmodSync(fichier, 0o600);
  }

  // La clé saisie dans l'application est prioritaire sur le fichier .env.
  function cleApi() {
    return lire().cleApi || process.env.ANTHROPIC_API_KEY || "";
  }

  return { lire, ecrire, cleApi, modifiable: Boolean(fichier) };
}
