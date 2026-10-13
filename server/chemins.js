// Emplacements partagés par le serveur en ligne de commande et l'application.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DOSSIER_ORTHOAI = join(homedir(), ".orthoai");
export const FICHIER_CONFIG = process.env.ORTHOAI_CONFIG || join(DOSSIER_ORTHOAI, "config.json");
export const FICHIER_HISTORIQUE = process.env.ORTHOAI_HISTORIQUE || join(DOSSIER_ORTHOAI, "historique.chiffre");

// Dossier « whisper » (programme Windows et modèles) : celui du projet,
// ou ~/Documents/orthoai/whisper quand l'application est installée ailleurs.
export function dossierWhisper() {
  if (process.env.WHISPER_DIR) return resolve(process.env.WHISPER_DIR);
  const candidats = [
    resolve(import.meta.dirname, "..", "whisper"),
    join(DOSSIER_ORTHOAI, "whisper"),
    join(homedir(), "Documents", "orthoai", "whisper"),
  ];
  return candidats.find((d) => existsSync(join(d, "models"))) || candidats[0];
}
