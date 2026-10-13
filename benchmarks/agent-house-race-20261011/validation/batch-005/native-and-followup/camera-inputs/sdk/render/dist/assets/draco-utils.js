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
//# sourceMappingURL=draco-utils.js.map