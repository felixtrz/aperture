import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";
import type { GltfSceneImportContractSummary, GltfSceneImportDiagnostic } from "./gltf-scene-import-contract-types.js";
export declare function createGltfSceneImportContractDiagnostics(input: {
    readonly assetMapping: GltfAssetMappingReport;
    readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
    readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReport | null;
    readonly sceneTraversal: GltfSceneTraversalReport;
    readonly ecsCommandPlan: GltfEcsAuthoringCommandPlan | null;
    readonly sourceRegistrationReport: GltfSourceAssetRegistrationReport | undefined;
    readonly meshRegistrationReport: GltfMeshSourceAssetRegistrationReport | undefined;
    readonly summary: GltfSceneImportContractSummary;
}): readonly GltfSceneImportDiagnostic[];
//# sourceMappingURL=gltf-scene-import-contract-diagnostics.d.ts.map