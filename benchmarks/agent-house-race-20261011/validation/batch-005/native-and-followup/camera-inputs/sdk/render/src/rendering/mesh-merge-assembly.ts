import type {
  MeshAsset,
  MeshIndexBufferDescriptor,
  MeshSubmeshDescriptor,
  MeshVertexStreamDescriptor,
} from "../mesh/index.js";
import type {
  MergedMeshSubmeshRange,
  MeshMergeDiagnostic,
  MeshVertexDataArray,
  SourceLayout,
} from "./mesh-merge-types.js";
import {
  createVertexDataArray,
  required,
  requiredElementCount,
  setVertexData,
} from "./mesh-merge-utils.js";

export function mergeVertexStreams(
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

export function mergeIndexBuffer(
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

export function mergeSubmeshes(
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
