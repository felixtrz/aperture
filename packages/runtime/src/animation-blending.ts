import {
  sampleAnimationChannel,
  type AnimationChannelPath,
  type AnimationClip,
  type AnimationKeyframeChannel,
} from "./animation-clip.js";

export type AnimationBlendPath = "translation" | "rotation" | "scale";

export interface WeightedAnimationClipSample {
  readonly clipId: string;
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly weight: number;
  readonly value: readonly number[];
}

export interface AnimationBlendContributor {
  readonly clipId: string;
  readonly weight: number;
  readonly normalizedWeight: number;
}

export interface BlendedAnimationChannel {
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly value: readonly number[];
  readonly weight: number;
  readonly contributors: readonly AnimationBlendContributor[];
}

export interface AnimationClipWeight {
  readonly clipId: string;
  readonly weight: number;
}

export interface AnimationCrossFade {
  readonly fromClipId: string;
  readonly toClipId: string;
  readonly durationSeconds: number;
}

interface AnimationBlendGroup {
  readonly targetId: string;
  readonly path: AnimationBlendPath;
  readonly value: number[];
  readonly contributors: AnimationBlendContributorScratch[];
  totalWeight: number;
  referenceRotation: readonly [number, number, number, number] | null;
}

interface AnimationBlendContributorScratch {
  readonly clipId: string;
  readonly weight: number;
}

export function clampAnimationClipWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return Math.min(weight, 1);
}

export function blendAnimationClipSamples(
  samples: readonly WeightedAnimationClipSample[],
): BlendedAnimationChannel[] {
  const groups = new Map<string, AnimationBlendGroup>();

  for (const sample of samples) {
    const weight = clampAnimationClipWeight(sample.weight);

    if (weight <= 0) {
      continue;
    }

    const key = animationBlendGroupKey(sample.targetId, sample.path);
    let group = groups.get(key);

    if (group === undefined) {
      group = {
        targetId: sample.targetId,
        path: sample.path,
        value: sample.path === "rotation" ? [0, 0, 0, 0] : [0, 0, 0],
        contributors: [],
        totalWeight: 0,
        referenceRotation: null,
      };
      groups.set(key, group);
    }

    const value = normalizeAnimationBlendValue(sample.path, sample.value);

    if (sample.path === "rotation") {
      const rotation: readonly [number, number, number, number] = [
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
        value[3] ?? 1,
      ];
      group.referenceRotation ??= rotation;
      const sign =
        quaternionDot(group.referenceRotation, rotation) < 0 ? -1 : 1;

      group.value[0] = (group.value[0] ?? 0) + rotation[0] * sign * weight;
      group.value[1] = (group.value[1] ?? 0) + rotation[1] * sign * weight;
      group.value[2] = (group.value[2] ?? 0) + rotation[2] * sign * weight;
      group.value[3] = (group.value[3] ?? 0) + rotation[3] * sign * weight;
    } else {
      group.value[0] = (group.value[0] ?? 0) + (value[0] ?? 0) * weight;
      group.value[1] = (group.value[1] ?? 0) + (value[1] ?? 0) * weight;
      group.value[2] = (group.value[2] ?? 0) + (value[2] ?? 0) * weight;
    }

    group.totalWeight += weight;
    group.contributors.push({ clipId: sample.clipId, weight });
  }

  return Array.from(groups.values(), (group) => {
    const value =
      group.path === "rotation"
        ? normalizeAnimationBlendValue(group.path, group.value)
        : group.value.map((component) => component / group.totalWeight);

    return {
      targetId: group.targetId,
      path: group.path,
      value,
      weight: Number(group.totalWeight.toFixed(6)),
      contributors: group.contributors.map((contributor) => ({
        clipId: contributor.clipId,
        weight: contributor.weight,
        normalizedWeight: Number(
          (contributor.weight / group.totalWeight).toFixed(6),
        ),
      })),
    };
  });
}

export function crossFadeTo(
  fromClipId: string,
  toClipId: string,
  durationSeconds: number,
): AnimationCrossFade {
  return {
    fromClipId,
    toClipId,
    durationSeconds: Math.max(
      0,
      Number.isFinite(durationSeconds) ? durationSeconds : 0,
    ),
  };
}

