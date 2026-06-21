import { encodeSnapshotPackets } from "./snapshot-packed-encoder.js";
import { decodeSnapshotPackets } from "./snapshot-packed-decoder.js";
export { createSnapshotPacketRegistry } from "./snapshot-packed-registry.js";
export { AUDIO_EMITTER_PACKET_WORDS, AUDIO_LISTENER_PACKET_WORDS, BOUNDS_PACKET_WORDS, ENVIRONMENT_PACKET_WORDS, FOG_PACKET_WORDS, LIGHT_PACKET_WORDS, MESH_DRAW_PACKET_WORDS, PARTICLE_EMITTER_PACKET_WORDS, QUAD_BATCH_PACKET_WORDS, SHADOW_REQUEST_PACKET_WORDS, SNAPSHOT_PACKET_BYTE_STRIDES, SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE, SNAPSHOT_PACKET_ENCODING_MAGIC, SNAPSHOT_PACKET_ENCODING_VERSION, SNAPSHOT_PACKET_HEADER_WORDS, SNAPSHOT_PACKET_WORD_STRIDES, VIEW_PACKET_WORDS, } from "./snapshot-packed-encoding-constants.js";
export { encodeSnapshotPackets, snapshotPacketWordLength, } from "./snapshot-packed-encoder.js";
export { decodeSnapshotPackets } from "./snapshot-packed-decoder.js";
export function encodePackets(packets, buffer, registry) {
    if (buffer !== undefined && registry !== undefined) {
        return encodeSnapshotPackets(packets, { buffer, registry });
    }
    if (buffer !== undefined) {
        return encodeSnapshotPackets(packets, { buffer });
    }
    if (registry !== undefined) {
        return encodeSnapshotPackets(packets, { registry });
    }
    return encodeSnapshotPackets(packets);
}
export function decodePackets(words, registry) {
    return decodeSnapshotPackets(words, registry);
}
//# sourceMappingURL=snapshot-packed-encoding.js.map