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
import { applyFinalState as applyFinal, STAGES } from './shots.js';

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

/* Choreography lives in `shots.js` so the standalone embed can share it. */
export { SHOTS, STAGES, stageForProgress } from './shots.js';

/** Reduced-motion / fallback end state, bound to this module's uniforms. */
export function applyFinalState() {
  applyFinal(uniforms);
}

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
