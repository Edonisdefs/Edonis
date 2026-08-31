/**
 * ES-Visuals — parametric villa.
 *
 * A single source of truth shared by the blueprint (2D) and the building (3D):
 * walls are authored once as plan geometry with openings, and both the drawing
 * and the solid are derived from them. Swapping in a real GLB later means
 * replacing `buildParts()` — the phase machinery does not care where the
 * geometry comes from, only that every vertex carries the four animation
 * attributes described in `geometryBuilders.js`.
 *
 * Units are metres. +X east, +Z north (toward the camera at the hero pose).
 */

export const ROLE = {
  CONCRETE: 0,
  WOOD: 1,
  METAL: 2,
  STONE: 3,
  PLANT: 4,
  GROUND: 5,
};

/**
 * Logical parts the pointer can pick up, with their hover annotation. Split
 * finely enough that highlighting one does not light up half the building.
 */
export const PART = {
  SHELL: 0,
  GLAZING: 1,
  GLAZING_UPPER: 2,
  WINDOW: 3,
  CLADDING: 4,
  ROOF: 5,
  DECK: 6,
  RAILING: 7,
  SITE: 8,
};

export const PART_LABELS = {
  [PART.SHELL]: { tag: 'FORM', detail: 'Exposed concrete shell' },
  [PART.GLAZING]: { tag: 'LIGHT', detail: 'Full-height glazing · living level' },
  [PART.GLAZING_UPPER]: { tag: 'LIGHT', detail: 'Full-height glazing · bedroom level' },
  [PART.WINDOW]: { tag: 'DETAIL', detail: 'Punched opening, deep reveal' },
  [PART.CLADDING]: { tag: 'MATERIAL', detail: 'Vertical oak rainscreen' },
  [PART.ROOF]: { tag: 'FORM', detail: 'Cantilevered flat roof' },
  [PART.DECK]: { tag: 'MATERIAL', detail: 'Timber terrace deck' },
  [PART.RAILING]: { tag: 'DETAIL', detail: 'Steel balustrade' },
  [PART.SITE]: { tag: 'DETAIL', detail: 'Landscape & site works' },
};

/* -------------------------------------------------------------------------- */
/* Dimensions                                                                  */
/* -------------------------------------------------------------------------- */

export const DIM = {
  /** Ground floor extents. */
  x0: -11,
  x1: 11,
  z0: -6,
  z1: 6,
  /** Upper volume extents (shorter in X, cantilevers 2 m in +Z). */
  ux0: -11,
  ux1: 4,
  uz0: -6,
  uz1: 8,

  wallExt: 0.36,
  wallInt: 0.16,

  l0: 0, // ground floor level
  l0h: 3.5, // ground floor height
  l1: 3.8, // upper floor level (slab top)
  l1h: 3.4,
  roof: 7.2, // roof slab underside
  roofT: 0.36,

  slabT: 0.36,
  plinth: 0.35, // ground slab thickness below datum
  overhang: 0.42, // slab oversail past the facade

  deckZ0: 6.4,
  deckZ1: 14.5,
  deckX0: -4,
  deckX1: 15.5,

  poolX0: 3,
  poolX1: 12,
  poolZ0: 8.2,
  poolZ1: 12.6,
};

/** Building height used to sequence the vertical growth. */
export const MAX_H = DIM.roof + DIM.roofT;

/* -------------------------------------------------------------------------- */
/* Plan — walls with openings                                                  */
/* -------------------------------------------------------------------------- */

const D = DIM;

/**
 * type: 'solid'  masonry with punched openings
 *       'glass'  a mullioned curtain wall for the full storey height
 *       'clad'   masonry that also receives a timber rainscreen
 */
