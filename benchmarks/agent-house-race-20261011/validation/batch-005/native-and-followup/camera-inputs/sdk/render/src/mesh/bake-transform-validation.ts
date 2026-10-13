import {
  bakeFailure,
  MESH_BAKE_TRANSFORM_LIMITS as limits,
} from "./bake-transform-types.js";
import type {
  MeshAsset,
  MeshVertexAttributeDescriptor,
  MeshVertexFormat,
} from "./types.js";

export interface BakeAttributeBinding {
  readonly stream: number;
  readonly offset: number;
}

export interface BakeTriangleRange {
  readonly start: number;
  readonly end: number;
}

export interface BakeSourceLayout {
  readonly vertexCount: number;
  readonly position: BakeAttributeBinding;
  readonly normal?: BakeAttributeBinding;
  readonly tangent?: BakeAttributeBinding;
  readonly triangleRanges: readonly BakeTriangleRange[];
}

const formatBytes: Readonly<Record<MeshVertexFormat, number>> = {
  float32x2: 8,
  float32x3: 12,
  float32x4: 16,
  unorm8x4: 4,
  unorm16x4: 8,
  uint16x4: 8,
  uint8x4: 4,
};
const staticSemantics = new Set([
  "POSITION",
  "NORMAL",
  "TANGENT",
  "TEXCOORD_0",
  "TEXCOORD_1",
  "COLOR_0",
]);

