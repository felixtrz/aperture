import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import { createWebGpuAppDepthAttachmentForTarget } from "./attachments.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import {
  collectInstanceTintResources,
  queuedBuiltInResourceSetHasStandardMaterial,
  resolveStandardAreaLightLtcResources,
} from "./queued-built-in-support.js";
import {
  createWebGpuAppPickSharedBindGroups,
  getOrCreateWebGpuIdBufferPickPipelines,
  popWebGpuPickErrorScope,
  pushWebGpuPickErrorScope,
  webGpuAppPickPixel,
} from "./picking.js";
import {
  createWebGpuAppPickReport,
  createWebGpuAppResourceReuseReport,
  waitForSubmittedWork,
} from "./report.js";
import type {
  WebGpuAppResourceCache,
  WebGpuAppPipelinePlanResult,
} from "./resource-cache.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import {
  prepareQueuedBuiltInFrameResources,
  type PrepareQueuedBuiltInFrameResourcesOptions,
} from "./queued-frame-resources.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import {
  collectQueuedBuiltInAppResourceSet,
  type QueuedBuiltInAppResourceItem,
} from "../render/queues/queued-built-in-app-resource-set.js";
import type { QueuedBuiltInFrameResources } from "../render/queues/queued-built-in-frame-resource-set.js";
import { assembleFrameBoundary } from "../render/frame/frame-boundary.js";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
import {
  createWebGpuIdBufferEntries,
  findWebGpuIdBufferEntry,
  WEBGPU_ID_BUFFER_EMPTY_ID,
} from "../picking/id-buffer.js";
import {
  createWebGpuIdBufferPickBindGroup,
  createWebGpuIdBufferPickCommands,
  createWebGpuIdBufferPickIdStorage,
  createWebGpuIdBufferPickTexture,
  readWebGpuIdBufferPickPixel,
} from "../picking/id-buffer-pick.js";
import type {
  WebGpuApp,
  WebGpuAppPickReport,
  WebGpuAppPipelineResourceResult,
  WebGpuAppRenderReport,
  WebGpuAppResourceReuseReport,
} from "./app.js";

interface WebGpuAppPickContext {
  readonly app: WebGpuApp;
  readonly sourceAssets: AssetRegistry;
}

export interface WebGpuAppPickFrameOptions {
  readonly adapters: Parameters<
    typeof collectQueuedBuiltInAppResourceSet
  >[0]["adapters"];
  getPipeline(input: {
    readonly item: QueuedBuiltInAppResourceItem;
    readonly reuse: WebGpuAppResourceReuseReport;
  }):
    | Promise<WebGpuAppPipelineResourceResult>
    | WebGpuAppPipelineResourceResult;
  getPipelineLayouts(
    input: Parameters<
      PrepareQueuedBuiltInFrameResourcesOptions["getPipelineLayouts"]
    >[0],
  ): WebGpuAppPipelineLayouts;
}

