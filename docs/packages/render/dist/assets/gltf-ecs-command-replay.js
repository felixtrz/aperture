import { registerMetadataComponents, registerTransformComponents, } from "@aperture-engine/simulation";
import { registerRenderAuthoringComponents } from "../rendering/authoring.js";
import { applyGltfEcsReplayComponent } from "./gltf-ecs-command-replay-components.js";
import { skipGltfEcsReplayCommand } from "./gltf-ecs-command-replay-diagnostics.js";
import { createGltfEcsCommandReplayReport, gltfEcsCommandReplayReportToJson, gltfEcsCommandReplayReportToJsonValue, } from "./gltf-ecs-command-replay-report.js";
export { gltfEcsCommandReplayReportToJson, gltfEcsCommandReplayReportToJsonValue, };
export function replayGltfEcsAuthoringCommands(options) {
    const entitiesByKey = new Map();
    const created = [];
    const appliedComponents = [];
    const skipped = [];
    const diagnostics = [];
    if (!options.plan.valid) {
        const diagnostic = {
            code: "gltfEcsReplay.invalidPlan",
            severity: "error",
            message: "GLB ECS authoring commands were not replayed because the command plan is invalid.",
        };
        diagnostics.push(diagnostic);
        return createGltfEcsCommandReplayReport({
            entitiesByKey,
            created,
            appliedComponents,
            skipped,
            diagnostics,
        });
    }
    if (options.registerComponents ?? true) {
        registerTransformComponents(options.world);
        registerMetadataComponents(options.world);
        registerRenderAuthoringComponents(options.world);
    }
    options.plan.commands.forEach((command, commandIndex) => {
        if (command.type !== "createEntity") {
            return;
        }
        if (entitiesByKey.has(command.entityKey)) {
            skipGltfEcsReplayCommand({
                diagnostics,
                skipped,
                commandIndex,
                entityKey: command.entityKey,
                code: "gltfEcsReplay.duplicateEntityKey",
                message: `Entity key '${command.entityKey}' was created more than once.`,
            });
            return;
        }
        const entity = options.world.createEntity();
        entitiesByKey.set(command.entityKey, entity);
        created.push({
            entityKey: command.entityKey,
            label: command.label,
            entityIndex: entity.index,
            entityGeneration: entity.generation,
        });
    });
    options.plan.commands.forEach((command, commandIndex) => {
        if (command.type !== "addComponent") {
            return;
        }
        const entity = entitiesByKey.get(command.entityKey);
        if (entity === undefined) {
            skipGltfEcsReplayCommand({
                diagnostics,
                skipped,
                commandIndex,
                entityKey: command.entityKey,
                component: command.component,
                code: "gltfEcsReplay.missingEntityKey",
                message: `Component '${command.component}' was not applied because entity key '${command.entityKey}' was not created.`,
            });
            return;
        }
        const applied = applyGltfEcsReplayComponent({
            entity,
            command,
            commandIndex,
            entitiesByKey,
            diagnostics,
            skipped,
        });
        if (applied) {
            appliedComponents.push({
                entityKey: command.entityKey,
                component: command.component,
                commandIndex,
            });
        }
    });
    return createGltfEcsCommandReplayReport({
        entitiesByKey,
        created,
        appliedComponents,
        skipped,
        diagnostics,
    });
}
//# sourceMappingURL=gltf-ecs-command-replay.js.map