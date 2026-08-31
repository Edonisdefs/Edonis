/**
 * One key light travelling a real arc, plus a cool fill and a hemisphere lift.
 * Everything reads `uLight`, so the sun move and the warm-up are one animation.
 */

import { Color, DirectionalLight, HemisphereLight } from 'three';
import { sunPosition } from '../../src/three/sunPath.js';

const COLD = new Color('#c9dcf0');
const WARM = new Color('#ffd3a4');
const FILL_COLD = new Color('#2a3a4a');
const FILL_WARM = new Color('#4e6c8c');
const _c = new Color();

/** Half-width of the shadow frustum: building, terrace and the near planting. */
const SHADOW_EXTENT = 32;

export function createLighting(scene, settings) {
  const hemi = new HemisphereLight('#3a5170', '#0a0c0e', 0.36);

  const sun = new DirectionalLight(0xffffff, 1.9);
  sun.castShadow = settings.shadows;
  sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;

  // Three never recomputes the shadow camera's projection after its frustum is
  // assigned; without this the map covers the default 10 m box and the building
  // falls straight out of it.
  const cam = sun.shadow.camera;
  cam.left = -SHADOW_EXTENT;
  cam.right = SHADOW_EXTENT;
  cam.top = SHADOW_EXTENT;
  cam.bottom = -SHADOW_EXTENT;
  cam.near = 4;
  cam.far = 150;
  cam.updateProjectionMatrix();

  const fill = new DirectionalLight(0xffffff, 0.34);
  fill.position.set(-26, 14, -20);

  scene.add(hemi, sun, sun.target, fill);

  return {
    update(uniforms) {
      const t = uniforms.uLight.value;
      sunPosition(t, sun.position);
      sun.intensity = 1.9 + t * 1.9;
      sun.color.copy(_c.copy(COLD).lerp(WARM, t));
      fill.intensity = 0.34 - t * 0.18;
      fill.color.copy(_c.copy(FILL_COLD).lerp(FILL_WARM, t));
      hemi.intensity = 0.36 - t * 0.2;
    },
    dispose() {
      scene.remove(hemi, sun, sun.target, fill);
      hemi.dispose();
      sun.dispose();
      fill.dispose();
    },
  };
}
