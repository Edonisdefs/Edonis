/**
 * Portfolio scaffolding.
 *
 * Each project carries a small massing description that is drawn as a hairline
 * axonometric — the studio's own drawing language, and a deliberate stand-in
 * until real renders are dropped in (`image` on any entry takes over).
 */

export const PROJECTS = [
  {
    id: 'villa-k',
    index: '01',
    title: 'Villa K',
    type: 'Residential · Exterior CGI',
    year: '2025',
    place: 'Eichstätt',
    note: 'Six exterior stills and a dusk hero for a private commission.',
    massing: [
      [0, 0, 0, 8, 3, 5],
      [0, 3, 0, 5, 3, 5],
      [5, 0, 1.2, 4, 0.3, 4],
      [-1.4, 0, 0, 1.4, 0.3, 5],
    ],
  },
  {
    id: 'nordpark',
    index: '02',
    title: 'Nordpark Quarter',
    type: 'Urban · Masterplan',
    year: '2025',
    place: 'Ingolstadt',
    note: 'Aerial massing studies through three design iterations.',
    massing: [
      [0, 0, 0, 4, 5, 4],
      [4.6, 0, 0, 3, 7, 4],
      [0, 0, 4.6, 5, 4, 3],
      [4.6, 0, 4.6, 3, 3, 3],
      [-2, 0, 1, 1.4, 2, 6],
    ],
  },
  {
    id: 'atrium',
    index: '03',
    title: 'Atrium House',
    type: 'Residential · Interior CGI',
    year: '2024',
    place: 'Weißenburg',
    note: 'Interior set for a courtyard house, natural light study.',
    massing: [
      [0, 0, 0, 9, 3, 3],
      [0, 0, 6, 9, 3, 3],
      [0, 0, 3, 2.5, 3, 3],
      [6.5, 0, 3, 2.5, 3, 3],
      [0, 3, 0, 9, 0.3, 9],
    ],
  },
  {
    id: 'lakeside',
    index: '04',
    title: 'Lakeside Pavilion',
    type: 'Public · Competition',
    year: '2024',
    place: 'Altmühltal',
    note: 'Competition visuals produced from a Revit model in nine days.',
    massing: [
      [0, 0, 0, 10, 0.4, 6],
      [1, 0.4, 1, 8, 3.2, 4],
      [0, 3.6, 0, 10, 0.3, 6],
      [1, 0.4, 5.2, 8, 0.1, 0.1],
    ],
  },
  {
    id: 'hofgarten',
    index: '05',
    title: 'Hofgarten Living',
    type: 'Residential · Marketing',
    year: '2024',
    place: 'Ingolstadt',
    note: 'Full marketing set: exteriors, interiors and 3D floor plans.',
    massing: [
      [0, 0, 0, 5, 6, 5],
      [5.5, 0, 0.8, 5, 4.5, 4],
      [11, 0, 0, 4, 6, 5],
      [0, 0, 5.6, 15, 0.3, 2],
    ],
  },
  {
    id: 'werkhof',
    index: '06',
    title: 'Werkhof',
    type: 'Commercial · Animation',
    year: '2023',
    place: 'Neuburg',
    note: 'Forty-second flythrough plus stills for a workshop conversion.',
    massing: [
      [0, 0, 0, 12, 4, 6],
      [0, 4, 0, 12, 1.6, 3],
      [12.6, 0, 1, 3, 3, 4],
      [0, 0, -1.6, 12, 0.3, 1.6],
    ],
  },
];

/* -------------------------------------------------------------------------- */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

function iso(x, y, z) {
  return [(x - z) * COS30, (x + z) * SIN30 - y];
}

/**
 * Projects a massing description into painter-ordered axonometric faces.
 * Returns polygon point strings normalised into a 0..100 box.
 */
export function axonometric(massing) {
  const faces = [];

  for (const [x, y, z, w, h, d] of massing) {
    const p = (dx, dy, dz) => iso(x + dx, y + dy, z + dz);
    // Depth along the view axis; larger is nearer, so faces sort ascending.
    const at = (cx, cy, cz) => x + cx + (y + cy) + (z + cz);

    faces.push({
      key: at(w / 2, h, d / 2),
      tone: 'top',
      pts: [p(0, h, 0), p(w, h, 0), p(w, h, d), p(0, h, d)],
    });
    faces.push({
      key: at(w / 2, h / 2, d),
      tone: 'left',
      pts: [p(0, 0, d), p(w, 0, d), p(w, h, d), p(0, h, d)],
    });
    faces.push({
      key: at(w, h / 2, d / 2),
      tone: 'right',
      pts: [p(w, 0, 0), p(w, 0, d), p(w, h, d), p(w, h, 0)],
    });
  }

  faces.sort((a, b) => a.key - b.key);

  const all = faces.flatMap((f) => f.pts);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(96 / (maxX - minX || 1), 96 / (maxY - minY || 1));
  const offX = (100 - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (100 - (maxY - minY) * scale) / 2 - minY * scale;

  return faces.map((f) => ({
    tone: f.tone,
    points: f.pts
      .map(([px, py]) => `${(px * scale + offX).toFixed(2)},${(py * scale + offY).toFixed(2)}`)
      .join(' '),
  }));
}

export const SERVICES = [
  {
    index: '01',
    title: 'Exterior visualization',
    body: 'Photoreal stills of buildings in their real site, light and season. Delivered at print resolution for boards, permits and sales.',
    tags: ['Stills', 'Dusk & day', 'Aerials'],
  },
  {
    index: '02',
    title: 'Interior CGI',
    body: 'Rooms shown the way they will actually be lived in — materials, furniture and daylight resolved before anything is built.',
    tags: ['Room sets', 'Daylight study', 'Material boards'],
  },
  {
    index: '03',
    title: 'Animation & flythrough',
    body: 'Camera moves that explain a building: approach, entry, sequence. Cut for social, presentations or a sales portal.',
    tags: ['Flythrough', 'Loops', '4K'],
  },
  {
    index: '04',
    title: '3D floor plans',
    body: 'Plans that a buyer reads instantly. Furnished, shaded and consistent with the rest of the set.',
    tags: ['Furnished plans', 'Site plans', 'Sections'],
  },
  {
    index: '05',
    title: 'Virtual staging',
    body: 'Empty or dated rooms restaged from photography. The fastest route from a listing to something worth clicking.',
    tags: ['Photo-based', 'Decluttering', 'Retouch'],
  },
];

export const WORKFLOW = [
  {
    index: '01',
    title: 'Drawings',
    body: 'Plans, sections and elevations come in as DWG, PDF or a model. Everything is checked against the brief before a single wall is built.',
  },
  {
    index: '02',
    title: 'Modelling',
    body: 'The building is rebuilt in 3D at construction accuracy — openings, reveals, slab edges, the details that give a render its weight.',
  },
  {
    index: '03',
    title: 'Clay review',
    body: 'An untextured model goes out for camera and massing approval. Cheap to change, and it keeps the surprises out of the final image.',
  },
  {
    index: '04',
    title: 'Materials',
    body: 'Concrete, timber, stone, glass and metal are built and calibrated against real samples rather than library presets.',
  },
  {
    index: '05',
    title: 'Lighting',
    body: 'Sun position, date and time are set from the real site. Light does most of the work in a convincing visualization.',
  },
  {
    index: '06',
    title: 'Delivery',
    body: 'Colour-graded stills at print resolution, plus web crops. Two revision rounds are included in every package.',
  },
];
