import { queueId, queueValue, readFloat64, readRequiredHandle, readSigned32, readVec3, writeFloat64, writeSigned32, writeVec3, } from "./snapshot-packed-codec-utils.js";
export function writeParticleEmitterPacket(words, offset, packet, registry) {
    words[offset] = packet.emitterId >>> 0;
    writeSigned32(words, offset + 1, packet.entity.index);
    words[offset + 2] = packet.entity.generation >>> 0;
    words[offset + 3] = registry.handleId(packet.effect) >>> 0;
    words[offset + 4] = packet.effectVersion >>> 0;
    words[offset + 5] = packet.capacity >>> 0;
    writeSigned32(words, offset + 6, packet.seed);
    words[offset + 7] = packet.resetEpoch >>> 0;
    writeFloat64(words, offset + 8, packet.timeScale);
    words[offset + 10] = particleSimulationSpaceId(packet.simulationSpace);
    words[offset + 11] = packet.worldTransformOffset >>> 0;
    words[offset + 12] = packet.boundsIndex >>> 0;
    words[offset + 13] = packet.layerMask >>> 0;
    words[offset + 14] =
        packet.mode === undefined ? 0 : particleEmitterModeId(packet.mode);
    words[offset + 15] = queueId(packet.sortKey.queue);
    words[offset + 16] = packet.sortKey.viewId >>> 0;
    writeSigned32(words, offset + 17, packet.sortKey.layer);
    writeSigned32(words, offset + 18, packet.sortKey.order);
    words[offset + 19] = registry.stringId(packet.sortKey.pipelineKey);
    words[offset + 20] = registry.stringId(packet.sortKey.materialKey);
    words[offset + 21] = registry.stringId(packet.sortKey.meshKey);
    writeFloat64(words, offset + 22, packet.sortKey.depth);
    words[offset + 24] = packet.sortKey.stableId >>> 0;
    const burst = packet.burst;
    words[offset + 25] = burst?.burstId ?? 0;
    words[offset + 26] = burst?.startFrame ?? 0;
    words[offset + 27] = burst?.count ?? 0;
    writeVec3(words, offset + 28, burst?.position ?? [0, 0, 0]);
    writeVec3(words, offset + 34, burst?.positionJitterMin ?? [0, 0, 0]);
    writeVec3(words, offset + 40, burst?.positionJitterMax ?? [0, 0, 0]);
    writeVec3(words, offset + 46, burst?.velocityMin ?? [0, 0, 0]);
    writeVec3(words, offset + 52, burst?.velocityMax ?? [0, 0, 0]);
    writeFloat64(words, offset + 58, burst?.startTime ?? 0);
}
export function readParticleEmitterPacket(words, offset, registry) {
    const mode = particleEmitterModeValue(words[offset + 14] ?? 0);
    const packet = {
        emitterId: words[offset] ?? 0,
        entity: {
            index: readSigned32(words, offset + 1),
            generation: words[offset + 2] ?? 0,
        },
        effect: readRequiredHandle(registry, words[offset + 3] ?? 0, "particle-effect"),
        effectVersion: words[offset + 4] ?? 0,
        capacity: words[offset + 5] ?? 0,
        seed: readSigned32(words, offset + 6),
        resetEpoch: words[offset + 7] ?? 0,
        timeScale: readFloat64(words, offset + 8),
        simulationSpace: particleSimulationSpaceValue(words[offset + 10] ?? 0),
        worldTransformOffset: words[offset + 11] ?? 0,
        boundsIndex: words[offset + 12] ?? 0,
        layerMask: words[offset + 13] ?? 0,
        sortKey: {
            queue: queueValue(words[offset + 15] ?? 0),
            viewId: words[offset + 16] ?? 0,
            layer: readSigned32(words, offset + 17),
            order: readSigned32(words, offset + 18),
            pipelineKey: registry.stringValue(words[offset + 19] ?? 0),
            materialKey: registry.stringValue(words[offset + 20] ?? 0),
            meshKey: registry.stringValue(words[offset + 21] ?? 0),
            depth: readFloat64(words, offset + 22),
            stableId: words[offset + 24] ?? 0,
        },
    };
    return {
        ...packet,
        ...(mode === undefined ? {} : { mode }),
        ...(mode !== "burst"
            ? {}
            : {
                burst: {
                    burstId: words[offset + 25] ?? 0,
                    startFrame: words[offset + 26] ?? 0,
                    startTime: readFloat64(words, offset + 58),
                    count: words[offset + 27] ?? 0,
                    position: readVec3(words, offset + 28),
                    positionJitterMin: readVec3(words, offset + 34),
                    positionJitterMax: readVec3(words, offset + 40),
                    velocityMin: readVec3(words, offset + 46),
                    velocityMax: readVec3(words, offset + 52),
                },
            }),
    };
}
function particleSimulationSpaceId(value) {
    switch (value) {
        case "world":
            return 1;
        case "local":
            return 2;
    }
}
function particleSimulationSpaceValue(id) {
    switch (id) {
        case 1:
            return "world";
        case 2:
            return "local";
        default:
            throw new RangeError(`Unknown particle simulation space id '${id}'.`);
    }
}
function particleEmitterModeId(value) {
    switch (value) {
        case "continuous":
            return 1;
        case "burst":
            return 2;
    }
}
function particleEmitterModeValue(id) {
    switch (id) {
        case 0:
            return undefined;
        case 1:
            return "continuous";
        case 2:
            return "burst";
        default:
            throw new RangeError(`Unknown particle emitter mode id '${id}'.`);
    }
}
//# sourceMappingURL=snapshot-packed-particle-codec.js.map