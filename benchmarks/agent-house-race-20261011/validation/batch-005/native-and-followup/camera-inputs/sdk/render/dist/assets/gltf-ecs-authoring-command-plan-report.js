export function gltfEcsAuthoringCommandPlanToJsonValue(plan) {
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
export function gltfEcsAuthoringCommandPlanToJson(plan) {
    return JSON.stringify(gltfEcsAuthoringCommandPlanToJsonValue(plan));
}
//# sourceMappingURL=gltf-ecs-authoring-command-plan-report.js.map