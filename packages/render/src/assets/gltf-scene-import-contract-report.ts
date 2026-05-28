import { gltfAssetMappingReportToJsonValue } from "./gltf-asset-mapping.js";
import { gltfEcsAuthoringCommandPlanToJsonValue } from "./gltf-ecs-authoring-command-plan.js";
import { gltfMeshPrimitiveMappingReportToJsonValue } from "./gltf-mesh-primitive.js";
import { gltfPrimitiveMaterialResolutionReportToJsonValue } from "./gltf-primitive-material-resolution.js";
import { gltfSceneTraversalReportToJsonValue } from "./gltf-scene-traversal.js";
import type {
  GltfSceneImportContractReport,
  GltfSceneImportContractReportJsonValue,
} from "./gltf-scene-import-contract-types.js";

export function gltfSceneImportContractReportToJsonValue(
  report: GltfSceneImportContractReport,
): GltfSceneImportContractReportJsonValue {
  return {
    valid: report.valid,
    summary: {
      ...report.summary,
      primitiveShapes: [...report.summary.primitiveShapes],
      materialFamilies: report.summary.materialFamilies.map((entry) => ({
        ...entry,
      })),
    },
    assetMapping: gltfAssetMappingReportToJsonValue(report.assetMapping),
    meshPrimitive: gltfMeshPrimitiveMappingReportToJsonValue(
      report.meshPrimitive,
    ),
    primitiveMaterialResolution:
      report.primitiveMaterialResolution === null
        ? null
        : gltfPrimitiveMaterialResolutionReportToJsonValue(
            report.primitiveMaterialResolution,
          ),
    sceneTraversal: gltfSceneTraversalReportToJsonValue(report.sceneTraversal),
    ecsCommandPlan:
      report.ecsCommandPlan === null
        ? null
        : gltfEcsAuthoringCommandPlanToJsonValue(report.ecsCommandPlan),
    cameras: report.cameras.map((camera) => ({ ...camera })),
    directLights: report.directLights.map((light) => ({ ...light })),
    environment: report.environment === null ? null : { ...report.environment },
    shadows: report.shadows.map((shadow) => ({ ...shadow })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSceneImportContractReportToJson(
  report: GltfSceneImportContractReport,
): string {
  return JSON.stringify(gltfSceneImportContractReportToJsonValue(report));
}
