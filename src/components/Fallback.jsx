import { useMemo } from 'react';
import { renderStatic } from '../lib/staticRender.js';

/**
 * The no-WebGL hero.
 *
 * Not a placeholder: the same villa, projected and shaded on the CPU into SVG,
 * so a device that cannot run the scene still sees the actual architecture.
 * Drop a real render at /hero-still.jpg and it is used instead.
 */
export default function Fallback() {
  const scene = useMemo(() => renderStatic({ width: 1600, height: 900 }), []);
  const { width, height, faces, shadow, horizon } = scene;

  return (
    <div className="fallback">
      <svg
        className="fallback__plate"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Architectural visualization of a modern concrete and timber villa at dusk"
      >
        <defs>
          <linearGradient id="es-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1019" />
            <stop offset="62%" stopColor="#1d2733" />
            <stop offset="100%" stopColor="#4a4038" />
          </linearGradient>
          <linearGradient id="es-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#242a22" />
            <stop offset="100%" stopColor="#0d1210" />
          </linearGradient>
          <radialGradient id="es-sun" cx="0.72" cy="0.18" r="0.42">
            <stop offset="0%" stopColor="#ffbe7d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffbe7d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="es-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050607" stopOpacity="0.72" />
            <stop offset="38%" stopColor="#050607" stopOpacity="0" />
            <stop offset="78%" stopColor="#050607" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#050607" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={horizon} fill="url(#es-sky)" />
        <rect x="0" y="0" width={width} height={horizon} fill="url(#es-sun)" />
        <rect x="0" y={horizon} width={width} height={height - horizon} fill="url(#es-ground)" />

        {shadow ? <polygon points={shadow} fill="#04060a" opacity="0.62" /> : null}

        <g>
          {faces.map((face, i) => (
            <polygon
              key={i}
              points={face.d}
              fill={face.fill}
              fillOpacity={face.opacity}
              stroke={face.fill}
              strokeWidth="0.6"
            />
          ))}
        </g>

        <rect x="0" y="0" width={width} height={height} fill="url(#es-vignette)" />
      </svg>
    </div>
  );
}
