/**
 * Scroll choreography.
 *
 * ScrollTrigger owns three things: the camera's retreat out of the hero, the
 * fade that hands the page over to the content, and the per-section reveals.
 * Nothing here writes React state per frame.
 */

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { camState, useUI } from '../lib/sceneState.js';

gsap.registerPlugin(ScrollTrigger);

const SECTIONS = ['hero', 'work', 'services', 'workflow', 'about', 'contact'];

export function useScrollStory({ ready, canvasRef, onVisibilityChange }) {
  useEffect(() => {
    if (!ready) return undefined;

    const ui = useUI.getState();
    const ctx = gsap.context(() => {
      /* --- Hero hand-off ------------------------------------------------- */
      ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          camState.scroll = p;
          // Parallax belongs to the hero; release it as the page moves on.
          camState.parallax = Math.max(0, 1 - p * 2.2);
          if (canvasRef.current) {
            const fade = 1 - gsap.utils.clamp(0, 1, (p - 0.35) / 0.5);
            canvasRef.current.style.opacity = fade.toFixed(3);
          }
          onVisibilityChange?.(p < 0.92);
        },
      });

      /* --- Section reveals ------------------------------------------------ */
      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: () => el.classList.add('is-in'),
        });
      });

      /* --- Which section the nav should mark ------------------------------ */
      SECTIONS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) ui.setActiveSection(id);
          },
        });
      });
    });

    // The intro locks scrolling; measure again once it has let go.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 60);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [ready, canvasRef, onVisibilityChange]);
}
