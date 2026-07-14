/**
 * Headless, ECS-free animation time driver. Owns an N-lane action model — the
 * three.js `AnimationAction` analog — where each lane carries `{ clip, weight,
 * speed (timeScale), loop, enabled, additive }` plus fade state, and on each
 * `update(delta)` produces pure per-target blended TRS samples (plus blended
 * morph-weight channels). It never touches entities — the ECS driver system
 * (M2-T8) consumes its output — so it is reusable by both unit tests and the
 * worker simulation thread.
 *
 * The v1 single-clip + one-crossfade API (`play` / `crossFadeTo` / `pause` /
 * `resume` / `seek`) is preserved EXACTLY as thin wrappers over the lane model:
 * `play` clears all lanes and starts one at weight 1; `crossFadeTo` fades the
 * current lane out (removing it when faded) while fading a new lane in. N-lane
 * blend spaces (idle/walk/run) and additive layers (head-look) are built with
 * {@link AnimationMixer.playLane} + the returned {@link AnimationLane} handle.
 *
 * Originally extracted from the hand-rolled glb-viewer worker control loop
 * (updateActiveAnimation / applyAnimationAtTime / animationClipLocalTime /
 * wrapTime / startActiveAnimationCrossFade / updateAnimationCrossFadeWeights,
 * examples/glb-viewer.worker.js:5280-5491); the standard playback-action loop
 * and crossFade semantics (a weight ramping linearly over the fade duration)
 * are unchanged. Determinism: identical `(clips, lane setup, fixed delta
 * sequence)` produces bit-identical channel output across runs (no `Date.now()`
 * / `Math.random()`; lane ids are a monotonic counter).
 */

