import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DIM } from '../lib/buildingModel.js';
import { createGroundMaterial, createWaterMaterial } from '../lib/materials.js';
import { uniforms } from '../lib/sceneState.js';

/** Site plane and pool. Both fade up with the environment phase. */
export default function Landscape({ settings }) {
  const water = useRef();
  const materials = useMemo(() => {
    const ground = createGroundMaterial(uniforms);
    ground.envMapIntensity = 0.3;
    return { ground, water: createWaterMaterial(uniforms) };
  }, []);

  useEffect(
    () => () => {
      materials.ground.dispose();
      materials.water.dispose();
    },
    [materials],
  );

  // The pool only exists once the site does; before that it would sit in the
  // middle of the drawing.
  useFrame(() => {
    if (water.current) water.current.visible = uniforms.uEnv.value > 0.02;
  });

  const poolW = DIM.poolX1 - DIM.poolX0;
  const poolD = DIM.poolZ1 - DIM.poolZ0;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, 2]}
        material={materials.ground}
        receiveShadow={settings.shadows}
      >
        <planeGeometry args={[260, 260, 2, 2]} />
      </mesh>

      {settings.water ? (
        <mesh
          ref={water}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(DIM.poolX0 + DIM.poolX1) / 2, -0.12, (DIM.poolZ0 + DIM.poolZ1) / 2]}
          material={materials.water}
        >
          <planeGeometry args={[poolW, poolD, 1, 1]} />
        </mesh>
      ) : null}
    </group>
  );
}
