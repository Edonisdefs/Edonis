/**
 * The intro is one GSAP timeline. Every phase writes into shared uniform
 * objects and a camera proxy, so the whole seven-second sequence is authored,
 * scrubbable and reversible from a single place.
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SHOTS, applyFinalState, camState, stageForProgress, uniforms, useUI } from '../lib/sceneState.js';

const EASE = 'power2.inOut';

/**
 * `?phase=0.62` freezes the intro at a given point. Useful for grabbing stills
 * of an individual stage, and for checking framing without waiting it out.
 */
function seekRequest() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('phase');
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

export function useIntroTimeline({ enabled, onComplete }) {
  const done = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const ui = useUI.getState();

    // Reduced motion, or a device that cannot afford the sequence: present the
    // finished visualization immediately.
    if (!enabled.animate) {
      applyFinalState();
      Object.assign(camState.pos, { x: SHOTS.hero.px, y: SHOTS.hero.py, z: SHOTS.hero.pz });
      Object.assign(camState.target, { x: SHOTS.hero.tx, y: SHOTS.hero.ty, z: SHOTS.hero.tz });
      camState.fov = SHOTS.hero.fov;
      camState.dolly = SHOTS.hero.dolly;
      camState.parallax = 1;
      ui.setProgress(1);
      ui.setStage(stageForProgress(1));
      ui.setTypographyIn(true);
      ui.setIntroDone(true);
      onComplete?.();
      return undefined;
    }

    const shot = { ...SHOTS.plan };
    const syncCamera = () => {
      camState.pos.set(shot.px, shot.py, shot.pz);
      camState.target.set(shot.tx, shot.ty, shot.tz);
      camState.fov = shot.fov;
      camState.dolly = shot.dolly;
    };
    syncCamera();

    const u = uniforms;
    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => {
        syncCamera();
        const p = tl.progress();
        ui.setProgress(p);
        ui.setStage(stageForProgress(p));
      },
      onComplete: () => {
        done.current = true;
        camState.parallax = 1;
        ui.setIntroDone(true);
        onComplete?.();
      },
    });

    /* --- 01 Blueprint ----------------------------------------------------- */
    tl.to(u.uBlueprint, { value: 1, duration: 0.45, ease: 'power1.out' }, 0)
      .to(u.uDraw, { value: 1, duration: 1.85, ease: 'power1.inOut' }, 0.1)

      /* --- 02 Extrusion --------------------------------------------------- */
      .to(shot, { ...SHOTS.rise, duration: 1.75, ease: EASE }, 1.55)
      .to(u.uSurface, { value: 1, duration: 0.8, ease: 'none' }, 1.65)
      .to(u.uWire, { value: 1, duration: 0.6, ease: 'power1.out' }, 1.7)
      .to(u.uExtrude, { value: 1, duration: 1.95, ease: EASE }, 1.7)
      .to(u.uBlueprint, { value: 0.4, duration: 0.9, ease: 'none' }, 1.85)
      .to(u.uBlueprint, { value: 0, duration: 0.7, ease: 'power1.in' }, 3.0)

      /* --- 03 Wireframe --------------------------------------------------- */
      .to(shot, { ...SHOTS.model, duration: 1.5, ease: EASE }, 3.25)

      /* --- 04 Clay -------------------------------------------------------- */
      .to(u.uClay, { value: 1, duration: 0.95, ease: 'power1.inOut' }, 3.9)
      .to(u.uWire, { value: 0.28, duration: 0.7, ease: 'none' }, 4.1)
      .to(u.uWire, { value: 0, duration: 0.6, ease: 'power1.in' }, 4.6)

      /* --- 05 Materials --------------------------------------------------- */
      .to(u.uMat, { value: 1, duration: 1.55, ease: 'power1.inOut' }, 4.55)
      .to(shot, { ...SHOTS.hero, duration: 2.1, ease: EASE }, 4.75)

      /* --- 06 Light & environment ----------------------------------------- */
      .to(u.uLight, { value: 1, duration: 1.5, ease: 'power2.inOut' }, 5.35)
      .to(u.uEnv, { value: 1, duration: 1.45, ease: 'power2.out' }, 5.4)
      .to(u.uInterior, { value: 1, duration: 1.1, ease: 'power1.out' }, 6.1)

      /* --- 07 Hero -------------------------------------------------------- */
      .call(() => ui.setTypographyIn(true), null, 6.5)
      .to({}, { duration: 0.8 }, 6.5);

    const seek = seekRequest();
    if (seek !== null) {
      tl.progress(seek).pause();
      camState.parallax = 1;
      if (seek >= 0.999) {
        done.current = true;
        ui.setTypographyIn(true);
        ui.setIntroDone(true);
        onComplete?.();
      }
      return () => tl.kill();
    }

    // A short beat before the first line is drawn reads as intent, not lag.
    const start = window.setTimeout(() => tl.play(), 320);

    // GSAP suspends timelines through long frame stalls. On a device slow
    // enough for that, the intro must still end rather than hold the page.
    const bailout = window.setTimeout(() => {
      if (!done.current) tl.progress(1);
    }, 16000);

    // Escape hatch: any deliberate input skips to the finished hero.
    const skip = (event) => {
      if (done.current) return;
      if (event.type === 'keydown' && !['Escape', 'Enter', ' '].includes(event.key)) return;
      tl.progress(1);
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchmove', skip, { passive: true });

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(bailout);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchmove', skip);
      tl.kill();
    };
  }, [enabled, onComplete]);
}
