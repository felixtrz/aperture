import type { Entity } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import { MorphTargetWeights, Skin } from "./index.js";
import type { RenderDiagnostic } from "./snapshot.js";
import { diagnostic } from "./extraction-diagnostics.js";

export interface SkinExtraction {
  /** The typed joint palette, returned by reference (no per-extract copy). */
  readonly jointMatrices: ArrayLike<number>;
  readonly jointCount: number;
}

export function readSkinning(
  entity: Entity,
  mesh: MeshAsset,
  diagnostics: RenderDiagnostic[],
): SkinExtraction | undefined | null {
  if (!entity.hasComponent(Skin)) {
    return undefined;
  }

  if (!meshHasVertexSemantic(mesh, "JOINTS_0")) {
    diagnostics.push(diagnostic("render.skinning.missingJoints0", entity));
    return null;
  }

  if (!meshHasVertexSemantic(mesh, "WEIGHTS_0")) {
    diagnostics.push(diagnostic("render.skinning.missingWeights0", entity));
    return null;
  }

  const jointCount = entity.getValue(Skin, "jointCount") ?? 0;
  // Read the typed palette directly — no JSON.parse, no intermediate array.
  const jointMatrices = entity.getValue(Skin, "jointMatrices") as
    | Float32Array
    | null
    | undefined;

  if (!(jointMatrices instanceof Float32Array) || jointMatrices.length === 0) {
    diagnostics.push(diagnostic("render.skinning.invalidMatrices", entity));
    return null;
  }

  if (jointMatrices.length % 16 !== 0) {
    diagnostics.push(diagnostic("render.skinning.misalignedMatrices", entity));
    return null;
  }

  const matrixCount = jointMatrices.length / 16;

  if (jointCount !== matrixCount) {
    diagnostics.push(diagnostic("render.skinning.jointCountMismatch", entity));
    return null;
  }

  return { jointMatrices, jointCount: matrixCount };
}

export function pushBoneMatrices(
  values: number[],
  skinning: SkinExtraction,
): number {
  const offset = values.length;
  const matrices = skinning.jointMatrices;

  for (let index = 0; index < matrices.length; index += 1) {
    values.push(matrices[index]!);
  }
  return offset;
}

export function readMorphTargetWeights(
  entity: Entity,
  mesh: MeshAsset,
  diagnostics: RenderDiagnostic[],
): readonly [number, number, number, number] | undefined | null {
  if (!meshHasStandardMorphTargetAttributes(mesh)) {
    return undefined;
  }

  if (!entity.hasComponent(MorphTargetWeights)) {
    return [0, 0, 0, 0];
  }

  // Read the typed weight buffer directly — no JSON.parse, no intermediate
  // allocation, and no [-1, 1] clamp (glTF weights are unbounded). The typed
  // buffer can hold an arbitrary target count (e.g. 52 ARKit blendshapes); the
  // two-target vertex-attribute GPU path consumes the first weights here, and
  // the N-target data-buffer GPU path (see morphTargets import) is the
  // documented follow-up that will pack the full weight vector.
  const weights = entity.getValue(MorphTargetWeights, "weights") as
    | Float32Array
    | null
    | undefined;

  if (
    weights !== null &&
    weights !== undefined &&
    !(weights instanceof Float32Array)
  ) {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidWeights", entity),
    );
    return null;
  }

  const values = weights ?? EMPTY_WEIGHTS;

  return [
    finiteOrZero(values[0]),
    finiteOrZero(values[1]),
    finiteOrZero(values[2]),
    finiteOrZero(values[3]),
  ];
}

export function pushMorphTargetWeights(
  values: number[],
  worldTransformOffset: number,
  weights: readonly [number, number, number, number],
): number {
  const packedOffset = (worldTransformOffset / 16) * 4;

  while (values.length < packedOffset + 4) {
    values.push(0);
  }

  values[packedOffset] = weights[0];
  values[packedOffset + 1] = weights[1];
  values[packedOffset + 2] = weights[2];
  values[packedOffset + 3] = weights[3];

  return packedOffset;
}

function meshHasVertexSemantic(
  mesh: MeshAsset,
  semantic:
    | "JOINTS_0"
    | "WEIGHTS_0"
    | "MORPH_POSITION_0"
    | "MORPH_NORMAL_0"
    | "MORPH_POSITION_1"
    | "MORPH_NORMAL_1",
): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
  );
}

function meshHasStandardMorphTargetAttributes(mesh: MeshAsset): boolean {
  return (
    meshHasVertexSemantic(mesh, "MORPH_POSITION_0") &&
    meshHasVertexSemantic(mesh, "MORPH_NORMAL_0") &&
    meshHasVertexSemantic(mesh, "MORPH_POSITION_1") &&
    meshHasVertexSemantic(mesh, "MORPH_NORMAL_1")
  );
}

const EMPTY_WEIGHTS = new Float32Array(0);

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
