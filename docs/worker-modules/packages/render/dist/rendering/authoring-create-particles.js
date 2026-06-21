import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { ParticleSimulationSpace, } from "./authoring-types.js";
export function createParticleEmitter(input) {
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
        boundsRadius: input.boundsRadius ?? 0,
        visible: input.visible ?? true,
    };
}
//# sourceMappingURL=authoring-create-particles.js.map