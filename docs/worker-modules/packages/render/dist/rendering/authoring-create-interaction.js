import { MeshQueryAccelerationMode, MeshQueryAccelerationStrategy, MeshQueryDynamicPolicy, PickablePrecision, } from "./authoring-types.js";
export function createPickable(input = {}) {
    return {
        enabled: input.enabled ?? true,
        layerMask: input.layerMask ?? 1,
        precision: input.precision ?? PickablePrecision.Bounds,
        blocksLower: input.blocksLower ?? false,
        priority: input.priority ?? 0,
    };
}
export function createMeshQueryAcceleration(input = {}) {
    return {
        mode: input.mode ?? MeshQueryAccelerationMode.AutoBvh,
        strategy: input.strategy ?? MeshQueryAccelerationStrategy.Center,
        maxLeafSize: input.maxLeafSize ?? 8,
        maxDepth: input.maxDepth ?? 40,
        dynamicPolicy: input.dynamicPolicy ?? MeshQueryDynamicPolicy.Static,
        simplifiedMeshId: input.simplifiedMeshId ?? "",
    };
}
export function createOcclusionQuery(input = {}) {
    return {
        enabled: input.enabled ?? true,
    };
}
//# sourceMappingURL=authoring-create-interaction.js.map