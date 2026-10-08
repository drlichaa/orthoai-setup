import { useCallback, useEffect, useRef, useState } from "react";

// Enregistre le micro et envoie l'audio par segments au serveur local, qui le
// transcrit avec Whisper. Les segments sont coupés pendant un silence pour ne
// pas couper un mot, ce qui permet d'avoir le texte au fur et à mesure.

const FREQUENCE_WHISPER = 16000;
const DUREE_MIN_SEGMENT = 20; // s : on cherche un silence à partir de là
const DUREE_MAX_SEGMENT = 45; // s : coupe forcée
const SILENCE_POUR_COUPER = 0.4; // s
const PAROLE_MIN = 0.5; // s de parole pour qu'un segment soit envoyé
const TENTATIVES = 3;

export const enregistrementDisponible =
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof AudioWorkletNode !== "undefined";

const CODE_WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.tampon = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    if (canal) {
      for (let i = 0; i < canal.length; i++) {
        this.tampon[this.n++] = canal[i];
        if (this.n === this.tampon.length) { this.port.postMessage(this.tampon.slice()); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("capture", Capture);
`;

function reechantillonner(blocs, frequenceSource) {
  const total = blocs.reduce((s, b) => s + b.length, 0);
  const source = new Float32Array(total);
  let pos = 0;
  for (const b of blocs) {
    source.set(b, pos);
    pos += b.length;
  }
  const ratio = frequenceSource / FREQUENCE_WHISPER;
  const sortie = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < sortie.length; i++) {
    const debut = Math.floor(i * ratio);
    const fin = Math.min(total, Math.max(debut + 1, Math.floor((i + 1) * ratio)));
    let somme = 0;
    for (let j = debut; j < fin; j++) somme += source[j];
    sortie[i] = somme / (fin - debut);
  }
  return sortie;
}

function encoderWav(echantillons) {
  const tampon = new ArrayBuffer(44 + echantillons.length * 2);
  const vue = new DataView(tampon);
  const ecrire = (offset, texte) => [...texte].forEach((c, i) => vue.setUint8(offset + i, c.charCodeAt(0)));
  ecrire(0, "RIFF");
  vue.setUint32(4, 36 + echantillons.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  vue.setUint32(16, 16, true);
  vue.setUint16(20, 1, true);
  vue.setUint16(22, 1, true);
  vue.setUint32(24, FREQUENCE_WHISPER, true);
  vue.setUint32(28, FREQUENCE_WHISPER * 2, true);
  vue.setUint16(32, 2, true);
  vue.setUint16(34, 16, true);
  ecrire(36, "data");
  vue.setUint32(40, echantillons.length * 2, true);
  for (let i = 0; i < echantillons.length; i++) {
    const s = Math.max(-1, Math.min(1, echantillons[i]));
    vue.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([tampon], { type: "audio/wav" });
}

async function envoyer(wav) {
  const rep = await fetch("/api/transcription", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(donnees.error || `Erreur de transcription (${rep.status})`);
  return donnees.texte || "";
}

export default function useEnregistrement({ onTexte }) {
  const [enCours, setEnCours] = useState(false);
  const [enAttente, setEnAttente] = useState(0);
  const [echecs, setEchecs] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const [erreur, setErreur] = useState("");

  const onTexteRef = useRef(onTexte);
  const audioRef = useRef(null); // { contexte, flux, noeud }
  const segmentRef = useRef({ blocs: [], duree: 0, silence: 0, parole: 0 });
  const fondRef = useRef(0.01);
  const fileRef = useRef(Promise.resolve());
  const echecsRef = useRef([]);

  useEffect(() => {
    onTexteRef.current = onTexte;
  }, [onTexte]);

  const traiter = useCallback(async (wav) => {
    for (let essai = 1; essai <= TENTATIVES; essai++) {
      try {
        const texte = await envoyer(wav);
        if (texte) onTexteRef.current(texte);
        setErreur("");
        return true;
      } catch (err) {
        setErreur(err.message);
        if (essai < TENTATIVES) await new Promise((r) => setTimeout(r, 3000 * essai));
      }
    }
    return false;
  }, []);

  // Les segments sont transcrits un par un, dans l'ordre.
  const mettreEnFile = useCallback(
    (wav) => {
      setEnAttente((n) => n + 1);
      fileRef.current = fileRef.current.then(async () => {
        const ok = await traiter(wav);
        if (!ok) {
          echecsRef.current.push(wav);
          setEchecs(echecsRef.current.length);
        }
        setEnAttente((n) => n - 1);
      });
    },
    [traiter],
  );

  const cloturerSegment = useCallback(() => {
    const seg = segmentRef.current;
    segmentRef.current = { blocs: [], duree: 0, silence: 0, parole: 0 };
    if (!audioRef.current || seg.parole < PAROLE_MIN) return;
    const echantillons = reechantillonner(seg.blocs, audioRef.current.contexte.sampleRate);
    mettreEnFile(encoderWav(echantillons));
  }, [mettreEnFile]);

  const recevoirBloc = useCallback(
    (bloc) => {
      const frequence = audioRef.current.contexte.sampleRate;
      const duree = bloc.length / frequence;
      let somme = 0;
      for (let i = 0; i < bloc.length; i++) somme += bloc[i] * bloc[i];
      const rms = Math.sqrt(somme / bloc.length);

      // Seuil adaptatif au bruit de fond de la pièce.
      fondRef.current = rms < fondRef.current ? rms : fondRef.current * 1.002;
      const parle = rms > fondRef.current * 3 + 0.003;
      setNiveau(Math.min(1, rms * 8));

      const seg = segmentRef.current;
      seg.blocs.push(bloc);
      seg.duree += duree;
      if (parle) {
        seg.parole += duree;
        seg.silence = 0;
      } else {
        seg.silence += duree;
      }
      if ((seg.duree >= DUREE_MIN_SEGMENT && seg.silence >= SILENCE_POUR_COUPER) || seg.duree >= DUREE_MAX_SEGMENT) {
        cloturerSegment();
      }
    },
    [cloturerSegment],
  );

  const demarrer = useCallback(async () => {
    if (audioRef.current) return;
    setErreur("");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const contexte = new AudioContext();
      const url = URL.createObjectURL(new Blob([CODE_WORKLET], { type: "application/javascript" }));
      await contexte.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const source = contexte.createMediaStreamSource(flux);
      const noeud = new AudioWorkletNode(contexte, "capture");
      noeud.port.onmessage = (e) => recevoirBloc(e.data);
      source.connect(noeud);
      audioRef.current = { contexte, flux, noeud };
      setEnCours(true);
    } catch (err) {
      setErreur(
        err.name === "NotAllowedError"
          ? "Accès au micro refusé. Autorisez le micro dans le navigateur."
          : `Micro indisponible : ${err.message}`,
      );
    }
  }, [recevoirBloc]);

  const arreter = useCallback(() => {
    if (!audioRef.current) return;
    cloturerSegment();
    const { contexte, flux, noeud } = audioRef.current;
    noeud.port.onmessage = null;
    flux.getTracks().forEach((t) => t.stop());
    contexte.close();
    audioRef.current = null;
    setEnCours(false);
    setNiveau(0);
  }, [cloturerSegment]);

  const reessayer = useCallback(() => {
    const aRejouer = echecsRef.current;
    echecsRef.current = [];
    setEchecs(0);
    aRejouer.forEach(mettreEnFile);
  }, [mettreEnFile]);

  const oublierEchecs = useCallback(() => {
    echecsRef.current = [];
    setEchecs(0);
  }, []);

  useEffect(
    () => () => {
      if (!audioRef.current) return;
      audioRef.current.flux.getTracks().forEach((t) => t.stop());
      audioRef.current.contexte.close();
      audioRef.current = null;
    },
    [],
  );

  return { enCours, enAttente, echecs, niveau, erreur, demarrer, arreter, reessayer, oublierEchecs };
}
