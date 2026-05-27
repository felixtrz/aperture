import { type AssetRegistry } from "@aperture-engine/simulation";
import {
  createSamplerAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { StandardFrameTransmissionSceneColorResources } from "../materials/standard/standard-frame-resources.js";
import {
  createOrReuseWebGpuPostPassTexture,
  type WebGpuPostPassTextureResource,
} from "../post/post-pass.js";
import {
  assembleFrameBoundary,
  type FrameBoundaryAssemblyReport,
} from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import {
  createSamplerGpuResource,
  type SamplerGpuResource,
} from "../resources/textures/texture-resources.js";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import {
  createWebGpuAppFrameBoundaryTargets,
  type WebGpuAppFrameBoundaryTarget,
} from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import { commandsWithoutOcclusionQueryCommands } from "./occlusion-culling.js";
import { countDrawCommands, isRenderPassDrawCommand } from "./view-commands.js";
import type { WebGpuAppTransmissionGrabPassReport } from "./app.js";

interface WebGpuAppTransmissionGrabContext {
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: {
    readonly context: unknown;
    readonly device: unknown;
    readonly format: string;
  };
}

export interface WebGpuAppTransmissionGrabResourcesResult {
  readonly valid: boolean;
  readonly resources: StandardFrameTransmissionSceneColorResources | null;
  readonly diagnostics: readonly unknown[];
}

export function createWebGpuAppTransmissionGrabResources(options: {
  readonly app: WebGpuAppTransmissionGrabContext;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly required: boolean;
}): WebGpuAppTransmissionGrabResourcesResult {
  if (!options.required) {
    return { valid: true, resources: null, diagnostics: [] };
  }

  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );
  const target = targetPlan.targets[0];

  if (target === undefined) {
    return {
      valid: false,
      resources: null,
      diagnostics: targetPlan.diagnostics,
    };
  }

  const texture = createOrReuseWebGpuPostPassTexture({
    device: options.app.initialization.device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.transmissionGrab,
    width: target.width,
    height: target.height,
    format: target.format,
    label: "aperture/standard-transmission-grab/scene-color",
  });
  const diagnostics: unknown[] = [
    ...targetPlan.diagnostics,
    ...texture.diagnostics,
  ];

  if (!texture.valid || texture.resource === null) {
    return { valid: false, resources: null, diagnostics };
  }

  const view = texture.resource.texture.createView?.();

  if (view === undefined) {
    diagnostics.push({
      code: "webGpuApp.transmissionGrabTextureViewUnavailable",
      message:
        "StandardMaterial transmission grab pass requires a scene color texture view.",
    });
    return { valid: false, resources: null, diagnostics };
  }

  const sampler = createOrReuseTransmissionGrabSampler(options);

  diagnostics.push(...sampler.diagnostics);

  if (sampler.resource === null) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: diagnostics.length === 0,
    resources: {
      texture: {
        resourceKey: transmissionGrabTextureResourceKey(texture.resource),
        texture: texture.resource.texture,
        view,
        width: texture.resource.width,
        height: texture.resource.height,
        format: texture.resource.format,
      },
      sampler: {
        resourceKey: sampler.resource.resourceKey,
        sampler: sampler.resource.sampler,
      },
    },
    diagnostics,
  };
}

