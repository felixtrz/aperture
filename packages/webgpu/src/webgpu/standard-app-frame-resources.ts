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
import type { BindGroupResourceCache } from "./bind-group-resource-cache.js";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialResourceUse,
} from "./prepared-app-material-resource.js";
import type { PreparedMaterialTextureSamplerDependencies } from "./prepared-material-texture-sampler-dependencies.js";
import type { LightBindGroupLayoutResource } from "./light-bind-group-layout.js";
import type { LightBindGroupResource } from "./light-bind-group.js";
import {
  CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE,
  createLocalLightClusterDescriptor,
  type LocalLightClusterDescriptor,
  type LocalLightClusterSupportedPointShadowResource,
  type LocalLightClusterSupportedSpotShadowResource,
} from "./local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "./local-light-cookie-resources.js";
import type {
  StandardLightShadowBindGroupLayoutResource,
  StandardLightShadowBindGroupResource,
} from "./standard-light-shadow-bind-group.js";
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
  prepareClearcoatRoughnessTexturedStandardMaterialResource,
  prepareClearcoatTexturedStandardMaterialResource,
  prepareIridescenceThicknessTexturedStandardMaterialResource,
  prepareIridescenceTexturedStandardMaterialResource,
  prepareMetallicRoughnessTexturedStandardMaterialResource,
  prepareNormalTexturedStandardMaterialResource,
  prepareOcclusionEmissiveTexturedStandardMaterialResource,
  prepareScalarStandardMaterialResource,
  prepareSheenColorTexturedStandardMaterialResource,
  prepareSheenRoughnessTexturedStandardMaterialResource,
  prepareTransmissionTexturedStandardMaterialResource,
  type PreparedBaseColorTexturedStandardMaterialResource,
  type PreparedClearcoatRoughnessTexturedStandardMaterialResource,
  type PreparedClearcoatTexturedStandardMaterialResource,
  type PreparedIridescenceThicknessTexturedStandardMaterialResource,
  type PreparedIridescenceTexturedStandardMaterialResource,
  type PreparedMetallicRoughnessTexturedStandardMaterialResource,
  type PreparedNormalTexturedStandardMaterialResource,
  type PreparedOcclusionEmissiveTexturedStandardMaterialResource,
  type PreparedScalarStandardMaterialCache,
  type PreparedScalarStandardMaterialResource,
  type PreparedSheenColorTexturedStandardMaterialResource,
  type PreparedSheenRoughnessTexturedStandardMaterialResource,
  type PreparedTransmissionTexturedStandardMaterialResource,
} from "./prepared-standard-material-cache.js";
import type { StandardMaterialBindGroupLayoutResource } from "./standard-bind-group.js";
import {
  createStandardFrameGpuResources,
  type CreateStandardFrameGpuResourcesResult,
  type CreateStandardFrameGpuResourcesOptions,
  type StandardFrameIblResources,
  type StandardFrameShadowReceiverResources,
  type StandardFrameTransmissionSceneColorResources,
} from "./standard-frame-resources.js";
import type {
  UnlitBindGroupLayoutResource,
  UnlitBindGroupResource,
} from "./unlit-bind-group.js";
import {
  createViewUniformBufferDescriptorScratch,
  writeViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorScratch,
} from "./view-uniform-buffer.js";
import {
  createWorldTransformBufferDescriptorScratch,
  writeWorldTransformBufferDescriptor,
  type WorldTransformBufferDescriptorScratch,
  type WorldTransformGpuBufferResource,
} from "./world-transform-buffer.js";

