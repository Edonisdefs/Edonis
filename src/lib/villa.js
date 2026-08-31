/**
 * Turns the plan in `buildingModel.js` into the box list the geometry builder
 * consumes, plus the massing volumes the wireframe is drawn from.
 *
 * Everything is a box. That keeps the merged buffers tiny, the draw calls at a
 * handful, and every vertex trivially attributable to a logical part.
 */

import {
  DIM as D,
  MAX_H,
  OPENING_PROFILE,
  PART,
  ROLE,
  WALLS,
  pointOnWall,
  solidRuns,
  wallAngle,
  wallVector,
} from './buildingModel.js';

const ROOF_Y = D.l1 + D.l1h;
const OH = D.overhang;

/* -------------------------------------------------------------------------- */

/**
 * Sequencing weight for the vertical growth: lower and further west first, so
 * the extrusion reads as a wave rolling east across the plan.
 */
function delayFor(x, baseY) {
  const height = Math.min(1, Math.max(0, baseY / MAX_H));
  const sweep = Math.min(1, Math.max(0, (x - D.x0) / (D.deckX1 - D.x0)));
  return Math.min(1, height * 0.58 + sweep * 0.42);
}

function part(size, pos, opts = {}) {
  const [, h] = size;
  const baseY = pos[1] - h / 2;
  return {
    size,
    pos,
    rotY: opts.rotY ?? 0,
    rot: opts.rot,
    role: opts.role ?? ROLE.CONCRETE,
    part: opts.part ?? PART.SHELL,
    stage: opts.stage ?? 0,
    glass: opts.glass ?? false,
    delay: opts.delay ?? delayFor(pos[0], baseY),
  };
}

/** Box spanning a world-space AABB. */
function span(x0, x1, y0, y1, z0, z1, opts) {
  return part([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], opts);
}

/* -------------------------------------------------------------------------- */
/* Walls                                                                       */
/* -------------------------------------------------------------------------- */

function wallSegment(wall, from, to, y0, y1, opts = {}) {
  const { ax, az, dx, dz } = wallVector(wall);
  const mid = (from + to) / 2;
  const cx = ax + dx * mid;
  const cz = az + dz * mid;
  const depth = opts.depth ?? wall.t;
  const offset = opts.offset ?? 0;
  // Offset along the wall normal (local -Z of the rotated box).
  const nx = -dz;
  const nz = dx;
  return part([to - from, y1 - y0, depth], [cx + nx * offset, (y0 + y1) / 2, cz + nz * offset], {
    rotY: wallAngle(wall),
    role: opts.role ?? wall.role,
    part: opts.part ?? wall.part,
    glass: opts.glass ?? false,
  });
}

function solidWallParts(wall, out) {
  const top = wall.base + wall.h;

  for (const [s, e] of solidRuns(wall)) {
    if (e - s < 0.02) continue;
    out.push(wallSegment(wall, s, e, wall.base, top));
  }

  for (const o of wall.openings ?? []) {
    const profile = OPENING_PROFILE[o.kind];
    const s = o.at - o.w / 2;
    const e = o.at + o.w / 2;
    const sillTop = wall.base + profile.sill;
    const headY = sillTop + profile.height;

    if (profile.sill > 0.02) out.push(wallSegment(wall, s, e, wall.base, sillTop));
    if (top - headY > 0.02) out.push(wallSegment(wall, s, e, headY, top));

    if (wall.interior) continue;

    if (o.kind === 'door') {
      // A dark metal entrance leaf, slightly recessed.
      out.push(
        wallSegment(wall, s + 0.05, e - 0.05, wall.base + 0.02, headY - 0.04, {
          depth: 0.08,
          offset: wall.t * 0.18,
          role: ROLE.METAL,
          part: PART.SHELL,
        }),
      );
    } else {
      out.push(
        wallSegment(wall, s + 0.06, e - 0.06, sillTop + 0.05, headY - 0.05, {
          depth: 0.05,
          role: ROLE.METAL,
          part: PART.WINDOW,
          glass: true,
        }),
      );
      // Slim reveal frame reads as a real window at grazing angles.
      out.push(
        wallSegment(wall, s + 0.02, e - 0.02, sillTop, sillTop + 0.06, {
          depth: wall.t * 0.55,
          offset: wall.t * 0.2,
          role: ROLE.METAL,
          part: PART.WINDOW,
        }),
      );
    }
  }
}

