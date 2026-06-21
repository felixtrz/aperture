export function skipGltfEcsReplayCommand(input) {
    const diagnostic = {
        code: input.code,
        severity: "error",
        message: input.message,
        commandIndex: input.commandIndex,
        ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
        ...(input.component === undefined ? {} : { component: input.component }),
        ...(input.parentEntityKey === undefined
            ? {}
            : { parentEntityKey: input.parentEntityKey }),
    };
    input.diagnostics.push(diagnostic);
    input.skipped.push({
        commandIndex: input.commandIndex,
        ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
        ...(input.component === undefined ? {} : { component: input.component }),
        reason: input.code,
        diagnostics: [diagnostic],
    });
}
export function skipInvalidGltfEcsReplayComponentValue(input, message) {
    skipGltfEcsReplayCommand({
        diagnostics: input.diagnostics,
        skipped: input.skipped,
        commandIndex: input.commandIndex,
        entityKey: input.command.entityKey,
        component: input.command.component,
        code: "gltfEcsReplay.invalidComponentValue",
        message,
    });
}
//# sourceMappingURL=gltf-ecs-command-replay-diagnostics.js.map