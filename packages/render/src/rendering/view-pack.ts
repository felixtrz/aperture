import type { RenderSnapshot, ViewPacket } from "./snapshot.js";

const VIEW_PROJECTION_FLOAT_COUNT = 16;
const VIEW_CAMERA_POSITION_FLOAT_OFFSET = 16;
export const PACKED_VIEW_UNIFORM_FLOAT_STRIDE = 20;

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
  readonly floatCount?: number;
  readonly views: readonly PackedSnapshotViewUniformRecord[];
  readonly diagnostics: readonly SnapshotViewUniformPackDiagnostic[];
}

export interface PackedSnapshotViewUniformsScratch {
  data: Float32Array;
  readonly views: PackedSnapshotViewUniformRecord[];
  readonly diagnostics: SnapshotViewUniformPackDiagnostic[];
  readonly viewPool: PackedSnapshotViewUniformRecord[];
  readonly seenViewIds: Set<number>;
  readonly result: PackedSnapshotViewUniforms;
}

interface MutablePackedSnapshotViewUniformRecord {
  viewId: number;
  sourceOffset: number;
  packedOffset: number;
}

interface MutablePackedSnapshotViewUniforms {
  data: Float32Array;
  floatCount: number;
  views: readonly PackedSnapshotViewUniformRecord[];
  diagnostics: readonly SnapshotViewUniformPackDiagnostic[];
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
    views.push({
      viewId: view.viewId,
      sourceOffset,
      packedOffset,
    });
  });

  return { data, floatCount: data.length, views, diagnostics };
}

export function createPackedSnapshotViewUniformsScratch(
  floatCapacity = 0,
  viewCapacity = 0,
): PackedSnapshotViewUniformsScratch {
  const data = new Float32Array(floatCapacity);
  const views: PackedSnapshotViewUniformRecord[] = [];
  const diagnostics: SnapshotViewUniformPackDiagnostic[] = [];
  const viewPool: PackedSnapshotViewUniformRecord[] = [];

  for (let index = 0; index < viewCapacity; index += 1) {
    viewPool.push(createEmptyViewRecord());
  }

  return {
    data,
    views,
    diagnostics,
    viewPool,
    seenViewIds: new Set(),
    result: { data, floatCount: 0, views, diagnostics },
  };
}

export function writePackedSnapshotViewUniforms(
  snapshot: RenderSnapshot,
  scratch: PackedSnapshotViewUniformsScratch,
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

function ensureViewUniformDataCapacity(
  scratch: PackedSnapshotViewUniformsScratch,
  required: number,
): void {
  if (scratch.data.length >= required) {
    return;
  }

  let capacity = Math.max(16, scratch.data.length);

  while (capacity < required) {
    capacity *= 2;
  }

  const next = new Float32Array(capacity);

  next.set(scratch.data.subarray(0, scratch.data.length));
  scratch.data = next;
}

function viewRecordAt(
  scratch: PackedSnapshotViewUniformsScratch,
  index: number,
): MutablePackedSnapshotViewUniformRecord {
  const existing = scratch.viewPool[index] as
    | MutablePackedSnapshotViewUniformRecord
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const record = createEmptyViewRecord();

  scratch.viewPool.push(record);
  return record;
}

function createEmptyViewRecord(): MutablePackedSnapshotViewUniformRecord {
  return { viewId: 0, sourceOffset: 0, packedOffset: 0 };
}
