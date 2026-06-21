import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { rememberPackedSnapshotTransformsByRenderId, writeMaterialQueueFromSnapshot, writePackedSnapshotMeshTransforms, writePackedSnapshotInstanceTintsForVertexBuffer, writePackedSnapshotTransforms, writePackedSnapshotViewUniforms, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { mapFrameBoundaryReadbackSamples, } from "../render/frame/frame-boundary.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import { prepareDrawOrderTransformPacking, } from "../render/frame/draw-order-transform-packing.js";
import { createWebGpuAppDiagnosticsSummaryWithGpuTimings, createWebGpuAppGpuTimingForPass, newOcclusionQueryDiagnostics, readWebGpuAppGpuTimings, readWebGpuAppOcclusionQueries, } from "./gpu-readback.js";
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
import { createWebGpuAppMotionVectorReport, createWebGpuAppSceneMotionVectorPlan, prepareWebGpuAppPreviousObjectTransformResource, rememberCurrentViewProjectionMatrices, } from "./motion-vectors.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { createShadowCasterGraphPasses, } from "./shadow-caster-graph-pass.js";
import { renderReport, frameBoundariesNeedGpuDrain, waitForSubmittedWork, } from "./report.js";
import { autoShadowInputKeyUsesBounds, autoShadowInputKeyUsesCamera, createWebGpuAppAutoShadowFrameInputKey, createWebGpuAppAutoShadowFrame, standardAutoShadowPipelineKindFromSnapshot, } from "./auto-shadow-frame.js";
export async function renderQueuedBuiltInWebGpuAppFrame(options) {
    options.phaseTimer.startDetail("prepareMain");
    const resourceLifetimeFrame = options.resourceLifetimeFrame ?? options.snapshot.frame;
    const sceneMotionVectors = measureRenderPhaseDetail(options.phaseTimer, "prepareMainMotionVectors", () => createWebGpuAppSceneMotionVectorPlan({
        app: options.app,
        assets: options.assets,
        snapshot: options.snapshot,
    }));
    const packedViews = measureRenderPhaseDetail(options.phaseTimer, "prepareMainViews", () => writePackedSnapshotViewUniforms(options.snapshot, options.cache.frameScratch.viewUniforms, {
        previousViewProjectionByViewId: options.cache.postPasses.previousViewProjectionByViewId,
    }));
    const meshPackedTransforms = measureRenderPhaseDetail(options.phaseTimer, "prepareMainTransforms", () => writePackedSnapshotMeshTransforms(options.snapshot, options.cache.frameScratch.meshWorldTransforms));
    const overlayPackedTransforms = snapshotNeedsRawOffsetWorldTransforms(options.snapshot)
        ? writePackedSnapshotTransforms(options.snapshot, options.cache.frameScratch.worldTransforms)
        : meshPackedTransforms;
    const previousObjectTransforms = measureRenderPhaseDetail(options.phaseTimer, "prepareMainPreviousTransforms", () => prepareWebGpuAppPreviousObjectTransformResource({
        device: options.app.initialization.device,
        cache: options.cache.postPasses,
        currentTransforms: meshPackedTransforms,
        required: sceneMotionVectors.colorFormat !== null,
    }));
    const motionVectorColorFormat = sceneMotionVectors.colorFormat !== null &&
        previousObjectTransforms.resource === null
        ? null
        : sceneMotionVectors.colorFormat;
    // M5-T6: split the lit pass's indirect (ambient+IBL) light into a second
    // color target so an SSAO effect can attenuate only indirect light. Best
    // effort: mutually exclusive with motion vectors (both @location(1)) and
    // disabled under MSAA (the second attachment would need its own resolve).
    const indirectColorFormat = motionVectorColorFormat === null &&
        options.app.msaa.sampleCount <= 1 &&
        options.app.postEffects.some((effect) => effect.enabled !== false && effect.requiresIndirectColor === true)
        ? options.app.sceneRenderFormat
        : null;
    const packedInstanceTints = measureRenderPhaseDetail(options.phaseTimer, "prepareMainInstanceTints", () => writePackedSnapshotInstanceTintsForVertexBuffer(options.snapshot, meshPackedTransforms, options.cache.frameScratch.instanceTints));
    const standardAreaLightLtc = measureRenderPhaseDetail(options.phaseTimer, "prepareMainAreaLights", () => resolveStandardAreaLightLtcResources({
        app: options.app,
        cache: options.cache,
        required: queuedBuiltInResourceSetHasStandardMaterial(options.resourceSet),
    }));
    const transmissionGrabResources = measureRenderPhaseDetail(options.phaseTimer, "prepareMainTransmission", () => createWebGpuAppTransmissionGrabResources({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        required: snapshotUsesTransmission(options.snapshot),
    }));
    if (!standardAreaLightLtc.valid || !transmissionGrabResources.valid) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...meshPackedTransforms.diagnostics,
                ...previousObjectTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...standardAreaLightLtc.diagnostics,
                ...transmissionGrabResources.diagnostics,
            ],
        });
    }
    const autoShadowDetailStartedAt = nowMilliseconds();
    const usesAutoShadowFrame = options.standardMaterialShadowReceiverResources === undefined &&
        options.autoStandardMaterialShadowReceiverResources !== false;
    const autoShadowPipelineKind = usesAutoShadowFrame
        ? standardAutoShadowPipelineKindFromSnapshot(options.snapshot)
        : null;
    const autoShadowCache = evaluateReusableAutoShadowFrame({
        cache: options.cache,
        snapshot: options.snapshot,
        snapshotChangeSet: options.snapshotChangeSet,
        gpuTimings: options.gpuTimings,
        usesAutoShadowFrame,
        pipelineKind: autoShadowPipelineKind,
        hasExternalShadowResources: options.standardMaterialShadowReceiverResources !== undefined,
    });
    const cachedAutoShadowFrame = autoShadowCache.cached;
    options.reuse.autoShadowFrameCache = autoShadowCache.report;
    if (cachedAutoShadowFrame !== null) {
        options.reuse.autoShadowFramesReused += 1;
        options.cache.autoShadowFrame = {
            ...cachedAutoShadowFrame,
            frame: options.snapshot.frame,
            inputKey: autoShadowCache.currentInputKey,
        };
    }
    else if (autoShadowPipelineKind === null) {
        options.cache.autoShadowFrame = null;
    }
    else {
        options.cache.autoShadowFrame = null;
    }
    const autoShadowSubmitsOwnCommandBuffer = options.app.useFrameGraph !== true;
    const autoShadowGpuTiming = options.gpuTimings === true &&
        cachedAutoShadowFrame === null &&
        usesAutoShadowFrame &&
        autoShadowSubmitsOwnCommandBuffer &&
        autoShadowPipelineKind !== null
        ? await createWebGpuAppGpuTimingForPass(options.app, options.cache, options.label ?? "aperture-webgpu-app", "shadow", countAutoShadowGpuTimingQueries(options.snapshot))
        : null;
    const autoShadowFrame = cachedAutoShadowFrame !== null || !usesAutoShadowFrame
        ? null
        : createWebGpuAppAutoShadowFrame({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            reuse: options.reuse,
            snapshot: options.snapshot,
            resourceLifetimeFrame,
            ...(options.label === undefined ? {} : { label: options.label }),
            submit: autoShadowSubmitsOwnCommandBuffer,
            ...(autoShadowGpuTiming?.resources === null ||
                autoShadowGpuTiming?.resources === undefined
                ? {}
                : { gpuTiming: { resources: autoShadowGpuTiming.resources } }),
        });
    if (autoShadowFrame !== null) {
        options.reuse.autoShadowFramesCreated += 1;
    }
    const autoShadowGpuTimingReadbacks = autoShadowGpuTiming?.resources !== null &&
        autoShadowGpuTiming?.resources !== undefined &&
        autoShadowFrame?.commandBufferSubmission.gpuTiming !== undefined
        ? [
            {
                passName: autoShadowGpuTiming.passName,
                passNames: autoShadowGpuTimingPassNames(autoShadowFrame.passPlan),
                resources: autoShadowGpuTiming.resources,
                ...(autoShadowGpuTiming.release === undefined
                    ? {}
                    : { release: autoShadowGpuTiming.release }),
            },
        ]
        : [];
    if (autoShadowGpuTiming !== null &&
        autoShadowGpuTiming.release !== undefined &&
        autoShadowGpuTimingReadbacks.length === 0) {
        autoShadowGpuTiming.release();
    }
    const autoShadowGraphPasses = autoShadowFrame === null || options.app.useFrameGraph !== true
        ? []
        : createShadowCasterGraphPasses({
            passAttachments: autoShadowFrame.passAttachments,
            depthTextureResources: autoShadowFrame.depthTextureResources,
            commandRecords: autoShadowFrame.commandRecords.commandRecords,
        });
    const shadowCasterGraphPasses = [
        ...(options.shadowCasterGraphPasses ?? []),
        ...autoShadowGraphPasses,
    ];
    const autoShadowReport = cachedAutoShadowFrame?.report ?? autoShadowFrame?.report;
    const autoShadowReceiverResources = cachedAutoShadowFrame?.receiverResources ??
        autoShadowFrame?.receiverResources ??
        null;
    const standardMaterialShadowReceiverResources = options.standardMaterialShadowReceiverResources ??
        autoShadowReceiverResources ??
        undefined;
    options.phaseTimer.addDetail("prepareMainAutoShadow", nowMilliseconds() - autoShadowDetailStartedAt);
    if (autoShadowFrame !== null &&
        ((autoShadowFrame.report.status !== "submitted" &&
            !(autoShadowFrame.report.status === "ready" &&
                autoShadowGraphPasses.length > 0)) ||
            autoShadowFrame.receiverResources === null)) {
        options.cache.autoShadowFrame = null;
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            shadow: autoShadowFrame.report,
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...meshPackedTransforms.diagnostics,
                ...previousObjectTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...autoShadowFrame.report.diagnostics,
            ],
        });
    }
    const prepared = await measureRenderPhaseDetailAsync(options.phaseTimer, "prepareMainResources", () => prepareQueuedBuiltInFrameResources({
        ...options,
        resourceLifetimeFrame,
        viewUniforms: packedViews,
        worldTransforms: meshPackedTransforms,
        ...(previousObjectTransforms.resource === null
            ? {}
            : { previousWorldTransforms: previousObjectTransforms.resource }),
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
            motionVectorColorFormat,
            indirectColorFormat,
        }),
        getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) => getWebGpuAppPipelineLayouts({
            cache: options.cache,
            kind: item.adapter.kind,
            pipeline,
            getBindGroupLayout,
        }),
    }));
    const diagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
        snapshot: options.snapshot,
        resourceSet: options.resourceSet,
        resources: prepared.resources,
        adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
    });
    options.phaseTimer.finishDetail("prepareMain");
    options.phaseTimer.finish("prepare");
    if (!prepared.valid || prepared.resources === null) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            pipeline: prepared.firstPipeline,
            resources: prepared.resourcesResult,
            ...(autoShadowReport === undefined ? {} : { shadow: autoShadowReport }),
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnosticsSummary,
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...meshPackedTransforms.diagnostics,
                ...previousObjectTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...prepared.diagnostics,
            ],
        });
    }
    options.phaseTimer.start("queue");
    const queue = writeMaterialQueueFromSnapshot({ meshDraws: options.snapshot.meshDraws, diagnostics: [] }, {
        meshResourceKey: (input) => prepared.meshResourceKeys.get(input.meshKey) ?? null,
        materialResourceKey: (input) => prepared.materialResourceKeys.get(input.materialKey) ?? null,
    }, options.cache.frameScratch.materialQueue);
    options.phaseTimer.finish("queue");
    if (hasErrorDiagnostics(queue.diagnostics)) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            pipeline: prepared.firstPipeline,
            resources: prepared.resourcesResult,
            ...(autoShadowReport === undefined ? {} : { shadow: autoShadowReport }),
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnosticsSummary,
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...meshPackedTransforms.diagnostics,
                ...previousObjectTransforms.diagnostics,
                ...packedInstanceTints.diagnostics,
                ...(options.routeDiagnostics ?? []),
                ...queue.diagnostics,
            ],
        });
    }
    options.phaseTimer.start("sort");
    const framePlan = writeRenderFramePlanFromSnapshot({
        snapshot: options.snapshot,
        snapshotChangeSet: options.snapshotChangeSet,
        renderWorld: options.app.renderWorld,
        transforms: meshPackedTransforms,
        resolveMeshResourceKey: (draw) => prepared.meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
        resolveMaterialResourceKey: (draw) => prepared.materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
        meshResources: prepared.resources.meshResources,
        instanceTintResources: collectInstanceTintResources(prepared.resources),
        pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
        pipelines: prepared.pipelineResults,
        bindGroups: prepared.resources.bindGroups,
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
        resourceSet: options.resourceSet,
        resources: prepared.resources,
        adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
        framePlan,
    });
    options.phaseTimer.start("prepare");
    options.phaseTimer.startDetail("prepareOverlays");
    const spriteFrame = await measureRenderPhaseDetailAsync(options.phaseTimer, "prepareOverlaySprites", () => snapshotHasSpriteFrameWork(options.snapshot)
        ? prepareSpriteFrameResourcesForSnapshot({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            snapshot: options.snapshot,
            viewUniforms: packedViews,
            worldTransforms: overlayPackedTransforms,
            reuse: options.reuse,
        })
        : emptySpriteFrameResources());
    const textFrame = await measureRenderPhaseDetailAsync(options.phaseTimer, "prepareOverlayText", () => snapshotHasMsdfTextFrameWork(options.snapshot)
        ? prepareMsdfTextFrameResourcesForSnapshot({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            snapshot: options.snapshot,
            viewUniforms: packedViews,
            worldTransforms: overlayPackedTransforms,
            reuse: options.reuse,
        })
        : emptyMsdfTextFrameResources());
    const particleFrame = await measureRenderPhaseDetailAsync(options.phaseTimer, "prepareOverlayParticles", () => prepareParticleFrameResourcesForSnapshot({
        app: options.app,
        assets: options.assets,
        cache: options.cache,
        snapshot: options.snapshot,
        viewUniforms: packedViews,
        reuse: options.reuse,
        time: renderSnapshotTimeSeconds(options.snapshot),
    }));
    const uiFrame = await measureRenderPhaseDetailAsync(options.phaseTimer, "prepareOverlayUi", () => snapshotHasUiFrameWork(options.snapshot)
        ? prepareUiFrameResourcesForSnapshot({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            snapshot: options.snapshot,
            viewUniforms: packedViews,
            reuse: options.reuse,
        })
        : emptyUiFrameResources());
    options.phaseTimer.finishDetail("prepareOverlays");
    options.phaseTimer.finish("prepare");
    if (!spriteFrame.resources.valid ||
        !textFrame.resources.valid ||
        !particleFrame.valid ||
        !uiFrame.valid) {
        return renderReport({
            ok: false,
            snapshot: options.snapshot,
            pipeline: prepared.firstPipeline,
            resources: prepared.resourcesResult,
            ...(autoShadowReport === undefined ? {} : { shadow: autoShadowReport }),
            resourceReuse: options.reuse,
            phaseTimings: options.phaseTimer.report(options.cache.phaseTimingHistory, options.snapshot.frame),
            diagnosticsSummary: frameDiagnosticsSummary,
            diagnostics: [
                ...options.snapshot.diagnostics,
                ...packedViews.diagnostics,
                ...meshPackedTransforms.diagnostics,
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
        label: options.label ?? "aperture-webgpu-app",
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
        label: options.label ?? "aperture-webgpu-app",
        reuse: options.reuse,
        motionVectorColorFormat,
        indirectColorFormat,
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
        ...(shadowCasterGraphPasses.length === 0
            ? {}
            : { shadowCasterGraphPasses }),
    });
    rememberCurrentViewProjectionMatrices(options.snapshot, options.cache.postPasses.previousViewProjectionByViewId);
    const motionVectorHistoryUpdate = sceneMotionVectors.required && previousObjectTransforms.resource !== null
        ? rememberPackedSnapshotTransformsByRenderId(meshPackedTransforms, options.cache.postPasses.previousWorldTransformsByRenderId)
        : { stored: 0, staleRemoved: 0 };
    const motionVectorReport = createWebGpuAppMotionVectorReport({
        plan: sceneMotionVectors,
        objectHistory: previousObjectTransforms.history,
        resource: previousObjectTransforms.resource,
        update: motionVectorHistoryUpdate,
    });
    if (frameBoundariesNeedGpuDrain(boundaries)) {
        await waitForSubmittedWork(options.app.initialization.device);
    }
    const gpuTimings = await readWebGpuAppGpuTimings({
        readbacks: [
            ...autoShadowGpuTimingReadbacks,
            ...boundaries.gpuTimingReadbacks,
        ],
        diagnostics: [
            ...(autoShadowGpuTiming?.diagnostics ?? []),
            ...boundaries.gpuTimingDiagnostics,
        ],
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
    const report = renderReport({
        ok: frameOk,
        snapshot: options.snapshot,
        snapshotChangeSet: options.snapshotChangeSet,
        snapshotUpdateSchedule: options.snapshotUpdateSchedule,
        pipeline: prepared.firstPipeline,
        resources: prepared.resourcesResult,
        boundary: boundaries.boundary,
        boundaries: boundaries.boundaries,
        renderTargets: boundaries.renderTargets,
        postEffects: boundaries.postEffects,
        ...(autoShadowReport === undefined ? {} : { shadow: autoShadowReport }),
        motionVectors: motionVectorReport,
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
            ...(options.routeDiagnostics === undefined ? queue.diagnostics : []),
            ...previousObjectTransforms.diagnostics,
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
    rememberAutoShadowFrame({
        cache: options.cache,
        frame: options.snapshot.frame,
        frameOk,
        snapshot: options.snapshot,
        inputKey: autoShadowCache.currentInputKey,
        autoShadowFrame,
        graphPasses: autoShadowGraphPasses.length,
    });
    return report;
}
function rememberAutoShadowFrame(options) {
    const frame = options.autoShadowFrame;
    if (!options.frameOk ||
        frame === null ||
        frame.receiverResources === null ||
        !(frame.report.status === "submitted" ||
            (frame.report.status === "ready" && options.graphPasses > 0))) {
        return;
    }
    options.cache.autoShadowFrame = {
        frame: options.frame,
        inputKey: options.inputKey,
        receiverResources: frame.receiverResources,
        report: frame.report,
    };
}
function evaluateReusableAutoShadowFrame(options) {
    if (options.hasExternalShadowResources) {
        return {
            cached: null,
            currentInputKey: null,
            report: {
                status: "disabled",
                reason: "external-shadow-resources",
                pipelineKind: options.pipelineKind,
                previousFrame: options.snapshotChangeSet.previousFrame,
            },
        };
    }
    if (!options.usesAutoShadowFrame) {
        return {
            cached: null,
            currentInputKey: null,
            report: {
                status: "disabled",
                reason: "disabled-by-option",
                pipelineKind: options.pipelineKind,
                previousFrame: options.snapshotChangeSet.previousFrame,
            },
        };
    }
    if (options.pipelineKind === null) {
        return {
            cached: null,
            currentInputKey: null,
            report: {
                status: "disabled",
                reason: "no-auto-shadow-work",
                pipelineKind: null,
                previousFrame: options.snapshotChangeSet.previousFrame,
            },
        };
    }
    const cached = options.cache.autoShadowFrame;
    if (options.gpuTimings === true) {
        const miss = autoShadowCacheMissReport({
            reason: "gpu-timings",
            pipelineKind: options.pipelineKind,
            cached,
            previousFrame: options.snapshotChangeSet.previousFrame,
            snapshot: options.snapshot,
        });
        return {
            cached: null,
            currentInputKey: miss.currentInputKey,
            report: miss.report,
        };
    }
    if (options.snapshotChangeSet.previousFrame === null) {
        const miss = autoShadowCacheMissReport({
            reason: "no-previous-frame",
            pipelineKind: options.pipelineKind,
            cached,
            previousFrame: null,
            snapshot: options.snapshot,
        });
        return {
            cached: null,
            currentInputKey: miss.currentInputKey,
            report: miss.report,
        };
    }
    if (cached === null) {
        const miss = autoShadowCacheMissReport({
            reason: "empty-cache",
            pipelineKind: options.pipelineKind,
            cached: null,
            previousFrame: options.snapshotChangeSet.previousFrame,
            snapshot: options.snapshot,
        });
        return {
            cached: null,
            currentInputKey: miss.currentInputKey,
            report: miss.report,
        };
    }
    if (cached.frame === options.snapshot.frame) {
        return {
            cached,
            currentInputKey: cached.inputKey,
            report: {
                status: "hit",
                pipelineKind: options.pipelineKind,
                cachedFrame: cached.frame,
                previousFrame: options.snapshotChangeSet.previousFrame,
                currentInputKeyHash: null,
                cachedInputKeyHash: null,
                currentInputKeyLength: cached.inputKey?.length ?? null,
                cachedInputKeyLength: cached.inputKey?.length ?? null,
                reuseSource: "same-frame",
            },
        };
    }
    const changeSetChangedSection = autoShadowInputChangedSectionFromChangeSet(options.snapshot, options.snapshotChangeSet);
    if (changeSetChangedSection === null &&
        cached.frame === options.snapshotChangeSet.previousFrame) {
        return {
            cached,
            currentInputKey: cached.inputKey,
            report: {
                status: "hit",
                pipelineKind: options.pipelineKind,
                cachedFrame: cached.frame,
                previousFrame: options.snapshotChangeSet.previousFrame,
                currentInputKeyHash: null,
                cachedInputKeyHash: null,
                currentInputKeyLength: cached.inputKey?.length ?? null,
                cachedInputKeyLength: cached.inputKey?.length ?? null,
                reuseSource: "change-set",
            },
        };
    }
    if (changeSetChangedSection !== null) {
        return {
            cached: null,
            currentInputKey: null,
            report: {
                status: "miss",
                reason: "input-key-changed",
                pipelineKind: options.pipelineKind,
                cachedFrame: cached.frame,
                previousFrame: options.snapshotChangeSet.previousFrame,
                currentInputKeyHash: null,
                cachedInputKeyHash: null,
                currentInputKeyLength: null,
                cachedInputKeyLength: cached.inputKey?.length ?? null,
                firstChangedInputSection: changeSetChangedSection,
            },
        };
    }
    const inputKey = createWebGpuAppAutoShadowFrameInputKey(options.snapshot);
    const cachedInputKeyHash = hashAutoShadowInputKey(cached.inputKey);
    const currentInputKeyHash = hashAutoShadowInputKey(inputKey);
    if (cached.inputKey === inputKey) {
        return {
            cached,
            currentInputKey: inputKey,
            report: {
                status: "hit",
                pipelineKind: options.pipelineKind,
                cachedFrame: cached.frame,
                previousFrame: options.snapshotChangeSet.previousFrame,
                currentInputKeyHash,
                cachedInputKeyHash,
                currentInputKeyLength: inputKey.length,
                cachedInputKeyLength: cached.inputKey?.length ?? null,
                reuseSource: "input-key",
            },
        };
    }
    return {
        cached: null,
        currentInputKey: inputKey,
        report: {
            status: "miss",
            reason: "input-key-changed",
            pipelineKind: options.pipelineKind,
            cachedFrame: cached.frame,
            previousFrame: options.snapshotChangeSet.previousFrame,
            currentInputKeyHash,
            cachedInputKeyHash,
            currentInputKeyLength: inputKey.length,
            cachedInputKeyLength: cached.inputKey?.length ?? null,
            firstChangedInputSection: cached.inputKey === null
                ? null
                : firstChangedAutoShadowInputKeySection(cached.inputKey, inputKey),
        },
    };
}
function autoShadowCacheMissReport(options) {
    const inputKey = createWebGpuAppAutoShadowFrameInputKey(options.snapshot);
    return {
        currentInputKey: inputKey,
        report: {
            status: "miss",
            reason: options.reason,
            pipelineKind: options.pipelineKind,
            cachedFrame: options.cached?.frame ?? null,
            previousFrame: options.previousFrame,
            currentInputKeyHash: hashAutoShadowInputKey(inputKey),
            cachedInputKeyHash: options.cached === null
                ? null
                : hashAutoShadowInputKey(options.cached.inputKey),
            currentInputKeyLength: inputKey.length,
            cachedInputKeyLength: options.cached?.inputKey?.length ?? null,
        },
    };
}
function autoShadowInputChangedSectionFromChangeSet(snapshot, changeSet) {
    if (familyChanged(changeSet.shadowRequests)) {
        return "requests";
    }
    if (autoShadowInputKeyUsesCamera(snapshot) &&
        familyChanged(changeSet.views)) {
        return "camera";
    }
    if (familyChanged(changeSet.lights)) {
        return "lights";
    }
    if (familyChanged(changeSet.shadowCasterDraws)) {
        return "casters";
    }
    if (autoShadowInputKeyUsesBounds(snapshot) &&
        familyChanged(changeSet.bounds)) {
        return "bounds";
    }
    return null;
}
function familyChanged(family) {
    return family.changed > 0 || family.removed > 0;
}
const AUTO_SHADOW_INPUT_KEY_SECTIONS = [
    "version",
    "mode",
    "camera",
    "requests",
    "lights",
    "casters",
    "bounds",
];
function firstChangedAutoShadowInputKeySection(previous, current) {
    const previousSections = previous.split(";");
    const currentSections = current.split(";");
    const sectionCount = Math.max(previousSections.length, currentSections.length);
    for (let index = 0; index < sectionCount; index += 1) {
        if (previousSections[index] !== currentSections[index]) {
            return AUTO_SHADOW_INPUT_KEY_SECTIONS[index] ?? `section-${index}`;
        }
    }
    return null;
}
function hashAutoShadowInputKey(key) {
    if (key === null) {
        return null;
    }
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
function countAutoShadowGpuTimingQueries(snapshot) {
    const passCount = snapshot.shadowRequests.reduce((count, request) => isAutoShadowDirectionalRequest(request)
        ? count +
            Math.max(1, Math.min(4, Math.round(request.cascadeCount ?? 1)))
        : count, 0);
    return Math.max(1, passCount) * 2;
}
function autoShadowGpuTimingPassNames(passPlan) {
    const passNames = passPlan.passes.map((pass) => `shadow:${pass.passKey}`);
    return passNames.length === 0 ? ["shadow"] : passNames;
}
function isAutoShadowDirectionalRequest(request) {
    return request.lightKind === undefined || request.lightKind === "directional";
}
const EMPTY_SPRITE_FRAME_RESOURCES = {
    pipeline: null,
    resources: {
        valid: true,
        commands: [],
        diagnostics: [],
    },
};
const EMPTY_MSDF_TEXT_FRAME_RESOURCES = {
    pipeline: null,
    resources: {
        valid: true,
        commands: [],
        diagnostics: [],
    },
};
const EMPTY_UI_FRAME_RESOURCES = {
    valid: true,
    commands: [],
    diagnostics: [],
};
function emptySpriteFrameResources() {
    return EMPTY_SPRITE_FRAME_RESOURCES;
}
function emptyMsdfTextFrameResources() {
    return EMPTY_MSDF_TEXT_FRAME_RESOURCES;
}
function emptyUiFrameResources() {
    return EMPTY_UI_FRAME_RESOURCES;
}
function snapshotHasSpriteFrameWork(snapshot) {
    if ((snapshot.spriteDraws ?? []).length > 0) {
        return true;
    }
    return (snapshot.quadBatches ?? []).some((batch) => batch.kind === "sprite");
}
function snapshotHasMsdfTextFrameWork(snapshot) {
    return (snapshot.quadBatches ?? []).some((batch) => batch.kind === "glyph");
}
function snapshotHasUiFrameWork(snapshot) {
    return (snapshot.uiNodes ?? []).some((node) => (node.kind === "panel" ||
        node.kind === "image" ||
        (node.kind === "text" && (node.text ?? "").length > 0)) &&
        node.rect.width > 0 &&
        node.rect.height > 0);
}
function snapshotNeedsRawOffsetWorldTransforms(snapshot) {
    if ((snapshot.spriteDraws ?? []).length > 0) {
        return true;
    }
    return (snapshot.quadBatches ?? []).some((batch) => batch.kind === "sprite" || batch.kind === "glyph");
}
function measureRenderPhaseDetail(phaseTimer, detail, fn) {
    const startedAt = nowMilliseconds();
    try {
        return fn();
    }
    finally {
        phaseTimer.addDetail(detail, nowMilliseconds() - startedAt);
    }
}
async function measureRenderPhaseDetailAsync(phaseTimer, detail, fn) {
    const startedAt = nowMilliseconds();
    try {
        return await fn();
    }
    finally {
        phaseTimer.addDetail(detail, nowMilliseconds() - startedAt);
    }
}
function nowMilliseconds() {
    return globalThis.performance === undefined
        ? Date.now()
        : globalThis.performance.now();
}
function hasErrorDiagnostics(diagnostics) {
    return diagnostics.some((diagnostic) => {
        if (typeof diagnostic !== "object" || diagnostic === null) {
            return true;
        }
        const severity = diagnostic.severity;
        return severity !== "warning" && severity !== "info";
    });
}
//# sourceMappingURL=queued-built-in-frame.js.map