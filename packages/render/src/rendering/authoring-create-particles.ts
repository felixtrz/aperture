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
    timeScale: input.timeScale ?? 1,
    simulationSpace: input.simulationSpace ?? ParticleSimulationSpace.World,
    boundsCenter: [
      input.boundsCenter?.[0] ?? 0,
      input.boundsCenter?.[1] ?? 0,
      input.boundsCenter?.[2] ?? 0,
    ],
    boundsRadius: input.boundsRadius ?? 1,
    visible: input.visible ?? true,
  };
}
