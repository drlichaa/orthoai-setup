// Transcription locale avec whisper.cpp (aucun son ne quitte l'ordinateur).
// Le serveur whisper.cpp (whisper/bin, ou Homebrew sur Mac) est lancé
// automatiquement en arrière-plan s'il est installé avec un modèle.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { cpus } from "node:os";
import { delimiter, join, resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "..", "whisper");
const PORT_WHISPER = Number(process.env.WHISPER_PORT || 8178);
const URL_WHISPER = process.env.WHISPER_URL || `http://127.0.0.1:${PORT_WHISPER}`;

// Oriente la reconnaissance vers le vocabulaire orthodontique.
const PROMPT_VOCABULAIRE =
  "Consultation d'orthodontie. Classe II division 1, classe III, agénésie, supraclusion, béance, articulé croisé, encombrement, disjoncteur, multi-attaches, panoramique.";

// Phrases que Whisper « invente » parfois sur du silence (sous-titres de vidéos).
const HALLUCINATIONS = [
  /sous-titr\S* (réalisés? )?(par|de) .*/gi,
  /merci d'avoir regardé( cette vidéo)?\s*[.!]?/gi,
  /abonnez-vous.*/gi,
  /amara\.org/gi,
];

let processus = null;
let etat = "absent"; // absent | demarrage | pret | erreur
let derniereErreur = "";

function trouverFichier(dossier, test) {
  if (!existsSync(dossier)) return null;
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      const trouve = trouverFichier(chemin, test);
      if (trouve) return trouve;
    } else if (test(entree.name)) {
      return chemin;
    }
  }
  return null;
}

// whisper/bin (installateur Windows ou compilation), sinon Homebrew / PATH (Mac).
function trouverExecutable() {
  if (process.env.WHISPER_BIN) return resolve(process.env.WHISPER_BIN);
  const local = trouverFichier(join(RACINE, "bin"), (n) => n === "whisper-server.exe" || n === "whisper-server");
  if (local) return local;
  const dossiers = [...(process.env.PATH || "").split(delimiter), "/opt/homebrew/bin", "/usr/local/bin"];
  for (const dossier of dossiers) {
    for (const nom of ["whisper-server", "whisper-server.exe"]) {
      if (dossier && existsSync(join(dossier, nom))) return join(dossier, nom);
    }
  }
  return null;
}

function trouverModele() {
  const dossier = join(RACINE, "models");
  if (process.env.WHISPER_MODEL) return resolve(process.env.WHISPER_MODEL);
  const preferes = ["ggml-large-v3-turbo-q5_0.bin", "ggml-large-v3-turbo.bin", "ggml-medium.bin", "ggml-small.bin"];
  for (const nom of preferes) {
    if (existsSync(join(dossier, nom))) return join(dossier, nom);
  }
  return trouverFichier(dossier, (n) => n.startsWith("ggml-") && n.endsWith(".bin") && !n.includes("silero"));
}

async function attendrePret(timeoutMs) {
  const fin = Date.now() + timeoutMs;
  while (Date.now() < fin) {
    if (etat === "erreur") return;
    try {
      const rep = await fetch(URL_WHISPER, { signal: AbortSignal.timeout(2000) });
      if (rep.ok) {
        etat = "pret";
        return;
      }
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  etat = "erreur";
  derniereErreur = "Le serveur Whisper n'a pas démarré à temps.";
}

async function repondDeja() {
  try {
    return (await fetch(URL_WHISPER, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

export async function demarrerWhisper() {
  // Une instance restée ouverte (fermeture brutale) est simplement réutilisée.
  if (!process.env.WHISPER_URL && (await repondDeja())) {
    etat = "pret";
    return `Whisper déjà lancé sur ${URL_WHISPER}`;
  }
  if (process.env.WHISPER_URL) {
    etat = "demarrage";
    attendrePret(60_000);
    return `Whisper externe : ${URL_WHISPER}`;
  }
  const executable = trouverExecutable();
  const modele = trouverModele();
  if (!executable || !modele) {
    etat = "absent";
    return "Whisper non installé : lancez installer-whisper (voir CONSULTATION.md).";
  }

  const args = [
    "-m", modele,
    "-l", "fr",
    "--host", "127.0.0.1",
    "--port", String(PORT_WHISPER),
    "-t", String(Math.max(2, Math.min(8, cpus().length - 1))),
    "--prompt", PROMPT_VOCABULAIRE,
  ];
  const vad = trouverFichier(join(RACINE, "models"), (n) => n.includes("silero") && n.endsWith(".bin"));
  if (vad) args.push("--vad", "-vm", vad);

  etat = "demarrage";
  processus = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let journal = "";
  processus.stderr.on("data", (d) => {
    journal = (journal + d.toString()).slice(-2000);
  });
  processus.on("error", (err) => {
    etat = "erreur";
    derniereErreur = `Impossible de lancer Whisper : ${err.message}`;
  });
  processus.on("exit", (code) => {
    if (etat !== "arret") {
      etat = "erreur";
      derniereErreur = `Whisper s'est arrêté (code ${code}). ${journal.split("\n").slice(-5).join(" ")}`;
    }
  });
  const arreter = () => {
    etat = "arret";
    processus?.kill();
  };
  process.on("exit", arreter);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  attendrePret(180_000);
  return `Whisper local : ${modele.split(/[\\/]/).pop()}${vad ? " + détection de voix" : ""}`;
}

export function etatWhisper() {
  return { etat, erreur: derniereErreur };
}

function nettoyer(texte) {
  let t = texte.replace(PROMPT_VOCABULAIRE, "");
  for (const motif of HALLUCINATIONS) t = t.replace(motif, "");
  return t
    .replace(/\[[^\]]*\]|\([^)]*musique[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Transcrit un fichier WAV (16 kHz mono) et renvoie le texte.
export async function transcrire(wav) {
  if (etat !== "pret") {
    const raisons = {
      absent: "Whisper n'est pas installé sur cet ordinateur (lancez installer-whisper).",
      demarrage: "Whisper est en cours de démarrage, réessayez dans quelques secondes.",
      erreur: derniereErreur || "Whisper est indisponible.",
    };
    throw new Error(raisons[etat] || "Whisper est indisponible.");
  }
  const formulaire = new FormData();
  formulaire.append("file", new Blob([wav], { type: "audio/wav" }), "segment.wav");
  formulaire.append("response_format", "json");
  formulaire.append("temperature", "0");
  const rep = await fetch(`${URL_WHISPER}/inference`, { method: "POST", body: formulaire });
  if (!rep.ok) throw new Error(`Whisper a répondu ${rep.status}`);
  const donnees = await rep.json();
  return nettoyer(donnees.text || "");
}
