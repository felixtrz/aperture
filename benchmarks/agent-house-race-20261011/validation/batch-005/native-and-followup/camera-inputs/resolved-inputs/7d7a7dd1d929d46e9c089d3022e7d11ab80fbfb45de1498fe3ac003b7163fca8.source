import { gltfEcsAuthoringCommandPlanToJson, gltfEcsAuthoringCommandPlanToJsonValue, } from "./gltf-ecs-authoring-command-plan-report.js";
import { appendGltfEcsEntityCommands, createGltfEcsAuthoringCommandPlanResult, gltfIdentityLocalTransformCommandValue, gltfLocalTransformCommandValue, gltfSceneLabel, skipGltfEcsNodeByAncestor, } from "./gltf-ecs-authoring-command-plan-entities.js";
import { appendGltfEcsPrimitiveCommands, createGltfEcsMeshReadiness, } from "./gltf-ecs-authoring-command-plan-primitives.js";
export { gltfEcsAuthoringCommandPlanToJson, gltfEcsAuthoringCommandPlanToJsonValue, };
export function createGltfEcsAuthoringCommandPlan(options) {
    const commands = [];
    const diagnostics = [];
    const skipped = [];
    const seenEntityKeys = new Set();
    const dependencies = new Set();
    const meshReadiness = createGltfEcsMeshReadiness(options);
    const nodeEntityKeyByIndex = new Map(options.traversalReport.nodes.map((node) => [
        node.nodeIndex,
        node.entityKey,
    ]));
    if (!options.traversalReport.valid) {
        diagnostics.push({
            code: "gltfEcsAuthoring.invalidTraversalReport",
            severity: "error",
            message: "No ECS authoring commands were planned because scene traversal is invalid.",
            ...(options.traversalReport.sceneIndex === null
                ? {}
                : { sceneIndex: options.traversalReport.sceneIndex }),
        });
        return createGltfEcsAuthoringCommandPlanResult(options.traversalReport, commands, diagnostics, skipped, []);
    }
    if (options.traversalReport.sceneEntityKey === null) {
        diagnostics.push({
            code: "gltfEcsAuthoring.missingSceneRoot",
            severity: "error",
            message: "No ECS authoring commands were planned because traversal did not select a scene root.",
            ...(options.traversalReport.sceneIndex === null
                ? {}
                : { sceneIndex: options.traversalReport.sceneIndex }),
        });
        return createGltfEcsAuthoringCommandPlanResult(options.traversalReport, commands, diagnostics, skipped, []);
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
    const skippedEntityKeys = new Set();
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
            nodeEntityKeyByIndex,
        });
    }
    return createGltfEcsAuthoringCommandPlanResult(options.traversalReport, commands, diagnostics, skipped, [...dependencies]);
}
//# sourceMappingURL=gltf-ecs-authoring-command-plan.js.map