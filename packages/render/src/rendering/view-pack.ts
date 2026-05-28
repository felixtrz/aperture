import { FogMode } from "./authoring.js";
import type { FogPacket, RenderSnapshot, ViewPacket } from "./snapshot.js";
import {
  ensureViewUniformDataCapacity,
  viewRecordAt,
} from "./view-pack-scratch.js";
import type {
  MutablePackedSnapshotViewUniforms,
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniforms,
  PackedSnapshotViewUniformsScratch,
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

export { createPackedSnapshotViewUniformsScratch } from "./view-pack-scratch.js";
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

export function writePackedSnapshotViewUniforms(
  snapshot: RenderSnapshot,
  scratch: PackedSnapshotViewUniformsScratch,
  options: SnapshotViewUniformPackOptions = {},
): PackedSnapshotViewUniforms {
  const result = scratch.result as MutablePackedSnapshotViewUniforms;

  scratch.views.length = 0;
  scratch.diagnostics.length = 0;
  scratch.seenViewIds.clear();
  result.floatCount = 0;

  if (snapshot.views.length === 0) {
    scratch.diagnostics.push({
      code: "viewUniform.emptySnapshot",
      message: "Render snapshot has no views to pack.",
    });
    result.data = scratch.data;
    return scratch.result;
  }

  for (const view of snapshot.views) {
    if (scratch.seenViewIds.has(view.viewId)) {
      scratch.diagnostics.push({
        code: "viewUniform.duplicateViewId",
        viewId: view.viewId,
        message: `Duplicate view id ${view.viewId} in render snapshot.`,
      });
      continue;
    }

    scratch.seenViewIds.add(view.viewId);

    const sourceOffset = view.viewProjectionMatrixOffset;

    if (snapshot.viewMatrices.length === 0) {
      scratch.diagnostics.push({
        code: "viewUniform.missingMatrixData",
        viewId: view.viewId,
        sourceOffset,
        message: `View ${view.viewId} cannot be packed because snapshot view matrix data is empty.`,
      });
      continue;
    }

    if (!hasMatrixRange(snapshot.viewMatrices, sourceOffset)) {
      scratch.diagnostics.push({
        code: "viewUniform.matrixOutOfRange",
        viewId: view.viewId,
        sourceOffset,
        message: `View ${view.viewId} view-projection matrix offset ${sourceOffset} is outside snapshot view matrix data.`,
      });
      continue;
    }

    if (!hasMatrixRange(snapshot.viewMatrices, view.viewMatrixOffset)) {
      scratch.diagnostics.push({
        code: "viewUniform.matrixOutOfRange",
        viewId: view.viewId,
        sourceOffset: view.viewMatrixOffset,
        message: `View ${view.viewId} view matrix offset ${view.viewMatrixOffset} is outside snapshot view matrix data.`,
      });
      continue;
    }

    const packedOffset = result.floatCount;

    ensureViewUniformDataCapacity(
      scratch,
      result.floatCount + PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
    );

    for (let index = 0; index < VIEW_PROJECTION_FLOAT_COUNT; index += 1) {
      scratch.data[result.floatCount + index] =
        snapshot.viewMatrices[sourceOffset + index] ?? 0;
    }
    writeCameraPosition(
      scratch.data,
      result.floatCount + VIEW_CAMERA_POSITION_FLOAT_OFFSET,
      snapshot.viewMatrices,
      view.viewMatrixOffset,
    );
    writePreviousViewProjection(
      scratch.data,
      result.floatCount + VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET,
      snapshot.viewMatrices,
      view,
      options.previousViewProjectionByViewId,
    );
    writeFogParameters(
      scratch.data,
      result.floatCount + VIEW_FOG_COLOR_FLOAT_OFFSET,
      result.floatCount + VIEW_FOG_PARAMS_FLOAT_OFFSET,
      snapshot.fogs ?? [],
      view,
    );

    const record = viewRecordAt(scratch, scratch.views.length);

    record.viewId = view.viewId;
    record.sourceOffset = sourceOffset;
    record.packedOffset = packedOffset;
    scratch.views.push(record);
    result.floatCount += PACKED_VIEW_UNIFORM_FLOAT_STRIDE;
  }

  result.data = scratch.data;
  return scratch.result;
}

function hasMatrixRange(values: Float32Array, sourceOffset: number): boolean {
  return (
    sourceOffset >= 0 &&
    sourceOffset + VIEW_PROJECTION_FLOAT_COUNT <= values.length
  );
}

function writePreviousViewProjection(
  target: Float32Array,
  targetOffset: number,
  viewMatrices: Float32Array,
  view: ViewPacket,
  previousViewProjectionByViewId: ReadonlyMap<number, Float32Array> | undefined,
): void {
  const previous = previousViewProjectionByViewId?.get(view.viewId);

  if (
    previous !== undefined &&
    previous.length >= VIEW_PROJECTION_FLOAT_COUNT
  ) {
    target.set(previous.subarray(0, VIEW_PROJECTION_FLOAT_COUNT), targetOffset);
    return;
  }

  target.set(
    viewMatrices.subarray(
      view.viewProjectionMatrixOffset,
      view.viewProjectionMatrixOffset + VIEW_PROJECTION_FLOAT_COUNT,
    ),
    targetOffset,
  );
}

function writeCameraPosition(
  target: Float32Array,
  targetOffset: number,
  viewMatrices: Float32Array,
  viewMatrixOffset: number,
): void {
  const tx = viewMatrices[viewMatrixOffset + 12] ?? 0;
  const ty = viewMatrices[viewMatrixOffset + 13] ?? 0;
  const tz = viewMatrices[viewMatrixOffset + 14] ?? 0;

  target[targetOffset] = -(
    (viewMatrices[viewMatrixOffset] ?? 1) * tx +
    (viewMatrices[viewMatrixOffset + 1] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 2] ?? 0) * tz
  );
  target[targetOffset + 1] = -(
    (viewMatrices[viewMatrixOffset + 4] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 5] ?? 1) * ty +
    (viewMatrices[viewMatrixOffset + 6] ?? 0) * tz
  );
  target[targetOffset + 2] = -(
    (viewMatrices[viewMatrixOffset + 8] ?? 0) * tx +
    (viewMatrices[viewMatrixOffset + 9] ?? 0) * ty +
    (viewMatrices[viewMatrixOffset + 10] ?? 1) * tz
  );
  target[targetOffset + 3] = 1;
}

