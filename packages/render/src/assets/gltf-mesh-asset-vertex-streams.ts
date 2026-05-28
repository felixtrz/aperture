import type { GltfDecodedAccessor } from "./gltf-accessor-decoding.js";
import type {
  MeshAsset,
  MeshVertexAttributeDescriptor,
} from "../mesh/index.js";

export interface GltfMeshAttributeSource {
  readonly decoded: GltfDecodedAccessor;
  readonly offset: number;
}

interface SourceVertexStreamCandidate {
  readonly key: string;
  readonly sourceView: Uint8Array;
  readonly arrayStride: number;
  readonly attributes: MeshVertexAttributeDescriptor[];
}

export function createVertexStreams(
  vertexCount: number,
  sources: readonly GltfMeshAttributeSource[],
): MeshAsset["vertexStreams"] {
  const sourceStreams = createSourceVertexStreams(vertexCount, sources);

  if (sourceStreams !== null) {
    return sourceStreams;
  }

  const packed = packAttributes(vertexCount, sources);

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

function createSourceVertexStreams(
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

function packAttributes(
  vertexCount: number,
  sources: readonly GltfMeshAttributeSource[],
): {
  readonly data: Float32Array | Uint16Array | Uint8Array;
  readonly descriptors: readonly MeshVertexAttributeDescriptor[];
  readonly strideBytes: number;
} {
  const strideBytes = sources.reduce(
    (sum, source) => sum + decodedAttributeByteSize(source.decoded),
    0,
  );
  const descriptors: MeshVertexAttributeDescriptor[] = [];
  const floatOnly = sources.every(
    (source) => source.decoded.array instanceof Float32Array,
  );

  for (const source of sources) {
    descriptors.push({
      semantic: source.decoded
        .semantic as MeshVertexAttributeDescriptor["semantic"],
      format: meshVertexFormatForDecodedAccessor(source.decoded),
      offset: source.offset,
    });
  }

  if (sources.length === 1) {
    const source = sources[0];
    if (
      source !== undefined &&
      source.offset === 0 &&
      (source.decoded.array instanceof Float32Array ||
        source.decoded.array instanceof Uint8Array ||
        source.decoded.array instanceof Uint16Array) &&
      source.decoded.array.byteLength >= vertexCount * strideBytes
    ) {
      return { data: source.decoded.array, descriptors, strideBytes };
    }
  }

  if (floatOnly) {
    const strideFloats = strideBytes / 4;
    const data = new Float32Array(vertexCount * strideFloats);

    for (const source of sources) {
      for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const targetFloatOffset = vertex * strideFloats + source.offset / 4;

        for (
          let component = 0;
          component < source.decoded.itemSize;
          component += 1
        ) {
          data[targetFloatOffset + component] =
            source.decoded.array[
              vertex * source.decoded.itemSize + component
            ] ?? 0;
        }
      }
    }

    return { data, descriptors, strideBytes };
  }

  const data = new Uint8Array(vertexCount * strideBytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (const source of sources) {
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const targetByteOffset = vertex * strideBytes + source.offset;

      for (
        let component = 0;
        component < source.decoded.itemSize;
        component += 1
      ) {
        writeDecodedComponent(
          view,
          targetByteOffset,
          source,
          vertex,
          component,
        );
      }
    }
  }

  return { data, descriptors, strideBytes };
}

export function isSupportedMeshAttributeArray(
  decoded: GltfDecodedAccessor,
): boolean {
  if (decoded.semantic === "JOINTS_0") {
    return (
      (decoded.expectedFormat === "uint8x4" &&
        decoded.array instanceof Uint8Array &&
        decoded.itemSize === 4) ||
      (decoded.expectedFormat === "uint16x4" &&
        decoded.array instanceof Uint16Array &&
        decoded.itemSize === 4)
    );
  }

  if (decoded.semantic === "WEIGHTS_0") {
    if (decoded.expectedFormat === "unorm8x4") {
      return decoded.array instanceof Uint8Array && decoded.itemSize === 4;
    }
    if (decoded.expectedFormat === "unorm16x4") {
      return decoded.array instanceof Uint16Array && decoded.itemSize === 4;
    }

    return decoded.array instanceof Float32Array && decoded.itemSize === 4;
  }

  if (decoded.semantic === "COLOR_0") {
    if (decoded.expectedFormat === "unorm8x4") {
      return decoded.array instanceof Uint8Array && decoded.itemSize === 4;
    }
    if (decoded.expectedFormat === "unorm16x4") {
      return decoded.array instanceof Uint16Array && decoded.itemSize === 4;
    }

    return (
      decoded.array instanceof Float32Array &&
      (decoded.itemSize === 3 || decoded.itemSize === 4)
    );
  }

  return decoded.array instanceof Float32Array;
}

export function decodedAttributeByteSize(decoded: GltfDecodedAccessor): number {
  return decoded.itemSize * decodedComponentByteSize(decoded);
}

function decodedComponentByteSize(decoded: GltfDecodedAccessor): 1 | 2 | 4 {
  if (decoded.array instanceof Uint8Array) {
    return 1;
  }

  if (decoded.array instanceof Uint16Array) {
    return 2;
  }

  return 4;
}

function meshVertexFormatByteSize(
  format: MeshVertexAttributeDescriptor["format"],
): number {
  switch (format) {
    case "uint8x4":
    case "unorm8x4":
      return 4;
    case "uint16x4":
    case "unorm16x4":
    case "float32x2":
      return 8;
    case "float32x3":
      return 12;
    case "float32x4":
      return 16;
  }
}

function meshVertexFormatForDecodedAccessor(
  decoded: GltfDecodedAccessor,
): MeshVertexAttributeDescriptor["format"] {
  if (decoded.expectedFormat === "unorm8x4") {
    return "unorm8x4";
  }

  if (decoded.expectedFormat === "unorm16x4") {
    return "unorm16x4";
  }

  if (decoded.semantic === "JOINTS_0") {
    return decoded.expectedFormat === "uint8x4" ? "uint8x4" : "uint16x4";
  }

  return decoded.itemSize === 2
    ? "float32x2"
    : decoded.itemSize === 4
      ? "float32x4"
      : "float32x3";
}

function writeDecodedComponent(
  view: DataView,
  targetByteOffset: number,
  source: GltfMeshAttributeSource,
  vertex: number,
  component: number,
): void {
  const sourceIndex = vertex * source.decoded.itemSize + component;
  const byteOffset =
    targetByteOffset + component * decodedComponentByteSize(source.decoded);
  const value = source.decoded.array[sourceIndex] ?? 0;

  if (source.decoded.array instanceof Uint8Array) {
    view.setUint8(byteOffset, value);
    return;
  }

  if (source.decoded.array instanceof Uint16Array) {
    view.setUint16(byteOffset, value, true);
    return;
  }

  view.setFloat32(byteOffset, value, true);
}