export function validateBakeSource(
  mesh: MeshAsset,
  mirrored: boolean,
): BakeSourceLayout {
  if (mesh == null || mesh.kind !== "mesh" || typeof mesh.label !== "string") {
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: "mesh",
      message: "Provide a MeshAsset with a string label.",
    });
  }
  if (
    mesh.skinning !== undefined ||
    mesh.morphTargets !== undefined ||
    mesh.morphTargetData !== undefined
  ) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: "mesh",
      message:
        "Bake supports static geometry only; remove skinning and morph data or bake deformation separately first.",
    });
  }
  boundedArray(mesh.vertexStreams, limits.streams, "mesh.vertexStreams");
  boundedArray(mesh.submeshes, limits.submeshes, "mesh.submeshes");
  boundedArray(mesh.materialSlots, limits.materialSlots, "mesh.materialSlots");
  const bindings = new Map<string, BakeAttributeBinding>();
  const ids = new Set<string>();
  let vertexCount = 0;
  let bytes = 0;
  for (const [streamIndex, stream] of mesh.vertexStreams.entries()) {
    const path = `mesh.vertexStreams[${streamIndex}]`;
    if (stream == null || typeof stream.id !== "string" || ids.has(stream.id)) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: path,
        message: "Each stream needs a unique string id.",
      });
    }
    ids.add(stream.id);
    positiveInteger(stream.vertexCount, limits.vertices, `${path}.vertexCount`);
    positiveInteger(stream.arrayStride, limits.bytes, `${path}.arrayStride`);
    if (stream.arrayStride % 4 !== 0) {
      bakeFailure({
        code: "meshBake.unsupportedLayout",
        path: `${path}.arrayStride`,
        message:
          "Use a stride divisible by four bytes, as required by vertex-buffer layouts.",
      });
    }
    if (streamIndex === 0) vertexCount = stream.vertexCount;
    if (vertexCount !== stream.vertexCount) {
      bakeFailure({
        code: "meshBake.unsupportedLayout",
        path: `${path}.vertexCount`,
        message: "All streams must describe the same source vertices.",
      });
    }
    if (
      !(
        stream.data instanceof Float32Array ||
        stream.data instanceof Uint16Array ||
        stream.data instanceof Uint8Array
      )
    ) {
      bakeFailure({
        code: "meshBake.unsupportedLayout",
        path: `${path}.data`,
        message: "Use Float32Array, Uint16Array or Uint8Array vertex data.",
      });
    }
    ownedBuffer(stream.data, `${path}.data`);
    bytes += stream.data.byteLength;
    byteBudget(bytes);
    if (stream.vertexCount * stream.arrayStride > stream.data.byteLength) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: `${path}.data`,
        message:
          "Data must cover every declared vertex stride, including padding.",
      });
    }
    boundedArray(
      stream.attributes,
      limits.attributesPerStream,
      `${path}.attributes`,
    );
    const spans: { start: number; end: number }[] = [];
    const view = new DataView(
      stream.data.buffer,
      stream.data.byteOffset,
      stream.data.byteLength,
    );
    for (const [attributeIndex, attribute] of stream.attributes.entries()) {
      const attrPath = `${path}.attributes[${attributeIndex}]`;
      validateAttribute(attribute, stream.arrayStride, attrPath);
      if (bindings.has(attribute.semantic)) {
        bakeFailure({
          code: "meshBake.unsupportedLayout",
          path: attrPath,
          message: "Declare each semantic once across the mesh streams.",
        });
      }
      const span = {
        start: attribute.offset,
        end: attribute.offset + formatBytes[attribute.format],
      };
      if (
        spans.some((other) => span.start < other.end && other.start < span.end)
      ) {
        bakeFailure({
          code: "meshBake.unsupportedLayout",
          path: attrPath,
          message:
            "Attribute byte ranges must not overlap; separate shared storage before baking.",
        });
      }
      spans.push(span);
      bindings.set(attribute.semantic, {
        stream: streamIndex,
        offset: attribute.offset,
      });
      if (attribute.format.startsWith("float32")) {
        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
          for (
            let component = 0;
            component < formatBytes[attribute.format] / 4;
            component += 1
          ) {
            if (
              !Number.isFinite(
                view.getFloat32(
                  vertex * stream.arrayStride +
                    attribute.offset +
                    component * 4,
                  true,
                ),
              )
            ) {
              bakeFailure({
                code: "meshBake.invalidSourceMesh",
                path: `${attrPath}.vertex[${vertex}]`,
                message:
                  "Declared float attributes must contain finite values.",
              });
            }
          }
        }
      }
    }
  }
  const position = bindings.get("POSITION");
  if (position === undefined) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: "mesh.vertexStreams",
      message: "Declare one POSITION attribute in float32x3 format.",
    });
  }
  const normal = bindings.get("NORMAL");
  const tangent = bindings.get("TANGENT");
  if (tangent !== undefined && normal === undefined) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: "mesh.vertexStreams",
      message:
        "TANGENT requires an explicit NORMAL to preserve an orthogonal tangent basis.",
    });
  }
  const indices = mesh.indexBuffer;
  if (indices !== undefined) {
    if (
      !(
        (indices.format === "uint16" && indices.data instanceof Uint16Array) ||
        (indices.format === "uint32" && indices.data instanceof Uint32Array)
      )
    ) {
      bakeFailure({
        code: "meshBake.unsupportedLayout",
        path: "mesh.indexBuffer",
        message: "Index data must be Uint16Array/uint16 or Uint32Array/uint32.",
      });
    }
    ownedBuffer(indices.data, "mesh.indexBuffer.data");
    boundedInteger(
      indices.data.length,
      limits.indices,
      "mesh.indexBuffer.data.length",
    );
    boundedInteger(
      indices.indexCount ?? indices.data.length,
      indices.data.length,
      "mesh.indexBuffer.indexCount",
    );
    bytes += indices.data.byteLength;
    byteBudget(bytes);
    for (const [index, value] of indices.data.entries()) {
      boundedInteger(value, vertexCount - 1, `mesh.indexBuffer.data[${index}]`);
    }
  }
  const materials = new Set<number>();
  for (const [index, slot] of mesh.materialSlots.entries()) {
    if (slot == null || typeof slot.label !== "string") {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: `mesh.materialSlots[${index}]`,
        message: "Material slots need a string label and a nonnegative index.",
      });
    }
    boundedInteger(
      slot.index,
      limits.materialSlots - 1,
      `mesh.materialSlots[${index}].index`,
    );
    if (materials.has(slot.index)) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: `mesh.materialSlots[${index}].index`,
        message: "Material slot indices must be unique.",
      });
    }
    materials.add(slot.index);
  }
  const ranges: BakeTriangleRange[] = [];
  let corners = 0;
  for (const [index, submesh] of mesh.submeshes.entries()) {
    const path = `mesh.submeshes[${index}]`;
    if (submesh == null || submesh.topology !== "triangle-list") {
      bakeFailure({
        code: "meshBake.unsupportedLayout",
        path: path,
        message:
          "Only triangle-list submeshes can be baked; convert strips, lines and points separately.",
      });
    }
    if (
      typeof submesh.label !== "string" ||
      !materials.has(submesh.materialSlot)
    ) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: path,
        message:
          "Submeshes need a string label and an existing material slot index.",
      });
    }
    boundedInteger(submesh.vertexStart, vertexCount, `${path}.vertexStart`);
    boundedInteger(
      submesh.vertexCount,
      vertexCount - submesh.vertexStart,
      `${path}.vertexCount`,
    );
    const indexCount = indices?.indexCount ?? indices?.data.length ?? 0;
    boundedInteger(submesh.indexStart, indexCount, `${path}.indexStart`);
    boundedInteger(
      submesh.indexCount,
      indexCount - submesh.indexStart,
      `${path}.indexCount`,
    );
    const start =
      indices === undefined ? submesh.vertexStart : submesh.indexStart;
    const count =
      indices === undefined ? submesh.vertexCount : submesh.indexCount;
    if (count % 3 !== 0) {
      bakeFailure({
        code: "meshBake.invalidSourceMesh",
        path: path,
        message: "Active triangle-list ranges must contain complete triples.",
      });
    }
    corners += count;
    if (corners > limits.triangleCorners) {
      bakeFailure({
        code: "meshBake.limitExceeded",
        path: "mesh.submeshes",
        message: `Total active triangle corners exceed ${limits.triangleCorners}; split the source mesh.`,
      });
    }
    if (count > 0) ranges.push({ start, end: start + count });
  }
  if (corners === 0) {
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: "mesh.submeshes",
      message: "Declare at least one active triangle.",
    });
  }
  return {
    vertexCount,
    position,
    ...(normal === undefined ? {} : { normal }),
    ...(tangent === undefined ? {} : { tangent }),
    triangleRanges: mirrored ? unionMirroredRanges(ranges) : ranges,
  };
}

