/** Shared GLSL helpers. Kept small — every one of these runs per fragment. */

export const NOISE = /* glsl */ `
  float esHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float esNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(esHash(i + vec3(0, 0, 0)), esHash(i + vec3(1, 0, 0)), f.x),
          mix(esHash(i + vec3(0, 1, 0)), esHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(esHash(i + vec3(0, 0, 1)), esHash(i + vec3(1, 0, 1)), f.x),
          mix(esHash(i + vec3(0, 1, 1)), esHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float esFbm(vec3 p) {
    return esNoise(p) * 0.55 + esNoise(p * 2.03) * 0.28 + esNoise(p * 4.11) * 0.17;
  }

  /* Interleaved gradient noise — an ordered dither that needs no lookup table. */
  float esDither(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }
`;

/**
 * Vertex growth shared by every animated object: each vertex travels from its
 * plan footprint (aOrigin) to its final position, sequenced by aAnim.x.
 */
export const GROWTH_VERTEX = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aAnim;
  uniform float uExtrude;
  uniform float uEnv;

  float esGrowth(float delay, float stage) {
    const float spread = 0.62;
    float drive = mix(uExtrude, uEnv, stage);
    float g = clamp(drive * (1.0 + spread) - delay * spread, 0.0, 1.0);
    return g * g * (3.0 - 2.0 * g);
  }
`;

/** Materialisation sweep: a soft front travelling across the site. */
export const SWEEP = /* glsl */ `
  uniform vec2 uSweepDir;
  uniform vec2 uSweepRange;
  uniform float uMat;

  float esSweepAxis(vec3 world) {
    return dot(world.xz, uSweepDir) + world.y * 0.55;
  }

  /* x = coverage 0..1, y = proximity to the travelling front */
  vec2 esSweep(vec3 world) {
    const float width = 3.4;
    float axis = esSweepAxis(world);
    float head = mix(uSweepRange.x - width, uSweepRange.y + width, uMat);
    float cover = 1.0 - smoothstep(head - width, head, axis);
    float front = smoothstep(0.0, 1.0, cover) * (1.0 - smoothstep(0.0, 1.0, cover));
    return vec2(cover, front * 4.0);
  }
`;
