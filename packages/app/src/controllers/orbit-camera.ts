import { LocalTransform, type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { quatLookAt } from "../systems/spawn/transforms.js";

// M7-T9: a reusable, ECS-authoritative orbit camera controller. It holds the
// orbit state (target + azimuth/elevation/distance in spherical coordinates) and
// writes the camera's LocalTransform each frame via the normal component path —
// it NEVER caches a renderer scene-graph node (no public mutable scene graph).
// Pointer drag maps to azimuth/elevation; wheel maps to distance. Elevation is
// clamped just inside the poles so the look-at basis never degenerates (gimbal
// flip when the camera looks straight down the world-up axis). Headless/worker-
// safe: pure math + ECS writes, no DOM.

const DEFAULT_ROTATE_SPEED = Math.PI; // radians per 1.0 of normalized pointer travel
const DEFAULT_ZOOM_SPEED = 1; // distance units per 1.0 of wheel travel
const POLE_EPSILON = 1e-3; // keep elevation strictly inside ±90°

export interface OrbitCameraControllerOptions {
  /** The camera entity whose LocalTransform the controller writes. */
  readonly camera: EcsEntityRef;
  /** World-space point the camera orbits and looks at. */
  readonly target?: readonly [number, number, number];
  readonly distance?: number;
  /** Initial azimuth (radians, around world +Y; 0 places the camera on +Z). */
  readonly azimuth?: number;
  /** Initial elevation (radians above the horizon; clamped to ±(π/2 − ε)). */
  readonly elevation?: number;
  readonly minElevation?: number;
  readonly maxElevation?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  /** Radians of orbit per 1.0 of normalized pointer travel. */
  readonly rotateSpeed?: number;
  /** Distance change per 1.0 of wheel travel. */
  readonly zoomSpeed?: number;
}

export interface OrbitCameraController {
  readonly azimuth: number;
  readonly elevation: number;
  readonly distance: number;
  readonly target: readonly [number, number, number];
  /** Add to azimuth (unclamped, wraps naturally) + elevation (clamped). */
  rotate(deltaAzimuth: number, deltaElevation: number): void;
  /** Add to the orbit distance, clamped to [minDistance, maxDistance]. */
  zoom(deltaDistance: number): void;
  /** Map a normalized pointer drag delta to an orbit rotation. */
  orbitFromDrag(deltaX: number, deltaY: number): void;
  /** Map a wheel delta to a zoom (positive delta = zoom out / increase distance). */
  zoomFromWheel(delta: number): void;
  /** The camera eye position implied by the current orbit state. */
  eyePosition(): [number, number, number];
  /**
   * Write the camera's LocalTransform (translation = eye, rotation = look-at the
   * target). Returns false if the camera ref no longer resolves (destroyed/stale).
   */
  applyTo(world: EcsWorld): boolean;
}

export function createOrbitCameraController(
  options: OrbitCameraControllerOptions,
): OrbitCameraController {
  const cameraRef = options.camera;
  const target: [number, number, number] = [
    options.target?.[0] ?? 0,
    options.target?.[1] ?? 0,
    options.target?.[2] ?? 0,
  ];
  const rotateSpeed = options.rotateSpeed ?? DEFAULT_ROTATE_SPEED;
  const zoomSpeed = options.zoomSpeed ?? DEFAULT_ZOOM_SPEED;
  // Clamp the elevation bounds (caller-supplied OR default) strictly inside the
  // poles so the look-at basis never degenerates — a caller passing exactly ±π/2
  // would otherwise place the eye on the target's vertical axis (gimbal flip).
  const poleLimit = Math.PI / 2 - POLE_EPSILON;
  const minElevation = clamp(
    options.minElevation ?? -poleLimit,
    -poleLimit,
    poleLimit,
  );
  const maxElevation = clamp(
    options.maxElevation ?? poleLimit,
    -poleLimit,
    poleLimit,
  );
  const minDistance = options.minDistance ?? 0.01;
  const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;

  let azimuth = options.azimuth ?? 0;
  let elevation = clamp(options.elevation ?? 0, minElevation, maxElevation);
  let distance = clamp(options.distance ?? 5, minDistance, maxDistance);

  const eyePosition = (): [number, number, number] => {
    const cosEl = Math.cos(elevation);
    const sinEl = Math.sin(elevation);
    const sinAz = Math.sin(azimuth);
    const cosAz = Math.cos(azimuth);
    return [
      target[0] + distance * cosEl * sinAz,
      target[1] + distance * sinEl,
      target[2] + distance * cosEl * cosAz,
    ];
  };

  return {
    get azimuth() {
      return azimuth;
    },
    get elevation() {
      return elevation;
    },
    get distance() {
      return distance;
    },
    get target() {
      return target;
    },
    rotate(deltaAzimuth, deltaElevation) {
      azimuth += deltaAzimuth;
      elevation = clamp(elevation + deltaElevation, minElevation, maxElevation);
    },
    zoom(deltaDistance) {
      distance = clamp(distance + deltaDistance, minDistance, maxDistance);
    },
    orbitFromDrag(deltaX, deltaY) {
      azimuth += deltaX * rotateSpeed;
      elevation = clamp(
        elevation - deltaY * rotateSpeed,
        minElevation,
        maxElevation,
      );
    },
    zoomFromWheel(delta) {
      distance = clamp(distance + delta * zoomSpeed, minDistance, maxDistance);
    },
    eyePosition,
    applyTo(world) {
      const resolved = resolveActiveEntity(world, cameraRef);
      if (!resolved.ok) {
        return false;
      }
      const entity = resolved.entity;
      const eye = eyePosition();
      const rotation: [number, number, number, number] = [
        ...quatLookAt(eye, target),
      ];
      if (entity.hasComponent(LocalTransform)) {
        entity.getVectorView(LocalTransform, "translation").set(eye);
        entity.getVectorView(LocalTransform, "rotation").set(rotation);
      } else {
        entity.addComponent(LocalTransform, {
          translation: eye,
          rotation,
          scale: [1, 1, 1],
        });
      }
      return true;
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