export interface CachedStandardAppFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly pipelineKey: string;
  readonly materialLayoutKey: string | null;
  readonly lightLayoutKey: string | null;
  readonly standardMaterialIblBindGroupResourceKey: string | null;
  readonly standardMaterialShadowReceiverResourceKey: string | null;
  readonly transmissionSceneColorResourceKey: string | null;
  readonly previousWorldTransformResourceKey: string | null;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  readonly lightFloatByteLength: number;
  readonly lightMetadataByteLength: number;
  readonly localLightClusterParamsByteLength: number;
  readonly localLightClusterCellsByteLength: number;
  readonly localLightClusterIndicesByteLength: number;
  readonly localLightClusterMetadataByteLength: number;
  readonly localLightClusterContentKeys: LocalLightClusterContentKeys | null;
  readonly localLightClusterResourceKey: string | null;
  readonly localLightCookieTextureKey: string | null;
  readonly localLightCookieSamplerKey: string | null;
  readonly localLightCookieMatrixKey: string | null;
  readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
  readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  readonly lightBufferDescriptorScratch: LightBufferDescriptorScratch;
  readonly lightBufferDescriptorPlanScratch: LightBufferDescriptorPlanScratch;
  result: CreateStandardFrameGpuResourcesResult;
}

export interface StandardAppFrameResourceCacheSlot {
  current: CachedStandardAppFrameResources | null;
  readonly byRoute?: Map<string, CachedStandardAppFrameResources>;
}

export function createStandardAppFrameResourceCacheSlot(): StandardAppFrameResourceCacheSlot {
  return { current: null, byRoute: new Map() };
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
  localLightClusterBuffersCreated: number;
  localLightClusterBuffersReused: number;
  localLightClusterBufferWrites: number;
  localLightClusterBufferWritesSkipped: number;
  dynamicBufferWrites: number;
}

