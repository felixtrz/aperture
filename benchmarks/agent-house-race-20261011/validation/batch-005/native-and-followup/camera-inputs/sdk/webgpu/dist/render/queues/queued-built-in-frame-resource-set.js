import { bindGroupResourceCacheReport, createBindGroupResourceCache, resetBindGroupResourceCache, } from "../../gpu/bind-group-resource-cache.js";
import { appendQueuedBuiltInFrameResourceViaAdapter, } from "../../materials/core/built-in-material-app-resource-adapter.js";
import { createQueuedMaterialFrameResourceScratch, prepareQueuedMaterialFrameResourceSet, resetQueuedMaterialFrameResourceScratch, } from "./queued-material-frame-resource-set.js";
import { appendQueuedMaterialFrameResourceBucket, createQueuedMaterialFrameResourceBuckets, createQueuedMaterialFrameResourceBucketSummary, resetQueuedMaterialFrameResourceBuckets, } from "./queued-material-frame-resource-buckets.js";
import { createQueuedMaterialFrameResourceRouteShell, } from "./queued-material-frame-resource-route.js";
import { createWebGpuAppFrameResourceRouteDiagnostic, } from "./queued-material-frame-resource-route-diagnostics.js";
export function createQueuedBuiltInFrameResourceScratch() {
    return {
        ...createQueuedMaterialFrameResourceScratch(),
        unlit: [],
        matcap: [],
        standard: [],
        debugNormal: [],
        byFamily: createQueuedMaterialFrameResourceBuckets(),
        sharedBindGroupCache: createBindGroupResourceCache(),
        lightBindGroupCache: createBindGroupResourceCache(),
        standardLightShadowBindGroupCache: createBindGroupResourceCache(),
    };
}
export async function prepareQueuedBuiltInFrameResourceSet(options) {
    const scratch = resetQueuedBuiltInFrameResourceScratch(options.scratch);
    const prepared = await prepareQueuedMaterialFrameResourceSet({
        items: options.resourceSet.items,
        scratch,
        callbacks: {
            getPipelineKey: (item) => item.draw.batchKey.pipelineKey,
            getPipelineLookupKey: (item) => [
                item.adapter.kind,
                item.draw.batchKey.pipelineKey,
                item.draw.batchKey.meshLayoutKey,
            ].join("|"),
            ...(options.callbacks.getPipelineResourceKey === undefined
                ? {}
                : {
                    getPipelineResourceKey: options.callbacks.getPipelineResourceKey,
                }),
            getRenderId: (item) => item.draw.renderId,
            getSourceMeshKey: (item) => item.sourceMeshKey,
            getSourceMaterialKey: (item) => item.sourceMaterialKey,
            getPipeline: options.callbacks.getPipeline,
            ...(options.callbacks.onPipelineLookupReuse === undefined
                ? {}
                : { onPipelineLookupReuse: options.callbacks.onPipelineLookupReuse }),
            getPipelineView: options.callbacks.getPipelineView,
            createPipelinePlanResult: options.callbacks.createPipelinePlanResult,
            getPipelineLayouts: options.callbacks.getPipelineLayouts,
            prepareTextureSamplerDependencies: options.callbacks.prepareTextureSamplerDependencies,
            ...(options.callbacks.getTextureSamplerDependenciesLookupKey === undefined
                ? {}
                : {
                    getTextureSamplerDependenciesLookupKey: options.callbacks.getTextureSamplerDependenciesLookupKey,
                }),
            ...(options.callbacks.onTextureSamplerDependenciesReuse === undefined
                ? {}
                : {
                    onTextureSamplerDependenciesReuse: options.callbacks.onTextureSamplerDependenciesReuse,
                }),
            createFrameResourceOptions: (input) => options.callbacks.createFrameResourceOptions({
                ...input,
                viewUniforms: options.viewUniforms,
                worldTransforms: options.worldTransforms,
                ...(options.instanceTints === undefined
                    ? {}
                    : { instanceTints: options.instanceTints }),
                sharedBindGroupCache: scratch.sharedBindGroupCache,
                lightBindGroupCache: scratch.lightBindGroupCache,
                standardLightShadowBindGroupCache: scratch.standardLightShadowBindGroupCache,
            }),
            createFrameResources: ({ item, options: frameOptions }) => item.adapter.createFrameResources(frameOptions),
            appendFrameResources: ({ item, result }) => {
                if (result.resources !== null) {
                    appendQueuedMaterialFrameResourceBucket(scratch.byFamily, item.adapter.kind, result.resources);
                }
                appendQueuedBuiltInFrameResourceViaAdapter({
                    adapter: item.adapter,
                    result,
                    buckets: {
                        unlit: scratch.unlit,
                        matcap: scratch.matcap,
                        standard: scratch.standard,
                        debugNormal: scratch.debugNormal,
                    },
                });
            },
            createRouteDiagnostic: ({ item, result }) => createQueuedBuiltInFrameResourceRouteDiagnostic(createQueuedBuiltInFrameResourceRouteShell({
                item,
                resources: result,
            })),
            getMeshResource: (resources) => resources.mesh,
            getMeshResourceKey: (resources) => resources.mesh.resourceKey,
            getMaterialResourceKey: (resources) => resources.material.resourceKey,
            getBindGroups: (resources) => resources.bindGroups,
        },
    });
    const resources = prepared.valid ? prepared.firstResources : null;
    const bindGroupReuse = createQueuedBuiltInBindGroupReuseReport(scratch);
    const result = {
        valid: prepared.valid,
        bindGroupReuse,
        resources: resources
            ? {
                mesh: resources.mesh,
                viewUniform: resources.viewUniform,
                worldTransforms: resources.worldTransforms,
                meshResources: prepared.meshResources,
                unlit: scratch.unlit,
                matcap: scratch.matcap,
                standard: scratch.standard,
                debugNormal: scratch.debugNormal,
                byFamily: scratch.byFamily,
                byFamilySummary: createQueuedMaterialFrameResourceBucketSummary(scratch.byFamily),
                bindGroups: prepared.bindGroups,
                bindGroupReuse,
            }
            : null,
        diagnostics: prepared.diagnostics,
    };
    return {
        valid: result.valid,
        resources: result.resources,
        resourcesResult: result,
        diagnostics: prepared.diagnostics,
        pipelineResults: prepared.pipelineResults,
        firstPipeline: prepared.firstPipeline,
        pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
        meshResourceKeys: prepared.meshResourceKeys,
        materialResourceKeys: prepared.materialResourceKeys,
    };
}
export function createQueuedBuiltInFrameResourceRouteShell(input) {
    return createQueuedMaterialFrameResourceRouteShell({
        prepareRoute: input.item.prepareRoute,
        backendMeshKey: input.item.meshKey,
        backendMaterialKey: input.item.materialKey,
        frameResources: input.resources,
    });
}
export function createQueuedBuiltInFrameResourceRouteDiagnostic(route) {
    return createWebGpuAppFrameResourceRouteDiagnostic(route);
}
function resetQueuedBuiltInFrameResourceScratch(scratch) {
    resetQueuedMaterialFrameResourceScratch(scratch);
    scratch.unlit.length = 0;
    scratch.matcap.length = 0;
    scratch.standard.length = 0;
    scratch.debugNormal.length = 0;
    resetQueuedMaterialFrameResourceBuckets(scratch.byFamily);
    resetBindGroupResourceCache(scratch.sharedBindGroupCache);
    resetBindGroupResourceCache(scratch.lightBindGroupCache);
    resetBindGroupResourceCache(scratch.standardLightShadowBindGroupCache);
    return scratch;
}
function createQueuedBuiltInBindGroupReuseReport(scratch) {
    const shared = bindGroupResourceCacheReport(scratch.sharedBindGroupCache);
    const lights = bindGroupResourceCacheReport(scratch.lightBindGroupCache);
    const standardLightShadows = bindGroupResourceCacheReport(scratch.standardLightShadowBindGroupCache);
    return {
        created: shared.created + lights.created + standardLightShadows.created,
        reused: shared.reused + lights.reused + standardLightShadows.reused,
        cached: shared.cached + lights.cached + standardLightShadows.cached,
        shared,
        lights,
        standardLightShadows,
    };
}
//# sourceMappingURL=queued-built-in-frame-resource-set.js.map