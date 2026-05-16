import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import type {
  MeshIndexBufferDescriptorPlan,
  MeshUploadBufferDescriptorPlan,
  MeshVertexBufferDescriptorPlan,
} from "./mesh-buffer-descriptors.js";
import {
  meshBufferResourceKey,
  meshIndexBufferResourceKey,
  meshVertexBufferResourceKey,
} from "./resource-keys.js";

export type MeshGpuBufferCreationDiagnosticCode =
  | "meshGpuBuffer.nullDescriptorPlan"
  | "meshGpuBuffer.vertexCreationFailed"
  | "meshGpuBuffer.indexCreationFailed";

export interface MeshGpuBufferCreationDiagnostic {
  readonly code: MeshGpuBufferCreationDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface MeshGpuVertexBufferResource {
  readonly streamId: string;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly vertexCount: number;
}

export interface MeshGpuIndexBufferResource {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: MeshIndexBufferDescriptorPlan["format"];
  readonly indexCount: number;
}

export interface MeshGpuBufferResource {
  readonly resourceKey: string;
  readonly vertexCount: number;
  readonly vertexBuffers: readonly MeshGpuVertexBufferResource[];
  readonly indexBuffer?: MeshGpuIndexBufferResource;
}

export interface CreateMeshGpuBuffersOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly plan: MeshUploadBufferDescriptorPlan | null;
}

export interface CreateMeshGpuBuffersResult {
  readonly valid: boolean;
  readonly resource: MeshGpuBufferResource | null;
  readonly diagnostics: readonly MeshGpuBufferCreationDiagnostic[];
}

export function createMeshGpuBuffers(
  options: CreateMeshGpuBuffersOptions,
): CreateMeshGpuBuffersResult {
  const diagnostics: MeshGpuBufferCreationDiagnostic[] = [];

  if (options.plan === null) {
    diagnostics.push({
      code: "meshGpuBuffer.nullDescriptorPlan",
      message: "Cannot create mesh GPU buffers from a null descriptor plan.",
    });
    return { valid: false, resource: null, diagnostics };
  }

  const plan = options.plan;
  const resourceKey = meshBufferResourceKey(plan.label);
  const vertexBuffers = plan.vertexBuffers.flatMap((vertex) =>
    createVertexBufferResource(options.device, plan.label, vertex, diagnostics),
  );
  const indexBuffer =
    plan.indexBuffer === undefined
      ? undefined
      : createIndexBufferResource(
          options.device,
          plan.label,
          plan.indexBuffer,
          diagnostics,
        );
  const resource: MeshGpuBufferResource = {
    resourceKey,
    vertexCount: meshVertexCount(vertexBuffers),
    vertexBuffers,
  };

  if (indexBuffer !== undefined) {
    return {
      valid: diagnostics.length === 0,
      resource: { ...resource, indexBuffer },
      diagnostics,
    };
  }

  return {
    valid: diagnostics.length === 0,
    resource,
    diagnostics,
  };
}

function createVertexBufferResource(
  device: WebGpuBufferDeviceLike,
  meshLabel: string,
  vertex: MeshVertexBufferDescriptorPlan,
  diagnostics: MeshGpuBufferCreationDiagnostic[],
): readonly MeshGpuVertexBufferResource[] {
  const resourceKey = meshVertexBufferResourceKey(meshLabel, vertex.streamId);
  const result = createWebGpuBuffer({
    device,
    descriptor: vertex.descriptor,
  });

  if (!result.ok) {
    diagnostics.push({
      code: "meshGpuBuffer.vertexCreationFailed",
      reason: result.reason,
      resourceKey,
      message: `Failed to create vertex buffer '${resourceKey}': ${result.message}`,
    });
    return [];
  }

  return [
    {
      streamId: vertex.streamId,
      resourceKey,
      buffer: result.buffer,
      vertexCount: vertex.vertexCount,
    },
  ];
}

function createIndexBufferResource(
  device: WebGpuBufferDeviceLike,
  meshLabel: string,
  index: MeshIndexBufferDescriptorPlan,
  diagnostics: MeshGpuBufferCreationDiagnostic[],
): MeshGpuIndexBufferResource | undefined {
  const resourceKey = meshIndexBufferResourceKey(meshLabel);
  const result = createWebGpuBuffer({
    device,
    descriptor: index.descriptor,
  });

  if (!result.ok) {
    diagnostics.push({
      code: "meshGpuBuffer.indexCreationFailed",
      reason: result.reason,
      resourceKey,
      message: `Failed to create index buffer '${resourceKey}': ${result.message}`,
    });
    return undefined;
  }

  return {
    resourceKey,
    buffer: result.buffer,
    format: index.format,
    indexCount: index.indexCount,
  };
}

function meshVertexCount(
  vertexBuffers: readonly MeshGpuVertexBufferResource[],
): number {
  if (vertexBuffers.length === 0) {
    return 0;
  }

  return Math.min(...vertexBuffers.map((buffer) => buffer.vertexCount));
}
