// Serveur du compte rendu de première consultation.
// Reçoit la transcription brute de la consultation et renvoie un compte rendu
// structuré (JSON) généré par Claude. La clé API reste côté serveur.
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildReportSchema } from "./prompt.js";

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const client = new Anthropic();
const cleConfiguree = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Requête trop volumineuse"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

async function generateReport({ transcript, appareils, notes }) {
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

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    return sendJson(res, 200, { ok: true, model: MODEL });
  }
  if (req.method !== "POST" || req.url !== "/api/compte-rendu") {
    return sendJson(res, 404, { error: "Route inconnue" });
  }

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
  if (!cleConfiguree) {
    return sendJson(res, 500, { error: "Clé API absente : renseignez ANTHROPIC_API_KEY dans le fichier .env puis relancez le serveur." });
  }
  if (!transcript && !notes) {
    return sendJson(res, 400, { error: "La transcription est vide." });
  }

  try {
    const report = await generateReport({ transcript, appareils, notes });
    return sendJson(res, 200, { report });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return sendJson(res, 500, { error: "Clé API Anthropic invalide ou absente (ANTHROPIC_API_KEY)." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return sendJson(res, 429, { error: "Trop de requêtes, réessayez dans un instant." });
    }
    if (err instanceof Anthropic.APIError) {
      return sendJson(res, 502, { error: `Erreur API (${err.status}) : ${err.message}` });
    }
    console.error(err);
    return sendJson(res, 500, { error: err.message || "Erreur inattendue" });
  }
});

server.listen(PORT, () => {
  console.log(`Serveur compte rendu prêt sur http://localhost:${PORT} (modèle ${MODEL})`);
  if (!cleConfiguree) console.warn("Attention : ANTHROPIC_API_KEY n'est pas définie (fichier .env).");
});
