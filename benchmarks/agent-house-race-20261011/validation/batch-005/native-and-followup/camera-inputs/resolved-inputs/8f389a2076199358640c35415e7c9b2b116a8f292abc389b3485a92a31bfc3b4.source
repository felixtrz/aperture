import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { morphTargetDeltaBufferResourceKey } from "../core/resource-keys.js";
const DEFAULT_MORPH_TARGET_DELTA_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
const VEC3 = 3;
function morphTargetDeltaBufferResourceKeyForRenderId(renderId) {
    return morphTargetDeltaBufferResourceKey(`render:${renderId}`);
}
export function createMorphTargetDeltaBufferDescriptor(snapshot, draw, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_MORPH_TARGET_DELTA_BUFFER_USAGE;
    if (!draw.batchKey.morphed) {
        diagnostics.push({
            code: "morphTargetDeltaBuffer.notMorphed",
            renderId: draw.renderId,
            field: "batchKey.morphed",
            message: `Render id ${draw.renderId} is not a morphed draw.`,
        });
    }
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "morphTargetDeltaBuffer.invalidUsageFlags",
            renderId: draw.renderId,
            field: "usage",
            message: "Morph target delta storage-buffer usage flags must be a positive integer.",
        });
    }
    const source = snapshot.morphTargetDeltas ?? new Float32Array(0);
    const deltaOffset = draw.morphDeltaOffset ?? 0;
    const targetCount = draw.morphTargetCount ?? 0;
    const vertexCount = draw.morphVertexCount ?? 0;
    // Positions then normals: two target-major blocks of targetCount*vertexCount*3.
    const requiredEnd = deltaOffset + targetCount * vertexCount * VEC3 * 2;
    if (!Number.isInteger(deltaOffset) ||
        deltaOffset < 0 ||
        targetCount <= 0 ||
        vertexCount <= 0 ||
        requiredEnd > source.length) {
        diagnostics.push({
            code: "morphTargetDeltaBuffer.missingData",
            renderId: draw.renderId,
            field: "morphTargetDeltas",
            message: `Render id ${draw.renderId} references ${targetCount}×${vertexCount} morph deltas at offset ${deltaOffset}, but the snapshot morph delta buffer length is ${source.length}.`,
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    return {
        valid: true,
        plan: {
            descriptor: {
                label: options.label ?? `MorphTargetDeltas/render:${draw.renderId}`,
                size: source.byteLength,
                usage,
                initialData: source,
            },
            source,
            renderId: draw.renderId,
            floatCount: source.length,
        },
        diagnostics,
    };
}
export function createMorphTargetDeltaGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "morphTargetDeltaGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a morph target delta GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = morphTargetDeltaBufferResourceKeyForRenderId(options.plan.renderId);
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
                    code: "morphTargetDeltaGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create morph target delta buffer '${resourceKey}': ${result.message}`,
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
            floatCount: options.plan.floatCount,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=morph-target-delta-buffer.js.map