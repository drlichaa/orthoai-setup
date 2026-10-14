// Application de bureau OrthoAI : une fenêtre qui regroupe la segmentation 3D
// et le compte rendu de consultation. Le serveur local et Whisper sont
// lancés automatiquement et arrêtés à la fermeture.
import { app, BrowserWindow, dialog, Menu, session, shell, systemPreferences } from "electron";
import { join } from "node:path";
import { demarrerServeur } from "../server/app.js";
import { FICHIER_CONFIG } from "../server/chemins.js";
import { arreterWhisper } from "../server/whisper.js";

const PORT = 8787;
const ORIGINE = `http://127.0.0.1:${PORT}`;
const PAGES = {
  accueil: `${ORIGINE}/accueil.html`,
  segmentation: `${ORIGINE}/index.html`,
  consultation: `${ORIGINE}/consultation.html`,
  patients: `${ORIGINE}/consultation.html#patients`,
};

let fenetre = null;

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "OrthoAI",
    backgroundColor: "#f5f6f8",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  fenetre.loadURL(PAGES.accueil);

  // Les liens externes s'ouvrent dans le navigateur, pas dans l'application.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  fenetre.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGINE)) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
  fenetre.on("closed", () => {
    fenetre = null;
  });
}

function aller(page) {
  if (!fenetre) creerFenetre();
  fenetre.loadURL(PAGES[page]);
}

function creerMenu() {
  const estMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(estMac ? [{ role: "appMenu" }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "Aller à",
        submenu: [
          { label: "Accueil", accelerator: "CmdOrCtrl+1", click: () => aller("accueil") },
          { label: "Segmentation 3D", accelerator: "CmdOrCtrl+2", click: () => aller("segmentation") },
          { label: "Compte rendu de consultation", accelerator: "CmdOrCtrl+3", click: () => aller("consultation") },
          { label: "Patients", accelerator: "CmdOrCtrl+4", click: () => aller("patients") },
        ],
      },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}

// Le micro n'est accordé qu'aux pages de l'application elle-même.
function autoriserMicro() {
  const autorise = (webContents, permission) =>
    ["media", "audioCapture"].includes(permission) && webContents.getURL().startsWith(ORIGINE);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(autorise(wc, permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => Boolean(wc) && autorise(wc, permission));
  if (process.platform === "darwin") systemPreferences.askForMediaAccess("microphone").catch(() => {});
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!fenetre) return creerFenetre();
    if (fenetre.isMinimized()) fenetre.restore();
    fenetre.focus();
    return undefined;
  });

  app.whenReady().then(async () => {
    autoriserMicro();
    creerMenu();
    try {
      await demarrerServeur({ port: PORT, dossierStatique: join(app.getAppPath(), "dist"), fichierConfig: FICHIER_CONFIG });
    } catch (err) {
      const message =
        err.code === "EADDRINUSE"
          ? "OrthoAI est déjà en cours d'exécution ailleurs (par exemple une fenêtre Terminal lancée avec Demarrer). Fermez-la puis rouvrez l'application."
          : `Le serveur local n'a pas pu démarrer : ${err.message}`;
      dialog.showErrorBox("OrthoAI", message);
      app.quit();
      return;
    }
    creerFenetre();
    app.on("activate", () => {
      if (!fenetre) creerFenetre();
    });
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", arreterWhisper);
}
