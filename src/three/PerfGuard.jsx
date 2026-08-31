import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Live frame-rate watchdog.
 *
 * Two consecutive one-second windows below the threshold demote the scene once
 * — shadows off, pixel ratio down. It never promotes back, so a single stutter
 * cannot start it oscillating.
 */
export default function PerfGuard({ threshold = 40, onDemote }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const since = useRef(0);
  const strikes = useRef(0);
  const spent = useRef(false);
  const warmup = useRef(0);

  useFrame((_, delta) => {
    if (spent.current) return;

    // Ignore the first couple of seconds: shader compilation dominates.
    warmup.current += delta;
    if (warmup.current < 2.5) return;

    frames.current += 1;
    since.current += delta;
    if (since.current < 1) return;

    const fps = frames.current / since.current;
    frames.current = 0;
    since.current = 0;

    if (fps < threshold) {
      strikes.current += 1;
      if (strikes.current >= 2) {
        spent.current = true;
        gl.setPixelRatio(Math.min(gl.getPixelRatio(), 1.25));
        onDemote?.();
      }
    } else {
      strikes.current = 0;
    }
  });

  return null;
}
