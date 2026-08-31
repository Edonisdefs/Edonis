import { Vector3 } from 'three';

/**
 * The sun's arc across phase 6: from a high, cold overhead key that reads the
 * clay model cleanly, down to a low warm raking light that grazes the concrete
 * and lights the glazing.
 */
export const SUN_START = new Vector3(-4, 52, 16);
export const SUN_END = new Vector3(-30, 20, 30);

const _a = new Vector3();

export function sunPosition(t, out = new Vector3()) {
  const k = t * t * (3 - 2 * t);
  out.copy(SUN_START).lerp(SUN_END, k);
  // Bow the path so the sun travels through an arc rather than a straight line.
  _a.set(0, Math.sin(k * Math.PI) * 6, 0);
  return out.add(_a);
}
