// E4 (outline, AC2): renders the app's outline selection into a per-frame
// r32uint mask by REUSING the ID-buffer picking pipeline (the picking ID buffer
// the engine already ships). Instead of unique per-entity ids, the id storage
// holds WEBGPU_OUTLINE_MASK_SELECTED_ID (1) for SELECTED entities and 0 for
// everything else, so the rendered mask stores 1 exactly where a selected entity
// is the frontmost, depth-tested fragment (occlusion by unselected geometry is
// handled by the mask pass's own depth buffer). The outline post effect then
// edge-detects this mask. The whole path is inert unless an outline effect is
// active AND the selection is non-empty, so it never perturbs other frames.

import type { RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import {
  createWebGpuIdBufferIdForEntity,
  WEBGPU_ID_BUFFER_FORMAT,
} from "../picking/id-buffer.js";
import {
  createWebGpuIdBufferPickBindGroup,
  createWebGpuIdBufferPickCommands,
  type WebGpuIdBufferPickIdStorageResource,
  type WebGpuIdBufferPickPipelineResource,
} from "../picking/id-buffer-pick.js";
import {
  createWebGpuAppPickSharedBindGroups,
  getOrCreateWebGpuIdBufferPickPipelines,
} from "./picking.js";
import { WEBGPU_OUTLINE_MASK_SELECTED_ID } from "../post/post-outline.js";
import {
  createOrReuseWebGpuPostPassTexture,
  type WebGpuPostPassTextureResource,
} from "../post/post-pass.js";
import {
  createOrReuseWebGpuDepthTexture,
  WEBGPU_APP_DEPTH_FORMAT,
} from "../resources/textures/depth-texture-resource.js";
import { assembleFrameBoundary } from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
import type { WebGpuApp } from "./app.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

/** Per-frame outline selection mask result (present when a selection rendered). */
export interface WebGpuAppOutlineSelectionMaskResult {
  readonly mask: WebGpuPostPassTextureResource | null;
  readonly selectedCount: number;
  readonly drawCalls: number;
  readonly ok: boolean;
  readonly diagnostics: readonly unknown[];
}

/** Render ids of the mesh draws whose entity is in the outline selection. */
export function outlineSelectedRenderIds(
  snapshot: Pick<RenderSnapshot, "meshDraws">,
  selection: ReadonlySet<number>,
): Set<number> {
  const renderIds = new Set<number>();
  for (const draw of snapshot.meshDraws) {
    if (selection.has(createWebGpuIdBufferIdForEntity(draw.entity))) {
      renderIds.add(draw.renderId);
    }
  }
  return renderIds;
}

/**
 * Build the per-instance id-storage values for the selection mask: 1 for a
 * SELECTED draw's instances, 0 for everything else. The mask reuses the picking
 * pipeline, which indexes `pickIds[instance_index]`, so the storage MUST be
 * indexed by the DRAW COMMANDS' `firstInstance` (the frame's draw-order transform
 * packing) — not the snapshot's `worldTransformOffset`, which the queued route
 * reorders. Exported for unit coverage.
 */
export function createWebGpuOutlineSelectionMaskIdValues(
  commands: readonly RenderPassCommand[],
  selectedRenderIds: ReadonlySet<number>,
): { readonly ids: Uint32Array; readonly selectedDraws: number } {
  let maxInstance = 1;
  for (const command of commands) {
    if (command.kind === "draw" || command.kind === "drawIndexed") {
      maxInstance = Math.max(
        maxInstance,
        command.firstInstance + Math.max(1, command.instanceCount),
      );
    }
  }
  const ids = new Uint32Array(maxInstance);
  let selectedDraws = 0;

  for (const command of commands) {
    if (command.kind !== "draw" && command.kind !== "drawIndexed") {
      continue;
    }
    if (!selectedRenderIds.has(command.renderId)) {
      continue;
    }
    const count = Math.max(1, command.instanceCount);
    for (let i = 0; i < count; i += 1) {
      const index = command.firstInstance + i;
      if (index >= 0 && index < ids.length) {
        ids[index] = WEBGPU_OUTLINE_MASK_SELECTED_ID;
      }
    }
    selectedDraws += 1;
  }

  return { ids, selectedDraws };
}

export async function renderWebGpuAppOutlineSelectionMask(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly commands: readonly RenderPassCommand[];
  readonly viewUniformBuffer: unknown;
  readonly worldTransformBuffer: unknown;
  readonly pipelineKeysByRenderId: ReadonlyMap<number, string>;
  readonly selection: ReadonlySet<number>;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}): Promise<WebGpuAppOutlineSelectionMaskResult> {
  const empty: WebGpuAppOutlineSelectionMaskResult = {
    mask: null,
    selectedCount: 0,
    drawCalls: 0,
    ok: true,
    diagnostics: [],
  };

  if (options.selection.size === 0 || options.snapshot.meshDraws.length === 0) {
    return empty;
  }

  const selectedRenderIds = outlineSelectedRenderIds(
    options.snapshot,
    options.selection,
  );
  const { ids, selectedDraws } = createWebGpuOutlineSelectionMaskIdValues(
    options.commands,
    selectedRenderIds,
  );

  if (selectedDraws === 0) {
    return empty;
  }

  const diagnostics: unknown[] = [];
  const device = options.app.initialization.device;

  const idStorage = createSelectionMaskIdStorage(device, ids);
  if (idStorage.resource === null) {
    return { ...empty, ok: false, diagnostics: idStorage.diagnostics };
  }

  const pipelines = await getOrCreateWebGpuIdBufferPickPipelines({
    app: options.app,
    cache: options.cache,
    snapshot: options.snapshot,
    pipelineKeysByRenderId: options.pipelineKeysByRenderId,
  });
  diagnostics.push(...pipelines.diagnostics);
  const firstPipeline = pipelines.pipelines.values().next().value as
    | WebGpuIdBufferPickPipelineResource
    | undefined;

  if (firstPipeline === undefined) {
    // No pickable draw (e.g. skinned/morphed only): no mask, but not an error —
    // the outline effect degrades to identity.
    return { ...empty, drawCalls: 0, diagnostics };
  }

  const idBindGroup = createWebGpuIdBufferPickBindGroup({
    device: device as Parameters<
      typeof createWebGpuIdBufferPickBindGroup
    >[0]["device"],
    pipeline: firstPipeline,
    ids: idStorage.resource,
  });
  if (!idBindGroup.valid || idBindGroup.resource === null) {
    return {
      ...empty,
      ok: false,
      diagnostics: [...diagnostics, ...idBindGroup.diagnostics],
    };
  }

  const sharedBindGroups = createWebGpuAppPickSharedBindGroups({
    device,
    pipeline: firstPipeline,
    viewUniformBuffer: options.viewUniformBuffer,
    worldTransformBuffer: options.worldTransformBuffer,
  });
  if (!sharedBindGroups.valid) {
    return {
      ...empty,
      ok: false,
      diagnostics: [...diagnostics, ...sharedBindGroups.diagnostics],
    };
  }

  const maskCommands = createWebGpuIdBufferPickCommands({
    commands: options.commands,
    pipelineByKey: pipelines.pipelines,
    viewBindGroup: sharedBindGroups.viewBindGroup,
    worldTransformBindGroup: sharedBindGroups.worldTransformBindGroup,
    idBindGroup: idBindGroup.resource,
  });
  diagnostics.push(...maskCommands.diagnostics);
  if (!maskCommands.valid) {
    return { ...empty, ok: false, diagnostics };
  }

  const maskTexture = createOrReuseWebGpuPostPassTexture({
    device: device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.outlineSelectionMask,
    width: options.width,
    height: options.height,
    format: WEBGPU_ID_BUFFER_FORMAT,
    label: `${options.label}:outline:mask`,
  });
  diagnostics.push(...maskTexture.diagnostics);
  if (!maskTexture.valid || maskTexture.resource === null) {
    return { ...empty, ok: false, diagnostics };
  }

  const depth = createOrReuseWebGpuDepthTexture({
    device: device as Parameters<
      typeof createOrReuseWebGpuDepthTexture
    >[0]["device"],
    cache: options.cache.postPasses.outlineSelectionMaskDepth,
    width: options.width,
    height: options.height,
    format: WEBGPU_APP_DEPTH_FORMAT,
    sampleCount: 1,
    label: `${options.label}:outline:mask-depth`,
  });

  const boundary = assembleFrameBoundary({
    context: options.app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: device as Parameters<typeof assembleFrameBoundary>[0]["device"],
    queue: (device as { readonly queue: unknown }).queue as Parameters<
      typeof assembleFrameBoundary
    >[0]["queue"],
    commands: maskCommands.commands,
    label: `${options.label}:outline:mask`,
    colorTarget: {
      source: "offscreen-target",
      texture: maskTexture.resource.texture as CurrentTextureLike,
    },
    // r32uint clear: 0 = unselected/background. Selected fragments write 1.
    clearColor: [0, 0, 0, 0],
    depthTarget: {
      view: depth.resource.view,
      depthClearValue: options.snapshot.views[0]?.clearDepth ?? 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  diagnostics.push(
    ...boundary.texture.diagnostics,
    ...(boundary.attachments?.diagnostics ?? []),
    ...(boundary.encoder?.diagnostics ?? []),
    ...(boundary.begin?.diagnostics ?? []),
    ...(boundary.execution?.diagnostics ?? []),
    ...(boundary.end?.diagnostics ?? []),
    ...(boundary.finish?.diagnostics ?? []),
    ...(boundary.submit?.diagnostics ?? []),
  );

  return {
    mask: boundary.valid ? maskTexture.resource : null,
    selectedCount: selectedDraws,
    drawCalls: boundary.execution?.drawCalls ?? 0,
    ok: boundary.valid,
    diagnostics,
  };
}

function createSelectionMaskIdStorage(
  device: unknown,
  ids: Uint32Array,
): {
  readonly resource: WebGpuIdBufferPickIdStorageResource | null;
  readonly diagnostics: readonly unknown[];
} {
  const result = createWebGpuBuffer({
    device: device as WebGpuBufferDeviceLike,
    descriptor: {
      label: "aperture/outline-selection-mask-ids",
      size: ids.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: ids,
    },
  });

  if (!result.ok) {
    return {
      resource: null,
      diagnostics: [
        {
          code: "webGpuApp.outlineSelectionMaskBufferFailed",
          message: `Outline selection mask id storage could not be created: ${result.message}`,
        },
      ],
    };
  }

  return {
    resource: {
      resourceKey: "outline-selection-mask/ids",
      buffer: result.buffer,
      ids,
    },
    diagnostics: [],
  };
}