export function sampleAnimationCrossFade(
  crossFade: AnimationCrossFade,
  elapsedSeconds: number,
): AnimationClipWeight[] {
  const progress =
    crossFade.durationSeconds <= 0
      ? 1
      : clamp01(elapsedSeconds / crossFade.durationSeconds);

  return [
    { clipId: crossFade.fromClipId, weight: Number((1 - progress).toFixed(6)) },
    { clipId: crossFade.toClipId, weight: Number(progress.toFixed(6)) },
  ];
}

function animationBlendGroupKey(
  targetId: string,
  path: AnimationBlendPath,
): string {
  return `${targetId}\u0000${path}`;
}

function normalizeAnimationBlendValue(
  path: AnimationBlendPath,
  value: readonly number[],
): number[] {
  if (path === "rotation") {
    const x = finiteComponent(value, 0, 0);
    const y = finiteComponent(value, 1, 0);
    const z = finiteComponent(value, 2, 0);
    const w = finiteComponent(value, 3, 1);
    const length = Math.hypot(x, y, z, w);

    if (length <= 0 || !Number.isFinite(length)) {
      return [0, 0, 0, 1];
    }

    return [x / length, y / length, z / length, w / length];
  }

  return [
    finiteComponent(value, 0, path === "scale" ? 1 : 0),
    finiteComponent(value, 1, path === "scale" ? 1 : 0),
    finiteComponent(value, 2, path === "scale" ? 1 : 0),
  ];
}

function finiteComponent(
  value: readonly number[],
  index: number,
  fallback: number,
): number {
  const component = value[index];

  return typeof component === "number" && Number.isFinite(component)
    ? component
    : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(value, 1);
}

