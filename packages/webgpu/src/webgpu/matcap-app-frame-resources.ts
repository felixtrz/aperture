import type {
  MatcapMaterialAsset,
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import {
  createMatcapFrameGpuResources,
  type CreateMatcapFrameGpuResourcesResult,
} from "./matcap-frame-resources.js";
import type { MatcapMaterialBindGroupLayoutResource } from "./matcap-bind-group.js";
import type { UnlitBindGroupLayoutResource } from "./unlit-bind-group.js";
import { createViewUniformBufferDescriptor } from "./view-uniform-buffer.js";
import { createWorldTransformBufferDescriptor } from "./world-transform-buffer.js";

export interface CachedMatcapAppFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  result: CreateMatcapFrameGpuResourcesResult;
}

export interface MatcapAppFrameResourceCacheSlot {
  current: CachedMatcapAppFrameResources | null;
}

export interface MatcapAppFrameResourceReuseReport {
  meshBuffersCreated: number;
  meshBuffersReused: number;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  dynamicBufferWrites: number;
}

export function createOrReuseMatcapAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: MatcapAppFrameResourceCacheSlot;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: MatcapMaterialAsset | null;
  readonly materialKey: string;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: MatcapMaterialBindGroupLayoutResource | null;
  readonly reuse: MatcapAppFrameResourceReuseReport;
}): CreateMatcapFrameGpuResourcesResult {
  const viewDescriptor = createViewUniformBufferDescriptor(
    options.viewUniforms,
  );
  const transformDescriptor = createWorldTransformBufferDescriptor(
    options.worldTransforms,
  );
  const cached = options.cache.current;

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    sameStringList(cached.textureKeys, options.textures.textureKeys) &&
    sameStringList(cached.samplerKeys, options.textures.samplerKeys) &&
    cached.result.resources !== null &&
    viewDescriptor.plan !== null &&
    transformDescriptor.plan !== null &&
    cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
    cached.worldTransformByteLength ===
      transformDescriptor.plan.source.byteLength &&
    writeBufferData(
      options.device,
      cached.result.resources.viewUniform.buffer,
      viewDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.device,
      cached.result.resources.worldTransforms.buffer,
      transformDescriptor.plan.source,
    )
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.dynamicBufferWrites += 2;

    const resources = cached.result.resources;
    const result: CreateMatcapFrameGpuResourcesResult = {
      valid: true,
      resources: {
        ...resources,
        viewUniform: {
          ...resources.viewUniform,
          views: viewDescriptor.plan.views,
        },
        worldTransforms: {
          ...resources.worldTransforms,
          offsets: transformDescriptor.plan.offsets,
        },
      },
      diagnostics: [],
    };

    cached.result = result;
    return result;
  }

  const result = createMatcapFrameGpuResources({
    device: options.device as Parameters<
      typeof createMatcapFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    material: options.material,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    sharedLayouts: options.sharedLayouts,
    materialLayout: options.materialLayout,
    textures: options.textures.textures,
    samplers: options.textures.samplers,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.cache.current = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      textureKeys: [...options.textures.textureKeys],
      samplerKeys: [...options.textures.samplerKeys],
      viewByteLength:
        viewDescriptor.plan?.source.byteLength ??
        options.viewUniforms.data.byteLength,
      worldTransformByteLength:
        transformDescriptor.plan?.source.byteLength ??
        options.worldTransforms.data.byteLength,
      result,
    };
  }

  return result;
}
