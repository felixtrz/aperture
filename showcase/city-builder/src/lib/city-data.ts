// Shared, simulation-pure data for the city-builder port of Kenney's
// Starter-Kit-City-Builder. Kept browser/WebGPU-free so it can run inside the
// generated simulation worker. Mirrors scripts/builder.gd + view.gd from the
// reference Godot project.

export interface StructureSpec {
  /** Asset id (matches the GLB model name registered in aperture.config.ts). */
  readonly id: string;
  /** Display name shown in the HUD. */
  readonly name: string;
  /** Price deducted from cash when first placing this structure on a cell. */
  readonly price: number;
}

// Order mirrors the `structures` array on the Builder node in
// scenes/main.tscn, so Q/E cycle through them in the same order as the source.
export const STRUCTURES: readonly StructureSpec[] = [
  { id: "road-straight", name: "Road", price: 25 },
  { id: "road-straight-lightposts", name: "Road · Lights", price: 25 },
  { id: "road-corner", name: "Road · Corner", price: 25 },
  { id: "road-split", name: "Road · Split", price: 25 },
  { id: "road-intersection", name: "Road · Cross", price: 25 },
  { id: "pavement", name: "Pavement", price: 10 },
  { id: "pavement-fountain", name: "Fountain", price: 10 },
  { id: "building-small-a", name: "House A", price: 50 },
  { id: "building-small-b", name: "House B", price: 60 },
  { id: "building-small-c", name: "House C", price: 70 },
  { id: "building-small-d", name: "House D", price: 70 },
  { id: "building-garage", name: "Garage", price: 70 },
  { id: "grass", name: "Grass", price: 10 },
  { id: "grass-trees", name: "Trees", price: 25 },
  { id: "grass-trees-tall", name: "Tall Trees", price: 25 },
];

// data_map.gd: @export var cash:int = 10000
export const STARTING_CASH = 10000;

// Grid is unit-spaced (GridMap cell_size = Vector3(1,1,1)). Tiles are authored
// 1x1 in XZ, centered on origin with their base at y=0, so placing a tile root
// at an integer (x, 0, z) tiles seamlessly. We bound the buildable area so the
// pointer ray onto the ground plane always lands on the finite ground mesh.
export const GRID_HALF_EXTENT = 24;

// --- Browser -> simulation command channels --------------------------------
// Pointer position, build, and rotate are routed through a command channel
// (rather than generated input actions) because they need canvas-relative
// coordinates and contextmenu/​drag suppression that only the HUD can do.
export const CITY_BUILD_CHANNEL = "citybuilder.build";
export const CITY_CAMERA_CHANNEL = "citybuilder.camera";

export type CityBuildCommand =
  | { readonly kind: "pointer"; readonly x: number; readonly y: number }
  | { readonly kind: "build" }
  | { readonly kind: "rotate" };

export type CityCameraCommand =
  | { readonly kind: "zoom"; readonly delta: number }
  | { readonly kind: "yaw"; readonly delta: number };

// --- Camera rig (scenes/main.tscn View + scripts/view.gd) -------------------
// View.gd orbits a focus point on the ground; the camera child sits back along
// the rig's local +Z by `zoom` metres while looking at the focus. The authored
// View basis is a 45° yaw, ~35.26° downward isometric tilt.
export const CAMERA_PITCH = Math.atan(1 / Math.SQRT2); // ≈ 0.6155 rad (35.26°)
export const CAMERA_DEFAULT_YAW = Math.PI / 4; // 45°
export const CAMERA_DEFAULT_ZOOM = 30; // view.gd: zoom = 30.0 (standard)
export const CAMERA_MIN_ZOOM = 15; // view.gd: min 15
export const CAMERA_MAX_ZOOM = 80; // view.gd: max 80
export const CAMERA_ZOOM_STEP = 5; // view.gd: ±5 per wheel notch
export const CAMERA_FOV_Y_DEGREES = 20; // Camera3D.fov = 20.0
export const CAMERA_PAN_SPEED = 15; // view.gd: input/4 per frame ≈ 15 u/s @60fps
export const CAMERA_POSITION_LERP = 8; // view.gd: position lerp delta*8
export const CAMERA_ROTATION_LERP = 6; // view.gd: rotation lerp delta*6
export const CAMERA_ZOOM_LERP = 8; // view.gd: camera local lerp delta*8
export const CAMERA_YAW_RADIANS_PER_PIXEL = 1 / 10; // view.gd: relative.x / 10
export const SELECTOR_LERP = 40; // builder.gd: lerp(..., min(delta*40, 1))

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

/** Round a world coordinate to the nearest grid cell, clamped to the board. */
export function snapToGrid(value: number): number {
  return Math.max(
    -GRID_HALF_EXTENT,
    Math.min(GRID_HALF_EXTENT, Math.round(value)),
  );
}

export function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, alpha));
}
