export const WEBGPU_BUFFER_USAGE_FLAGS = {
    COPY_DST: 0x8,
    INDEX: 0x10,
    VERTEX: 0x20,
    UNIFORM: 0x40,
    STORAGE: 0x80,
    INDIRECT: 0x100,
};
export const DEFAULT_MESH_UPLOAD_BUFFER_USAGE = {
    vertex: WEBGPU_BUFFER_USAGE_FLAGS.VERTEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
    index: WEBGPU_BUFFER_USAGE_FLAGS.INDEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
};
export function createMeshUploadBufferDescriptors(plan, usage = DEFAULT_MESH_UPLOAD_BUFFER_USAGE) {
    const diagnostics = [];
    if (plan === null) {
        diagnostics.push({
            code: "meshBuffer.nullPlan",
            message: "Cannot create mesh buffer descriptors from a null upload plan.",
        });
        return { valid: false, plan: null, diagnostics };
    }
    validateUsage(usage, diagnostics);
    if (plan.vertexStreams.length === 0) {
        diagnostics.push({
            code: "meshBuffer.emptyVertexUploads",
            field: "vertexStreams",
            message: "Mesh upload plan has no vertex streams to upload.",
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    const result = {
        label: plan.label,
        vertexBuffers: plan.vertexStreams.map((upload) => createVertexBufferDescriptor(upload, usage.vertex)),
    };
    if (plan.indexBuffer === undefined) {
        return { valid: true, plan: result, diagnostics };
    }
    return {
        valid: true,
        plan: {
            ...result,
            indexBuffer: createIndexBufferDescriptor(plan.indexBuffer, usage.index),
        },
        diagnostics,
    };
}
function createVertexBufferDescriptor(upload, usage) {
    return {
        streamId: upload.streamId,
        source: upload.source,
        ...(upload.updateRanges === undefined
            ? {}
            : { updateRanges: upload.updateRanges }),
        vertexCount: upload.vertexCount,
        descriptor: {
            label: upload.label,
            size: upload.byteLength,
            usage,
            initialData: upload.source,
        },
    };
}
function createIndexBufferDescriptor(upload, usage) {
    return {
        source: upload.source,
        ...(upload.updateRanges === undefined
            ? {}
            : { updateRanges: upload.updateRanges }),
        format: upload.format,
        indexCount: upload.indexCount,
        descriptor: {
            label: upload.label,
            size: upload.byteLength,
            usage,
            initialData: upload.source,
        },
    };
}
function validateUsage(usage, diagnostics) {
    if (!isPositiveInteger(usage.vertex)) {
        diagnostics.push({
            code: "meshBuffer.invalidUsageFlags",
            field: "usage.vertex",
            message: "Vertex buffer usage flags must be a positive integer.",
        });
    }
    if (!isPositiveInteger(usage.index)) {
        diagnostics.push({
            code: "meshBuffer.invalidUsageFlags",
            field: "usage.index",
            message: "Index buffer usage flags must be a positive integer.",
        });
    }
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
//# sourceMappingURL=mesh-buffer-descriptors.js.map