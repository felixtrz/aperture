import {
  assetHandleKey,
  type Aabb,
  type BoundingSphere,
  type MeshHandle,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshMaterialSlot,
  MeshSubmeshDescriptor,
  MeshVertexAttributeDescriptor,
  MeshVertexStreamDescriptor,
} from "../mesh/index.js";
import { validateMeshAsset } from "../mesh/index.js";

export type MeshMergeDiagnosticCode =
  | "meshMerge.emptyInput"
  | "meshMerge.invalidSourceMesh"
  | "meshMerge.incompatibleVertexStreamCount"
  | "meshMerge.incompatibleVertexStreamLayout"
  | "meshMerge.incompatibleVertexStreamData"
  | "meshMerge.incompatibleIndexPresence"
  | "meshMerge.invalidIndexRange"
  | "meshMerge.incompatibleTopology"
  | "meshMerge.incompatibleMaterialSlots";

export interface MeshMergeDiagnostic {
  readonly code: MeshMergeDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly meshKey?: string;
  readonly streamId?: string;
  readonly submesh?: number;
}

export interface MeshMergeSource {
  readonly handle: MeshHandle;
  readonly mesh: MeshAsset;
}

export interface MergedMeshSubmeshRange {
  readonly sourceMeshKey: string;
  readonly sourceMeshLabel: string;
  readonly sourceSubmesh: number;
  readonly mergedSubmesh: number;
  readonly vertexStart: number;
  readonly vertexCount: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface MergeMeshAssetsForBatchOptions {
  readonly label?: string;
  readonly sources: readonly MeshMergeSource[];
}

export interface MergeMeshAssetsForBatchResult {
  readonly valid: boolean;
  readonly mesh: MeshAsset | null;
  readonly ranges: readonly MergedMeshSubmeshRange[];
  readonly diagnostics: readonly MeshMergeDiagnostic[];
}

type MeshVertexDataArray = MeshVertexStreamDescriptor["data"];

interface SourceLayout {
  readonly meshKey: string;
  readonly mesh: MeshAsset;
  readonly vertexCount: number;
  readonly vertexBase: number;
  readonly indexBase: number;
}

export function mergeMeshAssetsForBatch(
  options: MergeMeshAssetsForBatchOptions,
): MergeMeshAssetsForBatchResult {
  const diagnostics: MeshMergeDiagnostic[] = [];

  if (options.sources.length === 0) {
    diagnostics.push({
      code: "meshMerge.emptyInput",
      severity: "error",
      message: "Cannot merge mesh assets for batching without sources.",
    });
    return { valid: false, mesh: null, ranges: [], diagnostics };
  }

  const firstSource = required(options.sources[0]);
  const firstMesh = firstSource.mesh;
  const indexed = firstMesh.indexBuffer !== undefined;
  const topology = firstMesh.submeshes[0]?.topology ?? "triangle-list";
  const sourceLayouts = collectSourceLayouts(options.sources, diagnostics);

  validateCompatibility({
    sources: options.sources,
    firstMesh,
    indexed,
    topology,
    diagnostics,
  });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { valid: false, mesh: null, ranges: [], diagnostics };
  }

  const mergedVertexStreams = mergeVertexStreams(firstMesh, sourceLayouts);
  const indexBuffer = indexed
    ? mergeIndexBuffer(sourceLayouts, diagnostics)
    : undefined;

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { valid: false, mesh: null, ranges: [], diagnostics };
  }

  const ranges: MergedMeshSubmeshRange[] = [];
  const submeshes = mergeSubmeshes(sourceLayouts, indexed, ranges);
  const mesh: MeshAsset = {
    kind: "mesh",
    label: options.label ?? `Merged ${options.sources.length} meshes`,
    vertexStreams: mergedVertexStreams,
    ...(indexBuffer === undefined ? {} : { indexBuffer }),
    submeshes,
    materialSlots: cloneMaterialSlots(firstMesh.materialSlots),
    ...mergeBounds(sourceLayouts.map((source) => source.mesh)),
  };

  return { valid: true, mesh, ranges, diagnostics };
}

