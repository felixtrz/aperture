import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { instanceTintBufferResourceKey } from "../core/resource-keys.js";
export const INSTANCE_TINT_FLOATS = 4;
export const INSTANCE_TINT_BYTES = INSTANCE_TINT_FLOATS * 4;
export const INSTANCE_TINT_SHADER_LOCATION = 6;
export const DEFAULT_INSTANCE_TINT_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.VERTEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export const INSTANCE_TINT_VERTEX_BUFFER_LAYOUT = {
    arrayStride: INSTANCE_TINT_BYTES,
    stepMode: "instance",
    attributes: [
        {
            shaderLocation: INSTANCE_TINT_SHADER_LOCATION,
            offset: 0,
            format: "float32x4",
        },
    ],
};
export function createInstanceTintBufferDescriptorScratch() {
    const descriptor = {
        size: 0,
        usage: DEFAULT_INSTANCE_TINT_BUFFER_USAGE,
    };
    const plan = {
        descriptor,
        source: new Float32Array(0),
        offsets: [],
        vertexCount: 0,
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
export function writeInstanceTintBufferDescriptor(packed, scratch, options = {}) {
    const diagnostics = scratch.diagnostics;
    diagnostics.length = 0;
    for (const diagnostic of packed.diagnostics) {
        diagnostics.push({
            code: "instanceTintBuffer.packDiagnostic",
            sourceCode: diagnostic.code,
            message: diagnostic.message,
        });
    }
    const usage = options.usage ?? DEFAULT_INSTANCE_TINT_BUFFER_USAGE;
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "instanceTintBuffer.invalidUsageFlags",
            field: "usage",
            message: "Instance tint vertex buffer usage flags must be a positive integer.",
        });
    }
    const source = sourceViewFor(scratch, packed.data, packed.floatCount);
    const vertexCount = source.length / INSTANCE_TINT_FLOATS;
    if (source.byteLength === 0 || packed.offsets.length === 0) {
        diagnostics.push({
            code: "instanceTintBuffer.emptyData",
            field: "data",
            message: "Packed instance tint data must contain at least one vec4 tint.",
        });
    }
    if (!Number.isInteger(vertexCount)) {
        diagnostics.push({
            code: "instanceTintBuffer.emptyData",
            field: "data",
            message: "Packed instance tint data length must be a multiple of four floats.",
        });
    }
    if (diagnostics.length > 0) {
        scratch.result.valid = false;
        scratch.result.plan = null;
        return scratch.result;
    }
    scratch.descriptor.label = options.label ?? "InstanceTints/vertex";
    scratch.descriptor.size = source.byteLength;
    scratch.descriptor.usage = usage;
    scratch.descriptor.initialData = source;
    scratch.plan.source = source;
    scratch.plan.offsets = packed.offsets;
    scratch.plan.vertexCount = vertexCount;
    scratch.result.valid = true;
    scratch.result.plan = scratch.plan;
    return scratch.result;
}
export function createInstanceTintBufferDescriptor(packed, options = {}) {
    return writeInstanceTintBufferDescriptor(packed, createInstanceTintBufferDescriptorScratch(), options);
}
export function createInstanceTintGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "instanceTintGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create an instance tint GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = instanceTintBufferResourceKey(options.plan.descriptor.label ?? "InstanceTints/vertex");
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
                    code: "instanceTintGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create instance tint buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            streamId: "instanceTint",
            resourceKey,
            buffer: result.buffer,
            vertexCount: options.plan.vertexCount,
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
//# sourceMappingURL=instance-tint-buffer.js.map