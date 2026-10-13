import { useEffect, useState } from "react";

// Saisie de la clé API Anthropic : elle est vérifiée puis enregistrée sur cet
// ordinateur par le serveur local, et n'est jamais réaffichée.
export default function CleApi() {
  const [configuree, setConfiguree] = useState(null);
  const [cle, setCle] = useState("");
  const [etat, setEtat] = useState({ type: "", message: "" });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setConfiguree(Boolean(d.cle)))
      .catch(() => setConfiguree(false));
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setEtat({ type: "", message: "" });
    try {
      const rep = await fetch("/api/cle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cle }),
      });
      const donnees = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(donnees.error || `Erreur ${rep.status}`);
      setCle("");
      setConfiguree(true);
      setEtat({ type: "ok", message: "Clé vérifiée et enregistrée sur cet ordinateur." });
    } catch (err) {
      setEtat({ type: "erreur", message: err.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="cr-carte">
      <h2>Clé API Anthropic</h2>
      <p className="cr-aide">
        {configuree === null
          ? "Vérification…"
          : configuree
            ? "✓ Une clé est configurée. Pour la remplacer, collez la nouvelle ci-dessous."
            : "Aucune clé configurée : elle est nécessaire pour rédiger les comptes rendus."}{" "}
        Créez-la sur console.anthropic.com (rubrique API Keys). Elle reste sur cet ordinateur et n'est jamais affichée.
      </p>
      <form className="cr-cle" onSubmit={enregistrer}>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={cle}
          onChange={(e) => setCle(e.target.value)}
          aria-label="Clé API Anthropic"
        />
        <button type="submit" className="principal" disabled={envoi || !cle.trim()}>
          {envoi ? "Vérification…" : "Vérifier et enregistrer"}
        </button>
      </form>
      {etat.message && <p className={etat.type === "ok" ? "cr-ok" : "cr-alerte"}>{etat.message}</p>}
    </section>
  );
}
