// Réglages du cabinet et catalogue des appareils avec leurs textes pré-enregistrés.
import CleApi from "./CleApi.jsx";
import { OPERATIONS, SCENARIOS_PAR_DEFAUT } from "./scenarios.js";

function identifiant(nom, existants) {
  const base =
    nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "appareil";
  let id = base;
  let n = 2;
  while (existants.includes(id)) id = `${base}_${n++}`;
  return id;
}

// Réduit l'image (logo, signature) pour qu'elle tienne dans le stockage local.
async function lireImage(fichier, tailleMax = 600) {
  const url = await new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.onerror = reject;
    lecteur.readAsDataURL(fichier);
  });
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Image illisible : choisissez un fichier PNG ou JPG."));
    image.src = url;
  });
  const echelle = Math.min(1, tailleMax / Math.max(image.width, image.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  toile.getContext("2d").drawImage(image, 0, 0, toile.width, toile.height);
  return toile.toDataURL("image/png");
}

function ChampImage({ libelle, valeur, onChange }) {
  async function choisir(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      onChange(await lireImage(fichier));
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div className="cr-champ-image">
      <span>{libelle}</span>
      {valeur ? <img src={valeur} alt="" /> : <em>Aucune image</em>}
      <div className="cr-actions">
        <label className="cr-bouton-fichier">
          {valeur ? "Remplacer" : "Choisir une image"}
          <input type="file" accept="image/png,image/jpeg" onChange={choisir} />
        </label>
        {valeur && (
          <button type="button" className="danger" onClick={() => onChange("")}>
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}

// Opérations appliquées automatiquement à chaque photo d'un scénario, dans l'ordre.
function EditeurScenarios({ scenarios, onChange, onReinitialiser }) {
  const modifier = (s, e, rang, valeur) =>
    onChange(
      scenarios.map((sc, i) =>
        i !== s
          ? sc
          : {
              ...sc,
              elements: sc.elements.map((el, j) => {
                if (j !== e) return el;
                const operations = [el.operations[0] || "", el.operations[1] || ""];
                operations[rang] = valeur;
                return { ...el, operations: operations.filter(Boolean) };
              }),
            },
      ),
    );

  return (
    <section className="cr-carte">
      <div className="cr-titre-section">
        <h2>Scénarios photos</h2>
        <button
          type="button"
          className="secondaire"
          onClick={() => window.confirm("Revenir aux scénarios par défaut ?") && onReinitialiser()}
        >
          Réinitialiser
        </button>
      </div>
      <p className="cr-aide">
        Opérations appliquées automatiquement à chaque photo, dans l'ordre (opération 1 puis 2), lors du dépôt des
        photos d'une série. Partagé par tous les postes du cabinet.
      </p>
      {scenarios
        .map((scenario, s) => ({ scenario, s }))
        .filter(({ scenario }) => scenario.genre === "photos")
        .map(({ scenario, s }) => (
          <details key={scenario.id} className="cr-scenario">
            <summary>
              {scenario.nom} ({scenario.elements.length} photos)
            </summary>
            <table className="cr-seances">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Photo</th>
                  <th>Opération 1</th>
                  <th>Opération 2</th>
                </tr>
              </thead>
              <tbody>
                {scenario.elements.map((element, e) => (
                  <tr key={element.cle}>
                    <td>{e + 1}</td>
                    <td>{element.nom}</td>
                    {[0, 1].map((rang) => (
                      <td key={rang}>
                        <select
                          value={element.operations[rang] || ""}
                          aria-label={`${element.nom} : opération ${rang + 1}`}
                          onChange={(ev) => modifier(s, e, rang, ev.target.value)}
                        >
                          {OPERATIONS.map(([cle, libelle]) => (
                            <option key={cle} value={cle}>
                              {libelle}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
    </section>
  );
}

export default function CatalogueAppareils({
  appareils,
  onChange,
  onReinitialiser,
  cabinet,
  onCabinetChange,
  onFermer,
}) {
  const maj = (index, champ, valeur) =>
    onChange(appareils.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a)));

  function ajouter() {
    const nom = window.prompt("Nom du nouvel appareil ?");
    if (!nom?.trim()) return;
    const id = identifiant(
      nom,
      appareils.map((a) => a.id),
    );
    onChange([...appareils, { id, nom: nom.trim(), indication: "", texte: "" }]);
  }

  function supprimer(index) {
    if (!window.confirm(`Supprimer « ${appareils[index].nom} » ?`)) return;
    onChange(appareils.filter((_, i) => i !== index));
  }

  function deplacer(index, sens) {
    const cible = index + sens;
    if (cible < 0 || cible >= appareils.length) return;
    const copie = [...appareils];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    onChange(copie);
  }

  return (
    <div className="cr-app">
      <header className="cr-entete">
        <h1>Appareils &amp; cabinet</h1>
        <div className="cr-actions">
          <button type="button" className="principal" onClick={onFermer}>
            Retour à la consultation
          </button>
        </div>
      </header>

      <section className="cr-carte">
        <h2>En-tête du compte rendu et des courriers</h2>
        <div className="cr-champs-ligne cr-champs-larges">
          <label>
            Praticien
            <input
              value={cabinet.praticien}
              placeholder="Dr Prénom Nom, orthodontiste"
              onChange={(e) => onCabinetChange({ ...cabinet, praticien: e.target.value })}
            />
          </label>
          <label>
            Cabinet
            <input value={cabinet.cabinet} onChange={(e) => onCabinetChange({ ...cabinet, cabinet: e.target.value })} />
          </label>
          <label>
            Adresse
            <input
              value={cabinet.coordonnees}
              placeholder="Adresse"
              onChange={(e) => onCabinetChange({ ...cabinet, coordonnees: e.target.value })}
            />
          </label>
          <label>
            Téléphone
            <input
              type="tel"
              value={cabinet.telephone}
              onChange={(e) => onCabinetChange({ ...cabinet, telephone: e.target.value })}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={cabinet.email}
              onChange={(e) => onCabinetChange({ ...cabinet, email: e.target.value })}
            />
          </label>
          <label>
            Le praticien est
            <select
              value={cabinet.genre || ""}
              onChange={(e) => onCabinetChange({ ...cabinet, genre: e.target.value })}
            >
              <option value="F">une femme (« reconnaissante », « informée »)</option>
              <option value="M">un homme (« reconnaissant », « informé »)</option>
              <option value="">non précisé (« reconnaissant(e) »)</option>
            </select>
          </label>
          <label>
            Ville (date des courriers)
            <input
              value={cabinet.ville}
              placeholder="Le Chesnay-Rocquencourt"
              onChange={(e) => onCabinetChange({ ...cabinet, ville: e.target.value })}
            />
          </label>
          <label>
            N° ADELI / RPPS
            <input
              value={cabinet.identifiant}
              onChange={(e) => onCabinetChange({ ...cabinet, identifiant: e.target.value })}
            />
          </label>
        </div>
        <div className="cr-champs-ligne cr-images">
          <ChampImage
            libelle="Logo (courriers et ordonnances)"
            valeur={cabinet.logo}
            onChange={(logo) => onCabinetChange({ ...cabinet, logo })}
          />
          <ChampImage
            libelle="Signature (scan ou photo sur fond blanc)"
            valeur={cabinet.signature}
            onChange={(signature) => onCabinetChange({ ...cabinet, signature })}
          />
        </div>
      </section>

      <EditeurScenarios
        scenarios={cabinet.scenarios?.length ? cabinet.scenarios : SCENARIOS_PAR_DEFAUT}
        onChange={(scenarios) => onCabinetChange({ ...cabinet, scenarios })}
        onReinitialiser={() => onCabinetChange({ ...cabinet, scenarios: [] })}
      />

      <CleApi />

      <section className="cr-carte">
        <div className="cr-titre-section">
          <h2>Appareils</h2>
          <div className="cr-actions">
            <button type="button" className="secondaire" onClick={ajouter}>
              + Ajouter un appareil
            </button>
            <button
              type="button"
              className="secondaire"
              onClick={() => window.confirm("Revenir au catalogue par défaut ?") && onReinitialiser()}
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <p className="cr-aide">
          Le nom et l'indication aident l'IA à reconnaître l'appareil que vous proposez à l'oral. Le texte est recopié
          tel quel dans le compte rendu. Tout est enregistré dans ce navigateur.
        </p>
        {appareils.map((a, i) => (
          <div key={a.id} className="cr-appareil-edition">
            <div className="cr-champs-ligne">
              <label>
                Nom
                <input value={a.nom} onChange={(e) => maj(i, "nom", e.target.value)} />
              </label>
              <label>
                Indication (mots-clés)
                <input value={a.indication} onChange={(e) => maj(i, "indication", e.target.value)} />
              </label>
              <div className="cr-actions">
                <button type="button" className="secondaire" onClick={() => deplacer(i, -1)} aria-label="Monter">
                  ↑
                </button>
                <button type="button" className="secondaire" onClick={() => deplacer(i, 1)} aria-label="Descendre">
                  ↓
                </button>
                <button type="button" className="danger" onClick={() => supprimer(i)}>
                  Supprimer
                </button>
              </div>
            </div>
            <label className="cr-bloc">
              Texte remis au patient
              <textarea rows={4} value={a.texte} onChange={(e) => maj(i, "texte", e.target.value)} />
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}
