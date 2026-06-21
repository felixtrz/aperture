export function bytesForImageSource(input) {
    if (input.source.kind === "uri") {
        if (input.source.uri.startsWith("data:")) {
            return { ok: true };
        }
        const bytes = input.externalImageBytes.get(input.imageIndex);
        if (bytes === undefined) {
            return {
                ok: false,
                diagnostic: {
                    code: "loadGlbFromUri.imageReadFailed",
                    severity: "error",
                    imageIndex: input.imageIndex,
                    uri: input.source.uri,
                    message: `GLB image ${input.imageIndex} URI '${input.source.uri}' bytes were not available.`,
                },
            };
        }
        return { ok: true, bytes };
    }
    const bytes = bufferViewBytesForImageSource({
        root: input.root,
        binary: input.binary,
        bufferViewIndex: input.source.bufferView,
        externalBufferBytes: input.externalBufferBytes,
    });
    if (!bytes.ok) {
        return {
            ok: false,
            diagnostic: {
                code: "loadGlbFromUri.imageReadFailed",
                severity: "error",
                imageIndex: input.imageIndex,
                uri: `bufferView:${input.source.bufferView}`,
                message: bytes.message,
            },
        };
    }
    return { ok: true, bytes: bytes.bytes };
}
export function byteLengthOf(bytes) {
    return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}
function bytesView(bytes) {
    return bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function bufferViewBytesForImageSource(input) {
    const bufferViews = Array.isArray(input.root.bufferViews)
        ? input.root.bufferViews
        : [];
    const bufferView = bufferViews[input.bufferViewIndex];
    if (!isRecord(bufferView)) {
        return {
            ok: false,
            message: `GLB image bufferView ${input.bufferViewIndex} is missing or malformed.`,
        };
    }
    const bufferIndex = typeof bufferView.buffer === "number" && Number.isInteger(bufferView.buffer)
        ? bufferView.buffer
        : null;
    const byteOffset = typeof bufferView.byteOffset === "number" &&
        Number.isInteger(bufferView.byteOffset)
        ? bufferView.byteOffset
        : 0;
    const byteLength = typeof bufferView.byteLength === "number" &&
        Number.isInteger(bufferView.byteLength)
        ? bufferView.byteLength
        : null;
    if (bufferIndex === null || byteOffset < 0 || byteLength === null) {
        return {
            ok: false,
            message: `GLB image bufferView ${input.bufferViewIndex} has invalid byte layout.`,
        };
    }
    const bufferBytes = glbBufferBytes({
        root: input.root,
        binary: input.binary,
        bufferIndex,
        externalBufferBytes: input.externalBufferBytes,
    });
    if (bufferBytes === null) {
        return {
            ok: false,
            message: `GLB image bufferView ${input.bufferViewIndex} references unavailable buffer ${bufferIndex}.`,
        };
    }
    const view = bytesView(bufferBytes);
    const byteEnd = byteOffset + byteLength;
    if (byteEnd > view.byteLength) {
        return {
            ok: false,
            message: `GLB image bufferView ${input.bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
        };
    }
    return { ok: true, bytes: view.subarray(byteOffset, byteEnd) };
}
function glbBufferBytes(input) {
    const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
    const buffer = buffers[input.bufferIndex];
    const isExternal = isRecord(buffer) && typeof buffer.uri === "string";
    if (isExternal) {
        return input.externalBufferBytes.get(input.bufferIndex) ?? null;
    }
    return input.bufferIndex === 0 ? input.binary : null;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=glb-uri-image-bytes.js.map