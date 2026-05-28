import { createGltfAssetMappingReport } from "./gltf-asset-mapping.js";
import { createGltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import { createGltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import { createGltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import { createGltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import { createGltfSceneImportContractDiagnostics } from "./gltf-scene-import-contract-diagnostics.js";
import { createGltfSceneImportContractSummary } from "./gltf-scene-import-contract-summary.js";
import type {
  GltfSceneImportContractOptions,
  GltfSceneImportContractReport,
} from "./gltf-scene-import-contract-types.js";

export {
  gltfSceneImportContractReportToJson,
  gltfSceneImportContractReportToJsonValue,
} from "./gltf-scene-import-contract-report.js";
export type {
  GltfSceneCameraIntent,
  GltfSceneDirectLightIntent,
  GltfSceneEnvironmentIntent,
  GltfSceneImportContractOptions,
  GltfSceneImportContractReport,
  GltfSceneImportContractReportJsonValue,
  GltfSceneImportContractSummary,
  GltfSceneImportDiagnostic,
  GltfSceneImportDiagnosticCode,
  GltfScenePrimitiveShapeIntent,
  GltfSceneShadowIntent,
} from "./gltf-scene-import-contract-types.js";

export function createGltfSceneImportContractReport(
  options: GltfSceneImportContractOptions,
): GltfSceneImportContractReport {
  const assetMapping = createGltfAssetMappingReport({
    root: options.root,
    resolveImageData: options.resolveImageData,
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
  });
  const meshPrimitive = createGltfMeshPrimitiveMappingReport({
    root: options.root,
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
  });
  const sceneTraversal = createGltfSceneTraversalReport({
    root: options.root,
    ...(options.sceneIndex === undefined
      ? {}
      : { sceneIndex: options.sceneIndex }),
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
  });
  const primitiveMaterialResolution =
    options.sourceRegistrationReport === undefined
      ? null
      : createGltfPrimitiveMaterialResolutionReport({
          primitiveReport: meshPrimitive,
          registrationReport: options.sourceRegistrationReport,
          ...(options.availableMaterialHandleKeys === undefined
            ? {}
            : {
                availableMaterialHandleKeys:
                  options.availableMaterialHandleKeys,
              }),
          ...(options.defaultMaterialHandleKey === undefined
            ? {}
            : { defaultMaterialHandleKey: options.defaultMaterialHandleKey }),
          ...(options.keyPrefix === undefined
            ? {}
            : { keyPrefix: options.keyPrefix }),
        });
  const ecsCommandPlan =
    primitiveMaterialResolution === null ||
    options.meshRegistrationReport === undefined
      ? null
      : createGltfEcsAuthoringCommandPlan({
          traversalReport: sceneTraversal,
          meshRegistrationReport: options.meshRegistrationReport,
          primitiveMaterialReport: primitiveMaterialResolution,
          ...(options.availableMeshHandleKeys === undefined
            ? {}
            : { availableMeshHandleKeys: options.availableMeshHandleKeys }),
        });
  const summary = createGltfSceneImportContractSummary({
    assetMapping,
    meshPrimitive,
    primitiveShapes: options.primitiveShapes ?? [],
    primitiveMaterialResolution,
    sceneTraversal,
    ecsCommandPlan,
    cameras: options.cameras ?? [],
    directLights: options.directLights ?? [],
    environment: options.environment ?? null,
    shadows: options.shadows ?? [],
  });
  const diagnostics = createGltfSceneImportContractDiagnostics({
    assetMapping,
    meshPrimitive,
    primitiveMaterialResolution,
    sceneTraversal,
    ecsCommandPlan,
    sourceRegistrationReport: options.sourceRegistrationReport,
    meshRegistrationReport: options.meshRegistrationReport,
    summary,
  });

  return {
    valid: diagnostics.length === 0,
    summary,
    assetMapping,
    meshPrimitive,
    primitiveMaterialResolution,
    sceneTraversal,
    ecsCommandPlan,
    cameras: (options.cameras ?? []).map((camera) => ({ ...camera })),
    directLights: (options.directLights ?? []).map((light) => ({ ...light })),
    environment:
      options.environment === undefined ? null : { ...options.environment },
    shadows: (options.shadows ?? []).map((shadow) => ({ ...shadow })),
    diagnostics,
  };
}
