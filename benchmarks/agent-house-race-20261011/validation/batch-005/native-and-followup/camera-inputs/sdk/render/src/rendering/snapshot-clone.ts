import type { RenderSnapshot } from "./snapshot.js";

export type RenderSnapshotCloneDiagnosticCode =
  | "renderSnapshotClone.invalidTransformBuffer"
  | "renderSnapshotClone.invalidViewMatrixBuffer"
  | "renderSnapshotClone.cloneFailed";

export interface RenderSnapshotCloneDiagnostic {
  readonly code: RenderSnapshotCloneDiagnosticCode;
  readonly message: string;
}

export interface RenderSnapshotCloneabilityResult {
  readonly valid: boolean;
  readonly diagnostics: readonly RenderSnapshotCloneDiagnostic[];
}

export interface RenderSnapshotCloneabilityOptions {
  readonly clone?: (value: RenderSnapshot) => unknown;
}

export function validateRenderSnapshotCloneability(
  snapshot: RenderSnapshot,
  options: RenderSnapshotCloneabilityOptions = {},
): RenderSnapshotCloneabilityResult {
  const diagnostics: RenderSnapshotCloneDiagnostic[] = [];

  if (!(snapshot.transforms instanceof Float32Array)) {
    diagnostics.push({
      code: "renderSnapshotClone.invalidTransformBuffer",
      message: "RenderSnapshot.transforms must be a Float32Array.",
    });
  }

  if (!(snapshot.viewMatrices instanceof Float32Array)) {
    diagnostics.push({
      code: "renderSnapshotClone.invalidViewMatrixBuffer",
      message: "RenderSnapshot.viewMatrices must be a Float32Array.",
    });
  }

  try {
    (options.clone ?? defaultClone)(snapshot);
  } catch (cause) {
    diagnostics.push({
      code: "renderSnapshotClone.cloneFailed",
      message:
        cause instanceof Error
          ? cause.message
          : "RenderSnapshot structured clone failed.",
    });
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function defaultClone(value: RenderSnapshot): unknown {
  return structuredClone(value);
}
