// The hero town layout. This is a city authored in the city-builder showcase
// app and exported to the city-config schema
// (https://aperture-engine.dev/schemas/city-builder/city.schema.json), then
// inlined here so the hero scene reproduces it exactly.
//
// Each tile is a unit (1x1) Kenney structure placed at world (x, 0, z) and
// rotated `orientation` quarter-turns about Y — the same math city-builder uses,
// so the rendered town matches what was authored. The authored grid is recentered
// on the origin here so the orbit camera, sky dome, and shadow box stay centered.

export interface CityTile {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly orientation: number;
  readonly name?: string;
}

export interface CityConfig {
  readonly version?: number;
  readonly cash?: number;
  readonly tiles: readonly CityTile[];
}

export const CITY: CityConfig = {
  version: 1,
  cash: 9140,
  tiles: [
    { id: "grass-trees-tall", x: -1, z: -3, orientation: 2 },
    { id: "grass-trees-tall", x: 0, z: -3, orientation: 1 },
    { id: "building-small-b", x: 1, z: -3, orientation: 0 },
    { id: "building-small-a", x: -1, z: -2, orientation: 1 },
    { id: "road-corner", x: 0, z: -2, orientation: 1 },
    { id: "road-straight-lightposts", x: 1, z: -2, orientation: 1 },
    { id: "road-corner", x: 2, z: -2, orientation: 0 },
    { id: "building-small-d", x: -1, z: -1, orientation: 1 },
    { id: "road-straight-lightposts", x: 0, z: -1, orientation: 0 },
    { id: "pavement-fountain", x: 1, z: -1, orientation: 1 },
    { id: "road-straight-lightposts", x: 2, z: -1, orientation: 0 },
    { id: "building-garage", x: 3, z: -1, orientation: 0 },
    { id: "road-straight-lightposts", x: -1, z: 0, orientation: 3 },
    { id: "road-split", x: 0, z: 0, orientation: 3 },
    { id: "grass-trees", x: 1, z: 0, orientation: 2 },
    { id: "road-corner", x: 2, z: 0, orientation: 2 },
    { id: "road-straight", x: 3, z: 0, orientation: 3 },
    { id: "building-small-c", x: -1, z: 1, orientation: 1 },
    { id: "road-straight", x: 0, z: 1, orientation: 0 },
    { id: "grass-trees-tall", x: 1, z: 1, orientation: 0 },
    { id: "grass-trees-tall", x: 2, z: 1, orientation: 2 },
  ],
};

export interface PlacedTile {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly orientation: number;
}

function recenter(config: CityConfig): {
  readonly tiles: readonly PlacedTile[];
  readonly halfExtent: number;
} {
  const xs = config.tiles.map((t) => t.x);
  const zs = config.tiles.map((t) => t.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const tiles = config.tiles.map((t) => ({
    id: t.id,
    x: t.x - cx,
    z: t.z - cz,
    orientation: t.orientation,
  }));
  // Half-extent of the tiled footprint (+0.5 for tile width), to size the
  // shadow box and camera framing.
  const halfExtent = Math.max(maxX - minX, maxZ - minZ) / 2 + 0.5;
  return { tiles, halfExtent };
}

const placed = recenter(CITY);
export const TILES: readonly PlacedTile[] = placed.tiles;
export const CITY_HALF_EXTENT = placed.halfExtent;

// Tiles with raised geometry cast shadows; flat ground (roads/pavement/grass)
// only receives them.
export function tileCastsShadow(id: string): boolean {
  return (
    id.startsWith("building-") ||
    id.includes("trees") ||
    id === "pavement-fountain" ||
    id === "road-straight-lightposts"
  );
}

// --- Isometric camera rig (mirrors the city-builder view math) -------------
export const CAMERA_PITCH = Math.atan(1 / Math.SQRT2); // ≈ 35.26° downward
export const CAMERA_FOV_Y_DEGREES = 22;
// Distance from the focus point; framed for this compact city.
export const CAMERA_ZOOM = 16;
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
