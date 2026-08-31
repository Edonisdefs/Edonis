# ES-Visuals

Landing page for **ES-Visuals** — an architectural visualization studio.

The hero is a single continuous WebGL sequence that builds a house in front of the
visitor, in the order a real visualization is made:

```
floor plan → extrusion → wireframe → clay model → materials → light → render
```

It is not seven scenes. It is one model, one set of buffers, and one GSAP timeline
writing into shared shader uniforms.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

No API keys, no asset downloads, no CDN. Fonts are bundled (`@fontsource-variable/inter`)
and the environment probe is generated at runtime from light cards, so the page works
fully offline.

### Query parameters

Both are development conveniences and are safe to leave in.

| Parameter | Effect |
| --- | --- |
| `?phase=0.62` | Freezes the intro at that point (0–1). Useful for grabbing a still of one stage. |
| `?tier=high` \| `medium` \| `low` | Pins the quality tier and disables the runtime frame-rate watchdog. |

---

## How the sequence works

Everything hangs off one idea: **every vertex knows where it came from and when its
turn is.** Four attributes are baked into the merged geometry:

| Attribute | Meaning |
| --- | --- |
| `position` | final resting place, in world space |
| `aOrigin` | where the vertex collapses to at extrusion 0 — its footprint on the plan |
| `aAnim.x` | sequencing delay 0–1, so the extrusion rolls across the plan as a wave |
| `aAnim.y` | stage: 0 = building (driven by `uExtrude`), 1 = landscape (driven by `uEnv`) |
| `aAnim.z` | logical part id, used for pointer highlighting |
| `aRole` | material role — concrete, timber, metal, stone, planting, ground |

The phases are then just uniforms, all animated by the timeline in
`src/hooks/useIntroTimeline.js`:

| Uniform | Phase |
| --- | --- |
| `uDraw` / `uBlueprint` | 01 — the plan traces itself on, line by line |
| `uExtrude` / `uSurface` | 02 — walls grow vertically out of their own footprint |
| `uWire` | 03 — massing edges and the curtain-wall grid |
| `uClay` | 04 — near-black surfaces resolve into clay |
| `uMat` | 05 — a front sweeps the site, converting clay into real materials |
| `uLight` / `uEnv` | 06 — the sun travels its arc, the landscape grows in |
| `uInterior` | 07 — a few rooms light up at dusk |

Because they are uniforms rather than scene swaps, the transitions overlap: materials
are already sweeping while the camera is still moving, and the timeline can be scrubbed
to any point (see `?phase=`).

### Draw calls

The whole building is **three draw calls** — one opaque mesh, one glazing mesh, one line
set — plus ground, water, sky and the blueprint. Roughly a dozen in total. Everything is
box geometry merged once at startup (`src/lib/geometryBuilders.js`); there are no
per-object uniforms and no per-frame allocations in the render loop.

---

## Layout of the code

```
src/
  lib/
    buildingModel.js    plan: walls, openings, dimensions — the single source of truth
    villa.js            plan + volumes → the box list, and the massing for the wireframe
    geometryBuilders.js boxes → merged buffers carrying the animation attributes
    blueprint.js        the same walls → the phase-1 drawing, with draw-on order
    materials.js        the phase shader family (surface, glass, lines, ground, water, sky)
    shaderChunks.js     shared GLSL: noise, dither, growth, materialisation sweep
    sceneState.js       shared uniforms, camera keyframes, and the small UI store
    capabilities.js     WebGL probe and quality tiers
    staticRender.js     CPU projector for the no-WebGL fallback
    projects.js         portfolio data and the axonometric generator
  three/
    ArchitectureScene   scene composition, environment probe, atmosphere
    Building            the three draw calls, plus pointer picking
    Blueprint           phase 1
    Landscape           ground plane and pool
    LightingRig         sun arc, fill, hemisphere, shadow camera
    CameraRig           authored shot + scroll dolly + pointer parallax
    SkyDome             background and mood
    LabelProjector      projects the hover annotation onto the DOM
    PerfGuard           frame-rate watchdog
  components/           navigation, hero lockup, cursor, annotation, sections
  hooks/                intro timeline, scroll choreography
```

---

## Performance

Quality is chosen once from a device probe (`capabilities.js`) and can be demoted
once at runtime if the frame rate holds below 40 fps for two seconds:

| Tier | Shadows | Pixel ratio | Trees | Water |
| --- | --- | --- | --- | --- |
| high | 2048 | ≤ 2 | 9 | yes |
| medium | 1024 | ≤ 1.75 | 6 | yes |
| low | off | ≤ 1.5 | 4 | no |

Other measures:

- The canvas stops rendering entirely (`frameloop="never"`) once it scrolls out of the
  hero, and resumes on the way back up.
- Post-processing is deliberately absent; the mood comes from tone mapping, the light
  rig and the shaders, which costs nothing per frame.
- Camera, parallax and the hover annotation all write outside React — no per-frame
  re-render.

### When 3D is not an option

- **No WebGL** → `Fallback.jsx` projects and shades the *same villa* on the CPU into
  SVG. Not a placeholder image: the real building, with a real cast shadow.
- **Context lost at runtime** → the same static plate takes over.
- **`prefers-reduced-motion`** → the intro is skipped and the finished visualization is
  presented immediately.

Portrait viewports pull the shots back (`SHOTS[*].dolly`) and cap the field of view, so
a phone gets a wide view rather than a distorted one.

---

## Replacing the placeholder content

The 3D is production-ready; the *content* is scaffolding and is meant to be replaced.

1. **Contact address** — `src/components/sections/Contact.jsx` uses
   `studio@es-visuals.de`. Change it before launch.
2. **Portfolio** — `PROJECTS` in `src/lib/projects.js`. The six entries are placeholders.
   Each is drawn as a hairline axonometric from its `massing` array; add an `image`
   field to any entry and a real render is used instead:
   ```js
   { id: 'villa-k', image: '/work/villa-k.jpg', /* … */ }
   ```
3. **Copy** — the section text is written to be usable, but it describes a studio, so
   read it before publishing.

### Swapping in a real GLB

The procedural villa exists so the page works without an asset pipeline. To use a real
model, replace `buildVilla()` in `src/lib/villa.js`. The rest of the system only requires
that the geometry carries the four attributes listed above:

- load the GLB, merge its meshes per material role,
- for every vertex write `aOrigin = (x, 0, z)`, a `aAnim.x` delay (height and position
  make a good basis), `aAnim.y = 0`, a part id in `aAnim.z`, and a role in `aRole`,
- hand the result to `createSurfaceMaterial()` exactly as `Building.jsx` does.

No phase, camera or timeline code needs to change.
