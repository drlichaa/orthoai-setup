// Réglages du cabinet et catalogue des appareils avec leurs textes pré-enregistrés.

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

export default function CatalogueAppareils({ appareils, onChange, onReinitialiser, cabinet, onCabinetChange, onFermer }) {
  const maj = (index, champ, valeur) => onChange(appareils.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a)));

  function ajouter() {
    const nom = window.prompt("Nom du nouvel appareil ?");
    if (!nom?.trim()) return;
    const id = identifiant(nom, appareils.map((a) => a.id));
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
        <h2>En-tête du compte rendu</h2>
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
        </div>
      </section>

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
          Le nom et l'indication aident l'IA à reconnaître l'appareil que vous proposez à l'oral. Le texte est recopié tel
          quel dans le compte rendu. Tout est enregistré dans ce navigateur.
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
