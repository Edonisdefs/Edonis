import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { labelBridge } from '../lib/labelBridge.js';

const _p = new Vector3();

/**
 * Projects the hovered part's anchor and writes the transform straight onto the
 * DOM annotation. Keeping this out of React state costs nothing per frame.
 */
export default function LabelProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useFrame(() => {
    const node = labelBridge.node;
    if (!node) return;
    _p.copy(labelBridge.anchor).project(camera);
    const x = (_p.x * 0.5 + 0.5) * size.width;
    const y = (-_p.y * 0.5 + 0.5) * size.height;
    node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });

  return null;
}
