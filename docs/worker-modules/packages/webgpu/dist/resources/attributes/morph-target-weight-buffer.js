import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { morphTargetWeightBufferResourceKey } from "../core/resource-keys.js";
export const DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function morphTargetWeightBufferResourceKeyForRenderId(renderId) {
    return morphTargetWeightBufferResourceKey(`render:${renderId}`);
}
export function createMorphTargetWeightBufferDescriptor(snapshot, draw, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE;
    if (!draw.batchKey.morphed) {
        diagnostics.push({
            code: "morphTargetWeightBuffer.notMorphed",
            renderId: draw.renderId,
            field: "batchKey.morphed",
            message: `Render id ${draw.renderId} is not a morphed draw.`,
        });
    }
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "morphTargetWeightBuffer.invalidUsageFlags",
            renderId: draw.renderId,
            field: "usage",
            message: "Morph target weight storage-buffer usage flags must be a positive integer.",
        });
    }
    const source = snapshot.morphTargetWeights ?? new Float32Array(0);
    const weightOffset = draw.morphWeightOffset ?? 0;
    const targetCount = draw.morphTargetCount ?? 0;
    const requiredEnd = weightOffset + targetCount;
    if (!Number.isInteger(weightOffset) ||
        weightOffset < 0 ||
        targetCount <= 0 ||
        requiredEnd > source.length) {
        diagnostics.push({
            code: "morphTargetWeightBuffer.missingData",
            renderId: draw.renderId,
            field: "morphTargetWeights",
            message: `Render id ${draw.renderId} references ${targetCount} morph weights at offset ${weightOffset}, but the snapshot morph weight buffer length is ${source.length}.`,
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    return {
        valid: true,
        plan: {
            descriptor: {
                label: options.label ?? `MorphTargetWeights/render:${draw.renderId}`,
                size: source.byteLength,
                usage,
                initialData: source,
            },
            source,
            renderId: draw.renderId,
            weightCount: source.length,
        },
        diagnostics,
    };
}
export function createMorphTargetWeightGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "morphTargetWeightGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a morph target weight GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = morphTargetWeightBufferResourceKeyForRenderId(options.plan.renderId);
    const result = createWebGpuBuffer({
        device: options.device,
        descriptor: options.plan.descriptor,
    });
    if (!result.ok) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "morphTargetWeightGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create morph target weight buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey,
            buffer: result.buffer,
            renderId: options.plan.renderId,
            weightCount: options.plan.weightCount,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=morph-target-weight-buffer.js.map