function writeFogParameters(
  target: Float32Array,
  colorOffset: number,
  paramsOffset: number,
  fogs: readonly FogPacket[],
  view: ViewPacket,
): void {
  const fog = selectFogForView(fogs, view);

  if (fog === null) {
    target[colorOffset] = 0;
    target[colorOffset + 1] = 0;
    target[colorOffset + 2] = 0;
    target[colorOffset + 3] = 0;
    target[paramsOffset] = 0;
    target[paramsOffset + 1] = 0;
    target[paramsOffset + 2] = 0;
    target[paramsOffset + 3] = 0;
    return;
  }

  target[colorOffset] = fog.color[0] ?? 0;
  target[colorOffset + 1] = fog.color[1] ?? 0;
  target[colorOffset + 2] = fog.color[2] ?? 0;
  target[colorOffset + 3] = fog.color[3] ?? 1;
  target[paramsOffset] = fogModeId(fog.mode);
  target[paramsOffset + 1] = fog.density;
  target[paramsOffset + 2] = fog.start;
  target[paramsOffset + 3] = fog.end;
}

function selectFogForView(
  fogs: readonly FogPacket[],
  view: ViewPacket,
): FogPacket | null {
  for (const fog of fogs) {
    if ((fog.layerMask & view.layerMask) !== 0) {
      return fog;
    }
  }

  return null;
}

function fogModeId(mode: FogMode): number {
  switch (mode) {
    case FogMode.Linear:
      return 1;
    case FogMode.Exp:
      return 2;
    case FogMode.Exp2:
      return 3;
  }
}
