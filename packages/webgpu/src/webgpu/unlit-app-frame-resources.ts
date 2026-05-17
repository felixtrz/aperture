import type {
  AssetRegistry,
  MaterialHandle,
  MeshHandle,
} from "@aperture-engine/simulation";
import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import { sameStringList, writeBufferData } from "./app-frame-resource-utils.js";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialResourceUse,
} from "./prepared-app-material-resource.js";
import {
  createUnlitFrameGpuResources,
  type CreateUnlitFrameGpuResourcesResult,
} from "./unlit-frame-resources.js";
import {
  prepareScalarUnlitMaterialResource,
  prepareTexturedUnlitMaterialResource,
  type PreparedScalarUnlitMaterialCache,
  type PreparedScalarUnlitMaterialResource,
  type PreparedTexturedUnlitMaterialResource,
} from "./prepared-unlit-material-cache.js";
import type { PreparedMaterialTextureSamplerDependencies } from "./prepared-material-texture-sampler-dependencies.js";
import {
  prepareAppMeshResource,
  type PreparedAppMeshResourceUse,
  type PreparedMeshGpuResourceCache,
} from "./prepared-app-mesh-resource.js";
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
  dynamicBufferWrites: number;
}

export type CreateUnlitAppFrameResourcesDiagnostic =
  | CreateUnlitFrameGpuResourcesResult["diagnostics"][number]
  | PreparedAppMaterialFallbackDiagnostic;

export interface CreateUnlitAppFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: CreateUnlitFrameGpuResourcesResult["resources"];
  readonly diagnostics: readonly CreateUnlitAppFrameResourcesDiagnostic[];
}

export function createOrReuseUnlitAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: UnlitAppFrameResourceCacheSlot;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly material: MaterialAsset | null;
  readonly materialHandle: MaterialHandle;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedScalarMaterials: PreparedScalarUnlitMaterialCache;
  readonly assets: AssetRegistry;
  readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: readonly UnlitBindGroupLayoutResource[];
  readonly reuse: UnlitAppFrameResourceReuseReport;
}): CreateUnlitAppFrameResourcesResult {
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
    sameStringList(
      cached.textureKeys,
      options.textureSamplerDependencies.textureKeys,
    ) &&
    sameStringList(
      cached.samplerKeys,
      options.textureSamplerDependencies.samplerKeys,
    ) &&
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

  const preparedMaterialFallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[] =
    [];
  const preparedMesh = preparePreparedScalarUnlitMesh(options);
  const preparedMaterial = preparePreparedUnlitMaterial(
    options,
    preparedMaterialFallbackDiagnostics,
  );
  const result = createUnlitFrameGpuResources({
    device: options.device as Parameters<
      typeof createUnlitFrameGpuResources
    >[0]["device"],
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
    layouts: options.layouts,
    textures: options.textureSamplerDependencies.textures,
    samplers: options.textureSamplerDependencies.samplers,
  });

  if (result.valid && result.resources !== null) {
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

    options.cache.current = {
      meshKey: options.meshKey,
      materialKey: options.materialKey,
      textureKeys: [...options.textureSamplerDependencies.textureKeys],
      samplerKeys: [...options.textureSamplerDependencies.samplerKeys],
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

  return appendPreparedMaterialFallbackDiagnostics(
    result,
    preparedMaterialFallbackDiagnostics,
  );
}

type PreparedScalarMaterialUse = PreparedAppMaterialResourceUse<
  PreparedScalarUnlitMaterialResource | PreparedTexturedUnlitMaterialResource
>;

function preparePreparedScalarUnlitMesh(options: {
  readonly device: unknown;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly frame?: number | undefined;
  readonly material: MaterialAsset | null;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
}): PreparedAppMeshResourceUse | null {
  if (
    options.mesh === null ||
    options.material === null ||
    options.material.kind !== "unlit" ||
    options.material.baseColorTexture !== null
  ) {
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

function preparePreparedUnlitMaterial(
  options: {
    readonly device: unknown;
    readonly assets: AssetRegistry;
    readonly preparedScalarMaterials: PreparedScalarUnlitMaterialCache;
    readonly materialHandle: MaterialHandle;
    readonly material: MaterialAsset | null;
    readonly materialKey: string;
    readonly sourceMaterialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly layouts: readonly UnlitBindGroupLayoutResource[];
    readonly textureSamplerDependencies: PreparedMaterialTextureSamplerDependencies;
  },
  fallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[],
): PreparedScalarMaterialUse | null {
  if (options.material === null || options.material.kind !== "unlit") {
    return null;
  }

  const sourceVersion = sourceVersionFromAssetKey(
    options.materialKey,
    options.sourceMaterialKey,
  );

  if (sourceVersion === null) {
    return null;
  }

  const layout =
    options.layouts.find((candidate) => candidate.group === 2) ?? null;
  const result =
    options.material.baseColorTexture === null
      ? prepareScalarUnlitMaterialResource({
          registry: options.assets,
          device: options.device as Parameters<
            typeof prepareScalarUnlitMaterialResource
          >[0]["device"],
          cache: options.preparedScalarMaterials,
          handle: options.materialHandle,
          material: options.material,
          sourceVersion,
          frame: options.frame,
          pipelineKey: options.pipelineKey,
          layout,
        })
      : prepareTexturedUnlitMaterialResource({
          registry: options.assets,
          device: options.device as Parameters<
            typeof prepareTexturedUnlitMaterialResource
          >[0]["device"],
          cache: options.preparedScalarMaterials,
          handle: options.materialHandle,
          material: options.material,
          sourceVersion,
          frame: options.frame,
          pipelineKey: options.pipelineKey,
          layout,
          textures: options.textureSamplerDependencies.textures,
          samplers: options.textureSamplerDependencies.samplers,
        });

  if (
    result.valid &&
    result.resource !== null &&
    (result.status === "created" || result.status === "reused")
  ) {
    return { status: result.status, resource: result.resource };
  }

  const diagnostic = createPreparedAppMaterialFallbackDiagnostic({
    materialFamily: "unlit",
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
  result: CreateUnlitFrameGpuResourcesResult,
  diagnostics: readonly PreparedAppMaterialFallbackDiagnostic[],
): CreateUnlitAppFrameResourcesResult {
  return diagnostics.length === 0
    ? result
    : {
        ...result,
        diagnostics: [...result.diagnostics, ...diagnostics],
      };
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