interface LocalLightClusterContentKeys {
  readonly params: string;
  readonly cells: string;
  readonly indices: string;
  readonly metadata: string;
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
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly instanceTints?: PackedSnapshotInstanceTints | null;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: StandardMaterialBindGroupLayoutResource | null;
  readonly lightLayout:
    | LightBindGroupLayoutResource
    | StandardLightShadowBindGroupLayoutResource
    | null;
  readonly sharedBindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
  readonly lightBindGroupCache?:
    | BindGroupResourceCache<LightBindGroupResource>
    | undefined;
  readonly standardLightShadowBindGroupCache?:
    | BindGroupResourceCache<StandardLightShadowBindGroupResource>
    | undefined;
  readonly shadowReceiverResources?: StandardFrameShadowReceiverResources;
  readonly standardMaterialIblResources?: StandardFrameIblResources;
  readonly standardAreaLightLtcResources?: CreateStandardFrameGpuResourcesOptions["standardAreaLightLtcResources"];
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly localLightCookieResources?: LocalLightClusterCookieResources | null;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedScalarMaterials: PreparedScalarStandardMaterialCache;
  readonly reuse: StandardAppFrameResourceReuseReport;
}): CreateStandardAppFrameResourcesResult {
  const standardMaterialIblBindGroupResourceKey =
    standardMaterialIblBindGroupResourceKeyFromResources(
      options.standardMaterialIblResources,
    );
  const standardMaterialShadowReceiverResourceKey =
    standardMaterialShadowReceiverResourceKeyFromResources(
      options.shadowReceiverResources,
    );
  const transmissionSceneColorResourceKey =
    transmissionSceneColorResourceKeyFromResources(
      options.transmissionSceneColorResources,
    );
  const materialLayoutKey = options.materialLayout?.layoutKey ?? null;
  const lightLayoutKey = options.lightLayout?.layoutKey ?? null;
  const localLightClusterDescriptor = requiresClusteredLocalLights(
    options.pipelineKey,
  )
    ? createLocalLightClusterDescriptor(options.snapshot, {
        ...(options.draw === undefined
          ? {}
          : { layerMask: options.draw.layerMask }),
        supportedPointShadowResources:
          supportedPointShadowResourcesFromReceiver(
            options.shadowReceiverResources,
          ),
        supportedSpotShadowResources: supportedSpotShadowResourcesFromReceiver(
          options.shadowReceiverResources,
        ),
        supportedCookieResources:
          options.localLightCookieResources?.supportedResources ?? [],
      })
    : null;
  const localLightClusterResourceKey =
    localLightClusterDescriptor?.resourceKey ?? null;
  const localLightClusterContentKeys =
    localLightClusterDescriptor === null
      ? null
      : createLocalLightClusterContentKeys(localLightClusterDescriptor);
  const localLightCookieTextureKey =
    options.localLightCookieResources?.textureKey ?? null;
  const localLightCookieSamplerKey =
    options.localLightCookieResources?.samplerKey ?? null;
  const localLightCookieMatrixKey =
    options.localLightCookieResources?.matrixResource.resourceKey ?? null;
  const routeCacheKey = createStandardAppFrameResourceCacheKey({
    meshKey: options.meshKey,
    materialKey: options.materialKey,
    pipelineKey: options.pipelineKey,
    materialLayoutKey,
    lightLayoutKey,
    standardMaterialIblBindGroupResourceKey,
    standardMaterialShadowReceiverResourceKey,
    transmissionSceneColorResourceKey,
    previousWorldTransformResourceKey:
      options.previousWorldTransforms?.resourceKey ?? null,
    localLightClusterResourceKey,
    localLightCookieTextureKey,
    localLightCookieSamplerKey,
    localLightCookieMatrixKey,
    textureKeys: options.textureSamplerDependencies.textureKeys,
    samplerKeys: options.textureSamplerDependencies.samplerKeys,
  });
  const cached =
    options.cache.byRoute === undefined
      ? options.cache.current
      : (options.cache.byRoute.get(routeCacheKey) ?? null);
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
  const cachedLocalLightClusters =
    cached?.result.resources?.localLightClusters ?? null;
  const localLightClusterContentUnchanged =
    localLightClusterContentKeys !== null &&
    cached?.localLightClusterContentKeys !== null &&
    cached?.localLightClusterContentKeys !== undefined &&
    sameLocalLightClusterContentKeys(
      cached.localLightClusterContentKeys,
      localLightClusterContentKeys,
    );
  let localLightClusterBufferWrites = 0;
  let localLightClusterBufferWritesSkipped = 0;
  const writeCachedLocalLightClusterBuffers = (): boolean => {
    if (localLightClusterDescriptor === null) {
      return true;
    }

    if (cachedLocalLightClusters === null) {
      return false;
    }

    if (localLightClusterContentUnchanged) {
      localLightClusterBufferWritesSkipped = 4;
      return true;
    }

    const written =
      writeBufferData(
        options.device,
        cachedLocalLightClusters.paramsBuffer,
        localLightClusterDescriptor.params,
      ) &&
      writeBufferData(
        options.device,
        cachedLocalLightClusters.cellsBuffer,
        localLightClusterDescriptor.cells,
      ) &&
      writeBufferData(
        options.device,
        cachedLocalLightClusters.indicesBuffer,
        localLightClusterDescriptor.indices,
      ) &&
      writeBufferData(
        options.device,
        cachedLocalLightClusters.metadataBuffer,
        localLightClusterDescriptor.metadata,
      );

    if (written) {
      localLightClusterBufferWrites = 4;
    }

    return written;
  };

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
    cached.transmissionSceneColorResourceKey ===
      transmissionSceneColorResourceKey &&
    cached.localLightClusterResourceKey === localLightClusterResourceKey &&
    cached.localLightCookieTextureKey === localLightCookieTextureKey &&
    cached.localLightCookieSamplerKey === localLightCookieSamplerKey &&
    cached.localLightCookieMatrixKey === localLightCookieMatrixKey &&
    cached.previousWorldTransformResourceKey ===
      (options.previousWorldTransforms?.resourceKey ?? null) &&
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
    (localLightClusterDescriptor === null ||
      (cachedLocalLightClusters !== null &&
        cached.localLightClusterParamsByteLength ===
          localLightClusterDescriptor.params.byteLength &&
        cached.localLightClusterCellsByteLength ===
          localLightClusterDescriptor.cells.byteLength &&
        cached.localLightClusterIndicesByteLength ===
          localLightClusterDescriptor.indices.byteLength &&
        cached.localLightClusterMetadataByteLength ===
          localLightClusterDescriptor.metadata.byteLength)) &&
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
    ) &&
    writeCachedLocalLightClusterBuffers()
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.lightBuffersReused += 1;
    options.reuse.dynamicBufferWrites += 4;
    if (
      localLightClusterDescriptor !== null &&
      cachedLocalLightClusters !== null
    ) {
      cachedLocalLightClusters.descriptor = localLightClusterDescriptor;
      options.reuse.localLightClusterBuffersReused += 4;
      options.reuse.localLightClusterBufferWrites +=
        localLightClusterBufferWrites;
      options.reuse.localLightClusterBufferWritesSkipped +=
        localLightClusterBufferWritesSkipped;
      options.reuse.dynamicBufferWrites += localLightClusterBufferWrites;
      (
        cached as {
          localLightClusterContentKeys: LocalLightClusterContentKeys | null;
        }
      ).localLightClusterContentKeys = localLightClusterContentKeys;
    }

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
    ...(options.previousWorldTransforms === undefined
      ? {}
      : { previousWorldTransforms: options.previousWorldTransforms }),
    ...(options.instanceTints === undefined
      ? {}
      : { instanceTints: options.instanceTints }),
    sharedLayouts: options.sharedLayouts,
    materialLayout: options.materialLayout,
    lightLayout: options.lightLayout,
    sharedBindGroupCache: options.sharedBindGroupCache,
    lightBindGroupCache: options.lightBindGroupCache,
    standardLightShadowBindGroupCache:
      options.standardLightShadowBindGroupCache,
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
    ...(localLightClusterDescriptor === null
      ? {}
      : { localLightClusterDescriptor }),
    ...(options.localLightCookieResources === undefined ||
    options.localLightCookieResources === null
      ? {}
      : { localLightCookieResources: options.localLightCookieResources }),
    ...(options.transmissionSceneColorResources === undefined ||
    options.transmissionSceneColorResources === null
      ? {}
      : {
          transmissionSceneColorResources:
            options.transmissionSceneColorResources,
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
    if (result.resources.localLightClusters !== undefined) {
      options.reuse.localLightClusterBuffersCreated += 4;
    }
    const cacheEntry = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      pipelineKey: options.pipelineKey,
      materialLayoutKey,
      lightLayoutKey,
      standardMaterialIblBindGroupResourceKey,
      standardMaterialShadowReceiverResourceKey,
      transmissionSceneColorResourceKey,
      previousWorldTransformResourceKey:
        options.previousWorldTransforms?.resourceKey ?? null,
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
      localLightClusterParamsByteLength:
        result.resources.localLightClusters?.descriptor.params.byteLength ?? 0,
      localLightClusterCellsByteLength:
        result.resources.localLightClusters?.descriptor.cells.byteLength ?? 0,
      localLightClusterIndicesByteLength:
        result.resources.localLightClusters?.descriptor.indices.byteLength ?? 0,
      localLightClusterMetadataByteLength:
        result.resources.localLightClusters?.descriptor.metadata.byteLength ??
        0,
      localLightClusterContentKeys,
      localLightClusterResourceKey,
      localLightCookieTextureKey,
      localLightCookieSamplerKey,
      localLightCookieMatrixKey,
      viewDescriptorScratch,
      worldTransformDescriptorScratch,
      lightBufferDescriptorScratch,
      lightBufferDescriptorPlanScratch,
      result,
    };
    options.cache.current = cacheEntry;
    options.cache.byRoute?.set(routeCacheKey, cacheEntry);
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

function supportedPointShadowResourcesFromReceiver(
  resources: StandardFrameShadowReceiverResources | undefined,
): readonly LocalLightClusterSupportedPointShadowResource[] {
  const pointResources =
    resources !== undefined && isMultiShadowKind(resources.shadowKind)
      ? resources.pointShadowReceiverResources
      : resources?.shadowKind === "point" ||
          resources?.shadowKind === "point-array" ||
          resources?.depthTextureResources.resources.some(
            (resource) =>
              resource.viewDimension === "cube" ||
              (resource.viewDimension === "2d-array" &&
                resource.faceCount === 6),
          ) === true
        ? resources
        : undefined;

  if (
    pointResources?.matrixBufferResource.resource === null ||
    pointResources?.samplerResource.resource === null
  ) {
    return [];
  }

  const pointDepthResources =
    pointResources?.depthTextureResources.resources.filter(
      (resource) =>
        (resource.viewDimension === "cube" ||
          (resource.viewDimension === "2d-array" &&
            resource.faceCount === 6)) &&
        resource.allocation.resource !== null,
    ) ?? [];

  if (pointDepthResources.length === 0) {
    return [];
  }

  return pointDepthResources.map((resource, index) => ({
    shadowId: resource.shadowId,
    lightId: resource.lightId,
    matrixBaseIndex:
      resource.viewDimension === "2d-array"
        ? (resource.layerBaseIndex ?? index * 6)
        : index * 6,
    ...(resource.filterRadiusTexels === undefined
        ? {}
        : { filterRadiusTexels: resource.filterRadiusTexels }),
  }));
}

function supportedSpotShadowResourcesFromReceiver(
  resources: StandardFrameShadowReceiverResources | undefined,
): readonly LocalLightClusterSupportedSpotShadowResource[] {
  const spotResources =
    resources !== undefined && isMultiShadowKind(resources.shadowKind)
      ? resources.spotShadowReceiverResources
      : resources?.shadowKind === "spot" ||
          resources?.shadowKind === "spot-array"
        ? resources
        : undefined;

  if (
    spotResources?.matrixBufferResource.resource === null ||
    spotResources?.samplerResource.resource === null
  ) {
    return [];
  }

  const spotDepthResources =
    spotResources?.depthTextureResources.resources.filter(
      (resource) =>
        (resource.viewDimension === "2d" ||
          resource.viewDimension === "2d-array") &&
        resource.allocation.resource !== null,
    ) ?? [];

  if (spotDepthResources.length === 0) {
    return [];
  }

  return spotDepthResources.map((resource, index) => ({
    shadowId: resource.shadowId,
    lightId: resource.lightId,
    matrixBaseIndex:
      resource.viewDimension === "2d-array"
        ? (resource.layerBaseIndex ?? index)
        : index,
    ...(resource.filterRadiusTexels === undefined
      ? {}
      : { filterRadiusTexels: resource.filterRadiusTexels }),
  }));
}

function isMultiShadowKind(
  shadowKind: StandardFrameShadowReceiverResources["shadowKind"] | undefined,
): boolean {
  return (
    shadowKind === "multi" ||
    shadowKind === "multi-spot-array" ||
    shadowKind === "multi-point-array" ||
    shadowKind === "multi-spot-array-point-array"
  );
}

function requiresClusteredLocalLights(pipelineKey: string): boolean {
  return pipelineKey
    .split("|")
    .includes(CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE);
}

function createLocalLightClusterContentKeys(
  descriptor: LocalLightClusterDescriptor,
): LocalLightClusterContentKeys {
  return {
    params: typedArrayContentKey(descriptor.params),
    cells: typedArrayContentKey(descriptor.cells),
    indices: typedArrayContentKey(descriptor.indices),
    metadata: typedArrayContentKey(descriptor.metadata),
  };
}

function sameLocalLightClusterContentKeys(
  a: LocalLightClusterContentKeys,
  b: LocalLightClusterContentKeys,
): boolean {
  return (
    a.params === b.params &&
    a.cells === b.cells &&
    a.indices === b.indices &&
    a.metadata === b.metadata
  );
}

function typedArrayContentKey(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let hash = 2166136261;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }

  return `${view.byteLength}:${(hash >>> 0).toString(16)}`;
}

