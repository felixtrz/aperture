export function planRenderPassCommands(options) {
    const scratch = createRenderPassCommandScratch();
    writeRenderPassCommands(options, scratch);
    return scratch.plan;
}
export function createRenderPassCommandScratch(capacity = 0) {
    const commands = [];
    const diagnostics = [];
    const commandPool = [];
    const occlusionQueryRenderIds = [];
    const pressure = createRenderPassCommandPressureReport();
    for (let i = 0; i < capacity; i += 1) {
        commandPool.push(createEmptyCommand());
    }
    return {
        commands,
        diagnostics,
        commandPool,
        sortedBindGroups: [],
        activeBindGroupResourceKeys: new Map(),
        activeBindGroups: new Map(),
        activeVertexBufferResourceKeys: new Map(),
        activeVertexBuffers: new Map(),
        occlusionQueryRenderIds,
        pressure,
        plan: {
            valid: true,
            commands,
            drawCount: 0,
            indexedDrawCount: 0,
            nonIndexedDrawCount: 0,
            occlusionQueryCount: 0,
            occlusionQueryRenderIds,
            pressure,
            diagnostics,
        },
    };
}
export function writeRenderPassCommands(options, scratch) {
    scratch.commands.length = 0;
    scratch.diagnostics.length = 0;
    scratch.activeBindGroupResourceKeys.clear();
    scratch.activeBindGroups.clear();
    scratch.activeVertexBufferResourceKeys.clear();
    scratch.activeVertexBuffers.clear();
    scratch.occlusionQueryRenderIds.length = 0;
    resetRenderPassCommandPressure(scratch.pressure);
    let indexedDrawCount = 0;
    let nonIndexedDrawCount = 0;
    let occlusionQueryCount = 0;
    let activePipelineKey = "";
    let activePipeline = null;
    let hasActivePipeline = false;
    let activeIndexBufferResourceKey = "";
    let activeIndexBuffer = null;
    let activeIndexBufferFormat = "";
    let hasActiveIndexBuffer = false;
    scratch.pressure.resolvedDraws =
        options.draws.length;
    for (const draw of options.draws) {
        const firstInstance = transformPackedOffsetToInstance(draw.transformPackedOffset);
        const indexed = draw.indexBuffer !== null;
        const drawCount = indexed
            ? (draw.indexCount ?? draw.indexBuffer.indexCount)
            : draw.vertexCount;
        if (firstInstance === null) {
            scratch.diagnostics.push({
                code: "renderPassCommand.invalidTransformOffset",
                renderId: draw.renderId,
                message: `Render id ${draw.renderId} has invalid transform packed offset '${String(draw.transformPackedOffset)}'.`,
            });
            continue;
        }
        if (!isNonNegativeInteger(drawCount)) {
            scratch.diagnostics.push({
                code: indexed
                    ? "renderPassCommand.invalidIndexCount"
                    : "renderPassCommand.invalidVertexCount",
                renderId: draw.renderId,
                message: indexed
                    ? `Render id ${draw.renderId} has invalid indexed draw count '${String(drawCount)}'.`
                    : `Render id ${draw.renderId} has invalid vertex draw count '${String(drawCount)}'.`,
            });
            continue;
        }
        if (drawCount === 0) {
            continue;
        }
        if (hasActivePipeline &&
            activePipelineKey === draw.pipelineKey &&
            activePipeline === draw.pipeline) {
            recordStateCommandPressure(scratch.pressure, "setPipeline", "elided");
        }
        else {
            pushSetPipelineCommand(scratch, draw);
            recordStateCommandPressure(scratch.pressure, "setPipeline", "emitted");
            activePipelineKey = draw.pipelineKey;
            activePipeline = draw.pipeline;
            hasActivePipeline = true;
        }
        scratch.sortedBindGroups.length = 0;
        for (const bindGroup of draw.bindGroups) {
            scratch.sortedBindGroups.push(bindGroup);
        }
        scratch.sortedBindGroups.sort((a, b) => a.group - b.group);
        for (const bindGroup of scratch.sortedBindGroups) {
            if (scratch.activeBindGroupResourceKeys.get(bindGroup.group) ===
                bindGroup.resourceKey &&
                scratch.activeBindGroups.get(bindGroup.group) === bindGroup.bindGroup) {
                recordStateCommandPressure(scratch.pressure, "setBindGroup", "elided");
            }
            else {
                pushSetBindGroupCommand(scratch, draw.renderId, bindGroup);
                recordStateCommandPressure(scratch.pressure, "setBindGroup", "emitted");
                scratch.activeBindGroupResourceKeys.set(bindGroup.group, bindGroup.resourceKey);
                scratch.activeBindGroups.set(bindGroup.group, bindGroup.bindGroup);
            }
        }
        for (let slot = 0; slot < draw.vertexBuffers.length; slot += 1) {
            const vertexBuffer = draw.vertexBuffers[slot];
            if (vertexBuffer !== undefined) {
                if (scratch.activeVertexBufferResourceKeys.get(slot) ===
                    vertexBuffer.resourceKey &&
                    scratch.activeVertexBuffers.get(slot) === vertexBuffer.buffer) {
                    recordStateCommandPressure(scratch.pressure, "setVertexBuffer", "elided");
                }
                else {
                    pushSetVertexBufferCommand(scratch, draw.renderId, slot, vertexBuffer);
                    recordStateCommandPressure(scratch.pressure, "setVertexBuffer", "emitted");
                    scratch.activeVertexBufferResourceKeys.set(slot, vertexBuffer.resourceKey);
                    scratch.activeVertexBuffers.set(slot, vertexBuffer.buffer);
                }
            }
        }
        if (draw.indexBuffer !== null) {
            if (hasActiveIndexBuffer &&
                activeIndexBufferResourceKey === draw.indexBuffer.resourceKey &&
                activeIndexBuffer === draw.indexBuffer.buffer &&
                activeIndexBufferFormat === draw.indexBuffer.format) {
                recordStateCommandPressure(scratch.pressure, "setIndexBuffer", "elided");
            }
            else {
                pushSetIndexBufferCommand(scratch, draw);
                recordStateCommandPressure(scratch.pressure, "setIndexBuffer", "emitted");
                activeIndexBufferResourceKey = draw.indexBuffer.resourceKey;
                activeIndexBuffer = draw.indexBuffer.buffer;
                activeIndexBufferFormat = draw.indexBuffer.format;
                hasActiveIndexBuffer = true;
            }
            if (draw.occlusionQuery === true) {
                pushBeginOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
            }
            pushDrawIndexedCommand(scratch, draw, drawCount, firstInstance);
            if (draw.occlusionQuery === true) {
                pushEndOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
                scratch.occlusionQueryRenderIds.push(draw.renderId);
                occlusionQueryCount += 1;
            }
            indexedDrawCount += 1;
            continue;
        }
        if (draw.occlusionQuery === true) {
            pushBeginOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
        }
        pushDrawCommand(scratch, draw, firstInstance);
        if (draw.occlusionQuery === true) {
            pushEndOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
            scratch.occlusionQueryRenderIds.push(draw.renderId);
            occlusionQueryCount += 1;
        }
        nonIndexedDrawCount += 1;
    }
    const plan = scratch.plan;
    plan.valid = scratch.diagnostics.length === 0;
    plan.drawCount = indexedDrawCount + nonIndexedDrawCount;
    plan.indexedDrawCount = indexedDrawCount;
    plan.nonIndexedDrawCount = nonIndexedDrawCount;
    plan.occlusionQueryCount = occlusionQueryCount;
    scratch.pressure.drawCommands =
        plan.drawCount;
    return scratch.plan;
}
function pushBeginOcclusionQueryCommand(scratch, draw, queryIndex) {
    const command = commandAt(scratch);
    command.kind = "beginOcclusionQuery";
    command.renderId = draw.renderId;
    command.queryIndex = queryIndex;
    scratch.commands.push(command);
}
function pushEndOcclusionQueryCommand(scratch, draw, queryIndex) {
    const command = commandAt(scratch);
    command.kind = "endOcclusionQuery";
    command.renderId = draw.renderId;
    command.queryIndex = queryIndex;
    scratch.commands.push(command);
}
function createRenderPassCommandPressureReport() {
    const setPipeline = createRenderPassStateCommandPressure();
    const setBindGroup = createRenderPassStateCommandPressure();
    const setVertexBuffer = createRenderPassStateCommandPressure();
    const setIndexBuffer = createRenderPassStateCommandPressure();
    return {
        resolvedDraws: 0,
        drawCommands: 0,
        stateCommands: {
            planned: 0,
            emitted: 0,
            elided: 0,
            setPipeline,
            setBindGroup,
            setVertexBuffer,
            setIndexBuffer,
        },
    };
}
function createRenderPassStateCommandPressure() {
    return {
        planned: 0,
        emitted: 0,
        elided: 0,
    };
}
function resetRenderPassCommandPressure(pressure) {
    const mutablePressure = pressure;
    mutablePressure.resolvedDraws = 0;
    mutablePressure.drawCommands = 0;
    resetRenderPassStateCommandPressure(mutablePressure.stateCommands);
    resetRenderPassStateCommandPressure(mutablePressure.stateCommands.setPipeline);
    resetRenderPassStateCommandPressure(mutablePressure.stateCommands.setBindGroup);
    resetRenderPassStateCommandPressure(mutablePressure.stateCommands.setVertexBuffer);
    resetRenderPassStateCommandPressure(mutablePressure.stateCommands.setIndexBuffer);
}
function resetRenderPassStateCommandPressure(pressure) {
    const mutable = pressure;
    mutable.planned = 0;
    mutable.emitted = 0;
    mutable.elided = 0;
}
function recordStateCommandPressure(pressure, kind, result) {
    const stateCommands = pressure.stateCommands;
    const commandPressure = stateCommands[kind];
    stateCommands.planned += 1;
    commandPressure.planned += 1;
    if (result === "emitted") {
        stateCommands.emitted += 1;
        commandPressure.emitted += 1;
        return;
    }
    stateCommands.elided += 1;
    commandPressure.elided += 1;
}
function pushSetPipelineCommand(scratch, draw) {
    const command = commandAt(scratch);
    command.kind = "setPipeline";
    command.renderId = draw.renderId;
    command.pipelineKey = draw.pipelineKey;
    command.pipeline = draw.pipeline;
    scratch.commands.push(command);
}
function pushSetBindGroupCommand(scratch, renderId, bindGroup) {
    const command = commandAt(scratch);
    command.kind = "setBindGroup";
    command.renderId = renderId;
    command.index = bindGroup.group;
    command.resourceKey = bindGroup.resourceKey;
    command.bindGroup = bindGroup.bindGroup;
    scratch.commands.push(command);
}
function pushSetVertexBufferCommand(scratch, renderId, slot, vertexBuffer) {
    const command = commandAt(scratch);
    command.kind = "setVertexBuffer";
    command.renderId = renderId;
    command.slot = slot;
    command.resourceKey = vertexBuffer.resourceKey;
    command.buffer = vertexBuffer.buffer;
    scratch.commands.push(command);
}
function pushSetIndexBufferCommand(scratch, draw) {
    const command = commandAt(scratch);
    command.kind = "setIndexBuffer";
    command.renderId = draw.renderId;
    command.resourceKey = draw.indexBuffer?.resourceKey ?? "";
    command.buffer = draw.indexBuffer?.buffer;
    command.format = draw.indexBuffer?.format ?? "";
    scratch.commands.push(command);
}
function pushDrawIndexedCommand(scratch, draw, indexCount, firstInstance) {
    const command = commandAt(scratch);
    command.kind = "drawIndexed";
    command.renderId = draw.renderId;
    command.indexCount = indexCount;
    command.instanceCount = draw.instanceCount;
    command.firstIndex = draw.indexStart ?? 0;
    command.baseVertex = 0;
    command.firstInstance = firstInstance;
    scratch.commands.push(command);
}
function pushDrawCommand(scratch, draw, firstInstance) {
    const command = commandAt(scratch);
    command.kind = "draw";
    command.renderId = draw.renderId;
    command.vertexCount = draw.vertexCount;
    command.instanceCount = draw.instanceCount;
    command.firstVertex = draw.vertexStart ?? 0;
    command.firstInstance = firstInstance;
    scratch.commands.push(command);
}
function commandAt(scratch) {
    const existing = scratch.commandPool[scratch.commands.length];
    if (existing !== undefined) {
        return existing;
    }
    const command = createEmptyCommand();
    scratch.commandPool.push(command);
    return command;
}
function createEmptyCommand() {
    return {
        kind: "draw",
        renderId: 0,
    };
}
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}
function transformPackedOffsetToInstance(offset) {
    if (!Number.isInteger(offset) || offset < 0 || offset % 16 !== 0) {
        return null;
    }
    return offset / 16;
}
//# sourceMappingURL=render-pass-commands.js.map