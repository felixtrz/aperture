import { finishCommandEncoder } from "../../gpu/command-buffer.js";
import { createCommandEncoderResource } from "../../gpu/command-encoder.js";
import { createCurrentTextureColorTarget } from "../../app/presentation/current-texture-view.js";
import { submitCommandBuffers } from "../queues/queue-submit.js";
import { createRenderPassAttachmentPlan, } from "../passes/render-pass-attachments.js";
import { beginPlannedRenderPass, endPlannedRenderPass, } from "../passes/render-pass-lifecycle.js";
export function clearWebGpuCanvas(options) {
    if (options.device.queue === undefined) {
        return failure("queue-unavailable", "WebGPU device queue is unavailable.");
    }
    if (options.device.createCommandEncoder === undefined) {
        return failure("encoder-unavailable", "WebGPU device cannot create a command encoder.");
    }
    const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const colorTarget = createCurrentTextureColorTarget({
        context: options.context,
        clearColor: [color.r, color.g, color.b, color.a],
        loadOp: "clear",
        storeOp: "store",
    });
    if (!colorTarget.valid || colorTarget.target === null) {
        const reason = colorTarget.diagnostics[0]?.code ===
            "currentTextureView.missingTextureView"
            ? "texture-view-unavailable"
            : "current-texture-unavailable";
        return failure(reason, reason === "texture-view-unavailable"
            ? "WebGPU current texture did not provide a texture view."
            : "WebGPU context did not provide a current texture.");
    }
    const attachmentPlan = createRenderPassAttachmentPlan({
        colorTargets: [colorTarget.target],
    });
    if (!attachmentPlan.valid || attachmentPlan.plan === null) {
        return failure("texture-view-unavailable", "WebGPU clear target is invalid.");
    }
    const encoderResource = createCommandEncoderResource({
        device: options.device,
        label: "clear",
    });
    if (!encoderResource.valid || encoderResource.resource === null) {
        return failure("encoder-unavailable", "WebGPU device cannot create a command encoder.");
    }
    const encoder = encoderResource.resource
        .encoder;
    const begin = beginPlannedRenderPass({
        encoder,
        plan: withDepthStencil(attachmentPlan.plan, options),
    });
    if (!begin.valid || begin.pass === null) {
        return failure("encoder-unavailable", "WebGPU command encoder cannot begin a render pass.");
    }
    const end = endPlannedRenderPass(begin.pass);
    if (!end.valid) {
        return failure("encoder-unavailable", "WebGPU render pass encoder cannot end a render pass.");
    }
    const finished = finishCommandEncoder({
        encoder,
        label: "clear",
    });
    if (!finished.valid || finished.resource === null) {
        return failure("encoder-unavailable", "WebGPU command encoder cannot finish command buffers.");
    }
    const submitted = submitCommandBuffers({
        queue: options.device.queue,
        commandBuffers: [finished.resource],
    });
    if (!submitted.valid) {
        return failure("queue-unavailable", "WebGPU device queue is unavailable.");
    }
    return { ok: true, commandBuffer: finished.resource.commandBuffer };
}
function failure(reason, message) {
    return { ok: false, reason, message };
}
function withDepthStencil(plan, options) {
    if (options.depth === undefined && options.stencil === undefined) {
        return plan;
    }
    return {
        ...plan,
        depthStencilAttachment: {
            view: plan.colorAttachments[0]?.view,
            depthClearValue: options.depth,
            depthLoadOp: options.depth === undefined ? "load" : "clear",
            depthStoreOp: options.depth === undefined ? "store" : "store",
            stencilClearValue: options.stencil,
            stencilLoadOp: options.stencil === undefined ? undefined : "clear",
            stencilStoreOp: options.stencil === undefined ? undefined : "store",
        },
    };
}
//# sourceMappingURL=clear.js.map