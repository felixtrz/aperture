export function createGlbSourceLoaderStatusJsonValue(options) {
    return {
        status: options.status,
        sourceKind: options.sourceKind ?? "unknown",
        byteLength: options.byteLength ?? null,
        externalBuffers: options.externalBuffers?.map((buffer) => ({
            ...buffer,
        })) ?? [],
        diagnostics: options.diagnostics?.map((diagnostic) => ({
            ...diagnostic,
        })) ?? [],
        glbSourceStatus: options.glbSourceStatus ?? null,
    };
}
//# sourceMappingURL=glb-source-loader-status.js.map