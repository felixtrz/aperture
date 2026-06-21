export async function createMeshoptDecoder(source) {
    const jsSource = await resolveMeshoptJsSource(source);
    const module = compileMeshoptFactory(jsSource)();
    if (!module.supported) {
        throw new Error("Meshopt decoder requires WebAssembly support.");
    }
    if (typeof module.decodeGltfBuffer !== "function") {
        throw new Error("Meshopt decoder did not expose decodeGltfBuffer().");
    }
    await module.ready;
    return {
        decodeGltfBuffer(sourceBytes, options) {
            const count = positiveInteger(options.count, "count");
            const byteStride = positiveInteger(options.byteStride, "byteStride");
            const bytes = bytesView(sourceBytes);
            const target = new Uint8Array(count * byteStride);
            module.decodeGltfBuffer(target, count, byteStride, bytes, options.mode, options.filter ?? "NONE");
            return target;
        },
    };
}
async function resolveMeshoptJsSource(source) {
    if (source.jsSource !== undefined) {
        return source.jsSource;
    }
    if (source.jsUrl === undefined) {
        throw new Error("Meshopt decoder requires jsSource or jsUrl.");
    }
    const fetcher = source.fetchText ?? defaultFetchText;
    return fetcher(source.jsUrl).then((text) => String(text));
}
function compileMeshoptFactory(jsSource) {
    const factoryBody = `${stripMeshoptExport(jsSource)}\nreturn MeshoptDecoder;`;
    const factory = Function(factoryBody)();
    if (!isMeshoptModule(factory)) {
        throw new Error("Meshopt JS source did not expose MeshoptDecoder.");
    }
    return () => factory;
}
function stripMeshoptExport(jsSource) {
    return jsSource.replace(/export\s*\{\s*MeshoptDecoder\s*\};?\s*$/u, "");
}
async function defaultFetchText(url) {
    if (globalThis.fetch === undefined) {
        throw new Error("No fetch implementation is available for Meshopt JS.");
    }
    const response = await globalThis.fetch(url);
    if (!response.ok) {
        throw new Error(`Fetching Meshopt JS failed with HTTP ${response.status}.`);
    }
    return response.text();
}
function bytesView(source) {
    return source instanceof ArrayBuffer
        ? new Uint8Array(source)
        : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}
function positiveInteger(value, field) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Meshopt decode ${field} must be a positive integer.`);
    }
    return value;
}
function isMeshoptModule(value) {
    return (isRecord(value) &&
        typeof value.supported === "boolean" &&
        typeof value.ready === "object" &&
        typeof value.decodeGltfBuffer === "function");
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=meshopt-decoder.js.map