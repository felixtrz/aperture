import type {
  MeshAsset,
  MeshVertexAttributeDescriptor,
} from "../mesh/index.js";
import {
  meshVertexFormatByteSize,
  meshVertexFormatForDecodedAccessor,
} from "./gltf-mesh-asset-vertex-formats.js";
import type { GltfMeshAttributeSource } from "./gltf-mesh-asset-vertex-stream-types.js";

interface SourceVertexStreamCandidate {
  readonly key: string;
  readonly sourceView: Uint8Array;
  readonly arrayStride: number;
  readonly attributes: MeshVertexAttributeDescriptor[];
}

export function createSourceVertexStreams(
  vertexCount: number,
  sources: readonly GltfMeshAttributeSource[],
): MeshAsset["vertexStreams"] | null {
  const candidates = new Map<string, SourceVertexStreamCandidate>();

  for (const source of sources) {
    const candidate = sourceVertexStreamCandidate(source);

    if (candidate === null) {
      return null;
    }

    const existing = candidates.get(candidate.key);
    if (existing === undefined) {
      candidates.set(candidate.key, candidate);
      continue;
    }

    if (
      existing.sourceView.buffer !== candidate.sourceView.buffer ||
      existing.sourceView.byteOffset !== candidate.sourceView.byteOffset ||
      existing.sourceView.byteLength !== candidate.sourceView.byteLength ||
      existing.arrayStride !== candidate.arrayStride
    ) {
      return null;
    }

    existing.attributes.push(...candidate.attributes);
  }

  const streams = [...candidates.values()].flatMap((candidate) =>
    createSourceVertexStream(vertexCount, candidate),
  );

  return streams.length === candidates.size ? streams : null;
}

function sourceVertexStreamCandidate(
  source: GltfMeshAttributeSource,
): SourceVertexStreamCandidate | null {
  const decoded = source.decoded;

  if (
    decoded.sourceView === undefined ||
    decoded.sourceBufferViewIndex === undefined ||
    decoded.sourceByteStride === undefined ||
    decoded.sourceViewByteOffset === undefined ||
    decoded.sourceElementByteSize === undefined
  ) {
    return null;
  }

  return {
    key: `${decoded.bufferIndex}:${decoded.sourceBufferViewIndex}:${decoded.sourceByteStride}`,
    sourceView: decoded.sourceView,
    arrayStride: decoded.sourceByteStride,
    attributes: [
      {
        semantic: decoded.semantic as MeshVertexAttributeDescriptor["semantic"],
        format: meshVertexFormatForDecodedAccessor(decoded),
        offset: decoded.sourceViewByteOffset,
      },
    ],
  };
}

function createSourceVertexStream(
  vertexCount: number,
  candidate: SourceVertexStreamCandidate,
): MeshAsset["vertexStreams"] {
  const attributes = [...candidate.attributes].sort(
    (left, right) => left.offset - right.offset,
  );
  let previousEnd = 0;
  let requiredByteLength = 0;

  for (const attribute of attributes) {
    if (attribute.offset < previousEnd) {
      return [];
    }

    const attributeEnd =
      attribute.offset + meshVertexFormatByteSize(attribute.format);

    if (attributeEnd > candidate.arrayStride) {
      return [];
    }

    previousEnd = attributeEnd;
    requiredByteLength = Math.max(
      requiredByteLength,
      vertexCount === 0
        ? 0
        : (vertexCount - 1) * candidate.arrayStride + attributeEnd,
    );
  }

  if (candidate.sourceView.byteLength < requiredByteLength) {
    return [];
  }

  return [
    {
      id: `gltf-source-buffer-view:${candidate.key}`,
      arrayStride: candidate.arrayStride,
      vertexCount,
      attributes,
      data: candidate.sourceView,
    },
  ];
}
