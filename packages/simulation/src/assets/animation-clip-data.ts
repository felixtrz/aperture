/**
 * Engine animation clip *data* types. These live in the base simulation
 * package (alongside {@link AnimationClipHandle}) so both the glTF importer in
 * `@aperture-engine/render` and the sampler/mixer in `@aperture-engine/runtime`
 * can share one canonical clip shape without a package-boundary cycle (runtime
 * depends on render, so render cannot import runtime). The runtime package
 * re-exports these and owns the pure sampler that consumes them.
 *
 * Data only: flat typed buffers, no logic, structured-clone / worker safe.
 */

/** glTF sampler interpolation modes. */
export type AnimationInterpolation = "LINEAR" | "STEP" | "CUBICSPLINE";

/** Animation channel target paths (glTF `channel.target.path`). */
export type AnimationChannelPath =
  | "translation"
  | "rotation"
  | "scale"
  | "weights";

/**
 * A single keyframe channel: one TRS/weights path on one target, sampled over
 * time. All numeric data lives in flat `Float32Array`s so a clip is
 * structured-clone friendly and worker-transportable with no per-frame parse.
 */
export interface AnimationKeyframeChannel {
  /** Opaque target identifier (an entity key for imported glTF clips). */
  readonly targetId: string;
  readonly path: AnimationChannelPath;
  readonly interpolation: AnimationInterpolation;
  /** Ascending keyframe input times in seconds. Length === keyframe count. */
  readonly times: Float32Array;
  /**
   * Flat keyframe outputs.
   *
   * - LINEAR / STEP: `keyframeCount * componentCount` values.
   * - CUBICSPLINE: each keyframe is laid out as
   *   `[inTangent(C), value(C), outTangent(C)]`, so the array is
   *   `keyframeCount * componentCount * 3` long.
   */
  readonly values: Float32Array;
  /**
   * Components per value tuple: 3 for translation/scale, 4 for rotation, and
   * the morph-target count for `weights` channels.
   */
  readonly componentCount: number;
}

/** An engine-owned animation clip: a named, timed bundle of channels. */
export interface AnimationClip {
  readonly name: string;
  /** Clip length in seconds (max channel end time). */
  readonly duration: number;
  readonly channels: readonly AnimationKeyframeChannel[];
}
