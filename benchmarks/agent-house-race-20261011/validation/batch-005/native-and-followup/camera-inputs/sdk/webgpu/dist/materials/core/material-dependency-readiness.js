export function checkMaterialDependencyReadiness(input) {
    const diagnostics = [];
    if (input.dependencies.baseColorTextureKey !== null &&
        !input.availableTextureKeys.has(input.dependencies.baseColorTextureKey)) {
        diagnostics.push({
            code: "materialDependency.missingTextureResource",
            resourceKey: input.dependencies.baseColorTextureKey,
            message: `Missing texture resource '${input.dependencies.baseColorTextureKey}'.`,
        });
    }
    if (input.dependencies.baseColorSamplerKey !== null &&
        !input.availableSamplerKeys.has(input.dependencies.baseColorSamplerKey)) {
        diagnostics.push({
            code: "materialDependency.missingSamplerResource",
            resourceKey: input.dependencies.baseColorSamplerKey,
            message: `Missing sampler resource '${input.dependencies.baseColorSamplerKey}'.`,
        });
    }
    return {
        ready: diagnostics.length === 0,
        diagnostics,
    };
}
//# sourceMappingURL=material-dependency-readiness.js.map