function validateAttribute(
  attribute: MeshVertexAttributeDescriptor,
  stride: number,
  path: string,
): void {
  if (attribute == null || !staticSemantics.has(attribute.semantic)) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: path,
      message:
        "Use static POSITION/NORMAL/TANGENT, TEXCOORD_0/1 or COLOR_0 semantics; deformation attributes need a separate bake.",
    });
  }
  const bytes = Object.hasOwn(formatBytes, attribute.format)
    ? formatBytes[attribute.format]
    : undefined;
  if (bytes === undefined) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: `${path}.format`,
      message: "Use a supported MeshVertexFormat.",
    });
  }
  boundedInteger(attribute.offset, stride - bytes, `${path}.offset`);
  const alignment = attribute.format.startsWith("float32")
    ? 4
    : attribute.format.includes("16")
      ? 2
      : 1;
  if (attribute.offset % alignment !== 0) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: `${path}.offset`,
      message: `Align this format to ${alignment} bytes.`,
    });
  }
  const expected = attribute.semantic === "TANGENT" ? "float32x4" : "float32x3";
  if (
    (attribute.semantic === "POSITION" ||
      attribute.semantic === "NORMAL" ||
      attribute.semantic === "TANGENT") &&
    attribute.format !== expected
  ) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: `${path}.format`,
      message: `${attribute.semantic} must use ${expected}; unpack transformed attributes first.`,
    });
  }
}

function unionMirroredRanges(
  ranges: readonly BakeTriangleRange[],
): BakeTriangleRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const result: { start: number; end: number }[] = [];
  for (const range of sorted) {
    const previous = result.at(-1);
    if (previous === undefined || range.start >= previous.end) {
      result.push({ ...range });
    } else {
      if ((range.start - previous.start) % 3 !== 0) {
        bakeFailure({
          code: "meshBake.unsupportedLayout",
          path: "mesh.submeshes",
          message:
            "Mirrored submesh ranges partially overlap different triangle triplets; separate their index/vertex ranges before baking.",
        });
      }
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return result;
}

function ownedBuffer(data: ArrayBufferView, path: string): void {
  if (!(data.buffer instanceof ArrayBuffer)) {
    bakeFailure({
      code: "meshBake.unsupportedLayout",
      path: path,
      message:
        "SharedArrayBuffer data cannot be read coherently here; provide an owned typed-array snapshot.",
    });
  }
}

function boundedArray(
  value: readonly unknown[],
  maximum: number,
  path: string,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: path,
      message: "Provide a nonempty array.",
    });
  }
  boundedInteger(value.length, maximum, `${path}.length`);
}

function positiveInteger(value: number, maximum: number, path: string): void {
  boundedInteger(value, maximum, path);
  if (value === 0)
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: path,
      message: "Provide a positive integer.",
    });
}

function boundedInteger(value: number, maximum: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    bakeFailure({
      code: "meshBake.invalidSourceMesh",
      path: path,
      message: "Provide a nonnegative safe integer.",
    });
  }
  if (value > maximum) {
    bakeFailure({
      code: "meshBake.limitExceeded",
      path: path,
      message: `Value exceeds the supported bound ${maximum}; correct the range or split the source mesh.`,
    });
  }
}

function byteBudget(bytes: number): void {
  if (bytes > limits.bytes) {
    bakeFailure({
      code: "meshBake.limitExceeded",
      path: "mesh",
      message: `Source buffer views exceed ${limits.bytes} bytes; split the source mesh before baking.`,
    });
  }
}
