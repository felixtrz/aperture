import type {
  ParticleEffectHandle,
  Vec3Like,
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

export interface ParticleEmitterInput {
  readonly effect: ParticleEffectHandle;
  readonly capacity?: number;
  readonly seed?: number;
  readonly resetEpoch?: number;
  readonly timeScale?: number;
  readonly simulationSpace?: ParticleSimulationSpace;
  readonly boundsCenter?: Vec3Like;
  readonly boundsRadius?: number;
  readonly visible?: boolean;
}
