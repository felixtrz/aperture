// Faithful port of references/Starter-Kit-Racing/js/Track.js — pure logic only
// (no rendering). Grid layout, piece placement math, decoration buckets, NPCs,
// the base64url map codec, spawn position, and track bounds.

export type GridCell = readonly [number, number, string, number];

export const ORIENT_DEG: Record<number, number> = { 0: 0, 10: 180, 16: 90, 22: 270 };

export const CELL_RAW = 9.99;
export const GRID_SCALE = 0.75;

export const TRACK_CELLS: readonly GridCell[] = [
  [-3, -3, "track-corner", 16],
  [-2, -3, "track-straight", 22],
  [-1, -3, "track-straight", 22],
  [0, -3, "track-corner", 0],
  [-3, -2, "track-straight", 0],
  [0, -2, "track-straight", 0],
  [-3, -1, "track-corner", 10],
  [-2, -1, "track-corner", 0],
  [0, -1, "track-straight", 0],
  [-2, 0, "track-straight", 10],
  [0, 0, "track-finish", 0],
  [-2, 1, "track-straight", 10],
  [0, 1, "track-straight", 0],
  [-2, 2, "track-corner", 10],
  [-1, 2, "track-straight", 16],
  [0, 2, "track-corner", 22],
];

export const DECO_CELLS: readonly GridCell[] = [
  [-4, -2, "decoration-tents", 10],
  [-1, -4, "decoration-tents", 22],
  [-1, 1, "decoration-tents", 22],
  [-8, -9, "decoration-forest", 0], [-7, -9, "decoration-forest", 0],
  [-6, -9, "decoration-forest", 0], [-5, -9, "decoration-forest", 0],
  [-4, -9, "decoration-forest", 0], [-3, -9, "decoration-forest", 0],
  [-2, -9, "decoration-forest", 0], [-1, -9, "decoration-forest", 0],
  [0, -9, "decoration-forest", 0], [1, -9, "decoration-forest", 0],
  [2, -9, "decoration-forest", 0],
  [-8, -8, "decoration-forest", 0], [-7, -8, "decoration-forest", 0],
  [-6, -8, "decoration-forest", 0], [-5, -8, "decoration-forest", 0],
  [-4, -8, "decoration-forest", 0], [-3, -8, "decoration-forest", 0],
  [-2, -8, "decoration-forest", 0], [-1, -8, "decoration-forest", 0],
  [0, -8, "decoration-forest", 0], [1, -8, "decoration-forest", 0],
  [2, -8, "decoration-forest", 0],
  [-8, -7, "decoration-forest", 0], [-7, -7, "decoration-forest", 0],
  [-6, -7, "decoration-forest", 0], [-5, -7, "decoration-forest", 0],
  [-4, -7, "decoration-forest", 0], [-3, -7, "decoration-forest", 0],
  [-2, -7, "decoration-forest", 0], [-1, -7, "decoration-forest", 0],
  [0, -7, "decoration-forest", 0], [1, -7, "decoration-forest", 0],
  [2, -7, "decoration-forest", 0],
  [-8, -6, "decoration-forest", 0], [-7, -6, "decoration-forest", 0],
  [-6, -6, "decoration-forest", 0], [-5, -6, "decoration-forest", 0],
  [-4, -6, "decoration-forest", 0], [-3, -6, "decoration-empty", 0],
  [-2, -6, "decoration-empty", 0], [-1, -6, "decoration-empty", 0],
  [0, -6, "decoration-empty", 0], [1, -6, "decoration-forest", 0],
  [2, -6, "decoration-forest", 0],
  [-8, -5, "decoration-forest", 0], [-7, -5, "decoration-forest", 0],
  [-6, -5, "decoration-forest", 0], [-5, -5, "decoration-forest", 0],
  [-4, -5, "decoration-empty", 0], [-3, -5, "decoration-empty", 0],
  [-2, -5, "decoration-empty", 0], [-1, -5, "decoration-empty", 0],
  [0, -5, "decoration-empty", 0], [1, -5, "decoration-forest", 0],
  [2, -5, "decoration-forest", 0],
  [-8, -4, "decoration-forest", 0], [-7, -4, "decoration-forest", 0],
  [-6, -4, "decoration-forest", 0], [-5, -4, "decoration-forest", 0],
  [-4, -4, "decoration-empty", 0],
  [1, -4, "decoration-forest", 0],
  [2, -4, "decoration-forest", 0],
  [-8, -3, "decoration-forest", 0], [-7, -3, "decoration-forest", 0],
  [-6, -3, "decoration-forest", 0], [-5, -3, "decoration-forest", 0],
  [-4, -3, "decoration-empty", 0],
  [1, -3, "decoration-forest", 0],
  [2, -3, "decoration-forest", 0],
  [-8, -2, "decoration-forest", 0], [-7, -2, "decoration-forest", 0],
  [-6, -2, "decoration-forest", 0], [-5, -2, "decoration-forest", 0],
  [1, -2, "decoration-forest", 0],
  [2, -2, "decoration-forest", 0],
  [-8, -1, "decoration-forest", 0], [-7, -1, "decoration-forest", 0],
  [-6, -1, "decoration-forest", 0], [-5, -1, "decoration-forest", 0],
  [-4, -1, "decoration-empty", 0], [-1, -1, "decoration-empty", 0],
  [1, -1, "decoration-forest", 0],
  [2, -1, "decoration-forest", 0],
  [-8, 0, "decoration-forest", 0], [-7, 0, "decoration-forest", 0],
  [-6, 0, "decoration-forest", 0], [-5, 0, "decoration-forest", 0],
  [-4, 0, "decoration-empty", 0], [-3, 0, "decoration-empty", 0],
  [-1, 0, "decoration-empty", 0],
  [1, 0, "decoration-forest", 0],
  [2, 0, "decoration-forest", 0],
  [-8, 1, "decoration-forest", 0], [-7, 1, "decoration-forest", 0],
  [-6, 1, "decoration-forest", 0], [-5, 1, "decoration-forest", 0],
  [-4, 1, "decoration-empty", 0], [-3, 1, "decoration-empty", 0],
  [1, 1, "decoration-forest", 0],
  [2, 1, "decoration-forest", 0],
  [-8, 2, "decoration-forest", 0], [-7, 2, "decoration-forest", 0],
  [-6, 2, "decoration-forest", 0], [-5, 2, "decoration-forest", 0],
  [-4, 2, "decoration-empty", 0], [-3, 2, "decoration-empty", 0],
  [1, 2, "decoration-forest", 0],
  [2, 2, "decoration-forest", 0],
  [-8, 3, "decoration-forest", 0], [-7, 3, "decoration-forest", 0],
  [-6, 3, "decoration-forest", 0], [-5, 3, "decoration-forest", 0],
  [-4, 3, "decoration-forest", 0], [-3, 3, "decoration-forest", 0],
  [-2, 3, "decoration-forest", 0], [-1, 3, "decoration-forest", 0],
  [0, 3, "decoration-forest", 0], [1, 3, "decoration-forest", 0],
  [2, 3, "decoration-forest", 0],
  [-8, 4, "decoration-forest", 0], [-7, 4, "decoration-forest", 0],
  [-6, 4, "decoration-forest", 0], [-5, 4, "decoration-forest", 0],
  [-4, 4, "decoration-forest", 0], [-3, 4, "decoration-forest", 0],
  [-2, 4, "decoration-forest", 0], [-1, 4, "decoration-forest", 0],
  [0, 4, "decoration-forest", 0], [1, 4, "decoration-forest", 0],
  [2, 4, "decoration-forest", 0],
];

