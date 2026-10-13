import { gltfRootValidationReportToJsonValue, validateGltfRootForAssetMapping, } from "./gltf-root.js";
import { planGltfMeshPrimitive } from "./gltf-mesh-primitive-planning.js";
import { createGltfMeshPrimitiveMappingReportResult, gltfMeshPrimitiveMappingReportToJson, gltfMeshPrimitiveMappingReportToJsonValue, } from "./gltf-mesh-primitive-report.js";
import { allGltfMeshPrimitiveSelections, resolveGltfMeshPrimitiveReference, } from "./gltf-mesh-primitive-selection.js";
import { isRecord, toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";
export { gltfMeshPrimitiveMappingReportToJson, gltfMeshPrimitiveMappingReportToJsonValue, };
export function createGltfMeshPrimitiveMappingReport(options) {
    const rootValidation = validateGltfRootForAssetMapping(options.root);
    const root = gltfRootValidationReportToJsonValue(rootValidation);
    const diagnostics = rootValidation.diagnostics.map((diagnostic) => ({
        layer: "root",
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
    }));
    if (!isRecord(options.root)) {
        return createGltfMeshPrimitiveMappingReportResult({
            root,
            diagnostics,
            meshes: [],
        });
    }
    const meshesField = options.root.meshes;
    if (meshesField !== undefined && !Array.isArray(meshesField)) {
        diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.malformedMeshes",
            severity: "error",
            field: "meshes",
            value: toDiagnosticValue(meshesField),
            message: "glTF meshes must be an array when present.",
        });
        return createGltfMeshPrimitiveMappingReportResult({
            root,
            diagnostics,
            meshes: [],
        });
    }
    const meshes = Array.isArray(meshesField) ? meshesField : [];
    const selections = options.meshPrimitiveIndices ?? allGltfMeshPrimitiveSelections(meshes);
    const plannedMeshes = [];
    for (const selection of selections) {
        const reference = resolveGltfMeshPrimitiveReference({
            meshes,
            meshIndex: selection.meshIndex,
            primitiveIndex: selection.primitiveIndex,
            diagnostics,
        });
        if (reference.fatal || reference.primitive === null) {
            continue;
        }
        const planned = planGltfMeshPrimitive({
            options,
            root: options.root,
            mesh: reference.mesh,
            primitive: reference.primitive,
            meshIndex: selection.meshIndex,
            primitiveIndex: selection.primitiveIndex,
            diagnostics,
        });
        if (planned !== null) {
            plannedMeshes.push(planned);
        }
    }
    return createGltfMeshPrimitiveMappingReportResult({
        root,
        diagnostics,
        meshes: plannedMeshes,
    });
}
//# sourceMappingURL=gltf-mesh-primitive.js.map