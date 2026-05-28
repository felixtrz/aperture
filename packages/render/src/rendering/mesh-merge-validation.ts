import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshSubmeshDescriptor,
  MeshVertexStreamDescriptor,
} from "../mesh/index.js";
import { validateMeshAsset } from "../mesh/index.js";
import type {
  MeshMergeDiagnostic,
  MeshMergeSource,
  SourceLayout,
} from "./mesh-merge-types.js";
import {
  attributesMatch,
  dataConstructorsMatch,
  materialSlotsMatch,
  required,
  requiredElementCount,
} from "./mesh-merge-utils.js";

export function collectSourceLayouts(
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

export function validateCompatibility(input: {
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