function quaternionDot(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// ---------------------------------------------------------------------------
// Additive blending (F1 — three.js `AdditiveAnimationBlendMode` analog)
//
// An additive lane carries per-frame DELTAS (built by {@link makeAdditiveClip})
// that are applied ON TOP of the normalized base blend: translation/scale add
// `weight * delta`, rotation premultiplies the base by a weight-scaled
// (slerp-from-identity) delta quaternion, and morph weights add `weight * delta`.
// All math is pure and deterministic (no Date/Math.random), so an additive lane
// replays bit-identically under a fixed step schedule.
// ---------------------------------------------------------------------------

/**
 * An additive delta sample: identical shape to
 * {@link WeightedAnimationClipSample}, but its `value` is a DELTA relative to a
 * reference pose (not an absolute pose) and `weight` is the additive lane's
 * effective weight applied on top of the base pose.
 */
export type AdditiveAnimationClipSample = WeightedAnimationClipSample;

/** Hamilton product `a ⊗ b` (a on the left) of two `[x, y, z, w]` quaternions. */
export function multiplyQuaternions(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Conjugate (= inverse for a unit quaternion) of `[x, y, z, w]`. */
export function conjugateQuaternion(
  q: readonly [number, number, number, number],
): [number, number, number, number] {
  return [-q[0], -q[1], -q[2], q[3]];
}

/**
 * Spherical linear interpolation `slerp(a, b, t)` of two `[x, y, z, w]`
 * quaternions, hemisphere-corrected and renormalized. Falls back to a
 * normalized lerp for nearly-parallel inputs (the usual `1 - |cos| <= eps`
 * guard) so it stays finite and deterministic.
 */
export function slerpQuaternions(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
  t: number,
): [number, number, number, number] {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];

  let cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  let scale0: number;
  let scale1: number;
  if (1 - cosom > 1e-6) {
    const omega = Math.acos(cosom);
    const sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }

  return normalizeQuaternion([
    scale0 * ax + scale1 * bx,
    scale0 * ay + scale1 * by,
    scale0 * az + scale1 * bz,
    scale0 * aw + scale1 * bw,
  ]);
}

/**
 * A weight-scaled rotation delta: `slerp(identity, delta, weight)`. At weight 0
 * this is the identity quaternion (no additive rotation); at weight 1 it is the
 * full delta. Used to scale an additive rotation lane by its effective weight.
 */
export function scaleQuaternionRotation(
  delta: readonly [number, number, number, number],
  weight: number,
): [number, number, number, number] {
  return slerpQuaternions([0, 0, 0, 1], delta, weight);
}

/**
 * Apply additive TRS delta samples on top of a normalized base blend, returning
 * NEW channels (the input `base` is not mutated). A target/path the base does
 * not animate is treated as its rest pose (translation `0`, scale `1`, rotation
 * identity) so an additive-only lane (e.g. a head-look layer over a rig whose
 * base clips never touch the head) still produces a channel. Multiple additive
 * samples on the same target/path stack in input order (deterministic).
 */
export function applyAdditiveAnimationChannels(
  base: readonly BlendedAnimationChannel[],
  additive: readonly AdditiveAnimationClipSample[],
): BlendedAnimationChannel[] {
  if (additive.length === 0) {
    return base.map((channel) => ({
      ...channel,
      value: [...channel.value],
      contributors: channel.contributors.map((contributor) => ({
        ...contributor,
      })),
    }));
  }

  const order: string[] = [];
  const map = new Map<string, BlendedAnimationChannel>();
  for (const channel of base) {
    const key = animationBlendGroupKey(channel.targetId, channel.path);
    order.push(key);
    map.set(key, {
      ...channel,
      value: [...channel.value],
      contributors: channel.contributors.map((contributor) => ({
        ...contributor,
      })),
    });
  }

  for (const sample of additive) {
    const weight = additiveWeight(sample.weight);
    if (weight <= 0) {
      continue;
    }

    const key = animationBlendGroupKey(sample.targetId, sample.path);
    let channel = map.get(key);
    if (channel === undefined) {
      channel = {
        targetId: sample.targetId,
        path: sample.path,
        value: restAnimationBlendValue(sample.path),
        weight: 0,
        contributors: [],
      };
      order.push(key);
      map.set(key, channel);
    }

    const nextValue = applyAdditiveSampleValue(
      sample.path,
      channel.value,
      sample.value,
      weight,
    );
    map.set(key, {
      targetId: channel.targetId,
      path: channel.path,
      value: nextValue,
      weight: Number((channel.weight + weight).toFixed(6)),
      contributors: channel.contributors,
    });
  }

  return order.map((key) => map.get(key)!);
}

function applyAdditiveSampleValue(
  path: AnimationBlendPath,
  base: readonly number[],
  delta: readonly number[],
  weight: number,
): number[] {
  if (path === "rotation") {
    const baseQuat: [number, number, number, number] = [
      base[0] ?? 0,
      base[1] ?? 0,
      base[2] ?? 0,
      base[3] ?? 1,
    ];
    const deltaQuat: readonly [number, number, number, number] = [
      delta[0] ?? 0,
      delta[1] ?? 0,
      delta[2] ?? 0,
      delta[3] ?? 1,
    ];
    return normalizeQuaternion(
      multiplyQuaternions(baseQuat, scaleQuaternionRotation(deltaQuat, weight)),
    );
  }

  return [
    (base[0] ?? 0) + (delta[0] ?? 0) * weight,
    (base[1] ?? 0) + (delta[1] ?? 0) * weight,
    (base[2] ?? 0) + (delta[2] ?? 0) * weight,
  ];
}

/**
 * Additively combine morph-weight deltas onto a base set of morph weights.
 * `base` maps a target id to its normalized base weights (post base-blend); each
 * additive delta adds `weight * delta[i]` component-wise, extending the base
 * array when the additive lane carries more targets than the base. Returns a new
 * map (inputs are not mutated).
 */
export function applyAdditiveWeightDeltas(
  base: ReadonlyMap<string, readonly number[]>,
  additive: readonly AdditiveAnimationClipSample[],
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const [targetId, value] of base) {
    result.set(targetId, [...value]);
  }

  for (const sample of additive) {
    const weight = additiveWeight(sample.weight);
    if (weight <= 0) {
      continue;
    }
    const current = result.get(sample.targetId) ?? [];
    const length = Math.max(current.length, sample.value.length);
    const next = new Array<number>(length).fill(0);
    for (let i = 0; i < length; i += 1) {
      next[i] = (current[i] ?? 0) + (sample.value[i] ?? 0) * weight;
    }
    result.set(sample.targetId, next);
  }

  return result;
}

