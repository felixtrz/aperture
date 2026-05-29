/**
 * Pure, allocation-light keyframe sampler for engine {@link AnimationClip}s.
 * Headless / worker-safe: no ECS, GPU, or DOM dependencies — only flat typed
 * buffers and plain math.
 *
 * The clip *data* types live in `@aperture-engine/simulation` (so the glTF
 * importer in `@aperture-engine/render` can produce them without a package
 * cycle); they are re-exported here so `@aperture-engine/runtime` remains the
 * one-stop import for the animation clip API + sampler.
 *
 * Extracted and generalized from the hand-rolled glb-viewer worker sampler
 * (`sampleAnimationChannel` / `interpolateAnimationTuple` /
 * `normalizeAnimationValue`, examples/glb-viewer.worker.js:5494-5558), ADDING
 * the CUBICSPLINE Hermite interpolant the worker explicitly rejects
 * (glb-viewer.worker.js:5199). The CUBICSPLINE math mirrors three.js
 * `GLTFCubicSplineInterpolant.interpolate_` (references/three.js
 * examples/jsm/loaders/GLTFLoader.js:2102) and the natural-spline coefficient
 * derivation in references/three.js src/math/interpolants/CubicInterpolant.js.
 */

import type {
  AnimationChannelPath,
  AnimationKeyframeChannel,
} from "@aperture-engine/simulation";

export type {
  AnimationInterpolation,
  AnimationChannelPath,
  AnimationKeyframeChannel,
  AnimationClip,
} from "@aperture-engine/simulation";

/** Number of keyframes in a channel. */
export function animationChannelKeyframeCount(
  channel: AnimationKeyframeChannel,
): number {
  return channel.times.length;
}

/**
 * Sample a keyframe channel at `time` (seconds), returning a TRS/weights tuple
 * of length `channel.componentCount`. Rotation results are unit-length.
 *
 * The optional `out` array is reused when correctly sized so the sampler can
 * run per-channel per-frame without allocating. Time is clamped at the channel
 * endpoints (no extrapolation).
 */
export function sampleAnimationChannel(
  channel: AnimationKeyframeChannel,
  time: number,
  out?: number[],
): number[] {
  const componentCount = channel.componentCount;
  const result = ensureTuple(out, componentCount);
  const times = channel.times;
  const count = times.length;

  if (count === 0) {
    return fillDefaultValue(channel.path, result);
  }

  // Clamp before the first / at-or-after the last keyframe.
  if (count === 1 || time <= times[0]!) {
    return readKeyframeValue(channel, 0, result);
  }

  if (time >= times[count - 1]!) {
    return readKeyframeValue(channel, count - 1, result);
  }

  // Find the segment [i0, i1] with times[i0] <= time < times[i1]. STEP holds
  // i0; LINEAR/CUBICSPLINE interpolate. Using `times[i] <= time` (not `<`) so
  // a STEP sample exactly at the next keyframe time returns that next keyframe.
  const hi = count - 1;
  let i1 = 1;
  while (i1 < hi && times[i1]! <= time) {
    i1 += 1;
  }
  const i0 = i1 - 1;
  const t0 = times[i0]!;
  const t1 = times[i1]!;
  const td = t1 - t0;
  const p = td <= 0 ? 0 : (time - t0) / td;

  if (channel.interpolation === "STEP") {
    return readKeyframeValue(channel, i0, result);
  }

  if (channel.interpolation === "CUBICSPLINE") {
    return sampleCubicSpline(channel, i0, i1, td, p, result);
  }

  return sampleLinear(channel, i0, i1, p, result);
}

function sampleLinear(
  channel: AnimationKeyframeChannel,
  i0: number,
  i1: number,
  p: number,
  result: number[],
): number[] {
  const values = channel.values;
  const componentCount = channel.componentCount;
  const offset0 = keyframeValueOffset(channel, i0);
  const offset1 = keyframeValueOffset(channel, i1);

  if (channel.path === "rotation") {
    // Shortest-path blend: flip the next quaternion into the previous one's
    // hemisphere before the component-wise lerp, then renormalize.
    const sign = quaternionHemisphereSign(values, offset0, offset1);
    for (let i = 0; i < componentCount; i += 1) {
      const a = values[offset0 + i]!;
      const b = values[offset1 + i]! * sign;
      result[i] = a + (b - a) * p;
    }
    return normalizeQuaternionTuple(result);
  }

  for (let i = 0; i < componentCount; i += 1) {
    const a = values[offset0 + i]!;
    const b = values[offset1 + i]!;
    result[i] = a + (b - a) * p;
  }
  return result;
}

