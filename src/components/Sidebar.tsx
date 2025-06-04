import React from 'react';
import { useConfigStore } from '../store';
import { GLTFExporter } from 'three-stdlib';

export function Sidebar() {
  const modules = useConfigStore((s) => s.modules);
  const undo = useConfigStore((s) => s.undo);
  const redo = useConfigStore((s) => s.redo);
  const scene = useConfigStore((s) => s.scene);

  const saveJson = () => {
    const blob = new Blob([JSON.stringify(modules)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.json';
    a.click();
  };

  const loadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        // Replace modules entirely
        useConfigStore.setState({ modules: data });
      } catch (err) {
        console.error(err);
      }
    });
  };

  const exportGLTF = () => {
    if (!scene) return;
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
      const blob = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'model.gltf';
      a.click();
    });
  };

  const total = modules.reduce((sum, m) => sum + m.price, 0);

  return (
    <div className="w-60 bg-gray-100 p-4 space-y-2 overflow-y-auto">
      <h2 className="text-lg font-bold">Module</h2>
      <ul>
        {modules.map((m) => (
          <li key={m.id}>{m.type} ({m.price}€)</li>
        ))}
      </ul>
      <div className="font-bold">Gesamt: {total}€</div>
      <div className="flex gap-2">
        <button onClick={undo} className="px-2 py-1 bg-gray-200 rounded">Undo</button>
        <button onClick={redo} className="px-2 py-1 bg-gray-200 rounded">Redo</button>
        <button onClick={exportGLTF} className="px-2 py-1 bg-gray-200 rounded">Export glTF</button>
      </div>
      <div className="flex gap-2">
        <button onClick={saveJson} className="px-2 py-1 bg-gray-200 rounded">Save</button>
        <label className="px-2 py-1 bg-gray-200 rounded cursor-pointer">
          Load
          <input type="file" accept="application/json" onChange={loadJson} className="hidden" />
        </label>
      </div>
    </div>
  );
}
