import type {
  AssetRegistry,
  MaterialHandle,
  MeshHandle,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
  StandardMaterialAsset,
} from "@aperture-engine/render";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import {
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialResourceUse,
} from "./prepared-app-material-resource.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import {
  createLightBufferDescriptorPlanScratch,
  createLightBufferDescriptorScratch,
  writeLightBufferDescriptor,
  writeLightBufferDescriptorPlan,
  type LightBufferDescriptorPlanScratch,
  type LightBufferDescriptorScratch,
} from "./light-packing.js";
import {
  prepareAppMeshResource,
  type PreparedAppMeshResourceUse,
  type PreparedMeshGpuResourceCache,
} from "./prepared-app-mesh-resource.js";
import {
  prepareBaseColorTexturedStandardMaterialResource,
  prepareMetallicRoughnessTexturedStandardMaterialResource,
  prepareNormalTexturedStandardMaterialResource,
  prepareOcclusionEmissiveTexturedStandardMaterialResource,
  prepareScalarStandardMaterialResource,
  type PreparedBaseColorTexturedStandardMaterialResource,
  type PreparedMetallicRoughnessTexturedStandardMaterialResource,
  type PreparedNormalTexturedStandardMaterialResource,
  type PreparedOcclusionEmissiveTexturedStandardMaterialResource,
  type PreparedScalarStandardMaterialCache,
  type PreparedScalarStandardMaterialResource,
} from "./prepared-standard-material-cache.js";
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
  preparedMeshBuffersCreated: number;
  preparedMeshBuffersReused: number;
  materialBuffersCreated: number;
  materialBuffersReused: number;
  preparedMaterialBuffersCreated: number;
  preparedMaterialBuffersReused: number;
  preparedMaterialBindGroupsCreated: number;
  preparedMaterialBindGroupsReused: number;
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
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly material: StandardMaterialAsset | null;
  readonly materialHandle: MaterialHandle;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
  readonly assets: AssetRegistry;
  readonly textures: PreparedAppTextureSamplerResources;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout: LightBindGroupLayoutResource | null;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
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

  const preparedMesh = preparePreparedStandardMesh(options);
  const preparedMaterial = preparePreparedStandardMaterial(options);
  const result = createStandardFrameGpuResources({
    device: options.device as Parameters<
      typeof createStandardFrameGpuResources
    >[0]["device"],
    snapshot: options.snapshot,
    mesh: options.mesh,
    ...(preparedMesh === null
      ? {}
      : { preparedMesh: preparedMesh.resource.mesh }),
    material: options.material,
    ...(preparedMaterial === null
      ? {}
      : { preparedMaterial: preparedMaterial.resource }),
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
    if (preparedMesh === null) {
      options.reuse.meshBuffersCreated += 1;
    } else if (preparedMesh.status === "reused") {
      options.reuse.meshBuffersReused += 1;
      options.reuse.preparedMeshBuffersReused += 1;
    } else {
      options.reuse.meshBuffersCreated += 1;
      options.reuse.preparedMeshBuffersCreated += 1;
    }

    if (preparedMaterial === null) {
      options.reuse.materialBuffersCreated += 1;
      options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
    } else {
      recordPreparedAppMaterialResourceUse(
        options.reuse,
        preparedMaterial,
        result.resources.bindGroups.length,
      );
    }

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

type PreparedStandardMaterialUse = PreparedAppMaterialResourceUse<
  | PreparedScalarStandardMaterialResource
  | PreparedBaseColorTexturedStandardMaterialResource
  | PreparedMetallicRoughnessTexturedStandardMaterialResource
  | PreparedNormalTexturedStandardMaterialResource
  | PreparedOcclusionEmissiveTexturedStandardMaterialResource
>;

function preparePreparedStandardMesh(options: {
  readonly device: unknown;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly material: StandardMaterialAsset | null;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
}): PreparedAppMeshResourceUse | null {
  if (options.mesh === null || options.material === null) {
    return null;
  }

  return prepareAppMeshResource({
    device: options.device,
    mesh: options.mesh,
    meshHandle: options.meshHandle,
    meshKey: options.meshKey,
    preparedMeshes: options.preparedMeshes,
  });
}

function preparePreparedStandardMaterial(options: {
  readonly device: unknown;
  readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
  readonly materialHandle: MaterialHandle;
  readonly material: StandardMaterialAsset | null;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
  readonly assets: AssetRegistry;
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly textures: PreparedAppTextureSamplerResources;
}): PreparedStandardMaterialUse | null {
  if (options.material === null) {
    return null;
  }

  const sourceVersion = sourceVersionFromAssetKey(
    options.materialKey,
    options.sourceMaterialKey,
  );

  if (sourceVersion === null) {
    return null;
  }

  const result =
    options.material.baseColorTexture !== null
      ? prepareBaseColorTexturedStandardMaterialResource({
          registry: options.assets,
          device: options.device as Parameters<
            typeof prepareBaseColorTexturedStandardMaterialResource
          >[0]["device"],
          cache: options.preparedScalarMaterials,
          handle: options.materialHandle,
          material: options.material,
          sourceVersion,
          pipelineKey: options.pipelineKey,
          layout: options.materialLayout,
          textures: options.textures.textures,
          samplers: options.textures.samplers,
        })
      : options.material.metallicRoughnessTexture !== null
        ? prepareMetallicRoughnessTexturedStandardMaterialResource({
            registry: options.assets,
            device: options.device as Parameters<
              typeof prepareMetallicRoughnessTexturedStandardMaterialResource
            >[0]["device"],
            cache: options.preparedScalarMaterials,
            handle: options.materialHandle,
            material: options.material,
            sourceVersion,
            pipelineKey: options.pipelineKey,
            layout: options.materialLayout,
            textures: options.textures.textures,
            samplers: options.textures.samplers,
          })
        : options.material.normalTexture !== null
          ? prepareNormalTexturedStandardMaterialResource({
              registry: options.assets,
              device: options.device as Parameters<
                typeof prepareNormalTexturedStandardMaterialResource
              >[0]["device"],
              cache: options.preparedScalarMaterials,
              handle: options.materialHandle,
              material: options.material,
              sourceVersion,
              pipelineKey: options.pipelineKey,
              layout: options.materialLayout,
              textures: options.textures.textures,
              samplers: options.textures.samplers,
            })
          : options.material.occlusionTexture !== null ||
              options.material.emissiveTexture !== null
            ? prepareOcclusionEmissiveTexturedStandardMaterialResource({
                registry: options.assets,
                device: options.device as Parameters<
                  typeof prepareOcclusionEmissiveTexturedStandardMaterialResource
                >[0]["device"],
                cache: options.preparedScalarMaterials,
                handle: options.materialHandle,
                material: options.material,
                sourceVersion,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
                textures: options.textures.textures,
                samplers: options.textures.samplers,
              })
            : prepareScalarStandardMaterialResource({
                device: options.device as Parameters<
                  typeof prepareScalarStandardMaterialResource
                >[0]["device"],
                cache: options.preparedScalarMaterials,
                handle: options.materialHandle,
                material: options.material,
                sourceVersion,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
              });

  return result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
    ? { status: result.status, resource: result.resource }
    : null;
}

function sourceVersionFromAssetKey(
  assetKey: string,
  sourceAssetKey: string,
): number | null {
  const prefix = `${sourceAssetKey}@`;

  if (!assetKey.startsWith(prefix)) {
    return null;
  }

  const version = Number.parseInt(assetKey.slice(prefix.length), 10);

  return Number.isFinite(version) ? version : null;
}
