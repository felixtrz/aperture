import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  rememberPackedSnapshotTransformsByRenderId,
  writeMaterialQueueFromSnapshot,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import {
  mapFrameBoundaryReadbackSamples,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import type { QueuedBuiltInAppResourceSet } from "../render/queues/queued-built-in-app-resource-set.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type {
  StandardFrameIblResources,
  StandardFrameShadowReceiverResources,
} from "../materials/standard/standard-frame-resources.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import {
  createWebGpuAppDiagnosticsSummaryWithGpuTimings,
  newOcclusionQueryDiagnostics,
  readWebGpuAppGpuTimings,
  readWebGpuAppOcclusionQueries,
} from "./gpu-readback.js";
import { createWebGpuAppTransmissionGrabResources } from "./transmission-grab.js";
import {
  prepareWebGpuAppIndirectDrawCommands,
  shouldUseRenderBundlesForSnapshotSchedule,
} from "./frame-boundary-support.js";
import {
  collectInstanceTintResources,
  createQueuedBuiltInAppDiagnosticsSummary,
  queuedBuiltInResourceSetHasStandardMaterial,
  resolveStandardAreaLightLtcResources,
  snapshotUsesTransmission,
} from "./queued-built-in-support.js";
import { prepareSpriteFrameResourcesForSnapshot } from "./sprites.js";
import { prepareQueuedBuiltInFrameResources } from "./queued-frame-resources.js";
import { QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION } from "./queued-built-in-adapters.js";
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { getOrCreateWebGpuAppPipeline } from "./pipeline-resources.js";
import {
  createWebGpuAppMotionVectorReport,
  createWebGpuAppSceneMotionVectorPlan,
  prepareWebGpuAppPreviousObjectTransformResource,
  rememberCurrentViewProjectionMatrices,
} from "./motion-vectors.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { renderReport, waitForSubmittedWork } from "./report.js";
import { createWebGpuAppAutoShadowFrame } from "./auto-shadow-frame.js";
import type { WebGpuAppRenderPhaseTimer } from "./app-phase-timing.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type {
  WebGpuApp,
  WebGpuAppRenderReport,
  WebGpuAppResourceReuseReport,
} from "./app.js";

