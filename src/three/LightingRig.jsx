import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { uniforms } from '../lib/sceneState.js';
import { sunPosition } from './sunPath.js';

const COLD = new Color('#c9dcf0');
const WARM = new Color('#ffd3a4');
const FILL_COLD = new Color('#2a3a4a');
const FILL_WARM = new Color('#4e6c8c');

const _c = new Color();

/** Half-width of the shadow frustum: building, terrace and the near planting. */
const SHADOW_EXTENT = 32;

/**
 * One key light travelling a real arc, plus a cool fill and a hemisphere lift.
 * Everything reads the `uLight` phase value, so the sun move and the warm-up
 * are the same animation.
 */
export default function LightingRig({ settings }) {
  const sun = useRef();
  const fill = useRef();
  const hemi = useRef();

  /**
   * Three never recomputes the shadow camera's projection after its frustum is
   * assigned, so without this the map covers the default 10 m box and the
   * building falls straight out of it.
   */
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -SHADOW_EXTENT;
    cam.right = SHADOW_EXTENT;
    cam.top = SHADOW_EXTENT;
    cam.bottom = -SHADOW_EXTENT;
    cam.near = 4;
    cam.far = 150;
    cam.updateProjectionMatrix();
    light.shadow.needsUpdate = true;
  }, [settings.shadows, settings.shadowMapSize]);

  useFrame(() => {
    const t = uniforms.uLight.value;
    if (sun.current) {
      sunPosition(t, sun.current.position);
      sun.current.intensity = 1.9 + t * 1.9;
      sun.current.color.copy(_c.copy(COLD).lerp(WARM, t));
    }
    if (fill.current) {
      fill.current.intensity = 0.34 - t * 0.18;
      fill.current.color.copy(_c.copy(FILL_COLD).lerp(FILL_WARM, t));
    }
    if (hemi.current) hemi.current.intensity = 0.36 - t * 0.20;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#3a5170', '#0a0c0e', 0.36]} />
      <directionalLight
        ref={sun}
        castShadow={settings.shadows}
        shadow-mapSize-width={settings.shadowMapSize}
        shadow-mapSize-height={settings.shadowMapSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <directionalLight ref={fill} position={[-26, 14, -20]} />
    </>
  );
}
