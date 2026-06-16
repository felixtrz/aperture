import {
  CELL_RAW,
  DECO_CELLS,
  GRID_SCALE,
  ORIENT_DEG,
  TRACK_CELLS,
  type GridCell,
} from "./track-data.js";

export interface DecorationInstance {
  /** local-space (within the track group) position before the y=-0.5, 0.75-scale group transform. */
  readonly x: number;
  readonly z: number;
  /** number of quarter-turns (90 degrees) about Y. */
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
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

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
      buckets[DECO_KEY_TO_BUCKET[key] ?? "forest"].push({
        x,
        z,
        rotQuarters: rotQ,
      });
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

/** World-space placement of a track piece before the y=-0.5, 0.75-scale group transform. */
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

export function computeTrackBounds(
  cells: readonly GridCell[] | null,
): TrackBounds {
  if (!cells || cells.length === 0) {
    return { centerX: 0, centerZ: 0, halfWidth: 30, halfDepth: 30 };
  }
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [gx, gz] of cells) {
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  }
  const scale = CELL_RAW * GRID_SCALE;
  const centerX = ((minX + maxX + 1) / 2) * scale;
  const centerZ = ((minZ + maxZ + 1) / 2) * scale;
  const halfWidth = ((maxX - minX + 1) / 2) * scale + scale;
  const halfDepth = ((maxZ - minZ + 1) / 2) * scale + scale;
  return { centerX, centerZ, halfWidth, halfDepth };
}
