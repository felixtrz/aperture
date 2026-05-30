/**
 * Headless, ECS-free animation time driver. Owns playback state for one active
 * clip plus a single crossfade lane, and on each `update(delta)` produces pure
 * per-target blended TRS samples (plus blended morph-weight channels). It never
 * touches entities — the ECS driver system (M2-T8) consumes its output — so it
 * is reusable by both unit tests and the worker simulation thread.
 *
 * Extracted from the hand-rolled glb-viewer worker control loop
 * (updateActiveAnimation / applyAnimationAtTime / animationClipLocalTime /
 * wrapTime / startActiveAnimationCrossFade / updateAnimationCrossFadeWeights,
 * examples/glb-viewer.worker.js:5280-5491) and three.js AnimationAction loop /
 * crossFade semantics (references/three.js src/animation/AnimationAction.js).
 * Unlike the worker it uses an internal time accumulator (no playbackOffset
 * recompute) and adds a `pingpong` loop mode.
 */

import {
  blendAnimationClipSamples,
  crossFadeTo,
  sampleAnimationCrossFade,
  type AnimationCrossFade,
  type BlendedAnimationChannel,
  type WeightedAnimationClipSample,
} from "./animation-blending.js";
import {
  sampleAnimationChannel,
  type AnimationChannelPath,
  type AnimationClip,
} from "./animation-clip.js";

/** Loop behaviour for a playing clip. */
export type AnimationLoopMode = "once" | "repeat" | "pingpong";

/** Options for {@link AnimationMixer.play}. */
export interface AnimationPlayOptions {
  readonly loop?: AnimationLoopMode;
  /** Signed playback rate; negative plays backward. Defaults to 1. */
  readonly speed?: number;
  /** Initial local clip time in seconds. Defaults to 0. */
  readonly startTime?: number;
}

/** A blended morph-target weights channel for a target. */
export interface BlendedWeightChannel {
  readonly targetId: string;
  readonly path: "weights";
  readonly value: readonly number[];
  readonly weight: number;
}

/** Snapshot of the mixer's current playback state (JSON-safe). */
export interface AnimationMixerState {
  readonly activeClipId: string | null;
  readonly time: number;
  readonly speed: number;
  readonly loop: AnimationLoopMode;
  readonly paused: boolean;
  readonly clamped: boolean;
  readonly crossFading: boolean;
}

interface ClipLane {
  readonly clipId: string;
  readonly clip: AnimationClip;
  time: number;
  speed: number;
  loop: AnimationLoopMode;
  /** Current travel direction for `pingpong`; always 1 otherwise. */
  pingpongDirection: 1 | -1;
  /** `once`-mode finished flag. */
  clamped: boolean;
}

interface CrossFadeLane {
  readonly fade: AnimationCrossFade;
  elapsed: number;
}

export class AnimationMixer {
  private readonly clips = new Map<string, AnimationClip>();
  private current: ClipLane | null = null;
  private previous: ClipLane | null = null;
  private crossFade: CrossFadeLane | null = null;
  private paused = false;
  private lastWeightChannels: BlendedWeightChannel[] = [];

  constructor(clips?: Iterable<readonly [string, AnimationClip]>) {
    if (clips !== undefined) {
      for (const [id, clip] of clips) {
        this.clips.set(id, clip);
      }
    }
  }

  /** Register (or replace) a clip the mixer can play by id. */
  addClip(id: string, clip: AnimationClip): void {
    this.clips.set(id, clip);
  }

  hasClip(id: string): boolean {
    return this.clips.has(id);
  }

  /** Ids of all registered clips. */
  get clipIds(): readonly string[] {
    return [...this.clips.keys()];
  }

  /** Begin playing `clipId` from `startTime`, replacing any current playback. */
  play(clipId: string, options: AnimationPlayOptions = {}): void {
    const clip = this.clips.get(clipId);
    if (clip === undefined) {
      throw new Error(`AnimationMixer.play: unknown clip id "${clipId}"`);
    }

    this.current = this.makeLane(clipId, clip, options);
    this.previous = null;
    this.crossFade = null;
    this.paused = false;
  }

