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

export interface MorphExtraction {
  /** Number of morph targets the mesh carries (N, not capped). */
  readonly targetCount: number;
  /** Vertex count of the morphed mesh (delta indexing stride). */
  readonly vertexCount: number;
  /** Per-target blended weights, length === `targetCount`. */
  readonly weights: Float32Array;
  /** Target-major position deltas (the mesh's payload, by reference). */
  readonly positionDeltas: Float32Array;
  /** Target-major normal deltas (the mesh's payload, by reference). */
  readonly normalDeltas: Float32Array;
}

const VEC3 = 3;

export function readMorphTargetWeights(
  entity: Entity,
  mesh: MeshAsset,
  diagnostics: RenderDiagnostic[],
): MorphExtraction | undefined | null {
  const data = mesh.morphTargetData;

  if (data === undefined || data.targetCount === 0) {
    return undefined;
  }

  const targetCount = data.targetCount;
  const out = new Float32Array(targetCount);

  if (entity.hasComponent(MorphTargetWeights)) {
    // Read the typed weight buffer directly — no JSON.parse, no intermediate
    // allocation, and no [-1, 1] clamp (glTF weights are unbounded). The typed
    // buffer holds an arbitrary target count (e.g. 52 ARKit blendshapes); all
    // of them flow into the snapshot and the N-target storage-buffer GPU render.
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
    const shared = Math.min(targetCount, values.length);
    for (let index = 0; index < shared; index += 1) {
      out[index] = finiteOrZero(values[index]);
    }
  }

  return {
    targetCount,
    vertexCount: data.vertexCount,
    weights: out,
    positionDeltas: data.positionDeltas,
    normalDeltas: data.normalDeltas,
  };
}

/**
 * Append a morphed instance's `targetCount` weights to the flat snapshot weight
 * buffer and return the float offset at which they start.
 */
export function pushMorphTargetWeights(
  values: number[],
  morph: MorphExtraction,
): number {
  const offset = values.length;
  for (let index = 0; index < morph.targetCount; index += 1) {
    values.push(morph.weights[index] ?? 0);
  }
  return offset;
}

/**
 * Append a morphed mesh's target-major deltas (positions then normals) to the
 * flat snapshot delta buffer and return the float offset at which they start.
 */
export function pushMorphTargetDeltas(
  values: number[],
  morph: MorphExtraction,
): number {
  const offset = values.length;
  const span = morph.targetCount * morph.vertexCount * VEC3;
  for (let index = 0; index < span; index += 1) {
    values.push(morph.positionDeltas[index] ?? 0);
  }
  for (let index = 0; index < span; index += 1) {
    values.push(morph.normalDeltas[index] ?? 0);
  }
  return offset;
}

/**
 * Write a morphed instance's descriptor (weightOffset, targetCount, deltaOffset,
 * vertexCount) into the per-instance descriptor buffer at its transform slot.
 */
export function pushMorphInstanceDescriptor(
  descriptors: number[],
  worldTransformOffset: number,
  descriptor: {
    readonly weightOffset: number;
    readonly targetCount: number;
    readonly deltaOffset: number;
    readonly vertexCount: number;
  },
): void {
  const slot = (worldTransformOffset / 16) * 4;
  while (descriptors.length < slot + 4) {
    descriptors.push(0);
  }
  descriptors[slot] = descriptor.weightOffset;
  descriptors[slot + 1] = descriptor.targetCount;
  descriptors[slot + 2] = descriptor.deltaOffset;
  descriptors[slot + 3] = descriptor.vertexCount;
}

function meshHasVertexSemantic(
  mesh: MeshAsset,
  semantic: "JOINTS_0" | "WEIGHTS_0",
): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
  );
}

const EMPTY_WEIGHTS = new Float32Array(0);

function finiteOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