export type NpcTruck = readonly [string, number, number, number, number];

export const NPC_TRUCKS: readonly NpcTruck[] = [
  ["vehicle-truck-green", -3.51, -0.01, 12.7, 98.0],
  ["vehicle-truck-purple", -23.78, -0.14, -13.56, 0.0],
  ["vehicle-truck-red", -1.36, -0.15, -23.8, 155.9],
];

export interface DecorationInstance {
  /** local-space (within the track group) position before the y=-0.5, 0.75-scale group transform. */
  readonly x: number;
  readonly z: number;
  /** number of quarter-turns (90°) about Y. */
  readonly rotQuarters: number;
}

export interface DecorationBuckets {
  readonly empty: DecorationInstance[];
  readonly forest: DecorationInstance[];
  readonly tents: DecorationInstance[];
}

const DECO_KEY_TO_BUCKET: Record<string, keyof DecorationBuckets> = {
  "decoration-empty": "empty",
  "decoration-forest": "forest",
  "decoration-tents": "tents",
};

/** Deterministic pseudo-random hash (Track.js). */
function hash(gx: number, gz: number): number {
  let h = gx * 374761393 + gz * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

/**
 * Compute decoration instance placements (forest border + tents ring + empty
 * ground) exactly as Track.js does for the default track.
 */
export function computeDecorationBuckets(
  cells: readonly GridCell[] = TRACK_CELLS,
  customCells = false,
): DecorationBuckets {
  const empty: DecorationInstance[] = [];
  const forest: DecorationInstance[] = [];
  const tents: DecorationInstance[] = [];
  const buckets: DecorationBuckets = { empty, forest, tents };

  const occupied = new Set<string>();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (const [gx, gz] of cells) {
    occupied.add(gx + "," + gz);
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  }

  if (!customCells) {
    for (const [gx, gz, key, orient] of DECO_CELLS) {
      occupied.add(gx + "," + gz);
      minX = Math.min(minX, gx);
      maxX = Math.max(maxX, gx);
      minZ = Math.min(minZ, gz);
      maxZ = Math.max(maxZ, gz);
      const x = (gx + 0.5) * CELL_RAW;
      const z = (gz + 0.5) * CELL_RAW;
      const rotQ = ((ORIENT_DEG[orient] ?? 0) / 90) | 0;
      buckets[DECO_KEY_TO_BUCKET[key] ?? "forest"].push({ x, z, rotQuarters: rotQ });
    }
  }

  const pad = 3;
  for (let gz = minZ - pad; gz <= maxZ + pad; gz++) {
    for (let gx = minX - pad; gx <= maxX + pad; gx++) {
      if (occupied.has(gx + "," + gz)) continue;
      const distX = gx < minX ? minX - gx : gx > maxX ? gx - maxX : 0;
      const distZ = gz < minZ ? minZ - gz : gz > maxZ ? gz - maxZ : 0;
      const dist = Math.max(distX, distZ);
      const x = (gx + 0.5) * CELL_RAW;
      const z = (gz + 0.5) * CELL_RAW;
      if (dist <= 1) {
        if (hash(gx, gz) % 7 === 0) {
          tents.push({ x, z, rotQuarters: hash(gx, gz) % 4 });
        } else {
          empty.push({ x, z, rotQuarters: 0 });
        }
      } else {
        forest.push({ x, z, rotQuarters: 0 });
      }
    }
  }

  return buckets;
}

/** World-space placement of a track piece (matches placePiece in Track.js,
 * pre-group-transform: the track group applies y=-0.5 then scale 0.75). */
export function piecePlacement(cell: GridCell): {
  position: [number, number, number];
  rotationYDeg: number;
} {
  const [gx, gz, , orient] = cell;
  return {
    position: [(gx + 0.5) * CELL_RAW, 0.5, (gz + 0.5) * CELL_RAW],
    rotationYDeg: ORIENT_DEG[orient] ?? 0,
  };
}

// ─── Track Codec ──────────────────────────────────────────

export const TYPE_NAMES = [
  "track-straight",
  "track-corner",
  "track-bump",
  "track-finish",
] as const;

const TYPE_INDEX: Record<string, number> = {};
for (let i = 0; i < TYPE_NAMES.length; i++) TYPE_INDEX[TYPE_NAMES[i]!] = i;

const ORIENT_TO_GODOT = [0, 16, 10, 22];
const GODOT_TO_ORIENT: Record<number, number> = { 0: 0, 16: 1, 10: 2, 22: 3 };

export function encodeCells(cells: readonly GridCell[]): string {
  const bytes = new Uint8Array(cells.length * 3);
  for (let i = 0; i < cells.length; i++) {
    const [gx, gz, name, godotOrient] = cells[i]!;
    const ti = TYPE_INDEX[name] ?? 0;
    const oi = GODOT_TO_ORIENT[godotOrient] ?? 0;
    bytes[i * 3] = gx + 128;
    bytes[i * 3 + 1] = gz + 128;
    bytes[i * 3 + 2] = (ti << 2) | oi;
  }
  return bytesToBase64url(bytes);
}

export function decodeCells(str: string): GridCell[] {
  const bytes = base64urlToBytes(str);
  const cells: GridCell[] = [];
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const gx = bytes[i]! - 128;
    const gz = bytes[i + 1]! - 128;
    const packed = bytes[i + 2]!;
    const ti = (packed >> 2) & 0x03;
    const oi = packed & 0x03;
    cells.push([gx, gz, TYPE_NAMES[ti]!, ORIENT_TO_GODOT[oi]!]);
  }
  return cells;
}

