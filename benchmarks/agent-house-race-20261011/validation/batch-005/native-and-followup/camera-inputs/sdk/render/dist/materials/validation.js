import { materialTextureBindings } from "./bindings.js";
export function validateMaterialAsset(material) {
    const diagnostics = [];
    validateRenderState(material.renderState, diagnostics);
    for (const feature of material.unsupportedFeatures ?? []) {
        diagnostics.push({
            code: "material.unsupportedFeature",
            field: feature,
            message: `MVP materials do not support '${feature}'.`,
        });
    }
    for (const [field, binding] of materialTextureBindings(material)) {
        if (binding.texture === null) {
            diagnostics.push({
                code: "material.missingTextureHandle",
                field,
                message: `${field} is missing a texture handle.`,
            });
        }
        if (binding.sampler === null) {
            diagnostics.push({
                code: "material.missingSamplerHandle",
                field,
                message: `${field} is missing a sampler handle.`,
            });
        }
    }
    return {
        valid: diagnostics.length === 0,
        diagnostics,
    };
}
export function validateTextureAsset(texture) {
    const diagnostics = [];
    if (texture.colorSpace === "srgb" &&
        !["base-color", "emissive"].includes(texture.semantic)) {
        diagnostics.push({
            code: "material.invalidTextureColorSpace",
            field: "colorSpace",
            message: `${texture.semantic} textures must use linear or data color space, not srgb.`,
        });
    }
    if (textureFormatIsSrgb(texture.format) !== (texture.colorSpace === "srgb")) {
        diagnostics.push({
            code: "material.invalidTextureColorSpaceFormat",
            field: "format",
            message: `${texture.semantic} texture '${texture.label}' declares color space '${texture.colorSpace}' but uses format '${texture.format}'.`,
        });
    }
    return {
        valid: diagnostics.length === 0,
        diagnostics,
    };
}
function textureFormatIsSrgb(format) {
    return format.endsWith("-srgb");
}
function validateRenderState(renderState, diagnostics) {
    if (renderState.alphaCutoff < 0 || renderState.alphaCutoff > 1) {
        diagnostics.push({
            code: "material.invalidAlphaCutoff",
            field: "renderState.alphaCutoff",
            message: "Alpha cutoff must be between 0 and 1.",
        });
    }
    if (renderState.alphaMode === "blend" && renderState.depth.write) {
        diagnostics.push({
            code: "material.incompatibleRenderState",
            field: "renderState.depth.write",
            message: "Blend materials must disable depth writes.",
        });
    }
    if (renderState.alphaMode === "blend" &&
        renderState.blend.preset === "none") {
        diagnostics.push({
            code: "material.incompatibleRenderState",
            field: "renderState.blend",
            message: "Blend materials must use a non-none blend preset.",
        });
    }
}
//# sourceMappingURL=validation.js.map