import {
  decodeGltfFloatAccessor,
  type GltfBufferResolver,
} from "./gltf-accessor-float-reader.js";

/**
 * Parse ALL of a primitive's `gltf.meshes[].primitives[].targets[]` morph
 * deltas into engine-owned typed buffers, decoded via the shared engine
 * accessor reader. This lifts the structural 2-target cap on import: an
 * arbitrary target count (e.g. the 52 ARKit blendshapes) is imported without
 * dropping targets.
 *
 * The flat delta layout is target-major: for target `t`, vertex `v`, the
 * position delta is at `positionDeltas[(t * vertexCount + v) * 3 ..]` (and
 * likewise `normalDeltas`, zero-filled where a target lacks NORMAL).
 *
 * This is the import representation behind done-when M2-T7 #1/#4; the GPU
 * render consumes the first targets via the vertex-attribute path today, with
 * a morph-target data texture (full N render) as the documented follow-up.
 */

const VEC3 = 3;

export interface GltfImportedPrimitiveMorphTargets {
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly targetCount: number;
  readonly vertexCount: number;
  readonly hasNormals: boolean;
  /** Target-major position deltas, length === targetCount * vertexCount * 3. */
  readonly positionDeltas: Float32Array;
  /** Target-major normal deltas (zero where absent), same length. */
  readonly normalDeltas: Float32Array;
}

export type GltfMorphTargetImportDiagnosticCode =
  | "gltfMorph.malformedMeshes"
  | "gltfMorph.malformedTarget"
  | "gltfMorph.positionDecodeFailed"
  | "gltfMorph.vertexCountMismatch";

export interface GltfMorphTargetImportDiagnostic {
  readonly code: GltfMorphTargetImportDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly targetIndex?: number;
}

export interface GltfMorphTargetImportReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfImportedPrimitiveMorphTargets[];
  readonly diagnostics: readonly GltfMorphTargetImportDiagnostic[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerOrNull(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

/** Import every morph target of every mesh primitive in a glTF root. */
export function importGltfMorphTargets(input: {
  readonly root: unknown;
  readonly resolveBufferBytes: GltfBufferResolver;
}): GltfMorphTargetImportReport {
  const diagnostics: GltfMorphTargetImportDiagnostic[] = [];
  const primitives: GltfImportedPrimitiveMorphTargets[] = [];
  const root = input.root;

  if (!isRecord(root) || root.meshes === undefined) {
    return { valid: true, primitives, diagnostics };
  }

  if (!Array.isArray(root.meshes)) {
    diagnostics.push({
      code: "gltfMorph.malformedMeshes",
      severity: "error",
      message: "glTF meshes must be an array when present.",
    });
    return { valid: false, primitives, diagnostics };
  }

  root.meshes.forEach((rawMesh, meshIndex) => {
    if (!isRecord(rawMesh) || !Array.isArray(rawMesh.primitives)) {
      return;
    }
    rawMesh.primitives.forEach((rawPrimitive, primitiveIndex) => {
      if (!isRecord(rawPrimitive) || !Array.isArray(rawPrimitive.targets)) {
        return;
      }
      const imported = importPrimitiveMorphTargets({
        root,
        resolveBufferBytes: input.resolveBufferBytes,
        targets: rawPrimitive.targets,
        meshIndex,
        primitiveIndex,
        diagnostics,
      });
      if (imported !== null) {
        primitives.push(imported);
      }
    });
  });

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    primitives,
    diagnostics,
  };
}

function importPrimitiveMorphTargets(input: {
  readonly root: unknown;
  readonly resolveBufferBytes: GltfBufferResolver;
  readonly targets: readonly unknown[];
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly diagnostics: GltfMorphTargetImportDiagnostic[];
}): GltfImportedPrimitiveMorphTargets | null {
  const targetCount = input.targets.length;
  if (targetCount === 0) {
    return null;
  }

  let vertexCount = -1;
  let hasNormals = false;
  const positionTuples: (Float32Array | null)[] = [];
  const normalTuples: (Float32Array | null)[] = [];

  for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
    const target = input.targets[targetIndex];
    if (!isRecord(target)) {
      input.diagnostics.push({
        code: "gltfMorph.malformedTarget",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        targetIndex,
        message: `glTF mesh ${input.meshIndex} primitive ${input.primitiveIndex} target ${targetIndex} must be an object.`,
      });
      return null;
    }

    const positionAccessor = integerOrNull(target.POSITION);
    if (positionAccessor === null) {
      input.diagnostics.push({
        code: "gltfMorph.positionDecodeFailed",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        targetIndex,
        message: `glTF morph target ${targetIndex} is missing a POSITION accessor.`,
      });
      return null;
    }
    const decodedPosition = decodeGltfFloatAccessor({
      root: input.root,
      accessorIndex: positionAccessor,
      resolveBufferBytes: input.resolveBufferBytes,
    });
    if (decodedPosition === null || decodedPosition.componentCount !== VEC3) {
      input.diagnostics.push({
        code: "gltfMorph.positionDecodeFailed",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        targetIndex,
        message: `glTF morph target ${targetIndex} POSITION accessor ${positionAccessor} could not be decoded as VEC3.`,
      });
      return null;
    }

    if (vertexCount < 0) {
      vertexCount = decodedPosition.count;
    } else if (decodedPosition.count !== vertexCount) {
      input.diagnostics.push({
        code: "gltfMorph.vertexCountMismatch",
        severity: "error",
        meshIndex: input.meshIndex,
        primitiveIndex: input.primitiveIndex,
        targetIndex,
        message: `glTF morph target ${targetIndex} has ${decodedPosition.count} vertices, expected ${vertexCount}.`,
      });
      return null;
    }
    positionTuples.push(decodedPosition.values);

    const normalAccessor = integerOrNull(target.NORMAL);
    if (normalAccessor === null) {
      normalTuples.push(null);
    } else {
      const decodedNormal = decodeGltfFloatAccessor({
        root: input.root,
        accessorIndex: normalAccessor,
        resolveBufferBytes: input.resolveBufferBytes,
      });
      if (
        decodedNormal !== null &&
        decodedNormal.componentCount === VEC3 &&
        decodedNormal.count === vertexCount
      ) {
        hasNormals = true;
        normalTuples.push(decodedNormal.values);
      } else {
        normalTuples.push(null);
      }
    }
  }

  const stride = vertexCount * VEC3;
  const positionDeltas = new Float32Array(targetCount * stride);
  const normalDeltas = new Float32Array(targetCount * stride);
  for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
    const position = positionTuples[targetIndex];
    if (position !== null && position !== undefined) {
      positionDeltas.set(position.subarray(0, stride), targetIndex * stride);
    }
    const normal = normalTuples[targetIndex];
    if (normal !== null && normal !== undefined) {
      normalDeltas.set(normal.subarray(0, stride), targetIndex * stride);
    }
  }

  return {
    meshIndex: input.meshIndex,
    primitiveIndex: input.primitiveIndex,
    targetCount,
    vertexCount,
    hasNormals,
    positionDeltas,
    normalDeltas,
  };
}
