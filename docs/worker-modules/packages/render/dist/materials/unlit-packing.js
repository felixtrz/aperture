import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export const UNLIT_MATERIAL_UNIFORM_FLOATS = 4;
export const UNLIT_MATERIAL_UNIFORM_LAYOUT = [
    "baseColorFactor.r",
    "baseColorFactor.g",
    "baseColorFactor.b",
    "baseColorFactor.a",
];
export function packUnlitMaterial(material) {
    if (material.kind !== "unlit") {
        return {
            valid: false,
            packed: null,
            diagnostics: [
                {
                    code: "materialPack.unsupportedMaterialKind",
                    field: "kind",
                    message: `Unlit material packing does not support '${material.kind}' materials.`,
                },
            ],
        };
    }
    const diagnostics = [];
    const dependencies = collectUnlitDependencies(material.baseColorTexture, diagnostics);
    const packed = {
        uniform: new Float32Array([
            readColor(material, 0),
            readColor(material, 1),
            readColor(material, 2),
            readColor(material, 3),
        ]),
        uniformLayout: UNLIT_MATERIAL_UNIFORM_LAYOUT,
        dependencies,
    };
    return {
        valid: diagnostics.length === 0,
        packed: diagnostics.length === 0 ? packed : null,
        diagnostics,
    };
}
function collectUnlitDependencies(binding, diagnostics) {
    if (binding === null) {
        return { baseColorTextureKey: null, baseColorSamplerKey: null };
    }
    if (binding.texture === null) {
        diagnostics.push({
            code: "materialPack.missingTextureHandle",
            field: "baseColorTexture.texture",
            message: "Unlit base color texture binding is missing a texture handle.",
        });
    }
    if (binding.sampler === null) {
        diagnostics.push({
            code: "materialPack.missingSamplerHandle",
            field: "baseColorTexture.sampler",
            message: "Unlit base color texture binding is missing a sampler handle.",
        });
    }
    return {
        baseColorTextureKey: binding.texture === null ? null : assetHandleKey(binding.texture),
        baseColorSamplerKey: binding.sampler === null ? null : assetHandleKey(binding.sampler),
    };
}
function readColor(material, index) {
    const value = material.baseColorFactor[index];
    if (value === undefined) {
        throw new RangeError(`Unlit baseColorFactor is missing value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=unlit-packing.js.map