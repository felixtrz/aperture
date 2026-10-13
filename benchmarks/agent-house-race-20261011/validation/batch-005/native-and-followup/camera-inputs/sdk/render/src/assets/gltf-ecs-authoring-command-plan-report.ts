import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringCommandPlanJsonValue,
} from "./gltf-ecs-authoring-command-plan-types.js";

export function gltfEcsAuthoringCommandPlanToJsonValue(
  plan: GltfEcsAuthoringCommandPlan,
): GltfEcsAuthoringCommandPlanJsonValue {
  return {
    valid: plan.valid,
    sceneIndex: plan.sceneIndex,
    rootEntityKeys: [...plan.rootEntityKeys],
    commands: plan.commands.map((command) => ({ ...command })),
    dependencies: [...plan.dependencies],
    skipped: plan.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: plan.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfEcsAuthoringCommandPlanToJson(
  plan: GltfEcsAuthoringCommandPlan,
): string {
  return JSON.stringify(gltfEcsAuthoringCommandPlanToJsonValue(plan));
}
