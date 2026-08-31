/**
 * The no-WebGL hero.
 *
 * Not a placeholder: the same villa, projected and shaded on the CPU into SVG,
 * so a device that cannot run the scene still sees the actual architecture.
 */

import { renderStatic } from '../../src/lib/staticRender.js';

let seq = 0;

export function buildFallbackSvg() {
  const id = `esv${(seq += 1)}`;
  const { width, height, faces, shadow, horizon } = renderStatic({ width: 1600, height: 900 });

  const polygons = faces
    .map(
      (f) =>
        `<polygon points="${f.d}" fill="${f.fill}" fill-opacity="${f.opacity}" stroke="${f.fill}" stroke-width="0.6"/>`,
    )
    .join('');

  return `
<svg class="esv-fallback" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"
     role="img" aria-label="Architectural visualization of a modern concrete and timber villa at dusk">
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1019"/>
      <stop offset="62%" stop-color="#1d2733"/>
      <stop offset="100%" stop-color="#4a4038"/>
    </linearGradient>
    <linearGradient id="${id}-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#242a22"/>
      <stop offset="100%" stop-color="#0d1210"/>
    </linearGradient>
    <radialGradient id="${id}-sun" cx="0.72" cy="0.18" r="0.42">
      <stop offset="0%" stop-color="#ffbe7d" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffbe7d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#050607" stop-opacity="0.72"/>
      <stop offset="38%" stop-color="#050607" stop-opacity="0"/>
      <stop offset="78%" stop-color="#050607" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#050607" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${horizon}" fill="url(#${id}-sky)"/>
  <rect x="0" y="0" width="${width}" height="${horizon}" fill="url(#${id}-sun)"/>
  <rect x="0" y="${horizon}" width="${width}" height="${height - horizon}" fill="url(#${id}-ground)"/>
  ${shadow ? `<polygon points="${shadow}" fill="#04060a" opacity="0.62"/>` : ''}
  <g>${polygons}</g>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${id}-vignette)"/>
</svg>`.trim();
}
