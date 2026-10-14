// Serveur local d'OrthoAI.
// - /api/transcription : transcrit localement un segment audio avec Whisper.
// - /api/compte-rendu : transforme la transcription en compte rendu structuré
//   (JSON) généré par Claude. La clé API reste sur l'ordinateur.
// - /api/cle : enregistre la clé API saisie dans l'application.
// - /api/historique/... : historique chiffré des comptes rendus (sur cet ordinateur).
// - /api/patients/... : dossiers patients, photos et radios, dans le même coffre chiffré.
// - sert aussi l'interface compilée (dist/) quand elle tourne dans l'application.
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildReportSchema } from "./prompt.js";
import { demarrerWhisper, etatWhisper, transcrire } from "./whisper.js";
import { creerConfig } from "./config.js";
import { FICHIER_HISTORIQUE } from "./chemins.js";
import { ErreurHistorique, creerHistorique } from "./historique.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const TYPES_IMAGES = ["image/jpeg", "image/png", "image/webp"];

const TYPES_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Requête trop volumineuse"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const brut = await readBody(req, MAX_BODY_BYTES);
  try {
    return JSON.parse(brut.toString("utf8") || "{}");
  } catch {
    throw new Error("JSON invalide");
  }
}

// Seules les pages servies depuis cet ordinateur peuvent appeler l'API :
// un site web ouvert dans le navigateur ne peut pas utiliser le serveur local.
function origineAutorisee(req) {
  const origine = req.headers.origin;
  if (!origine) return true;
  try {
    const { hostname } = new URL(origine);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// Refuse les requêtes adressées sous un autre nom que cet ordinateur
// (protection contre le « DNS rebinding » d'un site malveillant).
function hoteAutorise(req) {
  const hote = (req.headers.host || "").replace(/:\d+$/, "");
  return hote === "localhost" || hote === "127.0.0.1";
}

async function routeHistorique(historique, req, _res, url) {
  const methode = req.method;
  const corps = methode === "POST" ? await readJsonBody(req) : {};
  if (methode === "GET" && url === "/api/historique/etat") return historique.etat();
  if (methode === "POST" && url === "/api/historique/creer") return historique.creer(corps.motDePasse);
  if (methode === "POST" && url === "/api/historique/deverrouiller") return historique.deverrouiller(corps.motDePasse);
  if (methode === "POST" && url === "/api/historique/verrouiller") return historique.verrouiller();
  if (methode === "POST" && url === "/api/historique/mot-de-passe") {
    return historique.changerMotDePasse(corps.ancien, corps.nouveau);
  }
  if (methode === "POST" && url === "/api/historique/reinitialiser") {
    if (corps.confirmation !== "EFFACER") throw new ErreurHistorique(400, "Confirmation manquante.");
    return historique.reinitialiser();
  }
  if (methode === "GET" && url === "/api/historique") return { fiches: historique.lister() };
  if (methode === "POST" && url === "/api/historique/enregistrer") return { fiche: historique.enregistrer(corps) };
  if (methode === "POST" && url === "/api/historique/supprimer") return historique.supprimer(corps.id);
  const fiche = url.match(/^\/api\/historique\/fiche\/([\w-]+)$/);
  if (methode === "GET" && fiche) return { fiche: historique.lire(fiche[1]) };
  throw new ErreurHistorique(404, "Route inconnue");
}

async function routePatients(historique, req, res, url) {
  const methode = req.method;
  const parametres = new URL(req.url, "http://local").searchParams;
  if (methode === "GET" && url === "/api/patients") return historique.patients();
  const dossier = url.match(/^\/api\/patients\/dossier\/([\w-]+)$/);
  if (methode === "GET" && dossier) return historique.patient(dossier[1]);
  const media = url.match(/^\/api\/patients\/media\/([\w-]+)$/);
  if (methode === "GET" && media) {
    const { type, octets } = historique.lireMedia(media[1]);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(octets);
    return undefined;
  }
  // Image envoyée telle quelle (corps binaire), chiffrée à l'enregistrement.
  if (methode === "POST" && url === "/api/patients/media") {
    const type = (req.headers["content-type"] || "").split(";")[0];
    if (!TYPES_IMAGES.includes(type)) throw new ErreurHistorique(415, "Format d'image non pris en charge (JPG, PNG ou WebP).");
    const octets = await readBody(req, MAX_IMAGE_BYTES);
    return { media: historique.ajouterMedia(parametres.get("patient"), parametres.get("nom"), type, octets) };
  }
  const corps = methode === "POST" ? await readJsonBody(req) : {};
  if (methode === "POST" && url === "/api/patients/enregistrer") return { patient: historique.enregistrerPatient(corps.patient) };
  if (methode === "POST" && url === "/api/patients/supprimer") return historique.supprimerPatient(corps.id);
  if (methode === "POST" && url === "/api/patients/reglages") return { reglages: historique.enregistrerReglages(corps.reglages) };
  if (methode === "POST" && url === "/api/patients/media/supprimer") return historique.supprimerMedia(corps.patient, corps.id);
  throw new ErreurHistorique(404, "Route inconnue");
}

function servirFichier(dossier, req, res) {
  const chemin = decodeURIComponent(new URL(req.url, "http://local").pathname);
  const relatif = chemin === "/" ? "/index.html" : chemin;
  const fichier = normalize(join(dossier, relatif));
  if (fichier !== dossier && !fichier.startsWith(dossier + sep)) return false;
  if (!existsSync(fichier) || !statSync(fichier).isFile()) return false;
  res.writeHead(200, { "Content-Type": TYPES_MIME[extname(fichier)] || "application/octet-stream" });
  createReadStream(fichier).pipe(res);
  return true;
}

async function generateReport(client, { transcript, appareils, notes }) {
  const catalogue = appareils
    .map((a) => `- id "${a.id}" : ${a.nom}${a.indication ? ` (${a.indication})` : ""}`)
    .join("\n");

  const userContent = [
    "Catalogue des appareils du cabinet (utilise uniquement ces id dans plan_traitement.appareils) :",
    catalogue || "(aucun appareil configuré)",
    "",
    notes ? `Notes complémentaires de l'orthodontiste :\n${notes}\n` : "",
    "Transcription de la consultation :",
    "<transcription>",
    transcript,
    "</transcription>",
  ].join("\n");

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: buildReportSchema(appareils.map((a) => a.id)) },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("La génération a été refusée par le modèle. Reformulez ou complétez la transcription.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Le compte rendu a été tronqué. Réessayez avec une transcription plus courte.");
  }
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Réponse vide du modèle");
  return JSON.parse(text);
}

