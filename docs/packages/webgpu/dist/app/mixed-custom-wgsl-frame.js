import { assetHandleKey, } from "@aperture-engine/simulation";
import { isCustomWgslMaterialAsset, writePackedSnapshotInstanceTintsForVertexBuffer, writePackedSnapshotTransforms, writePackedSnapshotViewUniforms, } from "@aperture-engine/render";
import { createCustomWgslAppFrameResources } from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import { prepareCustomWgslAppTextureSamplerBindingResources } from "./custom-wgsl-texture-sampler-resources.js";
import { customWgslMaterialRenderPipelineCacheKey } from "../materials/custom-wgsl/custom-wgsl-material.js";
import { mapFrameBoundaryReadbackSamples } from "../render/frame/frame-boundary.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import { prepareDrawOrderTransformPacking, } from "../render/frame/draw-order-transform-packing.js";
import { createWebGpuAppTransmissionGrabResources } from "./transmission-grab.js";
import { prepareWebGpuAppIndirectDrawCommands, shouldUseRenderBundlesForSnapshotSchedule, } from "./frame-boundary-support.js";
import { collectInstanceTintResources, createQueuedBuiltInAppDiagnosticsSummary, queuedBuiltInResourceSetHasStandardMaterial, resolveStandardAreaLightLtcResources, snapshotUsesTransmission, } from "./queued-built-in-support.js";
import { prepareSpriteFrameResourcesForSnapshot } from "./sprites.js";
import { prepareMsdfTextFrameResourcesForSnapshot } from "./text.js";
import { prepareParticleFrameResourcesForSnapshot } from "./particles.js";
import { renderSnapshotTimeSeconds } from "./snapshot.js";
import { prepareUiFrameResourcesForSnapshot } from "./ui.js";
import { prepareQueuedBuiltInFrameResources } from "./queued-frame-resources.js";
import { QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION } from "./queued-built-in-adapters.js";
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { getOrCreateWebGpuAppPipeline } from "./pipeline-resources.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { createWebGpuAppDiagnosticsSummaryWithGpuTimings, newOcclusionQueryDiagnostics, readWebGpuAppGpuTimings, readWebGpuAppOcclusionQueries, } from "./gpu-readback.js";
import { renderReport, frameBoundariesNeedGpuDrain, waitForSubmittedWork, } from "./report.js";
import { webGpuAppScenePassColorFormat } from "./render-color-format.js";
import { createWebGpuAppAutoShadowFrame } from "./auto-shadow-frame.js";
export async function renderMixedCustomWgslWebGpuAppFrame(options) {
    const resourceLifetimeFrame = options.resourceLifetimeFrame ?? options.snapshot.frame;
    const packedViews = writePackedSnapshotViewUniforms(options.snapshot, options.cache.frameScratch.viewUniforms, {
        previousViewProjectionByViewId: options.cache.postPasses.previousViewProjectionByViewId,
    });
    const packedTransforms = writePackedSnapshotTransforms(options.snapshot, options.cache.frameScratch.worldTransforms);
    const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(options.snapshot, packedTransforms, options.cache.frameScratch.instanceTints);
    const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
        app: options.app,
        cache: options.cache,
        required: queuedBuiltInResourceSetHasStandardMaterial(options.builtInResourceSet),
    });
    const transmissionGrabResources = createWebGpuAppTransmissionGrabResources({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        required: snapshotUsesTransmission(options.snapshot),
    });
    if (!standardAreaLightLtc.valid || !transmissionGrabResources.valid) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...standardAreaLightLtc.diagnostics,
                ...transmissionGrabResources.diagnostics,
            ],
        });
    }
    const autoShadowFrame = options.standardMaterialShadowReceiverResources === undefined &&
        options.autoStandardMaterialShadowReceiverResources !== false
        ? createWebGpuAppAutoShadowFrame({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            reuse: options.reuse,
            snapshot: options.snapshot,
            resourceLifetimeFrame,
            ...(options.label === undefined ? {} : { label: options.label }),
        })
        : null;
    const standardMaterialShadowReceiverResources = options.standardMaterialShadowReceiverResources ??
        autoShadowFrame?.receiverResources ??
        undefined;
    if (autoShadowFrame !== null &&
        (autoShadowFrame.report.status !== "submitted" ||
            autoShadowFrame.receiverResources === null)) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            shadow: autoShadowFrame.report,
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...autoShadowFrame.report.diagnostics,
            ],
        });
    }
    const preparedBuiltIn = await prepareQueuedBuiltInFrameResources({
        ...options,
        snapshot: options.snapshot,
        resourceLifetimeFrame,
        resourceSet: options.builtInResourceSet,
        viewUniforms: packedViews,
        worldTransforms: packedTransforms,
        instanceTints: packedInstanceTints,
        standardAreaLightLtcResources: standardAreaLightLtc.resources,
        localLightCookieResources: options.localLightCookieResources,
        transmissionSceneColorResources: transmissionGrabResources.resources,
        ...(standardMaterialShadowReceiverResources === undefined
            ? {}
            : {
                standardMaterialShadowReceiverResources: standardMaterialShadowReceiverResources,
            }),
        ...(options.standardMaterialIblResources === undefined
            ? {}
            : {
                standardMaterialIblResources: options.standardMaterialIblResources,
            }),
        getPipeline: (item) => getOrCreateWebGpuAppPipeline({
            app: options.app,
            cache: options.cache,
            reuse: options.reuse,
            kind: item.adapter.kind,
            pipelineKey: item.draw.batchKey.pipelineKey,
            batchKey: item.draw.batchKey,
        }),
        getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) => getWebGpuAppPipelineLayouts({
            cache: options.cache,
            kind: item.adapter.kind,
            pipeline,
            getBindGroupLayout,
        }),
    });
    const preparedCustom = await prepareCustomDrawResources({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        worldTransforms: packedTransforms,
        reuse: options.reuse,
    });
    const firstCustomPipeline = preparedCustom.resources[0]?.pipelineResult;
    const firstPipeline = preparedBuiltIn.firstPipeline ?? firstCustomPipeline ?? null;
    const resourcesResult = createMixedCustomWgslResourcesResult({
        builtIn: preparedBuiltIn.resourcesResult,
        custom: preparedCustom.resources.map((resource) => resource.resourcesResult),
        diagnostics: [
            ...preparedBuiltIn.diagnostics,
            ...preparedCustom.diagnostics,
        ],
    });
    const diagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
        snapshot: options.snapshot,
        resourceSet: options.builtInResourceSet,
        resources: preparedBuiltIn.resources,
        adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
    });
    options.phaseTimer.finish("prepare");
    if (!preparedBuiltIn.valid ||
        preparedBuiltIn.resources === null ||
        !preparedCustom.valid ||
        resourcesResult.resources === null) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            pipeline: firstPipeline,
            resources: resourcesResult,
            ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnosticsSummary,
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...preparedBuiltIn.diagnostics,
                ...preparedCustom.diagnostics,
            ],
        });
    }
    options.phaseTimer.start("sort");
    const customResourcesByRenderId = indexCustomResourcesByRenderId(preparedCustom.resources);
    const customPipelineKeysByRenderId = new Map(preparedCustom.resources.flatMap((resource) => resource.renderIds.map((renderId) => [
        renderId,
        resource.pipelinePlanResult.key,
    ])));
    const pipelineKeysByRenderId = new Map([
        ...preparedBuiltIn.pipelineKeysByRenderId,
        ...customPipelineKeysByRenderId,
    ]);
    const frameResources = resourcesResult.resources;
    const framePlan = writeRenderFramePlanFromSnapshot({
        snapshot: options.snapshot,
        snapshotChangeSet: options.snapshotChangeSet,
        renderWorld: options.app.renderWorld,
        transforms: packedTransforms,
        resolveMeshResourceKey: (draw) => customResourcesByRenderId.get(draw.renderId)?.meshResourceKey ??
            preparedBuiltIn.meshResourceKeys.get(assetHandleKey(draw.mesh)) ??
            null,
        resolveMaterialResourceKey: (draw) => customResourcesByRenderId.get(draw.renderId)?.materialResourceKey ??
            preparedBuiltIn.materialResourceKeys.get(assetHandleKey(draw.material)) ??
            null,
        meshResources: frameResources.meshResources,
        instanceTintResources: collectInstanceTintResources(preparedBuiltIn.resources),
        pipelineKeysByRenderId,
        pipelines: [
            ...preparedBuiltIn.pipelineResults,
            ...preparedCustom.resources.map((resource) => resource.pipelinePlanResult),
        ],
        bindGroups: frameResources.bindGroups,
        drawOrderTransformPacking: (input) => prepareDrawOrderTransformPacking({
            device: options.app.initialization
                .device,
            packages: input.packages,
            transforms: input.transforms,
            ...(input.pipelineKeysByRenderId === undefined
                ? {}
                : { pipelineKeysByRenderId: input.pipelineKeysByRenderId }),
            pipelines: input.pipelines,
            bindGroups: input.bindGroups,
            cache: options.cache.drawOrderTransforms,
            scratch: options.cache.frameScratch.drawOrderTransforms,
        }),
        scratch: options.cache.frameScratch.framePlan,
    });
    options.phaseTimer.finish("sort");
    const frameDiagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
        snapshot: options.snapshot,
        resourceSet: options.builtInResourceSet,
        resources: preparedBuiltIn.resources,
        adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
        framePlan,
    });
    options.phaseTimer.start("prepare");
    const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        worldTransforms: packedTransforms,
        reuse: options.reuse,
    });
    const textFrame = await prepareMsdfTextFrameResourcesForSnapshot({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        worldTransforms: packedTransforms,
        reuse: options.reuse,
    });
    const particleFrame = await prepareParticleFrameResourcesForSnapshot({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        reuse: options.reuse,
        time: renderSnapshotTimeSeconds(options.snapshot),
    });
    const uiFrame = await prepareUiFrameResourcesForSnapshot({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        reuse: options.reuse,
    });
    options.phaseTimer.finish("prepare");
    if (!spriteFrame.resources.valid ||
        !textFrame.resources.valid ||
        !particleFrame.valid ||
        !uiFrame.valid) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            pipeline: firstPipeline,
            resources: resourcesResult,
            ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnosticsSummary: frameDiagnosticsSummary,
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...packedTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...spriteFrame.resources.diagnostics,
                ...textFrame.resources.diagnostics,
                ...particleFrame.diagnostics,
                ...uiFrame.diagnostics,
            ],
        });
    }
    const overlayCommands = [
        ...spriteFrame.resources.commands,
        ...textFrame.resources.commands,
        ...particleFrame.commands,
    ];
    const frameCommands = overlayCommands.length === 0
        ? framePlan.commandPlan.commands
        : [...framePlan.commandPlan.commands, ...overlayCommands];
    const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
        app: options.app,
        cache: options.cache,
        commands: frameCommands,
        label: options.label ?? "aperture-mixed-custom-wgsl-app",
    });
    const renderBundleCommands = indirectDraws.commands.slice(0, framePlan.commandPlan.commands.length);
    options.phaseTimer.start("submit");
    const boundaries = await assembleWebGpuAppFrameBoundaries({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        commands: indirectDraws.commands,
        renderBundleCommands,
        overlayCommands: uiFrame.commands,
        label: options.label ?? "aperture-mixed-custom-wgsl-app",
        reuse: options.reuse,
        transmissionSceneColorResources: transmissionGrabResources.resources,
        ...(options.gpuTimings === undefined
            ? {}
            : { gpuTimings: options.gpuTimings }),
        enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(options.snapshotUpdateSchedule),
        ...(options.clearColor === undefined
            ? {}
            : { clearColor: options.clearColor }),
        ...(options.readbackSamples === undefined
            ? {}
            : { readbackSamples: options.readbackSamples }),
    });
    if (frameBoundariesNeedGpuDrain(boundaries)) {
        await waitForSubmittedWork(options.app.initialization.device);
    }
    const gpuTimings = await readWebGpuAppGpuTimings({
        readbacks: boundaries.gpuTimingReadbacks,
        diagnostics: boundaries.gpuTimingDiagnostics,
    });
    const occlusionQueries = await readWebGpuAppOcclusionQueries({
        readbacks: boundaries.occlusionQueryReadbacks,
        diagnostics: boundaries.occlusionQueryDiagnostics,
        queryCount: boundaries.occlusionQueryCount,
        frame: options.snapshot.frame,
        feedbackState: options.cache.occlusionFeedback,
        culling: boundaries.occlusionCulling,
    });
    const finalDiagnosticsSummary = gpuTimings === undefined
        ? frameDiagnosticsSummary
        : createWebGpuAppDiagnosticsSummaryWithGpuTimings(frameDiagnosticsSummary, gpuTimings);
    const frameOk = framePlan.apply.diagnostics.length === 0 &&
        framePlan.bindingPlan.diagnostics.length === 0 &&
        framePlan.packages.diagnostics.length === 0 &&
        framePlan.drawCommands.diagnostics.length === 0 &&
        framePlan.drawList.valid &&
        framePlan.resources.valid &&
        framePlan.commandPlan.valid &&
        spriteFrame.resources.diagnostics.length === 0 &&
        textFrame.resources.diagnostics.length === 0 &&
        particleFrame.diagnostics.length === 0 &&
        uiFrame.diagnostics.length === 0 &&
        boundaries.valid &&
        (occlusionQueries === undefined ||
            occlusionQueries.status !== "unsupported");
    const readback = await mapFrameBoundaryReadbackSamples(boundaries.readbackBoundary?.readback, frameOk);
    options.phaseTimer.finish("submit");
    return renderReport({
        ok: frameOk,
        snapshot: options.snapshot,
        snapshotChangeSet: options.snapshotChangeSet,
        snapshotUpdateSchedule: options.snapshotUpdateSchedule,
        pipeline: firstPipeline,
        resources: resourcesResult,
        boundary: boundaries.boundary,
        boundaries: boundaries.boundaries,
        renderTargets: boundaries.renderTargets,
        postEffects: boundaries.postEffects,
        ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
        ...(boundaries.renderBundles === undefined
            ? {}
            : { renderBundles: boundaries.renderBundles }),
        ...(boundaries.transmissionGrabPass === undefined
            ? {}
            : { transmissionGrabPass: boundaries.transmissionGrabPass }),
        ...(boundaries.msaa === undefined ? {} : { msaa: boundaries.msaa }),
        ...(boundaries.depthAttachment === undefined
            ? {}
            : { depthAttachment: boundaries.depthAttachment }),
        ...(readback === undefined ? {} : { readback }),
        ...(gpuTimings === undefined ? {} : { gpuTimings }),
        phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
        ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
        ...(indirectDraws.report.status === "skipped"
            ? {}
            : { indirectDraws: indirectDraws.report }),
        localLightCookieResources: options.localLightCookieResources,
        particles: particleFrame.report,
        resourceReuse: options.reuse,
        diagnosticsSummary: finalDiagnosticsSummary,
        drawPackages: framePlan.packages.packages.length,
        drawCommands: boundaries.plannedCommands,
        drawCalls: boundaries.drawCalls,
        commandPressure: framePlan.commandPlan.pressure,
        diagnostics: [
            ...options.snapshot.diagnostics,
            ...(options.routeDiagnostics ?? []),
            ...framePlan.bindingPlan.diagnostics,
            ...framePlan.readiness.diagnostics,
            ...framePlan.packages.diagnostics,
            ...framePlan.drawCommands.diagnostics,
            ...framePlan.drawList.diagnostics,
            ...framePlan.resources.diagnostics,
            ...framePlan.commandPlan.diagnostics,
            ...spriteFrame.resources.diagnostics,
            ...textFrame.resources.diagnostics,
            ...particleFrame.diagnostics,
            ...uiFrame.diagnostics,
            ...boundaries.diagnostics,
            ...newOcclusionQueryDiagnostics(occlusionQueries, boundaries.occlusionQueryDiagnostics),
        ],
    });
}
async function prepareCustomDrawResources(options) {
    const resources = [];
    const diagnostics = [];
    const resourceSetByKey = new Map();
    const customDraws = options.snapshot.meshDraws.filter((draw) => isCustomWgslDraw(options.assets, draw));
    for (const draw of customDraws) {
        const drawMeshKey = assetHandleKey(draw.mesh);
        const drawMaterialKey = assetHandleKey(draw.material);
        const resourceSetKey = `${drawMeshKey}|${drawMaterialKey}`;
        const existing = resourceSetByKey.get(resourceSetKey);
        if (existing !== undefined) {
            resourceSetByKey.set(resourceSetKey, {
                ...existing,
                renderIds: [...existing.renderIds, draw.renderId],
            });
            continue;
        }
        const prepared = await prepareCustomDrawResourceSet({
            ...options,
            draw,
            meshKey: drawMeshKey,
            materialKey: drawMaterialKey,
        });
        diagnostics.push(...prepared.diagnostics);
        if (prepared.resource === null) {
            continue;
        }
        resourceSetByKey.set(resourceSetKey, prepared.resource);
    }
    resources.push(...resourceSetByKey.values());
    const preparedRenderIdCount = resources.reduce((total, resource) => total + resource.renderIds.length, 0);
    return {
        valid: diagnostics.length === 0 && preparedRenderIdCount === customDraws.length,
        resources,
        diagnostics,
    };
}
async function prepareCustomDrawResourceSet(options) {
    const meshEntry = options.assets.get(options.draw.mesh);
    const materialEntry = options.assets.get(options.draw.material);
    const material = materialEntry?.asset;
    if (meshEntry?.asset === null ||
        meshEntry?.asset === undefined ||
        material === null ||
        material === undefined ||
        !isCustomWgslMaterialAsset(material)) {
        return {
            resource: null,
            diagnostics: [
                {
                    code: "webGpuApp.customWgslMissingSourceAsset",
                    message: "Mixed custom WGSL app route requires ready mesh and custom WGSL material source assets.",
                    renderId: options.draw.renderId,
                },
            ],
        };
    }
    const preparedEntry = options.cache.preparedMaterialFacade.get(options.draw.material);
    const prepared = preparedEntry?.prepared;
    if (prepared === undefined ||
        prepared.resourceFamily !== "custom-wgsl-material") {
        return {
            resource: null,
            diagnostics: [
                {
                    code: "webGpuApp.customWgslMaterialNotPrepared",
                    message: "Custom WGSL material source was not prepared before mixed frame resource creation.",
                    renderId: options.draw.renderId,
                },
            ],
        };
    }
    const colorFormat = webGpuAppScenePassColorFormat(options.app);
    const depthFormat = "depth24plus";
    const sampleCount = options.app.msaa.sampleCount;
    const pipelineCacheKey = customWgslMaterialRenderPipelineCacheKey({
        material: prepared,
        colorFormat,
        depthFormat,
        sampleCount,
    });
    const cachedPipeline = customWgslPipelineResultFromCache(options.cache.pipelines.get(pipelineCacheKey), pipelineCacheKey);
    const textureSamplerBindingResources = prepareCustomWgslAppTextureSamplerBindingResources({
        assets: options.assets,
        device: options.app.initialization.device,
        cache: options.cache,
        reuse: options.reuse,
        source: material,
        material: prepared,
    });
    if (cachedPipeline === undefined) {
        options.reuse.pipelineMisses += 1;
    }
    else {
        options.reuse.pipelineHits += 1;
    }
    const resources = await createCustomWgslAppFrameResources({
        device: options.app.initialization.device,
        mesh: meshEntry.asset,
        material: prepared,
        viewUniforms: options.viewUniforms,
        worldTransforms: options.worldTransforms,
        colorFormat,
        depthFormat,
        sampleCount,
        ...(cachedPipeline === undefined ? {} : { pipelineResult: cachedPipeline }),
        bindingResources: textureSamplerBindingResources.resources,
        bindingResourceDiagnostics: textureSamplerBindingResources.diagnostics,
        runtimeUniforms: options.snapshot.runtimeUniforms ?? [],
        runtimeUniformCache: options.cache.customWgslRuntimeUniforms,
        reuse: options.reuse,
    });
    if (cachedPipeline === undefined &&
        resources.pipelineResult?.valid === true &&
        resources.pipelineResult.resource !== null) {
        options.cache.pipelines.set(pipelineCacheKey, resources.pipelineResult);
    }
    if (!resources.valid ||
        resources.resources === null ||
        resources.pipeline === null ||
        resources.pipelineResult === null) {
        return {
            resource: null,
            diagnostics: resources.diagnostics,
        };
    }
    return {
        resource: {
            renderIds: [options.draw.renderId],
            meshKey: options.meshKey,
            materialKey: options.materialKey,
            pipelineResult: resources.pipelineResult,
            pipelinePlanResult: {
                ok: true,
                status: "miss",
                key: resources.pipeline.cacheKey,
                pipeline: resources.pipeline.pipeline,
                diagnostics: [],
            },
            meshResourceKey: resources.resources.mesh.resourceKey,
            materialResourceKey: resources.resources.material.resourceKey,
            resources: resources.resources,
            resourcesResult: resources,
        },
        diagnostics: resources.diagnostics,
    };
}
function createMixedCustomWgslResourcesResult(input) {
    const customResources = input.custom.flatMap((result) => result.resources === null ? [] : [result.resources]);
    const resources = input.builtIn.resources === null ||
        customResources.length !== input.custom.length
        ? null
        : {
            mesh: input.builtIn.resources.mesh,
            viewUniform: input.builtIn.resources.viewUniform,
            worldTransforms: input.builtIn.resources.worldTransforms,
            meshResources: [
                ...input.builtIn.resources.meshResources,
                ...customResources.map((resource) => resource.mesh),
            ],
            bindGroups: [
                ...input.builtIn.resources.bindGroups,
                ...customResources.flatMap((resource) => resource.bindGroups.map(asUnlitBindGroupResource)),
            ],
            unlit: input.builtIn.resources.unlit,
            matcap: input.builtIn.resources.matcap,
            standard: input.builtIn.resources.standard,
            debugNormal: input.builtIn.resources.debugNormal,
            custom: customResources,
        };
    return {
        valid: input.builtIn.valid &&
            input.custom.every((result) => result.valid) &&
            resources !== null,
        resources,
        builtIn: input.builtIn,
        custom: input.custom,
        diagnostics: input.diagnostics,
    };
}
function indexCustomResourcesByRenderId(resources) {
    const result = new Map();
    for (const resource of resources) {
        for (const renderId of resource.renderIds) {
            result.set(renderId, resource);
        }
    }
    return result;
}
function isCustomWgslDraw(assets, draw) {
    const material = assets.get(draw.material)?.asset;
    return (material !== null &&
        material !== undefined &&
        isCustomWgslMaterialAsset(material));
}
function customWgslPipelineResultFromCache(value, cacheKey) {
    return value?.resource?.cacheKey === cacheKey
        ? value
        : undefined;
}
function asUnlitBindGroupResource(bindGroup) {
    return bindGroup;
}
//# sourceMappingURL=mixed-custom-wgsl-frame.js.map