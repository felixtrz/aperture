import { decodeGltfPrimitiveAccessors, } from "./gltf-accessor-decoding.js";
import { validateGltfPrimitiveAccessorReferences } from "./gltf-accessor-validation.js";
import { createGltfMeshPrimitiveMappingReport, } from "./gltf-mesh-primitive.js";
import { createMeshAssetsFromGltfDecodedAccessors, } from "./gltf-mesh-asset-construction.js";
import { importGltfMorphTargets } from "./gltf-morph-target-import.js";
import { resolvedExternalBufferByteLengths } from "./gltf-report-driven-import-buffers.js";
import { decodeGltfDracoPrimitiveAccessors } from "./gltf-report-driven-import-draco.js";
import { decodeGltfMeshoptBufferViews } from "./gltf-report-driven-import-meshopt.js";
export function createGltfReportDrivenMeshReports(options) {
    const meshoptBuffers = decodeGltfMeshoptBufferViews({
        root: options.root,
        decoder: options.meshoptDecoder,
        resolveBufferBytes: options.resolveBufferBytes ?? (() => null),
    });
    const meshRoot = meshoptBuffers.root;
    const resolveMeshBufferBytes = meshoptBuffers.resolveBufferBytes;
    const meshPrimitive = createGltfMeshPrimitiveMappingReport({
        root: meshRoot,
        ...(options.keyPrefix === undefined
            ? {}
            : { keyPrefix: options.keyPrefix }),
        ...(options.dracoDecoder === undefined
            ? {}
            : {
                supportedCompressedPrimitiveExtensions: [
                    "KHR_draco_mesh_compression",
                ],
            }),
    });
    const accessorValidation = validateGltfPrimitiveAccessorReferences({
        root: meshRoot,
        primitiveReport: meshPrimitive,
        ...resolvedExternalBufferByteLengths({
            ...options,
            root: meshRoot,
            resolveBufferBytes: resolveMeshBufferBytes,
        }),
    });
    const uncompressedAccessorDecoding = decodeGltfPrimitiveAccessors({
        validationReport: accessorValidation,
        resolveBufferBytes: resolveMeshBufferBytes,
        storageMode: options.accessorStorageMode ?? "source-view",
    });
    const dracoAccessorDecoding = decodeGltfDracoPrimitiveAccessors({
        root: meshRoot,
        primitiveReport: meshPrimitive,
        decoder: options.dracoDecoder,
        resolveBufferBytes: resolveMeshBufferBytes,
    });
    const accessorDecoding = mergeAccessorDecodingReports(mergeAccessorDecodingReports(uncompressedAccessorDecoding, dracoAccessorDecoding), {
        valid: meshoptBuffers.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        primitives: [],
        diagnostics: meshoptBuffers.diagnostics,
    });
    const morphTargetImport = importGltfMorphTargets({
        root: meshRoot,
        resolveBufferBytes: resolveMeshBufferBytes,
    });
    const morphTargetDataFor = new Map();
    for (const primitive of morphTargetImport.primitives) {
        morphTargetDataFor.set(`${primitive.meshIndex}:${primitive.primitiveIndex}`, {
            targetCount: primitive.targetCount,
            vertexCount: primitive.vertexCount,
            hasNormals: primitive.hasNormals,
            positionDeltas: primitive.positionDeltas,
            normalDeltas: primitive.normalDeltas,
        });
    }
    const meshConstruction = createMeshAssetsFromGltfDecodedAccessors({
        decodedReport: accessorDecoding,
        generateMissingTangentsFor: createMissingTangentGenerationRequests(meshRoot, meshPrimitive),
        generateMissingNormalsFor: createMissingNormalGenerationRequests(meshRoot, meshPrimitive),
        ...(morphTargetDataFor.size === 0 ? {} : { morphTargetDataFor }),
    });
    return {
        meshPrimitive,
        accessorValidation,
        accessorDecoding,
        meshConstruction,
    };
}
function mergeAccessorDecodingReports(first, second) {
    return {
        valid: first.valid && second.valid,
        primitives: [...first.primitives, ...second.primitives],
        diagnostics: [...first.diagnostics, ...second.diagnostics],
    };
}
function createMissingTangentGenerationRequests(root, meshPrimitive) {
    if (!isRecord(root) || !Array.isArray(root.materials)) {
        return [];
    }
    const requests = [];
    for (const mesh of meshPrimitive.meshes) {
        if (mesh.materialIndex === null ||
            !gltfMaterialNeedsTangents(root.materials, mesh.materialIndex)) {
            continue;
        }
        requests.push({
            meshIndex: mesh.meshIndex,
            primitiveIndex: mesh.primitiveIndex,
            reason: "normalTexture",
        });
    }
    return requests;
}
function gltfMaterialNeedsTangents(materials, materialIndex) {
    const material = materials[materialIndex];
    return isRecord(material) && isRecord(material.normalTexture);
}
function createMissingNormalGenerationRequests(root, meshPrimitive) {
    if (!isRecord(root) || !Array.isArray(root.materials)) {
        return [];
    }
    const requests = [];
    for (const mesh of meshPrimitive.meshes) {
        // Only lit (non-unlit) materials shade against normals; unlit primitives
        // are left untouched so their vertex layout is unchanged. If NORMAL is
        // already present the construction step skips generation.
        if (mesh.materialIndex === null ||
            !gltfMaterialIsLit(root.materials, mesh.materialIndex)) {
            continue;
        }
        requests.push({
            meshIndex: mesh.meshIndex,
            primitiveIndex: mesh.primitiveIndex,
        });
    }
    return requests;
}
function gltfMaterialIsLit(materials, materialIndex) {
    const material = materials[materialIndex];
    if (!isRecord(material)) {
        return false;
    }
    const extensions = material.extensions;
    const unlit = isRecord(extensions) && extensions.KHR_materials_unlit !== undefined;
    return !unlit;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=gltf-report-driven-import-meshes.js.map