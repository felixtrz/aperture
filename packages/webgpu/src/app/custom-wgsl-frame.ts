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
import {
  createCustomWgslAppFrameResources,
  type CustomWgslAppSkinningFrameInput,
} from "../materials/custom-wgsl/custom-wgsl-app-frame-resources.js";
import {
  createSkinningJointGpuBuffer,
  DEFAULT_SKINNING_JOINT_BUFFER_USAGE,
  SKINNING_JOINT_MATRIX_FLOATS,
} from "../resources/attributes/skinning-joint-buffer.js";
import {
  getOrCreateCustomWgslLitPipelineLayout,
  prepareCustomWgslLitFrameResources,
  type CustomWgslLitDiagnostic,
} from "./custom-wgsl-lit-resources.js";
import {
  prepareCustomWgslAppStorageBufferBindingResources,
  prepareCustomWgslWritableBufferStream,
} from "./custom-wgsl-storage-buffer-resources.js";
import { prepareCustomWgslAppTextureSamplerBindingResources } from "./custom-wgsl-texture-sampler-resources.js";
import { resolveWebGpuAppSwapchainSceneDepth } from "./attachments.js";
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
  releaseWebGpuAppGpuTimingReadbacks,
} from "./gpu-readback.js";
import {
  prepareWebGpuFeatureFrameResources,
  webGpuFeatureReports,
  webGpuParticleFrameReport,
} from "./built-in-feature-realizers.js";
import { mergeSnapshotSortedRenderPassCommands } from "./feature-command-groups.js";
import {
  customWgslMaterialRenderPipelineCacheKey,
  type CreateCustomWgslMaterialRenderPipelineResourceResult,
} from "../materials/custom-wgsl/custom-wgsl-material.js";
import { resolveWebGpuAppCustomMaterialColorTargets } from "./user-pass-targets.js";
import {
  renderReport,
  frameBoundariesNeedGpuDrain,
  waitForSubmittedWork,
} from "./report.js";
import { webGpuAppScenePassColorFormat } from "./render-color-format.js";
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
  readonly gpuTimings?: boolean;
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
  const colorFormat = webGpuAppScenePassColorFormat(options.app);
  // D1: the per-frame scene depth format (stencil-capable when the frame uses
  // stencil); depth24plus otherwise so non-stencil frames stay byte-identical.
  const depthFormat = options.cache.sceneDepthFormat;
  const sampleCount = options.app.msaa.sampleCount;
  const pipelineCacheKey = customWgslMaterialRenderPipelineCacheKey({
    material: prepared,
    colorFormat,
    depthFormat,
    sampleCount,
  });
  // B3: realize the facade render targets an MRT material pairs with
  // @location(1..N-1) BEFORE any pipeline work — a declaration that cannot be
  // attached fails the frame with structured diagnostics, never a device
  // error from mismatched pipeline/pass attachment counts.
  const customColorTargets = resolveWebGpuAppCustomMaterialColorTargets({
    assets: options.assets,
    device: options.app.initialization.device,
    state: options.cache.renderTargets,
    material: prepared,
    pipelineCacheKey,
    passColorFormat: colorFormat,
    appFormat: options.app.initialization.format,
    sampleCount,
  });

  if (!customColorTargets.valid) {
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
        ...customColorTargets.diagnostics,
      ],
    });
  }
  const cachedPipeline = customWgslPipelineResultFromCache(
    options.cache.pipelines.get(pipelineCacheKey),
    pipelineCacheKey,
  );
  // B4: a material that samples scene depth binds the frame's stored swapchain
  // depth (read-only). Resolve it here (prepare phase) so the bind group
  // references the exact depth texture the frame-boundary loop attaches.
  const sceneDepth = prepared.samplesSceneDepth
    ? resolveWebGpuAppSwapchainSceneDepth(
        options.app,
        options.cache,
        options.assets,
        options.snapshot,
      )
    : null;
  const textureSamplerBindingResources =
    prepareCustomWgslAppTextureSamplerBindingResources({
      assets: options.assets,
      device: options.app.initialization.device,
      cache: options.cache,
      reuse: options.reuse,
      source: material,
      material: prepared,
      sceneDepth,
    });
  const storageBufferBindingResources =
    prepareCustomWgslAppStorageBufferBindingResources({
      assets: options.assets,
      device: options.app.initialization.device,
      cache: options.cache.customWgslStorageBuffers,
      reuse: options.reuse,
      source: material,
      material: prepared,
      runtimeBuffers: options.snapshot.runtimeBuffers ?? [],
    });
  // C1: writable-buffer reads + buffer-backed instance stream (shares the same
  // customWgslStorageBuffers cache as the storage binding above → zero copy).
  const writableBufferStream = prepareCustomWgslWritableBufferStream({
    assets: options.assets,
    device: options.app.initialization.device,
    cache: options.cache.customWgslStorageBuffers,
    reuse: options.reuse,
    material,
    prepared,
    renderId: draw.renderId,
  });

  if (cachedPipeline === undefined) {
    options.reuse.pipelineMisses += 1;
  } else {
    options.reuse.pipelineHits += 1;
  }

  // A1: lit materials bind the renderer-owned group(3) lit contract. The
  // single-custom route has no standard shadow/IBL preparation, so the lit
  // bind group carries the packed snapshot lights plus fallback shadow/IBL
  // resources (apertureDirectionalShadow returns 1.0, IBL samples black).
  let litFrameInput:
    | Parameters<typeof createCustomWgslAppFrameResources>[0]["lit"]
    | undefined;

  if (prepared.lighting === "lit") {
    const litDevice = options.app.initialization.device as Parameters<
      typeof prepareCustomWgslLitFrameResources
    >[0]["device"];
    const litFrame = prepareCustomWgslLitFrameResources({
      device: litDevice,
      snapshot: options.snapshot,
      viewUniforms: packedViews,
      cache: options.cache.customWgslLit,
      reuse: options.reuse,
    });
    const litDiagnostics: CustomWgslLitDiagnostic[] = [...litFrame.diagnostics];
    const litPipelineLayout =
      litFrame.valid && litFrame.bindGroup !== null
        ? getOrCreateCustomWgslLitPipelineLayout({
            device: litDevice,
            cache: options.cache.customWgslLit,
            material: prepared,
            diagnostics: litDiagnostics,
          })
        : null;

    if (litFrame.bindGroup === null || litPipelineLayout === null) {
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
          ...litDiagnostics,
        ],
      });
    }

    litFrameInput = {
      pipelineLayout: litPipelineLayout,
      bindGroup: litFrame.bindGroup,
    };
  }

  // F3: a skinned custom material binds the mesh's joint palette at group(4).
  // The palette is the SAME snapshot bones the standard skinned path consumes
  // (draw.boneMatrixOffset/Count into snapshot.bones). Extraction leaves
  // `batchKey.skinned` FALSE for custom materials (that flag drives the STANDARD
  // skinned pipeline), so the buffer is built directly from the bones here — a
  // custom draw is "skinned" when it carries a bone-matrix range. The
  // single-custom route binds the FIRST draw's palette (one skinned resource
  // set); a skinned material on a mesh WITHOUT skin data is a structured
  // diagnostic, never a device error from a missing group(4) binding.
  let skinFrameInput: CustomWgslAppSkinningFrameInput | undefined;

  if (prepared.skinned) {
    const boneMatrixOffset = draw.boneMatrixOffset;
    const boneMatrixCount = draw.boneMatrixCount;
    const bones = options.snapshot.bones ?? new Float32Array(0);
    const paletteEnd =
      boneMatrixOffset === undefined || boneMatrixCount === undefined
        ? 0
        : boneMatrixOffset + boneMatrixCount * SKINNING_JOINT_MATRIX_FLOATS;

    if (
      boneMatrixOffset === undefined ||
      boneMatrixCount === undefined ||
      boneMatrixCount <= 0 ||
      boneMatrixOffset < 0 ||
      boneMatrixOffset % SKINNING_JOINT_MATRIX_FLOATS !== 0 ||
      paletteEnd > bones.length
    ) {
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
          {
            code: "customWgslMaterial.skinnedWithoutSkinData",
            message: `Custom material '${drawMaterialKey}' declares skinned: true but render id ${draw.renderId} draws a mesh with no valid skin data (no JOINTS_0/WEIGHTS_0 attributes + Skin component, or an out-of-range bone matrix range). Add a Skin component and JOINTS_0/WEIGHTS_0 vertex attributes, or remove skinned: true.`,
            renderId: draw.renderId,
          },
        ],
      });
    }

    const paletteData = bones.slice(boneMatrixOffset, paletteEnd);
    const skinBuffer = createSkinningJointGpuBuffer({
      device: options.app.initialization.device as Parameters<
        typeof createSkinningJointGpuBuffer
      >[0]["device"],
      plan: {
        descriptor: {
          label: `custom-wgsl-skin/render:${draw.renderId}`,
          size: paletteData.byteLength,
          usage: DEFAULT_SKINNING_JOINT_BUFFER_USAGE,
          initialData: paletteData,
        },
        source: paletteData,
        renderId: draw.renderId,
        sourceOffset: boneMatrixOffset,
        jointCount: boneMatrixCount,
      },
    });

    if (!skinBuffer.valid || skinBuffer.resource === null) {
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
          ...skinBuffer.diagnostics,
        ],
      });
    }

    // Use a custom-route resource key (NOT the standard
    // skinningJointBufferResourceKeyForRenderId) so the draw-list binder's
    // world-transform selector does not mistake the group(1) bind group for a
    // STANDARD draw-scoped skinned bind group (which is gated on the literal
    // `skinned` pipeline-key token; the custom key uses `skinned:v1`).
    skinFrameInput = {
      buffer: skinBuffer.resource.buffer,
      resourceKey: `custom-wgsl-skin:render:${draw.renderId}`,
    };
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
    bindingResources: [
      ...textureSamplerBindingResources.resources,
      ...storageBufferBindingResources.resources,
    ],
    bindingResourceDiagnostics: [
      ...textureSamplerBindingResources.diagnostics,
      ...storageBufferBindingResources.diagnostics,
    ],
    runtimeUniforms: options.snapshot.runtimeUniforms ?? [],
    runtimeUniformCache: options.cache.customWgslRuntimeUniforms,
    reuse: options.reuse,
    ...(litFrameInput === undefined ? {} : { lit: litFrameInput }),
    ...(skinFrameInput === undefined ? {} : { skin: skinFrameInput }),
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
    ...(writableBufferStream.instanceAttributeResource === null
      ? {}
      : {
          instanceAttributeResources: [
            writableBufferStream.instanceAttributeResource,
          ],
        }),
    pipelineKeysByRenderId,
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: options.cache.frameScratch.framePlan,
  });
  options.phaseTimer.finish("queue");
  options.phaseTimer.start("prepare");
  const featureFrame = await prepareWebGpuFeatureFrameResources({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    reuse: options.reuse,
  });
  const particleReport = webGpuParticleFrameReport(featureFrame);
  const featureReports = webGpuFeatureReports(featureFrame);
  options.phaseTimer.finish("prepare");

  if (!featureFrame.valid) {
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
        ...featureFrame.diagnostics,
      ],
    });
  }

  const merged = mergeSnapshotSortedRenderPassCommands({
    snapshot: options.snapshot,
    baseCommands: framePlan.commandPlan.commands,
    overlayCommands: [],
    featureGroups: featureFrame.sceneGroups,
  });
  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app: options.app,
    cache: options.cache,
    commands: merged.commands,
    label: options.label ?? "aperture-custom-wgsl-app",
  });
  const renderBundleCommands =
    featureFrame.sceneGroups.length === 0
      ? indirectDraws.commands.slice(0, framePlan.commandPlan.commands.length)
      : [];
  options.phaseTimer.start("submit");
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app: options.app,
    assets: options.assets,
    cache: options.cache,
    snapshot: options.snapshot,
    commands: indirectDraws.commands,
    renderBundleCommands,
    overlayCommands: featureFrame.overlayCommands,
    label: options.label ?? "aperture-custom-wgsl-app",
    reuse: options.reuse,
    customColorTargets: customColorTargets.plan,
    // C1: writable-buffer ids consumed this frame → the scene node reads them so
    // a compute pass writing the same id is ordered before the draw.
    ...(writableBufferStream.writableBufferIds.length === 0
      ? {}
      : { bufferReads: writableBufferStream.writableBufferIds }),
    enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(
      options.snapshotUpdateSchedule,
    ),
    ...(options.gpuTimings === undefined
      ? {}
      : { gpuTimings: options.gpuTimings }),
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
  // The custom-WGSL route never maps its GPU-timing readbacks, so return the
  // leased readback buffers to the rotation ring for later frames.
  releaseWebGpuAppGpuTimingReadbacks(boundaries.gpuTimingReadbacks);
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
    featureFrame.valid &&
    featureFrame.diagnostics.length === 0 &&
    merged.diagnostics.length === 0 &&
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
    ...(boundaries.renderTargetCaptures.length === 0
      ? {}
      : { renderTargetCaptures: boundaries.renderTargetCaptures }),
    postEffects: boundaries.postEffects,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    particles: particleReport,
    ...(featureReports === undefined ? {} : { features: featureReports }),
    resourceReuse: options.reuse,
    phaseTimings: options.phaseTimer.report(
      options.cache.phaseTimingHistory,
      options.snapshot.frame,
    ),
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    sceneDepthOverlays: boundaries.sceneDepthOverlays,
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
      ...writableBufferStream.diagnostics,
      ...featureFrame.diagnostics,
      ...merged.diagnostics,
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
