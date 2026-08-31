/**
 * The phase-1 drawing.
 *
 * Derived from the same `WALLS` the solid is built from, so the plan is a true
 * projection of the building rather than a decorative approximation. Segments
 * are emitted in drawing order and carry:
 *
 *   aT       the intro progress at which this point is reached (0..1)
 *   aWeight  line weight, giving the drawing a proper hierarchy:
 *            1.0 cut walls · 0.55 openings · 0.3 dimensions · 0.14 grid
 */

import { BufferAttribute, BufferGeometry } from 'three';
import { DIM as D, OPENING_PROFILE, WALLS, wallVector } from './buildingModel.js';

const EXT_HALF = D.wallExt / 2;

/* -------------------------------------------------------------------------- */

class Sheet {
  constructor() {
    this.bands = new Map();
  }

  /** @param band [start, end] window of intro progress this group draws in. */
  line(band, weight, a, b) {
    let group = this.bands.get(band);
    if (!group) {
      group = [];
      this.bands.set(band, group);
    }
    group.push({ a, b, weight });
  }

  polyline(band, weight, points, close = false) {
    for (let i = 0; i < points.length - 1; i += 1) {
      this.line(band, weight, points[i], points[i + 1]);
    }
    if (close && points.length > 2) {
      this.line(band, weight, points[points.length - 1], points[0]);
    }
  }

  circle(band, weight, cx, cz, r, segments = 20) {
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    this.polyline(band, weight, pts);
  }

  arc(band, weight, cx, cz, r, from, to, segments = 14) {
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = from + (to - from) * (i / segments);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    this.polyline(band, weight, pts);
  }
}

const BAND = {
  GRID: [0.0, 0.22],
  EXTERIOR: [0.08, 0.46],
  INTERIOR: [0.4, 0.64],
  OPENINGS: [0.58, 0.78],
  DIMENSIONS: [0.72, 0.9],
  ANNOTATION: [0.84, 1.0],
};

/* -------------------------------------------------------------------------- */
/* Walls                                                                       */
/* -------------------------------------------------------------------------- */

/** How far a wall end is pulled back so junctions read correctly. */
function trims(wall) {
  const onEnvelope = ([x, z]) =>
    Math.abs(x - D.x0) < 0.01 ||
    Math.abs(x - D.x1) < 0.01 ||
    Math.abs(z - D.z0) < 0.01 ||
    Math.abs(z - D.z1) < 0.01;

  if (!wall.interior) return [-EXT_HALF, -EXT_HALF]; // negative = extend into the mitre
  return [onEnvelope(wall.a) ? EXT_HALF : 0, onEnvelope(wall.b) ? EXT_HALF : 0];
}

/** Solid spans of a wall in trimmed parameter space. */
function drawnRuns(wall) {
  const { len } = wallVector(wall);
  const [t0, t1] = trims(wall);
  const start = t0;
  const end = len - t1;

  const gaps = (wall.openings ?? [])
    .slice()
    .sort((p, q) => p.at - q.at)
    .map((o) => [o.at - o.w / 2, o.at + o.w / 2]);

  const runs = [];
  let cursor = start;
  for (const [gs, ge] of gaps) {
    if (gs > cursor + 0.02) runs.push([cursor, Math.min(gs, end)]);
    cursor = Math.max(cursor, ge);
  }
  if (cursor < end - 0.02) runs.push([cursor, end]);
  return runs.filter(([s, e]) => e - s > 0.02);
}

