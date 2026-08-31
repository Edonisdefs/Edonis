import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { createSkyMaterial } from '../lib/materials.js';
import { uniforms } from '../lib/sceneState.js';
import { sunPosition } from './sunPath.js';

/**
 * Background dome. It carries the mood from a near-black studio to dusk, and
 * tracks the sun so the halo sits where the light actually comes from.
 */
export default function SkyDome() {
  const material = useMemo(() => createSkyMaterial(uniforms), []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const dir = material.uniforms.uSunDir.value;
    sunPosition(uniforms.uLight.value, dir);
    dir.normalize();
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[380, 32, 16]} />
    </mesh>
  );
}
