export function writeCommandsForView(commands, snapshot, view, target, prefixCommands = []) {
    target.length = 0;
    const pendingStateCommands = [];
    for (const command of prefixCommands) {
        target.push(command);
    }
    for (const command of commands) {
        if (isRenderPassStateCommand(command)) {
            queuePendingRenderPassStateCommand(pendingStateCommands, command);
            continue;
        }
        if (isRenderPassCommandVisibleToView(command, snapshot, view)) {
            target.push(...pendingStateCommands);
            pendingStateCommands.length = 0;
            target.push(command);
        }
    }
    return target;
}
export function countDrawCommands(commands) {
    let count = 0;
    for (const command of commands) {
        if (isRenderPassDrawCommand(command)) {
            count += 1;
        }
    }
    return count;
}
export function isRenderPassDrawCommand(command) {
    return (command.kind === "draw" ||
        command.kind === "drawIndexed" ||
        command.kind === "drawIndirect" ||
        command.kind === "drawIndexedIndirect");
}
function isRenderPassStateCommand(command) {
    return (command.kind === "setPipeline" ||
        command.kind === "setBindGroup" ||
        command.kind === "setVertexBuffer" ||
        command.kind === "setIndexBuffer");
}
function queuePendingRenderPassStateCommand(target, command) {
    const key = renderPassStateCommandKey(command);
    for (let index = 0; index < target.length; index += 1) {
        if (renderPassStateCommandKey(target[index]) === key) {
            target[index] = command;
            return;
        }
    }
    target.push(command);
}
function renderPassStateCommandKey(command) {
    switch (command.kind) {
        case "setPipeline":
            return "pipeline";
        case "setBindGroup":
            return `bind-group:${String(command.index)}`;
        case "setVertexBuffer":
            return `vertex-buffer:${String(command.slot)}`;
        case "setIndexBuffer":
            return "index-buffer";
        default:
            return "non-state";
    }
}
function isRenderPassCommandVisibleToView(command, snapshot, view) {
    const draw = snapshot.meshDraws.find((packet) => packet.renderId === command.renderId);
    if (draw !== undefined) {
        return (draw.layerMask & view.layerMask) !== 0;
    }
    const sprite = snapshot.spriteDraws?.find((packet) => packet.renderId === command.renderId);
    return sprite === undefined || (sprite.layerMask & view.layerMask) !== 0;
}
//# sourceMappingURL=view-commands.js.map