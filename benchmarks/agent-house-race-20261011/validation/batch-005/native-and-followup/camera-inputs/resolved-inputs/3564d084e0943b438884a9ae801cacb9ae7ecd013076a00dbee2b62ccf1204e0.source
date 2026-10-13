import { fogModeId, fogModeValue, readEntity, readFloat64, readVec4, writeEntity, writeFloat64, writeVec4, } from "./snapshot-packed-codec-utils.js";
export function writeFogPacket(words, offset, packet) {
    words[offset] = packet.fogId >>> 0;
    writeEntity(words, offset + 1, packet.entity);
    words[offset + 3] = fogModeId(packet.mode);
    writeVec4(words, offset + 4, packet.color);
    writeFloat64(words, offset + 12, packet.density);
    writeFloat64(words, offset + 14, packet.start);
    writeFloat64(words, offset + 16, packet.end);
    words[offset + 18] = packet.layerMask >>> 0;
}
export function readFogPacket(words, offset) {
    return {
        fogId: words[offset] ?? 0,
        entity: readEntity(words, offset + 1),
        mode: fogModeValue(words[offset + 3] ?? 0),
        color: readVec4(words, offset + 4),
        density: readFloat64(words, offset + 12),
        start: readFloat64(words, offset + 14),
        end: readFloat64(words, offset + 16),
        layerMask: words[offset + 18] ?? 0,
    };
}
//# sourceMappingURL=snapshot-packed-fog-codec.js.map