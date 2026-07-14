import { LocalTransform, type EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { quatLookAt } from "../systems/spawn/transforms.js";

// A reusable, ECS-authoritative pan/map camera controller — the oblique/top-down
// "MapControls" analog. It holds a ground target the camera looks at plus a fixed
// pitch (angle above the ground plane), heading (yaw around +Y) and distance, and
// writes the camera's LocalTransform via the normal component path — it NEVER
// caches a renderer scene-graph node. A pointer drag PANS the target across the
// ground (XZ) plane: screen-space drag deltas map to world translation along the
// camera's ground-projected right/forward axes, scaled by the current distance so
// the grabbed point stays roughly under the cursor at the configured pitch/height
// (grab-drag: drag right → world slides right). The wheel DOLLIES the eye toward
// or away from the target (changing distance, and therefore height); heading can
// optionally be rotated. Pitch is clamped strictly inside the poles so the
// top-down look-at basis never degenerates. Input-agnostic (the example wires
// pointer drag + wheel) and headless/worker-safe: pure math + ECS writes, no DOM.

const DEFAULT_PITCH = Math.PI / 4; // 45° oblique by default
const DEFAULT_PAN_SPEED = 1; // world units per unit-of-drag per unit-of-distance
const DEFAULT_ZOOM_SPEED = 1; // distance units per 1.0 of wheel travel
const POLE_EPSILON = 1e-3; // keep pitch strictly inside (0, π/2]

export interface MapCameraControllerOptions {
  /** The camera entity whose LocalTransform the controller writes. */
  readonly camera: EcsEntityRef;
  /** Ground point the camera looks at and pans across (world space). */
  readonly target?: readonly [number, number, number];
  /** Eye-to-target distance. */
  readonly distance?: number;
  /** Angle above the ground plane (radians; π/2 = straight down). */
  readonly pitch?: number;
  /** Heading (radians around world +Y; 0 places the eye toward +Z). */
  readonly heading?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly minPitch?: number;
  readonly maxPitch?: number;
  /** World units panned per unit of drag delta per unit of distance. */
  readonly panSpeed?: number;
  /** Distance change per 1.0 of wheel travel. */
  readonly zoomSpeed?: number;
}

export interface MapCameraController {
  readonly target: readonly [number, number, number];
  readonly distance: number;
  readonly pitch: number;
  readonly heading: number;
  /**
   * Pan the target across the ground (XZ) plane from a pointer drag. `dx`/`dy`
   * are screen-space drag deltas; the world slides with the cursor (grab-drag),
   * scaled by the current distance so the grab point tracks the pointer at the
   * configured pitch/height.
   */
  panFromDrag(dx: number, dy: number): void;
  /** Dolly the eye toward/away (positive delta = zoom out / increase distance). */
  zoomFromWheel(delta: number): void;
  /** Rotate the heading (radians around world +Y). */
  rotate(deltaHeading: number): void;
  /** The camera eye position implied by the current target/pitch/distance/heading. */
  eyePosition(): [number, number, number];
  /**
   * Write the camera's LocalTransform (translation = eye, rotation = look-at the
   * panned target). Returns false if the camera ref no longer resolves.
   */
  applyTo(world: EcsWorld): boolean;
}

export function createMapCameraController(
  options: MapCameraControllerOptions,
): MapCameraController {
  const cameraRef = options.camera;
  const target: [number, number, number] = [
    options.target?.[0] ?? 0,
    options.target?.[1] ?? 0,
    options.target?.[2] ?? 0,
  ];
  const panSpeed = options.panSpeed ?? DEFAULT_PAN_SPEED;
  const zoomSpeed = options.zoomSpeed ?? DEFAULT_ZOOM_SPEED;
  // Pitch stays strictly inside (0, π/2]: above 0 keeps the eye off the ground,
  // just inside π/2 keeps the straight-down look-at basis non-degenerate.
  const pitchMax = Math.PI / 2 - POLE_EPSILON;
  const pitchMin = POLE_EPSILON;
  const minPitch = clamp(options.minPitch ?? pitchMin, pitchMin, pitchMax);
  const maxPitch = clamp(options.maxPitch ?? pitchMax, pitchMin, pitchMax);
  const minDistance = options.minDistance ?? 0.01;
  const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;

  let distance = clamp(options.distance ?? 10, minDistance, maxDistance);
  const pitch = clamp(options.pitch ?? DEFAULT_PITCH, minPitch, maxPitch);
  let heading = options.heading ?? 0;

  // Ground-projected camera basis from the heading: forward is where the camera
  // faces on the plane, right is 90° clockwise from it (both level, unit length).
  const groundForward = (): [number, number] => [
    -Math.sin(heading),
    -Math.cos(heading),
  ];
  const groundRight = (): [number, number] => [
    Math.cos(heading),
    -Math.sin(heading),
  ];

  const eyePosition = (): [number, number, number] => {
    const cosPitch = Math.cos(pitch);
    return [
      target[0] + distance * cosPitch * Math.sin(heading),
      target[1] + distance * Math.sin(pitch),
      target[2] + distance * cosPitch * Math.cos(heading),
    ];
  };

  return {
    get target() {
      return target;
    },
    get distance() {
      return distance;
    },
    get pitch() {
      return pitch;
    },
    get heading() {
      return heading;
    },
    panFromDrag(dx, dy) {
      const scale = panSpeed * distance;
      const r = groundRight();
      const f = groundForward();
      // Grab-drag: the world slides with the cursor, so the target moves the
      // opposite way along each ground axis.
      target[0] -= (r[0] * dx + f[0] * dy) * scale;
      target[2] -= (r[1] * dx + f[1] * dy) * scale;
    },
    zoomFromWheel(delta) {
      distance = clamp(distance + delta * zoomSpeed, minDistance, maxDistance);
    },
    rotate(deltaHeading) {
      heading += deltaHeading;
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
