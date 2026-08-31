import { useEffect, useRef } from 'react';
import { labelBridge } from '../lib/labelBridge.js';
import { useUI } from '../lib/sceneState.js';

/**
 * The label that appears when the pointer rests on part of the building. Its
 * position is written directly by the render loop; React only owns the text.
 */
export default function HoverAnnotation() {
  const hover = useUI((s) => s.hover);
  const node = useRef(null);

  useEffect(() => {
    labelBridge.node = node.current;
    return () => {
      labelBridge.node = null;
    };
  }, []);

  return (
    <div ref={node} className={`annot ${hover ? 'is-in' : ''}`} aria-hidden="true">
      <span className="annot__stem" />
      <span className="annot__body">
        <span className="annot__tag">{hover?.tag ?? ''}</span>
        <span className="annot__detail">{hover?.detail ?? ''}</span>
      </span>
    </div>
  );
}