function collectSourceLayouts(
  sources: readonly MeshMergeSource[],
  diagnostics: MeshMergeDiagnostic[],
): readonly SourceLayout[] {
  const layouts: SourceLayout[] = [];
  let vertexBase = 0;
  let indexBase = 0;

  for (const source of sources) {
    const meshKey = assetHandleKey(source.handle);
    const vertexCount = source.mesh.vertexStreams[0]?.vertexCount ?? 0;

    layouts.push({
      meshKey,
      mesh: source.mesh,
      vertexCount,
      vertexBase,
      indexBase,
    });

    vertexBase += vertexCount;
    indexBase += source.mesh.indexBuffer?.data.length ?? 0;

    const validation = validateMeshAsset(source.mesh);

    for (const diagnostic of validation.diagnostics) {
      diagnostics.push({
        code: "meshMerge.invalidSourceMesh",
        severity: "error",
        meshKey,
        ...(diagnostic.submesh === undefined
          ? {}
          : { submesh: diagnostic.submesh }),
        message: `Source mesh '${meshKey}' is invalid for batching: ${diagnostic.message}`,
      });
    }
  }

  return layouts;
}

function validateCompatibility(input: {
  readonly sources: readonly MeshMergeSource[];
  readonly firstMesh: MeshAsset;
  readonly indexed: boolean;
  readonly topology: MeshSubmeshDescriptor["topology"];
  readonly diagnostics: MeshMergeDiagnostic[];
}): void {
  for (const source of input.sources) {
    const meshKey = assetHandleKey(source.handle);
    const mesh = source.mesh;

    if (mesh.vertexStreams.length !== input.firstMesh.vertexStreams.length) {
      input.diagnostics.push({
        code: "meshMerge.incompatibleVertexStreamCount",
        severity: "error",
        meshKey,
        message: `Source mesh '${meshKey}' has ${mesh.vertexStreams.length} vertex streams; expected ${input.firstMesh.vertexStreams.length}.`,
      });
      continue;
    }

    for (
      let index = 0;
      index < input.firstMesh.vertexStreams.length;
      index += 1
    ) {
      const expected = required(input.firstMesh.vertexStreams[index]);
      const actual = required(mesh.vertexStreams[index]);

      validateStreamCompatibility(meshKey, expected, actual, input.diagnostics);
    }

    if ((mesh.indexBuffer !== undefined) !== input.indexed) {
      input.diagnostics.push({
        code: "meshMerge.incompatibleIndexPresence",
        severity: "error",
        meshKey,
        message: input.indexed
          ? `Source mesh '${meshKey}' is missing an index buffer required by this batch.`
          : `Source mesh '${meshKey}' has an index buffer but this batch is non-indexed.`,
      });
    }

    for (let index = 0; index < mesh.submeshes.length; index += 1) {
      const submesh = required(mesh.submeshes[index]);

      if (submesh.topology !== input.topology) {
        input.diagnostics.push({
          code: "meshMerge.incompatibleTopology",
          severity: "error",
          meshKey,
          submesh: index,
          message: `Source mesh '${meshKey}' submesh ${index} uses '${submesh.topology}' topology; expected '${input.topology}'.`,
        });
      }
    }

    if (
      !materialSlotsMatch(input.firstMesh.materialSlots, mesh.materialSlots)
    ) {
      input.diagnostics.push({
        code: "meshMerge.incompatibleMaterialSlots",
        severity: "error",
        meshKey,
        message: `Source mesh '${meshKey}' material slots do not match the first batch mesh.`,
      });
    }
  }
}

function validateStreamCompatibility(
  meshKey: string,
  expected: MeshVertexStreamDescriptor,
  actual: MeshVertexStreamDescriptor,
  diagnostics: MeshMergeDiagnostic[],
): void {
  const compatible =
    expected.id === actual.id &&
    expected.arrayStride === actual.arrayStride &&
    attributesMatch(expected.attributes, actual.attributes) &&
    dataConstructorsMatch(expected.data, actual.data);

  if (!compatible) {
    diagnostics.push({
      code: "meshMerge.incompatibleVertexStreamLayout",
      severity: "error",
      meshKey,
      streamId: actual.id,
      message: `Source mesh '${meshKey}' vertex stream '${actual.id}' does not match the first batch mesh layout.`,
    });
    return;
  }

  const elementSize = actual.data.BYTES_PER_ELEMENT;

  if (
    actual.arrayStride % elementSize !== 0 ||
    actual.data.length < requiredElementCount(actual)
  ) {
    diagnostics.push({
      code: "meshMerge.incompatibleVertexStreamData",
      severity: "error",
      meshKey,
      streamId: actual.id,
      message: `Source mesh '${meshKey}' vertex stream '${actual.id}' data does not cover ${actual.vertexCount} vertices at ${actual.arrayStride} bytes per vertex.`,
    });
  }
}

