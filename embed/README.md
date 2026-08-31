# ES-Visuals Hero — embeddable build

The 3D hero sequence from the ES-Visuals landing page, packaged so it drops into
any existing website. No React, no build step required, no CDN, no asset
downloads.

A house draws itself as a floor plan, extrudes into volume, resolves through
wireframe and clay into real materials, and finally catches the evening sun —
about 7.3 seconds, then it stays interactive.

```
floor plan → extrusion → wireframe → clay → materials → light → render
```

The geometry, shaders and timeline are shared verbatim with the full site, so
the animation is identical.

---

## Quick start — script tag

```html
<div id="hero" style="width: 100%; height: 100vh"></div>

<script src="es-visuals-hero.umd.js"></script>
<script>
  ESVisualsHero.create('#hero');
</script>
```

That is the whole integration. The container must have a width and a height —
everything else has a sensible default.

## Quick start — ESM / bundler

```js
import ESVisualsHero from './es-visuals-hero.mjs';

const hero = ESVisualsHero.create(document.querySelector('#hero'), {
  onComplete: () => document.body.classList.add('hero-ready'),
});
```

Named imports work too: `import { create, isSupported } from './es-visuals-hero.mjs'`.

---

## Options

```js
ESVisualsHero.create('#hero', {
  autoplay: true,           // play the intro on mount
  quality: 'auto',          // 'auto' | 'high' | 'medium' | 'low'
  parallax: true,           // subtle pointer orbit after the intro (max ~3°)
  hover: true,              // highlight building parts under the pointer
  labels: true,             // draw the technical callout for the hovered part
  scrollDrive: false,       // dolly the camera from the container's scroll
  skipOnInteraction: true,  // wheel / touch / Esc jumps to the finished render
  pauseOffscreen: true,     // stop rendering while scrolled out of view

  onReady:   ({ mode, tier }) => {},  // mode: 'webgl' | 'static'
  onProgress: (t) => {},              // 0–1, every frame of the intro
  onPhase:   (stage) => {},           // { key, label, index } when it changes
  onComplete: () => {},               // intro finished, scene now interactive
  onHover:   (part) => {},            // { id, tag, detail } or null
  onDemote:  (settings) => {},        // frame-rate watchdog lowered quality
  onContextLost: () => {},            // WebGL died; static plate took over
});
```

`onPhase` is the useful one for driving your own UI — it fires with
`{ index: '04', key: 'clay', label: 'Clay model' }` as the sequence moves.

## Instance

```js
hero.play();          // start (or resume) the intro
hero.pause();
hero.seek(0.62);      // jump to a point, 0–1, and hold there
hero.finish();        // skip straight to the finished render
hero.setScroll(0.4);  // drive the camera dolly yourself, 0–1
hero.resize();        // only needed if you resize without changing layout
hero.destroy();       // full teardown: GPU resources, listeners, DOM

hero.progress;        // 0–1
hero.phase;           // { key, label, index }
hero.mode;            // 'webgl' | 'static'
hero.stages;          // the seven stages, in order
hero.three;           // { renderer, scene, camera } if you want to go further
```

`ESVisualsHero.isSupported()` tells you up front whether the browser can run the
3D scene.

---

## Sizing and layout

The container is sized by **your** CSS — the hero fills it and follows any later
resize through a `ResizeObserver`. It needs a non-zero height:

```css
#hero { width: 100%; height: 100vh; }     /* full-bleed */
#hero { aspect-ratio: 16 / 9; }           /* fixed ratio inside a column */
```

To overlay your own headline, wrap both in a positioned parent:

```html
<div style="position: relative">
  <div id="hero" style="height: 100vh"></div>
  <h1 style="position: absolute; inset: 0; ...">Your headline</h1>
</div>
```

`demo.html` (ESM, from source) and `umd-demo.html` (script tag, from the built
bundle) both show this pattern.

## Theming

The callout label reads CSS custom properties off the container, so it can be
restyled without touching the bundle:

```css
#hero {
  --esv-bg: #050607;
  --esv-accent: #78a6ce;
  --esv-ink: #f4f5f6;
  --esv-muted: #7b828a;
  --esv-font: 'Your Sans', sans-serif;
  --esv-mono: 'Your Mono', monospace;
}
```

Set `labels: false` and use the `onHover` callback if you would rather render
the annotation yourself.

---

## Performance

Quality is picked once from a device probe and can be demoted once at runtime if
the frame rate stays below 40 fps for two seconds:

| Tier | Shadows | Pixel ratio | Trees | Water |
| --- | --- | --- | --- | --- |
| high | 2048 | ≤ 2 | 9 | yes |
| medium | 1024 | ≤ 1.75 | 6 | yes |
| low | off | ≤ 1.5 | 4 | no |

The building is three draw calls; the whole scene is about a dozen. Rendering
stops entirely while the container is scrolled off-screen or the tab is hidden.

**Fallbacks.** No WebGL, or a context lost at runtime, swaps in a static plate —
not a placeholder image, but the same villa projected and shaded on the CPU into
SVG, with a real cast shadow. `prefers-reduced-motion` skips the intro and
presents the finished render immediately. The callbacks still fire in every
case, so your surrounding UI behaves the same.

## Bundle size

| File | Raw | gzip |
| --- | --- | --- |
| `es-visuals-hero.umd.js` | 602 KB | **167 KB** |
| `es-visuals-hero.mjs` | 763 KB | 186 KB |

three.js and GSAP are bundled in deliberately, so a host page needs nothing but
the one file. If your site already ships three.js, add `three` and `gsap` to
`rollupOptions.external` in `vite.config.js` and rebuild — the bundle then drops
to a few KB.

## Building from source

```bash
npm install                                  # from the repository root
npx vite build --config embed/vite.config.js # → embed/dist/
npx vite embed                               # dev server for demo.html
```

The embed reuses `src/lib/*` and `src/three/sunPath.js` from the main project;
only the thin React layer is replaced. Editing the villa, the materials or the
timeline changes both the site and this bundle.

## Browser support

Any browser with WebGL 2 (or WebGL 1 at the `low` tier). Everything else gets
the static plate.