// ─── Page-URL → worker bridge ─────────────────────────────
//
// Systems run in the simulation worker, which has no `location.search`. The
// generated browser bootstrap (vite-plugin) reads the page URL on the main
// thread and forwards every query param into the worker start options; the app
// worker loop republishes them on the ECS world globals under this key (see
// packages/app/src/worker/loop.ts → APERTURE_WORKER_START_OPTIONS_KEY). We read
// the `map` field here — matching the existing `aperture.systemContext` globals
// accessor already used by drift-marks/particles systems.
const WORKER_START_OPTIONS_KEY = "aperture.workerStartOptions";

/** Read the raw `?map=` codec string forwarded from the page URL, if any. */
export function readMapParam(world: unknown): string | null {
  const globals = (world as { readonly globals?: Record<string, unknown> })
    .globals;
  const start = globals?.[WORKER_START_OPTIONS_KEY] as
    | { readonly map?: unknown }
    | undefined;
  const map = start?.map;
  return typeof map === "string" && map.length > 0 ? map : null;
}

/**
 * Resolve the active track cells for this run: decode the `?map=` codec string
 * forwarded from the page URL when present, else fall back to the built-in
 * TRACK_CELLS. `customMap` is true when a decoded map is in use (the decoration
 * placement skips the hand-authored DECO_CELLS for custom maps, matching
 * Track.js' shared-map behaviour).
 */
