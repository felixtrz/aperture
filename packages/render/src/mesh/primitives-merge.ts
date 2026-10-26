import type { Mat4Like } from "@aperture-engine/simulation";
import type { MeshAsset, MeshVertexStreamDescriptor } from "./types.js";
import type { TriangleListColor } from "./triangle-list-types.js";
import {
  PRIMITIVE_VERTEX_STRIDE_BYTES,
  boundsFromPositions,
  type PrimitivePosition,
} from "./primitives-builders.js";

/** One mesh placed into a merged mesh, like a child baked into its parent. */
export interface MergeMeshPart {
  /** A triangle-list mesh with float32 POSITION and NORMAL attributes. */
  readonly mesh: MeshAsset;
  /** Column-major 4x4 transform into the merged mesh's local space. */
  readonly matrix?: Mat4Like;
  /**
   * Linear RGB(A) tint for this part, multiplied into any existing COLOR_0.
   * Parts without a color stay white, so the material base color shows.
   */
  readonly color?: TriangleListColor;
}

export interface MergeMeshOptions {
  readonly label?: string;
  /**
   * Give every triangle its own face normal (three.js `flatShading: true`):
   * the faceted low-poly look for rocks, foliage and terrain props.
   */
  readonly flatShading?: boolean;
}

/** An invalid merge input, with the offending part or field location. */
export class MergeMeshError extends RangeError {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} ${reason}`);
    this.name = "MergeMeshError";
    this.path = path;
  }
}

const COLORED_FLOATS = 12;
const PLAIN_FLOATS = 8;

interface ReadablePart {
  readonly positions: readonly (readonly number[])[];
  readonly normals: readonly (readonly number[])[];
  readonly uvs: readonly (readonly number[])[];
  readonly colors: readonly (readonly number[])[] | null;
  readonly triangles: number[];
}

/**
 * Bake several triangle meshes into one single-material mesh (the Aperture
 * counterpart of three.js `mergeGeometries` on transformed geometry). Each
 * part keeps its own normals and UVs; positions and normals are transformed by
 * the part matrix, and mirrored matrices keep counterclockwise front faces.
 * A COLOR_0 stream is written when any part has a color or vertex colors, so
 * one material can render a multi-colored prop in a single draw.
 */
export function createMergedMeshAsset(
  parts: readonly MergeMeshPart[],
  options: MergeMeshOptions = {},
): MeshAsset {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new MergeMeshError("parts", "must be a non-empty array.");
  }

  const readable = parts.map((part, index) =>
    readPart(part, `parts[${index}]`),
  );
  const colored = readable.some((part, index) => {
    return part.colors !== null || parts[index]?.color !== undefined;
  });
  const floats = colored ? COLORED_FLOATS : PLAIN_FLOATS;
  const flat = options.flatShading === true;
  const indexCount = readable.reduce(
    (count, part) => count + part.triangles.length,
    0,
  );
  // Flat shading gives each corner its own vertex so faces do not share normals.
  const vertexCount = flat
    ? indexCount
    : readable.reduce((count, part) => count + part.positions.length, 0);
  const data = new Float32Array(vertexCount * floats);
  const indices =
    vertexCount > 0xffff
      ? new Uint32Array(indexCount)
      : new Uint16Array(indexCount);
  const bounds: PrimitivePosition[] = [];
  let vertexBase = 0;
  let indexCursor = 0;

  readable.forEach((part, partIndex) => {
    const path = `parts[${partIndex}]`;
    const matrix = readMatrix(parts[partIndex]?.matrix, `${path}.matrix`);
    const normalMatrix = normalMatrixOf(matrix, `${path}.matrix`);
    const flip = determinant3(matrix) < 0;
    const tint = readTint(parts[partIndex]?.color, `${path}.color`);

    const positions = part.positions.map((p) => transformPoint(matrix, p));
    const writeVertex = (
      target: number,
      source: number,
      normal: PrimitivePosition,
    ): void => {
      const offset = target * floats;
      data.set(positions[source]!, offset);
      data.set(normal, offset + 3);
      data.set(part.uvs[source] ?? [0, 0], offset + 6);
      if (colored) {
        const color = part.colors?.[source] ?? [1, 1, 1, 1];
        data[offset + 8] = color[0]! * tint[0];
        data[offset + 9] = color[1]! * tint[1];
        data[offset + 10] = color[2]! * tint[2];
        data[offset + 11] = color[3]! * tint[3];
      }
    };

    if (!flat) {
      for (let vertex = 0; vertex < positions.length; vertex += 1) {
        writeVertex(
          vertexBase + vertex,
          vertex,
          transformNormal(normalMatrix, part.normals[vertex]!),
        );
      }
    }
    bounds.push(...positions);

    for (let corner = 0; corner < part.triangles.length; corner += 3) {
      const a = part.triangles[corner]!;
      const b = part.triangles[flip ? corner + 2 : corner + 1]!;
      const c = part.triangles[flip ? corner + 1 : corner + 2]!;
      if (flat) {
        const normal = faceNormal(positions[a]!, positions[b]!, positions[c]!);
        writeVertex(indexCursor, a, normal);
        writeVertex(indexCursor + 1, b, normal);
        writeVertex(indexCursor + 2, c, normal);
        indices[indexCursor] = indexCursor;
        indices[indexCursor + 1] = indexCursor + 1;
        indices[indexCursor + 2] = indexCursor + 2;
      } else {
        indices[indexCursor] = vertexBase + a;
        indices[indexCursor + 1] = vertexBase + b;
        indices[indexCursor + 2] = vertexBase + c;
      }
      indexCursor += 3;
    }
    vertexBase += positions.length;
  });

  const box = boundsFromPositions(bounds);
  if (!Number.isFinite(Math.fround(box.sphere.radius))) {
    throw new MergeMeshError(
      "parts",
      "span a bounding sphere too large for finite float32 storage; use smaller local coordinates and a transform.",
    );
  }
  const stream: MeshVertexStreamDescriptor = colored
    ? {
        id: "merged-interleaved-color",
        arrayStride: COLORED_FLOATS * 4,
        vertexCount,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
          { semantic: "COLOR_0", format: "float32x4", offset: 32 },
        ],
        data,
      }
    : {
        id: "merged-interleaved",
        arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
        vertexCount,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data,
      };

  return {
    kind: "mesh",
    label: options.label ?? "Merged",
    vertexStreams: [stream],
    indexBuffer: {
      format: indices instanceof Uint32Array ? "uint32" : "uint16",
      data: indices,
      indexCount: indices.length,
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: box.aabb,
    localSphere: box.sphere,
  };
}

function readPart(part: MergeMeshPart, path: string): ReadablePart {
  if (part === null || typeof part !== "object" || part.mesh === undefined) {
    throw new MergeMeshError(path, "must be an object with a mesh.");
  }
  const mesh = part.mesh;
  for (const [index, submesh] of mesh.submeshes.entries()) {
    if (submesh.topology !== "triangle-list") {
      throw new MergeMeshError(
        `${path}.mesh.submeshes[${index}]`,
        `has topology '${submesh.topology}'; only triangle-list meshes can be merged.`,
      );
    }
  }

  const positions = readAttribute(mesh, "POSITION", 3, path);
  const normals = readAttribute(mesh, "NORMAL", 3, path);
  if (positions === null || normals === null) {
    throw new MergeMeshError(
      `${path}.mesh`,
      "must have float32x3 POSITION and NORMAL attributes.",
    );
  }
  const uvs = readAttribute(mesh, "TEXCOORD_0", 2, path);
  const colors = readAttribute(mesh, "COLOR_0", 4, path);
  const triangles: number[] = [];

  for (const submesh of mesh.submeshes) {
    if (mesh.indexBuffer !== undefined && submesh.indexCount > 0) {
      const source = mesh.indexBuffer.data;
      for (
        let index = submesh.indexStart;
        index < submesh.indexStart + submesh.indexCount;
        index += 1
      ) {
        triangles.push(source[index]!);
      }
    } else {
      for (
        let vertex = submesh.vertexStart;
        vertex < submesh.vertexStart + submesh.vertexCount;
        vertex += 1
      ) {
        triangles.push(vertex);
      }
    }
  }
  if (triangles.length % 3 !== 0) {
    throw new MergeMeshError(
      `${path}.mesh`,
      "must contain complete triangles (index count divisible by three).",
    );
  }

  return { positions, normals, uvs: uvs ?? [], colors, triangles };
}

function readAttribute(
  mesh: MeshAsset,
  semantic: "POSITION" | "NORMAL" | "TEXCOORD_0" | "COLOR_0",
  size: 2 | 3 | 4,
  path: string,
): number[][] | null {
  for (const stream of mesh.vertexStreams) {
    const attribute = stream.attributes.find(
      (candidate) => candidate.semantic === semantic,
    );
    if (attribute === undefined) continue;
    const components =
      attribute.format === "float32x2"
        ? 2
        : attribute.format === "float32x3"
          ? 3
          : attribute.format === "float32x4"
            ? 4
            : 0;
    if (!(stream.data instanceof Float32Array) || components === 0) {
      throw new MergeMeshError(
        `${path}.mesh`,
        `has ${semantic} in format '${attribute.format}'; only float32 vertex attributes can be merged.`,
      );
    }
    const stride = stream.arrayStride / 4;
    const offset = attribute.offset / 4;
    const values: number[][] = [];
    for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
      const base = vertex * stride + offset;
      const item: number[] = [];
      for (let component = 0; component < size; component += 1) {
        // COLOR_0 float32x3 gains alpha 1; wider sources are truncated.
        item.push(
          component < components
            ? stream.data[base + component]!
            : component === 3
              ? 1
              : 0,
        );
      }
      values.push(item);
    }
    return values;
  }
  return null;
}

function readMatrix(value: Mat4Like | undefined, path: string): number[] {
  if (value === undefined) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  const matrix: number[] = [];
  for (let index = 0; index < 16; index += 1) {
    const item = value[index];
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new MergeMeshError(
        `${path}[${index}]`,
        "must be a finite number (column-major 4x4).",
      );
    }
    matrix.push(item);
  }
  return matrix;
}

function readTint(
  value: TriangleListColor | undefined,
  path: string,
): readonly [number, number, number, number] {
  if (value === undefined) return [1, 1, 1, 1];
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)) {
    throw new MergeMeshError(
      path,
      "must be a linear [r, g, b] or [r, g, b, a] tuple.",
    );
  }
  const tint = [value[0], value[1], value[2], value[3] ?? 1] as const;
  if (!tint.every((item) => typeof item === "number" && Number.isFinite(item)))
    throw new MergeMeshError(path, "must contain finite numbers.");
  return tint;
}

function transformPoint(
  m: readonly number[],
  p: readonly number[],
): PrimitivePosition {
  const x = p[0]!,
    y = p[1]!,
    z = p[2]!;
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ];
}

function determinant3(m: readonly number[]): number {
  return (
    m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) -
    m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) +
    m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!)
  );
}

/** Inverse-transpose of the upper 3x3, row-major [r0c0, r0c1, ...]. */
function normalMatrixOf(m: readonly number[], path: string): number[] {
  const det = determinant3(m);
  if (Math.abs(det) < 1e-12) {
    throw new MergeMeshError(
      path,
      "must be invertible (a zero scale collapses the part).",
    );
  }
  const a = m[0]!,
    b = m[4]!,
    c = m[8]!;
  const d = m[1]!,
    e = m[5]!,
    f = m[9]!;
  const g = m[2]!,
    h = m[6]!,
    i = m[10]!;
  // inverse(M) = adj(M) / det; its transpose is the cofactor matrix / det.
  return [
    (e * i - f * h) / det,
    (f * g - d * i) / det,
    (d * h - e * g) / det,
    (c * h - b * i) / det,
    (a * i - c * g) / det,
    (b * g - a * h) / det,
    (b * f - c * e) / det,
    (c * d - a * f) / det,
    (a * e - b * d) / det,
  ];
}

function faceNormal(
  a: PrimitivePosition,
  b: PrimitivePosition,
  c: PrimitivePosition,
): PrimitivePosition {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const x = ab[1] * ac[2] - ab[2] * ac[1];
  const y = ab[2] * ac[0] - ab[0] * ac[2];
  const z = ab[0] * ac[1] - ab[1] * ac[0];
  const length = Math.hypot(x, y, z);
  // Degenerate slivers (e.g. sphere poles) keep an arbitrary up normal.
  return length === 0 ? [0, 1, 0] : [x / length, y / length, z / length];
}

function transformNormal(
  n: readonly number[],
  v: readonly number[],
): PrimitivePosition {
  const vx = v[0]!,
    vy = v[1]!,
    vz = v[2]!;
  const x = n[0]! * vx + n[1]! * vy + n[2]! * vz;
  const y = n[3]! * vx + n[4]! * vy + n[5]! * vz;
  const z = n[6]! * vx + n[7]! * vy + n[8]! * vz;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}
