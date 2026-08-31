import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { PART_LABELS } from '../lib/buildingModel.js';
import {
  buildSolidGeometry,
  buildWireGeometry,
  partIdFromIntersection,
} from '../lib/geometryBuilders.js';
import {
  createDepthMaterial,
  createSurfaceMaterial,
  createWireMaterial,
} from '../lib/materials.js';
import { uniforms, useUI } from '../lib/sceneState.js';
import { buildDetailLines, buildMassing, buildVilla } from '../lib/villa.js';
import { labelBridge } from '../lib/labelBridge.js';

/**
 * The building. Three draw calls carry every phase: one opaque mesh, one glass
 * mesh and one line set, all sharing the phase uniforms.
 */
export default function Building({ settings, interactive }) {
  const hoverAmt = useRef({ value: 0 });

  const { solid, glass, wire, materials } = useMemo(() => {
    const parts = buildVilla(settings);
    const solidGeo = buildSolidGeometry(parts, { glass: false });
    const glassGeo = buildSolidGeometry(parts, { glass: true });
    const wireGeo = buildWireGeometry(buildMassing(), buildDetailLines());

    return {
      solid: solidGeo,
      glass: glassGeo,
      wire: wireGeo,
      materials: {
        surface: createSurfaceMaterial(uniforms),
        glass: createSurfaceMaterial(uniforms, { glass: true }),
        wire: createWireMaterial(uniforms),
        depth: createDepthMaterial(uniforms),
      },
    };
  }, [settings]);

  useEffect(() => {
    return () => {
      solid?.dispose();
      glass?.dispose();
      wire?.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [solid, glass, wire, materials]);

  /* Environment reflections come up with the lighting phase. */
  useFrame(() => {
    const lit = uniforms.uLight.value;
    materials.surface.envMapIntensity = 0.5 - lit * 0.2;
    materials.glass.envMapIntensity = 0.3 + lit * 1.6;
    uniforms.uHoverAmt.value = hoverAmt.current.value;
  });

  const setHover = useUI((s) => s.setHover);

  const onMove = (event) => {
    if (!interactive) return;
    event.stopPropagation();
    const id = partIdFromIntersection(event);
    if (id < 0) return;
    if (uniforms.uHover.value === id) return;

    uniforms.uHover.value = id;
    const meta = PART_LABELS[id];
    setHover(meta ? { id, ...meta } : null);
    // Anchor where the pointer entered the part and leave it there, so the
    // label reads as a callout rather than a tooltip chasing the cursor.
    if (event.point) labelBridge.anchor.copy(event.point);
    gsap.to(hoverAmt.current, { value: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
  };

  const onOut = () => {
    if (uniforms.uHover.value === -1) return;
    setHover(null);
    gsap.to(hoverAmt.current, {
      value: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: () => {
        uniforms.uHover.value = -1;
      },
    });
  };

  useEffect(() => {
    if (interactive) return undefined;
    onOut();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  return (
    <group>
      <mesh
        geometry={solid}
        material={materials.surface}
        customDepthMaterial={materials.depth}
        castShadow={settings.shadows}
        receiveShadow={settings.shadows}
        onPointerMove={onMove}
        onPointerOut={onOut}
      />
      {glass ? (
        <mesh
          geometry={glass}
          material={materials.glass}
          receiveShadow={settings.shadows}
          onPointerMove={onMove}
          onPointerOut={onOut}
        />
      ) : null}
      <lineSegments geometry={wire} material={materials.wire} frustumCulled={false} />
    </group>
  );
}
