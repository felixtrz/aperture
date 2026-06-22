import type { MeshAsset } from "../mesh/index.js";
import { packVertexAttributes } from "./gltf-mesh-asset-packed-streams.js";
import { createSourceVertexStreams } from "./gltf-mesh-asset-source-streams.js";
import type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";

export type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";
export {
  decodedAttributeByteSize,
  isSupportedMeshAttributeArray,
} from "./gltf-mesh-asset-vertex-formats.js";

export function createVertexStreams(
  vertexCount: number,
  sources: readonly GltfMeshAttributeSource[],
): MeshAsset["vertexStreams"] {
  const sourceStreams = createSourceVertexStreams(vertexCount, sources);

  if (sourceStreams !== null) {
    return sourceStreams;
  }

  const packed = packVertexAttributes(vertexCount, sources);

  return [
    {
      id: "gltf-primitive-interleaved",
      arrayStride: packed.strideBytes,
      vertexCount,
      attributes: packed.descriptors,
      data: packed.data,
    },
  ];
}
