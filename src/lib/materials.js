/**
 * The phase material system.
 *
 * One patched MeshStandardMaterial family carries the building through every
 * stage of the intro. Nothing is swapped out: the same vertices travel from the
 * plan up into the volume, the same fragments move from near-black through clay
 * to their real material as a front sweeps across the site. That is what makes
 * the sequence read as one continuous build rather than six scenes.
 */

import {
  BackSide,
  Color,
  DoubleSide,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { GROWTH_VERTEX, NOISE, SWEEP } from './shaderChunks.js';

export const CLAY = new Color('#b6b2ab');
export const DARK = new Color('#191e23');
export const ACCENT = new Color('#78a6ce');
export const WARM = new Color('#ffd2a8');

/** Role table: index matches `ROLE` in buildingModel.js. */
const ROLE_COLORS = ['#8a8680', '#593921', '#5f646a', '#7e7a74', '#2b3d20', '#2b3720'].map(
  (hex) => new Color(hex),
);
const ROLE_RM = [
  new Vector2(0.78, 0.0), // concrete
  new Vector2(0.58, 0.0), // wood
  new Vector2(0.34, 0.9), // metal
  new Vector2(0.82, 0.0), // stone
  new Vector2(0.92, 0.0), // planting
  new Vector2(0.95, 0.0), // ground
];

/**
 * Every animated value the intro drives. Materials share these uniform objects
 * by reference, so the timeline writes once and the whole scene follows.
 */
export function createPhaseUniforms() {
  return {
    uExtrude: { value: 0 },
    uEnv: { value: 0 },
    uSurface: { value: 0 },
    uClay: { value: 0 },
    uMat: { value: 0 },
    uLight: { value: 0 },
    uWire: { value: 0 },
    uDraw: { value: 0 },
    uBlueprint: { value: 0 },
    uInterior: { value: 0 },
    uHover: { value: -1 },
    uHoverAmt: { value: 0 },
    uTime: { value: 0 },
    uSweepDir: { value: new Vector2(0.86, 0.51) },
    uSweepRange: { value: new Vector2(-32, 41) },
    uAccent: { value: ACCENT.clone() },
    uWarm: { value: WARM.clone() },
    uClayColor: { value: CLAY.clone() },
    uDarkColor: { value: DARK.clone() },
    uRoleColor: { value: ROLE_COLORS },
    uRoleRM: { value: ROLE_RM },
  };
}

/* -------------------------------------------------------------------------- */

const VERTEX_HEAD = /* glsl */ `
  ${GROWTH_VERTEX}
  attribute float aRole;
  varying vec3 vWorldPos;
  varying vec3 vWorldNrm;
  varying float vRole;
  varying float vPart;
  varying float vCover;
`;

const VERTEX_BODY = /* glsl */ `
  float g = esGrowth(aAnim.x, aAnim.y);
  vec3 transformed = mix(aOrigin, vec3(position), g);
  vCover = g;
  vRole = aRole;
  vPart = aAnim.z;
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWorldNrm = normalize(mat3(modelMatrix) * normal);
`;

const FRAGMENT_HEAD = /* glsl */ `
  ${NOISE}
  ${SWEEP}
  uniform float uSurface;
  uniform float uClay;
  uniform float uLight;
  uniform float uInterior;
  uniform float uHover;
  uniform float uHoverAmt;
  uniform float uTime;
  uniform vec3 uAccent;
  uniform vec3 uWarm;
  uniform vec3 uClayColor;
  uniform vec3 uDarkColor;
  uniform vec3 uRoleColor[6];
  uniform vec2 uRoleRM[6];
  varying vec3 vWorldPos;
  varying vec3 vWorldNrm;
  varying float vRole;
  varying float vPart;
  varying float vCover;

  void esRole(out vec3 col, out vec2 rm) {
    col = vec3(0.0);
    rm = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      float w = step(abs(float(i) - vRole), 0.5);
      col += uRoleColor[i] * w;
      rm += uRoleRM[i] * w;
    }
  }

  /* Procedural surface character — the difference between CG and a render. */
  void esDetail(vec3 world, inout vec3 col, inout float rough) {
    float role = vRole;
    // Fine patterns fade with distance; otherwise they alias into flat grey.
    float fade = 1.0 - smoothstep(16.0, 62.0, distance(world, cameraPosition));

    if (role < 0.5) {                       // concrete
      float mottle = esFbm(world * 0.42);
      float fine = esNoise(world * 6.5);
      col *= 0.84 + mottle * 0.24 + fine * 0.05;
      // Board-formed shutter joints every 650 mm.
      float board = smoothstep(0.045, 0.0, abs(fract(world.y / 0.65) - 0.5) - 0.485);
      col *= 1.0 - board * 0.24 * fade;
      // Weathering pulls the base down a touch.
      col *= mix(0.88, 1.0, smoothstep(-0.3, 1.6, world.y));
      rough = clamp(rough + mottle * 0.14 - 0.05, 0.35, 1.0);
    } else if (role < 1.5) {                // timber
      float slat = esHash(vec3(floor(world.x * 3.4), floor(world.z * 3.4), 1.0));
      float grain = esFbm(vec3(world.x * 22.0, world.y * 1.4, world.z * 22.0));
      col *= 0.80 + slat * 0.2 + grain * 0.16;
      // Board joints, but only where the timber is laid flat.
      float laidFlat = smoothstep(0.6, 0.95, abs(vWorldNrm.y));
      float joint = smoothstep(0.05, 0.0, abs(fract(world.z / 0.30) - 0.5) - 0.46);
      float boardTone = esHash(vec3(floor(world.z / 0.30), 7.0, 3.0));
      col *= 1.0 - laidFlat * fade * (joint * 0.4 - boardTone * 0.16 + 0.08);
      rough = clamp(rough + grain * 0.2 - 0.08, 0.3, 1.0);
    } else if (role < 2.5) {                // metal
      float brushed = esNoise(vec3(world.x * 40.0, world.y * 3.0, world.z * 40.0));
      rough = clamp(rough + brushed * 0.12 * fade, 0.05, 1.0);
    } else if (role < 3.5) {                // stone
      float speck = esFbm(world * 3.2);
      col *= 0.85 + speck * 0.34;
      rough = clamp(rough + speck * 0.1, 0.4, 1.0);
    } else {                                // planting
      float leaf = esFbm(world * 1.9);
      float tone = esHash(floor(world * 0.55));
      col *= 0.5 + leaf * 0.42 + tone * 0.24;
      col.g *= 1.04;
    }
  }
`;

/* -------------------------------------------------------------------------- */

function patchVertex(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
    .replace('#include <begin_vertex>', VERTEX_BODY);
}

/**
 * @param {object} uniforms shared phase uniforms
 * @param {object} options
 * @param {boolean} options.glass  glazing variant: reflective, self-lit at dusk
 */
export function createSurfaceMaterial(uniforms, { glass = false } = {}) {
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: glass ? 2.0 : 0.7,
    dithering: true,
  });
  if (glass) material.side = DoubleSide;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      /* Grain the surfaces in as they rise, rather than popping them on. */
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `
        #include <clipping_planes_fragment>
        float esCoverage = clamp(uSurface * 1.25, 0.0, 1.0) * smoothstep(0.02, 0.42, vCover);
        if (esCoverage < 0.999 && esCoverage < esDither(gl_FragCoord.xy)) discard;
        `,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec3 esCol; vec2 esRM;
        esRole(esCol, esRM);
        vec2 esS = esSweep(vWorldPos);
        float esM = esS.x;

        float esRough = esRM.x;
        esDetail(vWorldPos, esCol, esRough);

        vec3 esBase = mix(uDarkColor, uClayColor, uClay);
        diffuseColor.rgb = mix(esBase, esCol, esM);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = mix(0.88, esRough, esM);
        `,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `
        float metalnessFactor = mix(0.0, esRM.y, esM);
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        #include <emissivemap_fragment>
        float esFres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 3.0);

        // The materialisation front leaves a thin lit edge behind it.
        totalEmissiveRadiance += uAccent * esS.y * 0.9;
        totalEmissiveRadiance += vec3(1.0) * esS.y * esFres * 0.5;

        // Pointer highlight rims the hovered part instead of flooding it.
        float esHov = step(abs(vPart - uHover), 0.5) * uHoverAmt;
        totalEmissiveRadiance += uAccent * esHov * (0.028 + esFres * 0.19);
        ${
          glass
            ? /* glsl */ `
        // Dusk reflection plus a few interior lights coming on.
        totalEmissiveRadiance += uAccent * esFres * 0.10 * uLight * esM;
        float esBay = esHash(floor(vWorldPos * vec3(0.3, 0.3, 0.3)));
        float esLit = step(0.845, esBay) * uInterior * esM;
        totalEmissiveRadiance += uWarm * esLit * 0.038 * (1.0 - esFres * 0.75);
        `
            : ''
        }
        `,
      );

    if (glass) {
      // Glazing is dark and mirror-like once materialised; clay before that.
      shader.fragmentShader = shader.fragmentShader.replace(
        'diffuseColor.rgb = mix(esBase, esCol, esM);',
        /* glsl */ `
        vec3 esGlassTint = vec3(0.014, 0.020, 0.027);
        diffuseColor.rgb = mix(esBase, esGlassTint, esM);
        `,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'float roughnessFactor = mix(0.88, esRough, esM);',
          'float roughnessFactor = mix(0.88, 0.035, esM);',
        )
        .replace(
          'float metalnessFactor = mix(0.0, esRM.y, esM);',
          'float metalnessFactor = mix(0.0, 0.06, esM);',
        );
    }
  };

  // Force a distinct program per variant.
  material.customProgramCacheKey = () => (glass ? 'es-glass' : 'es-surface');
  return material;
}

/** Depth material so animated geometry casts matching shadows. */
export function createDepthMaterial(uniforms) {
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\nuniform float uSurface;\nvarying float vCover;\nvarying vec3 vWorldPos;\nvarying float vRole;\nvarying float vPart;`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n  float esCoverage = clamp(uSurface * 1.25, 0.0, 1.0) * smoothstep(0.02, 0.42, vCover);\n  if (esCoverage < 0.999 && esCoverage < esDither(gl_FragCoord.xy)) discard;`,
      );
  };
  material.customProgramCacheKey = () => 'es-depth';
  return material;
}

/* -------------------------------------------------------------------------- */
/* Line materials                                                              */
/* -------------------------------------------------------------------------- */

/** Wireframe edges: rise with the solids, glow faintly, then fade to clay. */
export function createWireMaterial(uniforms) {
  return new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${GROWTH_VERTEX}
      varying float vFade;
      void main() {
        float g = esGrowth(aAnim.x, aAnim.y);
        vec3 p = mix(aOrigin, position, g);
        vFade = g;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uWire;
      uniform vec3 uAccent;
      varying float vFade;
      void main() {
        float a = uWire * smoothstep(0.0, 0.3, vFade) * 0.92;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.88, 0.93, 1.0), uAccent * 1.5, 0.48);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Plan drawing: progressively traced, with a lit head at the pen position. */
export function createBlueprintMaterial(uniforms) {
  return new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute float aWeight;
      varying float vT;
      varying float vWeight;
      void main() {
        vT = aT;
        vWeight = aWeight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDraw;
      uniform float uBlueprint;
      uniform vec3 uAccent;
      varying float vT;
      varying float vWeight;
      void main() {
        if (vT > uDraw) discard;
        float head = smoothstep(0.035, 0.0, uDraw - vT);
        vec3 col = mix(vec3(0.70, 0.76, 0.82), uAccent, 0.42 + vWeight * 0.2);
        col = mix(col, vec3(0.86, 0.93, 1.0), head * 0.9);
        float a = uBlueprint * clamp(vWeight, 0.0, 1.0) * (0.72 + head * 0.75);
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/* -------------------------------------------------------------------------- */
/* Environment                                                                 */
/* -------------------------------------------------------------------------- */

/** Ground plane — appears with the landscape, fades out to meet the sky. */
export function createGroundMaterial(uniforms) {
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${NOISE}\nuniform float uEnv;\nuniform float uLight;\nuniform vec3 uClayColor;\nuniform vec3 uDarkColor;\nvarying vec3 vGroundPos;`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 g = vGroundPos.xz;
        float r = length(g);

        float lawn = esFbm(vec3(g * 0.09, 0.0));
        float blades = esNoise(vec3(g * 2.6, 0.0));
        vec3 grass = vec3(0.036, 0.055, 0.026) * (0.72 + lawn * 0.6 + blades * 0.14);

        float gravel = esNoise(vec3(g * 1.4, 3.0));
        vec3 aggregate = vec3(0.060, 0.058, 0.053) * (0.8 + gravel * 0.4);

        // A gravel apron hugs the building footprint.
        float apron = 1.0 - smoothstep(11.0, 17.0, max(abs(g.x) * 0.9, abs(g.y - 2.0)));
        vec3 col = mix(grass, aggregate, clamp(apron, 0.0, 1.0) * 0.7);

        // Dissolve into the sky so the plane never shows an edge.
        float horizon = 1.0 - smoothstep(34.0, 96.0, r);
        col = mix(vec3(0.030, 0.026, 0.024), col, horizon);

        diffuseColor.rgb = mix(uDarkColor * 0.25, col, uEnv);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = mix(1.0, 0.86, uEnv);',
      );
  };
  material.customProgramCacheKey = () => 'es-ground';
  return material;
}

