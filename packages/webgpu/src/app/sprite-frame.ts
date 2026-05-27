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
import {
  createWebGpuAppResourceReuseReport,
  renderReport,
  waitForSubmittedWork,
} from "./report.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
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

  if (spriteDraws.length > 0) {
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

  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot: options.snapshot,
    commands: spriteResources.commands,
    label: options.label ?? "aperture-webgpu-sprite-app",
    reuse,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  await waitForSubmittedWork(app.initialization.device);

  const frameOk =
    packedViews.diagnostics.length === 0 &&
    packedTransforms.diagnostics.length === 0 &&
    spriteResources.diagnostics.length === 0 &&
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
    resourceReuse: reuse,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    diagnostics: [
      ...options.snapshot.diagnostics,
      ...packedViews.diagnostics,
      ...packedTransforms.diagnostics,
      ...spriteResources.diagnostics,
      ...boundaries.diagnostics,
    ],
  });
}
