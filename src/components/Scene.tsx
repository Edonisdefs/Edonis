import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useConfigStore, Module } from '../store';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';

function Grid() {
  const gridRef = useRef<THREE.Mesh>(null!);
  const { scene } = useThree();
  useEffect(() => {
    scene.add(new THREE.GridHelper(20, 20));
  }, [scene]);
  return <mesh ref={gridRef} />;
}

function ModuleMesh({ module }: { module: Module }) {
  const [hovered, setHovered] = useState(false);
  const selectModule = useConfigStore((s) => s.selectModule);
  const selectedId = useConfigStore((s) => s.selectedId);
  const color = module.type === 'wall' ? 'orange' : module.type === 'window' ? 'skyblue' : module.type === 'roof' ? 'brown' : 'gray';
  const geometry = module.type === 'roof' ? <coneGeometry args={[0.5, 1, 4]} /> : <boxGeometry args={[1, 1, 0.1]} />;
  return (
    <mesh
      position={module.position}
      rotation={module.rotation as any}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); selectModule(module.id); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); selectModule(module.id); setContext({id: module.id, x: e.clientX, y: e.clientY}); }}
    >
      {geometry}
      <meshStandardMaterial color={hovered || selectedId === module.id ? 'yellow' : color} />
    </mesh>
  );
}

function Ghost() {
  const ghost = useConfigStore((s) => s.ghost);
  if (!ghost) return null;
  const geometry = ghost.type === 'roof' ? <coneGeometry args={[0.5,1,4]} /> : <boxGeometry args={[1,1,0.1]} />;
  return (
    <mesh position={ghost.position} rotation={ghost.rotation as any}>
      {geometry}
      <meshStandardMaterial color="white" transparent opacity={0.5} />
    </mesh>
  );
}

function Controls() {
  const { camera, gl } = useThree();
  return <OrbitControls makeDefault enablePan enableZoom enableRotate target={[0,0,0]} />;
}

function SceneContent() {
  const setScene = useConfigStore((s) => s.setScene);
  const { scene } = useThree();
  useEffect(() => {
    setScene(scene);
  }, [scene]);
  return null;
}

export function Scene() {
  const modules = useConfigStore((s) => s.modules);
  const addModule = useConfigStore((s) => s.addModule);
  const ghost = useConfigStore((s) => s.ghost);
  const setGhost = useConfigStore((s) => s.setGhost);
  const selectedType = useConfigStore((s) => s.selectedType);
  const selectedId = useConfigStore((s) => s.selectedId);
  const updateModule = useConfigStore((s) => s.updateModule);
  const removeModule = useConfigStore((s) => s.removeModule);
  const selectModule = useConfigStore((s) => s.selectModule);

  const [context, setContext] = useState<{id: string; x: number; y: number} | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === 'Delete') {
        removeModule(selectedId);
        selectModule(null);
      }
      if (e.key.toLowerCase() === 'r') {
        const mod = modules.find((m) => m.id === selectedId);
        if (mod) {
          updateModule(selectedId, { rotation: [mod.rotation[0], mod.rotation[1] + Math.PI/2, mod.rotation[2]] });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, modules]);

  const { size } = useThree();

  return (
    <div className="w-full h-full" onClick={() => setContext(null)}>
      <Canvas
        className="bg-gray-50"
        onPointerMove={(e) => {
          const [x, y, z] = [Math.round(e.point.x), 0, Math.round(e.point.z)];
          setGhost({ id: 'ghost', type: selectedType, position: [x, y, z], rotation: [0,0,0], price: 100 });
        }}
        onClick={(e) => {
          if (!ghost) return;
          addModule({ ...ghost, id: Math.random().toString(36).substr(2, 9) });
        }}
      >
        <SceneContent />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} />
        <Controls />
        <Grid />
        {modules.map((m) => (
          <ModuleMesh key={m.id} module={m} />
        ))}
        <Ghost />
      </Canvas>
      {context && (
        <div
          className="absolute bg-white border shadow p-2 space-y-1"
          style={{ top: context.y, left: context.x }}
        >
          <button className="block" onClick={() => { const m = modules.find(mod => mod.id === context.id); if(m) updateModule(context.id, { rotation: [m.rotation[0], m.rotation[1] + Math.PI/2, m.rotation[2]] }); setContext(null); }}>Drehen</button>
          <button className="block" onClick={() => { const m = modules.find(mod => mod.id === context.id); if(m) addModule({ ...m, id: Math.random().toString(36).substr(2,9) }); setContext(null); }}>Duplizieren</button>
          <button className="block" onClick={() => { removeModule(context.id); setContext(null); }}>Löschen</button>
        </div>
      )}
    </div>
  );
}
