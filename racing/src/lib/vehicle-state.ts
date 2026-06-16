// Shared, mutable vehicle state for intra-worker cross-system reads (camera,
// particles, drift marks, audio, lap timer). All systems run in the same
// simulation worker, so a module singleton is the simplest faithful analogue of
// the reference passing its `vehicle` object to each subsystem.

import type { Vec3Tuple as Vec3 } from "@aperture-engine/simulation";

export interface VehicleState {
  ready: boolean;
  /** Physics sphere center (world). */
  sphere: Vec3;
  /** Visual container origin (sphere with y - 0.5). */
  container: Vec3;
  yaw: number;
  forward: Vec3;
  linearSpeed: number;
  modelVelocity: Vec3;
  driftIntensity: number;
  /** Forward throttle input this frame (Controls.z). */
  throttle: number;
  /** Whether the player has supplied any input yet (lap timer start gate). */
  hadInput: boolean;
  /** Back-wheel world positions for smoke / drift trails (null until resolved). */
  wheelBL: Vec3 | null;
  wheelBR: Vec3 | null;
}

export const vehicleState: VehicleState = {
  ready: false,
  sphere: [3.5, 0.5, 5],
  container: [3.5, 0, 5],
  yaw: 0,
  forward: [0, 0, 1],
  linearSpeed: 0,
  modelVelocity: [0, 0, 0],
  driftIntensity: 0,
  throttle: 0,
  hadInput: false,
  wheelBL: null,
  wheelBR: null,
};