import {
  applyAdditiveAnimationChannels,
  applyAdditiveWeightDeltas,
  blendAnimationClipSamples,
  type AdditiveAnimationClipSample,
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

/** Options for {@link AnimationMixer.playLane} (the N-lane action API). */
export interface AnimationLaneOptions extends AnimationPlayOptions {
  /** Steady-state lane weight in `[0, 1]`. Defaults to 1. */
  readonly weight?: number;
  /** When true the lane's clip carries deltas applied ON TOP of the base blend. */
  readonly additive?: boolean;
  /** When false the lane contributes 0 weight (still advances time). Default true. */
  readonly enabled?: boolean;
  /** Ramp the lane weight from 0 to `weight` over this many seconds on start. */
  readonly fadeInSeconds?: number;
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
  /** Number of active lanes (v1 single-clip playback reports 1). */
  readonly laneCount: number;
}

/** JSON-safe snapshot of one lane's playback state. */
export interface AnimationLaneState {
  readonly id: string;
  readonly clipId: string;
  readonly additive: boolean;
  readonly enabled: boolean;
  readonly weight: number;
  readonly effectiveWeight: number;
  readonly speed: number;
  readonly loop: AnimationLoopMode;
  readonly time: number;
  readonly clamped: boolean;
  readonly fading: boolean;
}

/**
 * A live handle to one mixer lane (three.js `AnimationAction` analog). Mutating
 * a lane takes effect on the next `update()`; chainable setters return the lane.
 */
export interface AnimationLane {
  readonly id: string;
  readonly clipId: string;
  readonly additive: boolean;
  /** Local clip time in seconds. */
  readonly time: number;
  /** Weight actually contributed this frame (after fade/enabled). */
  readonly effectiveWeight: number;
  /** `once`-mode finished flag. */
  readonly clamped: boolean;
  /** True while a fade in/out is in progress. */
  readonly fading: boolean;
  enabled: boolean;
  weight: number;
  speed: number;
  loop: AnimationLoopMode;
  setWeight(weight: number): AnimationLane;
  setSpeed(speed: number): AnimationLane;
  setLoop(loop: AnimationLoopMode): AnimationLane;
  setEnabled(enabled: boolean): AnimationLane;
  /** Ramp the effective weight up to the lane's steady weight over `seconds`. */
  fadeIn(seconds: number): AnimationLane;
  /**
   * Ramp the effective weight down to 0 over `seconds`. Unless
   * `{ stopWhenFaded: false }`, the lane is removed once fully faded.
   */
  fadeOut(
    seconds: number,
    options?: { readonly stopWhenFaded?: boolean },
  ): AnimationLane;
  /** Scrub the lane to `time` seconds (clamped to the clip duration). */
  seek(time: number): AnimationLane;
  /** Remove the lane from the mixer. */
  stop(): void;
  /** JSON-safe snapshot of this lane. */
  readonly state: AnimationLaneState;
}

interface LaneFade {
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  elapsed: number;
  readonly stopWhenFaded: boolean;
}

class MixerLane implements AnimationLane {
  time: number;
  pingpongDirection: 1 | -1 = 1;
  clamped = false;
  fade: LaneFade | null = null;
  removed = false;

  constructor(
    private readonly mixer: AnimationMixer,
    readonly id: string,
    readonly clipId: string,
    readonly clip: AnimationClip,
    readonly additive: boolean,
    public enabled: boolean,
    public weight: number,
    public speed: number,
    public loop: AnimationLoopMode,
    startTime: number,
  ) {
    this.time = clamp(startTime, 0, clipDuration(clip));
  }

  get duration(): number {
    return clipDuration(this.clip);
  }

  get effectiveWeight(): number {
    if (!this.enabled) {
      return 0;
    }
    const base = this.fade === null ? this.weight : fadeValue(this.fade);
    return base > 0 && Number.isFinite(base) ? base : 0;
  }

  get fading(): boolean {
    return this.fade !== null;
  }

  setWeight(weight: number): AnimationLane {
    this.weight = Number.isFinite(weight) ? Math.max(0, weight) : this.weight;
    return this;
  }

  setSpeed(speed: number): AnimationLane {
    this.speed = Number.isFinite(speed) ? speed : this.speed;
    return this;
  }

  setLoop(loop: AnimationLoopMode): AnimationLane {
    this.loop = loop;
    return this;
  }

  setEnabled(enabled: boolean): AnimationLane {
    this.enabled = enabled;
    return this;
  }

  fadeIn(seconds: number): AnimationLane {
    // three.js fadeIn always ramps the weight from 0 up to the steady weight.
    this.fade = {
      from: 0,
      to: this.weight,
      duration: Math.max(0, Number.isFinite(seconds) ? seconds : 0),
      elapsed: 0,
      stopWhenFaded: false,
    };
    return this;
  }

  fadeOut(
    seconds: number,
    options: { readonly stopWhenFaded?: boolean } = {},
  ): AnimationLane {
    this.fade = {
      from: this.effectiveWeight,
      to: 0,
      duration: Math.max(0, Number.isFinite(seconds) ? seconds : 0),
      elapsed: 0,
      stopWhenFaded: options.stopWhenFaded ?? true,
    };
    return this;
  }

  seek(time: number): AnimationLane {
    this.time = clamp(time, 0, this.duration);
    this.clamped = false;
    return this;
  }

  stop(): void {
    this.mixer.removeLane(this);
  }

  get state(): AnimationLaneState {
    return {
      id: this.id,
      clipId: this.clipId,
      additive: this.additive,
      enabled: this.enabled,
      weight: Number(this.weight.toFixed(6)),
      effectiveWeight: Number(this.effectiveWeight.toFixed(6)),
      speed: this.speed,
      loop: this.loop,
      time: Number(this.time.toFixed(6)),
      clamped: this.clamped,
      fading: this.fading,
    };
  }
}

export class AnimationMixer {
  private readonly clips = new Map<string, AnimationClip>();
  private readonly laneList: MixerLane[] = [];
  private currentLaneId: string | null = null;
  private outgoingLaneId: string | null = null;
  private nextLaneCounter = 0;
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

  getClip(id: string): AnimationClip | undefined {
    return this.clips.get(id);
  }

  /** Ids of all registered clips. */
  get clipIds(): readonly string[] {
    return [...this.clips.keys()];
  }

  // -------------------------------------------------------------------------
  // v1 single-clip + one-crossfade API (preserved). `play` clears all lanes;
  // `crossFadeTo` fades the current lane out while fading the new one in.
  // -------------------------------------------------------------------------

  /** Begin playing `clipId` from `startTime`, replacing any current playback. */
  play(clipId: string, options: AnimationPlayOptions = {}): void {
    const clip = this.requireClip("play", clipId);
    this.laneList.length = 0;
    this.outgoingLaneId = null;
    const lane = this.createLane(clipId, clip, {
      ...options,
      weight: 1,
      additive: false,
    });
    this.currentLaneId = lane.id;
    this.paused = false;
  }

  /** Crossfade from the current clip to `clipId` over `durationSeconds`. */
  crossFadeTo(clipId: string, durationSeconds: number): void {
    const clip = this.requireClip("crossFadeTo", clipId);
    const from = this.currentLane;
    if (from === null) {
      // Nothing to fade from — behave like a plain play().
      this.play(clipId, {});
      return;
    }

    const duration = Math.max(
      0,
      Number.isFinite(durationSeconds) ? durationSeconds : 0,
    );
    const to = this.createLane(clipId, clip, {
      loop: from.loop,
      speed: from.speed,
      weight: 1,
      additive: false,
    });
    to.fadeIn(duration);
    from.fadeOut(duration, { stopWhenFaded: true });

    this.currentLaneId = to.id;
    this.outgoingLaneId = from.id;
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
    this.currentLane?.seek(time);
  }

  // -------------------------------------------------------------------------
  // N-lane action API (three.js AnimationAction analog).
  // -------------------------------------------------------------------------

  /**
   * Add a new lane playing `clipId` and return its handle. Unlike {@link play}
   * this does NOT clear existing lanes, so N weighted lanes (a walk/run blend
   * space) and additive layers (a head-look) can be composed. A lane started
   * with `fadeInSeconds` ramps its weight from 0.
   */
  playLane(clipId: string, options: AnimationLaneOptions = {}): AnimationLane {
    const clip = this.requireClip("playLane", clipId);
    const lane = this.createLane(clipId, clip, options);
    if (options.fadeInSeconds !== undefined && options.fadeInSeconds > 0) {
      lane.fadeIn(options.fadeInSeconds);
    }
    this.currentLaneId ??= lane.id;
    return lane;
  }

  /** The lane with `id`, or null. */
  getLane(id: string): AnimationLane | null {
    return this.laneList.find((lane) => lane.id === id) ?? null;
  }

  /** Live handles to every active lane, in creation order. */
  get lanes(): readonly AnimationLane[] {
    return this.laneList;
  }

  /** JSON-safe snapshots of every active lane. */
  get laneStates(): readonly AnimationLaneState[] {
    return this.laneList.map((lane) => lane.state);
  }

  /** Remove every lane. */
  clearLanes(): void {
    this.laneList.length = 0;
    this.currentLaneId = null;
    this.outgoingLaneId = null;
  }

  /** Remove a single lane (used by {@link AnimationLane.stop}). */
  removeLane(lane: MixerLane): void {
    const index = this.laneList.indexOf(lane);
    if (index >= 0) {
      this.laneList.splice(index, 1);
    }
    lane.removed = true;
    if (this.currentLaneId === lane.id) {
      this.currentLaneId = this.laneList[this.laneList.length - 1]?.id ?? null;
    }
    if (this.outgoingLaneId === lane.id) {
      this.outgoingLaneId = null;
    }
  }

  // -------------------------------------------------------------------------
  // State getters (v1-compatible).
  // -------------------------------------------------------------------------

  get state(): AnimationMixerState {
    const lane = this.currentLane;
    return {
      activeClipId: lane?.clipId ?? null,
      time: lane?.time ?? 0,
      speed: lane?.speed ?? 1,
      loop: lane?.loop ?? "repeat",
      paused: this.paused,
      clamped: lane?.clamped ?? false,
      crossFading: this.outgoingLaneId !== null,
      laneCount: this.laneList.length,
    };
  }

  get activeClipId(): string | null {
    return this.currentLane?.clipId ?? null;
  }

  get time(): number {
    return this.currentLane?.time ?? 0;
  }

  get clamped(): boolean {
    return this.currentLane?.clamped ?? false;
  }

  get isCrossFading(): boolean {
    return this.outgoingLaneId !== null;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Blended morph-target weight channels produced by the last `update()`. */
  get weightChannels(): readonly BlendedWeightChannel[] {
    return this.lastWeightChannels;
  }

  /**
   * Advance every enabled lane by `deltaSeconds` and return the blended
   * per-target TRS channels (base lanes normalized, then additive lanes applied
   * on top). Morph-weight channels are available via {@link weightChannels}.
   * When paused, time does not advance but the current pose is still returned.
   */
  update(deltaSeconds: number): BlendedAnimationChannel[] {
    if (this.laneList.length === 0) {
      this.lastWeightChannels = [];
      return [];
    }

    const effectiveDelta = this.paused ? 0 : deltaSeconds;

    // 1. Advance every lane's local time and fade ramp; collect faded-out lanes.
    const toRemove: MixerLane[] = [];
    for (const lane of this.laneList) {
      this.advanceLane(lane, effectiveDelta);
      if (lane.fade !== null) {
        lane.fade.elapsed += effectiveDelta;
        if (lane.fade.elapsed >= lane.fade.duration) {
          const completed = lane.fade;
          lane.weight = Math.max(0, completed.to);
          lane.fade = null;
          if (completed.stopWhenFaded && completed.to <= 0) {
            toRemove.push(lane);
          }
        }
      }
    }
    for (const lane of toRemove) {
      this.removeLane(lane);
    }

    // 2. Collect base + additive samples using each lane's effective weight.
    const baseSamples: WeightedAnimationClipSample[] = [];
    const additiveSamples: AdditiveAnimationClipSample[] = [];
    const baseWeights = new Map<string, { value: number[]; weight: number }>();
    const additiveWeightSamples: AdditiveAnimationClipSample[] = [];

    for (const lane of this.laneList) {
      const weight = lane.effectiveWeight;
      if (weight <= 0) {
        continue;
      }
      this.collectLane(
        lane,
        weight,
        baseSamples,
        additiveSamples,
        baseWeights,
        additiveWeightSamples,
      );
    }

    // 3. Blend base lanes (normalized), then apply additive lanes on top.
    const baseBlended = blendAnimationClipSamples(baseSamples);
    const blended = applyAdditiveAnimationChannels(
      baseBlended,
      additiveSamples,
    );

    // 4. Morph weights: normalized base blend, then additive deltas on top.
    this.lastWeightChannels = finalizeWeightChannels(
      baseWeights,
      additiveWeightSamples,
    );

    return blended;
  }

  private get currentLane(): MixerLane | null {
    if (this.currentLaneId === null) {
      return null;
    }
    return this.laneList.find((lane) => lane.id === this.currentLaneId) ?? null;
  }

  private requireClip(method: string, clipId: string): AnimationClip {
    const clip = this.clips.get(clipId);
    if (clip === undefined) {
      throw new Error(`AnimationMixer.${method}: unknown clip id "${clipId}"`);
    }
    return clip;
  }

  private createLane(
    clipId: string,
    clip: AnimationClip,
    options: AnimationLaneOptions,
  ): MixerLane {
    const loop = options.loop ?? "repeat";
    const speed = Number.isFinite(options.speed) ? options.speed! : 1;
    const weight = Number.isFinite(options.weight)
      ? Math.max(0, options.weight!)
      : 1;
    const startTime = Number.isFinite(options.startTime)
      ? options.startTime!
      : 0;
    const lane = new MixerLane(
      this,
      `${clipId}#${this.nextLaneCounter}`,
      clipId,
      clip,
      options.additive ?? false,
      options.enabled ?? true,
      weight,
      speed,
      loop,
      startTime,
    );
    this.nextLaneCounter += 1;
    this.laneList.push(lane);
    return lane;
  }

  private advanceLane(lane: MixerLane, delta: number): void {
    const duration = lane.duration;
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
    lane: MixerLane,
    weight: number,
    baseSamples: WeightedAnimationClipSample[],
    additiveSamples: AdditiveAnimationClipSample[],
    baseWeights: Map<string, { value: number[]; weight: number }>,
    additiveWeightSamples: AdditiveAnimationClipSample[],
  ): void {
    for (const channel of lane.clip.channels) {
      const value = sampleAnimationChannel(channel, lane.time);

      if (channel.path === "weights") {
        if (lane.additive) {
          additiveWeightSamples.push({
            clipId: lane.clipId,
            targetId: channel.targetId,
            path: "translation", // path is unused for weight deltas
            weight,
            value: [...value],
          });
        } else {
          accumulateWeightChannel(baseWeights, channel.targetId, value, weight);
        }
        continue;
      }

      const sample: WeightedAnimationClipSample = {
        clipId: lane.clipId,
        targetId: channel.targetId,
        // Narrowed: non-"weights" paths are exactly AnimationBlendPath.
        path: channel.path as Exclude<AnimationChannelPath, "weights">,
        weight,
        value,
      };
      if (lane.additive) {
        additiveSamples.push(sample);
      } else {
        baseSamples.push(sample);
      }
    }
  }
}

function fadeValue(fade: LaneFade): number {
  if (fade.duration <= 0) {
    return fade.to;
  }
  const progress = clamp(fade.elapsed / fade.duration, 0, 1);
  return fade.from + (fade.to - fade.from) * progress;
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
  additiveWeightSamples: readonly AdditiveAnimationClipSample[],
): BlendedWeightChannel[] {
  // Base morph weights: normalized weighted average (matches v1).
  const base = new Map<string, number[]>();
  const totals = new Map<string, number>();
  for (const [targetId, entry] of weightContributors) {
    const totalWeight = entry.weight;
    base.set(
      targetId,
      totalWeight > 0
        ? entry.value.map((component) => component / totalWeight)
        : [...entry.value],
    );
    totals.set(targetId, totalWeight);
  }

  // Additive morph weights add `weight * delta` on top of the base weights.
  const combined = applyAdditiveWeightDeltas(base, additiveWeightSamples);
  for (const sample of additiveWeightSamples) {
    totals.set(
      sample.targetId,
      (totals.get(sample.targetId) ?? 0) + Math.max(0, sample.weight),
    );
  }

  const channels: BlendedWeightChannel[] = [];
  for (const [targetId, value] of combined) {
    channels.push({
      targetId,
      path: "weights",
      value,
      weight: Number((totals.get(targetId) ?? 0).toFixed(6)),
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
