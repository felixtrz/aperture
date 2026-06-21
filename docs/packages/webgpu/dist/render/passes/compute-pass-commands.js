// Sibling of render-pass-commands.ts for first-class compute graph nodes (M3).
// A compute pass node carries a flat ComputePassCommand[] that the single-encoder
// graph executor replays inside one GPUComputePassEncoder. The command objects
// mirror the render-pass command shape: serializable metadata (kind/keys/counts)
// plus opaque GPU handles (`pipeline`/`bindGroup`/`buffer`) that are never put in
// a JSON report.
/**
 * Validate a flat compute command list without touching the GPU. Used by the
 * graph compiler (headless-safe) to surface malformed dispatches before the
 * executor runs them. A list is valid when it begins by binding a pipeline
 * before any dispatch and every dispatch has positive integer workgroup counts.
 */
export function validateComputePassCommands(commands) {
    const diagnostics = [];
    let hasPipeline = false;
    for (const command of commands) {
        switch (command.kind) {
            case "setComputePipeline":
                hasPipeline = true;
                break;
            case "dispatchWorkgroups":
                if (!hasPipeline) {
                    diagnostics.push({
                        code: "computePassCommand.missingPipeline",
                        message: "Compute dispatch issued before a pipeline was bound.",
                    });
                }
                if (!isPositiveInteger(command.workgroupCountX) ||
                    !isNonNegativeInteger(command.workgroupCountY) ||
                    !isNonNegativeInteger(command.workgroupCountZ)) {
                    diagnostics.push({
                        code: "computePassCommand.invalidWorkgroupCount",
                        message: `Compute dispatch has invalid workgroup counts (${command.workgroupCountX}, ${command.workgroupCountY}, ${command.workgroupCountZ}).`,
                    });
                }
                break;
            case "dispatchWorkgroupsIndirect":
                if (!hasPipeline) {
                    diagnostics.push({
                        code: "computePassCommand.missingPipeline",
                        message: "Indirect compute dispatch issued before a pipeline was bound.",
                    });
                }
                break;
            case "setComputeBindGroup":
                break;
        }
    }
    return diagnostics;
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}
/**
 * Replay a flat ComputePassCommand list against a live GPUComputePassEncoder,
 * mirroring executeRenderPassCommands. A missing encoder method is a recorded
 * diagnostic (the command is skipped), never a throw, so a degraded encoder
 * still produces a JSON-safe report.
 */
export function executeComputePassCommands(options) {
    const diagnostics = [];
    let executedCommands = 0;
    let dispatchCount = 0;
    for (const command of options.commands) {
        switch (command.kind) {
            case "setComputePipeline":
                if (options.pass.setPipeline === undefined) {
                    diagnostics.push(missingMethod("setPipeline"));
                    continue;
                }
                options.pass.setPipeline(command.pipeline);
                executedCommands += 1;
                break;
            case "setComputeBindGroup":
                if (options.pass.setBindGroup === undefined) {
                    diagnostics.push(missingMethod("setBindGroup"));
                    continue;
                }
                options.pass.setBindGroup(command.index, command.bindGroup);
                executedCommands += 1;
                break;
            case "dispatchWorkgroups":
                if (options.pass.dispatchWorkgroups === undefined) {
                    diagnostics.push(missingMethod("dispatchWorkgroups"));
                    continue;
                }
                options.pass.dispatchWorkgroups(command.workgroupCountX, command.workgroupCountY, command.workgroupCountZ);
                executedCommands += 1;
                dispatchCount += 1;
                break;
            case "dispatchWorkgroupsIndirect":
                if (options.pass.dispatchWorkgroupsIndirect === undefined) {
                    diagnostics.push(missingMethod("dispatchWorkgroupsIndirect"));
                    continue;
                }
                options.pass.dispatchWorkgroupsIndirect(command.buffer, command.offset);
                executedCommands += 1;
                dispatchCount += 1;
                break;
        }
    }
    return {
        valid: diagnostics.length === 0,
        commandCount: options.commands.length,
        executedCommands,
        skippedCommands: options.commands.length - executedCommands,
        dispatchCount,
        diagnostics,
    };
}
function missingMethod(method) {
    return {
        code: "computePassCommandExecutor.missingMethod",
        message: `Compute pass encoder is missing the '${method}' method.`,
        method,
    };
}
//# sourceMappingURL=compute-pass-commands.js.map