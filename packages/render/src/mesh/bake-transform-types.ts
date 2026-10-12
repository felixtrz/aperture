import type { MeshAsset } from "./types.js";

/** Hard work/copy bounds for the static source-mesh bake operation. */
export const MESH_BAKE_TRANSFORM_LIMITS = Object.freeze({
  vertices: 2_000_000,
  indices: 6_000_000,
  triangleCorners: 6_000_000,
  bytes: 128 * 1024 * 1024,
  streams: 16,
  attributesPerStream: 16,
  submeshes: 4_096,
  materialSlots: 4_096,
});

export interface BakeMeshAssetTransformOptions {
  readonly mesh: MeshAsset;
  /** Exactly 16 finite column-major values, with affine last row [0,0,0,1]. */
  readonly transform: ArrayLike<number>;
  readonly label?: string;
}

export type MeshBakeTransformDiagnosticCode =
  | "meshBake.invalidTransform"
  | "meshBake.singularTransform"
  | "meshBake.invalidSourceMesh"
  | "meshBake.unsupportedLayout"
  | "meshBake.limitExceeded"
  | "meshBake.nonFiniteOutput"
  | "meshBake.degenerateTriangle";

export interface MeshBakeTransformDiagnostic {
  readonly code: MeshBakeTransformDiagnosticCode;
  readonly severity: "error";
  readonly path: string;
  readonly message: string;
}

export interface BakeMeshAssetTransformResult {
  readonly valid: boolean;
  /** New owned buffers and metadata. Never a partial mesh on failure. */
  readonly mesh: MeshAsset | null;
  readonly diagnostics: readonly MeshBakeTransformDiagnostic[];
}

export class MeshBakeFailure extends Error {
  constructor(readonly diagnostic: MeshBakeTransformDiagnostic) {
    super(diagnostic.message);
  }
}

export function bakeFailure(
  diagnostic: Omit<MeshBakeTransformDiagnostic, "severity">,
): never {
  throw new MeshBakeFailure({ ...diagnostic, severity: "error" });
}