export function resolveTrackCells(world: unknown): {
  readonly cells: readonly GridCell[];
  readonly customMap: boolean;
} {
  const mapParam = readMapParam(world);
  if (mapParam !== null) {
    const decoded = decodeCells(mapParam);
    if (decoded.length > 0) {
      return { cells: decoded, customMap: true };
    }
  }
  return { cells: TRACK_CELLS, customMap: false };
}

export interface SpawnPose {
  readonly position: [number, number, number];
  readonly angle: number;
}

export function computeSpawnPosition(cells: readonly GridCell[]): SpawnPose {
  let cell: GridCell | undefined = cells[0];
  for (const c of cells) {
    if (c[2] === "track-finish") {
      cell = c;
      break;
    }
  }
  if (!cell) return { position: [3.5, 0.5, 5], angle: 0 };
  const gx = cell[0];
  const gz = cell[1];
  const x = (gx + 0.5) * CELL_RAW * GRID_SCALE;
  const z = (gz + 0.5) * CELL_RAW * GRID_SCALE;
  const orient = cell[3];
  const angle = ((ORIENT_DEG[orient] || 0) * Math.PI) / 180;
  return { position: [x, 0.5, z], angle };
}

export interface TrackBounds {
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export function computeTrackBounds(cells: readonly GridCell[] | null): TrackBounds {
  if (!cells || cells.length === 0)
    return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [gx, gz] of cells) {
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  }
  const S = CELL_RAW * GRID_SCALE;
  const centerX = ((minX + maxX + 1) / 2) * S;
  const centerZ = ((minZ + maxZ + 1) / 2) * S;
  const halfWidth = ((maxX - minX + 1) / 2) * S + S;
  const halfDepth = ((maxZ - minZ + 1) / 2) * S + S;
  return { centerX, centerZ, halfWidth, halfDepth };
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
