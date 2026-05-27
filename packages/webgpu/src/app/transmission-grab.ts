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
  createSamplerGpuResource,
  type SamplerGpuResource,
} from "../resources/textures/texture-resources.js";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import { createWebGpuAppFrameBoundaryTargets } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

interface WebGpuAppTransmissionGrabContext {
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: {
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
