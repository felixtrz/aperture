import {
  createGltfAssetMappingReport,
  type GltfAssetMappingReport,
} from "./gltf-asset-mapping.js";
import {
  createGltfEcsAuthoringCommandPlan,
  type GltfEcsAuthoringCommandPlan,
} from "./gltf-ecs-authoring-command-plan.js";
import {
  createGltfMeshPrimitiveMappingReport,
  type GltfMeshPrimitiveMappingReport,
} from "./gltf-mesh-primitive.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import {
  createGltfPrimitiveMaterialResolutionReport,
  type GltfPrimitiveMaterialResolutionReport,
} from "./gltf-primitive-material-resolution.js";
import {
  createGltfSceneTraversalReport,
  type GltfSceneTraversalReport,
} from "./gltf-scene-traversal.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";
import type { MaterialKind } from "../materials/index.js";
import type {
  GltfSceneCameraIntent,
  GltfSceneDirectLightIntent,
  GltfSceneEnvironmentIntent,
  GltfSceneImportContractOptions,
  GltfSceneImportContractReport,
  GltfSceneImportContractSummary,
  GltfSceneImportDiagnostic,
  GltfScenePrimitiveShapeIntent,
  GltfSceneShadowIntent,
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
  const summary = createSummary({
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
  const diagnostics = createDiagnostics({
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

function createSummary(input: {
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
}): GltfSceneImportContractSummary {
  const primitiveShapes = [
    ...new Set(input.primitiveShapes.map((entry) => entry.shape)),
  ].sort();
  const materialFamilies = materialFamilyCounts({
    assetMapping: input.assetMapping,
    primitiveMaterialResolution: input.primitiveMaterialResolution,
  });

  return {
    sceneIndex: input.sceneTraversal.sceneIndex,
    sceneEntityKey: input.sceneTraversal.sceneEntityKey,
    nodeCount: input.sceneTraversal.nodes.length,
    rootNodeCount: input.sceneTraversal.rootNodeKeys.length,
    meshPrimitiveCount: input.meshPrimitive.meshes.length,
    renderablePrimitiveCount:
      input.ecsCommandPlan?.commands.filter(
        (command) =>
          command.type === "addComponent" && command.component === "Mesh",
      ).length ?? 0,
    primitiveShapeCount: primitiveShapes.length,
    primitiveShapes,
    materialFamilyCount: materialFamilies.length,
    materialFamilies,
    cameraCount: input.cameras.length,
    directLightCount: input.directLights.length,
    hasEnvironmentIntent: input.environment !== null,
    shadowIntentCount: input.shadows.length,
  };
}

function materialFamilyCounts(input: {
  readonly assetMapping: GltfAssetMappingReport;
  readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReport | null;
}): readonly { readonly family: MaterialKind; readonly count: number }[] {
  const familyByHandle = new Map<string, MaterialKind>();
  for (const material of input.assetMapping.materials) {
    if (material.material !== null) {
      familyByHandle.set(material.handleKey, material.material.kind);
    }
  }

  const counts = new Map<MaterialKind, number>();
  for (const primitive of input.primitiveMaterialResolution?.resolved ?? []) {
    const family = familyByHandle.get(primitive.materialHandleKey);
    if (family === undefined) {
      continue;
    }
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, count]) => ({ family, count }));
}

function createDiagnostics(input: {
  readonly assetMapping: GltfAssetMappingReport;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
  readonly primitiveMaterialResolution: GltfPrimitiveMaterialResolutionReport | null;
  readonly sceneTraversal: GltfSceneTraversalReport;
  readonly ecsCommandPlan: GltfEcsAuthoringCommandPlan | null;
  readonly sourceRegistrationReport:
    | GltfSourceAssetRegistrationReport
    | undefined;
  readonly meshRegistrationReport:
    | GltfMeshSourceAssetRegistrationReport
    | undefined;
  readonly summary: GltfSceneImportContractSummary;
}): readonly GltfSceneImportDiagnostic[] {
  const diagnostics: GltfSceneImportDiagnostic[] = [];

  pushIfInvalid(diagnostics, input.assetMapping, {
    code: "gltfSceneImport.invalidAssetMapping",
    message:
      "GLTF scene import contract requires a valid asset mapping report.",
  });
  pushIfInvalid(diagnostics, input.meshPrimitive, {
    code: "gltfSceneImport.invalidMeshPrimitiveMapping",
    message:
      "GLTF scene import contract requires a valid mesh primitive mapping report.",
  });
  pushIfInvalid(diagnostics, input.sceneTraversal, {
    code: "gltfSceneImport.invalidSceneTraversal",
    message:
      "GLTF scene import contract requires a valid scene traversal report.",
  });

  if (input.sourceRegistrationReport === undefined) {
    diagnostics.push({
      code: "gltfSceneImport.missingSourceRegistration",
      severity: "error",
      message:
        "GLTF scene import contract requires source asset registration before primitive material resolution.",
    });
  }
  if (input.meshRegistrationReport === undefined) {
    diagnostics.push({
      code: "gltfSceneImport.missingMeshRegistration",
      severity: "error",
      message:
        "GLTF scene import contract requires mesh asset registration before ECS authoring command planning.",
    });
  }

  if (input.primitiveMaterialResolution !== null) {
    pushIfInvalid(diagnostics, input.primitiveMaterialResolution, {
      code: "gltfSceneImport.invalidPrimitiveMaterialResolution",
      message:
        "GLTF scene import contract requires all primitive material references to resolve.",
    });
  }
  if (input.ecsCommandPlan !== null) {
    pushIfInvalid(diagnostics, input.ecsCommandPlan, {
      code: "gltfSceneImport.invalidEcsCommandPlan",
      message:
        "GLTF scene import contract requires a valid ECS authoring command plan.",
    });
  }

  requireMinimum(diagnostics, {
    code: "gltfSceneImport.insufficientPrimitiveShapes",
    message:
      "GLTF scene vertical slice requires at least three distinct primitive shape intents.",
    actual: input.summary.primitiveShapeCount,
    minimum: 3,
  });
  requireMinimum(diagnostics, {
    code: "gltfSceneImport.insufficientMaterialFamilies",
    message:
      "GLTF scene vertical slice requires at least two built-in material families.",
    actual: input.summary.materialFamilyCount,
    minimum: 2,
  });
  requireMinimum(diagnostics, {
    code: "gltfSceneImport.missingCameraIntent",
    message: "GLTF scene vertical slice requires at least one camera intent.",
    actual: input.summary.cameraCount,
    minimum: 1,
  });
  requireMinimum(diagnostics, {
    code: "gltfSceneImport.missingDirectLightIntent",
    message:
      "GLTF scene vertical slice requires at least one direct-light intent.",
    actual: input.summary.directLightCount,
    minimum: 1,
  });
  if (!input.summary.hasEnvironmentIntent) {
    diagnostics.push({
      code: "gltfSceneImport.missingEnvironmentIntent",
      severity: "error",
      message:
        "GLTF scene vertical slice requires environment/IBL intent metadata.",
      actual: 0,
      minimum: 1,
    });
  }
  requireMinimum(diagnostics, {
    code: "gltfSceneImport.missingShadowIntent",
    message: "GLTF scene vertical slice requires at least one shadow intent.",
    actual: input.summary.shadowIntentCount,
    minimum: 1,
  });

  return diagnostics;
}

function pushIfInvalid(
  diagnostics: GltfSceneImportDiagnostic[],
  report: { readonly valid: boolean },
  diagnostic: Pick<GltfSceneImportDiagnostic, "code" | "message">,
): void {
  if (report.valid) {
    return;
  }

  diagnostics.push({
    ...diagnostic,
    severity: "error",
  });
}

function requireMinimum(
  diagnostics: GltfSceneImportDiagnostic[],
  input: Pick<
    GltfSceneImportDiagnostic,
    "code" | "message" | "actual" | "minimum"
  >,
): void {
  if ((input.actual ?? 0) >= (input.minimum ?? 0)) {
    return;
  }

  diagnostics.push({
    ...input,
    severity: "error",
  });
}
