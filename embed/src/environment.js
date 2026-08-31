/**
 * Local environment probe.
 *
 * Four light cards rendered once into a PMREM map — the same mood the site's
 * drei `<Environment>` produced, without the dependency and without an HDRI
 * download. Runs a single time at startup.
 */

import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
} from 'three';

const CARDS = [
  // Overhead sky panel
  { color: '#b8cfe8', intensity: 0.6, pos: [0, 14, 0], rot: [Math.PI / 2, 0, 0], scale: [36, 36] },
  // Warm key card, on the sun's side
  { color: '#ffcf9d', intensity: 0.9, pos: [16, 7, 9], rot: [0, -Math.PI / 3.2, 0], scale: [14, 9] },
  // Cool bounce opposite, keeps the shadow side readable
  { color: '#2f4761', intensity: 0.35, pos: [-16, 5, -10], rot: [0, Math.PI / 2.6, 0], scale: [18, 8] },
  // Ground bounce
  { color: '#161c22', intensity: 0.3, pos: [0, -8, 0], rot: [-Math.PI / 2, 0, 0], scale: [36, 36] },
];

const PLANE = new PlaneGeometry(1, 1);

/**
 * @returns {{ texture: import('three').Texture, dispose: () => void }}
 */
export function createEnvironment(renderer) {
  const envScene = new Scene();
  envScene.background = new Color('#0a0e13');

  const disposables = [];
  for (const card of CARDS) {
    const material = new MeshBasicMaterial({
      color: new Color(card.color).multiplyScalar(card.intensity),
      side: DoubleSide,
      toneMapped: false,
    });
    const mesh = new Mesh(PLANE, material);
    mesh.position.set(...card.pos);
    mesh.rotation.set(...card.rot);
    mesh.scale.set(card.scale[0], card.scale[1], 1);
    envScene.add(mesh);
    disposables.push(material);
  }

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0, 0.1, 1000);
  pmrem.dispose();
  disposables.forEach((m) => m.dispose());

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
