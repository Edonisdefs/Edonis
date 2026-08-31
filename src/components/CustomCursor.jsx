import { useEffect, useRef, useState } from 'react';

/**
 * A crosshair rather than a blob: a hairline ring that trails the pointer, with
 * a dot that does not. Position is written from a single rAF loop, never React
 * state — the only thing that re-renders is the mode.
 */
export default function CustomCursor() {
  const ring = useRef(null);
  const dot = useRef(null);
  const [mode, setMode] = useState('default');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const eased = { ...target };
    let frame = 0;
    let running = true;

    const onMove = (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (dot.current) {
        dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      }
      setVisible(true);
    };

    const onOver = (event) => {
      const hit = event.target instanceof Element ? event.target.closest('[data-cursor]') : null;
      setMode(hit?.getAttribute('data-cursor') || 'default');
    };

    const onLeave = () => setVisible(false);
    const onDown = () => setMode((m) => (m === 'press' ? m : 'press'));
    const onUp = () => setMode('default');

    const tick = () => {
      if (!running) return;
      eased.x += (target.x - eased.x) * 0.16;
      eased.y += (target.y - eased.y) * 0.16;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${eased.x.toFixed(2)}px, ${eased.y.toFixed(2)}px, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    document.body.dataset.cursor = 'on';

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      delete document.body.dataset.cursor;
    };
  }, []);

  return (
    <div className={`cursor ${visible ? 'is-visible' : ''}`} data-mode={mode} aria-hidden="true">
      <span ref={ring} className="cursor__ring">
        <svg viewBox="0 0 44 44" width="44" height="44">
          <circle cx="22" cy="22" r="15.5" fill="none" stroke="currentColor" />
          <path d="M22 2v6M22 36v6M2 22h6M36 22h6" stroke="currentColor" fill="none" />
        </svg>
      </span>
      <span ref={dot} className="cursor__dot" />
    </div>
  );
}
