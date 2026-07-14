import { EPSILON } from "./constants.js";
import { quat, vec3 } from "./constructors.js";
import { clamp } from "./scalars.js";
import {
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  rotateVec3ByQuat,
} from "./quaternion.js";
import {
  vec3Add,
  vec3AddScaled,
  vec3Cross,
  vec3Dot,
  vec3Length,
  vec3Normalize,
  vec3Scale,
  vec3Subtract,
} from "./vector.js";
import type { Quat, QuatLike, Vec3, Vec3Like } from "./types.js";

// Inverse-kinematics solvers, array-first and pure (no `Date.now()`/`Math.random()`,
// no hidden state), so identical inputs always produce bit-identical output — the
// deterministic contract the fixed-step ECS IK systems rely on. The solvers work
// entirely in WORLD space (positions + rotations) and return new WORLD-space joint
// rotations; converting those to the joints' LOCAL transforms (via the parent world
// rotations) is the ECS system's job. Everything reuses the shared vec3/quat helpers
// so there is a single, tested source of numerical truth.

/**
 * Shortest-arc quaternion rotating unit-or-arbitrary vector `from` onto the
 * direction of `to` (both are normalized internally). Degenerate cases —
 * (anti)parallel inputs — resolve to identity / a 180° flip about a stable
 * perpendicular axis, so the result is always finite.
 */
export function shortestArcQuaternion(
  from: Vec3Like,
  to: Vec3Like,
  out: Quat = quat(),
): Quat {
  const f = vec3Normalize(from);
  const t = vec3Normalize(to);
  const cos = vec3Dot(f, t);

  if (cos >= 1 - EPSILON) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  }

  if (cos <= -1 + EPSILON) {
    // Antiparallel: any perpendicular axis gives a valid 180° rotation.
    return quatFromAxisAngle(perpendicularAxis(f), Math.PI, out);
  }

  const axis = vec3Cross(f, t);
  out[0] = axis[0];
  out[1] = axis[1];
  out[2] = axis[2];
  out[3] = 1 + cos;
  return quatNormalize(out, out);
}

/** Any unit vector perpendicular to `value` (`value` need not be unit-length). */
function perpendicularAxis(value: Vec3Like, out: Vec3 = vec3()): Vec3 {
  // Cross with whichever world axis is least parallel to `value`.
  const ax = Math.abs(value[0] ?? 0);
  const reference: Vec3Like = ax > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const axis = vec3Cross(value, reference, out);
  return vec3Normalize(axis, out);
}

export interface TwoBoneIkInput {
  /** Root/hip/shoulder joint world position. */
  readonly rootPosition: Vec3Like;
  /** Mid/knee/elbow joint world position. */
  readonly midPosition: Vec3Like;
  /** End/foot/wrist joint world position (the effector). */
  readonly endPosition: Vec3Like;
  /** Desired effector world position. */
  readonly targetPosition: Vec3Like;
  /** Current root joint world rotation. */
  readonly rootWorldRotation: QuatLike;
  /** Current mid joint world rotation. */
  readonly midWorldRotation: QuatLike;
  /**
   * Optional world-space pole/hint position; the limb bends so the mid joint
   * (knee/elbow) points toward it. Omitted → the current bend plane is kept.
   */
  readonly polePosition?: Vec3Like;
  /** Reach clamp margin (keeps the limb off exact full extension). */
  readonly epsilon?: number;
}

export interface TwoBoneIkResult {
  /** New root joint WORLD rotation. */
  readonly rootWorldRotation: Quat;
  /** New mid joint WORLD rotation. */
  readonly midWorldRotation: Quat;
  /** Resulting mid (knee/elbow) world position. */
  readonly midPosition: Vec3;
  /** Resulting effector world position (== clamped target). */
  readonly endPosition: Vec3;
  /** True when the (unclamped) target lies within the reachable annulus. */
  reached: boolean;
}

export function createTwoBoneIkResult(): TwoBoneIkResult {
  return {
    rootWorldRotation: quat(),
    midWorldRotation: quat(),
    midPosition: vec3(),
    endPosition: vec3(),
    reached: false,
  };
}

/**
 * Analytic two-bone IK (law of cosines). Given the root/mid/end joint world
 * positions, a target, and an optional pole hint, it computes the new WORLD
 * rotations of the root and mid joints so the effector reaches the target,
 * clamping the target to the reachable range `[|l1-l2|, l1+l2]` (so an
 * over/under-reach straightens toward the target instead of producing NaN) and
 * orienting the bend plane toward the pole.
 *
 * Returns world rotations; the caller converts them to the joints' local
 * transforms using the joints' parent world rotations. Assumes a direct
 * `root → mid → end` parent chain with unit joint scale.
 */
