import { LocalTransform, type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { quatLookAt } from "../systems/spawn/transforms.js";

// A reusable, ECS-authoritative fly / first-person camera controller. It holds
// the eye position + yaw/pitch and writes the camera's LocalTransform via the
// normal component path — it NEVER caches a renderer scene-graph node. Pointer
// drag maps to yaw/pitch; move() translates along the view basis (forward is the
// full pitched direction, so flying; pass 0 to the vertical term for FPS-style
// horizontal strafing combined with a level forward). Pitch is clamped just
// inside the poles so the look basis never degenerates. Like the orbit
// controller this is input-agnostic — the app wires WASD/pointer to move/look —
// and headless/worker-safe: pure math + ECS writes, no DOM.

const DEFAULT_LOOK_SPEED = Math.PI; // radians per 1.0 of normalized pointer travel
const POLE_EPSILON = 1e-3; // keep pitch strictly inside ±90°

export interface FlyCameraControllerOptions {
  /** The camera entity whose LocalTransform the controller writes. */
  readonly camera: EcsEntityRef;
  readonly position?: readonly [number, number, number];
  /** Initial yaw (radians around world +Y; 0 looks down -Z). */
  readonly yaw?: number;
  /** Initial pitch (radians; positive looks up; clamped to ±(π/2 − ε)). */
  readonly pitch?: number;
  readonly minPitch?: number;
  readonly maxPitch?: number;
  /** Radians of look per 1.0 of normalized pointer travel. */
  readonly lookSpeed?: number;
}

export interface FlyCameraController {
  readonly yaw: number;
  readonly pitch: number;
  readonly position: readonly [number, number, number];
  /** Add to yaw (unclamped, wraps naturally) + pitch (clamped). */
  look(deltaYaw: number, deltaPitch: number): void;
  /** Map a normalized pointer drag delta to a look rotation (drag up looks up). */
  lookFromDrag(deltaX: number, deltaY: number): void;
  /** Unit forward direction implied by the current yaw/pitch. */
  forward(): [number, number, number];
  /** Unit rightward direction (horizontal, perpendicular to forward). */
  right(): [number, number, number];
  /**
   * Translate the eye: `forwardAmount` along forward() (pitched), `rightAmount`
   * along right(), `upAmount` along world +Y.
   */
  move(forwardAmount: number, rightAmount: number, upAmount: number): void;
  /**
   * Write the camera's LocalTransform (translation = eye, rotation looks along
   * forward()). Returns false if the camera ref no longer resolves.
   */
  applyTo(world: EcsWorld): boolean;
}

export function createFlyCameraController(
  options: FlyCameraControllerOptions,
): FlyCameraController {
  const cameraRef = options.camera;
  const position: [number, number, number] = [
    options.position?.[0] ?? 0,
    options.position?.[1] ?? 0,
    options.position?.[2] ?? 0,
  ];
  const lookSpeed = options.lookSpeed ?? DEFAULT_LOOK_SPEED;
  const poleLimit = Math.PI / 2 - POLE_EPSILON;
  const minPitch = clamp(options.minPitch ?? -poleLimit, -poleLimit, poleLimit);
  const maxPitch = clamp(options.maxPitch ?? poleLimit, -poleLimit, poleLimit);

  let yaw = options.yaw ?? 0;
  let pitch = clamp(options.pitch ?? 0, minPitch, maxPitch);

  const forward = (): [number, number, number] => {
    const cosPitch = Math.cos(pitch);
    return [
      cosPitch * Math.sin(yaw),
      Math.sin(pitch),
      -cosPitch * Math.cos(yaw),
    ];
  };
  const right = (): [number, number, number] => [
    Math.cos(yaw),
    0,
    Math.sin(yaw),
  ];

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
    lookFromDrag(deltaX, deltaY) {
      yaw += deltaX * lookSpeed;
      pitch = clamp(pitch - deltaY * lookSpeed, minPitch, maxPitch);
    },
    forward,
    right,
    move(forwardAmount, rightAmount, upAmount) {
      const f = forward();
      const r = right();
      position[0] += f[0] * forwardAmount + r[0] * rightAmount;
      position[1] += f[1] * forwardAmount + upAmount;
      position[2] += f[2] * forwardAmount + r[2] * rightAmount;
    },
    applyTo(world) {
      const resolved = resolveActiveEntity(world, cameraRef);
      if (!resolved.ok) {
        return false;
      }
      const entity = resolved.entity;
      const f = forward();
      const target: [number, number, number] = [
        position[0] + f[0],
        position[1] + f[1],
        position[2] + f[2],
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