function curtainWallParts(wall, out) {
  const { len } = wallVector(wall);
  const bays = wall.bays ?? Math.max(2, Math.round(len / 2.4));
  const bayW = len / bays;
  const top = wall.base + wall.h;

  out.push(
    wallSegment(wall, 0, len, wall.base, wall.base + 0.1, { role: ROLE.METAL, part: PART.GLAZING }),
  );
  out.push(
    wallSegment(wall, 0, len, top - 0.2, top, { role: ROLE.METAL, part: PART.GLAZING }),
  );

  for (let i = 0; i <= bays; i += 1) {
    const at = Math.min(len - 0.05, Math.max(0.05, i * bayW));
    out.push(
      wallSegment(wall, at - 0.05, at + 0.05, wall.base + 0.1, top - 0.2, {
        depth: wall.t * 0.5,
        role: ROLE.METAL,
        part: PART.GLAZING,
      }),
    );
  }

  for (let i = 0; i < bays; i += 1) {
    out.push(
      wallSegment(wall, i * bayW + 0.06, (i + 1) * bayW - 0.06, wall.base + 0.1, top - 0.2, {
        depth: 0.045,
        role: ROLE.METAL,
        part: PART.GLAZING,
        glass: true,
      }),
    );
  }
}

/** Vertical timber rainscreen on the outer face of a clad wall. */
function claddingParts(wall, out, slatCount) {
  const { len } = wallVector(wall);
  const count = Math.max(6, Math.min(slatCount, Math.floor(len / 0.34)));
  const pitch = len / count;
  const width = Math.min(0.3, pitch * 0.66);
  const top = wall.base + wall.h;

  for (let i = 0; i < count; i += 1) {
    const at = (i + 0.5) * pitch;
    out.push(
      wallSegment(wall, at - width / 2, at + width / 2, wall.base + 0.04, top - 0.04, {
        depth: 0.07,
        offset: -(wall.t / 2 + 0.035),
        role: ROLE.WOOD,
        part: PART.CLADDING,
      }),
    );
  }
}

/**
 * Slim steel balustrade: two rails, a handrail and posts. Reads correctly in
 * silhouette, and needs no transparency to look like a railing.
 */
