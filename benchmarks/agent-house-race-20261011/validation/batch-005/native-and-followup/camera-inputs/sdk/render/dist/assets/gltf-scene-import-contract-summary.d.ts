import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { GltfSceneCameraIntent, GltfSceneDirectLightIntent, GltfSceneEnvironmentIntent, GltfSceneImportContractSummary, GltfScenePrimitiveShapeIntent, GltfSceneShadowIntent } from "./gltf-scene-import-contract-types.js";
export declare function createGltfSceneImportContractSummary(input: {
    readonly assetMapping: GltfAssetMappingReport;
    readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
    readonly primitiveShapes: readonly GltfScenePrimitiveShapeIntent[];
    readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReport | null;
    readonly sceneTraversal: GltfSceneTraversalReport;
    readonly ecsCommandPlan: GltfEcsAuthoringCommandPlan | null;
    readonly cameras: readonly GltfSceneCameraIntent[];
    readonly directLights: readonly GltfSceneDirectLightIntent[];
    readonly environment: GltfSceneEnvironmentIntent | null;
    readonly shadows: readonly GltfSceneShadowIntent[];
}): GltfSceneImportContractSummary;
//# sourceMappingURL=gltf-scene-import-contract-summary.d.ts.map