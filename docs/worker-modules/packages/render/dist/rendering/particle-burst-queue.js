import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { validateParticleEffectAsset, } from "../assets/particles.js";
const PARTICLE_BURST_QUEUE_GLOBAL = "aperture.render.particleBurstQueue";
const DEFAULT_MAX_ACTIVE = 1024;
const DEFAULT_MAX_PER_FRAME = 64;
const DEFAULT_FRAME_RATE = 60;
export function createParticleBurstQueue(options = {}) {
    const maxActive = Math.max(1, Math.trunc(options.maxActive ?? DEFAULT_MAX_ACTIVE));
    const maxPerFrame = Math.max(1, Math.trunc(options.maxPerFrame ?? DEFAULT_MAX_PER_FRAME));
    const pending = [];
    const active = [];
    let pendingHead = 0;
    let seqCounter = 1;
    let enqueued = 0;
    let promotedTotal = 0;
    let dropped = 0;
    let droppedSinceDrain = 0;
    let rejectedNotReady = 0;
    let rejectedInvalid = 0;
    return {
        enqueue(request) {
            if (active.length + pendingCount() >= maxActive) {
                dropped += 1;
                droppedSinceDrain += 1;
                return false;
            }
            pending.push(normalizeRequest(request));
            enqueued += 1;
            return true;
        },
        drain(input) {
            let promoted = 0;
            while (promoted < maxPerFrame &&
                pendingHead < pending.length &&
                active.length < maxActive) {
                const request = pending[pendingHead];
                pendingHead += 1;
                const effectEntry = input.assets.get(request.effect);
                const effect = effectEntry?.asset;
                if (effectEntry?.status !== "ready" ||
                    effect === undefined ||
                    effect === null) {
                    input.diagnostics.push({
                        code: "render.particle.burstEffectNotReady",
                        severity: "warning",
                        assetKey: assetHandleKey(request.effect),
                        message: `Dropped particle burst: effect '${assetHandleKey(request.effect)}' is not ready.`,
                    });
                    rejectedNotReady += 1;
                    continue;
                }
                const validation = validateParticleEffectAsset(effect);
                if (!validation.valid) {
                    input.diagnostics.push({
                        code: "render.particle.burstEffectInvalid",
                        severity: "warning",
                        assetKey: assetHandleKey(request.effect),
                        message: `Dropped particle burst: effect '${assetHandleKey(request.effect)}' is invalid.`,
                    });
                    rejectedInvalid += 1;
                    continue;
                }
                active.push({
                    seq: seqCounter++,
                    request,
                    effect: request.effect,
                    effectVersion: effectEntry.version,
                    startFrame: input.frame,
                    startTime: input.time,
                    ttlSeconds: particleBurstTtlSeconds(effect, request),
                });
                promoted += 1;
                promotedTotal += 1;
            }
            compactPendingRequests();
            let writeIndex = 0;
            for (let readIndex = 0; readIndex < active.length; readIndex += 1) {
                const burst = active[readIndex];
                if (input.time - burst.startTime <= burst.ttlSeconds) {
                    active[writeIndex] = burst;
                    writeIndex += 1;
                }
            }
            active.length = writeIndex;
            if (droppedSinceDrain > 0) {
                input.diagnostics.push({
                    code: "render.particle.burstOverflow",
                    severity: "warning",
                    message: `Dropped ${droppedSinceDrain} particle burst(s): queue at capacity (${maxActive}).`,
                });
                droppedSinceDrain = 0;
            }
            return [...active];
        },
        summary() {
            return {
                maxActive,
                maxPerFrame,
                pending: pendingCount(),
                active: active.length,
                enqueued,
                promoted: promotedTotal,
                dropped,
                rejectedNotReady,
                rejectedInvalid,
            };
        },
    };
    function pendingCount() {
        return pending.length - pendingHead;
    }
    function compactPendingRequests() {
        if (pendingHead === 0) {
            return;
        }
        if (pendingHead >= pending.length) {
            pending.length = 0;
            pendingHead = 0;
            return;
        }
        if (pendingHead < 64 && pendingHead * 2 < pending.length) {
            return;
        }
        pending.splice(0, pendingHead);
        pendingHead = 0;
    }
}
export function installParticleBurstQueue(world, queue = createParticleBurstQueue()) {
    world.globals[PARTICLE_BURST_QUEUE_GLOBAL] = queue;
    return queue;
}
export function getParticleBurstQueue(world) {
    const queue = world.globals[PARTICLE_BURST_QUEUE_GLOBAL];
    return isParticleBurstQueue(queue) ? queue : null;
}
export function getOrCreateParticleBurstQueue(world) {
    return getParticleBurstQueue(world) ?? installParticleBurstQueue(world);
}
export function particleBurstPositionRange(request) {
    const position = tuple3(request.position);
    const jitter = request.positionJitter;
    if (jitter === undefined) {
        return { min: position, max: position };
    }
    const min = tuple3(jitter.min);
    const max = tuple3(jitter.max);
    return {
        min: [position[0] + min[0], position[1] + min[1], position[2] + min[2]],
        max: [position[0] + max[0], position[1] + max[1], position[2] + max[2]],
    };
}
export function particleBurstVelocityRange(request) {
    if (request.velocity === undefined) {
        return {
            min: [0, 0, 0],
            max: [0, 0, 0],
        };
    }
    return {
        min: tuple3(request.velocity.min),
        max: tuple3(request.velocity.max),
    };
}
function particleBurstTtlSeconds(effect, request) {
    const lifetimeSeconds = Math.max(effect.lifetime.max, 0.001);
    const timeScale = Math.max(0.001, finite(request.timeScale ?? 1));
    return lifetimeSeconds / timeScale + 2 / DEFAULT_FRAME_RATE;
}
function normalizeRequest(request) {
    return {
        ...request,
        count: Math.max(0, Math.trunc(request.count)),
        position: tuple3(request.position),
        ...(request.timeScale === undefined
            ? {}
            : { timeScale: Math.max(0, finite(request.timeScale)) }),
        ...(request.positionJitter === undefined
            ? {}
            : {
                positionJitter: {
                    min: tuple3(request.positionJitter.min),
                    max: tuple3(request.positionJitter.max),
                },
            }),
        ...(request.velocity === undefined
            ? {}
            : {
                velocity: {
                    min: tuple3(request.velocity.min),
                    max: tuple3(request.velocity.max),
                },
            }),
        ...(request.boundsCenter === undefined
            ? {}
            : { boundsCenter: tuple3(request.boundsCenter) }),
    };
}
function tuple3(values) {
    return [finite(values[0]), finite(values[1]), finite(values[2])];
}
function finite(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function isParticleBurstQueue(value) {
    return (typeof value === "object" &&
        value !== null &&
        "enqueue" in value &&
        "drain" in value &&
        "summary" in value);
}
//# sourceMappingURL=particle-burst-queue.js.map