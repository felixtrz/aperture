import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createStandardMaterialNormalMapTangentReadinessReport, createStandardMaterialTextureReadinessReport, } from "../materials/index.js";
import { entityRef } from "./extraction-diagnostics.js";
export function validateStandardNormalMapReadiness(input) {
    if (input.material.kind !== "standard") {
        return true;
    }
    const report = createStandardMaterialNormalMapTangentReadinessReport({
        mesh: input.mesh,
        material: input.material,
        meshKey: input.meshKey,
        materialKey: input.materialKey,
    });
    if (report.ready) {
        return true;
    }
    for (const readinessDiagnostic of report.diagnostics) {
        input.diagnostics.push({
            code: `render.${readinessDiagnostic.code}`,
            severity: readinessDiagnostic.severity,
            entity: entityRef(input.entity),
            assetKey: input.materialKey,
            message: readinessDiagnostic.message,
        });
    }
    return false;
}
export function validateStandardMaterialTextureReadiness(input) {
    const report = createStandardMaterialTextureReadinessReport({
        registry: input.registry,
        material: input.material,
    });
    if (report.ready) {
        return true;
    }
    for (const readinessDiagnostic of report.diagnostics) {
        input.diagnostics.push({
            code: `render.${readinessDiagnostic.code}`,
            severity: readinessDiagnostic.severity,
            entity: entityRef(input.entity),
            assetKey: readinessDiagnostic.materialKey,
            materialKey: readinessDiagnostic.materialKey,
            ...(readinessDiagnostic.textureKey === undefined
                ? {}
                : { textureKey: readinessDiagnostic.textureKey }),
            ...(readinessDiagnostic.samplerKey === undefined
                ? {}
                : { samplerKey: readinessDiagnostic.samplerKey }),
            ...(readinessDiagnostic.field === undefined
                ? {}
                : { field: readinessDiagnostic.field }),
            ...(readinessDiagnostic.dependencyKind === undefined
                ? {}
                : { dependencyKind: readinessDiagnostic.dependencyKind }),
            ...(readinessDiagnostic.status === undefined
                ? {}
                : { status: readinessDiagnostic.status }),
            ...(readinessDiagnostic.expectedSemantic === undefined
                ? {}
                : { expectedSemantic: readinessDiagnostic.expectedSemantic }),
            ...(readinessDiagnostic.actualSemantic === undefined
                ? {}
                : { actualSemantic: readinessDiagnostic.actualSemantic }),
            ...(readinessDiagnostic.expectedColorSpaces === undefined
                ? {}
                : {
                    expectedColorSpaces: [...readinessDiagnostic.expectedColorSpaces],
                }),
            ...(readinessDiagnostic.actualColorSpace === undefined
                ? {}
                : { actualColorSpace: readinessDiagnostic.actualColorSpace }),
            ...(readinessDiagnostic.texCoord === undefined
                ? {}
                : { texCoord: readinessDiagnostic.texCoord }),
            ...(readinessDiagnostic.supportedTexCoords === undefined
                ? {}
                : {
                    supportedTexCoords: [...readinessDiagnostic.supportedTexCoords],
                }),
            ...(readinessDiagnostic.textureTransform === undefined
                ? {}
                : {
                    textureTransform: {
                        ...readinessDiagnostic.textureTransform,
                        ...(readinessDiagnostic.textureTransform.offset === undefined
                            ? {}
                            : {
                                offset: [
                                    readinessDiagnostic.textureTransform.offset[0],
                                    readinessDiagnostic.textureTransform.offset[1],
                                ],
                            }),
                        ...(readinessDiagnostic.textureTransform.scale === undefined
                            ? {}
                            : {
                                scale: [
                                    readinessDiagnostic.textureTransform.scale[0],
                                    readinessDiagnostic.textureTransform.scale[1],
                                ],
                            }),
                    },
                }),
            message: readinessDiagnostic.message,
        });
    }
    return false;
}
export function validateStandardMaterialUvSetReadiness(input) {
    if (!usesStandardTexCoord1(input.material)) {
        return true;
    }
    if (meshHasSemantic(input.mesh, "TEXCOORD_1")) {
        return true;
    }
    for (const [field, binding] of standardMaterialTextureBindings(input.material)) {
        if (binding === null || binding.texture === null) {
            continue;
        }
        const texCoord = binding.texCoord ?? 0;
        if (texCoord !== 1) {
            continue;
        }
        const textureKey = assetHandleKey(binding.texture);
        input.diagnostics.push({
            code: "render.standardMaterialTexture.missingTexCoord1",
            severity: "warning",
            entity: entityRef(input.entity),
            assetKey: input.materialKey,
            materialKey: input.materialKey,
            meshKey: input.meshKey,
            textureKey,
            field,
            texCoord,
            message: `StandardMaterial ${field} uses TEXCOORD_1 texture '${textureKey}', but mesh '${input.meshKey}' does not provide a TEXCOORD_1 vertex attribute.`,
        });
    }
    return false;
}
function usesStandardTexCoord1(material) {
    return standardMaterialTextureBindings(material).some(([, binding]) => {
        return (binding !== null &&
            binding.texture !== null &&
            (binding.texCoord ?? 0) === 1);
    });
}
function standardMaterialTextureBindings(material) {
    return [
        ["baseColorTexture", material.baseColorTexture],
        ["metallicRoughnessTexture", material.metallicRoughnessTexture],
        ["normalTexture", material.normalTexture],
        ["occlusionTexture", material.occlusionTexture],
        ["emissiveTexture", material.emissiveTexture],
    ];
}
function meshHasSemantic(mesh, semantic) {
    return mesh.vertexStreams.some((stream) => stream.attributes.some((attribute) => attribute.semantic === semantic));
}
//# sourceMappingURL=extraction-standard-material-validation.js.map