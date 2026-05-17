import type {
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
  StandardMaterialAsset,
} from "@aperture-engine/render";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  createLightBufferDescriptorPlanScratch,
  createLightBufferDescriptorScratch,
  writeLightBufferDescriptor,
  writeLightBufferDescriptorPlan,
  type LightBufferDescriptorPlanScratch,
  type LightBufferDescriptorScratch,
} from "./light-packing.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import {
  createStandardFrameGpuResources,
  type CreateStandardFrameGpuResourcesResult,
} from "./standard-frame-resources.js";
import type { UnlitBindGroupLayoutResource } from "./unlit-bind-group.js";
import {
  createViewUniformBufferDescriptorScratch,
  writeViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorScratch,
} from "./view-uniform-buffer.js";
import {
  createWorldTransformBufferDescriptorScratch,
  writeWorldTransformBufferDescriptor,
  type WorldTransformBufferDescriptorScratch,
} from "./world-transform-buffer.js";

export interface CachedStandardAppFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  readonly lightFloatByteLength: number;
  readonly lightMetadataByteLength: number;
  readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
  readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  readonly lightBufferDescriptorScratch: LightBufferDescriptorScratch;
  readonly lightBufferDescriptorPlanScratch: LightBufferDescriptorPlanScratch;
  result: CreateStandardFrameGpuResourcesResult;
}

export interface StandardAppFrameResourceCacheSlot {
  current: CachedStandardAppFrameResources | null;
}

export interface StandardAppFrameResourceReuseReport {
  meshBuffersCreated: number;
  meshBuffersReused: number;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  lightBuffersCreated: number;
  lightBuffersReused: number;
  dynamicBufferWrites: number;
}

export function createOrReuseStandardAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: StandardAppFrameResourceCacheSlot;
  readonly snapshot: RenderSnapshot;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: StandardMaterialAsset | null;
  readonly materialKey: string;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
  readonly reuse: StandardAppFrameResourceReuseReport;
}): CreateStandardFrameGpuResourcesResult {
  const cached = options.cache.current;
  const viewDescriptorScratch =
    cached?.viewDescriptorScratch ?? createViewUniformBufferDescriptorScratch();
  const worldTransformDescriptorScratch =
    cached?.worldTransformDescriptorScratch ??
    createWorldTransformBufferDescriptorScratch();
  const lightBufferDescriptorScratch =
    cached?.lightBufferDescriptorScratch ??
    createLightBufferDescriptorScratch();
  const lightBufferDescriptorPlanScratch =
    cached?.lightBufferDescriptorPlanScratch ??
    createLightBufferDescriptorPlanScratch();
  const viewDescriptor = writeViewUniformBufferDescriptor(
    options.viewUniforms,
    viewDescriptorScratch,
  );
  const transformDescriptor = writeWorldTransformBufferDescriptor(
    options.worldTransforms,
    worldTransformDescriptorScratch,
  );
  const lightBuffer = writeLightBufferDescriptor(
    options.snapshot,
    lightBufferDescriptorScratch,
  );
  const lightDescriptor = writeLightBufferDescriptorPlan(
    lightBuffer,
    lightBufferDescriptorPlanScratch,
  );

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    sameStringList(cached.textureKeys, options.textures.textureKeys) &&
    sameStringList(cached.samplerKeys, options.textures.samplerKeys) &&
    cached.result.resources !== null &&
    cached.result.resources.lightGpuBuffers.resource !== null &&
    viewDescriptor.plan !== null &&
    transformDescriptor.plan !== null &&
    lightDescriptor.plan !== null &&
    cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
    cached.worldTransformByteLength ===
      transformDescriptor.plan.source.byteLength &&
    cached.lightFloatByteLength ===
      lightDescriptor.plan.source.floats.byteLength &&
    cached.lightMetadataByteLength ===
      lightDescriptor.plan.source.metadata.byteLength &&
    writeBufferData(
      options.device,
      cached.result.resources.viewUniform.buffer,
      viewDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.device,
      cached.result.resources.worldTransforms.buffer,
      transformDescriptor.plan.source,
    ) &&
    writeBufferData(
      options.device,
      cached.result.resources.lightGpuBuffers.resource.floatBuffer,
      lightDescriptor.plan.source.floats,
    ) &&
    writeBufferData(
      options.device,
      cached.result.resources.lightGpuBuffers.resource.metadataBuffer,
      lightDescriptor.plan.source.metadata,
    )
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.lightBuffersReused += 1;
    options.reuse.dynamicBufferWrites += 4;

    const resources = cached.result.resources;

    (
      resources.viewUniform as {
        views: typeof viewDescriptor.plan.views;
      }
    ).views = viewDescriptor.plan.views;
    (
      resources.worldTransforms as {
        offsets: typeof transformDescriptor.plan.offsets;
      }
    ).offsets = transformDescriptor.plan.offsets;
    (
      resources.lightGpuBuffers as {
        lightBuffer: typeof lightBuffer;
        descriptorPlan: typeof lightDescriptor.plan;
      }
    ).lightBuffer = lightBuffer;
    (
      resources.lightGpuBuffers as {
        descriptorPlan: typeof lightDescriptor.plan;
      }
    ).descriptorPlan = lightDescriptor.plan;

    return cached.result;
  }

  const result = createStandardFrameGpuResources({
    device: options.device as Parameters<
      typeof createStandardFrameGpuResources
    >[0]["device"],
    snapshot: options.snapshot,
    mesh: options.mesh,
    material: options.material,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    sharedLayouts: options.sharedLayouts,
    materialLayout: options.materialLayout,
    lightLayout: options.lightLayout,
    textures: options.textures.textures,
    samplers: options.textures.samplers,
  });

  if (
    result.valid &&
    result.resources !== null &&
    result.resources.lightGpuBuffers.descriptorPlan !== null
  ) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += 1;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    options.reuse.lightBuffersCreated += 1;
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
      lightFloatByteLength:
        result.resources.lightGpuBuffers.descriptorPlan.source.floats
          .byteLength,
      lightMetadataByteLength:
        result.resources.lightGpuBuffers.descriptorPlan.source.metadata
          .byteLength,
      viewDescriptorScratch,
      worldTransformDescriptorScratch,
      lightBufferDescriptorScratch,
      lightBufferDescriptorPlanScratch,
      result,
    };
  }

  return result;
}
