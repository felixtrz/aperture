export function gltfTextureMappingReportToJsonValue(report) {
    return {
        valid: report.valid,
        texture: report.texture === null ? null : textureAssetToJsonValue(report.texture),
        sampler: report.sampler === null ? null : { ...report.sampler },
        textureIndex: report.textureIndex,
        slot: report.slot,
        ...(report.imageIndex === undefined
            ? {}
            : { imageIndex: report.imageIndex }),
        ...(report.samplerIndex === undefined
            ? {}
            : { samplerIndex: report.samplerIndex }),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfTextureMappingReportToJson(report) {
    return JSON.stringify(gltfTextureMappingReportToJsonValue(report));
}
function textureAssetToJsonValue(texture) {
    return {
        ...texture,
        ...(texture.sourceData === undefined
            ? {}
            : {
                sourceData: {
                    byteLength: texture.sourceData.bytes.byteLength,
                    bytesPerRow: texture.sourceData.bytesPerRow,
                    ...(texture.sourceData.rowsPerImage === undefined
                        ? {}
                        : { rowsPerImage: texture.sourceData.rowsPerImage }),
                    ...(texture.sourceData.mipLevels === undefined
                        ? {}
                        : {
                            mipLevelCount: texture.sourceData.mipLevels.length,
                            mipLevels: texture.sourceData.mipLevels.map((level) => ({
                                byteLength: level.bytes.byteLength,
                                bytesPerRow: level.bytesPerRow,
                                ...(level.rowsPerImage === undefined
                                    ? {}
                                    : { rowsPerImage: level.rowsPerImage }),
                                width: level.width,
                                height: level.height,
                            })),
                        }),
                },
            }),
    };
}
//# sourceMappingURL=gltf-texture-report.js.map