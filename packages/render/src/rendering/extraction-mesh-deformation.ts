import type { Entity } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import { MorphTargetWeights, Skin } from "./index.js";
import type { RenderDiagnostic } from "./snapshot.js";
import { diagnostic } from "./extraction-diagnostics.js";

export interface SkinExtraction {
  readonly jointMatrices: readonly number[];
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
  const jointMatricesJson = entity.getValue(Skin, "jointMatricesJson") ?? "[]";
  let parsed: unknown;

  try {
    parsed = JSON.parse(jointMatricesJson);
  } catch {
    diagnostics.push(diagnostic("render.skinning.invalidJson", entity));
    return null;
  }

  if (!Array.isArray(parsed)) {
    diagnostics.push(diagnostic("render.skinning.invalidMatrices", entity));
    return null;
  }

  const jointMatrices = parseFiniteNumberArray(parsed);

  if (jointMatrices === null || jointMatrices.length === 0) {
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

  values.push(...skinning.jointMatrices);
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

  const weightsJson =
    entity.getValue(MorphTargetWeights, "weightsJson") ?? "[]";
  let parsed: unknown;

  try {
    parsed = JSON.parse(weightsJson);
  } catch {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidJson", entity),
    );
    return null;
  }

  if (!Array.isArray(parsed)) {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidWeights", entity),
    );
    return null;
  }

  const weights = parseFiniteNumberArray(parsed);

  if (weights === null) {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidWeights", entity),
    );
    return null;
  }

  return [
    clamp(weights[0] ?? 0, -1, 1),
    clamp(weights[1] ?? 0, -1, 1),
    clamp(weights[2] ?? 0, -1, 1),
    clamp(weights[3] ?? 0, -1, 1),
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

function parseFiniteNumberArray(values: readonly unknown[]): number[] | null {
  const result: number[] = [];

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    result.push(value);
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
