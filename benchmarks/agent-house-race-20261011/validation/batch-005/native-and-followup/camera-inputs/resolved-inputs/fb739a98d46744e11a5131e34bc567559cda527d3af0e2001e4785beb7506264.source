import { getOrCreateParticleBurstQueue, } from "@aperture-engine/render";
export function createParticleAccess(options) {
    const queue = getOrCreateParticleBurstQueue(options.world);
    return {
        effect(id) {
            return options.assets.particleEffect(id);
        },
        emit(effect, emitOptions) {
            return queue.enqueue({
                ...emitOptions,
                effect: resolveParticleEffectHandle(effect),
            });
        },
        summary() {
            return queue.summary();
        },
    };
}
function resolveParticleEffectHandle(input) {
    if (typeof input === "object" && input !== null && "renderHandle" in input) {
        return input.renderHandle;
    }
    return input;
}
//# sourceMappingURL=particles.js.map