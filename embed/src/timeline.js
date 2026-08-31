/**
 * The intro is one GSAP timeline. Every phase writes into shared uniform
 * objects and a camera proxy, so the whole seven-second sequence is authored,
 * scrubbable and reversible from a single place.
 */

import gsap from 'gsap';
import { SHOTS, applyFinalState, stageForProgress } from './state.js';

const EASE = 'power2.inOut';

/** How long the whole sequence runs, in seconds. */
export const DURATION = 7.3;

export function createTimeline({ state, autoplay, onProgress, onPhase, onComplete }) {
  const { uniforms, cam } = state;
  const shot = { ...SHOTS.plan };
  let stageKey = null;
  let finished = false;

  const syncCamera = () => {
    cam.pos.set(shot.px, shot.py, shot.pz);
    cam.target.set(shot.tx, shot.ty, shot.tz);
    cam.fov = shot.fov;
    cam.dolly = shot.dolly;
  };
  syncCamera();

  const u = uniforms;
  const tl = gsap.timeline({
    paused: true,
    onUpdate: () => {
      syncCamera();
      const p = tl.progress();
      onProgress?.(p);
      const stage = stageForProgress(p);
      if (stage.key !== stageKey) {
        stageKey = stage.key;
        onPhase?.(stage);
      }
    },
    onComplete: () => {
      finished = true;
      cam.parallax = 1;
      onComplete?.();
    },
  });

  /* --- 01 Blueprint ------------------------------------------------------ */
  tl.to(u.uBlueprint, { value: 1, duration: 0.45, ease: 'power1.out' }, 0)
    .to(u.uDraw, { value: 1, duration: 1.85, ease: 'power1.inOut' }, 0.1)

    /* --- 02 Extrusion ---------------------------------------------------- */
    .to(shot, { ...SHOTS.rise, duration: 1.75, ease: EASE }, 1.55)
    .to(u.uSurface, { value: 1, duration: 0.8, ease: 'none' }, 1.65)
    .to(u.uWire, { value: 1, duration: 0.6, ease: 'power1.out' }, 1.7)
    .to(u.uExtrude, { value: 1, duration: 1.95, ease: EASE }, 1.7)
    .to(u.uBlueprint, { value: 0.4, duration: 0.9, ease: 'none' }, 1.85)
    .to(u.uBlueprint, { value: 0, duration: 0.7, ease: 'power1.in' }, 3.0)

    /* --- 03 Wireframe ---------------------------------------------------- */
    .to(shot, { ...SHOTS.model, duration: 1.5, ease: EASE }, 3.25)

    /* --- 04 Clay --------------------------------------------------------- */
    .to(u.uClay, { value: 1, duration: 0.95, ease: 'power1.inOut' }, 3.9)
    .to(u.uWire, { value: 0.28, duration: 0.7, ease: 'none' }, 4.1)
    .to(u.uWire, { value: 0, duration: 0.6, ease: 'power1.in' }, 4.6)

    /* --- 05 Materials ---------------------------------------------------- */
    .to(u.uMat, { value: 1, duration: 1.55, ease: 'power1.inOut' }, 4.55)
    .to(shot, { ...SHOTS.hero, duration: 2.1, ease: EASE }, 4.75)

    /* --- 06 Light & environment ------------------------------------------ */
    .to(u.uLight, { value: 1, duration: 1.5, ease: 'power2.inOut' }, 5.35)
    .to(u.uEnv, { value: 1, duration: 1.45, ease: 'power2.out' }, 5.4)
    .to(u.uInterior, { value: 1, duration: 1.1, ease: 'power1.out' }, 6.1)

    /* --- 07 Hero --------------------------------------------------------- */
    .to({}, { duration: 0.8 }, 6.5);

  const timers = [];

  const jumpToEnd = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers.length = 0;
    applyFinalState(uniforms);
    Object.assign(shot, SHOTS.hero);
    syncCamera();
    cam.parallax = 1;
    finished = true;
    onProgress?.(1);
    onPhase?.(stageForProgress(1));
    onComplete?.();
  };

  if (autoplay) {
    // A short beat before the first line is drawn reads as intent, not lag.
    timers.push(window.setTimeout(() => tl.play(), 320));
    // GSAP suspends timelines through long frame stalls. On a device slow
    // enough for that, the intro must still end rather than hold the page.
    timers.push(
      window.setTimeout(() => {
        if (!finished) tl.progress(1);
      }, 16000),
    );
  }

  /**
   * Autoplay schedules a start beat and a stall bailout. Any explicit control
   * call takes ownership of the timeline, so neither may fire afterwards.
   */
  const cancelTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers.length = 0;
  };

  return {
    // Controls return nothing on purpose: the GSAP timeline is an internal,
    // and handing it out makes the public surface impossible to keep stable.
    play() {
      cancelTimers();
      tl.play();
    },
    pause() {
      cancelTimers();
      tl.pause();
    },
    seek(t) {
      cancelTimers();
      tl.progress(Math.min(1, Math.max(0, t))).pause();
    },
    skip() {
      cancelTimers();
      tl.progress(1);
    },
    jumpToEnd,
    get finished() {
      return finished;
    },
    get progress() {
      return tl.progress();
    },
    dispose() {
      cancelTimers();
      tl.kill();
    },
  };
}
