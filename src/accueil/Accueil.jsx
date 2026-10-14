const MODULES = [
  {
    href: "/consultation.html#patients",
    icone: "🗂️",
    titre: "Patients",
    texte: "Dossiers patients : diagnostic, plan de traitement, suivi des séances, photos et radios.",
  },
  {
    href: "/consultation.html",
    icone: "🎙️",
    titre: "Compte rendu de consultation",
    texte: "Enregistrez la première consultation et obtenez un compte rendu prêt à remettre au patient.",
  },
  {
    href: "/index.html",
    icone: "🦷",
    titre: "Segmentation 3D",
    texte: "Importez un fichier STL, segmentez les dents et planifiez les déplacements.",
  },
];

export default function Accueil() {
  return (
    <main className="ac-page">
      <header className="ac-entete">
        <div className="ac-logo">🦷</div>
        <div>
          <h1>OrthoAI</h1>
          <p>Logiciel d'orthodontie</p>
        </div>
      </header>
      <div className="ac-modules">
        {MODULES.map((m) => (
          <a key={m.href} className="ac-module" href={m.href}>
            <span className="ac-icone" aria-hidden="true">
              {m.icone}
            </span>
            <h2>{m.titre}</h2>
            <p>{m.texte}</p>
          </a>
        ))}
      </div>
      <p className="ac-aide">Raccourcis : ⌘1 accueil · ⌘2 segmentation · ⌘3 compte rendu · ⌘4 patients</p>
    </main>
  );
}
