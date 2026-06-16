// Tuning constants ported 1:1 from the reference racing kit
// (Vehicle.js, Camera.js, Physics.js, Audio.js, main.js).

import { GRID_SCALE } from "./track.js";

// ── Vehicle (Vehicle.js) ──────────────────────────────────
export const SPEED_SCALE = 12.5;
export const LINEAR_DAMP = 0.1;
export const MAX_SPEED = 1.5;
export const VEHICLE_ROOT_SCALE = 0.5; // Godot import scale for vehicle models
export const SPAWN_POS: [number, number, number] = [3.5, 0.5, 5];

// ── Physics (Physics.js, main.js) ─────────────────────────
export const GRAVITY: [number, number, number] = [0, -9.81, 0];
export const SPHERE_RADIUS = 0.5;
export const SPHERE_MASS = 1000;
export const SPHERE_FRICTION = 5.0;
export const SPHERE_RESTITUTION = 0.1;
export const SPHERE_LINEAR_DAMPING = 0.1;
export const SPHERE_ANGULAR_DAMPING = 4.0;
export const SPHERE_GRAVITY_FACTOR = 1.5;

// Wall colliders
export const WALL_HALF_THICK = 0.25;
export const WALL_X = 4.75;
export const WALL_HALF_H = 1.5;
export const WALL_FRICTION = 0.0;
export const WALL_RESTITUTION = 0.1;
export const GRID_S = GRID_SCALE;

// ── Camera (Camera.js) ────────────────────────────────────
export const CAMERA = {
  fovDeg: 40,
  near: 0.1,
  far: 60,
  // Godot View: 45° azimuth, 35° elevation, distance 16
  offset: [9.27, 9.18, 9.27] as [number, number, number],
  leadFactor: 3.0,
  smoothing: 2.0,
  deadzoneRadius: 5.0,
  screenShiftUp: 1.0,
} as const;

// ── Scene / lighting (main.js) ────────────────────────────
export const BACKGROUND_HEX = 0xadb2ba;
export const FOG_HEX = 0xadb2ba;
export const DIR_LIGHT = {
  colorHex: 0xffffff,
  intensity: 3,
  position: [11.4, 15, -5.3] as [number, number, number],
  shadowMapSize: 4096,
  shadowNear: 0.5,
  shadowFar: 60,
  shadowRadius: 4,
} as const;
export const HEMI_LIGHT = {
  skyHex: 0xc8d8e8,
  groundHex: 0x7a8a5a,
  intensity: 2,
} as const;
export const BLOOM = { strength: 0.02, radius: 0.02, threshold: 0.5 } as const;

export const BLOOM_PROBE = {
  baseColorHex: 0xffdf6b,
  emissiveFactor: [12, 8, 1.5] as [number, number, number],
  radius: 0.28,
  segments: 32,
  roughness: 0.15,
  // Partly intersects the parked player truck so the halo is easy to compare
  // against hard geometry edges in both renderers.
  position: [SPAWN_POS[0] - 0.1, 0.56, SPAWN_POS[2] - 0.15] as [
    number,
    number,
    number,
  ],
} as const;
