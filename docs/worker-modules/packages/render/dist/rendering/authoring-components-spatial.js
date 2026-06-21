import { EcsType, defineComponent } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { MeshQueryAccelerationMode, MeshQueryAccelerationStrategy, MeshQueryDynamicPolicy, PickablePrecision, } from "./authoring-types.js";
export const Pickable = defineComponent("aperture.spatial.pickable", {
    enabled: { type: EcsType.Boolean, default: true },
    layerMask: { type: EcsType.Int32, default: 1 },
    precision: {
        type: EcsType.Enum,
        enum: PickablePrecision,
        default: PickablePrecision.Bounds,
    },
    blocksLower: { type: EcsType.Boolean, default: false },
    priority: { type: EcsType.Int32, default: 0 },
}, "Renderer-independent pickability component consumed by worker-side spatial query systems.");
export const MeshQueryAcceleration = defineComponent("aperture.spatial.meshQueryAcceleration", {
    mode: {
        type: EcsType.Enum,
        enum: MeshQueryAccelerationMode,
        default: MeshQueryAccelerationMode.AutoBvh,
    },
    strategy: {
        type: EcsType.Enum,
        enum: MeshQueryAccelerationStrategy,
        default: MeshQueryAccelerationStrategy.Center,
    },
    maxLeafSize: { type: EcsType.Int32, default: 8 },
    maxDepth: { type: EcsType.Int32, default: 40 },
    dynamicPolicy: {
        type: EcsType.Enum,
        enum: MeshQueryDynamicPolicy,
        default: MeshQueryDynamicPolicy.Static,
    },
    simplifiedMeshId: { type: EcsType.String, default: "" },
}, "Renderer-independent mesh query acceleration policy for exact CPU spatial queries.");
//# sourceMappingURL=authoring-components-spatial.js.map