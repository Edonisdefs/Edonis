/**
 * Scene runtime for the embeddable build.
 *
 * The same shape as the site's `sceneState.js`, minus the React store — the
 * embed reports state through callbacks, so it pulls in no UI framework. Every
 * instance gets its own uniforms, so two heroes can run on one page.
 */

import { Vector2, Vector3 } from 'three';
import { createPhaseUniforms } from '../../src/lib/materials.js';

export { SHOTS, STAGES, stageForProgress, applyFinalState } from '../../src/lib/shots.js';

export function createState() {
  return {
    uniforms: createPhaseUniforms(),
    cam: {
      pos: new Vector3(0, 43, 5),
      target: new Vector3(0, 0, 1),
      fov: 34,
      dolly: 2.1,
      /** Smoothed pointer, -1..1 across the container. */
      mouse: new Vector2(),
      mouseTarget: new Vector2(),
      /** Ramps in once the intro releases control. */
      parallax: 0,
      /** 0..1 across the hero-to-wide camera move. */
      scroll: 0,
    },
    hoverAnchor: new Vector3(),
  };
}
