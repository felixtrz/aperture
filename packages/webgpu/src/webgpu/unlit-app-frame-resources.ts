import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import {
  createUnlitFrameGpuResources,
  type CreateUnlitFrameGpuResourcesResult,
} from "./unlit-frame-resources.js";
import {
  prepareScalarUnlitMaterialResource,
  type PreparedScalarUnlitMaterialCacheStatus,
  type PreparedScalarUnlitMaterialCache,
  type PreparedScalarUnlitMaterialResource,
} from "./prepared-unlit-material-cache.js";
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

export interface CachedUnlitAppFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
  readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  result: CreateUnlitFrameGpuResourcesResult;
}

export interface UnlitAppFrameResourceCacheSlot {
  current: CachedUnlitAppFrameResources | null;
}

export interface UnlitAppFrameResourceReuseReport {
  meshBuffersCreated: number;
  meshBuffersReused: number;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
  dynamicBufferWrites: number;
}

export function createOrReuseUnlitAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: UnlitAppFrameResourceCacheSlot;
  readonly mesh: MeshAsset | null;
  readonly meshKey: string;
  readonly material: MaterialAsset | null;
  readonly materialHandle: MaterialHandle;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
  readonly preparedScalarMaterials: PreparedScalarUnlitMaterialCache;
  readonly assets: AssetRegistry;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly reuse: UnlitAppFrameResourceReuseReport;
}): CreateUnlitFrameGpuResourcesResult {
  const cached = options.cache.current;
  const viewDescriptorScratch =
    cached?.viewDescriptorScratch ?? createViewUniformBufferDescriptorScratch();
  const worldTransformDescriptorScratch =
    cached?.worldTransformDescriptorScratch ??
    createWorldTransformBufferDescriptorScratch();
  const viewDescriptor = writeViewUniformBufferDescriptor(
    options.viewUniforms,
    viewDescriptorScratch,
  );
  const transformDescriptor = writeWorldTransformBufferDescriptor(
    options.worldTransforms,
    worldTransformDescriptorScratch,
  );

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

    return cached.result;
  }

  const preparedMaterial = preparePreparedScalarMaterial(options);
  const result = createUnlitFrameGpuResources({
    device: options.device as Parameters<
      typeof createUnlitFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    material: options.material,
    ...(preparedMaterial === null
      ? {}
      : { preparedMaterial: preparedMaterial.resource }),
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    layouts: options.layouts,
    textures: options.textures.textures,
    samplers: options.textures.samplers,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;

    if (preparedMaterial === null) {
      options.reuse.materialBuffersCreated += 1;
      options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    } else {
      if (preparedMaterial.status === "reused") {
        options.reuse.materialBuffersReused += 1;
        options.reuse.bindGroupsReused += 1;
      } else {
        options.reuse.materialBuffersCreated += 1;
        options.reuse.bindGroupsCreated += 1;
      }

      options.reuse.bindGroupsCreated += Math.max(
        0,
        result.resources.bindGroups.length - 1,
      );
    }

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
      viewDescriptorScratch,
      worldTransformDescriptorScratch,
      result,
    };
  }

  return result;
}

interface PreparedScalarMaterialUse {
  readonly status: Extract<
    PreparedScalarUnlitMaterialCacheStatus,
    "created" | "reused"
  >;
  readonly resource: PreparedScalarUnlitMaterialResource;
}

function preparePreparedScalarMaterial(options: {
  readonly device: unknown;
  readonly assets: AssetRegistry;
  readonly preparedScalarMaterials: PreparedScalarUnlitMaterialCache;
  readonly materialHandle: MaterialHandle;
  readonly material: MaterialAsset | null;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
}): PreparedScalarMaterialUse | null {
  if (
    options.material === null ||
    options.material.kind !== "unlit" ||
    options.material.baseColorTexture !== null
  ) {
    return null;
  }

  const sourceVersion = sourceVersionFromMaterialKey(
    options.materialKey,
    options.sourceMaterialKey,
  );

  if (sourceVersion === null) {
    return null;
  }

  const result = prepareScalarUnlitMaterialResource({
    registry: options.assets,
    device: options.device as Parameters<
      typeof prepareScalarUnlitMaterialResource
    >[0]["device"],
    cache: options.preparedScalarMaterials,
    handle: options.materialHandle,
    material: options.material,
    sourceVersion,
    pipelineKey: options.pipelineKey,
    layout: options.layouts.find((layout) => layout.group === 2) ?? null,
  });

  return result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
    ? { status: result.status, resource: result.resource }
    : null;
}

function sourceVersionFromMaterialKey(
  materialKey: string,
  sourceMaterialKey: string,
): number | null {
  const prefix = `${sourceMaterialKey}@`;

  if (!materialKey.startsWith(prefix)) {
    return null;
  }

  const version = Number.parseInt(materialKey.slice(prefix.length), 10);

  return Number.isFinite(version) ? version : null;
}