function railing(out, baseY, runs) {
  const H = 1.06;
  const opts = { role: ROLE.METAL, part: PART.RAILING };
  const post = 0.045;

  for (const [x0, x1, z0, z1] of runs) {
    const alongX = x1 - x0 > z1 - z0;
    const length = alongX ? x1 - x0 : z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;

    for (const [y, thickness] of [
      [baseY + 0.09, 0.035],
      [baseY + 0.52, 0.03],
      [baseY + H, 0.055],
    ]) {
      out.push(
        part(
          alongX ? [length, thickness, thickness * 1.4] : [thickness * 1.4, thickness, length],
          [cx, y, cz],
          opts,
        ),
      );
    }

    const count = Math.max(2, Math.round(length / 1.5));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      out.push(
        part(
          [post, H, post],
          [alongX ? x0 + (x1 - x0) * t : cx, baseY + H / 2, alongX ? cz : z0 + (z1 - z0) * t],
          opts,
        ),
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Landscape                                                                   */
/* -------------------------------------------------------------------------- */

/* Kept out of the corridor between the hero camera and the building. */
const TREE_SPOTS = [
  [-22, 12, 0.98],
  [-18, -14, 0.86],
  [15, -14, 0.8],
  [29, -8, 0.92],
  [-11, 25, 0.78],
  [-30, 1, 0.72],
  [2, 27, 0.88],
  [-27, 20, 0.84],
  [23, -21, 1.0],
];

/* Read as clipped hedges: long, low, aligned to the site geometry. */
const SHRUB_SPOTS = [
  [-14.2, 8.0, 8.0],
  [-14.2, -6.0, 7.0],
  [-4, 18.6, 9.0],
  [7, 18.6, 9.0],
  [17.6, 2.0, 10.0],
  [1, -11.6, 12.0],
  [-13, -11.6, 8.0],
  [-22, 14, 6.0],
  [22, 15, 7.0],
  [-24, -3, 6.0],
  [12, -16, 6.0],
  [-6, 26, 8.0],
  [26, -13, 5.0],
  [-30, 9, 5.0],
];

function landscapeParts(out, settings) {
  const opts = { stage: 1, part: PART.SITE, role: ROLE.PLANT };

  for (const [x, z, scale] of TREE_SPOTS.slice(0, settings.trees)) {
    const trunkH = 2.4 * scale;
    const delay = 0.15 + (Math.abs(x) + Math.abs(z)) / 90;
    out.push(
      part([0.26 * scale, trunkH, 0.26 * scale], [x, trunkH / 2, z], {
        ...opts,
        role: ROLE.WOOD,
        delay,
      }),
    );
    // A cluster of tilted blocks reads as a canopy; axis-aligned boxes do not.
    const canopy = [
      [2.8, 1.6, 2.5, 0.75, 0.0, 0.0],
      [2.3, 1.5, 2.1, 1.55, 0.3, -0.24],
      [2.0, 1.4, 1.9, 1.75, -0.32, 0.28],
      [1.4, 1.2, 1.3, 2.5, 0.06, 0.1],
    ];
    canopy.forEach(([cw, ch, cd, cy, ox, oz], i) => {
      const seed = (x * 3.1 + z * 1.7 + i * 2.3) % 6.283;
      out.push(
        part(
          [cw * scale, ch * scale, cd * scale],
          [x + ox * scale, trunkH + cy * scale, z + oz * scale],
          {
            ...opts,
            rot: [Math.sin(seed) * 0.17, seed, Math.cos(seed * 1.7) * 0.15],
            delay: delay + 0.08,
          },
        ),
      );
    });
  }

  for (const [x, z, len] of SHRUB_SPOTS.slice(0, settings.shrubs)) {
    const alongX = Math.abs(z) > 9.5;
    out.push(
      part(alongX ? [len, 0.88, 1.15] : [1.15, 0.88, len], [x, 0.44, z], {
        ...opts,
        delay: 0.3 + Math.abs(x) / 70,
      }),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

export function buildVilla(settings) {
  const parts = [];

  for (const wall of WALLS) {
    if (wall.type === 'glass') curtainWallParts(wall, parts);
    else solidWallParts(wall, parts);
    if (wall.type === 'clad') claddingParts(wall, parts, settings.slatCount);
  }

  /* ---- Horizontal planes ---- */

  // Plinth: oversailed so the volume reads as floating on a shadow gap.
  parts.push(
    span(D.x0 - OH, D.x1 + OH, -D.plinth, 0, D.z0 - OH, D.z1 + OH, {
      role: ROLE.CONCRETE,
      part: PART.SHELL,
    }),
  );

  // Upper slab over the west volume, cantilevering north.
  parts.push(
    span(D.ux0 - OH, D.ux1 + OH, D.l0h, D.l1, D.uz0 - OH, D.uz1 + OH, {
      role: ROLE.CONCRETE,
      part: PART.ROOF,
    }),
  );
  // Roof deck slab over the east wing.
  parts.push(
    span(D.ux1 + OH, D.x1 + OH, D.l0h, D.l1, D.z0 - OH, D.z1 + OH, {
      role: ROLE.CONCRETE,
      part: PART.ROOF,
    }),
  );
  // Main roof.
  parts.push(
    span(
      D.ux0 - OH - 0.14,
      D.ux1 + OH + 0.14,
      ROOF_Y,
      ROOF_Y + D.roofT,
      D.uz0 - OH - 0.14,
      D.uz1 + OH + 0.14,
      { role: ROLE.CONCRETE, part: PART.ROOF },
    ),
  );

  // Timber soffit under the northern cantilever — catches the low sun.
  parts.push(
    span(D.ux0, D.ux1, D.l0h - 0.06, D.l0h, D.z1 + OH, D.uz1 + OH, {
      role: ROLE.WOOD,
      part: PART.ROOF,
    }),
  );

  /* ---- Roof-deck balustrade ---- */
  const rdX0 = D.ux1 + OH;
  const rdX1 = D.x1 + OH;
  const rdZ0 = D.z0 - OH;
  const rdZ1 = D.z1 + OH;
  railing(parts, D.l1, [
    [rdX1 - 0.06, rdX1, rdZ0, rdZ1],
    [rdX0, rdX1, rdZ1 - 0.06, rdZ1],
    [rdX0, rdX1, rdZ0, rdZ0 + 0.06],
  ]);

  /* ---- Terrace, pool, steps ---- */

  const pc = 0.34; // coping width
  const px0 = D.poolX0 - pc;
  const px1 = D.poolX1 + pc;
  const pz0 = D.poolZ0 - pc;
  const pz1 = D.poolZ1 + pc;
  const deck = { role: ROLE.WOOD, part: PART.DECK };

  // Four boards runs around the pool opening — never over it.
  parts.push(span(D.deckX0, D.deckX1, -0.3, -0.02, D.deckZ0, pz0, deck));
  parts.push(span(D.deckX0, D.deckX1, -0.3, -0.02, pz1, D.deckZ1, deck));
  parts.push(span(D.deckX0, px0, -0.3, -0.02, pz0, pz1, deck));
  parts.push(span(px1, D.deckX1, -0.3, -0.02, pz0, pz1, deck));

  const poolOpts = { role: ROLE.STONE, part: PART.DECK };
  parts.push(span(D.poolX0 - pc, D.poolX1 + pc, -0.34, -0.06, D.poolZ0 - pc, D.poolZ0, poolOpts));
  parts.push(span(D.poolX0 - pc, D.poolX1 + pc, -0.34, -0.06, D.poolZ1, D.poolZ1 + pc, poolOpts));
  parts.push(span(D.poolX0 - pc, D.poolX0, -0.34, -0.06, D.poolZ0, D.poolZ1, poolOpts));
  parts.push(span(D.poolX1, D.poolX1 + pc, -0.34, -0.06, D.poolZ0, D.poolZ1, poolOpts));
  // Pool basin so the water is not floating on nothing.
  parts.push(
    span(D.poolX0, D.poolX1, -1.35, -1.15, D.poolZ0, D.poolZ1, {
      role: ROLE.STONE,
      part: PART.DECK,
    }),
  );

  for (let i = 0; i < 2; i += 1) {
    parts.push(
      span(
        D.deckX0 + 2,
        D.deckX0 + 9,
        -0.3 - (i + 1) * 0.17,
        -0.3 - i * 0.17,
        D.deckZ1 + i * 0.42,
        D.deckZ1 + (i + 1) * 0.42 + 0.6,
        { role: ROLE.STONE, part: PART.DECK },
      ),
    );
  }

  // Low site wall to the west anchors the composition.
  parts.push(
    span(-17.4, -17.0, -0.35, 0.62, -9, 11, { role: ROLE.CONCRETE, part: PART.SITE }),
  );
  // Approach path.
  parts.push(
    span(-17.0, D.x0 - OH, -0.34, -0.28, -5.2, -2.2, { role: ROLE.STONE, part: PART.SITE }),
  );

  landscapeParts(parts, settings);

  return parts;
}

/* -------------------------------------------------------------------------- */
/* Massing — what the wireframe phase draws                                    */
/* -------------------------------------------------------------------------- */

export function buildMassing() {
  const boxes = [];
  const push = (x0, x1, y0, y1, z0, z1) =>
    boxes.push({
      size: [x1 - x0, y1 - y0, z1 - z0],
      pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      delay: delayFor((x0 + x1) / 2, y0),
      stage: 0,
    });

  push(D.x0, D.x1, 0, D.l0h, D.z0, D.z1); // ground volume
  push(D.ux0, D.ux1, D.l1, ROOF_Y, D.uz0, D.uz1); // upper volume
  push(D.x0 - OH, D.x1 + OH, -D.plinth, 0, D.z0 - OH, D.z1 + OH); // plinth
  push(D.ux0 - OH, D.ux1 + OH, D.l0h, D.l1, D.uz0 - OH, D.uz1 + OH); // upper slab
  push(D.ux1 + OH, D.x1 + OH, D.l0h, D.l1, D.z0 - OH, D.z1 + OH); // roof deck slab
  push(
    D.ux0 - OH - 0.14,
    D.ux1 + OH + 0.14,
    ROOF_Y,
    ROOF_Y + D.roofT,
    D.uz0 - OH - 0.14,
    D.uz1 + OH + 0.14,
  ); // roof
  push(D.ux1 + OH, D.x1 + OH, D.l1, D.l1 + 1.05, D.z0 - OH, D.z1 + OH); // balustrade
  push(D.deckX0, D.deckX1, -0.3, -0.02, D.deckZ0, D.deckZ1); // terrace
  push(D.poolX0, D.poolX1, -0.34, -0.06, D.poolZ0, D.poolZ1); // pool

  return boxes;
}

/**
 * Extra wireframe linework: the curtain-wall grid and storey datum lines. These
 * are what make the wireframe read as an architectural model rather than a
 * box collection.
 */
export function buildDetailLines() {
  const segments = [];
  const add = (a, b, delay) => segments.push({ a, b, delay });

  for (const wall of WALLS) {
    if (wall.type !== 'glass') continue;
    const { len } = wallVector(wall);
    const bays = wall.bays ?? 4;
    const top = wall.base + wall.h;
    for (let i = 0; i <= bays; i += 1) {
      const [x, z] = pointOnWall(wall, (i * len) / bays);
      add([x, wall.base, z], [x, top, z], delayFor(x, wall.base));
    }
  }

  // Storey datums traced around the ground volume.
  for (const y of [D.l0h, ROOF_Y]) {
    const inUpper = y > D.l0h;
    const [x0, x1, z0, z1] = inUpper ? [D.ux0, D.ux1, D.uz0, D.uz1] : [D.x0, D.x1, D.z0, D.z1];
    const corners = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    for (let i = 0; i < 4; i += 1) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      add([ax, y, az], [bx, y, bz], delayFor(ax, y));
    }
  }

  return segments;
}
