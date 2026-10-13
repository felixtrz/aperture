import { GLB_BINARY_CHUNK_TYPE, GLB_JSON_CHUNK_TYPE, } from "./glb-container-types.js";
export function sourceToDataView(source) {
    if (source instanceof Uint8Array) {
        return new DataView(source.buffer, source.byteOffset, source.byteLength);
    }
    return new DataView(source);
}
export function sourceBytesForRange(source, byteOffset, byteLength) {
    if (source instanceof Uint8Array) {
        return new Uint8Array(source.buffer, source.byteOffset + byteOffset, byteLength);
    }
    return new Uint8Array(source, byteOffset, byteLength);
}
export function classifyChunkType(typeCode) {
    if (typeCode === GLB_JSON_CHUNK_TYPE) {
        return "json";
    }
    if (typeCode === GLB_BINARY_CHUNK_TYPE) {
        return "bin";
    }
    return "unknown";
}
export function decodeGlbJson(bytes) {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        return null;
    }
}
export function parseJsonObject(jsonText) {
    try {
        const parsed = JSON.parse(jsonText);
        if (parsed === null ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=glb-container-utils.js.map