function messageErreurApi(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return [401, "Clé API Anthropic refusée : vérifiez-la dans « Appareils & cabinet » → Clé API."];
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return [403, "Cette clé API n'a pas accès au modèle. Vérifiez votre compte sur console.anthropic.com."];
  }
  if (err instanceof Anthropic.RateLimitError) return [429, "Trop de requêtes, réessayez dans un instant."];
  if (err instanceof Anthropic.APIConnectionError) return [502, "Pas de connexion à internet ou à l'API Anthropic."];
  if (err instanceof Anthropic.APIError) return [502, `Erreur API (${err.status}) : ${err.message}`];
  return [500, err.message || "Erreur inattendue"];
}

export function demarrerServeur({ port = 8787, dossierStatique, fichierConfig, fichierHistorique = FICHIER_HISTORIQUE } = {}) {
  const config = creerConfig(fichierConfig);
  const historique = creerHistorique(fichierHistorique);
  const statique = dossierStatique ? resolve(dossierStatique) : null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://local").pathname;

    if (url.startsWith("/api/") && !hoteAutorise(req)) {
      return sendJson(res, 403, { error: "Hôte non autorisé." });
    }
    const coffre = url.startsWith("/api/historique") || url.startsWith("/api/patients");
    const sensible = req.method === "POST" || coffre;
    if (sensible && !origineAutorisee(req)) {
      return sendJson(res, 403, { error: "Origine non autorisée." });
    }

    if (coffre) {
      try {
        const route = url.startsWith("/api/patients") ? routePatients : routeHistorique;
        const resultat = await route(historique, req, res, url);
        if (res.headersSent) return undefined;
        return sendJson(res, 200, resultat || { ok: true });
      } catch (err) {
        if (!(err instanceof ErreurHistorique) && err.message !== "JSON invalide") console.error(err);
        return sendJson(res, err.statut || 400, { error: err.message });
      }
    }

    if (req.method === "GET" && url === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        model: MODEL,
        cle: Boolean(config.cleApi()),
        cleModifiable: config.modifiable,
        whisper: etatWhisper(),
      });
    }

    if (req.method === "POST" && url === "/api/cle") {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
      const cle = typeof body.cle === "string" ? body.cle.trim() : "";
      if (!config.modifiable) return sendJson(res, 400, { error: "Clé non modifiable ici : utilisez le fichier .env." });
      if (!cle.startsWith("sk-ant-")) return sendJson(res, 400, { error: "Ce n'est pas une clé API Anthropic (elle commence par sk-ant-)." });
      try {
        // Vérifie la clé avant de l'enregistrer.
        await new Anthropic({ apiKey: cle }).models.list({ limit: 1 });
      } catch (err) {
        return sendJson(res, 400, { error: messageErreurApi(err)[1] });
      }
      config.ecrire({ cleApi: cle });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url === "/api/transcription") {
      try {
        const wav = await readBody(req, MAX_AUDIO_BYTES);
        if (wav.length < 44) return sendJson(res, 400, { error: "Audio vide." });
        return sendJson(res, 200, { texte: await transcrire(wav) });
      } catch (err) {
        return sendJson(res, 503, { error: err.message });
      }
    }

    if (req.method === "POST" && url === "/api/compte-rendu") {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }

      const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
      const appareils = Array.isArray(body.appareils)
        ? body.appareils.filter((a) => a && typeof a.id === "string" && typeof a.nom === "string")
        : [];
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      const cle = config.cleApi();
      if (!cle) {
        return sendJson(res, 400, { error: "Clé API absente : renseignez-la dans « Appareils & cabinet » → Clé API." });
      }
      if (!transcript && !notes) {
        return sendJson(res, 400, { error: "La transcription est vide." });
      }

      try {
        const report = await generateReport(new Anthropic({ apiKey: cle }), { transcript, appareils, notes });
        return sendJson(res, 200, { report });
      } catch (err) {
        if (!(err instanceof Anthropic.APIError)) console.error(err);
        const [statut, message] = messageErreurApi(err);
        return sendJson(res, statut, { error: message });
      }
    }

    if (url.startsWith("/api/")) return sendJson(res, 404, { error: "Route inconnue" });
    if (req.method === "GET" && statique && servirFichier(statique, req, res)) return undefined;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Page introuvable");
    return undefined;
  });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", async () => {
      console.log(`Serveur OrthoAI prêt sur http://127.0.0.1:${port} (modèle ${MODEL})`);
      if (!config.cleApi()) console.warn("Attention : aucune clé API Anthropic configurée.");
      console.log(await demarrerWhisper());
      resolvePromise(server);
    });
  });
}
