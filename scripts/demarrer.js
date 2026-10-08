// Lance le serveur local (et Whisper) puis l'interface, et ouvre le navigateur.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const racine = resolve(import.meta.dirname, "..");
const URL_APP = "http://localhost:5173/consultation.html";

function lancer(nom, args) {
  const enfant = spawn(process.execPath, args, { cwd: racine, stdio: ["ignore", "pipe", "pipe"] });
  const afficher = (flux) => (d) =>
    d
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((ligne) => flux.write(`[${nom}] ${ligne}\n`));
  enfant.stdout.on("data", afficher(process.stdout));
  enfant.stderr.on("data", afficher(process.stderr));
  enfant.on("exit", (code) => {
    console.log(`[${nom}] arrêté (code ${code})`);
    process.exit(code ?? 0);
  });
  return enfant;
}

function ouvrirNavigateur(url) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

async function attendre(url, timeoutMs) {
  const fin = Date.now() + timeoutMs;
  while (Date.now() < fin) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const enfants = [
  lancer("serveur", ["--env-file-if-exists=.env", "server/index.js"]),
  lancer("interface", ["node_modules/vite/bin/vite.js", "--port", "5173", "--strictPort"]),
];
const arreter = () => enfants.forEach((e) => e.kill());
process.on("SIGINT", () => {
  arreter();
  process.exit(0);
});
process.on("exit", arreter);

if (await attendre(URL_APP, 30_000)) {
  console.log(`\nApplication prête : ${URL_APP}\nFermez cette fenêtre pour tout arrêter.\n`);
  if (!process.env.PAS_DE_NAVIGATEUR) ouvrirNavigateur(URL_APP);
}
