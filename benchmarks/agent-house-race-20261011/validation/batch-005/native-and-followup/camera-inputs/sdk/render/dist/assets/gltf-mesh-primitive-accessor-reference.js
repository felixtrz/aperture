import { toDiagnosticValue } from "./gltf-mesh-primitive-utils.js";
export function mapGltfMeshPrimitiveAttributeReference(input, attributes, semantic) {
    const accessorIndex = attributes[semantic];
    if (accessorIndex === undefined) {
        if (semantic === "POSITION") {
            input.diagnostics.push({
                layer: "mesh",
                code: "gltfMesh.missingPosition",
                severity: "error",
                meshIndex: input.meshIndex,
                primitiveIndex: input.primitiveIndex,
                attribute: semantic,
                field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.POSITION`,
                message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} must include a POSITION attribute.`,
            });
        }
        return null;
    }
    if (!validGltfAccessorReference(input.root, accessorIndex)) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.invalidAccessorReference",
            severity: "error",
            meshIndex: input.meshIndex,
            primitiveIndex: input.primitiveIndex,
            attribute: semantic,
            field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].attributes.${semantic}`,
            value: toDiagnosticValue(accessorIndex),
            ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
            message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid ${semantic} accessor reference.`,
        });
        return null;
    }
    return { semantic, accessorIndex };
}
export function mapGltfMeshPrimitiveTargetAttributeReference(input, target, targetSemantic, semantic) {
    const accessorIndex = target[targetSemantic];
    if (accessorIndex === undefined) {
        return null;
    }
    if (!validGltfAccessorReference(input.root, accessorIndex)) {
        input.diagnostics.push({
            layer: "mesh",
            code: "gltfMesh.invalidAccessorReference",
            severity: "error",
            meshIndex: input.meshIndex,
            primitiveIndex: input.primitiveIndex,
            attribute: semantic,
            field: `meshes[${input.meshIndex}].primitives[${input.primitiveIndex}].targets.${targetSemantic}`,
            value: toDiagnosticValue(accessorIndex),
            ...(typeof accessorIndex === "number" ? { accessorIndex } : {}),
            message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} has an invalid ${semantic} accessor reference.`,
        });
        return null;
    }
    return { semantic, accessorIndex };
}
export function validGltfAccessorReference(root, accessorIndex) {
    return (Number.isInteger(accessorIndex) &&
        typeof accessorIndex === "number" &&
        accessorIndex >= 0 &&
        Array.isArray(root.accessors) &&
        accessorIndex < root.accessors.length);
}
//# sourceMappingURL=gltf-mesh-primitive-accessor-reference.js.map