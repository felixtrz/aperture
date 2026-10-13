export function arrayBufferFromBytes(bytes) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}
export function bytesView(source) {
    if (source instanceof ArrayBuffer) {
        return new Uint8Array(source);
    }
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
export function featureSetHas(features, feature) {
    if (features === null || features === undefined) {
        return false;
    }
    if (typeof features.has === "function") {
        return features.has?.(feature) === true;
    }
    const iterator = features[Symbol.iterator];
    if (typeof iterator !== "function") {
        return false;
    }
    for (const candidate of features) {
        if (candidate === feature) {
            return true;
        }
    }
    return false;
}
export function readUint64(view, byteOffset) {
    const value = view.getBigUint64(byteOffset, true);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("KTX2 64-bit offset exceeds JavaScript's safe integer range.");
    }
    return Number(value);
}
//# sourceMappingURL=ktx2-utils.js.map