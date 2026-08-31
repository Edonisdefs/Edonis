/**
 * Styles are injected once rather than shipped as a separate file, so the embed
 * stays a single drop-in script. Everything is scoped under `.esv-hero` and
 * themed through custom properties the host page can override.
 */

const CSS = `
.esv-hero {
  --esv-bg: #050607;
  --esv-accent: #78a6ce;
  --esv-accent-line: rgba(120, 166, 206, 0.38);
  --esv-ink: #f4f5f6;
  --esv-muted: #7b828a;
  --esv-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --esv-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;

  position: relative;
  overflow: hidden;
  background: var(--esv-bg);
  color: var(--esv-ink);
  -webkit-font-smoothing: antialiased;
}

.esv-hero canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-y;
}

.esv-hero .esv-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Hover callout ---------------------------------------------------------- */

.esv-hero .esv-annot {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.esv-hero .esv-annot[data-visible='true'] {
  opacity: 1;
}

.esv-hero .esv-annot__stem {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 54px;
  background: linear-gradient(to top, rgba(120, 166, 206, 0), var(--esv-accent));
  transform: rotate(-40deg);
  transform-origin: bottom center;
}

.esv-hero .esv-annot__body {
  position: absolute;
  left: 36px;
  top: -66px;
  display: block;
  padding-left: 12px;
  border-left: 1px solid var(--esv-accent-line);
  white-space: nowrap;
  font-family: var(--esv-font);
}

.esv-hero .esv-annot__tag {
  display: block;
  font-family: var(--esv-mono);
  font-size: 10px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--esv-accent);
}

.esv-hero .esv-annot__detail {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: var(--esv-muted);
}

@media (pointer: coarse) {
  .esv-hero .esv-annot { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .esv-hero .esv-annot { transition-duration: 0.001ms; }
}
`;

let injected = false;

export function injectStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.esvHero = '';
  style.textContent = CSS;
  document.head.appendChild(style);
}
