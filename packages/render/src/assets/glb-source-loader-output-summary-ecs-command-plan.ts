import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringComponentName,
} from "./gltf-ecs-authoring-command-plan.js";
import type { GlbSourceLoaderEcsCommandPlanSummaryJsonValue } from "./glb-source-loader-output-summary-types.js";

export function createGlbSourceLoaderEcsCommandPlanSummaryJsonValue(
  plan: GltfEcsAuthoringCommandPlan | null,
): GlbSourceLoaderEcsCommandPlanSummaryJsonValue {
  if (plan === null) {
    return {
      status: "absent",
      valid: null,
      sceneIndex: null,
      rootEntityCount: 0,
      commandCount: 0,
      createEntityCount: 0,
      addComponentCount: 0,
      componentCounts: [],
      dependencyCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
    };
  }

  const componentCountMap = new Map<GltfEcsAuthoringComponentName, number>();
  let createEntityCount = 0;
  let addComponentCount = 0;

  for (const command of plan.commands) {
    if (command.type === "createEntity") {
      createEntityCount += 1;
      continue;
    }

    addComponentCount += 1;
    componentCountMap.set(
      command.component,
      (componentCountMap.get(command.component) ?? 0) + 1,
    );
  }

  return {
    status: plan.valid ? "ready" : "invalid",
    valid: plan.valid,
    sceneIndex: plan.sceneIndex,
    rootEntityCount: plan.rootEntityKeys.length,
    commandCount: plan.commands.length,
    createEntityCount,
    addComponentCount,
    componentCounts: COMPONENT_COUNT_ORDER.flatMap((component) => {
      const count = componentCountMap.get(component) ?? 0;
      return count === 0 ? [] : [{ component, count }];
    }),
    dependencyCount: plan.dependencies.length,
    skippedCount: plan.skipped.length,
    diagnosticsCount:
      plan.diagnostics.length +
      plan.skipped.reduce(
        (total, entry) => total + entry.diagnostics.length,
        0,
      ),
  };
}

const COMPONENT_COUNT_ORDER: readonly GltfEcsAuthoringComponentName[] = [
  "Name",
  "LocalTransform",
  "Parent",
  "WorldTransform",
  "Mesh",
  "Material",
  "Visibility",
];
