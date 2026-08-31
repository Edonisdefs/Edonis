/**
 * ES-Visuals — embeddable architecture hero.
 *
 * A framework-free build of the landing page's 3D sequence: a house draws
 * itself as a floor plan, extrudes, resolves through wireframe and clay into
 * materials, and finally catches the sun. Drop it into any page.
 *
 *   const hero = ESVisualsHero.create('#hero', { onPhase: console.log });
 *
 * Everything expensive — geometry, shaders, timeline — is shared verbatim with
 * the full site, so the animation is identical.
 */

import {
  ACESFilmicToneMapping,
  Clock,
  FogExp2,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import gsap from 'gsap';
import { PART_LABELS } from '../../src/lib/buildingModel.js';
import { TIER_SETTINGS, demoteTier, getCapabilities } from '../../src/lib/capabilities.js';
import { partIdFromIntersection } from '../../src/lib/geometryBuilders.js';
import { updateCamera } from './camera-rig.js';
import { createEnvironment } from './environment.js';
import { buildFallbackSvg } from './fallback.js';
import { createLighting } from './lighting.js';
import {
  createBlueprint,
  createBuilding,
  createLandscape,
  createSky,
} from './objects.js';
import { createState, STAGES, applyFinalState, stageForProgress } from './state.js';
import { injectStyles } from './styles.js';
import { DURATION, createTimeline } from './timeline.js';

const DEFAULTS = {
  /** Play the intro on mount. False leaves it on frame one until `play()`. */
  autoplay: true,
  /** 'auto' probes the device; 'high' | 'medium' | 'low' pin the tier. */
  quality: 'auto',
  /** Subtle camera orbit following the pointer, after the intro. */
  parallax: true,
  /** Pointer highlighting of building parts. */
  hover: true,
  /** Render the technical callout for the hovered part. */
  labels: true,
  /** Drive the camera dolly from the container's scroll position. */
  scrollDrive: false,
  /** Any deliberate wheel/touch/key input jumps to the finished render. */
  skipOnInteraction: true,
  /** Stop rendering while the container is off-screen. */
  pauseOffscreen: true,
};

function resolveContainer(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new Error(`[ESVisualsHero] container not found: ${target}`);
  return el;
}

/** True when this browser can run the 3D scene at all. */
export function isSupported() {
  return getCapabilities().webgl;
}

export function create(target, options = {}) {
  const container = resolveContainer(target);
  const opts = { ...DEFAULTS, ...options };
  const caps = getCapabilities();
  const settings = opts.quality === 'auto' ? caps.settings : TIER_SETTINGS[opts.quality];

  injectStyles();
  container.classList.add('esv-hero');

  /* ---- No WebGL: present the static plate and stop here ----------------- */
  if (!caps.webgl || !settings) {
    container.insertAdjacentHTML('beforeend', buildFallbackSvg());
    const svg = container.querySelector('.esv-fallback');
    opts.onReady?.({ mode: 'static' });
    opts.onProgress?.(1);
    opts.onPhase?.(stageForProgress(1));
    opts.onComplete?.();
    return {
      mode: 'static',
      play() {},
      pause() {},
      seek() {},
      setScroll() {},
      resize() {},
      get progress() {
        return 1;
      },
      destroy() {
        svg?.remove();
        container.classList.remove('esv-hero');
      },
    };
  }

  /* ---- Renderer --------------------------------------------------------- */
  const state = createState();
  const { uniforms, cam } = state;
  let active = settings;

  const renderer = new WebGLRenderer({
    antialias: active.shadows,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, active.maxPixelRatio));
  renderer.shadowMap.enabled = active.shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new FogExp2(0x080a0c, 0.003);

  const camera = new PerspectiveCamera(cam.fov, 1, 0.5, 900);
  camera.position.copy(cam.pos);

  const env = createEnvironment(renderer);
  scene.environment = env.texture;

  const sky = createSky(scene, uniforms);
  const lighting = createLighting(scene, active);
  const landscape = createLandscape(scene, uniforms, active);
  const blueprint = createBlueprint(scene, uniforms);
  const building = createBuilding(scene, uniforms, active);

  /* ---- Hover callout ---------------------------------------------------- */
  let annot = null;
  if (opts.labels) {
    annot = document.createElement('div');
    annot.className = 'esv-annot';
    annot.setAttribute('aria-hidden', 'true');
    annot.innerHTML =
      '<span class="esv-annot__stem"></span>' +
      '<span class="esv-annot__body">' +
      '<span class="esv-annot__tag"></span>' +
      '<span class="esv-annot__detail"></span>' +
      '</span>';
    container.appendChild(annot);
  }

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const hoverAmt = { value: 0 };
  let hovered = null;
  let interactive = false;

  function setHover(id, point) {
    if (uniforms.uHover.value === id) return;
    uniforms.uHover.value = id;
    const meta = PART_LABELS[id];
    hovered = meta ? { id, ...meta } : null;
    // Anchor where the pointer entered the part and leave it there, so the
    // label reads as a callout rather than a tooltip chasing the cursor.
    if (point) state.hoverAnchor.copy(point);
    if (annot) {
      annot.dataset.visible = hovered ? 'true' : 'false';
      if (hovered) {
        annot.querySelector('.esv-annot__tag').textContent = hovered.tag;
        annot.querySelector('.esv-annot__detail').textContent = hovered.detail;
      }
    }
    opts.onHover?.(hovered);
    gsap.to(hoverAmt, { value: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
  }

  function clearHover() {
    if (uniforms.uHover.value === -1) return;
    hovered = null;
    if (annot) annot.dataset.visible = 'false';
    opts.onHover?.(null);
    gsap.to(hoverAmt, {
      value: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: () => {
        uniforms.uHover.value = -1;
      },
    });
  }

  function onPointerMove(event) {
    if (!interactive || !opts.hover) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(building.pickable, false)[0];
    if (!hit) {
      clearHover();
      return;
    }
    const id = partIdFromIntersection(hit);
    if (id >= 0) setHover(id, hit.point);
  }

  function onPointerParallax(event) {
    if (!opts.parallax) return;
    const rect = container.getBoundingClientRect();
    cam.mouseTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1,
    );
  }

  const onPointer = (event) => {
    onPointerParallax(event);
    onPointerMove(event);
  };

  if (!caps.touch) {
    container.addEventListener('pointermove', onPointer, { passive: true });
    container.addEventListener('pointerleave', clearHover, { passive: true });
  }

  /* ---- Intro timeline --------------------------------------------------- */
  const intro = createTimeline({
    state,
    autoplay: opts.autoplay && !caps.reducedMotion,
    onProgress: opts.onProgress,
    onPhase: opts.onPhase,
    onComplete: () => {
      interactive = true;
      opts.onComplete?.();
    },
  });

  if (caps.reducedMotion) {
    intro.jumpToEnd();
    interactive = true;
  }

  /* ---- Skip on deliberate input ----------------------------------------- */
  const onSkip = (event) => {
    if (intro.finished) return;
    if (event.type === 'keydown' && !['Escape', 'Enter', ' '].includes(event.key)) return;
    intro.skip();
  };
  if (opts.skipOnInteraction && !caps.reducedMotion) {
    window.addEventListener('keydown', onSkip);
    window.addEventListener('wheel', onSkip, { passive: true });
    window.addEventListener('touchmove', onSkip, { passive: true });
  }

  /* ---- Scroll dolly ------------------------------------------------------ */
  function readScroll() {
    const rect = container.getBoundingClientRect();
    const travel = rect.height || 1;
    cam.scroll = Math.min(1, Math.max(0, -rect.top / travel));
    cam.parallax = intro.finished ? Math.max(0, 1 - cam.scroll * 2.2) : 0;
  }
  if (opts.scrollDrive) {
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();
  }

  /* ---- Sizing ----------------------------------------------------------- */
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  if (!resizeObserver) window.addEventListener('resize', resize);

  /* ---- Frame loop -------------------------------------------------------- */
  const clock = new Clock();
  let visible = true;
  let disposed = false;

  // Frame-rate watchdog: two consecutive slow seconds demote the scene once.
  let frames = 0;
  let since = 0;
  let warmup = 0;
  let strikes = 0;
  let demoted = opts.quality !== 'auto';

  function watchdog(delta) {
    if (demoted) return;
    warmup += delta;
    if (warmup < 2.5) return;
    frames += 1;
    since += delta;
    if (since < 1) return;
    const fps = frames / since;
    frames = 0;
    since = 0;
    if (fps >= 40) {
      strikes = 0;
      return;
    }
    strikes += 1;
    if (strikes < 2) return;
    demoted = true;
    active = demoteTier().settings;
    renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.25));
    renderer.shadowMap.enabled = active.shadows;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.castShadow && active.shadows;
        o.receiveShadow = o.receiveShadow && active.shadows;
        o.material.needsUpdate = true;
      }
    });
    opts.onDemote?.(active);
  }

  function tick() {
    if (disposed) return;
    const delta = clock.getDelta();
    if (!visible) return;

    uniforms.uTime.value += delta;
    uniforms.uHoverAmt.value = hoverAmt.value;

    const t = uniforms.uLight.value;
    scene.fog.color.setRGB(0.006 + t * 0.056, 0.008 + t * 0.044, 0.011 + t * 0.037);
    scene.fog.density = 0.003 + t * 0.0042;

    sky.update();
    lighting.update(uniforms);
    landscape.update();
    building.update();
    updateCamera(camera, cam, delta);

    if (annot && hovered) {
      const p = state.hoverAnchor.clone().project(camera);
      annot.style.transform = `translate3d(${(((p.x * 0.5 + 0.5) * container.clientWidth) | 0)}px, ${
        ((-p.y * 0.5 + 0.5) * container.clientHeight) | 0
      }px, 0)`;
    }

    renderer.render(scene, camera);
    watchdog(delta);
  }
  renderer.setAnimationLoop(tick);

  /* ---- Pause while off-screen -------------------------------------------- */
  let io = null;
  if (opts.pauseOffscreen && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) clock.getDelta(); // drop the elapsed gap
      },
      { threshold: 0 },
    );
    io.observe(container);
  }

  const onVisibility = () => {
    if (!document.hidden) clock.getDelta();
  };
  document.addEventListener('visibilitychange', onVisibility);

  /* ---- Context loss ------------------------------------------------------ */
  const onContextLost = (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    renderer.domElement.remove();
    container.insertAdjacentHTML('beforeend', buildFallbackSvg());
    opts.onContextLost?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, { once: true });

  opts.onReady?.({ mode: 'webgl', tier: opts.quality === 'auto' ? caps.tier : opts.quality });

  /* ---- Public instance --------------------------------------------------- */
  return {
    mode: 'webgl',
    /** The three.js pieces, for anyone who wants to go further. */
    three: { renderer, scene, camera },
    duration: DURATION,
    stages: STAGES,

    play() {
      intro.play();
    },
    pause() {
      intro.pause();
    },
    /** Jump to a point in the intro, 0–1, and hold there. */
    seek(t) {
      intro.seek(t);
    },
    /** Skip straight to the finished render. */
    finish() {
      intro.skip();
    },
    /** Drive the camera dolly manually, 0–1. */
    setScroll(t) {
      cam.scroll = Math.min(1, Math.max(0, t));
    },
    resize() {
      resize();
    },
    get progress() {
      return intro.progress;
    },
    get phase() {
      return stageForProgress(intro.progress);
    },

    destroy() {
      disposed = true;
      renderer.setAnimationLoop(null);
      intro.dispose();
      gsap.killTweensOf(hoverAmt);
      io?.disconnect();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onSkip);
      window.removeEventListener('wheel', onSkip);
      window.removeEventListener('touchmove', onSkip);
      window.removeEventListener('scroll', readScroll);
      container.removeEventListener('pointermove', onPointer);
      container.removeEventListener('pointerleave', clearHover);
      building.dispose();
      blueprint.dispose();
      landscape.dispose();
      lighting.dispose();
      sky.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      annot?.remove();
      container.classList.remove('esv-hero');
    },
  };
}

export { STAGES, applyFinalState };
export default { create, isSupported, STAGES };
