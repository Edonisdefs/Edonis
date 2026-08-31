/**
 * Scene runtime.
 *
 * Split deliberately in two:
 *  - `camState` and the phase uniforms are mutated every frame and must never
 *    cause a React render.
 *  - `useUI` holds the handful of values the DOM genuinely needs to react to.
 */

import { Vector2, Vector3 } from 'three';
import { create } from 'zustand';
import { createPhaseUniforms } from './materials.js';

export const uniforms = createPhaseUniforms();

export const camState = {
  pos: new Vector3(0, 43, 5),
  target: new Vector3(0, 0, 1),
  fov: 34,
  dolly: 2.1,
  /** Smoothed pointer, -1..1 across the viewport. */
  mouse: new Vector2(),
  mouseTarget: new Vector2(),
  /** Ramps in once the intro releases control. */
  parallax: 0,
  /** 0..1 across the hero-to-portfolio camera move. */
  scroll: 0,
};

/**
 * Camera keyframes for the intro. The timeline tweens between these.
 * `dolly` is a portrait-only pull-back: the plan needs far more of it than the
 * building shots, because a drawing has to fit inside the frame to be read.
 */
export const SHOTS = {
  plan: { px: 0, py: 43, pz: 5, tx: 0, ty: 0, tz: 1, fov: 34, dolly: 2.1 },
  rise: { px: 26, py: 30, pz: 34, tx: 0, ty: 2.0, tz: 2, fov: 30, dolly: 1.2 },
  model: { px: 37, py: 15, pz: 43, tx: 0, ty: 4.6, tz: 1, fov: 28, dolly: 1.05 },
  hero: { px: 34, py: 12.5, pz: 46, tx: 0, ty: 7.4, tz: 2, fov: 27, dolly: 1.0 },
  wide: { px: 47, py: 20, pz: 61, tx: 0, ty: 9.5, tz: 0, fov: 28, dolly: 1.0 },
};

/** Reduced-motion / fallback end state. */
export function applyFinalState() {
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

export const STAGES = [
  { at: 0.0, key: 'blueprint', label: 'Floor plan', index: '01' },
  { at: 0.23, key: 'extrusion', label: 'Extrusion', index: '02' },
  { at: 0.45, key: 'wireframe', label: 'Wireframe', index: '03' },
  { at: 0.58, key: 'clay', label: 'Clay model', index: '04' },
  { at: 0.68, key: 'materials', label: 'Materials', index: '05' },
  { at: 0.82, key: 'lighting', label: 'Lighting', index: '06' },
  { at: 0.95, key: 'render', label: 'Render', index: '07' },
];

export const useUI = create((set) => ({
  /** Named stage, for the intro read-out. */
  stage: STAGES[0],
  progress: 0,
  introDone: false,
  typographyIn: false,
  hover: null,
  webgl: true,
  activeSection: 'hero',

  setStage: (stage) => set((s) => (s.stage.key === stage.key ? s : { stage })),
  setProgress: (progress) => set({ progress }),
  setIntroDone: (introDone) => set({ introDone }),
  setTypographyIn: (typographyIn) => set({ typographyIn }),
  setHover: (hover) =>
    set((s) => (s.hover?.id === hover?.id ? s : { hover })),
  setWebgl: (webgl) => set({ webgl }),
  setActiveSection: (activeSection) =>
    set((s) => (s.activeSection === activeSection ? s : { activeSection })),
}));

export function stageForProgress(p) {
  let found = STAGES[0];
  for (const s of STAGES) if (p >= s.at) found = s;
  return found;
}
