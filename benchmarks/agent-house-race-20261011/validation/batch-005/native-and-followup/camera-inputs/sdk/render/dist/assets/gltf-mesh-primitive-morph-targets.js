import { mapGltfMeshPrimitiveTargetAttributeReference, } from "./gltf-mesh-primitive-accessor-reference.js";
import { isRecord } from "./gltf-mesh-primitive-utils.js";
export function mapGltfMeshPrimitiveMorphTargetAttributeReferences(input) {
    const targets = Array.isArray(input.primitive.targets)
        ? input.primitive.targets
        : [];
    const target0 = isRecord(targets[0]) ? targets[0] : {};
    const target1 = isRecord(targets[1]) ? targets[1] : {};
    return {
        morphPosition0: mapGltfMeshPrimitiveTargetAttributeReference(input, target0, "POSITION", "MORPH_POSITION_0"),
        morphNormal0: mapGltfMeshPrimitiveTargetAttributeReference(input, target0, "NORMAL", "MORPH_NORMAL_0"),
        morphPosition1: mapGltfMeshPrimitiveTargetAttributeReference(input, target1, "POSITION", "MORPH_POSITION_1"),
        morphNormal1: mapGltfMeshPrimitiveTargetAttributeReference(input, target1, "NORMAL", "MORPH_NORMAL_1"),
    };
}
//# sourceMappingURL=gltf-mesh-primitive-morph-targets.js.map