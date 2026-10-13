import type {
  GltfAssetMappingReport,
  GltfAssetMappingReportJsonValue,
} from "./gltf-asset-mapping.js";
import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringCommandPlanJsonValue,
} from "./gltf-ecs-authoring-command-plan.js";
import type {
  GltfMeshPrimitiveMappingReport,
  GltfMeshPrimitiveMappingReportJsonValue,
} from "./gltf-mesh-primitive.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import type {
  GltfPrimitiveMaterialResolutionReport,
  GltfPrimitiveMaterialResolutionReportJsonValue,
} from "./gltf-primitive-material-resolution.js";
import type {
  GltfSceneTraversalReport,
  GltfSceneTraversalReportJsonValue,
} from "./gltf-scene-traversal.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";
import type {
  GltfImageDataResolver,
  MaterialKind,
} from "../materials/index.js";

export type GltfSceneImportDiagnosticCode =
  | "gltfSceneImport.invalidAssetMapping"
  | "gltfSceneImport.invalidMeshPrimitiveMapping"
  | "gltfSceneImport.missingSourceRegistration"
  | "gltfSceneImport.missingMeshRegistration"
  | "gltfSceneImport.invalidPrimitiveMaterialResolution"
  | "gltfSceneImport.invalidSceneTraversal"
  | "gltfSceneImport.invalidEcsCommandPlan"
  | "gltfSceneImport.insufficientPrimitiveShapes"
  | "gltfSceneImport.insufficientMaterialFamilies"
  | "gltfSceneImport.missingCameraIntent"
  | "gltfSceneImport.missingDirectLightIntent"
  | "gltfSceneImport.missingEnvironmentIntent"
  | "gltfSceneImport.missingShadowIntent";

export interface GltfSceneImportDiagnostic {
  readonly code: GltfSceneImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly minimum?: number;
  readonly actual?: number;
}

export interface GltfScenePrimitiveShapeIntent {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly shape: string;
}

export interface GltfSceneCameraIntent {
  readonly key: string;
  readonly nodeKey?: string;
  readonly projection: "perspective" | "orthographic";
  readonly near: number;
  readonly far: number;
  readonly yfov?: number;
}

export interface GltfSceneDirectLightIntent {
  readonly key: string;
  readonly nodeKey?: string;
  readonly kind: "directional";
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly castsShadow?: boolean;
}

export interface GltfSceneEnvironmentIntent {
  readonly key: string;
  readonly diffuseTextureHandleKey?: string;
  readonly specularTextureHandleKey?: string;
  readonly intensity: number;
}

export interface GltfSceneShadowIntent {
  readonly key: string;
  readonly lightKey: string;
  readonly mapSize: number;
  readonly depthBias: number;
  readonly normalBias?: number;
}

export interface GltfSceneImportContractOptions {
  readonly root: unknown;
  readonly resolveImageData: GltfImageDataResolver;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
  readonly sourceRegistrationReport?: GltfSourceAssetRegistrationReport;
  readonly meshRegistrationReport?: GltfMeshSourceAssetRegistrationReport;
  readonly availableMaterialHandleKeys?: readonly string[];
  readonly availableMeshHandleKeys?: readonly string[];
  readonly defaultMaterialHandleKey?: string;
  readonly primitiveShapes?: readonly GltfScenePrimitiveShapeIntent[];
  readonly cameras?: readonly GltfSceneCameraIntent[];
  readonly directLights?: readonly GltfSceneDirectLightIntent[];
  readonly environment?: GltfSceneEnvironmentIntent;
  readonly shadows?: readonly GltfSceneShadowIntent[];
}

export interface GltfSceneImportContractSummary {
  readonly sceneIndex: number | null;
  readonly sceneEntityKey: string | null;
  readonly nodeCount: number;
  readonly rootNodeCount: number;
  readonly meshPrimitiveCount: number;
  readonly renderablePrimitiveCount: number;
  readonly primitiveShapeCount: number;
  readonly primitiveShapes: readonly string[];
  readonly materialFamilyCount: number;
  readonly materialFamilies: readonly {
    readonly family: MaterialKind;
    readonly count: number;
  }[];
  readonly cameraCount: number;
  readonly directLightCount: number;
  readonly hasEnvironmentIntent: boolean;
  readonly shadowIntentCount: number;
}

export interface GltfSceneImportContractReport {
  readonly valid: boolean;
  readonly summary: GltfSceneImportContractSummary;
  readonly assetMapping: GltfAssetMappingReport;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
  readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReport | null;
  readonly sceneTraversal: GltfSceneTraversalReport;
  readonly ecsCommandPlan: GltfEcsAuthoringCommandPlan | null;
  readonly cameras: readonly GltfSceneCameraIntent[];
  readonly directLights: readonly GltfSceneDirectLightIntent[];
  readonly environment: GltfSceneEnvironmentIntent | null;
  readonly shadows: readonly GltfSceneShadowIntent[];
  readonly diagnostics: readonly GltfSceneImportDiagnostic[];
}

export interface GltfSceneImportContractReportJsonValue extends Omit<
  GltfSceneImportContractReport,
  | "assetMapping"
  | "meshPrimitive"
  | "primitiveMaterialResolution"
  | "sceneTraversal"
  | "ecsCommandPlan"
> {
  readonly assetMapping: GltfAssetMappingReportJsonValue;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReportJsonValue;
  readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReportJsonValue | null;
  readonly sceneTraversal: GltfSceneTraversalReportJsonValue;
  readonly ecsCommandPlan: GltfEcsAuthoringCommandPlanJsonValue | null;
}
