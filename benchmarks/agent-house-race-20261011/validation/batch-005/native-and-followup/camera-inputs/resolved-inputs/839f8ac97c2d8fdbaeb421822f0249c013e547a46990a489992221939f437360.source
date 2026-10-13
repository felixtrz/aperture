export class WebGpuRenderPipelineCache {
    #pipelines = new Map();
    get size() {
        return this.#pipelines.size;
    }
    has(input) {
        return this.#pipelines.has(resolveKey(input));
    }
    clear() {
        this.#pipelines.clear();
    }
    getOrCreate(request) {
        const key = createWebGpuRenderPipelineCacheKey(request.key);
        const existing = this.#pipelines.get(key);
        if (existing !== undefined) {
            return { ok: true, status: "hit", key, pipeline: existing };
        }
        if (request.device.createRenderPipeline === undefined) {
            return {
                ok: false,
                reason: "create-render-pipeline-unavailable",
                key,
                message: "WebGPU device cannot create render pipelines.",
            };
        }
        const pipeline = request.device.createRenderPipeline(request.descriptor);
        this.#pipelines.set(key, pipeline);
        return { ok: true, status: "miss", key, pipeline };
    }
}
export function createWebGpuRenderPipelineCacheKey(input) {
    const topology = input.primitive?.topology ?? input.topology ?? input.batchKey.topology;
    const depthFormat = input.depthStencil?.format ?? input.depthFormat ?? null;
    return JSON.stringify({
        shader: {
            label: input.shaderLabel,
            family: input.shaderFamily ?? input.shaderLabel,
            variantKey: input.shaderVariantKey ?? input.batchKey.pipelineKey,
        },
        targets: {
            colorFormats: [...input.colorFormats],
            depthFormat,
            stencilFormat: input.stencilFormat ?? null,
        },
        layouts: {
            vertex: input.vertexLayoutKey ?? input.batchKey.meshLayoutKey,
            bindGroups: [...(input.bindGroupLayoutKeys ?? [])],
        },
        primitive: {
            topology,
            cullMode: input.primitive?.cullMode ?? "none",
            frontFace: input.primitive?.frontFace ?? "ccw",
            stripIndexFormat: input.primitive?.stripIndexFormat ?? null,
        },
        depthStencil: {
            format: depthFormat,
            depthWriteEnabled: input.depthStencil?.depthWriteEnabled ?? false,
            depthCompare: input.depthStencil?.depthCompare ?? "always",
            depthBias: input.depthStencil?.depthBias ?? 0,
            depthBiasSlopeScale: input.depthStencil?.depthBiasSlopeScale ?? 0,
            stencilReadMask: input.depthStencil?.stencilReadMask ?? 0,
            stencilWriteMask: input.depthStencil?.stencilWriteMask ?? 0,
        },
        blend: {
            alphaToCoverageEnabled: input.blend?.alphaToCoverageEnabled ?? false,
            colorTargets: input.blend?.colorTargets?.map((target) => ({
                format: target.format ?? null,
                blend: target.blend ?? null,
                writeMask: target.writeMask ?? "all",
            })) ??
                input.colorFormats.map((format) => ({
                    format,
                    blend: null,
                    writeMask: "all",
                })),
        },
        multisample: {
            sampleCount: input.sampleCount ?? 1,
        },
        material: {
            pipelineKey: input.materialPipelineKey ?? input.batchKey.pipelineKey,
            variantKey: input.materialVariantKey ?? input.batchKey.materialKey,
        },
        batch: {
            pipelineKey: input.batchKey.pipelineKey,
            materialKey: input.batchKey.materialKey,
            meshLayoutKey: input.batchKey.meshLayoutKey,
            topology: input.batchKey.topology,
            instanced: input.batchKey.instanced,
            skinned: input.batchKey.skinned,
            morphed: input.batchKey.morphed,
        },
    });
}
function resolveKey(input) {
    return typeof input === "string"
        ? input
        : createWebGpuRenderPipelineCacheKey(input);
}
//# sourceMappingURL=pipeline-cache.js.map