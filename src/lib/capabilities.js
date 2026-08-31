/**
 * Device / renderer capability probing.
 *
 * Everything the 3D scene scales on is decided once, up front, and exposed as a
 * plain object so it can be read outside of React (shaders, geometry builders).
 */

let cached = null;

function probeWebGL() {
  if (typeof window === 'undefined') return { ok: false, webgl2: false };
  try {
    const canvas = document.createElement('canvas');
    const attrs = { failIfMajorPerformanceCaveat: false, antialias: false, depth: true };
    const gl2 = canvas.getContext('webgl2', attrs);
    if (gl2) {
      // A context that reports no usable texture units is effectively broken.
      const units = gl2.getParameter(gl2.MAX_TEXTURE_IMAGE_UNITS);
      loseContext(gl2);
      return { ok: units > 0, webgl2: true };
    }
    const gl1 = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (gl1) {
      loseContext(gl1);
      return { ok: true, webgl2: false };
    }
  } catch {
    /* fall through to the static fallback */
  }
  return { ok: false, webgl2: false };
}

function loseContext(gl) {
  const ext = gl.getExtension('WEBGL_lose_context');
  if (ext) ext.loseContext();
}

/**
 * Tiers:
 *   'high'   full scene — shadows, environment, water, full tree count
 *   'medium' shadows at half resolution, fewer props
 *   'low'    no shadows, simplified landscape, capped pixel ratio
 */
function resolveTier({ webgl2 }) {
  if (typeof window === 'undefined') return 'low';

  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 4;

  if (!webgl2) return 'low';
  if (coarse && narrow) return cores >= 6 && memory >= 4 ? 'medium' : 'low';
  if (cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

export const TIER_SETTINGS = {
  high: {
    shadows: true,
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    trees: 9,
    shrubs: 14,
    water: true,
    groundSegments: 64,
    envResolution: 256,
    slatCount: 26,
  },
  medium: {
    shadows: true,
    shadowMapSize: 1024,
    maxPixelRatio: 1.75,
    trees: 6,
    shrubs: 8,
    water: true,
    groundSegments: 32,
    envResolution: 128,
    slatCount: 18,
  },
  low: {
    shadows: false,
    shadowMapSize: 512,
    maxPixelRatio: 1.5,
    trees: 4,
    shrubs: 4,
    water: false,
    groundSegments: 16,
    envResolution: 64,
    slatCount: 12,
  },
};

/** `?tier=high|medium|low` pins quality — for grabbing stills, and for QA. */
function pinnedTier() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('tier');
  return raw && raw in TIER_SETTINGS ? raw : null;
}

export function getCapabilities() {
  if (cached) return cached;

  const gl = probeWebGL();
  const pinned = pinnedTier();
  const tier = pinned ?? resolveTier(gl);
  const reducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const touch =
    typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

  cached = {
    webgl: gl.ok,
    webgl2: gl.webgl2,
    tier,
    pinned: pinned !== null,
    settings: TIER_SETTINGS[tier],
    reducedMotion,
    touch,
    /** Custom cursor and hover labels are pointer-device only. */
    finePointer: !touch,
  };
  return cached;
}

/** Allows the live FPS watchdog to demote the scene at runtime. */
export function demoteTier() {
  const caps = getCapabilities();
  if (caps.pinned || caps.tier === 'low') return caps;
  const next = caps.tier === 'high' ? 'medium' : 'low';
  cached = { ...caps, tier: next, settings: TIER_SETTINGS[next] };
  return cached;
}
