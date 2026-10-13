export function createShadowTextureResourceReport(input) {
    const diagnostics = [];
    if (!input.descriptors.ready) {
        diagnostics.push({
            code: "shadowTextureResource.missingDescriptors",
            severity: "warning",
            message: "Shadow texture resource planning requires valid shadow-map descriptors.",
        });
    }
    const textures = input.descriptors.descriptors
        .filter((descriptor) => descriptor.ready)
        .map((descriptor) => {
        const layerCount = descriptor.layerCount ??
            (descriptor.lightKind === "directional"
                ? descriptor.cascadeCount
                : descriptor.faceCount);
        const layerBaseIndex = descriptor.layerBaseIndex ?? 0;
        const attachmentCount = descriptor.lightKind === "directional"
            ? descriptor.cascadeCount
            : descriptor.faceCount;
        return {
            shadowId: descriptor.shadowId,
            lightId: descriptor.lightId,
            lightKind: descriptor.lightKind,
            resourceKey: descriptor.resourceKey,
            textureKey: `${descriptor.resourceKey}:texture`,
            viewKey: `${descriptor.resourceKey}:view`,
            attachmentViewKeys: Array.from({ length: attachmentCount }, (_, index) => descriptor.viewDimension === "2d-array" &&
                descriptor.lightKind !== "directional"
                ? `${descriptor.resourceKey}:layer-${layerBaseIndex + index}:view`
                : descriptor.faceCount === 1 && descriptor.cascadeCount === 1
                    ? `${descriptor.resourceKey}:view`
                    : descriptor.lightKind === "directional"
                        ? `${descriptor.resourceKey}:cascade-${index}:view`
                        : `${descriptor.resourceKey}:face-${index}:view`),
            width: descriptor.textureWidth,
            height: descriptor.textureHeight,
            depthFormat: descriptor.depthFormat,
            filterRadiusTexels: descriptor.filterRadiusTexels,
            cascadeCount: descriptor.cascadeCount,
            layerCount,
            layerBaseIndex,
            ...(descriptor.atlasRegion === undefined
                ? {}
                : { atlasRegion: { ...descriptor.atlasRegion } }),
            faceCount: descriptor.faceCount,
            viewDimension: descriptor.viewDimension,
            usageIntent: "render-attachment",
            allocation: "deferred",
        };
    });
    if (textures.length > 0) {
        diagnostics.push({
            code: "shadowTextureResource.allocationDeferred",
            severity: "warning",
            message: "Shadow texture descriptors are planned, but live GPU texture allocation is not implemented yet.",
        });
    }
    return {
        ready: input.descriptors.ready,
        descriptorCount: input.descriptors.descriptorCount,
        textureCount: textures.length,
        sections: {
            shadowMapDescriptors: input.descriptors.ready,
            textureDescriptors: input.descriptors.ready,
            gpuAllocation: false,
        },
        textures,
        diagnostics,
    };
}
export function shadowTextureResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        descriptorCount: report.descriptorCount,
        textureCount: report.textureCount,
        sections: { ...report.sections },
        textures: report.textures.map((texture) => ({ ...texture })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowTextureResourceReportToJson(report) {
    return JSON.stringify(shadowTextureResourceReportToJsonValue(report));
}
//# sourceMappingURL=shadow-texture-resource.js.map