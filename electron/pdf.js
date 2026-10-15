// HTML → PDF avec le moteur d'impression d'Electron (documents joints aux e-mails).
// Fenêtre invisible, sans accès au réseau ni à Node : seul le document est affiché.
import { BrowserWindow } from "electron";

export function creerGenerateurPdf(origine) {
  return async function genererPdf(html) {
    const fenetre = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        javascript: false,
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        // Session à part : le filtre réseau ci-dessous ne touche pas la fenêtre principale.
        partition: "orthoai-pdf",
      },
    });
    try {
      // Seules les images du serveur local (fond du Cerfa DEP…) sont autorisées.
      fenetre.webContents.session.webRequest.onBeforeRequest({ urls: ["*://*/*"] }, (details, rappel) =>
        rappel({ cancel: !details.url.startsWith(origine) }),
      );
      const page = html.replace("<head>", `<head><base href="${origine}/">`);
      await fenetre.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(page).toString("base64")}`);
      return await fenetre.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
    } finally {
      fenetre.destroy();
    }
  };
}
