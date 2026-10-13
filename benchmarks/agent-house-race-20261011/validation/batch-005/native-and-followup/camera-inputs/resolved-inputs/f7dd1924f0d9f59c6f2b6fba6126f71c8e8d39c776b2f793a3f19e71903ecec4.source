import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { instanceAttributeBufferResourceKey } from "../core/resource-keys.js";
export const DEFAULT_INSTANCE_ATTRIBUTE_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.VERTEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function createInstanceAttributeVertexBufferLayout(layout) {
    return {
        arrayStride: layout.stride,
        stepMode: "instance",
        attributes: layout.attributes.map((attribute) => ({
            shaderLocation: attribute.shaderLocation,
            offset: attribute.offset,
            format: attribute.format,
        })),
    };
}
export function createInstanceAttributeBufferDescriptor(packed, options = {}) {
    const diagnostics = [];
    for (const diagnostic of packed.diagnostics) {
        diagnostics.push({
            code: "instanceAttributeBuffer.packDiagnostic",
            sourceCode: diagnostic.code,
            message: diagnostic.message,
        });
    }
    const usage = options.usage ?? DEFAULT_INSTANCE_ATTRIBUTE_BUFFER_USAGE;
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "instanceAttributeBuffer.invalidUsageFlags",
            field: "usage",
            message: "Instance attribute vertex buffer usage flags must be a positive integer.",
        });
    }
    const source = packed.data.subarray(0, packed.floatCount);
    const vertexCount = source.length / packed.layout.strideFloats;
    if (source.byteLength === 0 || packed.offsets.length === 0) {
        diagnostics.push({
            code: "instanceAttributeBuffer.emptyData",
            field: "data",
            message: "Packed instance attribute data must contain at least one instance row.",
        });
    }
    if (!Number.isInteger(vertexCount)) {
        diagnostics.push({
            code: "instanceAttributeBuffer.layoutMismatch",
            field: "layout",
            message: "Packed instance attribute data length must be divisible by the layout stride.",
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    return {
        valid: true,
        plan: {
            descriptor: {
                label: options.label ?? "InstanceAttributes/vertex",
                size: source.byteLength,
                usage,
                initialData: source,
            },
            source,
            layout: packed.layout,
            offsets: packed.offsets,
            vertexCount,
        },
        diagnostics,
    };
}
export function createInstanceAttributeGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "instanceAttributeGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create an instance attribute GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = instanceAttributeBufferResourceKey(options.plan.descriptor.label ?? "InstanceAttributes/vertex");
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
                    code: "instanceAttributeGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create instance attribute buffer '${resourceKey}': ${result.message}`,
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            streamId: "instanceAttributes",
            resourceKey,
            buffer: result.buffer,
            vertexCount: options.plan.vertexCount,
            layout: options.plan.layout,
            offsets: options.plan.offsets,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=instance-attribute-buffer.js.map