function mergeVertexStreams(
  firstMesh: MeshAsset,
  sources: readonly SourceLayout[],
): readonly MeshVertexStreamDescriptor[] {
  return firstMesh.vertexStreams.map((firstStream, streamIndex) => {
    const totalElements = sources.reduce(
      (sum, source) =>
        sum +
        requiredElementCount(required(source.mesh.vertexStreams[streamIndex])),
      0,
    );
    const data = createVertexDataArray(firstStream.data, totalElements);
    let elementOffset = 0;

    for (const source of sources) {
      const sourceStream = required(source.mesh.vertexStreams[streamIndex]);
      const sourceElementCount = requiredElementCount(sourceStream);

      setVertexData(
        data,
        sourceStream.data.subarray(
          0,
          sourceElementCount,
        ) as MeshVertexDataArray,
        elementOffset,
      );
      elementOffset += sourceElementCount;
    }

    return {
      id: firstStream.id,
      arrayStride: firstStream.arrayStride,
      vertexCount: sources.reduce((sum, source) => sum + source.vertexCount, 0),
      attributes: firstStream.attributes.map((attribute) => ({ ...attribute })),
      data,
    };
  });
}

function mergeIndexBuffer(
  sources: readonly SourceLayout[],
  diagnostics: MeshMergeDiagnostic[],
): MeshIndexBufferDescriptor | undefined {
  const totalVertexCount = sources.reduce(
    (sum, source) => sum + source.vertexCount,
    0,
  );
  const totalIndexCount = sources.reduce(
    (sum, source) => sum + (source.mesh.indexBuffer?.data.length ?? 0),
    0,
  );
  const format =
    totalVertexCount > 0xffff ||
    sources.some((source) => source.mesh.indexBuffer?.format === "uint32")
      ? "uint32"
      : "uint16";
  const data =
    format === "uint32"
      ? new Uint32Array(totalIndexCount)
      : new Uint16Array(totalIndexCount);
  let writeOffset = 0;

  for (const source of sources) {
    const sourceIndexBuffer = source.mesh.indexBuffer;

    if (sourceIndexBuffer === undefined) {
      continue;
    }

    for (let index = 0; index < sourceIndexBuffer.data.length; index += 1) {
      const sourceIndex = sourceIndexBuffer.data[index];

      if (sourceIndex === undefined || sourceIndex >= source.vertexCount) {
        diagnostics.push({
          code: "meshMerge.invalidIndexRange",
          severity: "error",
          meshKey: source.meshKey,
          message: `Source mesh '${source.meshKey}' index ${index} references vertex ${String(sourceIndex)} outside ${source.vertexCount} vertices.`,
        });
        continue;
      }

      data[writeOffset + index] = sourceIndex + source.vertexBase;
    }

    writeOffset += sourceIndexBuffer.data.length;
  }

  return { format, data };
}

