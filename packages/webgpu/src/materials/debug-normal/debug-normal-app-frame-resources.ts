import {
  assetHandleKey,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import type {
  DebugNormalMaterialAsset,
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import {
  writeVersionedBufferData,
  type DirtyUploadOutcome,
  type VersionedUploadStamp,
} from "../../app/app-frame-resource-utils.js";
import type { BindGroupResourceCache } from "../../gpu/bind-group-resource-cache.js";
import type { DebugNormalMaterialBindGroupLayoutResource } from "./debug-normal-bind-group.js";
import {
  createDebugNormalFrameGpuResources,
  type CreateDebugNormalFrameGpuResourcesResult,
} from "./debug-normal-frame-resources.js";
import {
  prepareAppMeshResource,
  type PreparedAppMeshResourceUse,
  type PreparedMeshGpuResourceCache,
} from "../../resources/meshes/prepared-app-mesh-resource.js";
import {
  createPreparedAppMaterialFallbackDiagnostic,
  recordPreparedAppMaterialResourceUse,
  type PreparedAppMaterialFallbackDiagnostic,
  type PreparedAppMaterialResourceUse,
} from "../core/prepared-app-material-resource.js";
import {
  prepareDebugNormalMaterialResource,
  type PreparedDebugNormalMaterialCache,
  type PreparedDebugNormalMaterialResource,
} from "./prepared-debug-normal-material-cache.js";
import type {
  UnlitBindGroupLayoutResource,
  UnlitBindGroupResource,
} from "../unlit/unlit-bind-group.js";
import {
  createViewUniformBufferDescriptorScratch,
  writeViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorScratch,
} from "../../resources/views/view-uniform-buffer.js";
import {
  createWorldTransformBufferDescriptorScratch,
  writeWorldTransformBufferDescriptor,
  type WorldTransformBufferDescriptorScratch,
  type WorldTransformGpuBufferResource,
} from "../../resources/transforms/world-transform-buffer.js";

export interface CachedDebugNormalAppFrameResources {
  readonly meshKey: string;
  readonly materialKey: string;
  readonly previousWorldTransformResourceKey: string | null;
  readonly viewByteLength: number;
  readonly worldTransformByteLength: number;
  readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
  readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
  /** Last uploaded contentVersion per dynamic buffer (AI-64/AI-65). */
  readonly worldTransformUploadStamp: VersionedUploadStamp;
  readonly viewUploadStamp: VersionedUploadStamp;
  result: CreateDebugNormalFrameGpuResourcesResult;
}

export interface DebugNormalAppFrameResourceCacheSlot {
  current: CachedDebugNormalAppFrameResources | null;
}

export interface DebugNormalAppFrameResourceReuseReport {
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

export type CreateDebugNormalAppFrameResourcesDiagnostic =
  | CreateDebugNormalFrameGpuResourcesResult["diagnostics"][number]
  | PreparedAppMaterialFallbackDiagnostic;

export interface CreateDebugNormalAppFrameResourcesResult {
  readonly valid: boolean;
  readonly resources: CreateDebugNormalFrameGpuResourcesResult["resources"];
  readonly diagnostics: readonly CreateDebugNormalAppFrameResourcesDiagnostic[];
}

export function createOrReuseDebugNormalAppFrameResources(options: {
  readonly device: unknown;
  readonly cache: DebugNormalAppFrameResourceCacheSlot;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly material: DebugNormalMaterialAsset | null;
  readonly materialHandle: MaterialHandle;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly assets: AssetRegistry;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly previousWorldTransforms?: WorldTransformGpuBufferResource | null;
  readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
  readonly materialLayout: DebugNormalMaterialBindGroupLayoutResource | null;
  readonly bindGroupCache?:
    | BindGroupResourceCache<UnlitBindGroupResource>
    | undefined;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
  readonly preparedDebugNormalMaterials: PreparedDebugNormalMaterialCache;
  readonly reuse: DebugNormalAppFrameResourceReuseReport;
}): CreateDebugNormalAppFrameResourcesResult {
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

  // AI-64/AI-65: dirty-range/skip upload outcomes for accounting. Holder
  // objects: TS flow analysis cannot see the closure assignment ordering, so
  // plain lets would narrow back to "full" at the use sites.
  const worldTransformUpload: { value: DirtyUploadOutcome } = {
    value: "full",
  };
  const viewUniformUpload: { value: DirtyUploadOutcome } = { value: "full" };
  const writeCachedWorldTransformBuffer = (): boolean => {
    if (cached === null || cached.result.resources === null) {
      return false;
    }

    const outcome = writeVersionedBufferData(
      options.device,
      cached.result.resources.worldTransforms.buffer,
      transformDescriptor.plan?.source ?? options.worldTransforms.data,
      options.worldTransforms,
      cached.worldTransformUploadStamp,
    );

    if (outcome === false) {
      return false;
    }

    worldTransformUpload.value = outcome;
    return true;
  };
  const writeCachedViewUniformBuffer = (): boolean => {
    if (cached === null || cached.result.resources === null) {
      return false;
    }

    const outcome = writeVersionedBufferData(
      options.device,
      cached.result.resources.viewUniform.buffer,
      viewDescriptor.plan?.source ?? options.viewUniforms.data,
      options.viewUniforms,
      cached.viewUploadStamp,
    );

    if (outcome === false) {
      return false;
    }

    viewUniformUpload.value = outcome;
    return true;
  };

  if (
    cached !== null &&
    cached.meshKey === options.meshKey &&
    cached.materialKey === options.materialKey &&
    cached.previousWorldTransformResourceKey ===
      (options.previousWorldTransforms?.resourceKey ?? null) &&
    cached.result.resources !== null &&
    viewDescriptor.plan !== null &&
    transformDescriptor.plan !== null &&
    cached.viewByteLength === viewDescriptor.plan.source.byteLength &&
    cached.worldTransformByteLength ===
      transformDescriptor.plan.source.byteLength &&
    writeCachedViewUniformBuffer() &&
    writeCachedWorldTransformBuffer()
  ) {
    options.reuse.meshBuffersReused += 1;
    options.reuse.materialBuffersReused += 1;
    options.reuse.bindGroupsReused += cached.result.resources.bindGroups.length;
    options.reuse.dynamicBufferWrites +=
      2 -
      (worldTransformUpload.value === "skipped" ? 1 : 0) -
      (viewUniformUpload.value === "skipped" ? 1 : 0);

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
  const preparedMesh = preparePreparedDebugNormalMesh(options);
  const preparedMaterial = preparePreparedDebugNormalMaterial(
    options,
    preparedMaterialFallbackDiagnostics,
  );
  const result = createDebugNormalFrameGpuResources({
    device: options.device as Parameters<
      typeof createDebugNormalFrameGpuResources
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
    ...(options.previousWorldTransforms === undefined
      ? {}
      : { previousWorldTransforms: options.previousWorldTransforms }),
    sharedLayouts: options.sharedLayouts,
    materialLayout: options.materialLayout,
    bindGroupCache: options.bindGroupCache,
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
      previousWorldTransformResourceKey:
        options.previousWorldTransforms?.resourceKey ?? null,
      viewByteLength:
        viewDescriptor.plan?.source.byteLength ??
        options.viewUniforms.data.byteLength,
      worldTransformByteLength:
        transformDescriptor.plan?.source.byteLength ??
        options.worldTransforms.data.byteLength,
      viewDescriptorScratch,
      worldTransformDescriptorScratch,
      worldTransformUploadStamp: {
        version: options.worldTransforms.contentVersion,
      },
      viewUploadStamp: { version: options.viewUniforms.contentVersion },
      result,
    };
  }

  return appendPreparedMaterialFallbackDiagnostics(
    result,
    preparedMaterialFallbackDiagnostics,
  );
}

function preparePreparedDebugNormalMesh(options: {
  readonly device: unknown;
  readonly mesh: MeshAsset | null;
  readonly meshHandle: MeshHandle;
  readonly meshKey: string;
  readonly frame?: number | undefined;
  readonly material: DebugNormalMaterialAsset | null;
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

type PreparedDebugNormalAppMaterialResourceUse =
  PreparedAppMaterialResourceUse<PreparedDebugNormalMaterialResource>;

function preparePreparedDebugNormalMaterial(
  options: {
    readonly device: unknown;
    readonly assets: AssetRegistry;
    readonly material: DebugNormalMaterialAsset | null;
    readonly materialHandle: MaterialHandle;
    readonly sourceMaterialKey: string;
    readonly materialKey: string;
    readonly frame?: number | undefined;
    readonly pipelineKey: string;
    readonly materialLayout: DebugNormalMaterialBindGroupLayoutResource | null;
    readonly preparedDebugNormalMaterials: PreparedDebugNormalMaterialCache;
  },
  fallbackDiagnostics: PreparedAppMaterialFallbackDiagnostic[],
): PreparedDebugNormalAppMaterialResourceUse | null {
  if (options.material === null) {
    return null;
  }

  const sourceVersion = parseSourceAssetVersion(
    options.materialKey,
    options.sourceMaterialKey,
  );

  if (sourceVersion === null) {
    return null;
  }

  const result = prepareDebugNormalMaterialResource({
    registry: options.assets,
    device: options.device as Parameters<
      typeof prepareDebugNormalMaterialResource
    >[0]["device"],
    cache: options.preparedDebugNormalMaterials,
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
    materialFamily: "debug-normal",
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
  result: CreateDebugNormalFrameGpuResourcesResult,
  diagnostics: readonly PreparedAppMaterialFallbackDiagnostic[],
): CreateDebugNormalAppFrameResourcesResult {
  return diagnostics.length === 0
    ? result
    : {
        ...result,
        diagnostics: [...result.diagnostics, ...diagnostics],
      };
}

function parseSourceAssetVersion(
  resourceKey: string,
  sourceKey: string,
): number | null {
  const prefix = `${sourceKey}@`;

  if (!resourceKey.startsWith(prefix)) {
    return null;
  }

  const version = Number(resourceKey.slice(prefix.length));

  return Number.isInteger(version) && version >= 0 ? version : null;
}
