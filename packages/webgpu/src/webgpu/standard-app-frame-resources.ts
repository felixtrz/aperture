import type {
  AssetRegistry,
  MaterialHandle,
  MeshHandle,
} from "@aperture-engine/simulation";
import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshDrawPacket,
  PackedSnapshotInstanceTints,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
  StandardMaterialAsset,
} from "@aperture-engine/render";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialResourceUse,
} from "./prepared-app-material-resource.js";
import type { PreparedMaterialTextureSamplerDependencies } from "./prepared-material-texture-sampler-dependencies.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import type { StandardLightShadowBindGroupLayoutResource } from "./standard-light-shadow-bind-group.js";
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
  type CreateStandardFrameGpuResourcesOptions,
  type StandardFrameIblResources,
  type StandardFrameShadowReceiverResources,
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
  readonly pipelineKey: string;
  readonly materialLayoutKey: string | null;
  readonly lightLayoutKey: string | null;
  readonly standardMaterialIblBindGroupResourceKey: string | null;
  readonly standardMaterialShadowReceiverResourceKey: string | null;
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

export type CreateStandardAppFrameResourcesDiagnostic =
  | CreateStandardFrameGpuResourcesResult["diagnostics"][number]
  | PreparedAppMaterialFallbackDiagnostic;

export interface CreateStandardAppFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: CreateStandardFrameGpuResourcesResult["resources"];
  readonly diagnostics: readonly CreateStandardAppFrameResourcesDiagnostic[];
}

export function createOrReuseStandardAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: StandardAppFrameResourceCacheSlot;
  readonly snapshot: RenderSnapshot;
  readonly draw?: MeshDrawPacket;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly material: StandardMaterialAsset | null;
  readonly materialHandle: MaterialHandle;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly pipelineKey: string;
  readonly assets: AssetRegistry;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout:
    | LightBindGroupLayoutResource
    | StandardLightShadowBindGroupLayoutResource
    | null;
  readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly standardAreaLightLtcResources?: CreateStandardFrameGpuResourcesOptions["standardAreaLightLtcResources"];
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
  readonly reuse: StandardAppFrameResourceReuseReport;
}): CreateStandardAppFrameResourcesResult {
  const cached = options.cache.current;
  const standardMaterialIblBindGroupResourceKey =
    standardMaterialIblBindGroupResourceKeyFromResources(
      options.standardMaterialIblResources,
    );
  const standardMaterialShadowReceiverResourceKey =
    standardMaterialShadowReceiverResourceKeyFromResources(
      options.shadowReceiverResources,
    );
  const materialLayoutKey = options.materialLayout?.layoutKey ?? null;
  const lightLayoutKey = options.lightLayout?.layoutKey ?? null;
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
    cached.pipelineKey === options.pipelineKey &&
    cached.materialLayoutKey === materialLayoutKey &&
    cached.lightLayoutKey === lightLayoutKey &&
    cached.standardMaterialIblBindGroupResourceKey ===
      standardMaterialIblBindGroupResourceKey &&
    cached.standardMaterialShadowReceiverResourceKey ===
      standardMaterialShadowReceiverResourceKey &&
    sameStringList(
      cached.textureKeys,
      options.textureSamplerDependencies.textureKeys,
    ) &&
    sameStringList(
      cached.samplerKeys,
      options.textureSamplerDependencies.samplerKeys,
    ) &&
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
    !requiresInstanceTintBuffer(options.pipelineKey) &&
    !requiresSkinningJointBuffer(options.pipelineKey) &&
    !requiresMorphTargetWeightBuffer(options.pipelineKey) &&
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

  const preparedMaterialFallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[] =
    [];
  const preparedMesh = preparePreparedStandardMesh(options);
  const preparedMaterial = preparePreparedStandardMaterial(
    { ...options, frame: options.snapshot.frame },
    preparedMaterialFallbackDiagnostics,
  );
  const result = createStandardFrameGpuResources({
    device: options.device as Parameters<
      typeof createStandardFrameGpuResources
    >[0]["device"],
    snapshot: options.snapshot,
    ...(options.draw === undefined ? {} : { draw: options.draw }),
    pipelineKey: options.pipelineKey,
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
    ...(options.instanceTints === undefined
      ? {}
      : { instanceTints: options.instanceTints }),
    sharedLayouts: options.sharedLayouts,
    materialLayout: options.materialLayout,
    lightLayout: options.lightLayout,
    ...(options.shadowReceiverResources === undefined
      ? {}
      : { shadowReceiverResources: options.shadowReceiverResources }),
    ...(options.standardMaterialIblResources === undefined
      ? {}
      : { standardMaterialIblResources: options.standardMaterialIblResources }),
    ...(options.standardAreaLightLtcResources === undefined
      ? {}
      : {
          standardAreaLightLtcResources: options.standardAreaLightLtcResources,
        }),
    textures: options.textureSamplerDependencies.textures,
    samplers: options.textureSamplerDependencies.samplers,
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
      pipelineKey: options.pipelineKey,
      materialLayoutKey,
      lightLayoutKey,
      standardMaterialIblBindGroupResourceKey,
      standardMaterialShadowReceiverResourceKey,
      textureKeys: [...options.textureSamplerDependencies.textureKeys],
      samplerKeys: [...options.textureSamplerDependencies.samplerKeys],
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

  return appendPreparedMaterialFallbackDiagnostics(
    result,
    preparedMaterialFallbackDiagnostics,
  );
}

function requiresInstanceTintBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("instance-tint");
}

function requiresSkinningJointBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("skinned");
}

