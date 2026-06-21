import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { worldTransformBufferResourceKey } from "../core/resource-keys.js";
export const DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function createWorldTransformBufferDescriptorScratch() {
    const descriptor = {
        size: 0,
        usage: DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE,
    };
    const plan = {
        descriptor,
        source: new Float32Array(0),
        offsets: [],
    };
    const diagnostics = [];
    return {
        source: new Float32Array(0),
        descriptor,
        plan,
        diagnostics,
        result: { valid: false, plan: null, diagnostics },
    };
}
export function writeWorldTransformBufferDescriptor(packed, scratch, options = {}) {
    const diagnostics = scratch.diagnostics;
    diagnostics.length = 0;
    for (const diagnostic of packed.diagnostics) {
        diagnostics.push({
            code: "worldTransformBuffer.packDiagnostic",
            sourceCode: diagnostic.code,
            message: diagnostic.message,
        });
    }
    const usage = options.usage ?? DEFAULT_WORLD_TRANSFORM_BUFFER_USAGE;
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "worldTransformBuffer.invalidUsageFlags",
            field: "usage",
            message: "World transform storage buffer usage flags must be a positive integer.",
        });
    }
    const floatCount = packed.floatCount ?? packed.data.length;
    const source = sourceViewFor(scratch, packed.data, floatCount);
    if (source.byteLength === 0 || packed.offsets.length === 0) {
        diagnostics.push({
            code: "worldTransformBuffer.emptyData",
            field: "data",
            message: "Packed world transform data must contain at least one transform matrix.",
        });
    }
    if (diagnostics.length > 0) {
        scratch.result.valid = false;
        scratch.result.plan = null;
        return scratch.result;
    }
    scratch.descriptor.label = options.label ?? "WorldTransforms/storage";
    scratch.descriptor.size = source.byteLength;
    scratch.descriptor.usage = usage;
    scratch.descriptor.initialData = source;
    scratch.plan.source = source;
    scratch.plan.offsets = packed.offsets;
    scratch.result.valid = true;
    scratch.result.plan = scratch.plan;
    return scratch.result;
}
export function createWorldTransformBufferDescriptor(packed, options = {}) {
    return writeWorldTransformBufferDescriptor(packed, createWorldTransformBufferDescriptorScratch(), options);
}
export function createWorldTransformGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "worldTransformGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a world transform GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = worldTransformBufferResourceKey(options.plan.descriptor.label ?? "WorldTransforms/storage");
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
                    code: "worldTransformGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create world transform buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey,
            buffer: result.buffer,
            offsets: options.plan.offsets,
        },
        diagnostics: [],
    };
}
function sourceViewFor(scratch, data, floatCount) {
    if (floatCount === data.length) {
        scratch.source = data;
        return data;
    }
    if (scratch.source.buffer !== data.buffer ||
        scratch.source.byteOffset !== data.byteOffset ||
        scratch.source.length !== floatCount) {
        scratch.source = data.subarray(0, floatCount);
    }
    return scratch.source;
}
//# sourceMappingURL=world-transform-buffer.js.map