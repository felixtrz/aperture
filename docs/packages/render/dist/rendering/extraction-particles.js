import { assetHandleKey, Enabled, transformPoint, WorldTransform, } from "@aperture-engine/simulation";
import { ParticleEmitter, ParticleSimulationSpace, RenderLayer, RenderOrder, Visibility, } from "./authoring.js";
import { validateParticleEffectAsset, } from "../assets/particles.js";
import { computeViewDepth, firstMatchingSortView, isVisibleInAnyMatchingView, } from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseParticleEffectHandle } from "./extraction-inputs.js";
import { pushMatrix, pushTranslationMatrix, readWorldMatrix, } from "./extraction-matrices.js";
import { createRenderSortKey, createStableRenderId, } from "./snapshot.js";
import { getParticleBurstQueue, particleBurstPositionRange, particleBurstVelocityRange, } from "./particle-burst-queue.js";
export function extractParticleEmitters(world, assets, frame, time, transforms, bounds, diagnostics, cameraLayerMask, viewCullContexts) {
    const query = world.queryManager.registerQuery({
        required: [ParticleEmitter],
    });
    const packets = [];
    for (const entity of sortedEntities(query.entities)) {
        if (entity.hasComponent(Enabled) &&
            entity.getValue(Enabled, "value") === false) {
            diagnostics.push(diagnostic("render.disabled", entity));
            continue;
        }
        if (entity.hasComponent(Visibility) &&
            entity.getValue(Visibility, "visible") === false) {
            diagnostics.push(diagnostic("render.invisible", entity));
            continue;
        }
        if (entity.getValue(ParticleEmitter, "visible") === false) {
            diagnostics.push(diagnostic("render.particle.invisible", entity));
            continue;
        }
        if (!entity.hasComponent(WorldTransform)) {
            diagnostics.push(diagnostic("render.missingWorldTransform", entity));
            continue;
        }
        const effect = parseParticleEffectHandle(entity.getValue(ParticleEmitter, "effectId") ?? "");
        if (effect === null) {
            diagnostics.push(diagnostic("render.particle.invalidEffect", entity));
            continue;
        }
        const effectEntry = assets.get(effect);
        if (effectEntry === undefined) {
            diagnostics.push(diagnostic("render.particle.effectMissing", entity, effect));
            continue;
        }
        if (effectEntry.status !== "ready" || effectEntry.asset === null) {
            diagnostics.push(diagnostic(`render.particle.effect.${effectEntry.status}`, entity, effect));
            continue;
        }
        const validation = validateParticleEffectAsset(effectEntry.asset);
        if (!validation.valid) {
            for (const particleDiagnostic of validation.diagnostics) {
                diagnostics.push(diagnostic(`render.${particleDiagnostic.code}`, entity, effect));
            }
            continue;
        }
        const layerMask = entity.hasComponent(RenderLayer)
            ? (entity.getValue(RenderLayer, "mask") ?? 1)
            : 1;
        if (layerMask === 0) {
            diagnostics.push(diagnostic("render.zeroLayerMask", entity));
            continue;
        }
        if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
            diagnostics.push(diagnostic("render.layerMismatch", entity));
            continue;
        }
        const authoredRadius = finiteNumber(entity.getValue(ParticleEmitter, "boundsRadius"), 0);
        const center = Array.from(entity.getVectorView(ParticleEmitter, "boundsCenter"));
        const worldMatrix = readWorldMatrix(entity);
        const radius = authoredRadius > 0
            ? authoredRadius
            : deriveContinuousParticleBoundsRadius({
                effect: effectEntry.asset,
                diagnostics,
                entity: entityRef(entity),
                effectKey: assetHandleKey(effect),
            });
        const boundsPacket = createParticleBoundsPacket(bounds.length, entity, worldMatrix, center, radius);
        if (!isVisibleInAnyMatchingView(boundsPacket.worldAabb, layerMask, viewCullContexts)) {
            continue;
        }
        const stableId = createStableRenderId(entityRef(entity));
        const effectKey = assetHandleKey(effect);
        const boundsIndex = bounds.length;
        const worldTransformOffset = pushMatrix(transforms, worldMatrix);
        const sortView = firstMatchingSortView(layerMask, viewCullContexts);
        const sortViewId = sortView?.viewId ?? 0;
        const sortDepth = sortView === undefined
            ? 0
            : computeViewDepth(sortView.viewMatrix, boundsPacket.worldSphere.center);
        const sortKey = createRenderSortKey({
            queue: "transparent",
            viewId: sortViewId,
            layer: layerMask,
            order: entity.hasComponent(RenderOrder)
                ? (entity.getValue(RenderOrder, "value") ?? 0)
                : 0,
            depth: sortDepth,
            pipelineKey: "gpu-particles",
            materialKey: effectKey,
            meshKey: "particle-quad",
            stableId,
        });
        const capacity = Math.trunc(finitePositive(entity.getValue(ParticleEmitter, "capacity"), effectEntry.asset.capacity));
        bounds.push(boundsPacket);
        packets.push({
            emitterId: stableId,
            entity: entityRef(entity),
            effect,
            effectVersion: effectEntry.version,
            capacity,
            seed: finiteInteger(entity.getValue(ParticleEmitter, "seed"), 1),
            resetEpoch: Math.max(0, finiteInteger(entity.getValue(ParticleEmitter, "resetEpoch"), 0)),
            timeScale: Math.max(0, finiteNumber(entity.getValue(ParticleEmitter, "timeScale"), 1)),
            simulationSpace: entity.getValue(ParticleEmitter, "simulationSpace") ===
                ParticleSimulationSpace.Local
                ? "local"
                : "world",
            worldTransformOffset,
            boundsIndex,
            layerMask,
            sortKey,
        });
    }
    const burstQueue = getParticleBurstQueue(world);
    if (burstQueue !== null) {
        extractParticleBursts({
            assets,
            frame,
            time,
            transforms,
            bounds,
            diagnostics,
            cameraLayerMask,
            viewCullContexts,
            bursts: burstQueue.drain({ frame, time, assets, diagnostics }),
        }, packets);
    }
    return packets;
}
function extractParticleBursts(input, packets) {
    for (const burst of input.bursts) {
        if (burst.request.count <= 0) {
            continue;
        }
        const effectEntry = input.assets.get(burst.effect);
        const effect = effectEntry?.asset;
        if (effectEntry?.status !== "ready" ||
            effect === undefined ||
            effect === null) {
            continue;
        }
        const layerMask = finiteInteger(burst.request.layerMask, 1);
        if (layerMask === 0) {
            continue;
        }
        if (input.cameraLayerMask !== 0 &&
            (layerMask & input.cameraLayerMask) === 0) {
            continue;
        }
        const position = [
            finiteNumber(burst.request.position[0], 0),
            finiteNumber(burst.request.position[1], 0),
            finiteNumber(burst.request.position[2], 0),
        ];
        const positionRange = particleBurstPositionRange(burst.request);
        const velocityRange = particleBurstVelocityRange(burst.request);
        const authoredRadius = finiteNumber(burst.request.boundsRadius, 0);
        const boundsPacket = authoredRadius > 0
            ? createParticleBurstBoundsPacket(input.bounds.length, particleBurstBoundsCenter(position, burst.request.boundsCenter), authoredRadius)
            : createAutomaticParticleBurstBoundsPacket({
                boundsId: input.bounds.length,
                position,
                positionRange,
                velocityRange,
                ...(burst.request.boundsCenter === undefined
                    ? {}
                    : { centerOverride: burst.request.boundsCenter }),
                effect,
                diagnostics: input.diagnostics,
                effectKey: assetHandleKey(burst.effect),
            });
        if (!isVisibleInAnyMatchingView(boundsPacket.worldAabb, layerMask, input.viewCullContexts)) {
            continue;
        }
        const stableId = 0x4000_0000 + (burst.seq & 0x0fff_ffff);
        const effectKey = assetHandleKey(burst.effect);
        const boundsIndex = input.bounds.length;
        const worldTransformOffset = pushTranslationMatrix(input.transforms, position);
        const sortView = firstMatchingSortView(layerMask, input.viewCullContexts);
        const sortViewId = sortView?.viewId ?? 0;
        const sortDepth = sortView === undefined
            ? 0
            : computeViewDepth(sortView.viewMatrix, boundsPacket.worldSphere.center);
        const sortKey = createRenderSortKey({
            queue: "transparent",
            viewId: sortViewId,
            layer: layerMask,
            depth: sortDepth,
            pipelineKey: "gpu-particles",
            materialKey: effectKey,
            meshKey: "particle-quad",
            stableId,
        });
        input.bounds.push(boundsPacket);
        packets.push({
            emitterId: stableId,
            entity: { index: -1, generation: 0 },
            effect: burst.effect,
            effectVersion: burst.effectVersion,
            capacity: Math.max(1, Math.trunc(burst.request.count)),
            seed: finiteInteger(burst.request.seed, burst.seq),
            resetEpoch: burst.startFrame,
            timeScale: Math.max(0, finiteNumber(burst.request.timeScale, 1)),
            simulationSpace: "world",
            worldTransformOffset,
            boundsIndex,
            layerMask,
            sortKey,
            mode: "burst",
            burst: {
                burstId: burst.seq,
                startFrame: burst.startFrame,
                startTime: burst.startTime,
                count: Math.max(1, Math.trunc(burst.request.count)),
                position,
                positionJitterMin: [
                    positionRange.min[0] - position[0],
                    positionRange.min[1] - position[1],
                    positionRange.min[2] - position[2],
                ],
                positionJitterMax: [
                    positionRange.max[0] - position[0],
                    positionRange.max[1] - position[1],
                    positionRange.max[2] - position[2],
                ],
                velocityMin: velocityRange.min,
                velocityMax: velocityRange.max,
            },
        });
    }
}
function createParticleBurstBoundsPacket(boundsId, center, radius) {
    const aabb = {
        min: [center[0] - radius, center[1] - radius, center[2] - radius],
        max: [center[0] + radius, center[1] + radius, center[2] + radius],
    };
    const sphere = { center, radius };
    return {
        boundsId,
        entity: { index: -1, generation: 0 },
        localAabb: aabb,
        worldAabb: aabb,
        localSphere: sphere,
        worldSphere: sphere,
    };
}
function createAutomaticParticleBurstBoundsPacket(input) {
    const lifetime = particleLifetimeMax(input.effect);
    const particleRadius = maxParticleBillboardRadius(input.effect);
    const x = particleDisplacementRange(input.velocityRange.min[0], input.velocityRange.max[0], input.effect.gravity[0], input.effect.linearDamping, lifetime);
    const y = particleDisplacementRange(input.velocityRange.min[1], input.velocityRange.max[1], input.effect.gravity[1], input.effect.linearDamping, lifetime);
    const z = particleDisplacementRange(input.velocityRange.min[2], input.velocityRange.max[2], input.effect.gravity[2], input.effect.linearDamping, lifetime);
    const worldAabb = {
        min: [
            input.positionRange.min[0] + x.min - particleRadius,
            input.positionRange.min[1] + y.min - particleRadius,
            input.positionRange.min[2] + z.min - particleRadius,
        ],
        max: [
            input.positionRange.max[0] + x.max + particleRadius,
            input.positionRange.max[1] + y.max + particleRadius,
            input.positionRange.max[2] + z.max + particleRadius,
        ],
    };
    const center = input.centerOverride === undefined
        ? aabbCenter(worldAabb)
        : particleBurstBoundsCenter(input.position, input.centerOverride);
    const radius = checkedAutoParticleBoundsRadius(farthestAabbCornerDistance(center, worldAabb), input.diagnostics, {
        effectKey: input.effectKey,
        mode: "burst",
    });
    const sphere = { center, radius };
    return {
        boundsId: input.boundsId,
        entity: { index: -1, generation: 0 },
        localAabb: worldAabb,
        worldAabb: sphereAabb(center, radius),
        localSphere: sphere,
        worldSphere: sphere,
    };
}
function createParticleBoundsPacket(boundsId, entity, worldMatrix, center, radius) {
    const worldCenter = transformPoint(worldMatrix, center);
    const worldRadius = radius * matrixMaxScale(worldMatrix);
    const localAabb = {
        min: [center[0] - radius, center[1] - radius, center[2] - radius],
        max: [center[0] + radius, center[1] + radius, center[2] + radius],
    };
    const worldAabb = {
        min: [
            worldCenter[0] - worldRadius,
            worldCenter[1] - worldRadius,
            worldCenter[2] - worldRadius,
        ],
        max: [
            worldCenter[0] + worldRadius,
            worldCenter[1] + worldRadius,
            worldCenter[2] + worldRadius,
        ],
    };
    const localSphere = { center, radius };
    return {
        boundsId,
        entity: entityRef(entity),
        localAabb,
        worldAabb,
        localSphere,
        worldSphere: { center: worldCenter, radius: worldRadius },
    };
}
function matrixMaxScale(matrix) {
    const sx = Math.hypot(matrix[0] ?? 1, matrix[1] ?? 0, matrix[2] ?? 0);
    const sy = Math.hypot(matrix[4] ?? 0, matrix[5] ?? 1, matrix[6] ?? 0);
    const sz = Math.hypot(matrix[8] ?? 0, matrix[9] ?? 0, matrix[10] ?? 1);
    const scale = Math.max(sx, sy, sz);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
const MIN_AUTO_PARTICLE_BOUNDS_RADIUS = 0.001;
const LARGE_AUTO_PARTICLE_BOUNDS_RADIUS = 256;
// Matches the continuous GPU particle drift term in PARTICLE_COMPUTE_WGSL.
const CONTINUOUS_PARTICLE_DRIFT_AMPLITUDE = 0.18;
function deriveContinuousParticleBoundsRadius(input) {
    const spawnRadius = Math.max(0.01, input.effect.startSpeed.max);
    const radius = maxParticleBillboardRadius(input.effect) +
        spawnRadius +
        CONTINUOUS_PARTICLE_DRIFT_AMPLITUDE;
    return checkedAutoParticleBoundsRadius(radius, input.diagnostics, {
        entity: input.entity,
        effectKey: input.effectKey,
        mode: "continuous",
    });
}
function checkedAutoParticleBoundsRadius(radius, diagnostics, context) {
    if (!Number.isFinite(radius) || radius <= 0) {
        diagnostics.push({
            code: "render.particle.boundsUnavailable",
            severity: "warning",
            ...(context.entity === undefined ? {} : { entity: context.entity }),
            assetKey: context.effectKey,
            field: "boundsRadius",
            message: `Could not derive conservative ${context.mode} particle bounds; using a 1 unit fallback radius.`,
        });
        return 1;
    }
    const result = Math.max(radius, MIN_AUTO_PARTICLE_BOUNDS_RADIUS);
    if (result > LARGE_AUTO_PARTICLE_BOUNDS_RADIUS) {
        diagnostics.push({
            code: "render.particle.boundsLarge",
            severity: "warning",
            ...(context.entity === undefined ? {} : { entity: context.entity }),
            assetKey: context.effectKey,
            field: "boundsRadius",
            message: `Derived ${context.mode} particle bounds radius ${result.toFixed(2)} is unusually large; set boundsRadius/boundsCenter explicitly if this is intentional.`,
        });
    }
    return result;
}
function particleLifetimeMax(effect) {
    return Math.max(0, effect.lifetime.min, effect.lifetime.max);
}
function maxParticleBillboardRadius(effect) {
    let maxCurve = 0;
    for (const value of effect.curves.sizeOverLifetime) {
        if (Number.isFinite(value)) {
            maxCurve = Math.max(maxCurve, value);
        }
    }
    return Math.max(MIN_AUTO_PARTICLE_BOUNDS_RADIUS, Math.max(0, effect.startSize.min, effect.startSize.max) *
        Math.max(0, maxCurve) *
        Math.SQRT1_2);
}
function particleDisplacementRange(velocityMin, velocityMax, gravity, damping, lifetime) {
    const candidates = [
        0,
        particleDisplacement(velocityMin, gravity, damping, lifetime),
        particleDisplacement(velocityMax, gravity, damping, lifetime),
    ];
    if (damping <= 0 && gravity !== 0) {
        const turningMin = -velocityMin / gravity;
        const turningMax = -velocityMax / gravity;
        if (turningMin > 0 && turningMin < lifetime) {
            candidates.push(particleDisplacement(velocityMin, gravity, damping, turningMin));
        }
        if (turningMax > 0 && turningMax < lifetime) {
            candidates.push(particleDisplacement(velocityMax, gravity, damping, turningMax));
        }
    }
    else if (damping > 0) {
        const turningMin = particleDampedTurningTime(velocityMin, gravity, damping);
        const turningMax = particleDampedTurningTime(velocityMax, gravity, damping);
        if (turningMin > 0 && turningMin < lifetime) {
            candidates.push(particleDisplacement(velocityMin, gravity, damping, turningMin));
        }
        if (turningMax > 0 && turningMax < lifetime) {
            candidates.push(particleDisplacement(velocityMax, gravity, damping, turningMax));
        }
    }
    return {
        min: Math.min(...candidates),
        max: Math.max(...candidates),
    };
}
function particleDisplacement(velocity, gravity, damping, time) {
    if (damping <= 0) {
        return velocity * time + 0.5 * gravity * time * time;
    }
    const decay = Math.exp(-damping * time);
    const invDamping = 1 / damping;
    return (velocity * (1 - decay) * invDamping +
        gravity * (time * invDamping - (1 - decay) * invDamping * invDamping));
}
function particleDampedTurningTime(velocity, gravity, damping) {
    if (damping <= 0 || gravity === 0) {
        return Number.NaN;
    }
    const denominator = gravity - damping * velocity;
    if (denominator === 0) {
        return Number.NaN;
    }
    const ratio = gravity / denominator;
    if (ratio <= 0 || ratio >= 1) {
        return Number.NaN;
    }
    return -Math.log(ratio) / damping;
}
function particleBurstBoundsCenter(position, centerOverride) {
    if (centerOverride === undefined) {
        return [...position];
    }
    return [
        position[0] + finiteNumber(centerOverride[0], 0),
        position[1] + finiteNumber(centerOverride[1], 0),
        position[2] + finiteNumber(centerOverride[2], 0),
    ];
}
function aabbCenter(aabb) {
    return [
        (aabb.min[0] + aabb.max[0]) * 0.5,
        (aabb.min[1] + aabb.max[1]) * 0.5,
        (aabb.min[2] + aabb.max[2]) * 0.5,
    ];
}
function farthestAabbCornerDistance(center, aabb) {
    const dx = Math.max(Math.abs(aabb.min[0] - center[0]), Math.abs(aabb.max[0] - center[0]));
    const dy = Math.max(Math.abs(aabb.min[1] - center[1]), Math.abs(aabb.max[1] - center[1]));
    const dz = Math.max(Math.abs(aabb.min[2] - center[2]), Math.abs(aabb.max[2] - center[2]));
    return Math.hypot(dx, dy, dz);
}
function sphereAabb(center, radius) {
    return {
        min: [center[0] - radius, center[1] - radius, center[2] - radius],
        max: [center[0] + radius, center[1] + radius, center[2] + radius],
    };
}
function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function finiteInteger(value, fallback) {
    return Number.isInteger(value) ? value : fallback;
}
function finitePositive(value, fallback) {
    const number = finiteNumber(value, fallback);
    return number > 0 ? number : fallback;
}
//# sourceMappingURL=extraction-particles.js.map