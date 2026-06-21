import { audioAudibilityId, audioAudibilityValue, audioDistanceModelId, audioDistanceModelValue, audioPanningModelId, audioPanningModelValue, audioSimulationSpaceId, audioSimulationSpaceValue, audioVoiceKeyKindId, audioVoiceKeyKindValue, readEntity, readFloat64, readRequiredHandle, readSigned32, readVec3, writeEntity, writeFloat64, writeSigned32, writeVec3, } from "./snapshot-packed-codec-utils.js";
const AUDIO_FLAG_LOOP = 1 << 0;
const AUDIO_FLAG_AUTOPLAY = 1 << 1;
const AUDIO_FLAG_MUTED = 1 << 2;
const AUDIO_FLAG_HAS_SEED = 1 << 3;
const AUDIO_FLAG_HAS_BOUNDS_CENTER = 1 << 4;
const AUDIO_FLAG_HAS_AUDIBILITY_RADIUS = 1 << 5;
export function writeAudioEmitterPacket(words, offset, packet, registry) {
    words[offset] = audioVoiceKeyKindId(packet.key.kind);
    if (packet.key.kind === "entity") {
        words[offset + 1] = packet.key.id >>> 0;
    }
    else {
        writeSigned32(words, offset + 1, packet.key.seq);
    }
    writeEntity(words, offset + 2, packet.entity);
    words[offset + 4] = registry.handleId(packet.clip) >>> 0;
    words[offset + 5] = packet.clipVersion >>> 0;
    words[offset + 6] = registry.stringId(packet.busId) >>> 0;
    writeFloat64(words, offset + 7, packet.gain);
    words[offset + 9] = audioEmitterFlags(packet);
    writeSigned32(words, offset + 10, packet.playEpoch);
    writeSigned32(words, offset + 11, packet.stopEpoch);
    writeFloat64(words, offset + 12, packet.timeScale);
    writeSigned32(words, offset + 14, packet.priority);
    words[offset + 15] = audioPanningModelId(packet.panningModel);
    words[offset + 16] = audioSimulationSpaceId(packet.simulationSpace);
    words[offset + 17] = audioDistanceModelId(packet.distanceModel);
    writeFloat64(words, offset + 18, packet.refDistance);
    writeFloat64(words, offset + 20, packet.maxDistance);
    writeFloat64(words, offset + 22, packet.rolloffFactor);
    writeFloat64(words, offset + 24, packet.coneInnerAngle);
    writeFloat64(words, offset + 26, packet.coneOuterAngle);
    writeFloat64(words, offset + 28, packet.coneOuterGain);
    writeFloat64(words, offset + 30, packet.occlusion);
    writeFloat64(words, offset + 32, packet.lowpassFrequency);
    writeFloat64(words, offset + 34, packet.lowpassQ);
    writeFloat64(words, offset + 36, packet.offsetSec);
    writeFloat64(words, offset + 38, packet.loopStart);
    writeFloat64(words, offset + 40, packet.loopEnd);
    writeSigned32(words, offset + 42, packet.seed ?? 0);
    writeVec3(words, offset + 43, packet.boundsCenter ?? [0, 0, 0]);
    writeFloat64(words, offset + 49, packet.audibilityRadius ?? 0);
    words[offset + 51] = audioAudibilityId(packet.audibility);
    words[offset + 52] = packet.worldTransformOffset >>> 0;
    words[offset + 53] = packet.layerMask >>> 0;
}
export function readAudioEmitterPacket(words, offset, registry) {
    const keyKind = audioVoiceKeyKindValue(words[offset] ?? 0);
    const flags = words[offset + 9] ?? 0;
    const packet = {
        key: keyKind === "entity"
            ? { kind: "entity", id: words[offset + 1] ?? 0 }
            : { kind: "oneshot", seq: readSigned32(words, offset + 1) },
        entity: readEntity(words, offset + 2),
        clip: readRequiredHandle(registry, words[offset + 4] ?? 0, "audio-clip"),
        clipVersion: words[offset + 5] ?? 0,
        busId: registry.stringValue(words[offset + 6] ?? 0),
        gain: readFloat64(words, offset + 7),
        loop: (flags & AUDIO_FLAG_LOOP) !== 0,
        autoplay: (flags & AUDIO_FLAG_AUTOPLAY) !== 0,
        playEpoch: readSigned32(words, offset + 10),
        stopEpoch: readSigned32(words, offset + 11),
        timeScale: readFloat64(words, offset + 12),
        priority: readSigned32(words, offset + 14),
        panningModel: audioPanningModelValue(words[offset + 15] ?? 0),
        simulationSpace: audioSimulationSpaceValue(words[offset + 16] ?? 0),
        distanceModel: audioDistanceModelValue(words[offset + 17] ?? 0),
        refDistance: readFloat64(words, offset + 18),
        maxDistance: readFloat64(words, offset + 20),
        rolloffFactor: readFloat64(words, offset + 22),
        coneInnerAngle: readFloat64(words, offset + 24),
        coneOuterAngle: readFloat64(words, offset + 26),
        coneOuterGain: readFloat64(words, offset + 28),
        occlusion: readFloat64(words, offset + 30),
        lowpassFrequency: readFloat64(words, offset + 32),
        lowpassQ: readFloat64(words, offset + 34),
        offsetSec: readFloat64(words, offset + 36),
        loopStart: readFloat64(words, offset + 38),
        loopEnd: readFloat64(words, offset + 40),
        audibility: audioAudibilityValue(words[offset + 51] ?? 0),
        muted: (flags & AUDIO_FLAG_MUTED) !== 0,
        worldTransformOffset: words[offset + 52] ?? 0,
        layerMask: words[offset + 53] ?? 0,
    };
    return {
        ...packet,
        ...((flags & AUDIO_FLAG_HAS_SEED) === 0
            ? {}
            : { seed: readSigned32(words, offset + 42) }),
        ...((flags & AUDIO_FLAG_HAS_BOUNDS_CENTER) === 0
            ? {}
            : { boundsCenter: readVec3(words, offset + 43) }),
        ...((flags & AUDIO_FLAG_HAS_AUDIBILITY_RADIUS) === 0
            ? {}
            : { audibilityRadius: readFloat64(words, offset + 49) }),
    };
}
export function writeAudioListenerPacket(words, offset, packet) {
    words[offset] = packet.listenerId >>> 0;
    writeEntity(words, offset + 1, packet.entity);
    words[offset + 3] = packet.worldTransformOffset >>> 0;
    writeFloat64(words, offset + 4, packet.masterGain);
}
export function readAudioListenerPacket(words, offset) {
    return {
        listenerId: words[offset] ?? 0,
        entity: readEntity(words, offset + 1),
        worldTransformOffset: words[offset + 3] ?? 0,
        masterGain: readFloat64(words, offset + 4),
    };
}
function audioEmitterFlags(packet) {
    let flags = 0;
    if (packet.loop)
        flags |= AUDIO_FLAG_LOOP;
    if (packet.autoplay)
        flags |= AUDIO_FLAG_AUTOPLAY;
    if (packet.muted)
        flags |= AUDIO_FLAG_MUTED;
    if (packet.seed !== undefined)
        flags |= AUDIO_FLAG_HAS_SEED;
    if (packet.boundsCenter !== undefined)
        flags |= AUDIO_FLAG_HAS_BOUNDS_CENTER;
    if (packet.audibilityRadius !== undefined) {
        flags |= AUDIO_FLAG_HAS_AUDIBILITY_RADIUS;
    }
    return flags;
}
//# sourceMappingURL=snapshot-packed-audio-codec.js.map