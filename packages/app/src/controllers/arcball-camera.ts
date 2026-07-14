import {
  LocalTransform,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  rotateVec3ByQuat,
  type EcsWorld,
  type QuatTuple,
} from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { quatLookAt } from "../systems/spawn/transforms.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";

// A reusable, ECS-authoritative arcball camera controller — a Shoemake virtual
// trackball with full 3-DOF rotation (unlike the orbit controller's 2-DOF
// azimuth/elevation, the arcball can also roll). It orbits a target at a
// distance and writes the camera's LocalTransform via the normal component path —
// it NEVER caches a renderer scene-graph node. Two normalized pointer positions
// ([-1,1] screen coords) are projected onto a virtual unit sphere (Shoemake:
// inside the disc → the near hemisphere, outside → the silhouette circle); the
// rotation that carries the first sphere point to the second is accumulated onto
// the orientation quaternion, so the eye offset [0,0,distance] is rotated by the
// running orientation. The wheel zooms (dolly the eye toward/away). Quaternion
// math comes from @aperture-engine/math (re-exported by simulation) rather than
// being reimplemented here. Input-agnostic (the example wires the pointer/wheel)
// and headless/worker-safe: pure math + ECS writes, no DOM.

const DEFAULT_ZOOM_SPEED = 1; // distance units per 1.0 of wheel travel
const IDENTITY: QuatTuple = [0, 0, 0, 1];

export interface ArcballCameraControllerOptions {
  /** The camera entity whose LocalTransform the controller writes. */
  readonly camera: EcsEntityRef;
  /** World-space point the camera orbits and looks at. */
  readonly target?: readonly [number, number, number];
  readonly distance?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  /** Initial orientation quaternion [x, y, z, w]; defaults to identity. */
  readonly orientation?: readonly [number, number, number, number];
  /** Distance change per 1.0 of wheel travel. */
  readonly zoomSpeed?: number;
}

export interface ArcballCameraController {
  readonly orientation: QuatTuple;
  readonly distance: number;
  readonly target: readonly [number, number, number];
  /**
   * Rotate from one normalized pointer position to another (each in [-1,1]
   * screen coords, origin at center). Accumulates the trackball rotation that
   * carries the first virtual-sphere point onto the second.
   */
  rotateFromDrag(fromX: number, fromY: number, toX: number, toY: number): void;
  /** Remember the drag anchor for a subsequent dragTo() (continuous drag). */
  beginDrag(x: number, y: number): void;
  /** Rotate from the last beginDrag()/dragTo() anchor to (x, y) and re-anchor. */
  dragTo(x: number, y: number): void;
  /** Map a wheel delta to a zoom (positive delta = zoom out / increase distance). */
  zoomFromWheel(delta: number): void;
  /** The camera eye position implied by the current orientation + distance. */
  eyePosition(): [number, number, number];
  /**
   * Write the camera's LocalTransform (translation = eye, rotation = look-at the
   * target). Returns false if the camera ref no longer resolves.
   */
  applyTo(world: EcsWorld): boolean;
}

export function createArcballCameraController(
  options: ArcballCameraControllerOptions,
): ArcballCameraController {
  const cameraRef = options.camera;
  const target: [number, number, number] = [
    options.target?.[0] ?? 0,
    options.target?.[1] ?? 0,
    options.target?.[2] ?? 0,
  ];
  const zoomSpeed = options.zoomSpeed ?? DEFAULT_ZOOM_SPEED;
  const minDistance = options.minDistance ?? 0.01;
  const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;

  let distance = clamp(options.distance ?? 5, minDistance, maxDistance);
  let orientation: QuatTuple = options.orientation
    ? [
        options.orientation[0],
        options.orientation[1],
        options.orientation[2],
        options.orientation[3],
      ]
    : [...IDENTITY];
  let anchorX = 0;
  let anchorY = 0;

  const eyePosition = (): [number, number, number] => {
    const offset = rotateVec3ByQuat([0, 0, distance], orientation);
    return [
      target[0] + (offset[0] ?? 0),
      target[1] + (offset[1] ?? 0),
      target[2] + (offset[2] ?? 0),
    ];
  };

  const rotateFromDrag = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void => {
    const a = mapToSphere(fromX, fromY);
    const b = mapToSphere(toX, toY);
    const axis: [number, number, number] = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const cos = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
    const angle = Math.acos(cos);
    // quatFromAxisAngle normalizes the axis and returns identity for a
    // near-zero axis (no drag / antipodal), so a no-op drag leaves us unchanged.
    const delta = quatFromAxisAngle(axis, angle);
    const composed = quatNormalize(quatMultiply(delta, orientation));
    orientation = [
      composed[0] ?? 0,
      composed[1] ?? 0,
      composed[2] ?? 0,
      composed[3] ?? 1,
    ];
  };

  return {
    get orientation() {
      return [...orientation] as QuatTuple;
    },
    get distance() {
      return distance;
    },
    get target() {
      return target;
    },
    rotateFromDrag,
    beginDrag(x, y) {
      anchorX = x;
      anchorY = y;
    },
    dragTo(x, y) {
      rotateFromDrag(anchorX, anchorY, x, y);
      anchorX = x;
      anchorY = y;
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

/**
 * Shoemake virtual-trackball projection: a normalized pointer position (x, y) in
 * [-1,1] maps to a point on the unit sphere. Inside the unit disc it lifts onto
 * the near hemisphere (z = √(1 − r²)); outside it clamps onto the silhouette
 * circle (z = 0) so far-off drags still rotate about the view axis (roll).
 */
function mapToSphere(x: number, y: number): [number, number, number] {
  const d2 = x * x + y * y;
  if (d2 <= 1) {
    return [x, y, Math.sqrt(1 - d2)];
  }
  const inv = 1 / Math.sqrt(d2);
  return [x * inv, y * inv, 0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
