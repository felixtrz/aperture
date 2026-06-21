export function resolveRenderPassResources(options) {
    const scratch = createResolveRenderPassResourcesScratch();
    writeResolveRenderPassResources(options, scratch);
    return scratch.plan;
}
export function createResolveRenderPassResourcesScratch(capacity = 0) {
    const draws = [];
    const diagnostics = [];
    const drawPool = [];
    for (let i = 0; i < capacity; i += 1) {
        drawPool.push(createEmptyResolvedDraw());
    }
    return {
        draws,
        diagnostics,
        drawPool,
        bindGroupPool: [],
        vertexBufferPool: [],
        indexBufferPool: [],
        pipelines: new Map(),
        bindGroups: new Map(),
        vertexBuffers: new Map(),
        indexBuffers: new Map(),
        plan: { valid: true, draws, diagnostics },
        bindGroupCursor: 0,
        vertexBufferCursor: 0,
        indexBufferCursor: 0,
    };
}
export function writeResolveRenderPassResources(options, scratch) {
    resetResolveScratch(scratch);
    indexResources(options, scratch);
    for (const draw of options.drawList) {
        const pipeline = scratch.pipelines.get(draw.pipelineKey);
        const resolvedDraw = resolvedDrawAt(scratch, scratch.draws.length);
        resolvedDraw.renderId = draw.renderId;
        resolvedDraw.pipelineKey = draw.pipelineKey;
        resolvedDraw.pipeline = pipeline;
        resolvedDraw.bindGroups.length = 0;
        resolvedDraw.vertexBuffers.length = 0;
        resolvedDraw.vertexCount = draw.vertexCount;
        resolvedDraw.vertexStart = draw.vertexStart ?? 0;
        resolvedDraw.indexBuffer = null;
        resolvedDraw.indexCount = draw.indexCount;
        resolvedDraw.indexStart = draw.indexStart ?? null;
        resolvedDraw.instanceCount = draw.instanceCount;
        resolvedDraw.transformPackedOffset = draw.transformPackedOffset;
        if (draw.occlusionQuery === true) {
            resolvedDraw.occlusionQuery = true;
        }
        else {
            delete resolvedDraw.occlusionQuery;
        }
        const bindGroupsReady = resolveBindGroups(draw, scratch, resolvedDraw);
        const vertexBuffersReady = resolveVertexBuffers(draw, scratch, resolvedDraw);
        const resolvedIndexBuffer = resolveIndexBuffer(draw, scratch);
        if (pipeline === undefined ||
            !bindGroupsReady ||
            !vertexBuffersReady ||
            (draw.indexBufferKey !== null && resolvedIndexBuffer === null)) {
            if (pipeline === undefined) {
                scratch.diagnostics.push({
                    code: "renderPassResource.missingPipeline",
                    renderId: draw.renderId,
                    resourceKey: draw.pipelineKey,
                    message: `Missing render pipeline handle '${draw.pipelineKey}' for render id ${draw.renderId}.`,
                });
            }
            continue;
        }
        resolvedDraw.indexBuffer = resolvedIndexBuffer;
        scratch.draws.push(resolvedDraw);
    }
    scratch.plan.valid =
        scratch.diagnostics.length === 0;
    return scratch.plan;
}
function resolveBindGroups(draw, scratch, resolvedDraw) {
    for (const resourceKey of draw.bindGroupKeys) {
        const bindGroup = scratch.bindGroups.get(resourceKey);
        if (bindGroup === undefined) {
            scratch.diagnostics.push({
                code: "renderPassResource.missingBindGroup",
                renderId: draw.renderId,
                resourceKey,
                message: `Missing bind group handle '${resourceKey}' for render id ${draw.renderId}.`,
            });
            continue;
        }
        const resolved = bindGroupAt(scratch);
        resolved.group = bindGroup.group;
        resolved.resourceKey = bindGroup.resourceKey;
        resolved.bindGroup = bindGroup.bindGroup;
        resolvedDraw.bindGroups.push(resolved);
    }
    return resolvedDraw.bindGroups.length === draw.bindGroupKeys.length;
}
function resolveVertexBuffers(draw, scratch, resolvedDraw) {
    for (const resourceKey of draw.vertexBufferKeys) {
        const vertexBuffer = scratch.vertexBuffers.get(resourceKey);
        if (vertexBuffer === undefined) {
            scratch.diagnostics.push({
                code: "renderPassResource.missingVertexBuffer",
                renderId: draw.renderId,
                resourceKey,
                message: `Missing vertex buffer handle '${resourceKey}' for render id ${draw.renderId}.`,
            });
            continue;
        }
        const resolved = vertexBufferAt(scratch);
        resolved.resourceKey = vertexBuffer.resourceKey;
        resolved.buffer = vertexBuffer.buffer;
        resolved.vertexCount = vertexBuffer.vertexCount;
        resolvedDraw.vertexBuffers.push(resolved);
    }
    return resolvedDraw.vertexBuffers.length === draw.vertexBufferKeys.length;
}
function resolveIndexBuffer(draw, scratch) {
    if (draw.indexBufferKey === null) {
        return null;
    }
    const indexBuffer = scratch.indexBuffers.get(draw.indexBufferKey);
    if (indexBuffer === undefined) {
        scratch.diagnostics.push({
            code: "renderPassResource.missingIndexBuffer",
            renderId: draw.renderId,
            resourceKey: draw.indexBufferKey,
            message: `Missing index buffer handle '${draw.indexBufferKey}' for render id ${draw.renderId}.`,
        });
        return null;
    }
    const resolved = indexBufferAt(scratch);
    resolved.resourceKey = indexBuffer.resourceKey;
    resolved.buffer = indexBuffer.buffer;
    resolved.format = indexBuffer.format;
    resolved.indexCount = indexBuffer.indexCount;
    return resolved;
}
function resetResolveScratch(scratch) {
    scratch.draws.length = 0;
    scratch.diagnostics.length = 0;
    scratch.pipelines.clear();
    scratch.bindGroups.clear();
    scratch.vertexBuffers.clear();
    scratch.indexBuffers.clear();
    scratch.bindGroupCursor = 0;
    scratch.vertexBufferCursor = 0;
    scratch.indexBufferCursor = 0;
}
function indexResources(options, scratch) {
    for (const pipeline of options.pipelines) {
        if (pipeline.ok) {
            scratch.pipelines.set(pipeline.key, pipeline.pipeline);
        }
    }
    for (const bindGroup of options.bindGroups) {
        scratch.bindGroups.set(bindGroup.resourceKey, bindGroup);
    }
    for (const mesh of options.meshResources) {
        for (const buffer of mesh.vertexBuffers) {
            scratch.vertexBuffers.set(buffer.resourceKey, buffer);
        }
        if (mesh.indexBuffer !== undefined) {
            scratch.indexBuffers.set(mesh.indexBuffer.resourceKey, mesh.indexBuffer);
        }
    }
    for (const buffer of options.instanceTintResources ?? []) {
        scratch.vertexBuffers.set(buffer.resourceKey, buffer);
    }
    for (const buffer of options.instanceAttributeResources ?? []) {
        scratch.vertexBuffers.set(buffer.resourceKey, buffer);
    }
}
function resolvedDrawAt(scratch, index) {
    const existing = scratch.drawPool[index];
    if (existing !== undefined) {
        return existing;
    }
    const draw = createEmptyResolvedDraw();
    scratch.drawPool.push(draw);
    return draw;
}
function bindGroupAt(scratch) {
    const existing = scratch.bindGroupPool[scratch.bindGroupCursor];
    scratch.bindGroupCursor += 1;
    if (existing !== undefined) {
        return existing;
    }
    const bindGroup = { group: 0, resourceKey: "", bindGroup: null };
    scratch.bindGroupPool.push(bindGroup);
    return bindGroup;
}
function vertexBufferAt(scratch) {
    const existing = scratch.vertexBufferPool[scratch.vertexBufferCursor];
    scratch.vertexBufferCursor += 1;
    if (existing !== undefined) {
        return existing;
    }
    const vertexBuffer = { resourceKey: "", buffer: null, vertexCount: 0 };
    scratch.vertexBufferPool.push(vertexBuffer);
    return vertexBuffer;
}
function indexBufferAt(scratch) {
    const existing = scratch.indexBufferPool[scratch.indexBufferCursor];
    scratch.indexBufferCursor += 1;
    if (existing !== undefined) {
        return existing;
    }
    const indexBuffer = {
        resourceKey: "",
        buffer: null,
        format: "",
        indexCount: 0,
    };
    scratch.indexBufferPool.push(indexBuffer);
    return indexBuffer;
}
function createEmptyResolvedDraw() {
    return {
        renderId: 0,
        pipelineKey: "",
        pipeline: null,
        bindGroups: [],
        vertexBuffers: [],
        vertexCount: 0,
        vertexStart: 0,
        indexBuffer: null,
        indexCount: null,
        indexStart: null,
        instanceCount: 1,
        transformPackedOffset: 0,
    };
}
//# sourceMappingURL=render-pass-resources.js.map