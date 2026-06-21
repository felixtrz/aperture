import { createPreparedMaterialTextureSamplerDependencies, } from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import { prepareQueuedBuiltInFrameResourceSet, } from "../render/queues/queued-built-in-frame-resource-set.js";
import { prepareQueuedBuiltInSharedFrameResources } from "./queued-frame-shared-resources.js";
export async function prepareQueuedBuiltInFrameResources(options) {
    const resourceLifetimeFrame = options.resourceLifetimeFrame ?? options.snapshot.frame;
    const sharedFrameResources = prepareQueuedBuiltInSharedFrameResources({
        device: options.app.initialization.device,
        cache: options.cache.queuedBuiltInSharedFrame,
        viewUniforms: options.viewUniforms,
        worldTransforms: options.worldTransforms,
    });
    if (!sharedFrameResources.valid ||
        sharedFrameResources.viewUniform === null ||
        sharedFrameResources.worldTransforms === null) {
        return {
            valid: false,
            resources: null,
            resourcesResult: {
                valid: false,
                resources: null,
                bindGroupReuse: emptyQueuedBuiltInBindGroupReuseReport(),
                diagnostics: sharedFrameResources.diagnostics,
            },
            diagnostics: sharedFrameResources.diagnostics,
            pipelineResults: [],
            firstPipeline: null,
            pipelineKeysByRenderId: new Map(),
            meshResourceKeys: new Map(),
            materialResourceKeys: new Map(),
        };
    }
    const preparedViewUniform = sharedFrameResources.viewUniform;
    const preparedWorldTransforms = sharedFrameResources.worldTransforms;
    const prepared = await prepareQueuedBuiltInFrameResourceSet({
        resourceSet: options.resourceSet,
        scratch: options.cache.frameScratch.queuedBuiltInFrameResources,
        viewUniforms: options.viewUniforms,
        worldTransforms: options.worldTransforms,
        ...(options.instanceTints === undefined
            ? {}
            : { instanceTints: options.instanceTints }),
        callbacks: {
            getPipeline: options.getPipeline,
            onPipelineLookupReuse: ({ pipeline }) => {
                if (pipeline.valid && pipeline.resource !== null) {
                    options.reuse.pipelineHits += 1;
                }
            },
            getPipelineView: (pipeline) => pipeline,
            getPipelineResourceKey: ({ item, pipeline }) => pipeline.resource?.cacheKey ?? item.draw.batchKey.pipelineKey,
            createPipelinePlanResult: ({ item, pipeline }) => createWebGpuAppPipelinePlanResult(item.draw, pipeline),
            getPipelineLayouts: options.getPipelineLayouts,
            prepareTextureSamplerDependencies: ({ item }) => createPreparedMaterialTextureSamplerDependencies(item.adapter.prepareTextureSamplerResources({
                app: options.app,
                assets: options.assets,
                cache: options.cache,
                item,
                reuse: options.reuse,
            })),
            getTextureSamplerDependenciesLookupKey: (item) => [item.adapter.kind, item.materialKey].join("|"),
            onTextureSamplerDependenciesReuse: ({ dependencies }) => {
                options.reuse.textureResourcesReused += dependencies.textureKeys.length;
                options.reuse.samplerResourcesReused += dependencies.samplerKeys.length;
            },
            createFrameResourceOptions: ({ item, textureSamplerDependencies, viewUniforms, worldTransforms, instanceTints, layouts, sharedBindGroupCache, lightBindGroupCache, standardLightShadowBindGroupCache, }) => createQueuedBuiltInFrameResourceOptions({
                app: options.app,
                assets: options.assets,
                cache: options.cache,
                snapshot: options.snapshot,
                resourceLifetimeFrame,
                item,
                textureSamplerDependencies,
                viewUniforms,
                worldTransforms,
                preparedViewUniform,
                preparedWorldTransforms,
                ...(options.previousWorldTransforms === undefined
                    ? {}
                    : { previousWorldTransforms: options.previousWorldTransforms }),
                ...(instanceTints === undefined ? {} : { instanceTints }),
                layouts,
                sharedBindGroupCache,
                lightBindGroupCache,
                standardLightShadowBindGroupCache,
                ...(options.standardMaterialShadowReceiverResources === undefined
                    ? {}
                    : {
                        standardMaterialShadowReceiverResources: options.standardMaterialShadowReceiverResources,
                    }),
                ...(options.standardMaterialIblResources === undefined
                    ? {}
                    : {
                        standardMaterialIblResources: options.standardMaterialIblResources,
                    }),
                ...(options.standardAreaLightLtcResources === undefined
                    ? {}
                    : {
                        standardAreaLightLtcResources: options.standardAreaLightLtcResources,
                    }),
                ...(options.localLightCookieResources === undefined ||
                    options.localLightCookieResources === null
                    ? {}
                    : {
                        localLightCookieResources: options.localLightCookieResources,
                    }),
                ...(options.transmissionSceneColorResources === undefined
                    ? {}
                    : {
                        transmissionSceneColorResources: options.transmissionSceneColorResources,
                    }),
                reuse: options.reuse,
            }),
        },
    });
    options.reuse.queuedBindGroupsCreated +=
        prepared.resourcesResult.bindGroupReuse.created;
    options.reuse.queuedBindGroupsReused +=
        prepared.resourcesResult.bindGroupReuse.reused;
    options.reuse.queuedBindGroupCacheSize +=
        prepared.resourcesResult.bindGroupReuse.cached;
    return prepared;
}
function createQueuedBuiltInFrameResourceOptions(input) {
    return {
        app: input.app,
        assets: input.assets,
        cache: input.cache,
        preparedMaterials: input.cache.preparedMaterials,
        snapshot: input.snapshot,
        resourceLifetimeFrame: input.resourceLifetimeFrame,
        item: input.item,
        textureSamplerDependencies: input.textureSamplerDependencies,
        viewUniforms: input.viewUniforms,
        worldTransforms: input.worldTransforms,
        preparedViewUniform: input.preparedViewUniform,
        preparedWorldTransforms: input.preparedWorldTransforms,
        ...(input.previousWorldTransforms === undefined
            ? {}
            : { previousWorldTransforms: input.previousWorldTransforms }),
        ...(input.instanceTints === undefined
            ? {}
            : { instanceTints: input.instanceTints }),
        layouts: input.layouts,
        sharedBindGroupCache: input.sharedBindGroupCache,
        lightBindGroupCache: input.lightBindGroupCache,
        standardLightShadowBindGroupCache: input.standardLightShadowBindGroupCache,
        ...(input.standardMaterialShadowReceiverResources === undefined
            ? {}
            : {
                standardMaterialShadowReceiverResources: input.standardMaterialShadowReceiverResources,
            }),
        ...(input.standardMaterialIblResources === undefined
            ? {}
            : {
                standardMaterialIblResources: input.standardMaterialIblResources,
            }),
        ...(input.standardAreaLightLtcResources === undefined
            ? {}
            : {
                standardAreaLightLtcResources: input.standardAreaLightLtcResources,
            }),
        ...(input.localLightCookieResources === undefined ||
            input.localLightCookieResources === null
            ? {}
            : {
                localLightCookieResources: input.localLightCookieResources,
            }),
        ...(input.transmissionSceneColorResources === undefined
            ? {}
            : {
                transmissionSceneColorResources: input.transmissionSceneColorResources,
            }),
        reuse: input.reuse,
    };
}
function emptyQueuedBuiltInBindGroupReuseReport() {
    return {
        created: 0,
        reused: 0,
        cached: 0,
        shared: { created: 0, reused: 0, cached: 0 },
        lights: { created: 0, reused: 0, cached: 0 },
        standardLightShadows: { created: 0, reused: 0, cached: 0 },
    };
}
function createWebGpuAppPipelinePlanResult(draw, pipeline) {
    if (pipeline.resource === null) {
        throw new Error("Cannot create a WebGPU app pipeline plan result without a pipeline resource.");
    }
    return {
        ok: true,
        status: "miss",
        key: pipeline.resource.cacheKey,
        pipeline: pipeline.resource.pipeline,
        diagnostics: [],
    };
}
//# sourceMappingURL=queued-frame-resources.js.map