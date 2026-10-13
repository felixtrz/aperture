import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { GltfSourceAssetRegistrationReport } from "./gltf-source-registration.js";
import type {
  GltfSceneImportContractSummary,
  GltfSceneImportDiagnostic,
} from "./gltf-scene-import-contract-types.js";

export function createGltfSceneImportContractDiagnostics(input: {
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
