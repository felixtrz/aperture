import { appendPipelineScopedBindGroups, createPipelineScopedBindGroupScratch, resetPipelineScopedBindGroupScratch, } from "../../gpu/pipeline-scoped-bind-groups.js";
export function createQueuedMaterialFrameResourceScratch() {
    return {
        pipelineLookups: new Map(),
        pipelineResults: new Map(),
        pipelineResultList: [],
        textureSamplerDependencies: new Map(),
        pipelineKeysByRenderId: new Map(),
        meshResources: new Map(),
        meshResourceList: [],
        meshResourceKeys: new Map(),
        materialResourceKeys: new Map(),
        bindGroups: [],
        pipelineScopedBindGroups: createPipelineScopedBindGroupScratch(),
    };
}
export async function prepareQueuedMaterialFrameResourceSet(options) {
    const scratch = resetQueuedMaterialFrameResourceScratch(options.scratch);
    const diagnostics = [];
    let firstPipeline = null;
    let firstResources = null;
    for (const item of options.items) {
        const pipelineKey = options.callbacks.getPipelineKey(item);
        const pipelineLookupKey = options.callbacks.getPipelineLookupKey?.(item) ?? pipelineKey;
        let pipeline = scratch.pipelineLookups.get(pipelineLookupKey);
        if (pipeline === undefined) {
            const pipelineResult = options.callbacks.getPipeline(item);
            pipeline = isPromiseLike(pipelineResult)
                ? await pipelineResult
                : pipelineResult;
            scratch.pipelineLookups.set(pipelineLookupKey, pipeline);
        }
        else {
            options.callbacks.onPipelineLookupReuse?.({
                item,
                pipeline,
                pipelineKey,
                pipelineLookupKey,
            });
        }
        const pipelineView = options.callbacks.getPipelineView(pipeline);
        firstPipeline ??= pipeline;
        if (!pipelineView.valid || pipelineView.resource === null) {
            diagnostics.push(...pipelineView.diagnostics);
            continue;
        }
        const pipelineHandle = pipelineView.resource.pipeline;
        if (pipelineHandle.getBindGroupLayout === undefined) {
            diagnostics.push({
                code: "webGpuApp.missingPipelineLayouts",
                message: "The WebGPU app pipeline does not expose bind group layouts.",
            });
            continue;
        }
        const pipelineResourceKey = options.callbacks.getPipelineResourceKey?.({ item, pipeline }) ??
            pipelineKey;
        const renderId = options.callbacks.getRenderId?.(item);
        if (renderId !== undefined && renderId !== null) {
            scratch.pipelineKeysByRenderId.set(renderId, pipelineResourceKey);
        }
        if (!scratch.pipelineResults.has(pipelineResourceKey)) {
            const pipelineResult = options.callbacks.createPipelinePlanResult({
                item,
                pipeline,
            });
            scratch.pipelineResults.set(pipelineResourceKey, pipelineResult);
            scratch.pipelineResultList.push(pipelineResult);
        }
        const layouts = options.callbacks.getPipelineLayouts({
            item,
            pipeline,
            getBindGroupLayout: pipelineHandle.getBindGroupLayout.bind(pipelineHandle),
        });
        const textureSamplerDependenciesLookupKey = options.callbacks.getTextureSamplerDependenciesLookupKey?.(item) ?? null;
        let textureSamplerDependencies = textureSamplerDependenciesLookupKey === null
            ? undefined
            : scratch.textureSamplerDependencies.get(textureSamplerDependenciesLookupKey);
        if (textureSamplerDependencies === undefined) {
            textureSamplerDependencies =
                options.callbacks.prepareTextureSamplerDependencies({ item });
            if (textureSamplerDependenciesLookupKey !== null) {
                scratch.textureSamplerDependencies.set(textureSamplerDependenciesLookupKey, textureSamplerDependencies);
            }
        }
        else {
            if (textureSamplerDependenciesLookupKey !== null) {
                options.callbacks.onTextureSamplerDependenciesReuse?.({
                    item,
                    dependencies: textureSamplerDependencies,
                    lookupKey: textureSamplerDependenciesLookupKey,
                });
            }
        }
        if (!textureSamplerDependencies.valid) {
            diagnostics.push(...textureSamplerDependencies.diagnostics);
            continue;
        }
        const resourcesResult = options.callbacks.createFrameResources({
            item,
            options: options.callbacks.createFrameResourceOptions({
                item,
                textureSamplerDependencies,
                layouts,
            }),
        });
        if (!resourcesResult.valid || resourcesResult.resources === null) {
            diagnostics.push(...resourcesResult.diagnostics);
            diagnostics.push(options.callbacks.createRouteDiagnostic({
                item,
                result: resourcesResult,
            }));
            continue;
        }
        const resources = resourcesResult.resources;
        firstResources ??= resources;
        options.callbacks.appendFrameResources({
            item,
            result: resourcesResult,
            resources,
        });
        const meshResourceKey = options.callbacks.getMeshResourceKey(resources);
        if (!scratch.meshResources.has(meshResourceKey)) {
            scratch.meshResources.set(meshResourceKey, options.callbacks.getMeshResource(resources));
            scratch.meshResourceList.push(options.callbacks.getMeshResource(resources));
        }
        scratch.meshResourceKeys.set(options.callbacks.getSourceMeshKey(item), meshResourceKey);
        scratch.materialResourceKeys.set(options.callbacks.getSourceMaterialKey(item), options.callbacks.getMaterialResourceKey(resources));
        appendPipelineScopedBindGroups(options.callbacks.getBindGroups(resources), pipelineResourceKey, scratch.bindGroups, scratch.pipelineScopedBindGroups);
    }
    return {
        valid: diagnostics.length === 0 &&
            scratch.meshResources.size > 0 &&
            scratch.materialResourceKeys.size > 0 &&
            firstResources !== null,
        diagnostics,
        pipelineResults: scratch.pipelineResultList,
        firstPipeline,
        firstResources,
        meshResources: scratch.meshResourceList,
        bindGroups: scratch.bindGroups,
        pipelineKeysByRenderId: scratch.pipelineKeysByRenderId,
        meshResourceKeys: scratch.meshResourceKeys,
        materialResourceKeys: scratch.materialResourceKeys,
    };
}
export function resetQueuedMaterialFrameResourceScratch(scratch) {
    scratch.pipelineResults.clear();
    scratch.pipelineLookups.clear();
    scratch.pipelineResultList.length = 0;
    scratch.textureSamplerDependencies.clear();
    scratch.pipelineKeysByRenderId.clear();
    scratch.meshResources.clear();
    scratch.meshResourceList.length = 0;
    scratch.meshResourceKeys.clear();
    scratch.materialResourceKeys.clear();
    scratch.bindGroups.length = 0;
    resetPipelineScopedBindGroupScratch(scratch.pipelineScopedBindGroups);
    return scratch;
}
function isPromiseLike(value) {
    return (typeof value === "object" &&
        value !== null &&
        "then" in value &&
        typeof value.then === "function");
}
//# sourceMappingURL=queued-material-frame-resource-set.js.map