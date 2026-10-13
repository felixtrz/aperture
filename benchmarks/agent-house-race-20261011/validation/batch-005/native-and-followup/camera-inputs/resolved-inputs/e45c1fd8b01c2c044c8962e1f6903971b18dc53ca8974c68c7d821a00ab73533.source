export function materialTextureBindings(material) {
    switch (material.kind) {
        case "unlit":
            return optionalBindings([
                ["baseColorTexture", material.baseColorTexture],
            ]);
        case "matcap":
            return [
                [
                    "matcapTexture",
                    material.matcapTexture ?? { texture: null, sampler: null },
                ],
            ];
        case "standard":
            return optionalBindings([
                ["baseColorTexture", material.baseColorTexture],
                ["metallicRoughnessTexture", material.metallicRoughnessTexture],
                ["clearcoatTexture", material.clearcoatTexture],
                ["clearcoatRoughnessTexture", material.clearcoatRoughnessTexture],
                ["transmissionTexture", material.transmissionTexture],
                ["sheenColorTexture", material.sheenColorTexture],
                ["sheenRoughnessTexture", material.sheenRoughnessTexture],
                ["iridescenceTexture", material.iridescenceTexture],
                ["iridescenceThicknessTexture", material.iridescenceThicknessTexture],
                ["normalTexture", material.normalTexture],
                ["occlusionTexture", material.occlusionTexture],
                ["emissiveTexture", material.emissiveTexture],
            ]);
        case "debug-normal":
            return [];
    }
}
function optionalBindings(bindings) {
    return bindings.filter((binding) => binding[1] !== null);
}
//# sourceMappingURL=bindings.js.map