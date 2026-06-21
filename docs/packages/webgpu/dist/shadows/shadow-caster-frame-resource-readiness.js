const DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY = "__default_shadow_caster_layout__";
export function createShadowCasterFrameResourceReadinessReport(options) {
    if (options.casterDrawList.requestCount === 0) {
        return report({
            status: "not-required",
            records: [],
            diagnostics: [],
            pipelineDescriptors: 0,
            matrixBuffers: 0,
        });
    }
    const diagnostics = [];
    const preparedByMesh = new Map(options.preparedMeshes.map((mesh) => [mesh.meshKey, mesh]));
    const pipelineDescriptors = options.pipelineDescriptor.descriptors.length > 0
        ? options.pipelineDescriptor.descriptors
        : options.pipelineDescriptor.descriptor === null
            ? []
            : [options.pipelineDescriptor.descriptor];
    const pipelineDescriptorByLayout = createPipelineDescriptorByLayout(pipelineDescriptors);
    const matrixResourceKey = options.matrixBufferResource.resource?.resourceKey ?? null;
    if (pipelineDescriptors.length === 0) {
        diagnostics.push({
            code: "shadowCasterFrameResource.missingPipelineDescriptor",
            severity: "warning",
            message: "Shadow caster frame resources require a depth-only shadow caster pipeline descriptor.",
        });
    }
    if (matrixResourceKey === null) {
        diagnostics.push({
            code: "shadowCasterFrameResource.missingMatrixBuffer",
            severity: "warning",
            message: "Shadow caster frame resources require a live shadow matrix buffer resource.",
        });
    }
    const records = [];
    for (const list of options.casterDrawList.lists) {
        for (const draw of list.draws) {
            const prepared = preparedByMesh.get(draw.meshKey);
            const pipelineDescriptor = pipelineDescriptors.length === 0
                ? null
                : resolvePipelineDescriptorForLayout(draw.meshLayoutKey, draw.casterCullMode, pipelineDescriptorByLayout);
            const pipelineKey = pipelineDescriptor?.pipelineKey ?? null;
            if (prepared === undefined) {
                diagnostics.push({
                    code: "shadowCasterFrameResource.missingPreparedMesh",
                    severity: "warning",
                    renderId: draw.renderId,
                    meshKey: draw.meshKey,
                    message: `Shadow caster draw '${draw.renderId}' has no prepared mesh buffer resource for '${draw.meshKey}'.`,
                });
            }
            if (pipelineDescriptors.length > 0 && pipelineDescriptor === null) {
                diagnostics.push({
                    code: "shadowCasterFrameResource.missingPipelineDescriptor",
                    severity: "warning",
                    renderId: draw.renderId,
                    meshKey: draw.meshKey,
                    message: `Shadow caster draw '${draw.renderId}' has no depth-only pipeline descriptor for mesh layout '${draw.meshLayoutKey}'.`,
                });
            }
            records.push({
                renderId: draw.renderId,
                meshKey: draw.meshKey,
                meshLayoutKey: draw.meshLayoutKey,
                passKey: list.passKey,
                submesh: draw.submesh,
                ...(draw.vertexStart === undefined
                    ? {}
                    : { vertexStart: draw.vertexStart }),
                ...(draw.vertexCount === undefined
                    ? {}
                    : { vertexCount: draw.vertexCount }),
                ...(draw.indexStart === undefined
                    ? {}
                    : { indexStart: draw.indexStart }),
                ...(draw.indexCount === undefined
                    ? {}
                    : { indexCount: draw.indexCount }),
                meshResourceKey: prepared?.meshResourceKey ?? null,
                vertexBufferResourceKeys: prepared?.vertexBufferResourceKeys ?? [],
                indexBufferResourceKey: prepared?.indexBufferResourceKey ?? null,
                matrixResourceKey,
                pipelineKey,
                ready: prepared !== undefined &&
                    prepared.indexBufferResourceKey !== null &&
                    matrixResourceKey !== null &&
                    pipelineKey !== null,
            });
        }
    }
    if (pipelineDescriptors.length > 0) {
        diagnostics.push({
            code: "shadowCasterFrameResource.pipelineCreationDeferred",
            severity: "warning",
            message: "Shadow caster frame resources have pipeline descriptor metadata, but live pipeline creation is deferred.",
        });
    }
    if (records.length > 0) {
        diagnostics.push({
            code: "shadowCasterFrameResource.passSubmissionDeferred",
            severity: "warning",
            message: "Shadow caster frame resources are planned, but shadow pass submission is deferred.",
        });
    }
    const missing = diagnostics.some((diagnostic) => diagnostic.code ===
        "shadowCasterFrameResource.missingPipelineDescriptor" ||
        diagnostic.code === "shadowCasterFrameResource.missingMatrixBuffer" ||
        diagnostic.code === "shadowCasterFrameResource.missingPreparedMesh");
    return report({
        status: missing
            ? "missing"
            : options.casterDrawList.status === "deferred" ||
                options.pipelineDescriptor.status === "deferred"
                ? "deferred"
                : "ready",
        records,
        diagnostics,
        pipelineDescriptors: pipelineDescriptors.length,
        matrixBuffers: matrixResourceKey === null ? 0 : 1,
    });
}
export function shadowCasterFrameResourceReadinessReportToJsonValue(value) {
    return {
        ready: value.ready,
        status: value.status,
        counts: { ...value.counts },
        sections: { ...value.sections },
        records: value.records.map((record) => ({
            ...record,
            vertexBufferResourceKeys: [...record.vertexBufferResourceKeys],
        })),
        diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowCasterFrameResourceReadinessReportToJson(value) {
    return JSON.stringify(shadowCasterFrameResourceReadinessReportToJsonValue(value));
}
function report(input) {
    const readyDraws = input.records.filter((record) => record.ready).length;
    const missingMeshBuffers = input.records.filter((record) => record.meshResourceKey === null).length;
    return {
        ready: input.status === "ready" || input.status === "not-required",
        status: input.status,
        counts: {
            casterDraws: input.records.length,
            readyDraws,
            missingMeshBuffers,
            pipelineDescriptors: input.pipelineDescriptors,
            matrixBuffers: input.matrixBuffers,
        },
        sections: {
            casterDrawLists: input.records.length > 0 || input.status === "not-required",
            preparedMeshBuffers: missingMeshBuffers === 0,
            matrixBufferResource: input.matrixBuffers > 0,
            pipelineDescriptor: input.pipelineDescriptors > 0,
            pipelineCreation: false,
            passSubmission: false,
            shaderSampling: false,
        },
        records: input.records,
        diagnostics: input.diagnostics,
    };
}
function descriptorLayoutCullKey(meshLayoutKey, cullMode) {
    return `${meshLayoutKey}|cull:${cullMode}`;
}
function createPipelineDescriptorByLayout(descriptors) {
    return new Map(descriptors.map((descriptor) => [
        descriptorLayoutCullKey(descriptor.vertex.meshLayoutKey ?? DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY, descriptor.primitive.cullMode),
        descriptor,
    ]));
}
function resolvePipelineDescriptorForLayout(meshLayoutKey, cullMode, descriptors) {
    return (descriptors.get(descriptorLayoutCullKey(meshLayoutKey, cullMode)) ??
        descriptors.get(descriptorLayoutCullKey(DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY, cullMode)) ??
        null);
}
//# sourceMappingURL=shadow-caster-frame-resource-readiness.js.map