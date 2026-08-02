import {
  assetHandleKey,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  ParticleSimulationSpace,
  type ParticleEmitterInput,
} from "./authoring-types.js";
import type { ParticleEmitter } from "./authoring-components.js";

export function createParticleEmitter(
  input: ParticleEmitterInput,
): ComponentInitialData<typeof ParticleEmitter> {
  return {
    effectId: assetHandleKey(input.effect),
    capacity: input.capacity ?? 0,
    seed: input.seed ?? 1,
    resetEpoch: input.resetEpoch ?? 0,
    lifecycleStartTime: input.lifecycleStartTime ?? -1,
    playbackTime: input.playbackTime ?? -1,
    timeScale: input.timeScale ?? 1,
    simulationSpace: input.simulationSpace ?? ParticleSimulationSpace.World,
    boundsCenter: [
      input.boundsCenter?.[0] ?? 0,
      input.boundsCenter?.[1] ?? 0,
      input.boundsCenter?.[2] ?? 0,
    ],
    boundsRadius: input.boundsRadius ?? 0,
    visible: input.visible ?? true,
    burstCount: Math.max(0, Math.trunc(input.burst?.count ?? 0)),
    burstPosition: [
      input.burst?.position?.[0] ?? 0,
      input.burst?.position?.[1] ?? 0,
      input.burst?.position?.[2] ?? 0,
    ],
    burstPositionJitterMin: [
      input.burst?.positionJitter?.min[0] ?? 0,
      input.burst?.positionJitter?.min[1] ?? 0,
      input.burst?.positionJitter?.min[2] ?? 0,
    ],
    burstPositionJitterMax: [
      input.burst?.positionJitter?.max[0] ?? 0,
      input.burst?.positionJitter?.max[1] ?? 0,
      input.burst?.positionJitter?.max[2] ?? 0,
    ],
    burstVelocityMin: [
      input.burst?.velocity?.min[0] ?? 0,
      input.burst?.velocity?.min[1] ?? 0,
      input.burst?.velocity?.min[2] ?? 0,
    ],
    burstVelocityMax: [
      input.burst?.velocity?.max[0] ?? 0,
      input.burst?.velocity?.max[1] ?? 0,
      input.burst?.velocity?.max[2] ?? 0,
    ],
    burstSizeScale: input.burst?.sizeScale ?? 1,
    burstSpeedScale: input.burst?.speedScale ?? 1,
    burstLifetimeScale: input.burst?.lifetimeScale ?? 1,
    burstColor: [
      input.burst?.color?.[0] ?? 1,
      input.burst?.color?.[1] ?? 1,
      input.burst?.color?.[2] ?? 1,
      input.burst?.color?.[3] ?? 1,
    ],
  };
}