export function assembleWebGpuAppTransmissionGrabPass(options: {
  readonly app: WebGpuAppTransmissionGrabContext;
  readonly target: WebGpuAppFrameBoundaryTarget;
  readonly commands: readonly RenderPassCommand[];
  readonly depthAttachment: CachedWebGpuDepthTextureResource;
  readonly label: string;
  readonly clearColor: readonly number[];
  readonly resources: StandardFrameTransmissionSceneColorResources;
}): {
  readonly boundary: FrameBoundaryAssemblyReport;
  readonly report: WebGpuAppTransmissionGrabPassReport;
  readonly diagnostics: readonly unknown[];
} {
  const commands = commandsWithoutOcclusionQueryCommands(
    commandsWithoutTransmissionDraws(options.commands),
  );
  const boundary = assembleFrameBoundary({
    context: options.app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: options.app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (options.app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands,
    label: `${options.label}:transmission-grab:${options.target.renderTargetKey ?? "swapchain"}`,
    colorTarget: {
      source: "offscreen-target",
      texture: options.resources.texture.texture,
    },
    clearColor: options.clearColor,
    depthTarget: {
      view: options.depthAttachment.view,
      depthClearValue: options.target.view.clearDepth,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });
  const diagnostics = [
    ...boundary.texture.diagnostics,
    ...(boundary.attachments?.diagnostics ?? []),
    ...(boundary.encoder?.diagnostics ?? []),
    ...(boundary.begin?.diagnostics ?? []),
    ...(boundary.rectangle?.diagnostics ?? []),
    ...(boundary.execution?.diagnostics ?? []),
    ...(boundary.end?.diagnostics ?? []),
    ...(boundary.finish?.diagnostics ?? []),
    ...(boundary.submit?.diagnostics ?? []),
  ];

  return {
    boundary,
    report: {
      enabled: true,
      ok: boundary.valid,
      width: options.resources.texture.width,
      height: options.resources.texture.height,
      format: options.resources.texture.format,
      commands: commands.length,
      drawCalls: countDrawCommands(commands),
      textureResourceKey: options.resources.texture.resourceKey,
      samplerResourceKey: options.resources.sampler.resourceKey,
    },
    diagnostics,
  };
}

function createOrReuseTransmissionGrabSampler(options: {
  readonly app: WebGpuAppTransmissionGrabContext;
  readonly cache: WebGpuAppResourceCache;
}): {
  readonly resource: SamplerGpuResource | null;
  readonly diagnostics: readonly unknown[];
} {
  const resourceKey = "standard-transmission-grab:sampler";
  const cached = options.cache.samplers.get(resourceKey);

  if (cached !== undefined) {
    return { resource: cached, diagnostics: [] };
  }

  const result = createSamplerGpuResource({
    device: options.app.initialization.device as Parameters<
      typeof createSamplerGpuResource
    >[0]["device"],
    resourceKey,
    sampler: createSamplerAsset({
      label: "Standard transmission scene color sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      lodMaxClamp: 0,
    }),
  });

  if (result.valid && result.resource !== null) {
    options.cache.samplers.set(resourceKey, result.resource);
  }

  return { resource: result.resource, diagnostics: result.diagnostics };
}

function commandsWithoutTransmissionDraws(
  commands: readonly RenderPassCommand[],
): readonly RenderPassCommand[] {
  const transmissionRenderIds = new Set<number>();
  let activePipelineKey = "";

  for (const command of commands) {
    if (command.kind === "setPipeline") {
      activePipelineKey = command.pipelineKey;
    }

    if (
      isRenderPassDrawCommand(command) &&
      pipelineKeyUsesTransmission(activePipelineKey)
    ) {
      transmissionRenderIds.add(command.renderId);
    }
  }

  if (transmissionRenderIds.size === 0) {
    return commands;
  }

  return commands.filter(
    (command) => !transmissionRenderIds.has(command.renderId),
  );
}

function pipelineKeyUsesTransmission(pipelineKey: string): boolean {
  return materialPipelineKeyFromRenderPipelineKey(pipelineKey)
    .split("|")
    .includes("transmission");
}

function materialPipelineKeyFromRenderPipelineKey(pipelineKey: string): string {
  const cacheKey = pipelineKey.startsWith("render-pipeline:")
    ? pipelineKey.slice("render-pipeline:".length)
    : pipelineKey;

  try {
    const parsed = JSON.parse(cacheKey) as {
      readonly material?: { readonly pipelineKey?: unknown };
      readonly batch?: { readonly pipelineKey?: unknown };
    };
    const materialPipelineKey = parsed.material?.pipelineKey;

    if (typeof materialPipelineKey === "string") {
      return materialPipelineKey;
    }

    const batchPipelineKey = parsed.batch?.pipelineKey;

    if (typeof batchPipelineKey === "string") {
      return batchPipelineKey;
    }
  } catch {
    // Non-cache pipeline keys are already authored material keys.
  }

  return pipelineKey;
}

function transmissionGrabTextureResourceKey(
  resource: WebGpuPostPassTextureResource,
): string {
  return [
    "standard-transmission-grab:scene-color",
    resource.width,
    resource.height,
    resource.format,
  ].join(":");
}
