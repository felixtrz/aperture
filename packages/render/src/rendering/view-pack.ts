import type { RenderSnapshot, ViewPacket } from "./snapshot.js";

export type SnapshotViewUniformPackDiagnosticCode =
  | "viewUniform.emptySnapshot"
  | "viewUniform.duplicateViewId"
  | "viewUniform.missingMatrixData"
  | "viewUniform.matrixOutOfRange";

export interface SnapshotViewUniformPackDiagnostic {
  readonly code: SnapshotViewUniformPackDiagnosticCode;
  readonly message: string;
  readonly viewId?: number;
  readonly sourceOffset?: number;
}

export interface PackedSnapshotViewUniformRecord {
  readonly viewId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotViewUniforms {
  readonly data: Float32Array;
  readonly views: readonly PackedSnapshotViewUniformRecord[];
  readonly diagnostics: readonly SnapshotViewUniformPackDiagnostic[];
}

export function packSnapshotViewUniforms(
  snapshot: RenderSnapshot,
): PackedSnapshotViewUniforms {
  const diagnostics: SnapshotViewUniformPackDiagnostic[] = [];
  const views: PackedSnapshotViewUniformRecord[] = [];
  const seen = new Set<number>();
  const validViews: ViewPacket[] = [];

  if (snapshot.views.length === 0) {
    diagnostics.push({
      code: "viewUniform.emptySnapshot",
      message: "Render snapshot has no views to pack.",
    });
    return { data: new Float32Array(0), views, diagnostics };
  }

  for (const view of snapshot.views) {
    if (seen.has(view.viewId)) {
      diagnostics.push({
        code: "viewUniform.duplicateViewId",
        viewId: view.viewId,
        message: `Duplicate view id ${view.viewId} in render snapshot.`,
      });
      continue;
    }

    seen.add(view.viewId);

    const sourceOffset = view.viewProjectionMatrixOffset;

    if (snapshot.viewMatrices.length === 0) {
      diagnostics.push({
        code: "viewUniform.missingMatrixData",
        viewId: view.viewId,
        sourceOffset,
        message: `View ${view.viewId} cannot be packed because snapshot view matrix data is empty.`,
      });
      continue;
    }

    if (sourceOffset < 0 || sourceOffset + 16 > snapshot.viewMatrices.length) {
      diagnostics.push({
        code: "viewUniform.matrixOutOfRange",
        viewId: view.viewId,
        sourceOffset,
        message: `View ${view.viewId} view-projection matrix offset ${sourceOffset} is outside snapshot view matrix data.`,
      });
      continue;
    }

    validViews.push(view);
  }

  const data = new Float32Array(validViews.length * 16);

  validViews.forEach((view, index) => {
    const sourceOffset = view.viewProjectionMatrixOffset;
    const packedOffset = index * 16;

    data.set(
      snapshot.viewMatrices.subarray(sourceOffset, sourceOffset + 16),
      packedOffset,
    );
    views.push({
      viewId: view.viewId,
      sourceOffset,
      packedOffset,
    });
  });

  return { data, views, diagnostics };
}
