// Remplace window.prompt, qui ne s'affiche pas dans l'application de bureau (Electron).
// Renvoie une promesse : le texte saisi (ou la date ISO pour type « date »), ou null si annulé.
export function demander(question, { defaut = "", type = "text" } = {}) {
  return new Promise((resolve) => {
    const fenetre = document.createElement("dialog");
    fenetre.className = "oa-demander";
    const formulaire = document.createElement("form");
    formulaire.method = "dialog";
    const libelle = document.createElement("label");
    libelle.textContent = question;
    const champ = document.createElement("input");
    champ.type = type;
    champ.value = defaut ?? "";
    libelle.append(champ);
    const actions = document.createElement("div");
    actions.className = "cr-actions";
    const annuler = document.createElement("button");
    annuler.type = "button";
    annuler.className = "secondaire";
    annuler.textContent = "Annuler";
    const valider = document.createElement("button");
    valider.type = "submit";
    valider.className = "principal";
    valider.textContent = "Valider";
    actions.append(annuler, valider);
    formulaire.append(libelle, actions);
    fenetre.append(formulaire);
    document.body.append(fenetre);

    let reponse = null;
    annuler.onclick = () => fenetre.close();
    formulaire.onsubmit = () => {
      reponse = champ.value;
    };
    fenetre.addEventListener("close", () => {
      fenetre.remove();
      resolve(reponse);
    });
    fenetre.showModal();
    champ.focus();
    champ.select?.();
  });
}
