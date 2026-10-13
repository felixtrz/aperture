import {
  decodeGltfFloatAccessor,
  type GltfBufferResolver,
} from "./gltf-accessor-float-reader.js";

/**
 * Parse `gltf.skins` into engine-owned skeleton descriptors: joint node
 * indices, inverse-bind matrices (decoded via the shared engine accessor
 * reader, not the worker's bespoke `readSkinInverseBindMatrices`), and the
 * optional skeleton-root node. The command plan (M2-T3) turns these into a
 * `Skin` add-component command whose joint node indices are resolved to live
 * entities at replay time.
 */

const MATRIX_FLOATS = 16;

export interface GltfImportedSkin {
  readonly skinIndex: number;
  /** glTF node indices of the joints, in skin.joints order. */
  readonly jointNodeIndices: readonly number[];
  readonly jointCount: number;
  /** Flat column-major inverse-bind matrices, length === jointCount * 16. */
  readonly inverseBindMatrices: Float32Array;
  /** glTF node index of the common skeleton root, or null. */
  readonly skeletonNodeIndex: number | null;
}

export type GltfSkinImportDiagnosticCode =
  | "gltfSkin.malformedSkins"
  | "gltfSkin.malformedSkin"
  | "gltfSkin.missingJoints"
  | "gltfSkin.invalidJointIndex"
  | "gltfSkin.inverseBindDecodeFailed"
  | "gltfSkin.inverseBindCountMismatch";

export interface GltfSkinImportDiagnostic {
  readonly code: GltfSkinImportDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly skinIndex?: number;
}

export interface GltfSkinImportReport {
  readonly valid: boolean;
  readonly skins: readonly GltfImportedSkin[];
  readonly diagnostics: readonly GltfSkinImportDiagnostic[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerOrNull(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

function identityMatrixInto(target: Float32Array, offset: number): void {
  // Column-major identity.
  target[offset] = 1;
  target[offset + 5] = 1;
  target[offset + 10] = 1;
  target[offset + 15] = 1;
}

/** Parse all skins from a glTF root into engine skeleton descriptors. */
export function importGltfSkins(input: {
  readonly root: unknown;
  readonly resolveBufferBytes: GltfBufferResolver;
}): GltfSkinImportReport {
  const diagnostics: GltfSkinImportDiagnostic[] = [];
  const skins: GltfImportedSkin[] = [];

  const root = input.root;
  if (!isRecord(root) || root.skins === undefined) {
    return { valid: true, skins, diagnostics };
  }

  if (!Array.isArray(root.skins)) {
    diagnostics.push({
      code: "gltfSkin.malformedSkins",
      severity: "error",
      message: "glTF skins must be an array when present.",
    });
    return { valid: false, skins, diagnostics };
  }

  root.skins.forEach((rawSkin, skinIndex) => {
    if (!isRecord(rawSkin)) {
      diagnostics.push({
        code: "gltfSkin.malformedSkin",
        severity: "error",
        skinIndex,
        message: `glTF skin ${skinIndex} must be an object.`,
      });
      return;
    }

    if (!Array.isArray(rawSkin.joints) || rawSkin.joints.length === 0) {
      diagnostics.push({
        code: "gltfSkin.missingJoints",
        severity: "error",
        skinIndex,
        message: `glTF skin ${skinIndex} must declare a non-empty joints array.`,
      });
      return;
    }

    const jointNodeIndices: number[] = [];
    let invalidJoint = false;
    for (const joint of rawSkin.joints) {
      const jointIndex = integerOrNull(joint);
      if (jointIndex === null) {
        diagnostics.push({
          code: "gltfSkin.invalidJointIndex",
          severity: "error",
          skinIndex,
          message: `glTF skin ${skinIndex} has an invalid joint node reference '${String(joint)}'.`,
        });
        invalidJoint = true;
        break;
      }
      jointNodeIndices.push(jointIndex);
    }
    if (invalidJoint) {
      return;
    }

    const jointCount = jointNodeIndices.length;
    const inverseBindMatrices = new Float32Array(jointCount * MATRIX_FLOATS);
    const accessorIndex = integerOrNull(rawSkin.inverseBindMatrices);

    if (accessorIndex === null) {
      // Spec default: identity inverse-bind matrices.
      for (let i = 0; i < jointCount; i += 1) {
        identityMatrixInto(inverseBindMatrices, i * MATRIX_FLOATS);
      }
    } else {
      const decoded = decodeGltfFloatAccessor({
        root,
        accessorIndex,
        resolveBufferBytes: input.resolveBufferBytes,
      });
      if (decoded === null || decoded.componentCount !== MATRIX_FLOATS) {
        diagnostics.push({
          code: "gltfSkin.inverseBindDecodeFailed",
          severity: "error",
          skinIndex,
          message: `glTF skin ${skinIndex} inverse-bind matrices accessor ${accessorIndex} could not be decoded as MAT4.`,
        });
        return;
      }
      if (decoded.count < jointCount) {
        diagnostics.push({
          code: "gltfSkin.inverseBindCountMismatch",
          severity: "warning",
          skinIndex,
          message: `glTF skin ${skinIndex} provides ${decoded.count} inverse-bind matrices for ${jointCount} joints; missing entries default to identity.`,
        });
      }
      for (let i = 0; i < jointCount; i += 1) {
        if (i < decoded.count) {
          inverseBindMatrices.set(
            decoded.values.subarray(
              i * MATRIX_FLOATS,
              i * MATRIX_FLOATS + MATRIX_FLOATS,
            ),
            i * MATRIX_FLOATS,
          );
        } else {
          identityMatrixInto(inverseBindMatrices, i * MATRIX_FLOATS);
        }
      }
    }

    skins.push({
      skinIndex,
      jointNodeIndices,
      jointCount,
      inverseBindMatrices,
      skeletonNodeIndex: integerOrNull(rawSkin.skeleton),
    });
  });

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    skins,
    diagnostics,
  };
}

/** Look up an imported skin by its glTF index. */
export function findImportedSkin(
  report: GltfSkinImportReport,
  skinIndex: number,
): GltfImportedSkin | null {
  return report.skins.find((skin) => skin.skinIndex === skinIndex) ?? null;
}
