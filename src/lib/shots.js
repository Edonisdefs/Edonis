/**
 * Camera keyframes and phase labels.
 *
 * Deliberately free of any store or singleton so both the site and the
 * standalone embed can share one source of truth for the choreography.
 */

/**
 * The intro tweens between these. `dolly` is a portrait-only pull-back: the
 * plan needs far more of it than the building shots, because a drawing has to
 * fit inside the frame to be read.
 */
export const SHOTS = {
  plan: { px: 0, py: 43, pz: 5, tx: 0, ty: 0, tz: 1, fov: 34, dolly: 2.1 },
  rise: { px: 26, py: 30, pz: 34, tx: 0, ty: 2.0, tz: 2, fov: 30, dolly: 1.2 },
  model: { px: 37, py: 15, pz: 43, tx: 0, ty: 4.6, tz: 1, fov: 28, dolly: 1.05 },
  hero: { px: 34, py: 12.5, pz: 46, tx: 0, ty: 7.4, tz: 2, fov: 27, dolly: 1.0 },
  wide: { px: 47, py: 20, pz: 61, tx: 0, ty: 9.5, tz: 0, fov: 28, dolly: 1.0 },
};

export const STAGES = [
  { at: 0.0, key: 'blueprint', label: 'Floor plan', index: '01' },
  { at: 0.23, key: 'extrusion', label: 'Extrusion', index: '02' },
  { at: 0.45, key: 'wireframe', label: 'Wireframe', index: '03' },
  { at: 0.58, key: 'clay', label: 'Clay model', index: '04' },
  { at: 0.68, key: 'materials', label: 'Materials', index: '05' },
  { at: 0.82, key: 'lighting', label: 'Lighting', index: '06' },
  { at: 0.95, key: 'render', label: 'Render', index: '07' },
];

export function stageForProgress(p) {
  let found = STAGES[0];
  for (const s of STAGES) if (p >= s.at) found = s;
  return found;
}

/** Reduced-motion / fallback end state. */
export function applyFinalState(uniforms) {
  uniforms.uExtrude.value = 1;
  uniforms.uSurface.value = 1;
  uniforms.uClay.value = 1;
  uniforms.uMat.value = 1;
  uniforms.uLight.value = 1;
  uniforms.uEnv.value = 1;
  uniforms.uInterior.value = 1;
  uniforms.uWire.value = 0;
  uniforms.uBlueprint.value = 0;
  uniforms.uDraw.value = 1;
}
