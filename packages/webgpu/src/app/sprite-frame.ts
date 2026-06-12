import type { AssetRegistry } from "@aperture-engine/simulation";
import {
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { mapFrameBoundaryReadbackSamples } from "../render/frame/frame-boundary.js";
import type { CreateSpriteRenderPipelineResourceResult } from "../render/sprites/sprite-pipeline.js";
import {
  createSpriteFrameResources,
  getOrCreateWebGpuAppSpritePipeline,
  type SpriteFrameResources,
} from "./sprites.js";
import { prepareMsdfTextFrameResourcesForSnapshot } from "./text.js";
import { prepareParticleFrameResourcesForSnapshot } from "./particles.js";
import { prepareUiFrameResourcesForSnapshot } from "./ui.js";
import {
  createWebGpuAppResourceReuseReport,
  renderReport,
  frameBoundariesNeedGpuDrain,
  waitForSubmittedWork,
} from "./report.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { releaseWebGpuAppGpuTimingReadbacks } from "./gpu-readback.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type {
  WebGpuApp,
  WebGpuAppRenderOptions,
  WebGpuAppRenderReport,
} from "./app.js";

export async function renderSpriteOnlyWebGpuAppFrame(
  context: {
    readonly app: WebGpuApp;
    readonly sourceAssets: AssetRegistry;
  },
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppRenderOptions & { readonly snapshot: RenderSnapshot },
): Promise<WebGpuAppRenderReport> {
  const { app, sourceAssets } = context;
  const reuse = createWebGpuAppResourceReuseReport();
  const spriteDraws = options.snapshot.spriteDraws ?? [];
  const hasQuadSpriteBatches = (options.snapshot.quadBatches ?? []).some(
    (batch) => batch.kind === "sprite",
  );
  const hasGlyphBatches = (options.snapshot.quadBatches ?? []).some(
    (batch) => batch.kind === "glyph",
  );
  const hasUiNodes = (options.snapshot.uiNodes ?? []).length > 0;
  const hasParticleEmitters =
    (options.snapshot.particleEmitters ?? []).length > 0;
  const packedViews = writePackedSnapshotViewUniforms(
    options.snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    options.snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  let pipeline: CreateSpriteRenderPipelineResourceResult | null = null;
  let spriteResources: SpriteFrameResources = {
    valid: true,
    commands: [],
    diagnostics: [],
  };

  if (spriteDraws.length > 0 || hasQuadSpriteBatches) {
    pipeline = await getOrCreateWebGpuAppSpritePipeline(app, resourceCache);

    if (!pipeline.valid || pipeline.resource === null) {
      return renderReport({
        ok: false,
        snapshot: options.snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          ...options.snapshot.diagnostics,
          ...packedViews.diagnostics,
          ...packedTransforms.diagnostics,
          ...pipeline.diagnostics,
        ],
      });
    }

    spriteResources = createSpriteFrameResources({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      snapshot: options.snapshot,
      spriteDraws,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      pipeline: pipeline.resource,
      reuse,
    });
  }

  if (!spriteResources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...spriteResources.diagnostics,
      ],
    });
  }

  const textFrame = await prepareMsdfTextFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse,
  });

  if (!textFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...spriteResources.diagnostics,
        ...textFrame.resources.diagnostics,
      ],
    });
  }

  const particleFrame = await prepareParticleFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    time: options.snapshot.frame / 60,
  });

  if (!particleFrame.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...spriteResources.diagnostics,
        ...textFrame.resources.diagnostics,
        ...particleFrame.diagnostics,
      ],
    });
  }

  const uiFrame = await prepareUiFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    viewUniforms: packedViews,
    reuse,
  });

  if (!uiFrame.valid) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...spriteResources.diagnostics,
        ...textFrame.resources.diagnostics,
        ...uiFrame.diagnostics,
      ],
    });
  }

  if (
    !hasQuadSpriteBatches &&
    spriteDraws.length === 0 &&
    !hasGlyphBatches &&
    !hasUiNodes &&
    !hasParticleEmitters
  ) {
    return renderReport({
      ok: false,
      snapshot: options.snapshot,
      resourceReuse: reuse,
      diagnostics: [
        ...options.snapshot.diagnostics,
        {
          code: "webGpuApp.emptySpriteTextSnapshot",
          message:
            "WebGPU sprite/text render requires at least one sprite or glyph batch.",
        },
      ],
    });
  }

  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    commands: [
      ...spriteResources.commands,
      ...textFrame.resources.commands,
      ...particleFrame.commands,
    ],
    overlayCommands: uiFrame.commands,
    label: options.label ?? "aperture-webgpu-sprite-app",
    reuse,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  if (frameBoundariesNeedGpuDrain(boundaries)) {
    await waitForSubmittedWork(app.initialization.device);
  }
  // The sprite route never maps its GPU-timing readbacks, so return the leased
  // readback buffers to the rotation ring for later frames.
  releaseWebGpuAppGpuTimingReadbacks(boundaries.gpuTimingReadbacks);

  const frameOk =
    packedViews.diagnostics.length === 0 &&
    packedTransforms.diagnostics.length === 0 &&
    spriteResources.diagnostics.length === 0 &&
    textFrame.resources.diagnostics.length === 0 &&
    particleFrame.diagnostics.length === 0 &&
    uiFrame.diagnostics.length === 0 &&
    boundaries.valid;
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );

  return renderReport({
    ok: frameOk,
    snapshot: options.snapshot,
    pipeline,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.msaa === undefined ? {} : { msaa: boundaries.msaa }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    particles: particleFrame.report,
    resourceReuse: reuse,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...packedViews.diagnostics,
      ...packedTransforms.diagnostics,
      ...spriteResources.diagnostics,
      ...textFrame.resources.diagnostics,
      ...particleFrame.diagnostics,
      ...uiFrame.diagnostics,
      ...boundaries.diagnostics,
    ],
  });
}
