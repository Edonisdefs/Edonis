import { useEffect, useMemo } from 'react';
import { buildBlueprintGeometry } from '../lib/blueprint.js';
import { createBlueprintMaterial } from '../lib/materials.js';
import { uniforms } from '../lib/sceneState.js';

/** Phase 1 — the plan, traced line by line on the ground plane. */
export default function Blueprint() {
  const { geometry, material } = useMemo(
    () => ({ geometry: buildBlueprintGeometry(), material: createBlueprintMaterial(uniforms) }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      position={[0, 0.02, 0]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
