import {
  gltfEcsAuthoringCommandPlanToJson,
  gltfEcsAuthoringCommandPlanToJsonValue,
} from "./gltf-ecs-authoring-command-plan-report.js";
import type {
  GltfEcsAuthoringCommand,
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringCommandPlanOptions,
  GltfEcsAuthoringDiagnostic,
  GltfSkippedEcsAuthoringEntry,
} from "./gltf-ecs-authoring-command-plan-types.js";
import {
  appendGltfEcsEntityCommands,
  createGltfEcsAuthoringCommandPlanResult,
  gltfIdentityLocalTransformCommandValue,
  gltfLocalTransformCommandValue,
  gltfSceneLabel,
  skipGltfEcsNodeByAncestor,
} from "./gltf-ecs-authoring-command-plan-entities.js";
import {
  appendGltfEcsPrimitiveCommands,
  createGltfEcsMeshReadiness,
} from "./gltf-ecs-authoring-command-plan-primitives.js";

export {
  gltfEcsAuthoringCommandPlanToJson,
  gltfEcsAuthoringCommandPlanToJsonValue,
};

export type * from "./gltf-ecs-authoring-command-plan-types.js";

export function createGltfEcsAuthoringCommandPlan(
  options: GltfEcsAuthoringCommandPlanOptions,
): GltfEcsAuthoringCommandPlan {
  const commands: GltfEcsAuthoringCommand[] = [];
  const diagnostics: GltfEcsAuthoringDiagnostic[] = [];
  const skipped: GltfSkippedEcsAuthoringEntry[] = [];
  const seenEntityKeys = new Set<string>();
  const dependencies = new Set<string>();
  const meshReadiness = createGltfEcsMeshReadiness(options);

  if (!options.traversalReport.valid) {
    diagnostics.push({
      code: "gltfEcsAuthoring.invalidTraversalReport",
      severity: "error",
      message:
        "No ECS authoring commands were planned because scene traversal is invalid.",
      ...(options.traversalReport.sceneIndex === null
        ? {}
        : { sceneIndex: options.traversalReport.sceneIndex }),
    });
    return createGltfEcsAuthoringCommandPlanResult(
      options.traversalReport,
      commands,
      diagnostics,
      skipped,
      [],
    );
  }

  if (options.traversalReport.sceneEntityKey === null) {
    diagnostics.push({
      code: "gltfEcsAuthoring.missingSceneRoot",
      severity: "error",
      message:
        "No ECS authoring commands were planned because traversal did not select a scene root.",
      ...(options.traversalReport.sceneIndex === null
        ? {}
        : { sceneIndex: options.traversalReport.sceneIndex }),
    });
    return createGltfEcsAuthoringCommandPlanResult(
      options.traversalReport,
      commands,
      diagnostics,
      skipped,
      [],
    );
  }

  appendGltfEcsEntityCommands({
    commands,
    diagnostics,
    seenEntityKeys,
    entityKey: options.traversalReport.sceneEntityKey,
    label: gltfSceneLabel(options.traversalReport.sceneIndex),
    parentEntityKey: null,
    localTransform: gltfIdentityLocalTransformCommandValue(),
    sceneIndex: options.traversalReport.sceneIndex,
  });

  const skippedEntityKeys = new Set<string>();
  for (const node of options.traversalReport.nodes) {
    if (skippedEntityKeys.has(node.parentEntityKey)) {
      skipGltfEcsNodeByAncestor({
        node,
        diagnostics,
        skipped,
        skippedEntityKeys,
      });
      continue;
    }

    appendGltfEcsEntityCommands({
      commands,
      diagnostics,
      seenEntityKeys,
      entityKey: node.entityKey,
      label: node.label,
      parentEntityKey: node.parentEntityKey,
      localTransform: gltfLocalTransformCommandValue(node.localTransform),
      sceneIndex: options.traversalReport.sceneIndex,
      nodeIndex: node.nodeIndex,
    });

    appendGltfEcsPrimitiveCommands({
      node,
      options,
      commands,
      diagnostics,
      skipped,
      seenEntityKeys,
      dependencies,
      meshReadiness,
    });
  }

  return createGltfEcsAuthoringCommandPlanResult(
    options.traversalReport,
    commands,
    diagnostics,
    skipped,
    [...dependencies],
  );
}