function mergeSubmeshes(
  sources: readonly SourceLayout[],
  indexed: boolean,
  ranges: MergedMeshSubmeshRange[],
): readonly MeshSubmeshDescriptor[] {
  const submeshes: MeshSubmeshDescriptor[] = [];

  for (const source of sources) {
    for (
      let sourceSubmeshIndex = 0;
      sourceSubmeshIndex < source.mesh.submeshes.length;
      sourceSubmeshIndex += 1
    ) {
      const submesh = required(source.mesh.submeshes[sourceSubmeshIndex]);
      const mergedSubmeshIndex = submeshes.length;
      const mergedSubmesh: MeshSubmeshDescriptor = {
        label: `${source.mesh.label}/${submesh.label}`,
        topology: submesh.topology,
        materialSlot: submesh.materialSlot,
        vertexStart: source.vertexBase + submesh.vertexStart,
        vertexCount: submesh.vertexCount,
        indexStart: indexed ? source.indexBase + submesh.indexStart : 0,
        indexCount: indexed ? submesh.indexCount : 0,
      };

      submeshes.push(mergedSubmesh);
      ranges.push({
        sourceMeshKey: source.meshKey,
        sourceMeshLabel: source.mesh.label,
        sourceSubmesh: sourceSubmeshIndex,
        mergedSubmesh: mergedSubmeshIndex,
        vertexStart: mergedSubmesh.vertexStart,
        vertexCount: mergedSubmesh.vertexCount,
        indexStart: mergedSubmesh.indexStart,
        indexCount: mergedSubmesh.indexCount,
      });
    }
  }

  return submeshes;
}

function mergeBounds(meshes: readonly MeshAsset[]): {
  readonly localAabb?: Aabb;
  readonly localSphere?: BoundingSphere;
} {
  const bounds = meshes.flatMap((mesh) =>
    mesh.localAabb === undefined ? [] : [mesh.localAabb],
  );

  if (bounds.length !== meshes.length || bounds.length === 0) {
    return {};
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const bound of bounds) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis] ?? Infinity, read(bound.min, axis));
      max[axis] = Math.max(max[axis] ?? -Infinity, read(bound.max, axis));
    }
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ];
  const corners = [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ] as const;
  const radius = Math.max(
    ...corners.map((corner) =>
      Math.hypot(
        corner[0] - center[0],
        corner[1] - center[1],
        corner[2] - center[2],
      ),
    ),
  );

  return {
    localAabb: { min, max },
    localSphere: { center, radius },
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected mesh merge value to exist after validation.");
  }

  return value;
}

function requiredElementCount(stream: MeshVertexStreamDescriptor): number {
  return (
    (stream.vertexCount * stream.arrayStride) / stream.data.BYTES_PER_ELEMENT
  );
}

function attributesMatch(
  a: readonly MeshVertexAttributeDescriptor[],
  b: readonly MeshVertexAttributeDescriptor[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (
      left === undefined ||
      right === undefined ||
      left.semantic !== right.semantic ||
      left.format !== right.format ||
      left.offset !== right.offset
    ) {
      return false;
    }
  }

  return true;
}

function dataConstructorsMatch(
  a: MeshVertexDataArray,
  b: MeshVertexDataArray,
): boolean {
  return (
    (a instanceof Float32Array && b instanceof Float32Array) ||
    (a instanceof Uint16Array && b instanceof Uint16Array) ||
    (a instanceof Uint8Array && b instanceof Uint8Array)
  );
}

function createVertexDataArray(
  sample: MeshVertexDataArray,
  length: number,
): MeshVertexDataArray {
  if (sample instanceof Float32Array) {
    return new Float32Array(length);
  }

  if (sample instanceof Uint16Array) {
    return new Uint16Array(length);
  }

  return new Uint8Array(length);
}

function setVertexData(
  target: MeshVertexDataArray,
  source: MeshVertexDataArray,
  offset: number,
): void {
  if (target instanceof Float32Array && source instanceof Float32Array) {
    target.set(source, offset);
    return;
  }

  if (target instanceof Uint16Array && source instanceof Uint16Array) {
    target.set(source, offset);
    return;
  }

  if (target instanceof Uint8Array && source instanceof Uint8Array) {
    target.set(source, offset);
  }
}

function materialSlotsMatch(
  a: readonly MeshMaterialSlot[],
  b: readonly MeshMaterialSlot[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (
      left === undefined ||
      right === undefined ||
      left.index !== right.index ||
      left.label !== right.label
    ) {
      return false;
    }
  }

  return true;
}

function cloneMaterialSlots(
  materialSlots: readonly MeshMaterialSlot[],
): readonly MeshMaterialSlot[] {
  return materialSlots.map((slot) => ({ ...slot }));
}

function read(value: ArrayLike<number>, index: number): number {
  const item = value[index];

  if (item === undefined) {
    throw new RangeError(`Missing vector component ${index}.`);
  }

  return item;
}