export async function renderQueuedBuiltInWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly snapshotChangeSet: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly standardMaterialShadowReceiverResources?:
    | StandardFrameShadowReceiverResources
    | undefined;
  readonly autoStandardMaterialShadowReceiverResources?: boolean;
  readonly standardMaterialIblResources?: StandardFrameIblResources | undefined;
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
  readonly phaseTimer: WebGpuAppRenderPhaseTimer;
}): Promise<WebGpuAppRenderReport> {
  const sceneMotionVectors = createWebGpuAppSceneMotionVectorPlan({
    app: options.app,
    assets: options.assets,
    snapshot: options.snapshot,
  });
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    options.cache.frameScratch.viewUniforms,
    {
      previousViewProjectionByViewId:
        options.cache.postPasses.previousViewProjectionByViewId,
    },
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    options.cache.frameScratch.worldTransforms,
  );
  const previousObjectTransforms =
    prepareWebGpuAppPreviousObjectTransformResource({
      device: options.app.initialization.device,
      cache: options.cache.postPasses,
      currentTransforms: packedTransforms,
      required: sceneMotionVectors.colorFormat !== null,
    });
  const motionVectorColorFormat =
    sceneMotionVectors.colorFormat !== null &&
    previousObjectTransforms.resource === null
      ? null
      : sceneMotionVectors.colorFormat;
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    options.snapshot,
    packedTransforms,
    options.cache.frameScratch.instanceTints,
  );
  const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
    app: options.app,
    cache: options.cache,
    required: queuedBuiltInResourceSetHasStandardMaterial(options.resourceSet),
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
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...standardAreaLightLtc.diagnostics,
        ...transmissionGrabResources.diagnostics,
      ],
    });
  }

  const autoShadowFrame =
    options.standardMaterialShadowReceiverResources === undefined &&
    options.autoStandardMaterialShadowReceiverResources !== false
      ? createWebGpuAppAutoShadowFrame({
          app: options.app,
          assets: options.assets,
          cache: options.cache,
          reuse: options.reuse,
          snapshot: options.snapshot,
          ...(options.label === undefined ? {} : { label: options.label }),
        })
      : null;
  const standardMaterialShadowReceiverResources =
    options.standardMaterialShadowReceiverResources ??
    autoShadowFrame?.receiverResources ??
    undefined;

  if (
    autoShadowFrame !== null &&
    (autoShadowFrame.report.status !== "submitted" ||
      autoShadowFrame.receiverResources === null)
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      shadow: autoShadowFrame.report,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...autoShadowFrame.report.diagnostics,
      ],
    });
  }

  const prepared = await prepareQueuedBuiltInFrameResources({
    ...options,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
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
          standardMaterialShadowReceiverResources:
            standardMaterialShadowReceiverResources,
        }),
    ...(options.standardMaterialIblResources === undefined
      ? {}
      : {
          standardMaterialIblResources: options.standardMaterialIblResources,
        }),
    getPipeline: (item) =>
      getOrCreateWebGpuAppPipeline({
        app: options.app,
        cache: options.cache,
        reuse: options.reuse,
        kind: item.adapter.kind,
        pipelineKey: item.draw.batchKey.pipelineKey,
        batchKey: item.draw.batchKey,
        motionVectorColorFormat,
      }),
    getPipelineLayouts: ({ item, pipeline, getBindGroupLayout }) =>
      getWebGpuAppPipelineLayouts({
        cache: options.cache,
        kind: item.adapter.kind,
        pipeline,
        getBindGroupLayout,
      }),
  });
  const diagnosticsSummary = createQueuedBuiltInAppDiagnosticsSummary({
    snapshot: options.snapshot,
    resourceSet: options.resourceSet,
    resources: prepared.resources,
    adapterValidation: QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
  });
  options.phaseTimer.finish("prepare");

  if (!prepared.valid || prepared.resources === null) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...prepared.diagnostics,
      ],
    });
  }

  options.phaseTimer.start("queue");
  const queue = writeMaterialQueueFromSnapshot(
    { meshDraws: options.snapshot.meshDraws, diagnostics: [] },
    {
      meshResourceKey: (input) =>
        prepared.meshResourceKeys.get(input.meshKey) ?? null,
      materialResourceKey: (input) =>
        prepared.materialResourceKeys.get(input.materialKey) ?? null,
    },
    options.cache.frameScratch.materialQueue,
  );
  options.phaseTimer.finish("queue");

  if (queue.diagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...previousObjectTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...queue.diagnostics,
      ],
    });
  }

  options.phaseTimer.start("sort");
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot: options.snapshot,
    snapshotChangeSet: options.snapshotChangeSet,
    renderWorld: options.app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      prepared.meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      prepared.materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: prepared.resources.meshResources,
    instanceTintResources: collectInstanceTintResources(prepared.resources),
    pipelineKeysByRenderId: prepared.pipelineKeysByRenderId,
    pipelines: prepared.pipelineResults,
    bindGroups: prepared.resources.bindGroups,
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
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse: options.reuse,
  });
  options.phaseTimer.finish("prepare");

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: prepared.firstPipeline,
      resources: prepared.resourcesResult,
      ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnosticsSummary: frameDiagnosticsSummary,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...spriteFrame.resources.diagnostics,
      ],
    });
  }

  const frameCommands =
    spriteFrame.resources.commands.length === 0
      ? framePlan.commandPlan.commands
      : [...framePlan.commandPlan.commands, ...spriteFrame.resources.commands];
  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app: options.app,
    cache: options.cache,
    commands: frameCommands,
    label: options.label ?? "aperture-webgpu-app",
  });
  options.phaseTimer.start("submit");
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    commands: indirectDraws.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse: options.reuse,
    motionVectorColorFormat,
    transmissionSceneColorResources: transmissionGrabResources.resources,
    enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(
      options.snapshotUpdateSchedule,
    ),
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });
  rememberCurrentViewProjectionMatrices(
    options.snapshot,
    options.cache.postPasses.previousViewProjectionByViewId,
  );
  const motionVectorHistoryUpdate =
    sceneMotionVectors.required && previousObjectTransforms.resource !== null
      ? rememberPackedSnapshotTransformsByRenderId(
          packedTransforms,
          options.cache.postPasses.previousWorldTransformsByRenderId,
        )
      : { stored: 0, staleRemoved: 0 };
  const motionVectorReport = createWebGpuAppMotionVectorReport({
    plan: sceneMotionVectors,
    objectHistory: previousObjectTransforms.history,
    resource: previousObjectTransforms.resource,
    update: motionVectorHistoryUpdate,
  });

  await waitForSubmittedWork(options.app.initialization.device);
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
  const finalDiagnosticsSummary =
    gpuTimings === undefined
      ? frameDiagnosticsSummary
      : createWebGpuAppDiagnosticsSummaryWithGpuTimings(
          frameDiagnosticsSummary,
          gpuTimings,
        );
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    spriteFrame.resources.diagnostics.length === 0 &&
    boundaries.valid &&
    (occlusionQueries === undefined ||
      occlusionQueries.status !== "unsupported");
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );
  options.phaseTimer.finish("submit");

  return renderReport({
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
    ...(autoShadowFrame === null ? {} : { shadow: autoShadowFrame.report }),
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
    phaseTimings: options.phaseTimer.report(
      options.cache.phaseTimingHistory,
      options.snapshot.frame,
    ),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    ...(indirectDraws.report.status === "skipped"
      ? {}
      : { indirectDraws: indirectDraws.report }),
    localLightCookieResources: options.localLightCookieResources,
    resourceReuse: options.reuse,
    diagnosticsSummary: finalDiagnosticsSummary,
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    commandPressure: framePlan.commandPlan.pressure,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...previousObjectTransforms.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...spriteFrame.resources.diagnostics,
      ...boundaries.diagnostics,
      ...newOcclusionQueryDiagnostics(
        occlusionQueries,
        boundaries.occlusionQueryDiagnostics,
      ),
    ],
  });
}
