/**
 * WebGL-free rendering of the same villa.
 *
 * A small painter's-algorithm projector that emits SVG polygons. It draws the
 * massing, the glazing, the timber cladding and a real cast shadow from the sun
 * direction — so the no-WebGL path shows the actual building rather than a
 * stand-in. No three.js, no canvas, no network.
 */

import { DIM as D, OPENING_PROFILE, WALLS, wallVector } from './buildingModel.js';
import { buildMassing } from './villa.js';

const SUN = norm([-0.64, 0.43, 0.64]);
const GROUND_Y = -0.34;

/* ---- vector helpers ------------------------------------------------------ */

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function add(a, b, s = 1) {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

/* ---- camera -------------------------------------------------------------- */

function makeCamera({ eye, target, fov, width, height }) {
  const forward = norm(sub(target, eye));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const f = 1 / Math.tan((fov * Math.PI) / 360);
  const aspect = width / height;

  return {
    eye,
    project(p) {
      const v = sub(p, eye);
      const z = dot(v, forward);
      if (z <= 0.05) return null;
      const x = dot(v, right);
      const y = dot(v, up);
      return [
        (((x / z) * f) / aspect) * 0.5 * width + width / 2,
        height / 2 - (y / z) * f * 0.5 * height,
        z,
      ];
    },
  };
}

/* ---- geometry ------------------------------------------------------------ */

const FACE_DEFS = [
  { idx: [1, 5, 7, 3], n: [1, 0, 0] },
  { idx: [2, 6, 4, 0], n: [-1, 0, 0] },
  { idx: [4, 6, 7, 5], n: [0, 1, 0] },
  { idx: [0, 1, 3, 2], n: [0, -1, 0] },
  { idx: [3, 7, 6, 2], n: [0, 0, 1] },
  { idx: [0, 4, 5, 1], n: [0, 0, -1] },
];

function corners(size, pos) {
  const [w, h, d] = size;
  const out = [];
  for (let i = 0; i < 8; i += 1) {
    out.push([
      pos[0] + (i & 1 ? w / 2 : -w / 2),
      pos[1] + (i & 4 ? h / 2 : -h / 2),
      pos[2] + (i & 2 ? d / 2 : -d / 2),
    ]);
  }
  return out;
}

/**
 * Lambert against the sun plus a cool sky term, graded to match the dusk mood
 * of the live scene. The key-to-fill ratio is what gives the faces separation.
 */
function shade(normal, base, warm = [1.0, 0.86, 0.72], cool = [0.62, 0.72, 0.9]) {
  const key = Math.max(0, dot(normal, SUN));
  const sky = Math.max(0, 0.5 + normal[1] * 0.5);
  return base.map((c, i) =>
    Math.min(255, Math.round(c * (0.07 + key * 0.86 * warm[i] + sky * 0.16 * cool[i]))),
  );
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---- shadow -------------------------------------------------------------- */

function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const half = (src) => {
    const out = [];
    for (const p of src) {
      while (
        out.length >= 2 &&
        (out[out.length - 1][0] - out[out.length - 2][0]) * (p[1] - out[out.length - 2][1]) -
          (out[out.length - 1][1] - out[out.length - 2][1]) * (p[0] - out[out.length - 2][0]) <=
          0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.slice().reverse())];
}

function castShadow(boxes) {
  const flat = [];
  for (const box of boxes) {
    for (const c of corners(box.size, box.pos)) {
      const t = (c[1] - GROUND_Y) / SUN[1];
      flat.push([c[0] - SUN[0] * t, GROUND_Y + 0.004, c[2] - SUN[2] * t]);
    }
  }
  return hull(flat.map((p) => [p[0], p[2]])).map((p) => [p[0], GROUND_Y + 0.004, p[1]]);
}

/* ---- scene --------------------------------------------------------------- */

const PALETTE = {
  concrete: [166, 160, 151],
  timber: [124, 80, 46],
  glass: [16, 22, 30],
  stone: [158, 152, 144],
  water: [16, 34, 46],
  foliage: [52, 74, 42],
};

function wallFaceQuads(push) {
  for (const wall of WALLS) {
    const { ax, az, dx, dz } = wallVector(wall);
    // `WALLS` orders its loop so this normal points inward; the drawn face is
    // on the outside.
    const nx = dz;
    const nz = -dx;
    const off = wall.t / 2 + 0.03;
    const at = (s, y) => [ax + dx * s + nx * off, y, az + dz * s + nz * off];
    const normal = [nx, 0, nz];

    if (wall.type === 'glass') {
      const { len } = wallVector(wall);
      push(
        [
          at(0.06, wall.base + 0.12),
          at(len - 0.06, wall.base + 0.12),
          at(len - 0.06, wall.base + wall.h - 0.22),
          at(0.06, wall.base + wall.h - 0.22),
        ],
        normal,
        PALETTE.glass,
      );
      const bays = wall.bays ?? 4;
      for (let i = 1; i < bays; i += 1) {
        const s = (i * len) / bays;
        push(
          [
            at(s - 0.045, wall.base + 0.12),
            at(s + 0.045, wall.base + 0.12),
            at(s + 0.045, wall.base + wall.h - 0.22),
            at(s - 0.045, wall.base + wall.h - 0.22),
          ],
          normal,
          [110, 116, 122],
          0.7,
        );
      }
      continue;
    }

    for (const o of wall.openings ?? []) {
      if (wall.interior) continue;
      const p = OPENING_PROFILE[o.kind];
      const s = o.at - o.w / 2;
      const e = o.at + o.w / 2;
      const y0 = wall.base + p.sill;
      const y1 = y0 + p.height;
      push(
        [at(s, y0), at(e, y0), at(e, y1), at(s, y1)],
        normal,
        o.kind === 'door' ? [38, 40, 43] : PALETTE.glass,
      );
    }

    if (wall.type === 'clad') {
      const { len } = wallVector(wall);
      const count = Math.floor(len / 0.42);
      for (let i = 0; i < count; i += 1) {
        const s = (i + 0.5) * (len / count);
        push(
          [
            at(s - 0.12, wall.base + 0.05),
            at(s + 0.12, wall.base + 0.05),
            at(s + 0.12, wall.base + wall.h - 0.05),
            at(s - 0.12, wall.base + wall.h - 0.05),
          ],
          normal,
          PALETTE.timber,
        );
      }
    }
  }
}

/* Matches the live scene: nothing between the camera and the building. */
const TREES = [
  [-22, 12, 0.98],
  [-18, -14, 0.86],
  [15, -14, 0.8],
  [29, -8, 0.92],
  [-11, 25, 0.78],
  [2, 27, 0.88],
];

const CANOPY = [
  [2.8, 1.6, 2.5, 0.75, 0, 0],
  [2.3, 1.5, 2.1, 1.55, 0.3, -0.24],
  [2.0, 1.4, 1.9, 1.75, -0.32, 0.28],
  [1.4, 1.2, 1.3, 2.5, 0.06, 0.1],
];

/**
 * @returns {{width:number,height:number,faces:Array,shadow:string,horizon:number}}
 */
export function renderStatic({ width = 1600, height = 900 } = {}) {
  const camera = makeCamera({
    eye: [34, 12.5, 46],
    target: [-0.5, 7.4, 2.0],
    fov: 27,
    width,
    height,
  });

  const faces = [];

  const push = (pts, normal, base, opacity = 1) => {
    const projected = pts.map((p) => camera.project(p));
    if (projected.some((p) => !p)) return;
    const centroid = pts
      .reduce((acc, p) => add(acc, p), [0, 0, 0])
      .map((c) => c / pts.length);
    const depth = Math.hypot(
      centroid[0] - camera.eye[0],
      centroid[1] - camera.eye[1],
      centroid[2] - camera.eye[2],
    );
    faces.push({
      d: projected.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
      fill: rgb(shade(norm(normal), base)),
      opacity,
      depth,
    });
  };

  // The ground is painted as a gradient band below the horizon rather than a
  // projected quad — a plane that large always clips behind the camera.
  const massing = buildMassing();

  /* Cast shadow, on the ground and under everything else. */
  const shadowPts = castShadow(massing.slice(0, 6)).map((p) => camera.project(p));
  const shadow = shadowPts.every(Boolean)
    ? shadowPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    : '';

  /* Pool */
  push(
    [
      [D.poolX0, -0.12, D.poolZ0],
      [D.poolX1, -0.12, D.poolZ0],
      [D.poolX1, -0.12, D.poolZ1],
      [D.poolX0, -0.12, D.poolZ1],
    ],
    [0, 1, 0],
    PALETTE.water,
    1,
  );

  /* Massing volumes */
  massing.forEach((box, i) => {
    const c = corners(box.size, box.pos);
    const base =
      i === 6 ? PALETTE.glass : i === 7 ? PALETTE.timber : i === 8 ? PALETTE.water : PALETTE.concrete;
    for (const face of FACE_DEFS) {
      const centroid = face.idx
        .reduce((acc, k) => add(acc, c[k]), [0, 0, 0])
        .map((v) => v / 4);
      if (dot(face.n, sub(camera.eye, centroid)) <= 0) continue; // backface
      push(
        face.idx.map((k) => c[k]),
        face.n,
        base,
        i === 6 ? 0.5 : 1,
      );
    }
  });

  wallFaceQuads(push);

  /* Planting */
  for (const [x, z, s] of TREES) {
    const trunkH = 2.4 * s;
    const boxes = [[corners([0.26 * s, trunkH, 0.26 * s], [x, trunkH / 2, z]), PALETTE.timber]];
    for (const [cw, ch, cd, cy, ox, oz] of CANOPY) {
      boxes.push([
        corners([cw * s, ch * s, cd * s], [x + ox * s, trunkH + cy * s, z + oz * s]),
        PALETTE.foliage,
      ]);
    }
    for (const [box, base] of boxes) {
      for (const face of FACE_DEFS) {
        const centroid = face.idx.reduce((acc, k) => add(acc, box[k]), [0, 0, 0]).map((v) => v / 4);
        if (dot(face.n, sub(camera.eye, centroid)) <= 0) continue;
        push(
          face.idx.map((k) => box[k]),
          face.n,
          base,
        );
      }
    }
  }

  faces.sort((a, b) => b.depth - a.depth);

  const horizonPoint = camera.project([0, GROUND_Y, -600]);
  return { width, height, faces, shadow, horizon: horizonPoint ? horizonPoint[1] : height * 0.42 };
}
