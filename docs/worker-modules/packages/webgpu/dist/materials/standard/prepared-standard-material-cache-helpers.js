export function preparedScalarStandardMaterialCacheKey(input) {
    return [
        input.sourceMaterialKey,
        `version:${input.sourceVersion}`,
        `pipeline:${input.pipelineKey}`,
        `layout:${input.layoutKey}`,
    ].join("|");
}
export function preparedTexturedStandardMaterialCacheKey(input) {
    return [
        input.sourceMaterialKey,
        `version:${input.sourceVersion}`,
        `pipeline:${input.pipelineKey}`,
        `layout:${input.layoutKey}`,
        ...input.dependencyCacheKeySegments,
    ].join("|");
}
export function emptyStandardMaterialDependencies() {
    const empty = { textureKey: null, samplerKey: null, texCoord: 0 };
    return {
        baseColor: empty,
        metallicRoughness: empty,
        clearcoat: empty,
        clearcoatRoughness: empty,
        transmission: empty,
        sheenColor: empty,
        sheenRoughness: empty,
        iridescence: empty,
        iridescenceThickness: empty,
        normal: empty,
        occlusion: empty,
        emissive: empty,
    };
}
//# sourceMappingURL=prepared-standard-material-cache-helpers.js.map