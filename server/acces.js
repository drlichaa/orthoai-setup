// Accès depuis les autres ordinateurs du cabinet, via Tailscale (réseau privé
// chiffré) : « tailscale serve » publie le serveur local en HTTPS sur une
// adresse en .ts.net, visible uniquement des appareils du cabinet.
// Les postes distants doivent se connecter avec le mot de passe du coffre ;
// l'ordinateur serveur lui-même (localhost) n'est pas concerné.
import { randomBytes } from "node:crypto";

const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = "orthoai_session";

const LOCAUX = ["localhost", "127.0.0.1"];

function nomHote(valeur) {
  return (valeur || "").split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

// Nom sous lequel la page a été demandée (derrière Tailscale : l'adresse .ts.net).
export function hoteDemande(req) {
  return nomHote(req.headers["x-forwarded-host"]) || nomHote(req.headers.host);
}

export function estDistant(req) {
  return Boolean(req.headers["x-forwarded-for"] || req.headers["tailscale-user-login"]) || hoteDemande(req).endsWith(".ts.net");
}

// Refuse les requêtes adressées sous un autre nom que cet ordinateur ou son
// adresse Tailscale (protection contre le « DNS rebinding »).
export function hoteAutorise(req) {
  const hotes = [nomHote(req.headers.host), nomHote(req.headers["x-forwarded-host"])].filter(Boolean);
  return hotes.every((h) => LOCAUX.includes(h) || h.endsWith(".ts.net"));
}

// Seules les pages servies par OrthoAI lui-même peuvent appeler l'API.
export function origineAutorisee(req) {
  const origine = req.headers.origin;
  if (!origine) return true;
  try {
    const { hostname } = new URL(origine);
    return LOCAUX.includes(hostname) || (hostname.endsWith(".ts.net") && hostname === hoteDemande(req));
  } catch {
    return false;
  }
}

export function creerSessions() {
  const sessions = new Map();

  function jeton(req) {
    const cookies = req.headers.cookie || "";
    const trouve = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
    return trouve ? trouve.slice(COOKIE.length + 1) : "";
  }

  return {
    valide(req) {
      const id = jeton(req);
      const expire = sessions.get(id);
      if (!expire || expire < Date.now()) {
        sessions.delete(id);
        return false;
      }
      sessions.set(id, Date.now() + DUREE_SESSION_MS);
      return true;
    },
    ouvrir(res) {
      const id = randomBytes(32).toString("base64url");
      sessions.set(id, Date.now() + DUREE_SESSION_MS);
      res.setHeader("Set-Cookie", `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE_SESSION_MS / 1000}`);
    },
    fermer(req, res) {
      sessions.delete(jeton(req));
      res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    },
  };
}

export const PAGE_CONNEXION = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OrthoAI — Connexion</title>
<style>
  :root { color-scheme: light; font: 16px/1.5 system-ui, "Segoe UI", Roboto, sans-serif; color: #1d2433; background: #f5f6f8; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: #f5f6f8; }
  form { background: #fff; border: 1px solid #dde1e8; border-radius: 14px; padding: 28px; width: min(380px, 100%); }
  h1 { margin: 0 0 4px; font-size: 1.4rem; }
  p { margin: 0 0 18px; color: #5b6577; font-size: 0.9rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; color: #5b6577; margin-bottom: 6px; }
  input { font: inherit; width: 100%; box-sizing: border-box; border: 1px solid #dde1e8; border-radius: 8px; padding: 10px 12px; }
  button { font: inherit; font-weight: 600; width: 100%; margin-top: 14px; padding: 10px; border: 0; border-radius: 8px; background: #1f6feb; color: #fff; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .erreur { color: #b54708; background: #fff4e5; border-radius: 8px; padding: 8px 12px; margin-top: 12px; font-size: 0.9rem; }
</style>
</head>
<body>
<form id="f">
  <h1>🦷 OrthoAI</h1>
  <p>Connexion au serveur du cabinet</p>
  <label for="mdp">Mot de passe</label>
  <input id="mdp" type="password" autocomplete="current-password" autofocus required>
  <button id="b" type="submit">Se connecter</button>
  <div id="e" class="erreur" hidden></div>
</form>
<script>
  document.getElementById("f").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const b = document.getElementById("b"), e = document.getElementById("e");
    b.disabled = true; e.hidden = true;
    try {
      const r = await fetch("/api/session/connexion", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse: document.getElementById("mdp").value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Connexion impossible.");
      location.reload();
    } catch (err) { e.textContent = err.message; e.hidden = false; b.disabled = false; }
  });
</script>
</body>
</html>`;