/** Pool water: mirror-flat with a slow ripple perturbing the normal. */
export function createWaterMaterial(uniforms) {
  const material = new MeshStandardMaterial({
    color: 0x060d11,
    roughness: 0.035,
    metalness: 0.1,
    envMapIntensity: 0.9,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${NOISE}\nuniform float uTime;\nuniform float uEnv;\nuniform vec3 uAccent;\nvarying vec3 vWaterPos;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        vec2 w = vWaterPos.xz;
        float e = 0.35;
        float n0 = esNoise(vec3(w * 1.7, uTime * 0.16));
        float nx = esNoise(vec3((w + vec2(e, 0.0)) * 1.7, uTime * 0.16));
        float nz = esNoise(vec3((w + vec2(0.0, e)) * 1.7, uTime * 0.16));
        normal = normalize(normal + vec3(n0 - nx, 0.0, n0 - nz) * 0.55);
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= uEnv;',
      );
  };
  material.customProgramCacheKey = () => 'es-water';
  return material;
}

/** Sky dome. Doubles as the scene backdrop, so it also sets the mood floor. */
export function createSkyMaterial(uniforms) {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uSunDir: { value: new Vector3(0.4, 0.3, 1).normalize() } },
    side: BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uLight;
      uniform vec3 uAccent;
      uniform vec3 uWarm;
      uniform vec3 uSunDir;
      varying vec3 vDir;

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

        // Studio state: an almost black room with the faintest blue lift.
        vec3 studio = mix(vec3(0.0026, 0.0030, 0.0038), vec3(0.0050, 0.0064, 0.0088), h);
        studio += uAccent * 0.010 * pow(1.0 - abs(d.y), 6.0);

        // Dusk state: cool zenith, warm horizon behind the sun.
        vec3 zenith = vec3(0.0055, 0.0105, 0.0245);
        vec3 horizon = vec3(0.062, 0.052, 0.048);
        vec3 sky = mix(horizon, zenith, pow(h, 0.5));
        float toSun = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
        sky += uWarm * (pow(toSun, 60.0) * 1.4 + pow(toSun, 4.0) * 0.055);
        sky *= 1.0 - smoothstep(0.0, -0.2, d.y) * 0.62; // ground half falls away

        vec3 col = mix(studio, sky, uLight);
        // Dither to keep wide gradients free of banding.
        col += (esHash(vec3(gl_FragCoord.xy, 1.0)) - 0.5) * 0.006;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