function createStandardAppFrameResourceCacheKey(input: {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly pipelineKey: string;
  readonly materialLayoutKey: string | null;
  readonly lightLayoutKey: string | null;
  readonly standardMaterialIblBindGroupResourceKey: string | null;
  readonly standardMaterialShadowReceiverResourceKey: string | null;
  readonly transmissionSceneColorResourceKey: string | null;
  readonly previousWorldTransformResourceKey: string | null;
  readonly localLightClusterResourceKey: string | null;
  readonly localLightCookieTextureKey: string | null;
  readonly localLightCookieSamplerKey: string | null;
  readonly localLightCookieMatrixKey: string | null;
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
}): string {
  return [
    input.meshKey,
    input.materialKey,
    input.pipelineKey,
    input.materialLayoutKey ?? "material-layout:none",
    input.lightLayoutKey ?? "light-layout:none",
    input.standardMaterialIblBindGroupResourceKey ?? "ibl:none",
    input.standardMaterialShadowReceiverResourceKey ?? "shadow:none",
    input.transmissionSceneColorResourceKey ?? "transmission:none",
    input.previousWorldTransformResourceKey ?? "previous-world:none",
    input.localLightClusterResourceKey ?? "local-light-cluster:none",
    input.localLightCookieTextureKey ?? "local-light-cookie-texture:none",
    input.localLightCookieSamplerKey ?? "local-light-cookie-sampler:none",
    input.localLightCookieMatrixKey ?? "local-light-cookie-matrix:none",
    `textures:${input.textureKeys.join(",")}`,
    `samplers:${input.samplerKeys.join(",")}`,
  ].join("|");
}

