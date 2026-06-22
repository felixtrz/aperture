import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfEcsCommandReplayReport } from "./gltf-ecs-command-replay.js";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfRootValidationReport } from "./gltf-root.js";
import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";

export type GltfLoaderStage =
  | "root"
  | "assetMapping"
  | "sourceRegistration"
  | "meshConstruction"
  | "meshRegistration"
  | "sceneTraversal"
  | "primitiveMaterialResolution"
  | "ecsCommandPlan"
  | "ecsReplay";

export type GltfLoaderStageStatus =
  | "provided"
  | "missing"
  | "skipped"
  | "failed";

export type GltfLoaderStageSideEffect = "none" | "asset-registry" | "ecs-world";

export type GltfLoaderOrchestrationDiagnosticCode =
  | "gltfLoader.missingStage"
  | "gltfLoader.failedStage"
  | "gltfLoader.sideEffectWithoutPrerequisite"
  | "gltfLoader.invalidStageOrder";

export interface GltfLoaderOrchestrationDiagnostic {
  readonly code: GltfLoaderOrchestrationDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly stage?: GltfLoaderStage;
  readonly requiredStage?: GltfLoaderStage;
}

export interface GltfLoaderStageSummary {
  readonly stage: GltfLoaderStage;
  readonly status: GltfLoaderStageStatus;
  readonly sideEffect: GltfLoaderStageSideEffect;
  readonly valid?: boolean;
  readonly writtenCount?: number;
  readonly createdCount?: number;
  readonly diagnosticCount?: number;
}

export interface GltfLoaderOrchestrationReportOptions {
  readonly root?: GltfRootValidationReport;
  readonly assetMapping?: GltfAssetMappingReport;
  readonly sourceRegistration?: GltfSourceAssetRegistrationReport;
  readonly meshConstruction?: GltfMeshAssetConstructionReport;
  readonly meshRegistration?: GltfMeshSourceAssetRegistrationReport;
  readonly sceneTraversal?: GltfSceneTraversalReport;
  readonly primitiveMaterialResolution?: GltfPrimitiveMaterialResolutionReport;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan;
  readonly ecsReplay?: GltfEcsCommandReplayReport;
}

export interface GltfLoaderOrchestrationReport {
  readonly valid: boolean;
  readonly stages: readonly GltfLoaderStageSummary[];
  readonly diagnostics: readonly GltfLoaderOrchestrationDiagnostic[];
}

export type GltfLoaderOrchestrationReportJsonValue =
  GltfLoaderOrchestrationReport;
