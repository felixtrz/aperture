import type {
  ParticleEffectHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";

export const ParticleSimulationSpace = {
  World: "world",
  Local: "local",
} as const;

export type ParticleSimulationSpace =
  (typeof ParticleSimulationSpace)[keyof typeof ParticleSimulationSpace];

export const ParticleBlendMode = {
  Opaque: "opaque",
  Alpha: "alpha",
  Additive: "additive",
  Multiply: "multiply",
} as const;

export type ParticleBlendMode =
  (typeof ParticleBlendMode)[keyof typeof ParticleBlendMode];

export interface ParticleEmitterBurstInput {
  /** Number of particles born together when this emitter epoch begins. */
  readonly count: number;
  /** Emitter-local particle origin. Defaults to the emitter origin. */
  readonly position?: Vec3Like;
  /** Emitter-local spawn-position jitter. */
  readonly positionJitter?: {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
  };
  /** Emitter-local launch-velocity override added to authored shape velocity. */
  readonly velocity?: {
    readonly min: Vec3Like;
    readonly max: Vec3Like;
  };
  /** Uniform multiplier over authored particle size. */
  readonly sizeScale?: number;
  /** Multiplier over authored launch speed. */
  readonly speedScale?: number;
  /** Multiplier over authored lifetime. */
  readonly lifetimeScale?: number;
  /** RGBA multiplier over the authored particle colour. */
  readonly color?: Vec4Like;
}

export interface ParticleEmitterInput {
  readonly effect: ParticleEffectHandle;
  readonly capacity?: number;
  readonly seed?: number;
  readonly resetEpoch?: number;
  /**
   * Absolute simulation time when the current reset epoch began. Supplying
   * this lets a fresh renderer reconstruct an in-progress one-shot exactly.
   */
  readonly lifecycleStartTime?: number;
  /**
   * Accumulated emitter-local playback time, before the effect's own
   * `simulationSpeed`.
   *
   * When supplied, this is the authoritative particle clock. Holding it
   * constant freezes an emitter without losing its current age, and a fresh
   * renderer can reconstruct the same frame after culling, device recovery,
   * snapshot restore, or an offline bundle handoff.
   */
  readonly playbackTime?: number;
  readonly timeScale?: number;
  readonly simulationSpace?: ParticleSimulationSpace;
  readonly boundsCenter?: Vec3Like;
  readonly boundsRadius?: number;
  readonly visible?: boolean;
  /**
   * Make this ECS emitter an explicit one-shot burst.
   *
   * The burst remains owned by the entity, including its transform,
   * `timeScale`, reset epoch, and lifecycle clock. This is the canonical path
   * for gameplay effects that must pause, resume, snapshot, and move with an
   * ECS-authored world root.
   */
  readonly burst?: ParticleEmitterBurstInput;
}