export const WALLS = [
  /* ---- Ground floor, exterior ---- */
  {
    id: 'g-s',
    a: [D.x0, D.z0],
    b: [D.x1, D.z0],
    t: D.wallExt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    openings: [
      { at: 2.2, w: 1.25, kind: 'door' },
      { at: 7.6, w: 2.4, kind: 'window' },
      { at: 12.4, w: 1.8, kind: 'window' },
      { at: 17.2, w: 3.2, kind: 'window' },
    ],
  },
  {
    id: 'g-e',
    a: [D.x1, D.z0],
    b: [D.x1, D.z1],
    t: D.wallExt,
    base: D.l0,
    h: D.l0h,
    type: 'glass',
    role: ROLE.METAL,
    part: PART.GLAZING,
    bays: 5,
  },
  {
    id: 'g-n',
    a: [D.x1, D.z1],
    b: [D.x0, D.z1],
    t: D.wallExt,
    base: D.l0,
    h: D.l0h,
    type: 'glass',
    role: ROLE.METAL,
    part: PART.GLAZING,
    bays: 9,
  },
  {
    id: 'g-w',
    a: [D.x0, D.z1],
    b: [D.x0, D.z0],
    t: D.wallExt,
    base: D.l0,
    h: D.l0h,
    type: 'clad',
    role: ROLE.CONCRETE,
    part: PART.CLADDING,
    openings: [{ at: 6.4, w: 2.6, kind: 'slot' }],
  },

  /* ---- Ground floor, interior ---- */
  {
    id: 'i-1',
    a: [-6.5, D.z0],
    b: [-6.5, 2.2],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 5.1, w: 1.0, kind: 'door' }],
  },
  {
    id: 'i-2',
    a: [-6.5, 2.2],
    b: [D.x0, 2.2],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 2.1, w: 0.9, kind: 'door' }],
  },
  {
    id: 'i-3',
    a: [D.x0, -1.4],
    b: [-6.5, -1.4],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 3.1, w: 0.8, kind: 'door' }],
  },
  {
    id: 'i-4',
    a: [-1.5, D.z0],
    b: [-1.5, -1.0],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 3.4, w: 1.0, kind: 'door' }],
  },
  {
    id: 'i-5',
    a: [-1.5, -1.0],
    b: [4.5, -1.0],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 2.0, w: 1.1, kind: 'door' }],
  },
  {
    id: 'i-6',
    a: [4.5, D.z0],
    b: [4.5, -1.0],
    t: D.wallInt,
    base: D.l0,
    h: D.l0h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    interior: true,
    openings: [{ at: 2.6, w: 1.0, kind: 'door' }],
  },

  /* ---- Upper floor ---- */
  {
    id: 'u-s',
    a: [D.ux0, D.uz0],
    b: [D.ux1, D.uz0],
    t: D.wallExt,
    base: D.l1,
    h: D.l1h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    openings: [
      { at: 3.4, w: 1.6, kind: 'window' },
      { at: 7.4, w: 2.6, kind: 'window' },
      { at: 12.0, w: 1.6, kind: 'window' },
    ],
  },
  {
    id: 'u-e',
    a: [D.ux1, D.uz0],
    b: [D.ux1, D.uz1],
    t: D.wallExt,
    base: D.l1,
    h: D.l1h,
    type: 'solid',
    role: ROLE.CONCRETE,
    part: PART.SHELL,
    openings: [{ at: 9.2, w: 3.4, kind: 'window' }],
  },
  {
    id: 'u-n',
    a: [D.ux1, D.uz1],
    b: [D.ux0, D.uz1],
    t: D.wallExt,
    base: D.l1,
    h: D.l1h,
    type: 'glass',
    role: ROLE.METAL,
    part: PART.GLAZING_UPPER,
    bays: 6,
  },
  {
    id: 'u-w',
    a: [D.ux0, D.uz1],
    b: [D.ux0, D.uz0],
    t: D.wallExt,
    base: D.l1,
    h: D.l1h,
    type: 'clad',
    role: ROLE.CONCRETE,
    part: PART.CLADDING,
    openings: [{ at: 5.0, w: 2.2, kind: 'slot' }],
  },
];

/** Opening profiles, in metres. */
export const OPENING_PROFILE = {
  door: { sill: 0, height: 2.15 },
  window: { sill: 0.9, height: 1.6 },
  slot: { sill: 1.35, height: 0.85 },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function wallVector(wall) {
  const [ax, az] = wall.a;
  const [bx, bz] = wall.b;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  return { ax, az, bx, bz, dx: dx / len, dz: dz / len, len };
}

/** Rotation about Y that maps local +X onto the wall direction. */
export function wallAngle(wall) {
  const { dx, dz } = wallVector(wall);
  return Math.atan2(-dz, dx);
}

export function pointOnWall(wall, distance) {
  const { ax, az, dx, dz } = wallVector(wall);
  return [ax + dx * distance, az + dz * distance];
}

/**
 * Solid runs of a wall once its openings are removed, as [start, end] pairs
 * measured from the wall's A end.
 */
export function solidRuns(wall) {
  const { len } = wallVector(wall);
  const cuts = (wall.openings ?? [])
    .slice()
    .sort((p, q) => p.at - q.at)
    .map((o) => [Math.max(0, o.at - o.w / 2), Math.min(len, o.at + o.w / 2)]);

  const runs = [];
  let cursor = 0;
  for (const [s, e] of cuts) {
    if (s > cursor + 0.01) runs.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < len - 0.01) runs.push([cursor, len]);
  return runs;
}