function sampleCubicSpline(
  channel: AnimationKeyframeChannel,
  i0: number,
  i1: number,
  td: number,
  p: number,
  result: number[],
): number[] {
  const values = channel.values;
  const componentCount = channel.componentCount;
  const stride = componentCount;

  // Hermite basis (matches three.js GLTFCubicSplineInterpolant):
  //   p(p) = s0*p0 + s1*(td*m0) + s2*p1 + s3*(td*m1)
  const pp = p * p;
  const ppp = pp * p;
  const s2 = -2 * ppp + 3 * pp; // -2p^3 + 3p^2
  const s3 = ppp - pp; //          p^3 - p^2
  const s0 = 1 - s2; //            2p^3 - 3p^2 + 1
  const s1 = s3 - pp + p; //       p^3 - 2p^2 + p

  // Per-keyframe layout: [inTangent, value, outTangent] (3 * stride wide).
  const base0 = i0 * stride * 3;
  const base1 = i1 * stride * 3;
  const valueOffset0 = base0 + stride; // splineVertex_k
  const outTangentOffset0 = base0 + stride * 2; // outTangent_k
  const inTangentOffset1 = base1; // inTangent_k+1
  const valueOffset1 = base1 + stride; // splineVertex_k+1

  for (let i = 0; i < stride; i += 1) {
    const valuePrev = values[valueOffset0 + i]!;
    const tangentOut = values[outTangentOffset0 + i]! * td;
    const valueNext = values[valueOffset1 + i]!;
    const tangentIn = values[inTangentOffset1 + i]! * td;
    result[i] =
      s0 * valuePrev + s1 * tangentOut + s2 * valueNext + s3 * tangentIn;
  }

  return channel.path === "rotation"
    ? normalizeQuaternionTuple(result)
    : result;
}

/** Copy keyframe `index`'s value tuple into `result`, normalizing rotations. */
function readKeyframeValue(
  channel: AnimationKeyframeChannel,
  index: number,
  result: number[],
): number[] {
  const offset = keyframeValueOffset(channel, index);
  const values = channel.values;
  for (let i = 0; i < channel.componentCount; i += 1) {
    result[i] = values[offset + i]!;
  }
  return channel.path === "rotation"
    ? normalizeQuaternionTuple(result)
    : result;
}

/** Byte offset of keyframe `index`'s value tuple within `channel.values`. */
function keyframeValueOffset(
  channel: AnimationKeyframeChannel,
  index: number,
): number {
  // CUBICSPLINE keyframes are [inTangent, value, outTangent]; skip the
  // in-tangent to reach the value. LINEAR/STEP keyframes are bare values.
  return channel.interpolation === "CUBICSPLINE"
    ? index * channel.componentCount * 3 + channel.componentCount
    : index * channel.componentCount;
}

function quaternionHemisphereSign(
  values: Float32Array,
  offsetA: number,
  offsetB: number,
): number {
  const dot =
    values[offsetA]! * values[offsetB]! +
    values[offsetA + 1]! * values[offsetB + 1]! +
    values[offsetA + 2]! * values[offsetB + 2]! +
    values[offsetA + 3]! * values[offsetB + 3]!;
  return dot < 0 ? -1 : 1;
}

function normalizeQuaternionTuple(result: number[]): number[] {
  const length = Math.hypot(result[0]!, result[1]!, result[2]!, result[3]!);
  if (length <= 0 || !Number.isFinite(length)) {
    result[0] = 0;
    result[1] = 0;
    result[2] = 0;
    result[3] = 1;
    return result;
  }
  const inverse = 1 / length;
  result[0]! *= inverse;
  result[1]! *= inverse;
  result[2]! *= inverse;
  result[3]! *= inverse;
  return result;
}

function fillDefaultValue(
  path: AnimationChannelPath,
  result: number[],
): number[] {
  if (path === "rotation") {
    result[0] = 0;
    result[1] = 0;
    result[2] = 0;
    result[3] = 1;
    return result;
  }
  const fallback = path === "scale" ? 1 : 0;
  for (let i = 0; i < result.length; i += 1) {
    result[i] = fallback;
  }
  return result;
}

function ensureTuple(out: number[] | undefined, length: number): number[] {
  if (out !== undefined && out.length === length) {
    return out;
  }
  return new Array<number>(length).fill(0);
}
