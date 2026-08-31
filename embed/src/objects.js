/**
 * Everything that goes into the scene: the building, the plan drawing, the site
 * and the sky. Same geometry and same materials as the site — only the React
 * wrapper is gone.
 */

import { LineSegments, Mesh, PlaneGeometry, SphereGeometry } from 'three';
import { DIM } from '../../src/lib/buildingModel.js';
import { buildBlueprintGeometry } from '../../src/lib/blueprint.js';
import {
  buildSolidGeometry,
  buildWireGeometry,
} from '../../src/lib/geometryBuilders.js';
import {
  createBlueprintMaterial,
  createDepthMaterial,
  createGroundMaterial,
  createSkyMaterial,
  createSurfaceMaterial,
  createWaterMaterial,
  createWireMaterial,
} from '../../src/lib/materials.js';
import { buildDetailLines, buildMassing, buildVilla } from '../../src/lib/villa.js';
import { sunPosition } from '../../src/three/sunPath.js';

/**
 * The building: one opaque mesh, one glazing mesh, one line set. Three draw
 * calls carry every phase of the sequence.
 */
export function createBuilding(scene, uniforms, settings) {
  const parts = buildVilla(settings);
  const geometries = {
    solid: buildSolidGeometry(parts, { glass: false }),
    glass: buildSolidGeometry(parts, { glass: true }),
    wire: buildWireGeometry(buildMassing(), buildDetailLines()),
  };
  const materials = {
    surface: createSurfaceMaterial(uniforms),
    glass: createSurfaceMaterial(uniforms, { glass: true }),
    wire: createWireMaterial(uniforms),
    depth: createDepthMaterial(uniforms),
  };

  const solid = new Mesh(geometries.solid, materials.surface);
  solid.customDepthMaterial = materials.depth;
  solid.castShadow = settings.shadows;
  solid.receiveShadow = settings.shadows;

  const glass = geometries.glass ? new Mesh(geometries.glass, materials.glass) : null;
  if (glass) glass.receiveShadow = settings.shadows;

  const wire = new LineSegments(geometries.wire, materials.wire);
  wire.frustumCulled = false;

  scene.add(solid, wire);
  if (glass) scene.add(glass);

  return {
    /** The meshes the pointer may pick. */
    pickable: glass ? [solid, glass] : [solid],
    update() {
      // Environment reflections come up with the lighting phase.
      const lit = uniforms.uLight.value;
      materials.surface.envMapIntensity = 0.5 - lit * 0.2;
      materials.glass.envMapIntensity = 0.3 + lit * 1.6;
    },
    dispose() {
      scene.remove(solid, wire);
      if (glass) scene.remove(glass);
      Object.values(geometries).forEach((g) => g?.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
  };
}

/** Phase 1 — the plan, traced on the ground plane. */
export function createBlueprint(scene, uniforms) {
  const geometry = buildBlueprintGeometry();
  const material = createBlueprintMaterial(uniforms);
  const lines = new LineSegments(geometry, material);
  lines.position.y = 0.02;
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  scene.add(lines);

  return {
    dispose() {
      scene.remove(lines);
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Site plane and pool. Both fade up with the environment phase. */
export function createLandscape(scene, uniforms, settings) {
  const groundMaterial = createGroundMaterial(uniforms);
  groundMaterial.envMapIntensity = 0.3;

  const ground = new Mesh(new PlaneGeometry(260, 260, 2, 2), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.35, 2);
  ground.receiveShadow = settings.shadows;
  scene.add(ground);

  let water = null;
  let waterMaterial = null;
  if (settings.water) {
    waterMaterial = createWaterMaterial(uniforms);
    water = new Mesh(
      new PlaneGeometry(DIM.poolX1 - DIM.poolX0, DIM.poolZ1 - DIM.poolZ0, 1, 1),
      waterMaterial,
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(
      (DIM.poolX0 + DIM.poolX1) / 2,
      -0.12,
      (DIM.poolZ0 + DIM.poolZ1) / 2,
    );
    water.visible = false;
    scene.add(water);
  }

  return {
    update() {
      // The pool only exists once the site does; before that it would sit in
      // the middle of the drawing.
      if (water) water.visible = uniforms.uEnv.value > 0.02;
    },
    dispose() {
      scene.remove(ground);
      ground.geometry.dispose();
      groundMaterial.dispose();
      if (water) {
        scene.remove(water);
        water.geometry.dispose();
        waterMaterial.dispose();
      }
    },
  };
}

/**
 * Background dome. Carries the mood from a near-black studio to dusk, and
 * tracks the sun so the halo sits where the light actually comes from.
 */
export function createSky(scene, uniforms) {
  const material = createSkyMaterial(uniforms);
  const geometry = new SphereGeometry(380, 32, 16);
  const dome = new Mesh(geometry, material);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);

  return {
    update() {
      const dir = material.uniforms.uSunDir.value;
      sunPosition(uniforms.uLight.value, dir);
      dir.normalize();
    },
    dispose() {
      scene.remove(dome);
      geometry.dispose();
      material.dispose();
    },
  };
}