/**
 * Convert `clip` into an ADDITIVE delta clip — the engine analog of three.js
 * `AnimationUtils.makeClipAdditive`. Each channel becomes per-keyframe deltas
 * relative to a reference pose sampled from `referenceClip` (defaulting to
 * `clip` itself) at `referenceTime`:
 *
 * - translation / scale / weights: `delta = sampled - reference`
 * - rotation: `delta = inverse(reference) ⊗ sampled` (a right-multiplied
 *   rotation offset, matching three.js)
 *
 * A target/path absent from the reference clip uses its rest pose (translation
 * `0`, scale `1`, rotation identity, weights `0`). The result is a LINEAR clip
 * (tangents are not carried through — a CUBICSPLINE source is resampled to its
 * keyframe values), which keeps the delta math exact and allocation-light.
 */
export function makeAdditiveClip(
  clip: AnimationClip,
  options: {
    readonly referenceClip?: AnimationClip;
    readonly referenceTime?: number;
  } = {},
): AnimationClip {
  const referenceClip = options.referenceClip ?? clip;
  const referenceTime = Number.isFinite(options.referenceTime)
    ? options.referenceTime!
    : 0;

  const channels = clip.channels.map((channel) => {
    const reference = referenceChannelValue(
      referenceClip,
      channel,
      referenceTime,
    );
    const componentCount = channel.componentCount;
    const count = channel.times.length;
    const values = new Float32Array(count * componentCount);
    const scratch: number[] = new Array<number>(componentCount).fill(0);

    for (let k = 0; k < count; k += 1) {
      const time = channel.times[k]!;
      const sampled = sampleAnimationChannel(channel, time, scratch);
      const delta = additiveDelta(channel.path, sampled, reference);
      values.set(delta, k * componentCount);
    }

    return {
      targetId: channel.targetId,
      path: channel.path,
      interpolation: "LINEAR" as const,
      times: Float32Array.from(channel.times),
      values,
      componentCount,
    } satisfies AnimationKeyframeChannel;
  });

  return {
    name: `${clip.name} additive`,
    duration: clip.duration,
    channels,
  };
}

function referenceChannelValue(
  referenceClip: AnimationClip,
  channel: AnimationKeyframeChannel,
  referenceTime: number,
): number[] {
  const match = referenceClip.channels.find(
    (candidate) =>
      candidate.targetId === channel.targetId &&
      candidate.path === channel.path,
  );
  if (match !== undefined) {
    return sampleAnimationChannel(match, referenceTime);
  }
  return restAnimationChannelValue(channel.path, channel.componentCount);
}

function additiveDelta(
  path: AnimationChannelPath,
  sampled: readonly number[],
  reference: readonly number[],
): number[] {
  if (path === "rotation") {
    const referenceQuat = conjugateQuaternion(
      normalizeQuaternion([
        reference[0] ?? 0,
        reference[1] ?? 0,
        reference[2] ?? 0,
        reference[3] ?? 1,
      ]),
    );
    const sampledQuat: [number, number, number, number] = [
      sampled[0] ?? 0,
      sampled[1] ?? 0,
      sampled[2] ?? 0,
      sampled[3] ?? 1,
    ];
    return normalizeQuaternion(multiplyQuaternions(referenceQuat, sampledQuat));
  }

  const length = Math.max(sampled.length, reference.length);
  const delta = new Array<number>(length).fill(0);
  for (let i = 0; i < length; i += 1) {
    delta[i] = (sampled[i] ?? 0) - (reference[i] ?? 0);
  }
  return delta;
}

function additiveWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }
  return weight;
}

function restAnimationBlendValue(path: AnimationBlendPath): number[] {
  if (path === "rotation") {
    return [0, 0, 0, 1];
  }
  return path === "scale" ? [1, 1, 1] : [0, 0, 0];
}

function restAnimationChannelValue(
  path: AnimationChannelPath,
  componentCount: number,
): number[] {
  if (path === "rotation") {
    return [0, 0, 0, 1];
  }
  const fallback = path === "scale" ? 1 : 0;
  return new Array<number>(componentCount).fill(fallback);
}

function normalizeQuaternion(
  value: readonly [number, number, number, number],
): [number, number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length <= 0 || !Number.isFinite(length)) {
    return [0, 0, 0, 1];
  }
  const inverse = 1 / length;
  return [
    value[0] * inverse,
    value[1] * inverse,
    value[2] * inverse,
    value[3] * inverse,
  ];
}
