import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// Aperçu 3D d'une empreinte (fichier STL) : rotation à la souris, molette pour zoomer.
export default function VisionneuseSTL({ src, nom, onFermer }) {
  const conteneur = useRef(null);
  const [etat, setEtat] = useState("Chargement de l'empreinte…");

  useEffect(() => {
    const zone = conteneur.current;
    let rendu;
    try {
      rendu = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      Promise.resolve().then(() => setEtat("L'affichage 3D n'est pas disponible sur cet ordinateur."));
      return undefined;
    }
    rendu.setPixelRatio(window.devicePixelRatio);
    rendu.setSize(zone.clientWidth, zone.clientHeight);
    rendu.setClearColor(0x1d2433);
    zone.appendChild(rendu.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, zone.clientWidth / zone.clientHeight, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.2));
    const lumiere = new THREE.DirectionalLight(0xffffff, 1.4);
    camera.add(lumiere);
    scene.add(camera);
    const controles = new OrbitControls(camera, rendu.domElement);
    controles.enableDamping = true;

    let actif = true;
    let image;
    const animer = () => {
      if (!actif) return;
      controles.update();
      rendu.render(scene, camera);
      image = requestAnimationFrame(animer);
    };

    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error("Empreinte introuvable.");
        return r.arrayBuffer();
      })
      .then((octets) => {
        if (!actif) return;
        const geometrie = new STLLoader().parse(octets);
        geometrie.computeVertexNormals();
        geometrie.center();
        geometrie.computeBoundingSphere();
        const rayon = geometrie.boundingSphere.radius || 50;
        const maillage = new THREE.Mesh(
          geometrie,
          new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.55, metalness: 0.05 }),
        );
        scene.add(maillage);
        camera.position.set(0, -rayon * 0.6, rayon * 2.6);
        camera.lookAt(0, 0, 0);
        controles.update();
        setEtat("");
        animer();
      })
      .catch((err) => actif && setEtat(err.message || "Fichier STL illisible."));

    const redimensionner = () => {
      camera.aspect = zone.clientWidth / zone.clientHeight;
      camera.updateProjectionMatrix();
      rendu.setSize(zone.clientWidth, zone.clientHeight);
    };
    window.addEventListener("resize", redimensionner);
    return () => {
      actif = false;
      cancelAnimationFrame(image);
      window.removeEventListener("resize", redimensionner);
      controles.dispose();
      rendu.dispose();
      rendu.domElement.remove();
    };
  }, [src]);

  return (
    <div className="cr-visionneuse cr-visionneuse-stl" role="dialog" aria-label={nom}>
      <div className="cr-visionneuse-barre">
        <span>{nom} · glisser pour tourner, molette pour zoomer</span>
        <button type="button" className="secondaire" onClick={onFermer}>
          Fermer
        </button>
      </div>
      <div className="cr-stl-zone">
        {/* Zone gérée par three.js uniquement (pas d'élément React à l'intérieur). */}
        <div ref={conteneur} className="cr-stl-toile" />
        {etat && <p className="cr-stl-etat">{etat}</p>}
      </div>
    </div>
  );
}
