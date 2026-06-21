export function executeRenderPassCommands(options) {
    const diagnostics = [];
    let executedCommands = 0;
    let indexedDrawCalls = 0;
    let nonIndexedDrawCalls = 0;
    for (const command of options.commands) {
        switch (command.kind) {
            case "setPipeline": {
                if (options.pass.setPipeline === undefined) {
                    diagnostics.push(missingMethod("setPipeline", command.renderId));
                    break;
                }
                options.pass.setPipeline(command.pipeline);
                executedCommands += 1;
                break;
            }
            case "setBindGroup": {
                if (options.pass.setBindGroup === undefined) {
                    diagnostics.push(missingMethod("setBindGroup", command.renderId));
                    break;
                }
                options.pass.setBindGroup(command.index, command.bindGroup);
                executedCommands += 1;
                break;
            }
            case "setVertexBuffer": {
                if (options.pass.setVertexBuffer === undefined) {
                    diagnostics.push(missingMethod("setVertexBuffer", command.renderId));
                    break;
                }
                options.pass.setVertexBuffer(command.slot, command.buffer);
                executedCommands += 1;
                break;
            }
            case "setIndexBuffer": {
                if (options.pass.setIndexBuffer === undefined) {
                    diagnostics.push(missingMethod("setIndexBuffer", command.renderId));
                    break;
                }
                options.pass.setIndexBuffer(command.buffer, command.format);
                executedCommands += 1;
                break;
            }
            case "beginOcclusionQuery": {
                if (options.pass.beginOcclusionQuery === undefined) {
                    diagnostics.push(missingMethod("beginOcclusionQuery", command.renderId));
                    break;
                }
                options.pass.beginOcclusionQuery(command.queryIndex);
                executedCommands += 1;
                break;
            }
            case "endOcclusionQuery": {
                if (options.pass.endOcclusionQuery === undefined) {
                    diagnostics.push(missingMethod("endOcclusionQuery", command.renderId));
                    break;
                }
                options.pass.endOcclusionQuery();
                executedCommands += 1;
                break;
            }
            case "draw": {
                if (options.pass.draw === undefined) {
                    diagnostics.push(missingMethod("draw", command.renderId));
                    break;
                }
                options.pass.draw(command.vertexCount, command.instanceCount, command.firstVertex, command.firstInstance);
                executedCommands += 1;
                nonIndexedDrawCalls += 1;
                break;
            }
            case "drawIndexed": {
                if (options.pass.drawIndexed === undefined) {
                    diagnostics.push(missingMethod("drawIndexed", command.renderId));
                    break;
                }
                options.pass.drawIndexed(command.indexCount, command.instanceCount, command.firstIndex, command.baseVertex, command.firstInstance);
                executedCommands += 1;
                indexedDrawCalls += 1;
                break;
            }
            case "drawIndirect": {
                if (options.pass.drawIndirect === undefined) {
                    diagnostics.push(missingMethod("drawIndirect", command.renderId));
                    break;
                }
                options.pass.drawIndirect(command.buffer, command.offset);
                executedCommands += 1;
                nonIndexedDrawCalls += 1;
                break;
            }
            case "drawIndexedIndirect": {
                if (options.pass.drawIndexedIndirect === undefined) {
                    diagnostics.push(missingMethod("drawIndexedIndirect", command.renderId));
                    break;
                }
                options.pass.drawIndexedIndirect(command.buffer, command.offset);
                executedCommands += 1;
                indexedDrawCalls += 1;
                break;
            }
        }
    }
    return {
        valid: diagnostics.length === 0,
        commandCount: options.commands.length,
        executedCommands,
        skippedCommands: options.commands.length - executedCommands,
        drawCalls: indexedDrawCalls + nonIndexedDrawCalls,
        indexedDrawCalls,
        nonIndexedDrawCalls,
        diagnostics,
    };
}
function missingMethod(method, renderId) {
    return {
        code: "renderPassCommandExecutor.missingMethod",
        method,
        renderId,
        message: `Render pass encoder is missing '${method}' for render id ${renderId}.`,
    };
}
//# sourceMappingURL=render-pass-command-executor.js.map