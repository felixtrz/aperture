import type {
  MeshGpuUploadPlan,
  MeshIndexUploadDescriptor,
  MeshVertexUploadDescriptor,
} from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "../../gpu/buffer.js";

export const WEBGPU_BUFFER_USAGE_FLAGS = {
  COPY_DST: 0x8,
  INDEX: 0x10,
  VERTEX: 0x20,
  UNIFORM: 0x40,
  STORAGE: 0x80,
  INDIRECT: 0x100,
} as const;

export interface MeshUploadBufferUsageConfig {
  readonly vertex: number;
  readonly index: number;
}

export type MeshUploadBufferDescriptorDiagnosticCode =
  | "meshBuffer.nullPlan"
  | "meshBuffer.emptyVertexUploads"
  | "meshBuffer.invalidUsageFlags";

export interface MeshUploadBufferDescriptorDiagnostic {
  readonly code: MeshUploadBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface MeshVertexBufferDescriptorPlan {
  readonly streamId: string;
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: ArrayBufferView;
  readonly updateRanges?: MeshVertexUploadDescriptor["updateRanges"];
  readonly vertexCount: number;
}

export interface MeshIndexBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: ArrayBufferView;
  readonly updateRanges?: MeshIndexUploadDescriptor["updateRanges"];
  readonly format: MeshIndexUploadDescriptor["format"];
  readonly indexCount: number;
}

export interface MeshUploadBufferDescriptorPlan {
  readonly label: string;
  readonly vertexBuffers: readonly MeshVertexBufferDescriptorPlan[];
  readonly indexBuffer?: MeshIndexBufferDescriptorPlan;
}

export interface MeshUploadBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: MeshUploadBufferDescriptorPlan | null;
  readonly diagnostics: readonly MeshUploadBufferDescriptorDiagnostic[];
}

export const DEFAULT_MESH_UPLOAD_BUFFER_USAGE: MeshUploadBufferUsageConfig = {
  vertex: WEBGPU_BUFFER_USAGE_FLAGS.VERTEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
  index: WEBGPU_BUFFER_USAGE_FLAGS.INDEX | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
};

export function createMeshUploadBufferDescriptors(
  plan: MeshGpuUploadPlan | null,
  usage: MeshUploadBufferUsageConfig = DEFAULT_MESH_UPLOAD_BUFFER_USAGE,
): MeshUploadBufferDescriptorResult {
  const diagnostics: MeshUploadBufferDescriptorDiagnostic[] = [];

  if (plan === null) {
    diagnostics.push({
      code: "meshBuffer.nullPlan",
      message: "Cannot create mesh buffer descriptors from a null upload plan.",
    });
    return { valid: false, plan: null, diagnostics };
  }

  validateUsage(usage, diagnostics);

  if (plan.vertexStreams.length === 0) {
    diagnostics.push({
      code: "meshBuffer.emptyVertexUploads",
      field: "vertexStreams",
      message: "Mesh upload plan has no vertex streams to upload.",
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  const result: MeshUploadBufferDescriptorPlan = {
    label: plan.label,
    vertexBuffers: plan.vertexStreams.map((upload) =>
      createVertexBufferDescriptor(upload, usage.vertex),
    ),
  };

  if (plan.indexBuffer === undefined) {
    return { valid: true, plan: result, diagnostics };
  }

  return {
    valid: true,
    plan: {
      ...result,
      indexBuffer: createIndexBufferDescriptor(plan.indexBuffer, usage.index),
    },
    diagnostics,
  };
}

function createVertexBufferDescriptor(
  upload: MeshVertexUploadDescriptor,
  usage: number,
): MeshVertexBufferDescriptorPlan {
  return {
    streamId: upload.streamId,
    source: upload.source,
    ...(upload.updateRanges === undefined
      ? {}
      : { updateRanges: upload.updateRanges }),
    vertexCount: upload.vertexCount,
    descriptor: {
      label: upload.label,
      size: upload.byteLength,
      usage,
      initialData: upload.source,
    },
  };
}

function createIndexBufferDescriptor(
  upload: MeshIndexUploadDescriptor,
  usage: number,
): MeshIndexBufferDescriptorPlan {
  return {
    source: upload.source,
    ...(upload.updateRanges === undefined
      ? {}
      : { updateRanges: upload.updateRanges }),
    format: upload.format,
    indexCount: upload.indexCount,
    descriptor: {
      label: upload.label,
      size: upload.byteLength,
      usage,
      initialData: upload.source,
    },
  };
}

function validateUsage(
  usage: MeshUploadBufferUsageConfig,
  diagnostics: MeshUploadBufferDescriptorDiagnostic[],
): void {
  if (!isPositiveInteger(usage.vertex)) {
    diagnostics.push({
      code: "meshBuffer.invalidUsageFlags",
      field: "usage.vertex",
      message: "Vertex buffer usage flags must be a positive integer.",
    });
  }

  if (!isPositiveInteger(usage.index)) {
    diagnostics.push({
      code: "meshBuffer.invalidUsageFlags",
      field: "usage.index",
      message: "Index buffer usage flags must be a positive integer.",
    });
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
