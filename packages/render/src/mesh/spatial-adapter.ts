import type {
  SpatialMeshAttribute,
  SpatialMeshSubmesh,
  SpatialTriangleMesh,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshVertexAttributeDescriptor,
  MeshVertexFormat,
  MeshVertexSemantic,
  MeshVertexStreamDescriptor,
} from "./types.js";

export type MeshSpatialAdapterDiagnosticCode =
  | "spatial.mesh.missing-position"
  | "spatial.mesh.unsupported-position-format"
  | "spatial.mesh.unsupported-normal-format"
  | "spatial.mesh.unsupported-uv-format"
  | "spatial.mesh.unsupported-index-format"
  | "spatial.mesh.unsupported-topology";

export interface MeshSpatialAdapterDiagnostic {
  readonly code: MeshSpatialAdapterDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly suggestedFix?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface MeshSpatialAdapterReport {
  readonly mesh: SpatialTriangleMesh | null;
  readonly diagnostics: readonly MeshSpatialAdapterDiagnostic[];
}

export function createSpatialTriangleMeshFromMeshAsset(
  mesh: MeshAsset,
): MeshSpatialAdapterReport {
  const diagnostics: MeshSpatialAdapterDiagnostic[] = [];
  const position = findAttribute(mesh, "POSITION");

  if (position === null) {
    diagnostics.push({
      code: "spatial.mesh.missing-position",
      severity: "error",
      message: `Mesh '${mesh.label}' cannot be queried because it has no POSITION attribute.`,
      suggestedFix:
        "Provide a float32x3 POSITION stream before building spatial queries.",
    });
    return { mesh: null, diagnostics };
  }

  if (position.attribute.format !== "float32x3") {
    diagnostics.push({
      code: "spatial.mesh.unsupported-position-format",
      severity: "error",
      message: `Mesh '${mesh.label}' POSITION format '${position.attribute.format}' is not supported for CPU spatial queries.`,
      suggestedFix:
        "Decode or convert POSITION data to float32x3 before building a mesh BVH.",
    });
    return { mesh: null, diagnostics };
  }

  const normals = optionalAttribute(mesh, "NORMAL", "float32x3", diagnostics);
  const uvs = optionalAttribute(mesh, "TEXCOORD_0", "float32x2", diagnostics);
  const unsupportedSubmesh = mesh.submeshes.find(
    (submesh) => submesh.topology !== "triangle-list",
  );

  if (unsupportedSubmesh !== undefined) {
    diagnostics.push({
      code: "spatial.mesh.unsupported-topology",
      severity: "error",
      message: `Mesh '${mesh.label}' submesh '${unsupportedSubmesh.label}' uses topology '${unsupportedSubmesh.topology}', but CPU mesh queries currently support triangle-list only.`,
      suggestedFix:
        "Use triangle-list geometry or add a topology-specific spatial query adapter.",
    });
    return { mesh: null, diagnostics };
  }

  const indices = adaptIndexBuffer(mesh.indexBuffer, mesh.label, diagnostics);

  if (indices === null) {
    return { mesh: null, diagnostics };
  }

  const spatialMesh: SpatialTriangleMesh = {
    positions: adaptAttribute(position.stream, position.attribute),
    vertexCount: position.stream.vertexCount,
    ...(normals === null ? {} : { normals }),
    ...(uvs === null ? {} : { uvs }),
    submeshes: mesh.submeshes.map(adaptSubmesh),
  };

  if (indices !== undefined) {
    return { mesh: { ...spatialMesh, indices }, diagnostics };
  }

  return { mesh: spatialMesh, diagnostics };
}

function findAttribute(
  mesh: MeshAsset,
  semantic: MeshVertexSemantic,
): {
  readonly stream: MeshVertexStreamDescriptor;
  readonly attribute: MeshVertexAttributeDescriptor;
} | null {
  for (const stream of mesh.vertexStreams) {
    const attribute = stream.attributes.find(
      (candidate) => candidate.semantic === semantic,
    );

    if (attribute !== undefined) {
      return { stream, attribute };
    }
  }

  return null;
}

function optionalAttribute(
  mesh: MeshAsset,
  semantic: MeshVertexSemantic,
  expectedFormat: MeshVertexFormat,
  diagnostics: MeshSpatialAdapterDiagnostic[],
): SpatialMeshAttribute | null {
  const attribute = findAttribute(mesh, semantic);

  if (attribute === null) {
    return null;
  }

  if (attribute.attribute.format !== expectedFormat) {
    const label =
      semantic === "NORMAL"
        ? "spatial.mesh.unsupported-normal-format"
        : "spatial.mesh.unsupported-uv-format";

    diagnostics.push({
      code: label,
      severity: "warning",
      message: `Mesh '${mesh.label}' ${semantic} format '${attribute.attribute.format}' is ignored by CPU spatial queries.`,
      suggestedFix: `Use ${expectedFormat} ${semantic} data when query results need this attribute.`,
    });
    return null;
  }

  return adaptAttribute(attribute.stream, attribute.attribute);
}

function adaptAttribute(
  stream: MeshVertexStreamDescriptor,
  attribute: MeshVertexAttributeDescriptor,
): SpatialMeshAttribute {
  return {
    data: stream.data,
    offset: attribute.offset / bytesPerComponent(attribute.format),
    stride: stream.arrayStride / bytesPerComponent(attribute.format),
  };
}

function adaptIndexBuffer(
  indexBuffer: MeshIndexBufferDescriptor | undefined,
  meshLabel: string,
  diagnostics: MeshSpatialAdapterDiagnostic[],
): SpatialTriangleMesh["indices"] | null | undefined {
  if (indexBuffer === undefined) {
    return undefined;
  }

  if (indexBuffer.format !== "uint16" && indexBuffer.format !== "uint32") {
    diagnostics.push({
      code: "spatial.mesh.unsupported-index-format",
      severity: "error",
      message: `Mesh '${meshLabel}' index format '${indexBuffer.format}' is not supported for CPU spatial queries.`,
      suggestedFix: "Use uint16 or uint32 index data.",
    });
    return null;
  }

  return indexBuffer.indexCount === undefined
    ? indexBuffer.data
    : indexBuffer.data.subarray(0, indexBuffer.indexCount);
}

function adaptSubmesh(
  submesh: MeshAsset["submeshes"][number],
): SpatialMeshSubmesh {
  return {
    label: submesh.label,
    topology: "triangle-list",
    materialSlot: submesh.materialSlot,
    vertexStart: submesh.vertexStart,
    vertexCount: submesh.vertexCount,
    indexStart: submesh.indexStart,
    indexCount: submesh.indexCount,
  };
}

function bytesPerComponent(format: MeshVertexFormat): number {
  return format.startsWith("float32") ? 4 : format.startsWith("uint16") ? 2 : 1;
}
