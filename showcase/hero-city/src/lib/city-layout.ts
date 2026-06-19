// Simulation-pure data describing a small, fixed "hero" town built from Kenney's
// Starter-Kit-City-Builder tiles. Browser/WebGPU-free so it runs inside the
// generated simulation worker.
//
// The town is authored as a fully-tiled pad (every cell is a real Kenney tile —
// grass, road, or pavement), so there is no big ground plane: the tiles ARE the
// ground and the town floats on the sky background like Kenney's own screenshot.
// A ring road with four corners wraps a small central park, and buildings are
// packed shoulder-to-shoulder around the outside facing in.

export interface GroundTile {
  /** GLB asset id for the flat ground tile (road / pavement / grass). */
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Quarter-turns about Y (0..3). */
  readonly r: number;
  /** Tiles with raised geometry (trees) cast shadows; flat ground does not. */
  readonly casts: boolean;
}

export interface BuildingProp {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

// --- Authoring grid --------------------------------------------------------
// Rows run z = -3 (top) .. 3 (bottom); columns run x = -3 (left) .. 3 (right).
//   . grass        t grass-trees     T grass-trees-tall
//   = road E-W     H road N-S        + intersection
//   1 2 3 4 road corners (TL TR BR BL of the ring)
//   p pavement     o pavement-fountain
//   a b c d garages g -> a building (placed on a grass tile, faces the ring)
const GRID = [
  "TabgdaT",
  "d1===2a",
  "cHpppHb",
  "bHpopHg",
  "aHtptHd",
  "d4===3a",
  "TbcgabT",
] as const;

// Corner rotations for the ring (tuned against the rendered scene).
const CORNER_R: Record<string, number> = { "1": 3, "2": 0, "3": 1, "4": 2 };

const BUILDING_IDS: Record<string, string> = {
  a: "building-small-a",
  b: "building-small-b",
  c: "building-small-c",
  d: "building-small-d",
  g: "building-garage",
};

const GRID_MIN = -3;
const GRID_MAX = 3;

// Building facing by which border it sits on (so entrances face the ring road).
function buildingRotation(x: number, z: number): number {
  if (z === GRID_MIN) return 2; // back row faces south (+z)
  if (z === GRID_MAX) return 0; // front row faces north (-z)
  if (x === GRID_MIN) return 1; // left column faces east (+x)
  if (x === GRID_MAX) return 3; // right column faces west (-x)
  return 0;
}

function decode(): { ground: GroundTile[]; buildings: BuildingProp[] } {
  const ground: GroundTile[] = [];
  const buildings: BuildingProp[] = [];

  GRID.forEach((row, rowIndex) => {
    const z = GRID_MIN + rowIndex;
    [...row].forEach((cell, colIndex) => {
      const x = GRID_MIN + colIndex;

      if (cell in BUILDING_IDS) {
        // Building cells get a grass ground tile plus the building on top.
        ground.push({ id: "grass", x, z, r: 0, casts: false });
        const buildingId = BUILDING_IDS[cell];
        if (buildingId !== undefined) {
          buildings.push({ id: buildingId, x, z, r: buildingRotation(x, z) });
        }
        return;
      }

      switch (cell) {
        case "=":
          ground.push({ id: "road-straight", x, z, r: 1, casts: false });
          break;
        case "H":
          ground.push({ id: "road-straight", x, z, r: 0, casts: false });
          break;
        case "+":
          ground.push({ id: "road-intersection", x, z, r: 0, casts: false });
          break;
        case "1":
        case "2":
        case "3":
        case "4":
          ground.push({
            id: "road-corner",
            x,
            z,
            r: CORNER_R[cell] ?? 0,
            casts: false,
          });
          break;
        case "p":
          ground.push({ id: "pavement", x, z, r: 0, casts: false });
          break;
        case "o":
          ground.push({ id: "pavement-fountain", x, z, r: 0, casts: true });
          break;
        case "t":
          ground.push({ id: "grass-trees", x, z, r: 0, casts: true });
          break;
        case "T":
          ground.push({ id: "grass-trees-tall", x, z, r: 0, casts: true });
          break;
        default:
          ground.push({ id: "grass", x, z, r: 0, casts: false });
      }
    });
  });

  return { ground, buildings };
}

const decoded = decode();
export const GROUND_TILES: readonly GroundTile[] = decoded.ground;
export const BUILDINGS: readonly BuildingProp[] = decoded.buildings;

// Half-extent of the tiled pad, used to size the sun's shadow box.
export const TOWN_HALF_EXTENT = GRID_MAX;

// --- Isometric camera rig (mirrors the city-builder view math) -------------
export const CAMERA_PITCH = Math.atan(1 / Math.SQRT2); // ≈ 35.26° downward
export const CAMERA_FOV_Y_DEGREES = 22;
// Distance from the focus point; framed so the packed town fills the view.
export const CAMERA_ZOOM = 19;
// Starting yaw; the orbit system slowly rotates around this.
export const CAMERA_START_YAW = Math.PI / 4; // 45°
// Radians/second the hero camera drifts around the town. Slow and ambient.
export const CAMERA_ORBIT_SPEED = 0.06;

/** World-space camera offset from the focus point for a given yaw and zoom. */
export function cameraOffset(
  yaw: number,
  zoom: number,
): [number, number, number] {
  const horizontal = Math.cos(CAMERA_PITCH) * zoom;
  return [
    horizontal * Math.sin(yaw),
    Math.sin(CAMERA_PITCH) * zoom,
    horizontal * Math.cos(yaw),
  ];
}
