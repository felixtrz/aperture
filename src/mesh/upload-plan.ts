import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshSubmeshDescriptor,
  MeshVertexStreamDescriptor,
} from "./types.js";

export type MeshUploadUsageHint = "vertex" | "index";

export type MeshUploadPlanDiagnosticCode =
  | "meshUpload.missingVertexStreamData"
  | "meshUpload.invalidVertexStreamData"
  | "meshUpload.invalidIndexData";

export interface MeshUploadPlanDiagnostic {
  readonly code: MeshUploadPlanDiagnosticCode;
  readonly message: string;
  readonly streamId?: string;
  readonly field?: string;
}

export interface MeshVertexUploadDescriptor {
  readonly label: string;
  readonly streamId: string;
  readonly usage: MeshUploadUsageHint;
  readonly arrayStride: number;
  readonly vertexCount: number;
  readonly byteLength: number;
  readonly source: ArrayBufferView;
  readonly attributes: MeshVertexStreamDescriptor["attributes"];
}

export interface MeshIndexUploadDescriptor {
  readonly label: string;
  readonly usage: MeshUploadUsageHint;
  readonly format: MeshIndexBufferDescriptor["format"];
  readonly indexCount: number;
  readonly byteLength: number;
  readonly source: ArrayBufferView;
}

export interface MeshSubmeshUploadRange {
  readonly label: string;
  readonly topology: MeshSubmeshDescriptor["topology"];
  readonly materialSlot: number;
  readonly vertexStart: number;
  readonly vertexCount: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface MeshGpuUploadPlan {
  readonly label: string;
  readonly vertexStreams: readonly MeshVertexUploadDescriptor[];
  readonly indexBuffer?: MeshIndexUploadDescriptor;
  readonly submeshes: readonly MeshSubmeshUploadRange[];
}

export interface MeshGpuUploadPlanResult {
  readonly valid: boolean;
  readonly plan: MeshGpuUploadPlan | null;
  readonly diagnostics: readonly MeshUploadPlanDiagnostic[];
}

export function createMeshGpuUploadPlan(
  mesh: MeshAsset,
): MeshGpuUploadPlanResult {
  const diagnostics: MeshUploadPlanDiagnostic[] = [];
  const vertexStreams = mesh.vertexStreams.flatMap((stream) =>
    createVertexUploadDescriptor(mesh, stream, diagnostics),
  );
  const indexBuffer =
    mesh.indexBuffer === undefined
      ? undefined
      : createIndexUploadDescriptor(mesh, mesh.indexBuffer, diagnostics);
  const valid = diagnostics.length === 0;

  if (!valid) {
    return { valid, plan: null, diagnostics };
  }

  const plan: MeshGpuUploadPlan = {
    label: mesh.label,
    vertexStreams,
    submeshes: mesh.submeshes.map((submesh) => ({
      label: submesh.label,
      topology: submesh.topology,
      materialSlot: submesh.materialSlot,
      vertexStart: submesh.vertexStart,
      vertexCount: submesh.vertexCount,
      indexStart: submesh.indexStart,
      indexCount: submesh.indexCount,
    })),
  };

  if (indexBuffer !== undefined) {
    return { valid, plan: { ...plan, indexBuffer }, diagnostics };
  }

  return { valid, plan, diagnostics };
}

function createVertexUploadDescriptor(
  mesh: MeshAsset,
  stream: MeshVertexStreamDescriptor,
  diagnostics: MeshUploadPlanDiagnostic[],
): MeshVertexUploadDescriptor[] {
  const source = toArrayBufferView(stream.data);

  if (source === undefined) {
    diagnostics.push({
      code: "meshUpload.missingVertexStreamData",
      streamId: stream.id,
      field: "data",
      message: `Vertex stream '${stream.id}' is missing source data.`,
    });
    return [];
  }

  const expectedByteLength = stream.vertexCount * stream.arrayStride;

  if (
    !Number.isFinite(stream.arrayStride) ||
    stream.arrayStride <= 0 ||
    !Number.isInteger(stream.vertexCount) ||
    stream.vertexCount < 0 ||
    source.byteLength < expectedByteLength
  ) {
    diagnostics.push({
      code: "meshUpload.invalidVertexStreamData",
      streamId: stream.id,
      field: "data",
      message: `Vertex stream '${stream.id}' data does not cover ${stream.vertexCount} vertices at ${stream.arrayStride} bytes per vertex.`,
    });
    return [];
  }

  return [
    {
      label: `${mesh.label}/vertex:${stream.id}`,
      streamId: stream.id,
      usage: "vertex",
      arrayStride: stream.arrayStride,
      vertexCount: stream.vertexCount,
      byteLength: source.byteLength,
      source,
      attributes: stream.attributes,
    },
  ];
}

function createIndexUploadDescriptor(
  mesh: MeshAsset,
  indexBuffer: MeshIndexBufferDescriptor,
  diagnostics: MeshUploadPlanDiagnostic[],
): MeshIndexUploadDescriptor | undefined {
  const source = toArrayBufferView(indexBuffer.data);

  if (
    source === undefined ||
    source.byteLength === 0 ||
    (indexBuffer.format === "uint16" &&
      !(indexBuffer.data instanceof Uint16Array)) ||
    (indexBuffer.format === "uint32" &&
      !(indexBuffer.data instanceof Uint32Array))
  ) {
    diagnostics.push({
      code: "meshUpload.invalidIndexData",
      field: "indexBuffer.data",
      message: `Index buffer data is missing or incompatible with '${indexBuffer.format}' format.`,
    });
    return undefined;
  }

  return {
    label: `${mesh.label}/index`,
    usage: "index",
    format: indexBuffer.format,
    indexCount: indexBuffer.data.length,
    byteLength: source.byteLength,
    source,
  };
}

function toArrayBufferView(value: unknown): ArrayBufferView | undefined {
  return ArrayBuffer.isView(value) ? value : undefined;
}
