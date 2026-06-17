import {
  LocalTransform,
  expSmoothingAlpha,
  lerp,
  vec3Dot,
  vec3Normalize,
  type Entity,
  type QuatTuple,
  type Vec3Like,
  type Vec3Tuple,
} from "@aperture-engine/simulation";
import { RenderInterpolation } from "../systems/components.js";
import { quatLookAt } from "../systems/spawn/transforms.js";

export interface FollowCameraControllerOptions {
  /**
   * World-space offset from the computed look point to the camera eye.
   *
   * The default ground-plane follow basis is derived from this offset:
   * right = normalize([offset.z, 0, -offset.x]) and
   * forward = normalize([-offset.x, 0, -offset.z]).
   */
  readonly offset: Vec3Like;
  /** Initial smoothed target point. Defaults to [0, 0, 0]. */
  readonly initialTarget?: Vec3Like;
  /** Optional explicit deadzone/lead right axis. Defaults to the offset basis. */
  readonly rightAxis?: Vec3Like;
  /** Optional explicit deadzone/lead forward axis. Defaults to the offset basis. */
  readonly forwardAxis?: Vec3Like;
  /** Multiplier applied to lead velocity projected onto the follow basis. */
  readonly leadFactor?: number;
  /** Radius of the screen-space deadzone in world units. */
  readonly deadzoneRadius?: number;
  /**
   * Exponential smoothing rate. Values <= 0 mean instant follow after the first
   * update; positive values use expSmoothingAlpha(delta, smoothing).
   */
  readonly smoothing?: number;
  /** Shift the look point opposite the follow forward axis. */
  readonly screenShiftUp?: number;
  /** Add RenderInterpolation to the camera entity when writing. Defaults true. */
  readonly enableRenderInterpolation?: boolean;
}

export interface FollowCameraUpdateInput {
  readonly delta: number;
  readonly target: Vec3Like;
  /**
   * World-space velocity used only for camera lead. Apps can choose whether this
   * is physical velocity, facing-direction speed, input intent, or zero.
   */
  readonly leadVelocity?: Vec3Like;
}

export interface FollowCameraPose {
  readonly target: Vec3Tuple;
  readonly desiredTarget: Vec3Tuple;
  readonly smoothedTarget: Vec3Tuple;
  readonly lookPoint: Vec3Tuple;
  readonly eye: Vec3Tuple;
  readonly rotation: QuatTuple;
  readonly lead: readonly [number, number];
}

export interface FollowCameraController {
  readonly smoothedTarget: Vec3Tuple;
  readonly rightAxis: Vec3Tuple;
  readonly forwardAxis: Vec3Tuple;
  reset(target?: Vec3Like): void;
  update(input: FollowCameraUpdateInput): FollowCameraPose;
  writeTo(camera: Entity, input: FollowCameraUpdateInput): FollowCameraPose;
}