type PreparedStandardMaterialUse = PreparedAppMaterialResourceUse<
  | PreparedScalarStandardMaterialResource
  | PreparedBaseColorTexturedStandardMaterialResource
  | PreparedMetallicRoughnessTexturedStandardMaterialResource
  | PreparedNormalTexturedStandardMaterialResource
  | PreparedClearcoatTexturedStandardMaterialResource
  | PreparedClearcoatRoughnessTexturedStandardMaterialResource
  | PreparedTransmissionTexturedStandardMaterialResource
  | PreparedSheenColorTexturedStandardMaterialResource
  | PreparedSheenRoughnessTexturedStandardMaterialResource
  | PreparedIridescenceTexturedStandardMaterialResource
  | PreparedIridescenceThicknessTexturedStandardMaterialResource
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
          : options.material.clearcoatTexture !== null
            ? prepareClearcoatTexturedStandardMaterialResource({
                registry: options.assets,
                device: options.device as Parameters<
                  typeof prepareClearcoatTexturedStandardMaterialResource
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
            : options.material.clearcoatRoughnessTexture !== null
              ? prepareClearcoatRoughnessTexturedStandardMaterialResource({
                  registry: options.assets,
                  device: options.device as Parameters<
                    typeof prepareClearcoatRoughnessTexturedStandardMaterialResource
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
              : options.material.transmissionTexture !== null
                ? prepareTransmissionTexturedStandardMaterialResource({
                    registry: options.assets,
                    device: options.device as Parameters<
                      typeof prepareTransmissionTexturedStandardMaterialResource
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
                : options.material.sheenColorTexture !== null
                  ? prepareSheenColorTexturedStandardMaterialResource({
                      registry: options.assets,
                      device: options.device as Parameters<
                        typeof prepareSheenColorTexturedStandardMaterialResource
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
                  : options.material.sheenRoughnessTexture !== null
                    ? prepareSheenRoughnessTexturedStandardMaterialResource({
                        registry: options.assets,
                        device: options.device as Parameters<
                          typeof prepareSheenRoughnessTexturedStandardMaterialResource
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
                    : options.material.iridescenceTexture !== null
                      ? prepareIridescenceTexturedStandardMaterialResource({
                          registry: options.assets,
                          device: options.device as Parameters<
                            typeof prepareIridescenceTexturedStandardMaterialResource
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
                      : options.material.iridescenceThicknessTexture !== null
                        ? prepareIridescenceThicknessTexturedStandardMaterialResource(
                            {
                              registry: options.assets,
                              device: options.device as Parameters<
                                typeof prepareIridescenceThicknessTexturedStandardMaterialResource
                              >[0]["device"],
                              cache: options.preparedScalarMaterials,
                              handle: options.materialHandle,
                              material: options.material,
                              sourceVersion,
                              frame: options.frame,
                              pipelineKey: options.pipelineKey,
                              layout: options.materialLayout,
                              textures:
                                options.textureSamplerDependencies.textures,
                              samplers:
                                options.textureSamplerDependencies.samplers,
                            },
                          )
                        : options.material.occlusionTexture !== null ||
                            options.material.emissiveTexture !== null
                          ? prepareOcclusionEmissiveTexturedStandardMaterialResource(
                              {
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
                                textures:
                                  options.textureSamplerDependencies.textures,
                                samplers:
                                  options.textureSamplerDependencies.samplers,
                              },
                            )
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

function transmissionSceneColorResourceKeyFromResources(
  resources?: StandardFrameTransmissionSceneColorResources | null,
): string | null {
  return resources?.texture.resourceKey ?? null;
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
