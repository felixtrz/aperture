import type {
  MutablePackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniformsScratch,
  SnapshotViewUniformPackDiagnostic,
} from "./view-pack-types.js";

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

export function ensureViewUniformDataCapacity(
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

export function viewRecordAt(
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
