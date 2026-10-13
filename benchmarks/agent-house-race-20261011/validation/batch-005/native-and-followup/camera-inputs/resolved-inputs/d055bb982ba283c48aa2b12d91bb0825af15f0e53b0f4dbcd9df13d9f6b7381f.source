import { createWebGpuBuffer, } from "../../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../meshes/mesh-buffer-descriptors.js";
import { skinningJointBufferResourceKey } from "../core/resource-keys.js";
export const SKINNING_JOINT_MATRIX_FLOATS = 16;
export const DEFAULT_SKINNING_JOINT_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function skinningJointBufferResourceKeyForRenderId(renderId) {
    return skinningJointBufferResourceKey(`render:${renderId}`);
}
export function createSkinningJointBufferDescriptor(snapshot, draw, options = {}) {
    const diagnostics = [];
    const usage = options.usage ?? DEFAULT_SKINNING_JOINT_BUFFER_USAGE;
    const sourceOffset = draw.boneMatrixOffset;
    const jointCount = draw.boneMatrixCount;
    if (!draw.batchKey.skinned) {
        diagnostics.push({
            code: "skinningJointBuffer.notSkinned",
            renderId: draw.renderId,
            field: "batchKey.skinned",
            message: `Render id ${draw.renderId} is not a skinned draw.`,
        });
    }
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "skinningJointBuffer.invalidUsageFlags",
            renderId: draw.renderId,
            field: "usage",
            message: "Skinning joint matrix storage-buffer usage flags must be a positive integer.",
        });
    }
    if (sourceOffset === undefined) {
        diagnostics.push({
            code: "skinningJointBuffer.missingOffset",
            renderId: draw.renderId,
            field: "boneMatrixOffset",
            message: `Render id ${draw.renderId} is skinned but has no bone matrix offset.`,
        });
    }
    if (jointCount === undefined || jointCount <= 0) {
        diagnostics.push({
            code: "skinningJointBuffer.missingCount",
            renderId: draw.renderId,
            field: "boneMatrixCount",
            message: `Render id ${draw.renderId} is skinned but has no positive bone matrix count.`,
        });
    }
    const source = snapshot.bones ?? new Float32Array(0);
    const requiredEnd = sourceOffset === undefined || jointCount === undefined
        ? 0
        : sourceOffset + jointCount * SKINNING_JOINT_MATRIX_FLOATS;
    if (sourceOffset !== undefined &&
        jointCount !== undefined &&
        (sourceOffset < 0 ||
            sourceOffset % SKINNING_JOINT_MATRIX_FLOATS !== 0 ||
            requiredEnd > source.length)) {
        diagnostics.push({
            code: "skinningJointBuffer.missingData",
            renderId: draw.renderId,
            field: "bones",
            message: `Render id ${draw.renderId} references bone matrices ${sourceOffset}..${requiredEnd}, but the snapshot bone buffer length is ${source.length}.`,
        });
    }
    if (diagnostics.length > 0 ||
        sourceOffset === undefined ||
        jointCount == null) {
        return { valid: false, plan: null, diagnostics };
    }
    const matrixSource = source.slice(sourceOffset, requiredEnd);
    return {
        valid: true,
        plan: {
            descriptor: {
                label: options.label ?? `SkinningJointMatrices/render:${draw.renderId}`,
                size: matrixSource.byteLength,
                usage,
                initialData: matrixSource,
            },
            source: matrixSource,
            renderId: draw.renderId,
            sourceOffset,
            jointCount,
        },
        diagnostics,
    };
}
export function createSkinningJointGpuBuffer(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "skinningJointGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create a skinning joint GPU buffer from a null descriptor plan.",
                },
            ],
        };
    }
    const resourceKey = skinningJointBufferResourceKeyForRenderId(options.plan.renderId);
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
                    code: "skinningJointGpuBuffer.creationFailed",
                    reason: result.reason,
                    resourceKey,
                    message: `Failed to create skinning joint buffer '${resourceKey}': ${result.message}`,
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
            jointCount: options.plan.jointCount,
            sourceOffset: options.plan.sourceOffset,
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=skinning-joint-buffer.js.map