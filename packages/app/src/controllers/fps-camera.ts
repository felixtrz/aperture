import { LocalTransform, type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { quatLookAt } from "../systems/spawn/transforms.js";

// A reusable, ECS-authoritative pointer-lock FPS (first-person shooter) camera
// controller — the packaged form of the FPS showcase pattern. It holds the eye
// position + yaw/pitch and writes the camera's LocalTransform via the normal
// component path — it NEVER caches a renderer scene-graph node. Look is driven by
// RAW pointer-lock mouse deltas (movementX/movementY pixel deltas scaled by a
// sensitivity in radians-per-pixel), NOT a normalized 0..1 drag. Pitch is clamped
// just inside ±90° so you can never flip over the top (no gimbal flip). Movement
// is GROUND-CONSTRAINED: forward() is the horizontal projection of the look
// direction so you always walk level regardless of how far up/down you look;
// strafe rides the right axis; the separate up amount adjusts eye height. Unlike
// fly-camera (which flies along the pitched forward), this walks on the plane.
// Like the other controllers it is input-agnostic — the example wires
// pointer-lock + WASD to lookFromPointerLock()/move() — and headless/worker-safe:
// pure math + ECS writes, no DOM.

const DEFAULT_SENSITIVITY = 0.0022; // radians of look per pixel of pointer-lock movement
const POLE_EPSILON = 1e-3; // keep pitch strictly inside ±90°

export interface FpsCameraControllerOptions {
  /** The camera entity whose LocalTransform the controller writes. */
  readonly camera: EcsEntityRef;
  /** Initial eye position (world space). */
  readonly position?: readonly [number, number, number];
  /** Initial yaw (radians around world +Y; 0 looks down -Z). */
  readonly yaw?: number;
  /** Initial pitch (radians; positive looks up; clamped to ±(π/2 − ε)). */
  readonly pitch?: number;
  readonly minPitch?: number;
  readonly maxPitch?: number;
  /**
   * Radians of look per pixel of pointer-lock movement. Applied to the raw
   * `movementX`/`movementY` deltas the example forwards from a pointer-lock
   * session (NOT a normalized 0..1 drag).
   */
  readonly sensitivity?: number;
}

export interface FpsCameraController {
  readonly yaw: number;
  readonly pitch: number;
  readonly position: readonly [number, number, number];
  /** Add to yaw (unclamped, wraps naturally) + pitch (clamped). Raw radians. */
  look(deltaYaw: number, deltaPitch: number): void;
  /**
   * Map raw pointer-lock movement to a look rotation: `dx`/`dy` are the pixel
   * `movementX`/`movementY` deltas. Moving the mouse right turns right (yaw+),
   * moving it down looks down (pitch−). Scaled by `sensitivity`.
   */
  lookFromPointerLock(dx: number, dy: number): void;
  /**
   * Ground-constrained (level) forward direction from yaw alone; its Y is always
   * 0, so moving along it keeps the eye on a level plane no matter the pitch.
   */
  forward(): [number, number, number];
  /** Horizontal right direction from yaw (perpendicular to forward()). */
  right(): [number, number, number];
  /** The full pitched look direction the camera is oriented along. */
  lookDirection(): [number, number, number];
  /**
   * Walk the eye: `forwardAmount` along the level forward(), `rightAmount` along
   * right(), `upAmount` along world +Y (eye height / crouch / jump).
   */
  move(forwardAmount: number, rightAmount: number, upAmount: number): void;
  /**
   * Write the camera's LocalTransform (translation = eye, rotation looks along
   * lookDirection()). Returns false if the camera ref no longer resolves.
   */
  applyTo(world: EcsWorld): boolean;
}

export function createFpsCameraController(
  options: FpsCameraControllerOptions,
): FpsCameraController {
  const cameraRef = options.camera;
  const position: [number, number, number] = [
    options.position?.[0] ?? 0,
    options.position?.[1] ?? 0,
    options.position?.[2] ?? 0,
  ];
  const sensitivity = options.sensitivity ?? DEFAULT_SENSITIVITY;
  const poleLimit = Math.PI / 2 - POLE_EPSILON;
  const minPitch = clamp(options.minPitch ?? -poleLimit, -poleLimit, poleLimit);
  const maxPitch = clamp(options.maxPitch ?? poleLimit, -poleLimit, poleLimit);

  let yaw = options.yaw ?? 0;
  let pitch = clamp(options.pitch ?? 0, minPitch, maxPitch);

  // Level (ground-projected) forward — the horizontal heading. Y is always 0.
  const forward = (): [number, number, number] => [
    Math.sin(yaw),
    0,
    -Math.cos(yaw),
  ];
  const right = (): [number, number, number] => [
    Math.cos(yaw),
    0,
    Math.sin(yaw),
  ];
  // The pitched look direction the camera actually faces.
  const lookDirection = (): [number, number, number] => {
    const cosPitch = Math.cos(pitch);
    return [
      cosPitch * Math.sin(yaw),
      Math.sin(pitch),
      -cosPitch * Math.cos(yaw),
    ];
  };

  return {
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get position() {
      return position;
    },
    look(deltaYaw, deltaPitch) {
      yaw += deltaYaw;
      pitch = clamp(pitch + deltaPitch, minPitch, maxPitch);
    },
    lookFromPointerLock(dx, dy) {
      yaw += dx * sensitivity;
      pitch = clamp(pitch - dy * sensitivity, minPitch, maxPitch);
    },
    forward,
    right,
    lookDirection,
    move(forwardAmount, rightAmount, upAmount) {
      const f = forward();
      const r = right();
      position[0] += f[0] * forwardAmount + r[0] * rightAmount;
      position[1] += upAmount;
      position[2] += f[2] * forwardAmount + r[2] * rightAmount;
    },
    applyTo(world) {
      const resolved = resolveActiveEntity(world, cameraRef);
      if (!resolved.ok) {
        return false;
      }
      const entity = resolved.entity;
      const look = lookDirection();
      const target: [number, number, number] = [
        position[0] + look[0],
        position[1] + look[1],
        position[2] + look[2],
      ];
      const rotation: [number, number, number, number] = [
        ...quatLookAt(position, target),
      ];
      if (entity.hasComponent(LocalTransform)) {
        entity.getVectorView(LocalTransform, "translation").set(position);
        entity.getVectorView(LocalTransform, "rotation").set(rotation);
      } else {
        entity.addComponent(LocalTransform, {
          translation: position,
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
