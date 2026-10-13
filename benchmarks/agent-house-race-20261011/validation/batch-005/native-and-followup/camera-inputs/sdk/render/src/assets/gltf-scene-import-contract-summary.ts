import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { MaterialKind } from "../materials/index.js";
import type {
  GltfSceneCameraIntent,
  GltfSceneDirectLightIntent,
  GltfSceneEnvironmentIntent,
  GltfSceneImportContractSummary,
  GltfScenePrimitiveShapeIntent,
  GltfSceneShadowIntent,
} from "./gltf-scene-import-contract-types.js";

export function createGltfSceneImportContractSummary(input: {
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
