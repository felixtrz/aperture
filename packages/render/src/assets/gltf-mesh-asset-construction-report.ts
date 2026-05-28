import type { MeshAsset } from "../mesh/index.js";
import type {
  GltfMeshAssetConstructionArrayJsonSummary,
  GltfMeshAssetConstructionMeshJsonSummary,
  GltfMeshAssetConstructionReport,
  GltfMeshAssetConstructionReportJsonValue,
} from "./gltf-mesh-asset-construction-types.js";

export function gltfMeshAssetConstructionReportToJsonValue(
  report: GltfMeshAssetConstructionReport,
): GltfMeshAssetConstructionReportJsonValue {
  return {
    valid: report.valid,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : meshAssetToJsonValue(mesh.mesh),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshAssetConstructionReportToJson(
  report: GltfMeshAssetConstructionReport,
): string {
  return JSON.stringify(gltfMeshAssetConstructionReportToJsonValue(report));
}

function meshAssetToJsonValue(
  mesh: MeshAsset,
): GltfMeshAssetConstructionMeshJsonSummary {
  const { vertexStreams, indexBuffer, ...rest } = mesh;

  return {
    ...rest,
    vertexStreams: vertexStreams.map((stream) => ({
      ...stream,
      data: typedArrayToJsonSummary(stream.data),
    })),
    ...(indexBuffer === undefined
      ? {}
      : {
          indexBuffer: {
            format: indexBuffer.format,
            data: typedArrayToJsonSummary(indexBuffer.data),
          },
        }),
  };
}

function typedArrayToJsonSummary(
  array: Float32Array | Uint8Array | Uint16Array | Uint32Array,
): GltfMeshAssetConstructionArrayJsonSummary {
  if (array instanceof Float32Array) {
    return { type: "Float32Array", length: array.length };
  }

  if (array instanceof Uint8Array) {
    return { type: "Uint8Array", length: array.length };
  }

  if (array instanceof Uint16Array) {
    return { type: "Uint16Array", length: array.length };
  }

  return { type: "Uint32Array", length: array.length };
}