  /** Crossfade from the current clip to `clipId` over `durationSeconds`. */
  crossFadeTo(clipId: string, durationSeconds: number): void {
    const clip = this.clips.get(clipId);
    if (clip === undefined) {
      throw new Error(
        `AnimationMixer.crossFadeTo: unknown clip id "${clipId}"`,
      );
    }

    if (this.current === null) {
      // Nothing to fade from — behave like a plain play().
      this.play(clipId, {});
      return;
    }

    const from = this.current;
    const to = this.makeLane(clipId, clip, {
      loop: from.loop,
      speed: from.speed,
    });

    this.previous = from;
    this.current = to;
    this.crossFade = {
      fade: crossFadeTo(from.clipId, to.clipId, durationSeconds),
      elapsed: 0,
    };
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Scrub the active clip to `time` seconds (clamped to the clip duration). */
  seek(time: number): void {
    if (this.current === null) {
      return;
    }
    const duration = clipDuration(this.current.clip);
    this.current.time = clamp(time, 0, duration);
    this.current.clamped = false;
  }

  get state(): AnimationMixerState {
    return {
      activeClipId: this.current?.clipId ?? null,
      time: this.current?.time ?? 0,
      speed: this.current?.speed ?? 1,
      loop: this.current?.loop ?? "repeat",
      paused: this.paused,
      clamped: this.current?.clamped ?? false,
      crossFading: this.crossFade !== null,
    };
  }

  get activeClipId(): string | null {
    return this.current?.clipId ?? null;
  }

  get time(): number {
    return this.current?.time ?? 0;
  }

  get clamped(): boolean {
    return this.current?.clamped ?? false;
  }

  get isCrossFading(): boolean {
    return this.crossFade !== null;
  }

  /** Blended morph-target weight channels produced by the last `update()`. */
  get weightChannels(): readonly BlendedWeightChannel[] {
    return this.lastWeightChannels;
  }

  /**
   * Advance playback by `deltaSeconds` and return the blended per-target TRS
   * channels. Morph-weight channels are available via {@link weightChannels}.
   * When paused, time does not advance but the current pose is still returned.
   */
  update(deltaSeconds: number): BlendedAnimationChannel[] {
    if (this.current === null) {
      this.lastWeightChannels = [];
      return [];
    }

    const effectiveDelta = this.paused ? 0 : deltaSeconds;

    this.advanceLane(this.current, effectiveDelta);

    let fromWeight = 0;
    let toWeight = 1;
    let crossFadeFinished = false;

    if (this.crossFade !== null && this.previous !== null) {
      this.advanceLane(this.previous, effectiveDelta);
      this.crossFade.elapsed += effectiveDelta;
      const weights = sampleAnimationCrossFade(
        this.crossFade.fade,
        this.crossFade.elapsed,
      );
      fromWeight = weights[0]?.weight ?? 0;
      toWeight = weights[1]?.weight ?? 1;
      crossFadeFinished =
        this.crossFade.elapsed >= this.crossFade.fade.durationSeconds;
    }

    const samples: WeightedAnimationClipSample[] = [];
    const weightContributors = new Map<
      string,
      { value: number[]; weight: number }
    >();

    this.collectLane(this.current, toWeight, samples, weightContributors);
    if (this.crossFade !== null && this.previous !== null) {
      this.collectLane(this.previous, fromWeight, samples, weightContributors);
    }

    const blended = blendAnimationClipSamples(samples);
    this.lastWeightChannels = finalizeWeightChannels(weightContributors);

    if (crossFadeFinished) {
      this.previous = null;
      this.crossFade = null;
    }

    return blended;
  }

  private makeLane(
    clipId: string,
    clip: AnimationClip,
    options: AnimationPlayOptions,
  ): ClipLane {
    const loop = options.loop ?? "repeat";
    const speed = Number.isFinite(options.speed) ? options.speed! : 1;
    const duration = clipDuration(clip);
    const startTime = Number.isFinite(options.startTime)
      ? clamp(options.startTime!, 0, duration)
      : 0;
    return {
      clipId,
      clip,
      time: startTime,
      speed,
      loop,
      pingpongDirection: 1,
      clamped: false,
    };
  }

  private advanceLane(lane: ClipLane, delta: number): void {
    const duration = clipDuration(lane.clip);
    if (duration <= 0) {
      lane.time = 0;
      return;
    }
    if (delta === 0) {
      return;
    }

    const direction = lane.loop === "pingpong" ? lane.pingpongDirection : 1;
    let next = lane.time + delta * lane.speed * direction;

    switch (lane.loop) {
      case "repeat": {
        lane.time = wrapTime(next, duration);
        lane.clamped = false;
        break;
      }
      case "once": {
        if (next >= duration) {
          lane.time = duration;
          lane.clamped = true;
        } else if (next <= 0) {
          lane.time = 0;
          lane.clamped = true;
        } else {
          lane.time = next;
          lane.clamped = false;
        }
        break;
      }
      case "pingpong": {
        // Reflect at each endpoint, flipping direction so the clip bounces.
        // Guard against huge deltas with a few reflection iterations.
        let guard = 0;
        while ((next < 0 || next > duration) && guard < 64) {
          if (next > duration) {
            next = 2 * duration - next;
            lane.pingpongDirection = (lane.pingpongDirection * -1) as 1 | -1;
          } else if (next < 0) {
            next = -next;
            lane.pingpongDirection = (lane.pingpongDirection * -1) as 1 | -1;
          }
          guard += 1;
        }
        lane.time = clamp(next, 0, duration);
        lane.clamped = false;
        break;
      }
    }
  }

  private collectLane(
    lane: ClipLane,
    weight: number,
    samples: WeightedAnimationClipSample[],
    weightContributors: Map<string, { value: number[]; weight: number }>,
  ): void {
    if (weight <= 0) {
      return;
    }

    for (const channel of lane.clip.channels) {
      const value = sampleAnimationChannel(channel, lane.time);

      if (channel.path === "weights") {
        accumulateWeightChannel(
          weightContributors,
          channel.targetId,
          value,
          weight,
        );
        continue;
      }

      samples.push({
        clipId: lane.clipId,
        targetId: channel.targetId,
        // Narrowed: non-"weights" paths are exactly AnimationBlendPath.
        path: channel.path as Exclude<AnimationChannelPath, "weights">,
        weight,
        value,
      });
    }
  }
}

function accumulateWeightChannel(
  weightContributors: Map<string, { value: number[]; weight: number }>,
  targetId: string,
  value: readonly number[],
  weight: number,
): void {
  let entry = weightContributors.get(targetId);
  if (entry === undefined) {
    entry = { value: new Array<number>(value.length).fill(0), weight: 0 };
    weightContributors.set(targetId, entry);
  }
  for (let i = 0; i < value.length; i += 1) {
    entry.value[i] = (entry.value[i] ?? 0) + (value[i] ?? 0) * weight;
  }
  entry.weight += weight;
}

function finalizeWeightChannels(
  weightContributors: Map<string, { value: number[]; weight: number }>,
): BlendedWeightChannel[] {
  const channels: BlendedWeightChannel[] = [];
  for (const [targetId, entry] of weightContributors) {
    const totalWeight = entry.weight;
    const value =
      totalWeight > 0
        ? entry.value.map((component) => component / totalWeight)
        : entry.value;
    channels.push({
      targetId,
      path: "weights",
      value,
      weight: Number(totalWeight.toFixed(6)),
    });
  }
  return channels;
}

function clipDuration(clip: AnimationClip): number {
  return Math.max(0, clip.duration);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function wrapTime(time: number, duration: number): number {
  return duration > 0 ? ((time % duration) + duration) % duration : 0;
}
