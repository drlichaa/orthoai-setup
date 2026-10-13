import { useState, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";

function parseBinarySTL(buffer) {
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  const positions = [];
  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    for (let j = 0; j < 3; j++) {
      const vOffset = offset + 12 + j * 12;
      positions.push(view.getFloat32(vOffset,true), view.getFloat32(vOffset+4,true), view.getFloat32(vOffset+8,true));
    }
  }
  return new Float32Array(positions);
}

function parseASCIISTL(text) {
  const positions = [];
  const vertexRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
  let m;
  while ((m = vertexRe.exec(text)) !== null) positions.push(parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3]));
  return new Float32Array(positions);
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255];
}

function downloadSTL(buffer, filename) {
  const blob = new Blob([buffer],{type:"application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

const FDI_COLORS = {
  "11":"#ff6b6b","12":"#ff8e53","13":"#ffcd3c","14":"#2ecc71","15":"#1abc9c",
  "16":"#3498db","17":"#9b59b6","18":"#e91e63","21":"#ff6b6b","22":"#ff8e53",
  "23":"#ffcd3c","24":"#2ecc71","25":"#1abc9c","26":"#3498db","27":"#9b59b6",
  "28":"#e91e63","31":"#f39c12","32":"#d35400","33":"#c0392b","34":"#8e44ad",
  "35":"#2980b9","36":"#27ae60","37":"#16a085","38":"#2c3e50","41":"#f39c12",
  "42":"#d35400","43":"#c0392b","44":"#8e44ad","45":"#2980b9","46":"#27ae60",
  "47":"#16a085","48":"#2c3e50"
};

const FDI_NAMES = ["11","12","13","14","15","16","17","18","21","22","23","24","25","26","27","28","31","32","33","34","35","36","37","38","41","42","43","44","45","46","47","48"];

function buildAdjacency(positions) {
  const numTriangles = positions.length / 9;
  const edgeMap = new Map();
  const adj = new Array(numTriangles).fill(null).map(() => []);
  for (let i = 0; i < numTriangles; i++) {
    const verts = [];
    for (let j = 0; j < 3; j++) verts.push(`${Math.round(positions[i*9+j*3]*1000)},${Math.round(positions[i*9+j*3+1]*1000)},${Math.round(positions[i*9+j*3+2]*1000)}`);
    for (let j = 0; j < 3; j++) {
      const key = [verts[j],verts[(j+1)%3]].sort().join("|");
      if (!edgeMap.has(key)) edgeMap.set(key,[]);
      edgeMap.get(key).push(i);
    }
  }
  for (const [,tris] of edgeMap) {
    if (tris.length===2) { adj[tris[0]].push(tris[1]); adj[tris[1]].push(tris[0]); }
  }
  return adj;
}

function floodFill3D(seedTriangle, adj, triangleColorsRef, maxTriangles=8000) {
  const visited = new Set();
  const queue = [seedTriangle];
  visited.add(seedTriangle);
  let count = 0;
  while (queue.length>0 && count<maxTriangles) {
    const current = queue.shift();
    count++;
    for (const neighbor of adj[current]) {
      if (!visited.has(neighbor) && !triangleColorsRef.current[neighbor]) { visited.add(neighbor); queue.push(neighbor); }
    }
  }
  return visited;
}

function AnimatedMesh({ positions, paintModeActive, fillModeActive, brushSize, selectedFdi, erasing, isMouseDown, toothMovements, triangleColorsRef, animT, onPaint, onFloodFill, onMeshReady }) {
  const meshRef = useRef();
  const colorArrayRef = useRef(null);
  const posRef = useRef(null);

  useEffect(() => {
    if (!positions || positions.length===0) return;
    posRef.current = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(),3));
    geo.computeVertexNormals();
    const numTriangles = positions.length/9;
    const colors = new Float32Array(numTriangles*9);
    for (let i=0;i<numTriangles*3;i++) { colors[i*3]=0.91; colors[i*3+1]=0.835; colors[i*3+2]=0.753; }
    colorArrayRef.current = colors;
    geo.setAttribute("color", new THREE.BufferAttribute(colors,3));
    if (meshRef.current) meshRef.current.geometry = geo;
    if (onMeshReady) onMeshReady(meshRef, colorArrayRef);
  }, [positions]);

  useFrame(() => {
    if (!meshRef.current || !posRef.current || animT===null) return;
    const pos = posRef.current;
    const numTri = pos.length/9;
    const posAttr = meshRef.current.geometry.attributes.position;
    const arr = posAttr.array;
    for (let i=0;i<numTri;i++) {
      const fdi = triangleColorsRef.current[i];
      const mv = (fdi && toothMovements[fdi]) ? toothMovements[fdi] : null;
      const dx = mv?(mv.tx||0)*animT:0;
      const dy = mv?(mv.ty||0)*animT:0;
      const dz = mv?(mv.tz||0)*animT:0;
      for (let j=0;j<3;j++) {
        arr[i*9+j*3]   = pos[i*9+j*3]+dx;
        arr[i*9+j*3+1] = pos[i*9+j*3+1]+dz;
        arr[i*9+j*3+2] = pos[i*9+j*3+2]+dy;
      }
    }
    posAttr.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  const applyColor = useCallback((triangleSet, fdi, colors, meshRef) => {
    let r=0.91,g=0.835,b=0.753;
    if (fdi && FDI_COLORS[fdi]) [r,g,b]=hexToRgb(FDI_COLORS[fdi]);
    for (const i of triangleSet) {
      for (let j=0;j<3;j++) { colors[(i*3+j)*3]=r; colors[(i*3+j)*3+1]=g; colors[(i*3+j)*3+2]=b; }
    }
    meshRef.current.geometry.attributes.color.needsUpdate=true;
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (!paintModeActive && !fillModeActive) return;
    e.stopPropagation();
    if (fillModeActive && e.faceIndex!==undefined) { onFloodFill(e.faceIndex,selectedFdi,colorArrayRef,meshRef,applyColor); return; }
    if (paintModeActive && isMouseDown.current) onPaint(e.point,brushSize,erasing?null:selectedFdi,meshRef,colorArrayRef);
  }, [paintModeActive,fillModeActive,onPaint,onFloodFill,brushSize,selectedFdi,erasing,isMouseDown,applyColor]);

  const handlePointerMove = useCallback((e) => {
    if (!paintModeActive||!isMouseDown.current) return;
    e.stopPropagation();
    onPaint(e.point,brushSize,erasing?null:selectedFdi,meshRef,colorArrayRef);
  }, [paintModeActive,onPaint,brushSize,selectedFdi,erasing,isMouseDown]);

  return (
    <mesh ref={meshRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
      <bufferGeometry/>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} side={THREE.DoubleSide}/>
    </mesh>
  );
}

function Scene({ positions, paintModeActive, fillModeActive, brushSize, selectedFdi, erasing, isMouseDown, toothMovements, triangleColorsRef, animT, onPaint, onFloodFill, onMeshReady }) {
  return (
    <>
      <ambientLight intensity={0.7}/>
      <directionalLight position={[10,20,10]} intensity={1.0}/>
      <directionalLight position={[-10,-10,-10]} intensity={0.3}/>
      <OrbitControls enabled={!paintModeActive&&!fillModeActive} makeDefault/>
      <GizmoHelper alignment="bottom-right" margin={[80,80]}><GizmoViewport/></GizmoHelper>
      {positions && <AnimatedMesh positions={positions} paintModeActive={paintModeActive} fillModeActive={fillModeActive} brushSize={brushSize} selectedFdi={selectedFdi} erasing={erasing} isMouseDown={isMouseDown} toothMovements={toothMovements} triangleColorsRef={triangleColorsRef} animT={animT} onPaint={onPaint} onFloodFill={onFloodFill} onMeshReady={onMeshReady}/>}
    </>
  );
}

export default function App() {
  const [positions, setPositions] = useState(null);
  const [adjacency, setAdjacency] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [buildingAdj, setBuildingAdj] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetectMode, setAutoDetectMode] = useState(null);
  const [tab, setTab] = useState("paint");
  const [selectedFdi, setSelectedFdi] = useState("11");
  const [brushSize, setBrushSize] = useState(3);
  const [paintModeActive, setPaintModeActive] = useState(false);
  const [fillModeActive, setFillModeActive] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [assignedTeeth, setAssignedTeeth] = useState({});
  const [toothMovements, setToothMovements] = useState({});
  const [selectedMoveTooth, setSelectedMoveTooth] = useState(null);
  const [numSteps, setNumSteps] = useState(20);
  const [exporting, setExporting] = useState(false);
  const [animT, setAnimT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isUpper, setIsUpper] = useState(true);
  const [history, setHistory] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);
  const animRef = useRef(null);
  const fileRef = useRef();
  const rawBufferRef = useRef(null);
  const posRef = useRef(null);
  const adjRef = useRef(null);
  const triangleColorsRef = useRef({});
  const isMouseDown = useRef(false);
  const canvasContainerRef = useRef(null);
  const meshRefStore = useRef(null);
  const colorArrayRefStore = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(r => r.json())
      .then(() => setBackendStatus("ok"))
      .catch(() => setBackendStatus("error"));
  }, []);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const onDown = (e) => { if (e.button===0) isMouseDown.current=true; };
    const onUp = () => { isMouseDown.current=false; };
    container.addEventListener("mousedown",onDown);
    window.addEventListener("mouseup",onUp);
    return () => { container.removeEventListener("mousedown",onDown); window.removeEventListener("mouseup",onUp); };
  }, []);

  useEffect(() => {
    if (playing) {
      animRef.current = setInterval(() => {
        setCurrentStep(s => { if (s>=numSteps) { setPlaying(false); return numSteps; } return s+1; });
      }, 300);
    } else clearInterval(animRef.current);
    return () => clearInterval(animRef.current);
  }, [playing,numSteps]);

  useEffect(() => { setAnimT(currentStep/numSteps); }, [currentStep,numSteps]);

  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target.result;
      rawBufferRef.current = buf;
      const uint8 = new Uint8Array(buf);
      const isBinary = !(uint8[0]===115&&uint8[1]===111);
      let pos;
      if (isBinary) pos=parseBinarySTL(buf);
      else { const text=new TextDecoder().decode(buf); pos=parseASCIISTL(text); }
      setPositions(pos); posRef.current=pos;
      triangleColorsRef.current={};
      setAssignedTeeth({}); setToothMovements({});
      setCurrentStep(0); setAnimT(0); setPlaying(false);
      setHistory([]);
      setLoading(false);
      setBuildingAdj(true);
      setTimeout(() => {
        const adj=buildAdjacency(pos);
        adjRef.current=adj; setAdjacency(adj); setBuildingAdj(false);
      },200);
    };
    reader.readAsArrayBuffer(file);
  },[]);

  const handleMeshReady = useCallback((mRef, cRef) => {
    meshRefStore.current = mRef;
    colorArrayRefStore.current = cRef;
  },[]);

  const updateAssignedTeeth = useCallback(() => {
    const counts = {};
    for (const f of Object.values(triangleColorsRef.current)) { if (f) counts[f]=(counts[f]||0)+1; }
    setAssignedTeeth(counts);
  },[]);

  const applyColorsToMesh = useCallback((assignments) => {
    const mRef = meshRefStore.current;
    const cRef = colorArrayRefStore.current;
    if (!mRef?.current || !cRef?.current || !posRef.current) return;
    const colors = cRef.current;
    const numTri = posRef.current.length/9;
    for (let i=0;i<numTri;i++) {
      const fdi = assignments[i];
      let r=0.91,g=0.835,b=0.753;
      if (fdi && FDI_COLORS[fdi]) [r,g,b]=hexToRgb(FDI_COLORS[fdi]);
      for (let j=0;j<3;j++) { colors[(i*3+j)*3]=r; colors[(i*3+j)*3+1]=g; colors[(i*3+j)*3+2]=b; }
    }
    mRef.current.geometry.attributes.color.needsUpdate=true;
  },[]);

  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-9), {...triangleColorsRef.current}]);
  },[]);

  const handleUndo = useCallback(() => {
    if (history.length===0) return;
    const prev = history[history.length-1];
    triangleColorsRef.current = {...prev};
    setHistory(h => h.slice(0,-1));
    applyColorsToMesh(prev);
    updateAssignedTeeth();
  },[history,applyColorsToMesh,updateAssignedTeeth]);

  const handleAutoDetect = useCallback(async () => {
    if (!posRef.current) return;
    setAutoDetecting(true);
    saveHistory();
    if (rawBufferRef.current && backendStatus === "ok") {
      try {
        const blob = new Blob([rawBufferRef.current], {type:"application/octet-stream"});
        const formData = new FormData();
        formData.append("file", blob, "scan.stl");
        const res = await fetch(`http://localhost:8000/segment?is_upper=${isUpper}`, {method:"POST", body:formData});
        if (res.ok) {
          const data = await res.json();
          const assignments = {};
          for (const [k,v] of Object.entries(data.assignments)) assignments[parseInt(k)]=v;
          triangleColorsRef.current = assignments;
          applyColorsToMesh(assignments);
          updateAssignedTeeth();
          setAutoDetecting(false);
          setAutoDetectMode("backend");
          return;
        }
      } catch(e) { console.warn("Backend indisponible:", e); }
    }
    setAutoDetectMode("local");
    const pos = posRef.current;
    const numTri = pos.length / 9;
    const CHUNK = 10000;
    const assignments = {};
    let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    for (let i=0;i<numTri;i++) {
      const cx=(pos[i*9]+pos[i*9+3]+pos[i*9+6])/3;
      const cz=(pos[i*9+2]+pos[i*9+5]+pos[i*9+8])/3;
      if (cx<minX) minX=cx; if (cx>maxX) maxX=cx;
      if (cz<minZ) minZ=cz; if (cz>maxZ) maxZ=cz;
    }
    const centerX=(minX+maxX)/2, centerZ=(minZ+maxZ)/2;
    const rangeX=maxX-minX, rangeZ=maxZ-minZ;
    let chunk=0;
    function processChunk() {
      const start=chunk*CHUNK, end=Math.min(start+CHUNK,numTri);
      for (let i=start;i<end;i++) {
        const cx=(pos[i*9]+pos[i*9+3]+pos[i*9+6])/3;
        const cz=(pos[i*9+2]+pos[i*9+5]+pos[i*9+8])/3;
        const nx=(cx-centerX)/(rangeX/2), nz=(cz-centerZ)/(rangeZ/2);
        const angle=Math.atan2(nx,-nz)*(180/Math.PI), a=Math.abs(angle);
        let fdi;
        if (isUpper) {
          if (angle>=0) { if(a<15)fdi="11";else if(a<28)fdi="12";else if(a<42)fdi="13";else if(a<56)fdi="14";else if(a<68)fdi="15";else if(a<78)fdi="16";else if(a<87)fdi="17";else fdi="18"; }
          else { if(a<15)fdi="21";else if(a<28)fdi="22";else if(a<42)fdi="23";else if(a<56)fdi="24";else if(a<68)fdi="25";else if(a<78)fdi="26";else if(a<87)fdi="27";else fdi="28"; }
        } else {
          if (angle>=0) { if(a<15)fdi="41";else if(a<28)fdi="42";else if(a<42)fdi="43";else if(a<56)fdi="44";else if(a<68)fdi="45";else if(a<78)fdi="46";else if(a<87)fdi="47";else fdi="48"; }
          else { if(a<15)fdi="31";else if(a<28)fdi="32";else if(a<42)fdi="33";else if(a<56)fdi="34";else if(a<68)fdi="35";else if(a<78)fdi="36";else if(a<87)fdi="37";else fdi="38"; }
        }
        assignments[i]=fdi;
      }
      chunk++;
      if (end<numTri) setTimeout(processChunk,0);
      else { triangleColorsRef.current=assignments; applyColorsToMesh(assignments); updateAssignedTeeth(); setAutoDetecting(false); }
    }
    processChunk();
  },[isUpper,saveHistory,applyColorsToMesh,updateAssignedTeeth,backendStatus]);

  const handlePaint = useCallback((point,brush,fdi,mRef,cRef) => {
    if (!posRef.current||!cRef.current||!mRef.current) return;
    const pos=posRef.current; const colors=cRef.current;
    const numTriangles=pos.length/9;
    let changed=false;
    let r=0.91,g=0.835,b=0.753;
    if (fdi&&FDI_COLORS[fdi]) [r,g,b]=hexToRgb(FDI_COLORS[fdi]);
    for (let i=0;i<numTriangles;i++) {
      const cx=(pos[i*9]+pos[i*9+3]+pos[i*9+6])/3;
      const cy=(pos[i*9+1]+pos[i*9+4]+pos[i*9+7])/3;
      const cz=(pos[i*9+2]+pos[i*9+5]+pos[i*9+8])/3;
      const dx=cx-point.x,dy=cy-point.y,dz=cz-point.z;
      if (Math.sqrt(dx*dx+dy*dy+dz*dz)<brush) {
        for (let j=0;j<3;j++) { colors[(i*3+j)*3]=r; colors[(i*3+j)*3+1]=g; colors[(i*3+j)*3+2]=b; }
        if (fdi) triangleColorsRef.current[i]=fdi; else delete triangleColorsRef.current[i];
        changed=true;
      }
    }
    if (changed) { mRef.current.geometry.attributes.color.needsUpdate=true; updateAssignedTeeth(); }
  },[updateAssignedTeeth]);

  const handleFloodFill = useCallback((seedTriangle,fdi,cRef,mRef,applyColor) => {
    if (!adjRef.current||!cRef.current||!mRef.current) return;
    saveHistory();
    const filled=floodFill3D(seedTriangle,adjRef.current,triangleColorsRef,8000);
    applyColor(filled,fdi,cRef.current,mRef);
    for (const i of filled) { if (fdi) triangleColorsRef.current[i]=fdi; else delete triangleColorsRef.current[i]; }
    updateAssignedTeeth();
  },[saveHistory,updateAssignedTeeth]);

  const updateMovement = (axis,val) => {
    if (!selectedMoveTooth) return;
    setToothMovements(prev => ({...prev,[selectedMoveTooth]:{...(prev[selectedMoveTooth]||{tx:0,ty:0,tz:0,rx:0,ry:0,rz:0}),[axis]:parseFloat(val)||0}}));
  };

  const currentMovement = selectedMoveTooth?(toothMovements[selectedMoveTooth]||{tx:0,ty:0,tz:0,rx:0,ry:0,rz:0}):null;

  const handleExport = async () => {
    if (!posRef.current) return;
    setExporting(true);
    const pos=posRef.current; const numTri=pos.length/9;
    for (let step=1;step<=numSteps;step++) {
      const t=step/numSteps;
      const numBytes=84+numTri*50;
      const buffer=new ArrayBuffer(numBytes);
      const view=new DataView(buffer);
      view.setUint32(80,numTri,true);
      for (let i=0;i<numTri;i++) {
        const fdi=triangleColorsRef.current[i];
        const mv=(fdi&&toothMovements[fdi])?toothMovements[fdi]:null;
        const dx=mv?(mv.tx||0)*t:0; const dy=mv?(mv.ty||0)*t:0; const dz=mv?(mv.tz||0)*t:0;
        const offset=84+i*50;
        view.setFloat32(offset,0,true); view.setFloat32(offset+4,0,true); view.setFloat32(offset+8,1,true);
        for (let j=0;j<3;j++) {
          view.setFloat32(offset+12+j*12,pos[i*9+j*3]+dx,true);
          view.setFloat32(offset+12+j*12+4,pos[i*9+j*3+1]+dz,true);
          view.setFloat32(offset+12+j*12+8,pos[i*9+j*3+2]+dy,true);
        }
        view.setUint16(offset+48,0,true);
      }
      downloadSTL(buffer,`gouttiere_${String(step).padStart(2,'0')}_sur_${numSteps}.stl`);
      await new Promise(r=>setTimeout(r,200));
    }
    setExporting(false);
    alert(`✅ ${numSteps} fichiers STL exportés !`);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#0f1117",color:"#e8eaf0",fontFamily:"system-ui,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",padding:"12px 20px",borderBottom:"1px solid #2a2d3a",background:"#161820",gap:16}}>
        <a href="/accueil.html" style={{color:"#9ca3af",fontSize:13,textDecoration:"none",border:"1px solid #2a2d3a",borderRadius:8,padding:"6px 10px"}}>← Accueil</a>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#4f9cf9,#7c5cbf)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🦷</div>
          <div>
            <div style={{fontWeight:600,fontSize:15}}>OrthoAI Setup</div>
            <div style={{fontSize:11,color:"#6b7280"}}>Logiciel de planification orthodontique</div>
          </div>
        </div>
        <div style={{flex:1}}/>
        <div style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:backendStatus==="ok"?"#1a3a1a":backendStatus==="error"?"#2a1a1a":"#2a2d3a",color:backendStatus==="ok"?"#4ade80":backendStatus==="error"?"#f87171":"#6b7280"}}>
          {backendStatus==="ok"?"🟢 Backend Python actif":backendStatus==="error"?"🔴 Backend hors ligne":"⚪ Vérification..."}
        </div>
        {buildingAdj&&<div style={{fontSize:12,color:"#f59e0b",background:"#2a1f00",padding:"4px 12px",borderRadius:20}}>⚙️ Préparation remplissage...</div>}
        {fileName&&!buildingAdj&&<div style={{fontSize:12,color:"#4f9cf9",background:"#1a2744",padding:"4px 12px",borderRadius:20}}>{fileName}</div>}
        <button onClick={()=>fileRef.current.click()} style={{background:"#4f9cf9",color:"white",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:500}}>
          {loading?"Chargement...":"📂 Importer STL"}
        </button>
        <input ref={fileRef} type="file" accept=".stl" style={{display:"none"}} onChange={handleFile}/>
      </div>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div ref={canvasContainerRef} style={{flex:1,position:"relative"}}>
          {!positions&&!loading&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:"#4b5563"}}>
              <div style={{fontSize:64}}>🦷</div>
              <div style={{fontSize:18,fontWeight:500}}>Importe ton scan STL Trios 5</div>
              <button onClick={()=>fileRef.current.click()} style={{background:"#4f9cf9",color:"white",border:"none",borderRadius:10,padding:"12px 24px",cursor:"pointer",fontSize:14,fontWeight:500}}>📂 Choisir un fichier STL</button>
            </div>
          )}
          {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#4f9cf9",fontSize:16}}>⏳ Chargement...</div>}
          {(paintModeActive||fillModeActive)&&(
            <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:fillModeActive?"#f59e0b":erasing?"#f87171":FDI_COLORS[selectedFdi],color:"white",padding:"8px 20px",borderRadius:20,fontSize:13,fontWeight:500,zIndex:10,pointerEvents:"none"}}>
              {fillModeActive?`🪣 Dent ${selectedFdi} — Clique`:erasing?"🧹 Clic+glisse":`🎨 Dent ${selectedFdi} — Clic+glisse`}
            </div>
          )}
          {positions&&Object.keys(toothMovements).length>0&&(
            <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",background:"rgba(22,24,32,0.95)",borderRadius:16,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,zIndex:10,border:"1px solid #2a2d3a",minWidth:320}}>
              <button onClick={()=>{setCurrentStep(0);setPlaying(false);}} style={{background:"#2a2d3a",color:"#9ca3af",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14}}>⏮</button>
              <button onClick={()=>setPlaying(p=>!p)} style={{background:playing?"#7c5cbf":"#4f9cf9",color:"white",border:"none",borderRadius:10,padding:"8px 20px",cursor:"pointer",fontSize:15,fontWeight:700,minWidth:80}}>
                {playing?"⏸ Pause":"▶ Play"}
              </button>
              <button onClick={()=>{setCurrentStep(numSteps);setPlaying(false);}} style={{background:"#2a2d3a",color:"#9ca3af",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14}}>⏭</button>
              <div style={{flex:1}}>
                <input type="range" min={0} max={numSteps} step={1} value={currentStep} onChange={e=>{setPlaying(false);setCurrentStep(parseInt(e.target.value));}} style={{width:"100%",accentColor:"#4f9cf9"}}/>
              </div>
              <div style={{fontSize:12,color:"#4f9cf9",fontWeight:700,minWidth:40,textAlign:"center"}}>{currentStep}/{numSteps}</div>
            </div>
          )}
          <Canvas camera={{position:[0,30,80],fov:45}} style={{background:"#0f1117",cursor:fillModeActive?"cell":paintModeActive?"crosshair":"grab"}}>
            <Scene positions={positions} paintModeActive={paintModeActive} fillModeActive={fillModeActive} brushSize={brushSize} selectedFdi={selectedFdi} erasing={erasing} isMouseDown={isMouseDown} toothMovements={toothMovements} triangleColorsRef={triangleColorsRef} animT={animT} onPaint={handlePaint} onFloodFill={handleFloodFill} onMeshReady={handleMeshReady}/>
          </Canvas>
        </div>
        <div style={{width:320,background:"#161820",borderLeft:"1px solid #2a2d3a",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:"1px solid #2a2d3a"}}>
            {["paint","move","export"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 0",background:tab===t?"#1e2130":"transparent",color:tab===t?"#4f9cf9":"#6b7280",border:"none",borderBottom:tab===t?"2px solid #4f9cf9":"2px solid transparent",cursor:"pointer",fontSize:11,fontWeight:500}}>
                {t==="paint"?"🎨 Outils":t==="move"?"↔️ Mouvements":"📥 Export"}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:16}}>
            {tab==="paint"&&(
              <div>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:10,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Détection automatique</div>
                <div style={{background:"#1e2130",borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <button onClick={()=>setIsUpper(true)} style={{flex:1,padding:"8px",background:isUpper?"#4f9cf9":"#2a2d3a",color:isUpper?"white":"#9ca3af",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}}>⬆️ Maxillaire</button>
                    <button onClick={()=>setIsUpper(false)} style={{flex:1,padding:"8px",background:!isUpper?"#4f9cf9":"#2a2d3a",color:!isUpper?"white":"#9ca3af",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}}>⬇️ Mandibule</button>
                  </div>
                  <button onClick={handleAutoDetect} disabled={!positions||autoDetecting} style={{width:"100%",padding:"12px",background:positions&&!autoDetecting?"linear-gradient(135deg,#4f9cf9,#7c5cbf)":"#2a2d3a",color:positions&&!autoDetecting?"white":"#4b5563",border:"none",borderRadius:10,cursor:positions&&!autoDetecting?"pointer":"not-allowed",fontSize:13,fontWeight:700}}>
                    {autoDetecting?"⚙️ Détection...":backendStatus==="ok"?"🤖 Détecter (Python)":"🤖 Détecter automatiquement"}
                  </button>
                  {autoDetectMode&&!autoDetecting&&(
                    <div style={{fontSize:10,color:autoDetectMode==="backend"?"#4ade80":"#f59e0b",textAlign:"center",marginTop:6}}>
                      {autoDetectMode==="backend"?"✅ Via backend Python":"⚡ Via algo local"}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:12,color:"#6b7280",fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Outils manuels</div>
                  <button onClick={handleUndo} disabled={history.length===0} style={{padding:"4px 10px",background:history.length>0?"#2a2d3a":"#1e2130",color:history.length>0?"#e8eaf0":"#3a3a3a",border:"none",borderRadius:6,cursor:history.length>0?"pointer":"not-allowed",fontSize:11,fontWeight:500}}>↩️ Annuler ({history.length})</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <button onClick={()=>{setPaintModeActive(!paintModeActive);setFillModeActive(false);setErasing(false);}} style={{padding:"12px 8px",background:paintModeActive&&!erasing?FDI_COLORS[selectedFdi]:"#1e2130",color:paintModeActive&&!erasing?"white":"#9ca3af",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600}}>🎨 {paintModeActive&&!erasing?"Pinceau ✓":"Pinceau"}</button>
                  <button onClick={()=>{setFillModeActive(!fillModeActive);setPaintModeActive(false);setErasing(false);}} disabled={!adjacency} style={{padding:"12px 8px",background:fillModeActive?"#f59e0b":"#1e2130",color:fillModeActive?"white":adjacency?"#9ca3af":"#3a3a3a",border:"none",borderRadius:10,cursor:adjacency?"pointer":"not-allowed",fontSize:12,fontWeight:600}}>🪣 {fillModeActive?"Remplir ✓":buildingAdj?"Calcul...":"Remplir"}</button>
                  <button onClick={()=>{setErasing(!erasing);setPaintModeActive(true);setFillModeActive(false);}} style={{padding:"12px 8px",background:erasing?"#f87171":"#1e2130",color:erasing?"white":"#9ca3af",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600}}>🧹 {erasing?"Gomme ✓":"Gomme"}</button>
                  <button onClick={()=>{setPaintModeActive(false);setFillModeActive(false);setErasing(false);}} style={{padding:"12px 8px",background:"#1e2130",color:"#9ca3af",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600}}>🖱️ Naviguer</button>
                </div>
                {paintModeActive&&!erasing&&(
                  <div style={{background:"#1e2130",borderRadius:10,padding:14,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:13,color:"#9ca3af"}}>Taille pinceau</span>
                      <span style={{fontSize:13,color:"#4f9cf9",fontWeight:600}}>{brushSize} mm</span>
                    </div>
                    <input type="range" min={1} max={15} step={0.5} value={brushSize} onChange={e=>setBrushSize(parseFloat(e.target.value))} style={{width:"100%",accentColor:"#4f9cf9"}}/>
                  </div>
                )}
                <div style={{fontSize:12,color:"#6b7280",marginBottom:8,fontWeight:500}}>Dent sélectionnée</div>
                <div style={{background:"#1e2130",borderRadius:10,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:20,height:20,borderRadius:4,background:FDI_COLORS[selectedFdi]}}/>
                  <span style={{fontSize:16,fontWeight:700,color:"#e8eaf0"}}>Dent {selectedFdi}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3}}>
                  {FDI_NAMES.map(f=>(
                    <button key={f} onClick={()=>{setSelectedFdi(f);setErasing(false);}} style={{padding:"5px 2px",fontSize:9,background:selectedFdi===f?FDI_COLORS[f]:"#1e2130",color:selectedFdi===f?"white":assignedTeeth[f]?FDI_COLORS[f]:"#6b7280",border:assignedTeeth[f]?`1px solid ${FDI_COLORS[f]}`:"none",borderRadius:5,cursor:"pointer",fontWeight:selectedFdi===f?700:400}}>{f}</button>
                  ))}
                </div>
              </div>
            )}
            {tab==="move"&&(
              <div>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:12,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Mouvements dentaires</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3,marginBottom:16}}>
                  {FDI_NAMES.map(f=>(
                    <button key={f} onClick={()=>setSelectedMoveTooth(f)} style={{padding:"5px 2px",fontSize:9,background:selectedMoveTooth===f?FDI_COLORS[f]:toothMovements[f]?"#1a3a2a":"#1e2130",color:selectedMoveTooth===f?"white":toothMovements[f]?"#4ade80":assignedTeeth[f]?FDI_COLORS[f]:"#6b7280",border:selectedMoveTooth===f?`2px solid ${FDI_COLORS[f]}`:assignedTeeth[f]?`1px solid ${FDI_COLORS[f]}`:"none",borderRadius:5,cursor:"pointer",fontWeight:selectedMoveTooth===f?700:400}}>{f}</button>
                  ))}
                </div>
                {selectedMoveTooth&&currentMovement?(
                  <div>
                    <div style={{fontSize:14,color:FDI_COLORS[selectedMoveTooth],fontWeight:700,marginBottom:12}}>Dent {selectedMoveTooth}</div>
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Translations (mm)</div>
                    {[["tx","Mésiodistal",-4,4],["ty","Buccolingual",-3,3],["tz","Intrusion/Extrusion",-2,2]].map(([axis,label,min,max])=>(
                      <div key={axis} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,color:"#9ca3af"}}>{label}</span>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="number" min={min} max={max} step={0.1} value={currentMovement[axis]||0} onChange={e=>updateMovement(axis,e.target.value)} style={{width:60,background:"#0f1117",color:"#4f9cf9",border:"1px solid #2a2d3a",borderRadius:6,padding:"2px 6px",fontSize:12,fontWeight:600,textAlign:"center"}}/>
                            <span style={{fontSize:11,color:"#6b7280"}}>mm</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={currentMovement[axis]||0} onChange={e=>updateMovement(axis,e.target.value)} style={{width:"100%",accentColor:"#4f9cf9"}}/>
                      </div>
                    ))}
                    <div style={{fontSize:11,color:"#6b7280",marginBottom:8,marginTop:12,textTransform:"uppercase",letterSpacing:0.5}}>Rotations (°)</div>
                    {[["rx","Torque",-15,15],["ry","Tip",-10,10],["rz","Rotation",-45,45]].map(([axis,label,min,max])=>(
                      <div key={axis} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,color:"#9ca3af"}}>{label}</span>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="number" min={min} max={max} step={0.5} value={currentMovement[axis]||0} onChange={e=>updateMovement(axis,e.target.value)} style={{width:60,background:"#0f1117",color:"#a78bfa",border:"1px solid #2a2d3a",borderRadius:6,padding:"2px 6px",fontSize:12,fontWeight:600,textAlign:"center"}}/>
                            <span style={{fontSize:11,color:"#6b7280"}}>°</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.5} value={currentMovement[axis]||0} onChange={e=>updateMovement(axis,e.target.value)} style={{width:"100%",accentColor:"#a78bfa"}}/>
                      </div>
                    ))}
                    <button onClick={()=>setToothMovements(prev=>{const n={...prev};delete n[selectedMoveTooth];return n;})} style={{width:"100%",padding:"8px",background:"#2a1a1a",color:"#f87171",border:"1px solid #3a1a1a",borderRadius:8,cursor:"pointer",fontSize:12,marginTop:4}}>Réinitialiser dent {selectedMoveTooth}</button>
                  </div>
                ):(
                  <div style={{color:"#6b7280",fontSize:13,textAlign:"center",marginTop:24}}>Sélectionne une dent pour définir ses mouvements</div>
                )}
              </div>
            )}
            {tab==="export"&&(
              <div>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:12,fontWeight:500,textTransform:"uppercase",letterSpacing:0.5}}>Export STL</div>
                <div style={{background:"#1e2130",borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{fontSize:12,lineHeight:2}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Dents segmentées</span><span style={{color:"#4ade80"}}>{Object.keys(assignedTeeth).length}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Dents avec mouvement</span><span style={{color:"#4f9cf9"}}>{Object.keys(toothMovements).length}</span></div>
                  </div>
                </div>
                <div style={{background:"#1e2130",borderRadius:10,padding:14,marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:13,color:"#9ca3af"}}>Nombre de gouttières</span>
                    <input type="number" min={5} max={60} value={numSteps} onChange={e=>setNumSteps(parseInt(e.target.value)||20)} style={{width:50,background:"#0f1117",color:"#4f9cf9",border:"1px solid #2a2d3a",borderRadius:6,padding:"2px 6px",fontSize:14,fontWeight:700,textAlign:"center"}}/>
                  </div>
                  <input type="range" min={5} max={60} step={1} value={numSteps} onChange={e=>setNumSteps(parseInt(e.target.value))} style={{width:"100%",accentColor:"#4f9cf9"}}/>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:6}}>Durée estimée : ~{Math.round(numSteps*1.5)} semaines</div>
                </div>
                <button onClick={handleExport} disabled={exporting||!positions||Object.keys(toothMovements).length===0} style={{width:"100%",padding:"14px",background:exporting||!positions||Object.keys(toothMovements).length===0?"#2a2d3a":"#4f9cf9",color:exporting||!positions||Object.keys(toothMovements).length===0?"#4b5563":"white",border:"none",borderRadius:10,cursor:exporting||!positions||Object.keys(toothMovements).length===0?"not-allowed":"pointer",fontSize:14,fontWeight:700,marginBottom:8}}>
                  {exporting?`⏳ Export en cours...`:`📥 Exporter ${numSteps} fichiers STL`}
                </button>
                {Object.keys(toothMovements).length===0&&<div style={{fontSize:11,color:"#6b7280",textAlign:"center"}}>Définis d'abord les mouvements dans ↔️</div>}
                <div style={{background:"#1a2a1a",borderRadius:8,padding:10,fontSize:11,color:"#4ade80",lineHeight:1.8,marginTop:12}}>
                  ✅ Fichiers STL numérotés dans l'ordre<br/>
                  🖨️ Imprime sur ta Saturn 4<br/>
                  🦷 Thermoforme sur chaque modèle
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