export function createFollowCameraController(
  options: FollowCameraControllerOptions,
): FollowCameraController {
  const offset = readVec3(options.offset);
  const basis = createFollowBasis(options);
  const leadFactor = options.leadFactor ?? 0;
  const deadzoneRadius = Math.max(0, options.deadzoneRadius ?? 0);
  const smoothing = Math.max(0, options.smoothing ?? 0);
  const screenShiftUp = options.screenShiftUp ?? 0;
  const enableRenderInterpolation = options.enableRenderInterpolation ?? true;
  let smoothedTarget = readVec3(options.initialTarget ?? [0, 0, 0]);
  let initialized = false;

  const update = (input: FollowCameraUpdateInput): FollowCameraPose => {
    const target = readVec3(input.target);
    const leadVelocity = readVec3(input.leadVelocity ?? [0, 0, 0]);
    const radiusSq = deadzoneRadius * deadzoneRadius;

    let leadX = vec3Dot(leadVelocity, basis.rightAxis) * leadFactor;
    let leadY = vec3Dot(leadVelocity, basis.forwardAxis) * leadFactor;
    const leadLenSq = leadX * leadX + leadY * leadY;
    if (leadLenSq > radiusSq) {
      const k = deadzoneRadius / Math.sqrt(leadLenSq);
      leadX *= k;
      leadY *= k;
    }

    const desiredTarget: Vec3Tuple = [
      target[0] + basis.rightAxis[0] * leadX + basis.forwardAxis[0] * leadY,
      target[1] + basis.rightAxis[1] * leadX + basis.forwardAxis[1] * leadY,
      target[2] + basis.rightAxis[2] * leadX + basis.forwardAxis[2] * leadY,
    ];

    const alpha =
      initialized && smoothing > 0
        ? expSmoothingAlpha(input.delta, smoothing)
        : 1;
    smoothedTarget = [
      lerp(smoothedTarget[0], desiredTarget[0], alpha),
      lerp(smoothedTarget[1], desiredTarget[1], alpha),
      lerp(smoothedTarget[2], desiredTarget[2], alpha),
    ];
    initialized = true;

    const dx = target[0] - smoothedTarget[0];
    const dy = target[1] - smoothedTarget[1];
    const dz = target[2] - smoothedTarget[2];
    const delta3: Vec3Tuple = [dx, dy, dz];
    const offX = vec3Dot(delta3, basis.rightAxis);
    const offY = vec3Dot(delta3, basis.forwardAxis);
    const offLenSq = offX * offX + offY * offY;
    if (offLenSq > radiusSq) {
      const offLen = Math.sqrt(offLenSq);
      const k = (offLen - deadzoneRadius) / offLen;
      smoothedTarget = [
        smoothedTarget[0] +
          basis.rightAxis[0] * offX * k +
          basis.forwardAxis[0] * offY * k,
        smoothedTarget[1] +
          basis.rightAxis[1] * offX * k +
          basis.forwardAxis[1] * offY * k,
        smoothedTarget[2] +
          basis.rightAxis[2] * offX * k +
          basis.forwardAxis[2] * offY * k,
      ];
    }

    const lookPoint: Vec3Tuple = [
      smoothedTarget[0] - basis.forwardAxis[0] * screenShiftUp,
      smoothedTarget[1] - basis.forwardAxis[1] * screenShiftUp,
      smoothedTarget[2] - basis.forwardAxis[2] * screenShiftUp,
    ];
    const eye: Vec3Tuple = [
      lookPoint[0] + offset[0],
      lookPoint[1] + offset[1],
      lookPoint[2] + offset[2],
    ];
    const rotation: QuatTuple = [...quatLookAt(eye, lookPoint)];

    return {
      target,
      desiredTarget,
      smoothedTarget: copyVec3(smoothedTarget),
      lookPoint,
      eye,
      rotation,
      lead: [leadX, leadY],
    };
  };

  return {
    get smoothedTarget() {
      return copyVec3(smoothedTarget);
    },
    get rightAxis() {
      return copyVec3(basis.rightAxis);
    },
    get forwardAxis() {
      return copyVec3(basis.forwardAxis);
    },
    reset(target = options.initialTarget ?? [0, 0, 0]) {
      smoothedTarget = readVec3(target);
      initialized = false;
    },
    update,
    writeTo(camera, input) {
      const pose = update(input);
      writeFollowCameraPose(camera, pose, { enableRenderInterpolation });
      return pose;
    },
  };
}

export function writeFollowCameraPose(
  camera: Entity,
  pose: FollowCameraPose,
  options: { readonly enableRenderInterpolation?: boolean } = {},
): void {
  if (camera.hasComponent(LocalTransform)) {
    camera.getVectorView(LocalTransform, "translation").set(pose.eye);
    camera.getVectorView(LocalTransform, "rotation").set(pose.rotation);
  } else {
    camera.addComponent(LocalTransform, {
      translation: pose.eye,
      rotation: pose.rotation,
      scale: [1, 1, 1],
    });
  }

  if (
    options.enableRenderInterpolation !== false &&
    !camera.hasComponent(RenderInterpolation)
  ) {
    camera.addComponent(RenderInterpolation);
  }
}

function createFollowBasis(options: FollowCameraControllerOptions): {
  readonly rightAxis: Vec3Tuple;
  readonly forwardAxis: Vec3Tuple;
} {
  const offset = readVec3(options.offset);
  const right = options.rightAxis ?? [offset[2], 0, -offset[0]];
  const forward = options.forwardAxis ?? [-offset[0], 0, -offset[2]];

  return {
    rightAxis: normalizeOr(readVec3(right), [1, 0, 0]),
    forwardAxis: normalizeOr(readVec3(forward), [0, 0, -1]),
  };
}

function normalizeOr(value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple {
  const sourceLength = Math.hypot(value[0], value[1], value[2]);
  if (sourceLength <= 1e-6) {
    return fallback;
  }
  const normalized = vec3Normalize(value);
  const length = Math.hypot(normalized[0], normalized[1], normalized[2]);
  if (length <= 1e-6) {
    return fallback;
  }
  return copyVec3(normalized);
}

function readVec3(value: Vec3Like): Vec3Tuple {
  return [read(value, 0), read(value, 1), read(value, 2)];
}

function copyVec3(value: Vec3Like): Vec3Tuple {
  return [read(value, 0), read(value, 1), read(value, 2)];
}

function read(value: ArrayLike<number>, index: number): number {
  const item = value[index];
  if (item === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }
  return item;
}
