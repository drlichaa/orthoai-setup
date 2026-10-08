import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const dicteeDisponible = Boolean(SpeechRecognition);

// Reconnaissance vocale continue en français (Web Speech API).
// Le navigateur coupe l'écoute après un silence : on relance automatiquement
// tant que l'enregistrement n'a pas été arrêté.
export default function useDictee({ onTexteFinal }) {
  const [enCours, setEnCours] = useState(false);
  const [provisoire, setProvisoire] = useState("");
  const [erreur, setErreur] = useState("");
  const recoRef = useRef(null);
  const actifRef = useRef(false);
  const onTexteFinalRef = useRef(onTexteFinal);

  useEffect(() => {
    onTexteFinalRef.current = onTexteFinal;
  }, [onTexteFinal]);

  const demarrer = useCallback(() => {
    if (!SpeechRecognition || actifRef.current) return;
    const reco = new SpeechRecognition();
    reco.lang = "fr-FR";
    reco.continuous = true;
    reco.interimResults = true;

    reco.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) onTexteFinalRef.current(res[0].transcript.trim());
        else interim += res[0].transcript;
      }
      setProvisoire(interim);
    };
    reco.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        actifRef.current = false;
        setEnCours(false);
        setErreur("Accès au micro refusé. Autorisez le micro dans le navigateur.");
        return;
      }
      setErreur(`Reconnaissance vocale : ${event.error}`);
    };
    reco.onend = () => {
      setProvisoire("");
      if (actifRef.current) {
        try {
          reco.start();
        } catch {
          // déjà relancée
        }
      } else {
        setEnCours(false);
      }
    };

    recoRef.current = reco;
    actifRef.current = true;
    setErreur("");
    setEnCours(true);
    reco.start();
  }, []);

  const arreter = useCallback(() => {
    actifRef.current = false;
    recoRef.current?.stop();
  }, []);

  useEffect(() => () => {
    actifRef.current = false;
    recoRef.current?.abort();
  }, []);

  return { enCours, provisoire, erreur, demarrer, arreter };
}
