import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  isCustomWgslMaterialAsset,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MeshAsset,
  type PreparedCustomWgslMaterial,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import { createCustomWgslAppFrameResources } from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import { prepareCustomWgslAppTextureSamplerBindingResources } from "./custom-wgsl-texture-sampler-resources.js";
import { mapFrameBoundaryReadbackSamples } from "../render/frame/frame-boundary.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import {
  prepareWebGpuAppIndirectDrawCommands,
  shouldUseRenderBundlesForSnapshotSchedule,
} from "./frame-boundary-support.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import {
  newOcclusionQueryDiagnostics,
  readWebGpuAppOcclusionQueries,
} from "./gpu-readback.js";
import { prepareUiFrameResourcesForSnapshot } from "./ui.js";
import {
  customWgslMaterialRenderPipelineCacheKey,
  type CreateCustomWgslMaterialRenderPipelineResourceResult,
} from "../materials/custom-wgsl/custom-wgsl-material.js";
import { renderReport, waitForSubmittedWork } from "./report.js";
import type { WebGpuAppRenderPhaseTimer } from "./app-phase-timing.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type {
  WebGpuApp,
  WebGpuAppPipelineResourceResult,
  WebGpuAppRenderReport,
  WebGpuAppResourceReuseReport,
} from "./app.js";
import type { FrameBoundaryReadbackSampleRequest } from "../render/frame/frame-boundary.js";

export async function renderCustomWgslWebGpuAppFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly snapshotChangeSet: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule: RenderSnapshotUpdateSchedule;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly clearColor?: readonly number[];
  readonly label?: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly phaseTimer: WebGpuAppRenderPhaseTimer;
}): Promise<WebGpuAppRenderReport> {
  const draw = options.snapshot.meshDraws[0];

  if (draw === undefined) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      diagnostics: [
        {
          code: "webGpuApp.customWgslMissingDraw",
          message: "Custom WGSL app route requires one mesh draw.",
        },
      ],
    });
  }

  const drawMeshKey = assetHandleKey(draw.mesh);
  const drawMaterialKey = assetHandleKey(draw.material);
  const unsupportedDraw = options.snapshot.meshDraws.find(
    (packet) =>
      assetHandleKey(packet.mesh) !== drawMeshKey ||
      assetHandleKey(packet.material) !== drawMaterialKey,
  );

  if (unsupportedDraw !== undefined) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnostics: [
        {
          code: "webGpuApp.customWgslMultiResourceRouteDeferred",
          message:
            "The custom WGSL app route currently supports one custom mesh/material resource set.",
          renderId: unsupportedDraw.renderId,
        },
      ],
    });
  }

  const meshEntry = options.assets.get<"mesh", MeshAsset>(draw.mesh);
  const materialEntry = options.assets.get<"material", SourceMaterialAsset>(
    draw.material,
  );
  const material = materialEntry?.asset;

  if (
    meshEntry?.asset === null ||
    meshEntry?.asset === undefined ||
    material === null ||
    material === undefined ||
    !isCustomWgslMaterialAsset(material)
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      diagnostics: [
        {
          code: "webGpuApp.customWgslMissingSourceAsset",
          message:
            "Custom WGSL app route requires ready mesh and custom WGSL material source assets.",
        },
      ],
    });
  }

  const preparedEntry = options.cache.preparedMaterialFacade.get(draw.material);
  const prepared = preparedEntry?.prepared as
    | PreparedCustomWgslMaterial
    | undefined;

  if (
    prepared === undefined ||
    prepared.resourceFamily !== "custom-wgsl-material"
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: options.reuse,
      diagnostics: [
        {
          code: "webGpuApp.customWgslMaterialNotPrepared",
          message:
            "Custom WGSL material source was not prepared before frame resource creation.",
        },
      ],
    });
  }

  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    options.cache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    options.cache.frameScratch.worldTransforms,
  );
  const colorFormat = options.app.initialization.format;
  const depthFormat = "depth24plus";
  const sampleCount = options.app.msaa.sampleCount;
  const pipelineCacheKey = customWgslMaterialRenderPipelineCacheKey({
    material: prepared,
    colorFormat,
    depthFormat,
    sampleCount,
  });
  const cachedPipeline = customWgslPipelineResultFromCache(
    options.cache.pipelines.get(pipelineCacheKey),
    pipelineCacheKey,
  );
  const textureSamplerBindingResources =
    prepareCustomWgslAppTextureSamplerBindingResources({
      assets: options.assets,
      device: options.app.initialization.device,
      cache: options.cache,
      reuse: options.reuse,
      source: material,
      material: prepared,
    });

  if (cachedPipeline === undefined) {
    options.reuse.pipelineMisses += 1;
  } else {
    options.reuse.pipelineHits += 1;
  }

  const resources = await createCustomWgslAppFrameResources({
    device: options.app.initialization.device as Parameters<
      typeof createCustomWgslAppFrameResources
    >[0]["device"],
    mesh: meshEntry.asset,
    material: prepared,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    colorFormat,
    depthFormat,
    sampleCount,
    ...(cachedPipeline === undefined ? {} : { pipelineResult: cachedPipeline }),
    bindingResources: textureSamplerBindingResources.resources,
    bindingResourceDiagnostics: textureSamplerBindingResources.diagnostics,
  });

  if (
    cachedPipeline === undefined &&
    resources.pipelineResult?.valid === true &&
    resources.pipelineResult.resource !== null
  ) {
    options.cache.pipelines.set(pipelineCacheKey, resources.pipelineResult);
  }

  options.phaseTimer.finish("prepare");

  if (
    !resources.valid ||
    resources.resources === null ||
    resources.pipeline === null
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: resources.pipelineResult,
      resources,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...resources.diagnostics,
      ],
    });
  }

  const frameResources = resources.resources;
  const pipelineResource = resources.pipeline;
  options.phaseTimer.start("queue");
  const pipelineResult = {
    ok: true as const,
    status: "miss" as const,
    key: pipelineResource.cacheKey,
    pipeline: pipelineResource.pipeline,
    diagnostics: [],
  };
  const pipelineKeysByRenderId = new Map(
    options.snapshot.meshDraws.map((packet) => [
      packet.renderId,
      pipelineResource.cacheKey,
    ]),
  );
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot: options.snapshot,
    snapshotChangeSet: options.snapshotChangeSet,
    renderWorld: options.app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (packet) =>
      assetHandleKey(packet.mesh) === assetHandleKey(draw.mesh)
        ? frameResources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (packet) =>
      assetHandleKey(packet.material) === assetHandleKey(draw.material)
        ? frameResources.material.resourceKey
        : null,
    meshResources: [frameResources.mesh],
    pipelineKeysByRenderId,
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  options.phaseTimer.finish("queue");
  options.phaseTimer.start("prepare");
  const uiFrame = await prepareUiFrameResourcesForSnapshot({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    reuse: options.reuse,
  });
  options.phaseTimer.finish("prepare");

  if (!uiFrame.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline: resources.pipelineResult,
      resources,
      resourceReuse: options.reuse,
      phaseTimings: options.phaseTimer.report(
        options.cache.phaseTimingHistory,
        options.snapshot.frame,
      ),
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...resources.diagnostics,
        ...uiFrame.diagnostics,
      ],
    });
  }

  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app: options.app,
    cache: options.cache,
    commands: framePlan.commandPlan.commands,
    label: options.label ?? "aperture-custom-wgsl-app",
  });
  options.phaseTimer.start("submit");
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    commands: indirectDraws.commands,
    overlayCommands: uiFrame.commands,
    label: options.label ?? "aperture-custom-wgsl-app",
    reuse: options.reuse,
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

  await waitForSubmittedWork(options.app.initialization.device);
  const occlusionQueries = await readWebGpuAppOcclusionQueries({
    readbacks: boundaries.occlusionQueryReadbacks,
    diagnostics: boundaries.occlusionQueryDiagnostics,
    queryCount: boundaries.occlusionQueryCount,
    frame: options.snapshot.frame,
    feedbackState: options.cache.occlusionFeedback,
    culling: boundaries.occlusionCulling,
  });
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    uiFrame.diagnostics.length === 0 &&
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
    pipeline: resources.pipelineResult,
    resources,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    commandPressure: framePlan.commandPlan.pressure,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    resourceReuse: options.reuse,
    phaseTimings: options.phaseTimer.report(
      options.cache.phaseTimingHistory,
      options.snapshot.frame,
    ),
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...packedViews.diagnostics,
      ...packedTransforms.diagnostics,
      ...resources.diagnostics,
      ...uiFrame.diagnostics,
      ...boundaries.diagnostics,
      ...newOcclusionQueryDiagnostics(
        occlusionQueries,
        boundaries.occlusionQueryDiagnostics,
      ),
    ],
  });
}

function customWgslPipelineResultFromCache(
  value: WebGpuAppPipelineResourceResult | undefined,
  cacheKey: string,
): CreateCustomWgslMaterialRenderPipelineResourceResult | undefined {
  return value?.resource?.cacheKey === cacheKey
    ? (value as CreateCustomWgslMaterialRenderPipelineResourceResult)
    : undefined;
}
