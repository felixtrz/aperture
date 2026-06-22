import type { RenderSnapshot, ViewPacket } from "./snapshot.js";
import type {
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniforms,
  SnapshotViewUniformPackDiagnostic,
  SnapshotViewUniformPackOptions,
} from "./view-pack-types.js";
import {
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  VIEW_CAMERA_POSITION_FLOAT_OFFSET,
  VIEW_FOG_COLOR_FLOAT_OFFSET,
  VIEW_FOG_PARAMS_FLOAT_OFFSET,
  VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET,
  VIEW_PROJECTION_FLOAT_COUNT,
} from "./view-pack-types.js";
import {
  hasMatrixRange,
  writeCameraPosition,
  writeFogParameters,
  writePreviousViewProjection,
} from "./view-pack-writers.js";

export { createPackedSnapshotViewUniformsScratch } from "./view-pack-scratch.js";
export { writePackedSnapshotViewUniforms } from "./view-pack-write.js";
export {
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  VIEW_CAMERA_POSITION_FLOAT_OFFSET,
  VIEW_FOG_COLOR_FLOAT_OFFSET,
  VIEW_FOG_PARAMS_FLOAT_OFFSET,
  VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET,
  VIEW_PROJECTION_FLOAT_COUNT,
} from "./view-pack-types.js";
export type {
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniforms,
  PackedSnapshotViewUniformsScratch,
  SnapshotViewUniformPackDiagnostic,
  SnapshotViewUniformPackDiagnosticCode,
  SnapshotViewUniformPackOptions,
} from "./view-pack-types.js";

export function packSnapshotViewUniforms(
  snapshot: RenderSnapshot,
  options: SnapshotViewUniformPackOptions = {},
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
    return { data: new Float32Array(0), floatCount: 0, views, diagnostics };
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

    if (!hasMatrixRange(snapshot.viewMatrices, sourceOffset)) {
      diagnostics.push({
        code: "viewUniform.matrixOutOfRange",
        viewId: view.viewId,
        sourceOffset,
        message: `View ${view.viewId} view-projection matrix offset ${sourceOffset} is outside snapshot view matrix data.`,
      });
      continue;
    }

    if (!hasMatrixRange(snapshot.viewMatrices, view.viewMatrixOffset)) {
      diagnostics.push({
        code: "viewUniform.matrixOutOfRange",
        viewId: view.viewId,
        sourceOffset: view.viewMatrixOffset,
        message: `View ${view.viewId} view matrix offset ${view.viewMatrixOffset} is outside snapshot view matrix data.`,
      });
      continue;
    }

    validViews.push(view);
  }

  const data = new Float32Array(
    validViews.length * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  );

  validViews.forEach((view, index) => {
    const sourceOffset = view.viewProjectionMatrixOffset;
    const packedOffset = index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

    data.set(
      snapshot.viewMatrices.subarray(
        sourceOffset,
        sourceOffset + VIEW_PROJECTION_FLOAT_COUNT,
      ),
      packedOffset,
    );
    writeCameraPosition(
      data,
      packedOffset + VIEW_CAMERA_POSITION_FLOAT_OFFSET,
      snapshot.viewMatrices,
      view.viewMatrixOffset,
    );
    writePreviousViewProjection(
      data,
      packedOffset + VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET,
      snapshot.viewMatrices,
      view,
      options.previousViewProjectionByViewId,
    );
    writeFogParameters(
      data,
      packedOffset + VIEW_FOG_COLOR_FLOAT_OFFSET,
      packedOffset + VIEW_FOG_PARAMS_FLOAT_OFFSET,
      snapshot.fogs ?? [],
      view,
    );
    views.push({
      viewId: view.viewId,
      sourceOffset,
      packedOffset,
    });
  });

  return { data, floatCount: data.length, views, diagnostics };
}
