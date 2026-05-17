import { assetHandleKey, type MeshHandle } from "@aperture-engine/simulation";
import {
  createMeshGpuUploadPlan,
  type MeshAsset,
  type MeshUploadPlanDiagnostic,
} from "@aperture-engine/render";
import {
  createMeshUploadBufferDescriptors,
  type MeshUploadBufferDescriptorDiagnostic,
  type MeshUploadBufferDescriptorPlan,
} from "./mesh-buffer-descriptors.js";
import {
  createMeshGpuBuffers,
  type MeshGpuBufferCreationDiagnostic,
  type MeshGpuBufferResource,
} from "./mesh-buffer-resources.js";
import type { WebGpuBufferDeviceLike } from "./buffer.js";

export type PreparedMeshGpuResourceCacheStatus =
  | "created"
  | "reused"
  | "failed";

export interface PreparedMeshGpuResource {
  readonly cacheKey: string;
  readonly sourceMeshKey: string;
  readonly sourceVersion: number;
  readonly layoutKey: string;
  readonly mesh: MeshGpuBufferResource;
}

export interface PreparedMeshGpuResourceCache {
  readonly resources: Map<string, PreparedMeshGpuResource>;
}

export type PreparedMeshGpuResourceDiagnostic =
  | MeshUploadPlanDiagnostic
  | MeshUploadBufferDescriptorDiagnostic
  | MeshGpuBufferCreationDiagnostic;

export interface PrepareMeshGpuResourceOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly cache: PreparedMeshGpuResourceCache;
  readonly handle: MeshHandle;
  readonly mesh: MeshAsset;
  readonly sourceVersion: number;
}

export interface PrepareMeshGpuResourceResult {
  readonly valid: boolean;
  readonly status: PreparedMeshGpuResourceCacheStatus;
  readonly resource: PreparedMeshGpuResource | null;
  readonly diagnostics: readonly PreparedMeshGpuResourceDiagnostic[];
}

export function createPreparedMeshGpuResourceCache(): PreparedMeshGpuResourceCache {
  return { resources: new Map() };
}

export function prepareMeshGpuResource(
  options: PrepareMeshGpuResourceOptions,
): PrepareMeshGpuResourceResult {
  const sourceMeshKey = assetHandleKey(options.handle);
  const upload = createMeshGpuUploadPlan(options.mesh);

  if (!upload.valid || upload.plan === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: upload.diagnostics,
    };
  }

  const descriptors = createMeshUploadBufferDescriptors(upload.plan);

  if (!descriptors.valid || descriptors.plan === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: descriptors.diagnostics,
    };
  }

  const layoutKey = preparedMeshGpuResourceLayoutKey(descriptors.plan);
  const cacheKey = preparedMeshGpuResourceCacheKey({
    sourceMeshKey,
    sourceVersion: options.sourceVersion,
    layoutKey,
  });
  const cached = options.cache.resources.get(cacheKey);

  if (cached !== undefined) {
    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const mesh = createMeshGpuBuffers({
    device: options.device,
    plan: descriptors.plan,
  });

  if (!mesh.valid || mesh.resource === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: mesh.diagnostics,
    };
  }

  const resource: PreparedMeshGpuResource = {
    cacheKey,
    sourceMeshKey,
    sourceVersion: options.sourceVersion,
    layoutKey,
    mesh: mesh.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function preparedMeshGpuResourceCacheKey(input: {
  readonly sourceMeshKey: string;
  readonly sourceVersion: number;
  readonly layoutKey: string;
}): string {
  return [
    input.sourceMeshKey,
    `version:${input.sourceVersion}`,
    `layout:${input.layoutKey}`,
  ].join("|");
}

export function preparedMeshGpuResourceLayoutKey(
  plan: MeshUploadBufferDescriptorPlan,
): string {
  const vertexSegments = plan.vertexBuffers.map((vertex) =>
    [
      "vertex",
      vertex.streamId,
      `count:${vertex.vertexCount}`,
      `bytes:${vertex.descriptor.size}`,
      `usage:${vertex.descriptor.usage}`,
    ].join(":"),
  );
  const indexSegment =
    plan.indexBuffer === undefined
      ? "index:none"
      : [
          "index",
          plan.indexBuffer.format,
          `count:${plan.indexBuffer.indexCount}`,
          `bytes:${plan.indexBuffer.descriptor.size}`,
          `usage:${plan.indexBuffer.descriptor.usage}`,
        ].join(":");

  return ["mesh-upload-layout", ...vertexSegments, indexSegment].join("|");
}
