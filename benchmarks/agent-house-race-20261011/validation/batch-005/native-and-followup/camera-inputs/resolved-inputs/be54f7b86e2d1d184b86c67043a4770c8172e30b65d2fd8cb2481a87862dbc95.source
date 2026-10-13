import { isRecord, toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";
export function resolveGltfMeshPrimitiveReference(input) {
    const mesh = input.meshes[input.meshIndex];
    if (!isRecord(mesh)) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.missingMesh",
            severity: "error",
            meshIndex: input.meshIndex,
            message: `glTF mesh ${input.meshIndex} does not exist or is not an object.`,
        });
        return { primitive: null, mesh: null, fatal: true };
    }
    if (!Array.isArray(mesh.primitives)) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.malformedPrimitives",
            severity: "error",
            meshIndex: input.meshIndex,
            field: `meshes[${input.meshIndex}].primitives`,
            value: toDiagnosticValue(mesh.primitives),
            message: `glTF mesh ${input.meshIndex} must include a primitives array.`,
        });
        return { primitive: null, mesh, fatal: true };
    }
    const primitive = mesh.primitives[input.primitiveIndex];
    if (primitive === undefined) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.missingPrimitive",
            severity: "error",
            meshIndex: input.meshIndex,
            primitiveIndex: input.primitiveIndex,
            message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} does not exist.`,
        });
        return { primitive: null, mesh, fatal: true };
    }
    if (!isRecord(primitive)) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.malformedPrimitive",
            severity: "error",
            meshIndex: input.meshIndex,
            primitiveIndex: input.primitiveIndex,
            field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}]`,
            value: toDiagnosticValue(primitive),
            message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must be an object.`,
        });
        return { primitive: null, mesh, fatal: true };
    }
    return { primitive, mesh, fatal: false };
}
export function allGltfMeshPrimitiveSelections(meshes) {
    const selections = [];
    for (const [meshIndex, mesh] of meshes.entries()) {
        if (!isRecord(mesh) || !Array.isArray(mesh.primitives)) {
            continue;
        }
        for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
            selections.push({ meshIndex, primitiveIndex });
        }
    }
    return selections;
}
//# sourceMappingURL=gltf-mesh-primitive-selection.js.map