function wallLines(sheet, wall) {
  const { ax, az, dx, dz, len } = wallVector(wall);
  const nx = -dz;
  const nz = dx;
  const half = wall.t / 2;
  const band = wall.interior ? BAND.INTERIOR : BAND.EXTERIOR;
  const at = (s, off) => [ax + dx * s + nx * off, az + dz * s + nz * off];

  for (const [s, e] of drawnRuns(wall)) {
    sheet.line(band, 1, at(s, half), at(e, half));
    sheet.line(band, 1, at(s, -half), at(e, -half));
  }

  // Free ends get a closing cap.
  const [t0, t1] = trims(wall);
  if (wall.interior) {
    if (t0 === 0) sheet.line(band, 1, at(0, half), at(0, -half));
    if (t1 === 0) sheet.line(band, 1, at(len, half), at(len, -half));
  }

  // Reveals at every opening.
  for (const o of wall.openings ?? []) {
    const s = o.at - o.w / 2;
    const e = o.at + o.w / 2;
    sheet.line(BAND.OPENINGS, 0.62, at(s, half), at(s, -half));
    sheet.line(BAND.OPENINGS, 0.62, at(e, half), at(e, -half));

    if (o.kind === 'door') {
      const swing = wall.interior ? 1 : -1;
      const hinge = at(s, 0);
      const leafEnd = [hinge[0] + nx * swing * o.w, hinge[1] + nz * swing * o.w];
      sheet.line(BAND.OPENINGS, 0.55, hinge, leafEnd);
      const a0 = Math.atan2(leafEnd[1] - hinge[1], leafEnd[0] - hinge[0]);
      const a1 = Math.atan2(dz, dx);
      let delta = a1 - a0;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      sheet.arc(BAND.OPENINGS, 0.3, hinge[0], hinge[1], o.w, a0, a0 + delta);
    } else {
      // Glazing shown as a pair of thin lines inside the reveal.
      const g = wall.t / 6;
      sheet.line(BAND.OPENINGS, 0.55, at(s, g), at(e, g));
      sheet.line(BAND.OPENINGS, 0.55, at(s, -g), at(e, -g));
    }
  }
}

function curtainWallLines(sheet, wall) {
  const { len } = wallVector(wall);
  const { ax, az, dx, dz } = wallVector(wall);
  const nx = -dz;
  const nz = dx;
  const g = wall.t / 5;
  const bays = wall.bays ?? 4;
  const at = (s, off) => [ax + dx * s + nx * off, az + dz * s + nz * off];

  sheet.line(BAND.EXTERIOR, 0.8, at(-EXT_HALF, g), at(len + EXT_HALF, g));
  sheet.line(BAND.EXTERIOR, 0.8, at(-EXT_HALF, -g), at(len + EXT_HALF, -g));

  for (let i = 0; i <= bays; i += 1) {
    const s = (i * len) / bays;
    sheet.line(BAND.OPENINGS, 0.55, at(s, wall.t / 2), at(s, -wall.t / 2));
  }
}

/* -------------------------------------------------------------------------- */
/* Annotation                                                                  */
/* -------------------------------------------------------------------------- */

const GRID_X = [D.x0, -6.5, -1.5, 4.5, D.x1];
const GRID_Z = [D.z0, -1.4, 2.2, D.z1];

/** A bounded setting-out grid: it reads as a sheet, not as wallpaper. */
function constructionGrid(sheet) {
  const step = 2;
  const [x0, x1, z0, z1] = [-21, 21, -11, 13];
  for (let x = x0; x <= x1; x += step) sheet.line(BAND.GRID, 0.055, [x, z0], [x, z1]);
  for (let z = z0; z <= z1; z += step) sheet.line(BAND.GRID, 0.055, [x0, z], [x1, z]);
}

function dimensionRun(sheet, axis, values, offset, from, to) {
  const p = (main, cross) => (axis === 'x' ? [main, cross] : [cross, main]);
  const tick = 0.26;

  sheet.line(BAND.DIMENSIONS, 0.26, p(from, offset), p(to, offset));

  for (const v of values) {
    sheet.line(BAND.DIMENSIONS, 0.3, p(v, offset - tick), p(v, offset + tick));
    // 45-degree architectural tick.
    sheet.line(
      BAND.DIMENSIONS,
      0.3,
      p(v - tick * 0.7, offset - tick * 0.7),
      p(v + tick * 0.7, offset + tick * 0.7),
    );
  }
}

function gridBubbles(sheet) {
  const r = 0.62;
  const stem = 2.2;
  const zBase = D.z0 - EXT_HALF;
  for (const x of GRID_X) {
    sheet.line(BAND.ANNOTATION, 0.22, [x, zBase], [x, zBase - stem]);
    sheet.circle(BAND.ANNOTATION, 0.34, x, zBase - stem - r, r);
  }
  const xBase = D.x0 - EXT_HALF;
  for (const z of GRID_Z) {
    sheet.line(BAND.ANNOTATION, 0.22, [xBase, z], [xBase - stem, z]);
    sheet.circle(BAND.ANNOTATION, 0.34, xBase - stem - r, z, r);
  }
}

