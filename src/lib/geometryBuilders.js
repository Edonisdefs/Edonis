/**
 * Part list -> merged BufferGeometry.
 *
 * Every vertex carries the four values the phase shader needs, so the whole
 * building animates from a handful of draw calls with no per-mesh uniforms:
 *
 *   position  final resting place, in world space
 *   aOrigin   where the vertex collapses to at extrusion 0 (its plan footprint)
 *   aAnim     x = sequencing delay 0..1
 *             y = stage (0 building, 1 landscape) — picks the driving uniform
 *             z = logical part id, for pointer highlighting
 *   aRole     material role index, resolved to colour/roughness in the shader
 */

import { BoxGeometry, BufferAttribute, BufferGeometry, Euler, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new Matrix4();
const _e = new Euler();

function boxGeometry(p) {
  const geo = new BoxGeometry(p.size[0], p.size[1], p.size[2]);
  geo.deleteAttribute('uv');

  if (p.rot) _e.set(p.rot[0], p.rot[1], p.rot[2]);
  else _e.set(0, p.rotY ?? 0, 0);
  _m.makeRotationFromEuler(_e);
  _m.setPosition(p.pos[0], p.pos[1], p.pos[2]);
  geo.applyMatrix4(_m);

  const pos = geo.attributes.position;
  const count = pos.count;
  const origin = new Float32Array(count * 3);
  const anim = new Float32Array(count * 3);
  const role = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    // Collapse straight down onto the plan; the whole building grows from y=0.
    origin[i * 3] = pos.getX(i);
    origin[i * 3 + 1] = 0;
    origin[i * 3 + 2] = pos.getZ(i);

    anim[i * 3] = p.delay;
    anim[i * 3 + 1] = p.stage;
    anim[i * 3 + 2] = p.part;

    role[i] = p.role;
  }

  geo.setAttribute('aOrigin', new BufferAttribute(origin, 3));
  geo.setAttribute('aAnim', new BufferAttribute(anim, 3));
  geo.setAttribute('aRole', new BufferAttribute(role, 1));
  return geo;
}

/** Merges the opaque or the glass half of the part list into one geometry. */
export function buildSolidGeometry(parts, { glass = false } = {}) {
  const subset = parts.filter((p) => Boolean(p.glass) === glass);
  if (!subset.length) return null;
  const merged = mergeGeometries(subset.map(boxGeometry), false);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Wireframe                                                                   */
/* -------------------------------------------------------------------------- */

const EDGE_PAIRS = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0], // bottom
  [4, 5],
  [5, 7],
  [7, 6],
  [6, 4], // top
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7], // verticals
];

function boxCorners(size, pos) {
  const [w, h, d] = size;
  const [cx, cy, cz] = pos;
  const out = [];
  for (let i = 0; i < 8; i += 1) {
    out.push([
      cx + (i & 1 ? w / 2 : -w / 2),
      cy + (i & 4 ? h / 2 : -h / 2),
      cz + (i & 2 ? d / 2 : -d / 2),
    ]);
  }
  return out;
}

/**
 * Line geometry for the wireframe phase: massing volume edges plus the curtain
 * wall grid. Shares aOrigin/aAnim with the solids so lines and surfaces rise
 * together.
 */
export function buildWireGeometry(massing, detailLines) {
  const positions = [];
  const origins = [];
  const anims = [];

  const push = (a, b, delay, stage) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    origins.push(a[0], 0, a[2], b[0], 0, b[2]);
    anims.push(delay, stage, 0, delay, stage, 0);
  };

  for (const box of massing) {
    const c = boxCorners(box.size, box.pos);
    for (const [i, j] of EDGE_PAIRS) push(c[i], c[j], box.delay, box.stage ?? 0);
  }
  for (const seg of detailLines) push(seg.a, seg.b, seg.delay, 0);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aOrigin', new BufferAttribute(new Float32Array(origins), 3));
  geo.setAttribute('aAnim', new BufferAttribute(new Float32Array(anims), 3));
  geo.computeBoundingSphere();
  return geo;
}

/* -------------------------------------------------------------------------- */
/* Pointer picking                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Reads the logical part id off a raycast hit against a merged geometry.
 * Returns -1 when the hit carries no part attribute.
 */
export function partIdFromIntersection(intersection) {
  const geo = intersection?.object?.geometry;
  const anim = geo?.attributes?.aAnim;
  const face = intersection?.face;
  if (!anim || !face) return -1;
  return Math.round(anim.getZ(face.a));
}
