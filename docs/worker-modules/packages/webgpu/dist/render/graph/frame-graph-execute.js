// executeFrameGraph: the single-encoder graph executor (M3-T2).
//
// Walks a CompiledFrameGraph's ordered nodes and folds EVERY pass (render AND
// compute) into ONE GPUCommandEncoder, then finishes + submits exactly once —
// replacing the legacy "N encoders, N+1 submits" path. Render nodes go through
// encodeFrameBoundaryInto (so render-bundle caching + redundant-state elision in
// render-pass-command-executor.ts are preserved verbatim); compute nodes run
// their ComputePassCommand[] in a compute pass on the same encoder.
//
// WebGPU forbids an open pass while beginning another, so each node's pass is
// ended before the next begins (encodeFrameBoundaryInto / the compute branch end
// their own pass). Reference: references/engine/src/platform/graphics/render-pass.js
// (one encoder, explicit begin/end per pass, single submit) — concept borrowed.
import { createCommandEncoderResource, } from "../../gpu/command-encoder.js";
import { finishCommandEncoder, } from "../../gpu/command-buffer.js";
import { submitCommandBuffers, } from "../queues/queue-submit.js";
import { createRenderPassAttachmentPlan, } from "../passes/render-pass-attachments.js";
import { encodeFrameBoundaryInto, } from "../frame/frame-boundary.js";
import { executeComputePassCommands, } from "../passes/compute-pass-commands.js";
import { createMultiPassCommandSubmissionMetricsReport, } from "../../gpu/command-submission-metrics.js";
export function executeFrameGraph(options) {
    const diagnostics = [];
    const label = options.label ?? "frame-graph";
    if (!options.compiled.ok) {
        diagnostics.push({
            code: "frameGraphExecute.compileNotOk",
            message: "Cannot execute a frame graph that failed to compile (cyclic or invalid).",
        });
        return emptyExecuteReport(null, diagnostics, options.queue);
    }
    const encoder = createCommandEncoderResource({
        device: options.device,
        label,
    });
    const encoderHandle = encoder.resource?.encoder;
    if (encoderHandle === undefined) {
        diagnostics.push({
            code: "frameGraphExecute.encoderUnavailable",
            message: "WebGPU device did not produce a usable command encoder.",
        });
        return emptyExecuteReport(encoder, diagnostics, options.queue);
    }
    const nodes = [];
    const executions = [];
    for (const node of options.compiled.orderedNodes) {
        if (node.kind === "render") {
            const report = encodeRenderNode(node, options, encoderHandle, diagnostics);
            nodes.push(report);
            if (report.encode.execution !== null) {
                executions.push(report.encode.execution);
            }
        }
        else {
            const report = executeComputeNode(node, encoderHandle, diagnostics);
            nodes.push(report);
            if (report.execution !== null) {
                executions.push(report.execution);
            }
        }
    }
    const finish = finishCommandEncoder({ encoder: encoderHandle, label });
    const submit = finish.resource === null
        ? submitCommandBuffers({ queue: options.queue, commandBuffers: [] })
        : submitCommandBuffers({
            queue: options.queue,
            commandBuffers: [finish.resource],
        });
    const metrics = createMultiPassCommandSubmissionMetricsReport({
        executions,
        finish,
        submit,
    });
    const valid = diagnostics.length === 0 &&
        nodes.every((node) => node.valid) &&
        finish.valid &&
        submit.valid;
    return { valid, encoder, nodes, finish, submit, metrics, diagnostics };
}
function encodeRenderNode(node, options, encoderHandle, diagnostics) {
    // Fast path: a route supplied a fully-resolved boundary payload (built by the
    // exact legacy attachment code). Encode it into the shared encoder verbatim.
    const boundary = options.resources.resolveRenderBoundary?.(node);
    if (boundary !== undefined && boundary !== null) {
        const encode = encodeFrameBoundaryInto({
            ...boundary,
            encoder: encoderHandle,
        });
        return { name: node.name, kind: "render", valid: encode.valid, encode };
    }
    const ops = options.compiled.perNodeLoadStoreOps.get(node.name);
    const colorTargets = [];
    let depthTarget = null;
    let readbackTexture;
    node.writes.forEach((write, index) => {
        const resolved = options.resources.resolveAttachment(write.handle);
        if (resolved === null) {
            diagnostics.push({
                code: "frameGraphExecute.unresolvedWrite",
                message: `Render pass '${node.name}' write handle '${write.handle}' did not resolve to a view.`,
            });
            return;
        }
        const storeOp = ops?.writeStoreOps[index] ?? "store";
        if (resolved.kind === "depth") {
            depthTarget = {
                view: resolved.view,
                depthLoadOp: write.attachment,
                depthStoreOp: storeOp,
                ...(write.clearDepth === undefined
                    ? {}
                    : { depthClearValue: write.clearDepth }),
            };
        }
        else {
            colorTargets.push({
                view: resolved.view,
                ...(resolved.resolveTarget === undefined
                    ? {}
                    : { resolveTarget: resolved.resolveTarget }),
                loadOp: write.attachment,
                storeOp,
                ...(write.clearColor === undefined
                    ? {}
                    : { clearColor: write.clearColor }),
            });
        }
        if (readbackTexture === undefined) {
            readbackTexture = options.resources.resolveReadbackTexture?.(write.handle);
        }
    });
    const attachments = createRenderPassAttachmentPlan({
        colorTargets,
        ...(depthTarget === null ? {} : { depthTarget }),
    });
    const encode = encodeFrameBoundaryInto({
        encoder: encoderHandle,
        device: options.device,
        attachments,
        commands: node.commands,
        label: node.name,
        colorTargetSource: "offscreen-target",
        ...(readbackTexture === undefined ? {} : { readbackTexture }),
        ...(node.viewport === undefined ? {} : { viewport: node.viewport }),
        ...(node.scissor === undefined ? {} : { scissor: node.scissor }),
    });
    return { name: node.name, kind: "render", valid: encode.valid, encode };
}
function executeComputeNode(node, encoderHandle, diagnostics) {
    if (encoderHandle.beginComputePass === undefined) {
        diagnostics.push({
            code: "frameGraphExecute.missingComputePass",
            message: `Command encoder cannot begin a compute pass for '${node.name}'.`,
        });
        return { name: node.name, kind: "compute", valid: false, execution: null };
    }
    const pass = encoderHandle.beginComputePass({ label: node.name });
    const execution = executeComputePassCommands({
        pass,
        commands: node.commands,
    });
    const ended = pass.end !== undefined;
    pass.end?.();
    return {
        name: node.name,
        kind: "compute",
        valid: execution.valid && ended,
        execution,
    };
}
function emptyExecuteReport(encoder, diagnostics, queue) {
    const finish = {
        valid: false,
        resource: null,
        diagnostics: [],
    };
    const submit = submitCommandBuffers({ queue, commandBuffers: [] });
    const metrics = createMultiPassCommandSubmissionMetricsReport({
        executions: [],
        finish,
        submit,
    });
    return {
        valid: false,
        encoder,
        nodes: [],
        finish: null,
        submit: null,
        metrics,
        diagnostics,
    };
}
//# sourceMappingURL=frame-graph-execute.js.map