export function solveTwoBoneIk(
  input: TwoBoneIkInput,
  out: TwoBoneIkResult = createTwoBoneIkResult(),
): TwoBoneIkResult {
  const eps = input.epsilon ?? 1e-4;
  const root = input.rootPosition;
  const mid = input.midPosition;
  const end = input.endPosition;
  const target = input.targetPosition;

  const upperVec = vec3Subtract(mid, root);
  const lowerVec = vec3Subtract(end, mid);
  const upperLen = vec3Length(upperVec);
  const lowerLen = vec3Length(lowerVec);
  const maxReach = upperLen + lowerLen;
  const minReach = Math.abs(upperLen - lowerLen);

  const toTarget = vec3Subtract(target, root);
  const targetDist = vec3Length(toTarget);
  out.reached = targetDist >= minReach - eps && targetDist <= maxReach + eps;

  // Direction root → target (fall back to the current limb direction when the
  // target sits on the root, so a coincident target does not produce NaN).
  const dir =
    targetDist > eps
      ? vec3Scale(toTarget, 1 / targetDist)
      : vec3Normalize(upperVec);

  // Clamp the reach into the annulus so the triangle is always solvable.
  const lo = minReach + eps;
  const hi = Math.max(lo, maxReach - eps);
  const reach = clamp(targetDist, lo, hi);
  const clampedTarget = vec3AddScaled(root, dir, reach);

  // Law of cosines: interior angle at the root between the upper bone and the
  // root→target line.
  const denom = 2 * upperLen * reach;
  const cosRoot =
    denom <= EPSILON
      ? 1
      : clamp(
          (upperLen * upperLen + reach * reach - lowerLen * lowerLen) / denom,
          -1,
          1,
        );
  const sinRoot = Math.sqrt(Math.max(0, 1 - cosRoot * cosRoot));

  // Bend axis: the component of the pole (or current elbow) perpendicular to
  // the root→target line decides which way the knee/elbow points.
  const bendDir = computeBendDirection(root, dir, mid, input.polePosition, eps);

  // Elbow position = along the target line + out along the bend direction.
  const elbow = vec3Add(
    vec3AddScaled(root, dir, upperLen * cosRoot),
    vec3Scale(bendDir, upperLen * sinRoot),
  );

  out.midPosition[0] = elbow[0];
  out.midPosition[1] = elbow[1];
  out.midPosition[2] = elbow[2];
  out.endPosition[0] = clampedTarget[0];
  out.endPosition[1] = clampedTarget[1];
  out.endPosition[2] = clampedTarget[2];

  // Root delta: rotate the old upper bone onto the new upper bone (world space).
  const upperNew = vec3Subtract(elbow, root);
  const rootDelta = shortestArcQuaternion(upperVec, upperNew);
  quatNormalize(
    quatMultiply(rootDelta, input.rootWorldRotation, out.rootWorldRotation),
    out.rootWorldRotation,
  );

  // Mid delta: after the root delta rigidly rotates the lower bone, rotate that
  // intermediate lower bone onto the new lower bone (elbow → clamped target).
  const lowerIntermediate = rotateVec3ByQuat(lowerVec, rootDelta);
  const lowerNew = vec3Subtract(clampedTarget, elbow);
  const midDelta = shortestArcQuaternion(lowerIntermediate, lowerNew);
  const midAfterRoot = quatMultiply(rootDelta, input.midWorldRotation);
  quatNormalize(
    quatMultiply(midDelta, midAfterRoot, out.midWorldRotation),
    out.midWorldRotation,
  );

  return out;
}

function computeBendDirection(
  root: Vec3Like,
  dir: Vec3Like,
  mid: Vec3Like,
  pole: Vec3Like | undefined,
  eps: number,
  out: Vec3 = vec3(),
): Vec3 {
  if (pole !== undefined) {
    const poleVec = vec3Subtract(pole, root);
    const perp = vec3AddScaled(poleVec, dir, -vec3Dot(poleVec, dir), out);
    if (vec3Length(perp) > eps) {
      return vec3Normalize(perp, out);
    }
  }

  // No usable pole: keep the current bend plane (project the existing elbow).
  const current = vec3Subtract(mid, root);
  const currentPerp = vec3AddScaled(current, dir, -vec3Dot(current, dir), out);
  if (vec3Length(currentPerp) > eps) {
    return vec3Normalize(currentPerp, out);
  }

  // Fully straight and no pole: any perpendicular keeps the result finite.
  return perpendicularAxis(dir, out);
}

