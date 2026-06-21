import { createSnapshotPacketRegistry } from "./snapshot-packed-registry.js";
import { writeAudioEmitterPacket, writeAudioListenerPacket, writeBoundsPacket, writeEnvironmentPacket, writeFogPacket, writeLightPacket, writeMeshDrawPacket, writeParticleEmitterPacket, writeQuadBatchPacket, writeShadowRequestPacket, writeViewPacket, } from "./snapshot-packed-codecs.js";
import { AUDIO_EMITTER_PACKET_WORDS, AUDIO_LISTENER_PACKET_WORDS, BOUNDS_PACKET_WORDS, ENVIRONMENT_PACKET_WORDS, FOG_PACKET_WORDS, LIGHT_PACKET_WORDS, MESH_DRAW_PACKET_WORDS, PARTICLE_EMITTER_PACKET_WORDS, QUAD_BATCH_PACKET_WORDS, SHADOW_REQUEST_PACKET_WORDS, SNAPSHOT_PACKET_HEADER_WORDS, VIEW_PACKET_WORDS, } from "./snapshot-packed-encoding-constants.js";
import { writeSnapshotPacketHeader } from "./snapshot-packed-encoding-header.js";
export function snapshotPacketWordLength(packets) {
    const shadowCasterDraws = packets.shadowCasterDraws ?? [];
    const quadBatches = packets.quadBatches ?? [];
    const fogs = packets.fogs ?? [];
    const particleEmitters = packets.particleEmitters ?? [];
    const audioEmitters = packets.audioEmitters ?? [];
    const audioListeners = packets.audioListener === undefined ? [] : [packets.audioListener];
    return (SNAPSHOT_PACKET_HEADER_WORDS +
        packets.views.length * VIEW_PACKET_WORDS +
        packets.meshDraws.length * MESH_DRAW_PACKET_WORDS +
        shadowCasterDraws.length * MESH_DRAW_PACKET_WORDS +
        packets.lights.length * LIGHT_PACKET_WORDS +
        packets.environments.length * ENVIRONMENT_PACKET_WORDS +
        fogs.length * FOG_PACKET_WORDS +
        particleEmitters.length * PARTICLE_EMITTER_PACKET_WORDS +
        audioEmitters.length * AUDIO_EMITTER_PACKET_WORDS +
        audioListeners.length * AUDIO_LISTENER_PACKET_WORDS +
        packets.shadowRequests.length * SHADOW_REQUEST_PACKET_WORDS +
        packets.bounds.length * BOUNDS_PACKET_WORDS +
        quadBatches.length * QUAD_BATCH_PACKET_WORDS);
}
export function encodeSnapshotPackets(packets, options = {}) {
    const registry = options.registry ?? createSnapshotPacketRegistry();
    const shadowCasterDraws = packets.shadowCasterDraws ?? [];
    const quadBatches = packets.quadBatches ?? [];
    const fogs = packets.fogs ?? [];
    const particleEmitters = packets.particleEmitters ?? [];
    const audioEmitters = packets.audioEmitters ?? [];
    const audioListeners = packets.audioListener === undefined ? [] : [packets.audioListener];
    const wordLength = snapshotPacketWordLength(packets);
    const buffer = options.buffer ?? new Uint32Array(wordLength);
    if (buffer.length < wordLength) {
        throw new RangeError(`Snapshot packet buffer is too small: requires ${wordLength} words, received ${buffer.length}.`);
    }
    const words = buffer.subarray(0, wordLength);
    let offset = SNAPSHOT_PACKET_HEADER_WORDS;
    writeSnapshotPacketHeader(words, {
        views: packets.views.length,
        meshDraws: packets.meshDraws.length,
        shadowCasterDraws: shadowCasterDraws.length,
        lights: packets.lights.length,
        environments: packets.environments.length,
        fogs: fogs.length,
        particleEmitters: particleEmitters.length,
        audioEmitters: audioEmitters.length,
        audioListeners: audioListeners.length,
        shadowRequests: packets.shadowRequests.length,
        bounds: packets.bounds.length,
        quadBatches: quadBatches.length,
    });
    for (const packet of packets.views) {
        writeViewPacket(words, offset, packet, registry);
        offset += VIEW_PACKET_WORDS;
    }
    for (const packet of packets.meshDraws) {
        writeMeshDrawPacket(words, offset, packet, registry);
        offset += MESH_DRAW_PACKET_WORDS;
    }
    for (const packet of shadowCasterDraws) {
        writeMeshDrawPacket(words, offset, packet, registry);
        offset += MESH_DRAW_PACKET_WORDS;
    }
    for (const packet of packets.lights) {
        writeLightPacket(words, offset, packet, registry);
        offset += LIGHT_PACKET_WORDS;
    }
    for (const packet of packets.environments) {
        writeEnvironmentPacket(words, offset, packet, registry);
        offset += ENVIRONMENT_PACKET_WORDS;
    }
    for (const packet of fogs) {
        writeFogPacket(words, offset, packet);
        offset += FOG_PACKET_WORDS;
    }
    for (const packet of particleEmitters) {
        writeParticleEmitterPacket(words, offset, packet, registry);
        offset += PARTICLE_EMITTER_PACKET_WORDS;
    }
    for (const packet of audioEmitters) {
        writeAudioEmitterPacket(words, offset, packet, registry);
        offset += AUDIO_EMITTER_PACKET_WORDS;
    }
    for (const packet of audioListeners) {
        writeAudioListenerPacket(words, offset, packet);
        offset += AUDIO_LISTENER_PACKET_WORDS;
    }
    for (const packet of packets.shadowRequests) {
        writeShadowRequestPacket(words, offset, packet);
        offset += SHADOW_REQUEST_PACKET_WORDS;
    }
    for (const packet of packets.bounds) {
        writeBoundsPacket(words, offset, packet);
        offset += BOUNDS_PACKET_WORDS;
    }
    for (const packet of quadBatches) {
        writeQuadBatchPacket(words, offset, packet, registry);
        offset += QUAD_BATCH_PACKET_WORDS;
    }
    return {
        words,
        registry,
        counts: {
            views: packets.views.length,
            meshDraws: packets.meshDraws.length,
            shadowCasterDraws: shadowCasterDraws.length,
            lights: packets.lights.length,
            environments: packets.environments.length,
            fogs: fogs.length,
            particleEmitters: particleEmitters.length,
            audioEmitters: audioEmitters.length,
            audioListeners: audioListeners.length,
            shadowRequests: packets.shadowRequests.length,
            bounds: packets.bounds.length,
            quadBatches: quadBatches.length,
        },
        wordLength,
        byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT,
    };
}
//# sourceMappingURL=snapshot-packed-encoder.js.map