/**
 * Hand-off between the render loop and the DOM annotation.
 *
 * The 3D side owns the anchor and writes the projected transform straight onto
 * the label element — no React state, no second animation frame.
 */

import { Vector3 } from 'three';

export const labelBridge = {
  anchor: new Vector3(),
  node: null,
};
