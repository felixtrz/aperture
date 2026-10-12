import { createSystem, mesh, material } from "@aperture-engine/app/systems";
const PI = Math.PI;
let seed = 12831;
function rand() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}
const batches = new Map();
const palette = {
  stucco: [0.82, 0.73, 0.58],
  stone: [0.59, 0.54, 0.43],
  mortar: [0.4, 0.38, 0.32],
  trim: [0.72, 0.66, 0.53],
  roof: [0.58, 0.205, 0.075],
  roof2: [0.7, 0.29, 0.1],
  roof3: [0.48, 0.16, 0.055],
  timber: [0.22, 0.15, 0.085],
  frame: [0.085, 0.1, 0.11],
  glass: [0.1, 0.17, 0.21],
  glass2: [0.2, 0.29, 0.34],
  door: [0.115, 0.145, 0.16],
  earth: [0.29, 0.24, 0.14],
  grass: [0.24, 0.32, 0.095],
  grass2: [0.33, 0.4, 0.12],
  leaf: [0.19, 0.28, 0.065],
  leaf2: [0.3, 0.38, 0.115],
  leaf3: [0.37, 0.42, 0.18],
  bark: [0.28, 0.2, 0.115],
  asphalt: [0.115, 0.13, 0.145],
  aggregate: [0.19, 0.19, 0.18],
  curb: [0.57, 0.56, 0.49],
  white: [0.81, 0.79, 0.69],
  blue: [0.018, 0.15, 0.37],
  blue2: [0.026, 0.21, 0.48],
  rubber: [0.025, 0.028, 0.032],
  chrome: [0.47, 0.53, 0.55],
  light: [0.8, 0.84, 0.8],
  red: [0.55, 0.028, 0.017],
  terra: [0.46, 0.22, 0.1],
  lavender: [0.36, 0.27, 0.43],
  yellow: [0.76, 0.59, 0.17],
};
const props = {
  glass: [0.18, 0.25],
  glass2: [0.23, 0.3],
  blue: [0.25, 0.35],
  blue2: [0.24, 0.3],
  chrome: [0.29, 0.72],
  light: [0.24, 0.15],
  rubber: [0.95, 0],
  asphalt: [0.98, 0],
};
function batch(name) {
  if (!batches.has(name)) batches.set(name, []);
  return batches.get(name);
}
function tri(name, a, b, c) {
  const ab = b.map((v, i) => v - a[i]),
    ac = c.map((v, i) => v - a[i]);
  const cr = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  if (Math.hypot(...cr) < 1e-8) return;
  batch(name).push(a, b, c);
}
function quad(m, a, b, c, d) {
  tri(m, a, b, c);
  tri(m, a, c, d);
}
let xf = (p) => p;
function box(m, c, s, angle = 0) {
  let v = [];
  for (let i = 0; i < 8; i++) {
    let x = ((i & 1 ? 1 : -1) * s[0]) / 2,
      y = ((i & 2 ? 1 : -1) * s[1]) / 2,
      z = ((i & 4 ? 1 : -1) * s[2]) / 2;
    v.push(
      xf([
        c[0] + x * Math.cos(angle) + z * Math.sin(angle),
        c[1] + y,
        c[2] - x * Math.sin(angle) + z * Math.cos(angle),
      ]),
    );
  }
  for (const f of [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
  ])
    quad(m, ...f.map((i) => v[i]));
}
function ellipsoid(m, c, s, seg = 10, rings = 6) {
  let pts = [];
  for (let j = 0; j <= rings; j++) {
    const a = (PI * j) / rings;
    for (let k = 0; k < seg; k++) {
      const t = (k * PI * 2) / seg;
      pts.push(
        xf([
          c[0] + s[0] * Math.sin(a) * Math.cos(t),
          c[1] + s[1] * Math.cos(a),
          c[2] + s[2] * Math.sin(a) * Math.sin(t),
        ]),
      );
    }
  }
  for (let j = 0; j < rings; j++)
    for (let k = 0; k < seg; k++) {
      const l = (k + 1) % seg,
        a = pts[j * seg + k],
        b = pts[j * seg + l],
        c2 = pts[(j + 1) * seg + l],
        d = pts[(j + 1) * seg + k];
      quad(m, a, b, c2, d);
    }
}
function tube(m, a, b, r1, r2 = r1, seg = 10) {
  let axis = b.map((x, i) => x - a[i]),
    len = Math.hypot(...axis);
  axis = axis.map((x) => x / len);
  let u = Math.abs(axis[1]) < 0.95 ? [-axis[2], 0, axis[0]] : [1, 0, 0];
  let ul = Math.hypot(...u);
  u = u.map((x) => x / ul);
  let v = [
    axis[1] * u[2] - axis[2] * u[1],
    axis[2] * u[0] - axis[0] * u[2],
    axis[0] * u[1] - axis[1] * u[0],
  ];
  let points = [];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < seg; i++) {
      const t = (i * 2 * PI) / seg,
        r = j ? r2 : r1,
        c = j ? b : a;
      points.push(
        xf(c.map((x, k) => x + r * (u[k] * Math.cos(t) + v[k] * Math.sin(t)))),
      );
    }
  for (let i = 0; i < seg; i++) {
    const k = (i + 1) % seg;
    quad(m, points[i], points[k], points[seg + k], points[seg + i]);
    tri(m, xf(a), points[k], points[i]);
    tri(m, xf(b), points[seg + i], points[seg + k]);
  }
}
function polygon(m, pts) {
  for (let i = 1; i < pts.length - 1; i++)
    tri(m, xf(pts[0]), xf(pts[i]), xf(pts[i + 1]));
}
function ground() {
  box("earth", [0, -0.25, 0], [36, 0.4, 36]);
  box("grass", [-1, 0.005, -1], [29, 0.1, 28]);
  // Curving road, sidewalk and separate block curbs.
  const center = [-2, -4],
    R = 14,
    start = -1.45,
    end = 1.8,
    steps = 135;
  const road = (t, r, y) => [
    center[0] + r * Math.sin(t),
    y,
    center[1] + r * Math.cos(t),
  ];
  for (let i = 0; i < steps; i++) {
    let a = start + ((end - start) * i) / steps,
      b = start + ((end - start) * (i + 1)) / steps;
    quad(
      "asphalt",
      road(a, R - 1.75, 0.065),
      road(a, R + 1.75, 0.065),
      road(b, R + 1.75, 0.065),
      road(b, R - 1.75, 0.065),
    );
    quad(
      "curb",
      road(a, R - 3.05, 0.14),
      road(a, R - 1.9, 0.14),
      road(b, R - 1.9, 0.14),
      road(b, R - 3.05, 0.14),
    );
    if (i % 3 === 0) {
      const t = (a + b) / 2;
      box("trim", road(t, R - 1.83, 0.17), [0.65, 0.25, 0.24], t);
    }
    if (i % 8 < 4)
      quad(
        "white",
        road(a, R - 0.055, 0.076),
        road(a, R + 0.055, 0.076),
        road(b, R + 0.055, 0.076),
        road(b, R - 0.055, 0.076),
      );
  }
  // Asphalt aggregate as tiny geometric speckles.
  for (let i = 0; i < 1700; i++) {
    let t = start + rand() * (end - start),
      r = R - 1.65 + rand() * 3.3,
      p = road(t, r, 0.075);
    const w = 0.008 + rand() * 0.028,
      d = 0.008 + rand() * 0.028;
    quad(
      i % 3 ? "asphalt" : "aggregate",
      [p[0] - w, p[1], p[2] - d],
      [p[0] - w, p[1], p[2] + d],
      [p[0] + w, p[1], p[2] + d],
      [p[0] + w, p[1], p[2] - d],
    );
  }
  // Garden turf detail.
  for (let i = 0; i < 900; i++) {
    let x = -7 + rand() * 14,
      z = -4 + rand() * 11;
    if (Math.abs(x) < 4.2 && z < 3.6) continue;
    if (Math.abs(x) < 0.8 && z > 3.3) continue;
    const h = 0.07 + rand() * 0.14;
    tri(
      i % 2 ? "grass2" : "grass",
      [x, 0.09, z],
      [x + 0.025, 0.09 + h, z],
      [x + 0.05, 0.09, z],
    );
    tri(
      i % 2 ? "grass2" : "grass",
      [x + 0.05, 0.09, z],
      [x + 0.025, 0.09 + h, z],
      [x, 0.09, z],
    );
  }
}
function facade(axis, pos, width, height, openings) {
  let xs = [-width / 2, width / 2],
    ys = [0.3, height];
  for (let o of openings) {
    xs.push(o.x - o.w / 2, o.x + o.w / 2);
    ys.push(o.y - o.h / 2, o.y + o.h / 2);
  }
  xs = [...new Set(xs)].sort((a, b) => a - b);
  ys = [...new Set(ys)].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      let x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (
        openings.some(
          (o) => Math.abs(x - o.x) < o.w / 2 && Math.abs(y - o.y) < o.h / 2,
        )
      )
        continue;
      const w = xs[i + 1] - xs[i],
        h = ys[j + 1] - ys[j];
      if (axis === "z") box("stucco", [x, y, pos], [w, h, 0.3]);
      else box("stucco", [pos, y, x], [0.3, h, w]);
    }
}
function windowAt(c, w, h, side = 0) {
  const old = xf;
  xf = (p) =>
    old([
      c[0] + p[0] * Math.cos(side) + p[2] * Math.sin(side),
      c[1] + p[1],
      c[2] - p[0] * Math.sin(side) + p[2] * Math.cos(side),
    ]);
  box("frame", [0, 0, -0.105], [w, h, 0.1]);
  box("glass", [0, 0, -0.043], [w - 0.14, h - 0.14, 0.025]);
  for (let x of [-w / 2 + 0.035, w / 2 - 0.035, 0])
    box("frame", [x, 0, 0.008], [0.065, h, 0.055]);
  for (let y of [-h / 2 + 0.035, h / 2 - 0.035, 0])
    box("frame", [0, y, 0.008], [w, 0.065, 0.055]);
  box("trim", [0, -h / 2 - 0.065, 0.045], [w + 0.2, 0.13, 0.3]);
  box("stone", [0, h / 2 + 0.052, 0.01], [w + 0.07, 0.07, 0.1]);
  // Interior curtains and a fine pale reflection strip.
  for (let x of [-w * 0.31, w * 0.31])
    box("trim", [x, 0, -0.025], [w * 0.18, h - 0.2, 0.011]);
  box("glass2", [-w * 0.17, 0, -0.02], [0.025, h - 0.17, 0.013]);
  xf = old;
}
function house() {
  box("stone", [0, 0.23, 0], [8.1, 0.45, 6.6]);
  let front = [
    { x: -2.25, y: 4.8, w: 1.45, h: 1.45 },
    { x: 2.25, y: 4.8, w: 1.45, h: 1.45 },
    { x: -2.7, y: 1.65, w: 1.2, h: 1.5 },
    { x: 2.2, y: 1.65, w: 1.1, h: 1.5 },
    { x: 0, y: 1.5, w: 1.1, h: 2.4 },
  ];
  facade("z", 3.2, 8, 6.2, front);
  for (const o of front) {
    if (o.x !== 0) windowAt([o.x, o.y, 3.24], o.w, o.h);
  }
  let side = [
    { x: -1.8, y: 4.8, w: 0.9, h: 1.4 },
    { x: 1.55, y: 4.8, w: 0.95, h: 1.4 },
    { x: -1.8, y: 1.65, w: 0.85, h: 1.5 },
    { x: 1.55, y: 1.65, w: 0.95, h: 1.5 },
  ];
  facade("x", 4, 6.4, 6.2, side);
  facade("x", -4, 6.4, 6.2, side);
  for (const o of side) {
    windowAt([4.04, o.y, o.x], o.w, o.h, PI / 2);
    windowAt([-4.04, o.y, o.x], o.w, o.h, -PI / 2);
  }
  facade("z", -3.2, 8, 6.2, [
    { x: -2, y: 4.8, w: 1.3, h: 1.4 },
    { x: 2, y: 4.8, w: 1.3, h: 1.4 },
  ]);
  windowAt([-2, 4.8, -3.25], 1.3, 1.4, PI);
  windowAt([2, 4.8, -3.25], 1.3, 1.4, PI);
  for (let x of [-4, 4]) {
    polygon("stucco", [
      [x, 6.2, -3.2],
      [x, 6.2, 3.2],
      [x, 8.15, 0],
    ]);
    polygon("stucco", [
      [x, 6.2, -3.2],
      [x, 8.15, 0],
      [x, 6.2, 3.2],
    ]);
  }
  box("door", [0, 1.5, 3.12], [1.1, 2.4, 0.15]);
  for (let x of [-0.255, 0.255])
    for (let y of [0.87, 1.76]) {
      box("frame", [x, y, 3.21], [0.43, 0.66, 0.032]);
      box("door", [x, y, 3.233], [0.37, 0.58, 0.02]);
    }
  tube("chrome", [0.4, 1.36, 3.26], [0.4, 1.6, 3.26], 0.026);
  box("chrome", [0.4, 1.46, 3.3], [0.04, 0.035, 0.15]);
  // Main gable roof, bargeboards and individually curved overlapping tiles.
  roof(0, 8.2, 4.55, 3.72, 2.18);
  // Chimney with cap and louvred flue crown.
  box("stucco", [2.55, 8.45, -0.72], [0.65, 2.0, 0.66]);
  box("trim", [2.55, 9.1, -0.72], [0.78, 0.1, 0.79]);
  box("frame", [2.55, 9.24, -0.72], [0.51, 0.29, 0.49]);
  for (let x of [-0.27, 0.27])
    for (let z of [-0.28, 0.28])
      box("stucco", [2.55 + x, 9.28, -0.72 + z], [0.12, 0.4, 0.12]);
  box("trim", [2.55, 9.52, -0.72], [0.92, 0.12, 0.9]);
  box("roof2", [2.55, 9.61, -0.72], [0.95, 0.08, 0.92]);
  // Porch limestone platform, two posts, lintel, tiled lean-to canopy.
  box("stone", [0.15, 0.25, 4.15], [5.15, 0.45, 2.1]);
  for (let i = 0; i < 3; i++)
    box("trim", [0.15, 0.08 + i * 0.07, 5.42 - i * 0.22], [3.0, 0.14, 0.4]);
  for (let x of [-2.05, 2.35]) {
    box("stucco", [x, 1.6, 4.9], [0.32, 2.8, 0.32]);
    box("trim", [x, 0.3, 4.9], [0.46, 0.17, 0.46]);
    box("trim", [x, 2.96, 4.9], [0.48, 0.2, 0.46]);
  }
  box("timber", [0.15, 3.18, 4.87], [5.0, 0.27, 0.25]);
  box("trim", [0.15, 3.03, 4.9], [4.9, 0.09, 0.23]);
  leanRoof(-2.45, 2.75, 3.13, 5.13, 3.65, 3.2);
  // Gutters and downpipes.
  for (let z of [-3.7, 3.7]) {
    tube("frame", [-4.57, 6.08, z], [4.57, 6.08, z], 0.052);
    for (let x of [-4.08, 4.08]) {
      tube("frame", [x, 6.09, z], [x, 5.8, z * 0.86], 0.041);
      tube("frame", [x, 5.8, z * 0.86], [x, 0.35, z * 0.86], 0.041);
    }
  }
  // Shallow facade relief gives the plaster warm irregular highlights.
  for (let i = 0; i < 420; i++) {
    let x = -3.92 + rand() * 7.84,
      y = 0.48 + rand() * 5.58;
    if (
      front.some(
        (o) =>
          Math.abs(x - o.x) < o.w / 2 + 0.06 &&
          Math.abs(y - o.y) < o.h / 2 + 0.06,
      )
    )
      continue;
    box(
      i % 3 ? "stucco" : "trim",
      [x, y, 3.354],
      [0.022 + rand() * 0.035, 0.017 + rand() * 0.028, 0.006],
    );
  }
  // Porch lantern.
  tube("frame", [-0.94, 2.33, 3.4], [-0.94, 2.68, 3.4], 0.018);
  box("light", [-0.94, 2.39, 3.42], [0.15, 0.25, 0.14]);
  for (let x of [-1.03, -0.85])
    box("frame", [x, 2.39, 3.42], [0.025, 0.3, 0.18]);
  box("frame", [-0.94, 2.57, 3.42], [0.25, 0.065, 0.24]);
}
function tile(m, x, y, z, direction, length = 0.5, width = 0.235) {
  const s = direction[2] > 0 ? 1 : -1,
    normal = [0, Math.abs(direction[2]), Math.abs(direction[1]) * s];
  for (let i = 0; i < 6; i++) {
    const a = (PI * i) / 6,
      b = (PI * (i + 1)) / 6;
    const point = (theta, t) => [
      x + width * 0.5 * Math.cos(theta),
      y + direction[1] * t + normal[1] * 0.075 * Math.sin(theta),
      z + direction[2] * t + normal[2] * 0.075 * Math.sin(theta),
    ];
    let q = [point(a, 0), point(a, length), point(b, length), point(b, 0)];
    if (s > 0) q.reverse();
    quad(m, ...q);
  }
}
function roof(x0, ridge, halfX, halfZ, rise) {
  for (let s of [-1, 1]) {
    const dir = [
        0,
        -rise / Math.hypot(halfZ, rise),
        (s * halfZ) / Math.hypot(halfZ, rise),
      ],
      L = Math.hypot(halfZ, rise);
    const a = [x0 - halfX, ridge, 0],
      b = [x0 + halfX, ridge, 0],
      c = [x0 + halfX, ridge - rise, s * halfZ],
      d = [x0 - halfX, ridge - rise, s * halfZ];
    let q = [a, b, c, d];
    if (s > 0) q.reverse();
    quad("roof3", ...q);
    for (let i = 0; i < 39; i++)
      for (let j = 0; j < 11; j++) {
        let x = x0 - halfX + 0.115 + (i * (halfX * 2 - 0.23)) / 38,
          t = (j * L) / 11;
        tile(
          j % 4 === 0 ? "roof2" : (i + j) % 5 === 0 ? "roof3" : "roof",
          x,
          ridge + dir[1] * t + 0.035,
          s * 0 + dir[2] * t,
          dir,
          L / 11 + 0.09,
        );
      }
    tube(
      "timber",
      [x0 - halfX, ridge - rise - 0.1, s * halfZ],
      [x0 + halfX, ridge - rise - 0.1, s * halfZ],
      0.075,
    );
    for (let x of [x0 - halfX, x0 + halfX])
      tube(
        "timber",
        [x, ridge + 0.04, 0],
        [x, ridge - rise - 0.1, s * halfZ],
        0.085,
      );
  }
  for (let i = 0; i < 38; i++)
    tube(
      "roof2",
      [x0 - halfX + i * 0.24, ridge + 0.06, 0],
      [x0 - halfX + i * 0.24 + 0.26, ridge + 0.06, 0],
      0.14,
      0.14,
      10,
    );
}
function leanRoof(x1, x2, z1, z2, y1, y2) {
  quad("roof3", [x1, y1, z1], [x1, y2, z2], [x2, y2, z2], [x2, y1, z1]);
  const L = Math.hypot(z2 - z1, y2 - y1),
    dir = [0, (y2 - y1) / L, (z2 - z1) / L];
  for (let i = 0; i < 23; i++)
    for (let j = 0; j < 5; j++) {
      const t = (j * L) / 5;
      tile(
        (i + j) % 4 ? "roof" : "roof2",
        x1 + 0.11 + (i * (x2 - x1 - 0.22)) / 22,
        y1 + t * dir[1] + 0.025,
        z1 + t * dir[2],
        dir,
        L / 5 + 0.1,
        0.23,
      );
    }
  tube("timber", [x1, y2 - 0.06, z2], [x2, y2 - 0.06, z2], 0.07);
}
function masonryWall(a, b, h = 0.85) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  box(
    "mortar",
    [(a[0] + b[0]) / 2, h / 2 + 0.1, (a[1] + b[1]) / 2],
    [len, h, 0.33],
    angle,
  );
  for (let row = 0; row < 3; row++) {
    let count = Math.ceil(len / 0.6);
    for (let i = 0; i < count; i++) {
      let t = (i + 0.5 + (row % 2) * 0.32) / count;
      if (t >= 1) continue;
      let c = [
        a[0] + (b[0] - a[0]) * t,
        0.1 + ((row + 0.5) * h) / 3,
        a[1] + (b[1] - a[1]) * t,
      ];
      box(
        (row + i) % 4 ? "stone" : "trim",
        c,
        [len / count - 0.028, h / 3 - 0.025, 0.38],
        angle,
      );
    }
  }
  for (let i = 0; i < Math.ceil(len / 0.75); i++) {
    let t = (i + 0.5) / Math.ceil(len / 0.75);
    box(
      "trim",
      [a[0] + (b[0] - a[0]) * t, h + 0.13, a[1] + (b[1] - a[1]) * t],
      [len / Math.ceil(len / 0.75) - 0.015, 0.12, 0.46],
      angle,
    );
  }
}
function gardens() {
  // Front path, with irregular polygon pavers over a sand bed.
  box("mortar", [0, 0.14, 6], [1.45, 0.1, 3.1]);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 3; col++) {
      let x = -0.69 + col * 0.48,
        z = 4.5 + row * 0.46;
      const pts = [
        [x + 0.03, 0.203, z + 0.04],
        [x + 0.42, 0.203, z + 0.015],
        [x + 0.46, 0.203, z + 0.32],
        [x + 0.3, 0.203, z + 0.43],
        [x + 0.025, 0.203, z + 0.39],
      ];
      polygon(row % 3 ? "stone" : "trim", pts.slice().reverse());
    }
  // Side stone walk follows the east facade.
  box("mortar", [5.03, 0.105, 0], [1.8, 0.12, 8.6]);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 3; j++)
      box(
        (i + j) % 3 ? "stone" : "trim",
        [4.5 + j * 0.52, 0.175, -3.9 + i * 0.53],
        [0.47, 0.08, 0.48],
        (rand() - 0.5) * 0.15,
      );
  masonryWall([-8, 6.55], [-1.0, 6.55]);
  masonryWall([1.0, 6.55], [2.2, 6.5]);
  for (let i = 0; i < 17; i++) {
    let t = 0.41 + i * 0.06,
      u = t + 0.06;
    const r = 10.75;
    masonryWall(
      [-2 + r * Math.sin(t), -4 + r * Math.cos(t)],
      [-2 + r * Math.sin(u), -4 + r * Math.cos(u)],
      0.78,
    );
  }
  for (let x of [-1.0, 1.0]) {
    box("mortar", [x, 0.92, 6.55], [0.49, 1.6, 0.49]);
    for (let j = 0; j < 5; j++)
      box(
        j % 2 ? "stone" : "trim",
        [x, 0.24 + j * 0.29, 6.55],
        [0.53, 0.27, 0.53],
      );
    box("trim", [x, 1.69, 6.55], [0.68, 0.14, 0.64]);
  }
  // Rear side fence with individual boards.
  for (let z = -3.3; z < 0; z += 0.19)
    box("timber", [6.1, 0.93, z], [0.13, 1.66, 0.16]);
  for (let y of [0.5, 1.3]) box("bark", [6.03, y, -1.7], [0.16, 0.1, 3.5]);
  // Small mailbox by the path entrance.
  box("frame", [-1.7, 0.88, 6.5], [0.09, 1.55, 0.09]);
  box("door", [-1.7, 1.64, 6.5], [0.55, 0.46, 0.38]);
  tube("frame", [-1.99, 1.8, 6.5], [-1.42, 1.8, 6.5], 0.19, 0.19, 12);
  box("trim", [-1.7, 1.67, 6.718], [0.21, 0.015, 0.012]);
  box("chrome", [-1.7, 1.54, 6.72], [0.11, 0.025, 0.015]);
  // Potted olive bushes on the porch.
  for (let p of [
    [-1.3, 3.65],
    [2.9, 4.5],
  ]) {
    tube("terra", [p[0], 0.24, p[1]], [p[0], 0.68, p[1]], 0.22, 0.3, 16);
    tube("roof2", [p[0], 0.64, p[1]], [p[0], 0.73, p[1]], 0.31, 0.31, 16);
    box("earth", [p[0], 0.72, p[1]], [0.4, 0.025, 0.4]);
    bush(p[0], p[1], 0.75, 0.65);
  }
  for (let p of [
    [-3.4, 4.6],
    [-4.8, 3.5],
    [3.7, 4.0],
    [4.8, 3.0],
    [6.2, 2.0],
    [-6.0, 6],
    [-5.0, 5.9],
    [4.6, 5.3],
    [5.3, 4.6],
    [-4.8, -1.6],
    [-6.5, 1.2],
  ])
    bush(p[0], p[1], 0.1, 0.7 + rand() * 0.15);
  for (let i = 0; i < 26; i++) {
    let x = i < 14 ? -7.8 + i * 0.45 : 2.0 + (i - 14) * 0.34,
      z = i < 14 ? 6.1 : 6.1 - (i - 14) * 0.23;
    bush(x, z, 0.12, 0.35 + rand() * 0.25);
  }
  // Lavender and small flowers along the house edge.
  for (let i = 0; i < 65; i++) {
    let x = -4.1 + rand() * 8.2,
      z = 3.48 + rand() * 0.47;
    if (Math.abs(x) < 1.3) continue;
    let y = 0.45 + rand() * 0.35;
    tube("leaf", [x, 0.1, z], [x, y, z], 0.014, 0.007, 5);
    ellipsoid(
      i % 4 ? "lavender" : "yellow",
      [x, y, z],
      [0.045, 0.11, 0.045],
      5,
      3,
    );
  }
  tree(-6.3, 3.8, 3.45, 1.85);
  tree(7.0, -1.0, 3.15, 1.45);
  tree(-6.1, -3.5, 3.25, 1.6);
  for (let p of [
    [-8, -2],
    [-7.3, -5.0],
    [7.5, -5.5],
    [-9.0, -4],
  ]) {
    tube("bark", [p[0], 0.1, p[1]], [p[0], 2, p[1]], 0.12, 0.07, 8);
    for (let i = 0; i < 8; i++) {
      let y = 1.2 + i * 0.5;
      ellipsoid(
        i % 2 ? "leaf" : "leaf2",
        [p[0], y, p[1]],
        [0.52 * (1 - i * 0.085), 0.8, 0.5 * (1 - i * 0.085)],
        8,
        5,
      );
    }
  }
}
function bush(x, z, y, r) {
  for (let i = 0; i < 9; i++) {
    let a = rand() * PI * 2,
      rad = rand() * r * 0.75,
      cy = y + 0.25 + rand() * r * 0.65;
    ellipsoid(
      i % 3 === 0 ? "leaf3" : i % 2 ? "leaf2" : "leaf",
      [x + Math.cos(a) * rad, cy, z + Math.sin(a) * rad],
      [r * 0.38, 0.25 + r * 0.22, r * 0.36],
      6,
      3,
    );
  }
}
function tree(x, z, h, r) {
  tube("bark", [x, 0.1, z], [x + 0.15, h * 0.7, z], 0.2, 0.095, 10);
  for (let i = 0; i < 9; i++) {
    let a = i * 2.4,
      by = h * 0.55 + rand() * 0.35,
      end = [x + Math.cos(a) * r * 0.7, by + 0.7, z + Math.sin(a) * r * 0.65];
    tube("bark", [x + 0.1, h * 0.5, z], end, 0.06, 0.02, 7);
  }
  for (let i = 0; i < 48; i++) {
    let a = rand() * PI * 2,
      rad = Math.sqrt(rand()) * r;
    let yy = h + 0.55 * (rand() - 0.5) - rad * 0.2;
    ellipsoid(
      i % 3 === 0 ? "leaf3" : i % 2 ? "leaf2" : "leaf",
      [x + Math.cos(a) * rad, yy, z + Math.sin(a) * rad],
      [0.35 + rand() * 0.24, 0.27 + rand() * 0.23, 0.34 + rand() * 0.25],
      6,
      3,
    );
  }
}
function car() {
  const old = xf,
    ang = 0.48;
  xf = (p) =>
    old([
      4.2 + p[0] * Math.cos(ang) + p[2] * Math.sin(ang),
      0.04 + p[1],
      8.25 - p[0] * Math.sin(ang) + p[2] * Math.cos(ang),
    ]);
  // Smoothly faceted closed hatchback body from shaped transverse stations.
  const stations = [
    [-2.25, 0.72, 0.59],
    [-2.05, 0.85, 0.83],
    [-1.62, 0.93, 0.95],
    [-0.85, 0.95, 1.01],
    [0.45, 0.95, 1.0],
    [1.55, 0.91, 0.91],
    [2.03, 0.78, 0.79],
    [2.14, 0.7, 0.66],
  ];
  const ring = (s) => {
    const [x, w, y] = s;
    return [
      [x, 0.4, -w * 0.84],
      [x, 0.57, -w],
      [x, y - 0.13, -w],
      [x, y, -w * 0.78],
      [x, y, w * 0.78],
      [x, y - 0.13, w],
      [x, 0.57, w],
      [x, 0.4, w * 0.84],
    ];
  };
  let rings = stations.map(ring);
  for (let j = 0; j < rings.length - 1; j++)
    for (let k = 0; k < 8; k++) {
      let n = (k + 1) % 8;
      quad(
        k === 3 ? "blue2" : "blue",
        xf(rings[j][n]),
        xf(rings[j + 1][n]),
        xf(rings[j + 1][k]),
        xf(rings[j][k]),
      );
    }
  polygon("blue", rings[0].slice().reverse());
  polygon("blue", rings.at(-1));
  // Hood crease and shoulder line.
  for (let z of [-0.55, 0.55])
    tube("blue2", [-2.04, 0.87, z], [-0.87, 1.015, z * 0.93], 0.022, 0.017, 6);
  box("rubber", [0, 0.38, 0], [3.85, 0.12, 1.78]);
  for (let z of [-0.95, 0.95])
    box("blue2", [0.05, 0.47, z], [3.75, 0.1, 0.085]);
  // Cabin pillars, roof and real inset glazing.
  const cabin = [
    [-0.94, 1.0, 0.82],
    [-0.27, 1.63, 0.67],
    [0.83, 1.65, 0.65],
    [1.68, 1.03, 0.82],
  ];
  const ct = (i, s) => [cabin[i][0], cabin[i][1], s * cabin[i][2]];
  quad("glass", xf(ct(0, 1)), xf(ct(1, 1)), xf(ct(1, -1)), xf(ct(0, -1)));
  quad("blue2", xf(ct(1, 1)), xf(ct(2, 1)), xf(ct(2, -1)), xf(ct(1, -1)));
  quad("glass", xf(ct(2, 1)), xf(ct(3, 1)), xf(ct(3, -1)), xf(ct(2, -1)));
  for (let s of [-1, 1]) {
    const P = (p) => [p[0], p[1], s * p[2]];
    const rear = [
      P([0.54, 1.06, 0.82]),
      P([0.54, 1.57, 0.674]),
      P([0.84, 1.58, 0.67]),
      P([1.48, 1.08, 0.81]),
    ];
    const front = [
      P([-0.76, 1.065, 0.826]),
      P([-0.2, 1.56, 0.691]),
      P([0.44, 1.58, 0.674]),
      P([0.44, 1.065, 0.83]),
    ];
    if (s > 0) {
      rear.reverse();
      front.reverse();
    }
    polygon("glass", rear);
    polygon("glass2", front);
    for (let i = 0; i < 3; i++)
      tube("blue", ct(i, s), ct(i + 1, s), 0.047, 0.047, 7);
    tube(
      "frame",
      P([0.49, 1.035, 0.843]),
      P([0.49, 1.6, 0.677]),
      0.05,
      0.05,
      6,
    );
    tube(
      "blue",
      P([-0.86, 1.015, 0.85]),
      P([1.66, 1.025, 0.85]),
      0.052,
      0.052,
      8,
    );
    // Side mirrors and door handles.
    tube(
      "frame",
      [-0.62, 1.04, s * 0.85],
      [-0.68, 1.1, s * 1.07],
      0.045,
      0.045,
      7,
    );
    ellipsoid("blue", [-0.73, 1.13, s * 1.08], [0.18, 0.1, 0.1], 10, 5);
    box("glass2", [-0.72, 1.14, s * 1.175], [0.22, 0.09, 0.018]);
    for (let x of [0.14, 1.15])
      box("frame", [x, 0.945, s * 0.946], [0.2, 0.032, 0.038]);
    // Door shut lines.
    for (let x of [0.49, 1.58])
      tube("frame", [x, 0.47, s * 0.94], [x, 1.005, s * 0.95], 0.008, 0.008, 5);
  }
  // Roof antenna and windshield wipers.
  tube("frame", [0.92, 1.66, 0], [1.03, 1.96, 0], 0.014, 0.006, 6);
  for (let z of [-0.35, 0.35])
    tube("frame", [-0.86, 1.067, z], [-0.45, 1.22, z * 0.85], 0.012, 0.012, 5);
  // Front grille, headlights, bumper inserts, registration plate.
  box("rubber", [-2.238, 0.67, 0], [0.035, 0.24, 1.07]);
  for (let y of [0.6, 0.65, 0.7, 0.75])
    box("chrome", [-2.258, y, 0], [0.025, 0.018, 1.05]);
  for (let z of [-0.61, 0.61]) {
    ellipsoid("frame", [-2.06, 0.84, z], [0.17, 0.12, 0.24], 10, 5);
    ellipsoid("light", [-2.1, 0.856, z], [0.155, 0.083, 0.207], 10, 5);
    for (let dz of [-0.08, 0.075])
      ellipsoid("white", [-2.2, 0.864, z + dz], [0.018, 0.054, 0.053], 8, 4);
  }
  box("rubber", [-2.232, 0.43, 0], [0.05, 0.16, 1.3]);
  box("chrome", [-2.27, 0.49, 0], [0.02, 0.018, 1.08]);
  box("trim", [-2.287, 0.6, 0], [0.018, 0.12, 0.43]);
  for (let z of [-0.65, 0.65])
    ellipsoid("light", [-2.18, 0.43, z], [0.025, 0.046, 0.1], 8, 4);
  ellipsoid("chrome", [-2.275, 0.765, 0], [0.014, 0.1, 0.1], 12, 6);
  ellipsoid("frame", [-2.29, 0.765, 0], [0.008, 0.061, 0.062], 10, 5);
  for (let z of [-0.63, 0.63]) box("red", [2.05, 0.85, z], [0.09, 0.18, 0.31]);
  box("frame", [2.17, 0.47, 0], [0.035, 0.14, 1.25]);
  box("trim", [2.18, 0.69, 0], [0.03, 0.12, 0.43]);
  box("blue", [1.28, 1.44, 0], [0.3, 0.1, 1.37]);
  // Four complete wheels: rubber tire, alloy ring, hub, spokes, lug bolts.
  for (let x of [-1.39, 1.36])
    for (let z of [-0.91, 0.91]) {
      const s = Math.sign(z),
        cy = 0.46;
      tube("rubber", [x, cy, z - 0.13], [x, cy, z + 0.13], 0.435, 0.435, 28);
      tube(
        "chrome",
        [x, cy, z + s * 0.135],
        [x, cy, z + s * 0.16],
        0.31,
        0.31,
        24,
      );
      tube(
        "frame",
        [x, cy, z + s * 0.163],
        [x, cy, z + s * 0.166],
        0.255,
        0.255,
        24,
      );
      tube(
        "chrome",
        [x, cy, z + s * 0.17],
        [x, cy, z + s * 0.19],
        0.082,
        0.082,
        16,
      );
      for (let i = 0; i < 10; i++) {
        let a = (i * 2 * PI) / 10;
        const p1 = [
            x + 0.08 * Math.cos(a),
            cy + 0.08 * Math.sin(a),
            z + s * 0.18,
          ],
          p2 = [
            x + 0.29 * Math.cos(a + 0.14),
            cy + 0.29 * Math.sin(a + 0.14),
            z + s * 0.17,
          ];
        tube("chrome", p1, p2, 0.018, 0.016, 5);
      }
      for (let i = 0; i < 5; i++) {
        let a = (i * 2 * PI) / 5;
        ellipsoid(
          "frame",
          [x + 0.052 * Math.cos(a), cy + 0.052 * Math.sin(a), z + s * 0.194],
          [0.013, 0.013, 0.007],
          6,
          3,
        );
      }
      // Wheel arch upper lip follows the tire curve.
      for (let i = 0; i < 14; i++) {
        let a = (PI * i) / 14,
          b = (PI * (i + 1)) / 14;
        const p1 = [
            x + 0.47 * Math.cos(a),
            cy + 0.47 * Math.sin(a),
            z + s * 0.145,
          ],
          p2 = [x + 0.47 * Math.cos(b), cy + 0.47 * Math.sin(b), z + s * 0.145];
        tube("blue2", p1, p2, 0.026, 0.026, 5);
      }
    }
  xf = old;
}
export default class HouseScene extends createSystem({ priority: 0 }) {
  init() {
    ground();
    house();
    gardens();
    car();
    for (const [name, positions] of batches) {
      const c = palette[name] || [0.5, 0.5, 0.5],
        pr = props[name] || [0.87, 0];
      this.spawn.mesh({
        key: `scene.${name}`,
        mesh: mesh.triangleList({ label: name, positions }),
        material: material.standard({
          label: name,
          baseColor: [...c, 1],
          roughness: pr[0],
          metallic: pr[1],
        }),
        castShadow:
          name !== "asphalt" && name !== "aggregate" && name !== "grass",
        receiveShadow: true,
      });
    }
    this.setView({
      position: [14, 9, 19],
      target: [0, 2.5, 1],
      fovYDegrees: 37,
      near: 0.1,
      far: 200,
    });
    this.spawn.light({
      key: "sun",
      kind: "directional",
      intensity: 3.2,
      color: [1, 0.88, 0.69, 1],
      transform: { rotationEulerDegrees: [-42, -45, 0] },
      shadow: {
        mapSize: 1024,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.78,
        filterRadius: 1,
        normalBias: 0.035,
      },
    });
    this.spawn.light({
      key: "fill",
      kind: "ambient",
      intensity: 0.22,
      color: [0.67, 0.78, 1, 1],
    });
  }
  setView(c) {
    if (this.cameraEntity) this.cameraEntity.destroy();
    this.cameraEntity = this.spawn.camera({
      key: "camera.main",
      transform: { translation: c.position, lookAt: c.target },
      fovYDegrees: c.fovYDegrees,
      camera: {
        aspect: 1024 / 768,
        near: c.near,
        far: c.far,
        clearColor: [0.55, 0.7, 0.85, 1],
      },
    });
  }
  update() {
    for (const command of this.commands.drain("bench.camera"))
      this.setView(command);
  }
}
