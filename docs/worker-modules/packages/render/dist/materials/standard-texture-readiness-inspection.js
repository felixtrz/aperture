import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { STANDARD_TEXTURE_EXPECTATIONS, isSupportedStandardTexCoord, } from "./standard-texture-readiness-expectations.js";
import { inspectReadyStandardTexture, pushUnsupportedStandardTexCoordDiagnostic, } from "./standard-texture-readiness-texture.js";
import { cloneTextureTransform, isIdentityTextureTransform, isSupportedStandardTextureTransform, } from "./standard-texture-readiness-utils.js";
export function inspectStandardMaterialTextures(registry, materialKey, material) {
    const slots = [];
    const diagnostics = [];
    for (const expectation of STANDARD_TEXTURE_EXPECTATIONS) {
        inspectTextureBinding({
            registry,
            materialKey,
            binding: material[expectation.field],
            expectation,
            slots,
            diagnostics,
        });
    }
    return {
        ready: diagnostics.length === 0,
        materialKey,
        materialStatus: "ready",
        materialKind: material.kind,
        slots,
        diagnostics,
    };
}
function inspectTextureBinding(input) {
    if (input.binding === null) {
        return;
    }
    const texCoord = input.binding.texCoord ?? 0;
    const texCoordReady = isSupportedStandardTexCoord(texCoord);
    const textureKey = input.binding.texture === null
        ? undefined
        : assetHandleKey(input.binding.texture);
    const samplerKey = input.binding.sampler === null
        ? undefined
        : assetHandleKey(input.binding.sampler);
    if (input.binding.transform !== undefined &&
        !isIdentityTextureTransform(input.binding.transform) &&
        !isSupportedStandardTextureTransform({
            field: input.expectation.field,
            texCoord,
            transform: input.binding.transform,
        })) {
        input.diagnostics.push({
            code: "standardMaterialTexture.unsupportedTextureTransform",
            severity: "warning",
            materialKey: input.materialKey,
            ...(textureKey === undefined ? {} : { textureKey }),
            ...(samplerKey === undefined ? {} : { samplerKey }),
            field: input.expectation.field,
            expectedSemantic: input.expectation.semantic,
            expectedColorSpaces: input.expectation.colorSpaces,
            textureTransform: cloneTextureTransform(input.binding.transform),
            message: `StandardMaterial ${input.expectation.field} uses a texture transform that is not supported by current StandardMaterial shaders.`,
        });
    }
    if (input.binding.texture === null) {
        if (!texCoordReady) {
            pushUnsupportedStandardTexCoordDiagnostic({
                materialKey: input.materialKey,
                field: input.expectation.field,
                expectation: input.expectation,
                texCoord,
                diagnostics: input.diagnostics,
            });
        }
        input.diagnostics.push({
            code: "standardMaterialTexture.missingTextureHandle",
            severity: "warning",
            materialKey: input.materialKey,
            field: input.expectation.field,
            dependencyKind: "texture",
            status: "missing",
            ...(samplerKey === undefined ? {} : { samplerKey }),
            expectedSemantic: input.expectation.semantic,
            expectedColorSpaces: input.expectation.colorSpaces,
            message: `StandardMaterial ${input.expectation.field} is missing a texture handle.`,
        });
    }
    else if (!texCoordReady) {
        const readyTextureKey = assetHandleKey(input.binding.texture);
        pushUnsupportedStandardTexCoordDiagnostic({
            materialKey: input.materialKey,
            textureKey: readyTextureKey,
            field: input.expectation.field,
            expectation: input.expectation,
            texCoord,
            diagnostics: input.diagnostics,
        });
    }
    if (input.binding.texture !== null) {
        const readyTextureKey = assetHandleKey(input.binding.texture);
        const textureEntry = input.registry.get(input.binding.texture);
        const textureStatus = textureEntry?.status ?? "missing";
        if (textureEntry === undefined || textureEntry.asset === null) {
            input.diagnostics.push({
                code: "standardMaterialTexture.textureNotReady",
                severity: textureStatus === "failed" ? "error" : "warning",
                materialKey: input.materialKey,
                textureKey: readyTextureKey,
                ...(samplerKey === undefined ? {} : { samplerKey }),
                field: input.expectation.field,
                dependencyKind: "texture",
                status: textureStatus,
                expectedSemantic: input.expectation.semantic,
                expectedColorSpaces: input.expectation.colorSpaces,
                message: `StandardMaterial ${input.expectation.field} texture '${readyTextureKey}' is '${textureStatus}', not ready.`,
            });
        }
        else {
            inspectReadyStandardTexture({
                materialKey: input.materialKey,
                textureKey: readyTextureKey,
                texture: textureEntry.asset,
                expectation: input.expectation,
                texCoord,
                slots: input.slots,
                diagnostics: input.diagnostics,
            });
        }
    }
    if (input.binding.sampler === null) {
        input.diagnostics.push({
            code: "standardMaterialTexture.missingSamplerHandle",
            severity: "warning",
            materialKey: input.materialKey,
            ...(textureKey === undefined ? {} : { textureKey }),
            field: input.expectation.field,
            dependencyKind: "sampler",
            status: "missing",
            expectedSemantic: input.expectation.semantic,
            expectedColorSpaces: input.expectation.colorSpaces,
            message: `StandardMaterial ${input.expectation.field} is missing a sampler handle.`,
        });
        return;
    }
    const readySamplerKey = assetHandleKey(input.binding.sampler);
    const samplerEntry = input.registry.get(input.binding.sampler);
    const samplerStatus = samplerEntry?.status ?? "missing";
    if (samplerEntry === undefined || samplerEntry.asset === null) {
        input.diagnostics.push({
            code: "standardMaterialTexture.samplerNotReady",
            severity: samplerStatus === "failed" ? "error" : "warning",
            materialKey: input.materialKey,
            ...(textureKey === undefined ? {} : { textureKey }),
            samplerKey: readySamplerKey,
            field: input.expectation.field,
            dependencyKind: "sampler",
            status: samplerStatus,
            expectedSemantic: input.expectation.semantic,
            expectedColorSpaces: input.expectation.colorSpaces,
            message: `StandardMaterial ${input.expectation.field} sampler '${readySamplerKey}' is '${samplerStatus}', not ready.`,
        });
    }
}
//# sourceMappingURL=standard-texture-readiness-inspection.js.map