function requiresMorphTargetWeightBuffer(pipelineKey: string): boolean {
  return pipelineKey.split("|").includes("morphed");
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
  readonly frame?: number | undefined;
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
    frame: options.frame,
    preparedMeshes: options.preparedMeshes,
  });
}

function preparePreparedStandardMaterial(
  options: {
    readonly device: unknown;
    readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
    readonly materialHandle: MaterialHandle;
    readonly material: StandardMaterialAsset | null;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly assets: AssetRegistry;
    readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  },
  fallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[],
): PreparedStandardMaterialUse | null {
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
          frame: options.frame,
          pipelineKey: options.pipelineKey,
          layout: options.materialLayout,
          textures: options.textureSamplerDependencies.textures,
          samplers: options.textureSamplerDependencies.samplers,
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
            frame: options.frame,
            pipelineKey: options.pipelineKey,
            layout: options.materialLayout,
            textures: options.textureSamplerDependencies.textures,
            samplers: options.textureSamplerDependencies.samplers,
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
              frame: options.frame,
              pipelineKey: options.pipelineKey,
              layout: options.materialLayout,
              textures: options.textureSamplerDependencies.textures,
              samplers: options.textureSamplerDependencies.samplers,
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
                frame: options.frame,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
                textures: options.textureSamplerDependencies.textures,
                samplers: options.textureSamplerDependencies.samplers,
              })
            : prepareScalarStandardMaterialResource({
                device: options.device as Parameters<
                  typeof prepareScalarStandardMaterialResource
                >[0]["device"],
                cache: options.preparedScalarMaterials,
                handle: options.materialHandle,
                material: options.material,
                sourceVersion,
                frame: options.frame,
                pipelineKey: options.pipelineKey,
                layout: options.materialLayout,
              });

  if (
    result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
  ) {
    return { status: result.status, resource: result.resource };
  }

  const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
    materialFamily: "standard",
    materialKey: assetHandleKey(options.materialHandle),
    status: result.status,
    diagnostics: result.diagnostics,
  });

  if (diagnostic !== null) {
    fallbackDiagnostics.push(diagnostic);
  }

  return null;
}

function appendPreparedMaterialFallbackDiagnostics(
  result: CreateStandardFrameGpuResourcesResult,
  diagnostics: readonly PreparedAppMaterialFallbackDiagnostic[],
): CreateStandardAppFrameResourcesResult {
  return diagnostics.length === 0
    ? result
    : {
        ...result,
        diagnostics: [...result.diagnostics, ...diagnostics],
      };
}

function standardMaterialIblBindGroupResourceKeyFromResources(
  resources: StandardFrameIblResources | undefined,
): string | null {
  const report = resources?.bindGroupResource;

  return report?.status === "available" && report.resource !== null
    ? report.resource.resourceKey
    : null;
}

function standardMaterialShadowReceiverResourceKeyFromResources(
  resources: StandardFrameShadowReceiverResources | undefined,
): string | null {
  if (resources === undefined) {
    return null;
  }

  const matrixKey = resources.matrixBufferResource.resource?.resourceKey ?? "";
  const depthKeys = resources.depthTextureResources.resources
    .map((resource) => resource.resourceKey)
    .join(",");
  const samplerKey = resources.samplerResource.resource?.resourceKey ?? "";

  return `${matrixKey}|${depthKeys}|${samplerKey}`;
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