function northArrow(sheet) {
  const cx = 18.6;
  const cz = -9.4;
  sheet.circle(BAND.ANNOTATION, 0.3, cx, cz, 1.15);
  sheet.polyline(
    BAND.ANNOTATION,
    0.6,
    [
      [cx, cz + 1.5],
      [cx - 0.62, cz - 1.2],
      [cx, cz - 0.55],
      [cx + 0.62, cz - 1.2],
    ],
    true,
  );
}

function scaleBar(sheet) {
  const x = -19.4;
  const z = 11.9;
  const unit = 2;
  sheet.line(BAND.ANNOTATION, 0.34, [x, z], [x + unit * 5, z]);
  for (let i = 0; i <= 5; i += 1) {
    sheet.line(BAND.ANNOTATION, 0.34, [x + i * unit, z - 0.34], [x + i * unit, z + 0.34]);
  }
  for (let i = 0; i < 5; i += 2) {
    sheet.line(BAND.ANNOTATION, 0.2, [x + i * unit, z - 0.34], [x + (i + 1) * unit, z - 0.34]);
    sheet.line(BAND.ANNOTATION, 0.2, [x + i * unit, z - 0.34], [x + i * unit, z]);
    sheet.line(
      BAND.ANNOTATION,
      0.2,
      [x + (i + 1) * unit, z - 0.34],
      [x + (i + 1) * unit, z],
    );
  }
}

/** Section A-A, cut vertically through the plan. */
function sectionMarker(sheet) {
  const x = -8.2;
  sheet.line(BAND.ANNOTATION, 0.26, [x, -9.2], [x, 10.4]);
  for (const z of [-9.2, 10.4]) {
    const dir = z < 0 ? 1 : -1;
    sheet.polyline(BAND.ANNOTATION, 0.5, [
      [x - 1.3, z],
      [x, z],
      [x, z + dir * 1.4],
    ]);
    sheet.polyline(BAND.ANNOTATION, 0.5, [
      [x - 0.34, z + dir * 0.95],
      [x, z + dir * 1.4],
      [x + 0.34, z + dir * 0.95],
    ]);
  }
}

function siteOutline(sheet) {
  // Terrace, pool and site wall shown as thin outlines on the plan.
  sheet.polyline(
    BAND.DIMENSIONS,
    0.24,
    [
      [D.deckX0, D.deckZ0],
      [D.deckX1, D.deckZ0],
      [D.deckX1, D.deckZ1],
      [D.deckX0, D.deckZ1],
    ],
    true,
  );
  sheet.polyline(
    BAND.DIMENSIONS,
    0.4,
    [
      [D.poolX0, D.poolZ0],
      [D.poolX1, D.poolZ0],
      [D.poolX1, D.poolZ1],
      [D.poolX0, D.poolZ1],
    ],
    true,
  );
  sheet.line(BAND.DIMENSIONS, 0.24, [-17.2, -9], [-17.2, 11]);
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

export function buildBlueprintGeometry() {
  const sheet = new Sheet();

  constructionGrid(sheet);

  for (const wall of WALLS) {
    if (wall.base !== D.l0) continue; // ground floor plan only
    if (wall.type === 'glass') curtainWallLines(sheet, wall);
    else wallLines(sheet, wall);
  }

  siteOutline(sheet);
  dimensionRun(sheet, 'x', GRID_X, D.z0 - 1.4, D.x0, D.x1);
  dimensionRun(sheet, 'z', GRID_Z, D.x0 - 1.4, D.z0, D.z1);
  gridBubbles(sheet);
  northArrow(sheet);
  scaleBar(sheet);
  sectionMarker(sheet);

  /* ---- Bake to buffers ---- */

  const positions = [];
  const ts = [];
  const weights = [];

  for (const [band, group] of sheet.bands) {
    const [b0, b1] = band;
    const n = group.length;
    group.forEach((seg, i) => {
      const t0 = b0 + (b1 - b0) * (i / n);
      const t1 = b0 + (b1 - b0) * ((i + 1) / n);
      positions.push(seg.a[0], 0, seg.a[1], seg.b[0], 0, seg.b[1]);
      ts.push(t0, t1);
      weights.push(seg.weight, seg.weight);
    });
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aT', new BufferAttribute(new Float32Array(ts), 1));
  geo.setAttribute('aWeight', new BufferAttribute(new Float32Array(weights), 1));
  geo.computeBoundingSphere();
  return geo;
}