export interface CcdChainInput {
  /** World positions of the chain joints, root → tip. */
  readonly jointPositions: readonly Vec3Like[];
  /** Current world rotations of the chain joints, root → tip. */
  readonly jointWorldRotations: readonly QuatLike[];
  /** Effector world position (rigidly attached to the tip joint). */
  readonly endPosition: Vec3Like;
  /** Desired effector world position. */
  readonly targetPosition: Vec3Like;
  /** Maximum solver iterations (deterministic upper bound). */
  readonly iterations: number;
  /** Stop once the effector is within this distance of the target. */
  readonly tolerance?: number;
  /** Optional per-joint per-iteration rotation clamp, in radians. */
  readonly maxAngle?: number;
  readonly epsilon?: number;
}

export interface CcdChainResult {
  /** New world rotations of the chain joints, root → tip. */
  readonly worldRotations: Quat[];
  /** Resulting effector world position. */
  readonly endPosition: Vec3;
  /** Iterations actually performed before converging. */
  iterations: number;
  /** True when the effector reached the target within tolerance. */
  reached: boolean;
}

/**
 * Cyclic-coordinate-descent (CCD) chain solver. Iterating from the tip back to
 * the root, each joint is rotated (shortest-arc, optionally angle-limited) to
 * swing the effector toward the target; it repeats for a fixed iteration count
 * or until the effector is within `tolerance`. Order-stable and deterministic.
 *
 * Works in world space on a private copy of the chain geometry and returns the
 * new WORLD rotations of every joint; the caller converts them to local
 * transforms. Assumes a direct parent chain (joint `i`'s parent is joint
 * `i-1`) with unit joint scale. An unreachable target makes the chain
 * straighten toward it.
 */
export function solveCcdChain(input: CcdChainInput): CcdChainResult {
  const eps = input.epsilon ?? 1e-6;
  const tolerance = input.tolerance ?? 1e-3;
  const count = input.jointPositions.length;

  // Private working copies: joint world positions, joint world rotations, and
  // the effector — mutated in place as the solver swings the chain.
  const positions: Vec3[] = input.jointPositions.map((p) => vec3Clone(p));
  const rotations: Quat[] = input.jointWorldRotations.map((q) => quatClone(q));
  const end = vec3Clone(input.endPosition);
  const target = input.targetPosition;

  let performed = 0;
  const total = Math.max(0, Math.floor(input.iterations));

  for (let iteration = 0; iteration < total; iteration += 1) {
    if (vec3Length(vec3Subtract(end, target)) <= tolerance) {
      break;
    }
    performed = iteration + 1;

    for (let i = count - 1; i >= 0; i -= 1) {
      const pivot = positions[i] as Vec3;
      const toEnd = vec3Subtract(end, pivot);
      const toTarget = vec3Subtract(target, pivot);
      const lenEnd = vec3Length(toEnd);
      const lenTarget = vec3Length(toTarget);
      if (lenEnd <= eps || lenTarget <= eps) {
        continue;
      }

      let rot = shortestArcQuaternion(toEnd, toTarget);
      if (input.maxAngle !== undefined) {
        rot = clampRotationAngle(rot, input.maxAngle);
      }

      // Rotate the effector and every downstream joint rigidly about the pivot,
      // and rotate this joint's + every descendant's world orientation.
      rotateAround(end, pivot, rot);
      for (let j = i + 1; j < count; j += 1) {
        rotateAround(positions[j] as Vec3, pivot, rot);
      }
      for (let j = i; j < count; j += 1) {
        const world = rotations[j] as Quat;
        quatNormalize(quatMultiply(rot, world, world), world);
      }
    }
  }

  return {
    worldRotations: rotations,
    endPosition: end,
    iterations: performed,
    reached: vec3Length(vec3Subtract(end, target)) <= tolerance,
  };
}

/** Rotate `point` about `pivot` by world-space quaternion `rot`, in place. */
function rotateAround(point: Vec3, pivot: Vec3Like, rot: QuatLike): void {
  const offset = vec3Subtract(point, pivot);
  const rotated = rotateVec3ByQuat(offset, rot);
  point[0] = (pivot[0] ?? 0) + rotated[0];
  point[1] = (pivot[1] ?? 0) + rotated[1];
  point[2] = (pivot[2] ?? 0) + rotated[2];
}

/** Clamp a rotation to at most `maxAngle` radians about its own axis. */
function clampRotationAngle(rotation: Quat, maxAngle: number): Quat {
  const w = clamp(rotation[3] ?? 1, -1, 1);
  const angle = 2 * Math.acos(Math.abs(w));
  if (angle <= maxAngle || angle <= EPSILON) {
    return rotation;
  }
  const axis = vec3Normalize([
    rotation[0] ?? 0,
    rotation[1] ?? 0,
    rotation[2] ?? 0,
  ]);
  const sign = (rotation[3] ?? 1) < 0 ? -1 : 1;
  return quatFromAxisAngle(vec3Scale(axis, sign), maxAngle);
}

function vec3Clone(value: Vec3Like): Vec3 {
  return vec3(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
}

function quatClone(value: QuatLike): Quat {
  return quat(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 1);
}