export async function pickWebGpuAppEntity(
  context: WebGpuAppPickContext,
  resourceCache: WebGpuAppResourceCache,
  latestReport: WebGpuAppRenderReport | null,
  x: number,
  y: number,
  options: WebGpuAppPickFrameOptions,
): Promise<WebGpuAppPickReport> {
  const dimensions = webGpuAppCanvasDimensions(context.app.canvas);
  const pixel = webGpuAppPickPixel(dimensions, x, y);

  if (pixel === null) {
    return createWebGpuAppPickReport({
      x,
      y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickInvalidCoordinates",
          message: `Pick coordinates ${String(x)},${String(y)} are outside the ${dimensions.width}x${dimensions.height} canvas.`,
        },
      ],
    });
  }

  if (latestReport === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickMissingFrame",
          message: "WebGPU app picking requires a previously rendered frame.",
        },
      ],
    });
  }

  if (!latestReport.ok) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickLastFrameNotReady",
          message:
            "WebGPU app picking requires the latest rendered frame to be ready.",
        },
        ...latestReport.diagnostics,
      ],
    });
  }

  const snapshot = latestReport.snapshot;
  const prepared = await prepareWebGpuAppPickFrameResources(
    context,
    resourceCache,
    snapshot,
    options,
  );

  if (
    !prepared.valid ||
    prepared.framePlan === null ||
    prepared.resources === null
  ) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: prepared.diagnostics,
    });
  }

  const pipelines = await getOrCreateWebGpuIdBufferPickPipelines({
    app: context.app,
    cache: resourceCache,
    snapshot,
    pipelineResults: prepared.pipelineResults,
  });

  if (!pipelines.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: pipelines.diagnostics,
    });
  }

  const idStorage = createWebGpuIdBufferPickIdStorage({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickIdStorage
    >[0]["device"],
    snapshot,
  });

  if (!idStorage.valid || idStorage.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: idStorage.diagnostics,
    });
  }

  const firstPickPipeline = pipelines.pipelines.values().next().value;

  if (firstPickPipeline === undefined) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: [
        {
          code: "webGpuApp.pickMissingPipeline",
          message: "WebGPU app picking could not create an ID-buffer pipeline.",
        },
      ],
    });
  }

  const idBindGroup = createWebGpuIdBufferPickBindGroup({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickBindGroup
    >[0]["device"],
    pipeline: firstPickPipeline,
    ids: idStorage.resource,
  });

  if (!idBindGroup.valid || idBindGroup.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: idBindGroup.diagnostics,
    });
  }

  const sharedBindGroups = createWebGpuAppPickSharedBindGroups({
    device: context.app.initialization.device,
    pipeline: firstPickPipeline,
    viewUniformBuffer: prepared.resources.viewUniform.buffer,
    worldTransformBuffer: prepared.resources.worldTransforms.buffer,
  });

  if (!sharedBindGroups.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: sharedBindGroups.diagnostics,
    });
  }

  const pickCommands = createWebGpuIdBufferPickCommands({
    commands: prepared.framePlan.commandPlan.commands,
    pipelineByKey: pipelines.pipelines,
    viewBindGroup: sharedBindGroups.viewBindGroup,
    worldTransformBindGroup: sharedBindGroups.worldTransformBindGroup,
    idBindGroup: idBindGroup.resource,
  });

  if (!pickCommands.valid) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: pickCommands.diagnostics,
    });
  }

  const texture = createWebGpuIdBufferPickTexture({
    device: context.app.initialization.device as Parameters<
      typeof createWebGpuIdBufferPickTexture
    >[0]["device"],
    width: dimensions.width,
    height: dimensions.height,
  });

  if (!texture.valid || texture.resource === null) {
    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id: null,
      entity: null,
      diagnostics: texture.diagnostics,
    });
  }

  try {
    pushWebGpuPickErrorScope(context.app.initialization.device);
    const target = {
      source: "swapchain" as const,
      view: snapshot.views[0] as RenderSnapshot["views"][number],
      renderTargetKey: null,
      width: dimensions.width,
      height: dimensions.height,
      format: context.app.initialization.format,
    };
    const depthAttachment = createWebGpuAppDepthAttachmentForTarget(
      context.app,
      resourceCache,
      target,
    );
    const boundary = assembleFrameBoundary({
      context: context.app.initialization.context as Parameters<
        typeof assembleFrameBoundary
      >[0]["context"],
      device: context.app.initialization.device as Parameters<
        typeof assembleFrameBoundary
      >[0]["device"],
      queue: (context.app.initialization.device as { readonly queue: unknown })
        .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
      commands: pickCommands.commands,
      label: "aperture-webgpu-app:pick-id-buffer",
      colorTarget: {
        source: "offscreen-target",
        texture: texture.resource.texture as CurrentTextureLike,
      },
      clearColor: [WEBGPU_ID_BUFFER_EMPTY_ID, 0, 0, 0],
      depthTarget: {
        view: depthAttachment.view,
        depthClearValue: snapshot.views[0]?.clearDepth ?? 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    await waitForSubmittedWork(context.app.initialization.device);
    const validationMessage = await popWebGpuPickErrorScope(
      context.app.initialization.device,
    );

    if (!boundary.valid || validationMessage !== null) {
      return createWebGpuAppPickReport({
        x: pixel.x,
        y: pixel.y,
        dimensions,
        id: null,
        entity: null,
        diagnostics: [
          ...(validationMessage === null
            ? []
            : [
                {
                  code: "webGpuApp.pickGpuValidationError",
                  message: validationMessage,
                },
              ]),
          ...boundary.texture.diagnostics,
          ...(boundary.attachments?.diagnostics ?? []),
          ...(boundary.encoder?.diagnostics ?? []),
          ...(boundary.begin?.diagnostics ?? []),
          ...(boundary.execution?.diagnostics ?? []),
          ...(boundary.end?.diagnostics ?? []),
          ...(boundary.finish?.diagnostics ?? []),
          ...(boundary.submit?.diagnostics ?? []),
        ],
      });
    }

    const readback = await readWebGpuIdBufferPickPixel({
      device: context.app.initialization.device as Parameters<
        typeof readWebGpuIdBufferPickPixel
      >[0]["device"],
      texture: texture.resource.texture,
      width: dimensions.width,
      height: dimensions.height,
      x: pixel.x,
      y: pixel.y,
    });

    if (!readback.ok) {
      return createWebGpuAppPickReport({
        x: pixel.x,
        y: pixel.y,
        dimensions,
        id: null,
        entity: null,
        readback,
        diagnostics: [
          {
            code: readback.reason,
            message: readback.message,
          },
        ],
      });
    }

    const id = readback.id;
    const entry =
      id === WEBGPU_ID_BUFFER_EMPTY_ID
        ? null
        : findWebGpuIdBufferEntry(
            createWebGpuIdBufferEntries(snapshot.meshDraws),
            id,
          );

    return createWebGpuAppPickReport({
      x: pixel.x,
      y: pixel.y,
      dimensions,
      id,
      entity: entry?.entity ?? null,
      readback,
      diagnostics: [],
    });
  } finally {
    texture.resource.destroy?.();
  }
}

async function prepareWebGpuAppPickFrameResources(
  context: WebGpuAppPickContext,
  resourceCache: WebGpuAppResourceCache,
  snapshot: RenderSnapshot,
  options: WebGpuAppPickFrameOptions,
): Promise<{
  readonly valid: boolean;
  readonly framePlan: ReturnType<
    typeof writeRenderFramePlanFromSnapshot
  > | null;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly pipelineResults: readonly WebGpuAppPipelinePlanResult[];
  readonly diagnostics: readonly unknown[];
}> {
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: [
        {
          code: "webGpuApp.pickEmptySnapshot",
          message:
            "WebGPU app picking requires at least one view and one mesh draw.",
        },
      ],
    };
  }

  prepareWebGpuAppSourceAssetFacades({
    registry: context.sourceAssets,
    snapshot,
    cache: resourceCache,
  });

  const queuedBuiltIn = collectQueuedBuiltInAppResourceSet({
    assets: context.sourceAssets,
    snapshot,
    materialQueueScratch: resourceCache.frameScratch.materialQueue,
    routeScratch: resourceCache.frameScratch.queueRoute,
    meshes: resourceCache.preparedMeshFacade,
    materials: resourceCache.preparedMaterialFacade,
    adapters: options.adapters,
  });

  if (!queuedBuiltIn.valid || queuedBuiltIn.resourceSet === null) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: queuedBuiltIn.diagnostics,
    };
  }

  const packedViews = writePackedSnapshotViewUniforms(
    snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    snapshot,
    packedTransforms,
    resourceCache.frameScratch.instanceTints,
  );
  const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
    app: context.app,
    cache: resourceCache,
    required: queuedBuiltInResourceSetHasStandardMaterial(
      queuedBuiltIn.resourceSet,
    ),
  });

  if (!standardAreaLightLtc.valid) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: [],
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...standardAreaLightLtc.diagnostics,
      ],
    };
  }

  const pickResourceReuse = createWebGpuAppResourceReuseReport();
  const prepared = await prepareQueuedBuiltInFrameResources({
    app: context.app,
    assets: context.sourceAssets,
    cache: resourceCache,
    snapshot,
    resourceSet: queuedBuiltIn.resourceSet,
    reuse: pickResourceReuse,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    instanceTints: packedInstanceTints,
    standardAreaLightLtcResources: standardAreaLightLtc.resources,
    getPipeline: (item) =>
      options.getPipeline({
        item,
        reuse: pickResourceReuse,
      }),
    getPipelineLayouts: options.getPipelineLayouts,
  });

  if (!prepared.valid || prepared.resources === null) {
    return {
      valid: false,
      framePlan: null,
      resources: null,
      pipelineResults: prepared.pipelineResults,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...prepared.diagnostics,
      ],
    };
  }

  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot,
    renderWorld: context.app.renderWorld,
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
    scratch: resourceCache.frameScratch.framePlan,
  });
  const diagnostics = [
    ...packedViews.diagnostics,
    ...packedTransforms.diagnostics,
    ...packedInstanceTints.diagnostics,
    ...framePlan.bindingPlan.diagnostics,
    ...framePlan.readiness.diagnostics,
    ...framePlan.packages.diagnostics,
    ...framePlan.drawCommands.diagnostics,
    ...framePlan.drawList.diagnostics,
    ...framePlan.resources.diagnostics,
    ...framePlan.commandPlan.diagnostics,
  ];

  return {
    valid:
      diagnostics.length === 0 &&
      framePlan.drawList.valid &&
      framePlan.resources.valid &&
      framePlan.commandPlan.valid,
    framePlan,
    resources: prepared.resources,
    pipelineResults: prepared.pipelineResults,
    diagnostics,
  };
}
