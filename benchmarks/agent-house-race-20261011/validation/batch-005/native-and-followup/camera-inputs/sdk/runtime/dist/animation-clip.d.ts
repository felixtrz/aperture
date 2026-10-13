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
 * (glb-viewer.worker.js:5199). The CUBICSPLINE math follows the glTF spec's
 * cubic-spline Hermite formulation (per-keyframe in/out tangents scaled by the
 * segment duration), with the usual natural-spline coefficient derivation.
 */
import type { AnimationKeyframeChannel } from "@aperture-engine/simulation";
export type { AnimationInterpolation, AnimationChannelPath, AnimationKeyframeChannel, AnimationClip, } from "@aperture-engine/simulation";
/** Number of keyframes in a channel. */
export declare function animationChannelKeyframeCount(channel: AnimationKeyframeChannel): number;
/**
 * Sample a keyframe channel at `time` (seconds), returning a TRS/weights tuple
 * of length `channel.componentCount`. Rotation results are unit-length.
 *
 * The optional `out` array is reused when correctly sized so the sampler can
 * run per-channel per-frame without allocating. Time is clamped at the channel
 * endpoints (no extrapolation).
 */
export declare function sampleAnimationChannel(channel: AnimationKeyframeChannel, time: number, out?: number[]): number[];
//# sourceMappingURL=animation-clip.d.ts.map