import type {
  MeshAsset,
  MeshValidationDiagnostic,
  MeshValidationReport,
} from "./types.js";

export function validateMeshAsset(mesh: MeshAsset): MeshValidationReport {
  const diagnostics: MeshValidationDiagnostic[] = [];
  const vertexCount = Math.max(
    0,
    ...mesh.vertexStreams.map((stream) => stream.vertexCount),
  );
  const indexCount = mesh.indexBuffer?.data.length ?? 0;

  if (!hasPositionAttribute(mesh)) {
    diagnostics.push({
      code: "mesh.missingPosition",
      message:
        "Renderable mesh assets must include a POSITION vertex attribute.",
    });
  }

  if (mesh.localAabb === undefined || mesh.localSphere === undefined) {
    diagnostics.push({
      code: "mesh.missingBounds",
      message: "Mesh asset is missing local AABB or bounding sphere data.",
    });
  }

  mesh.submeshes.forEach((submesh, submeshIndex) => {
    if (submesh.topology !== "triangle-list") {
      diagnostics.push({
        code: "mesh.unsupportedTopology",
        submesh: submeshIndex,
        message: `MVP mesh rendering supports triangle-list topology, not '${submesh.topology}'.`,
      });
    }

    if (mesh.materialSlots[submesh.materialSlot] === undefined) {
      diagnostics.push({
        code: "mesh.missingMaterialSlot",
        submesh: submeshIndex,
        message: `Submesh references missing material slot ${submesh.materialSlot}.`,
      });
    }

    if (
      submesh.vertexStart < 0 ||
      submesh.vertexCount < 0 ||
      submesh.vertexStart + submesh.vertexCount > vertexCount ||
      submesh.indexStart < 0 ||
      submesh.indexCount < 0 ||
      submesh.indexStart + submesh.indexCount > indexCount
    ) {
      diagnostics.push({
        code: "mesh.invalidSubmeshRange",
        submesh: submeshIndex,
        message: "Submesh vertex or index range is outside mesh buffer bounds.",
      });
    }
  });

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function hasPositionAttribute(mesh: MeshAsset): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === "POSITION"),
  );
}
