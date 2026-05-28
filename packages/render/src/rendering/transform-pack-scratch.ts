import type { RenderDiagnostic } from "./snapshot.js";
import type {
  MutablePackedInstanceAttributeOffset,
  MutablePackedInstanceTintOffset,
  MutablePackedTransformOffset,
  PackedInstanceAttributeOffset,
  PackedInstanceTintOffset,
  PackedSnapshotInstanceAttributesScratch,
  PackedSnapshotInstanceTintsScratch,
  PackedSnapshotPreviousTransformsScratch,
  PackedSnapshotTransformsScratch,
  PackedTransformOffset,
} from "./transform-pack-types.js";

export function createPackedSnapshotTransformsScratch(
  floatCapacity = 0,
  offsetCapacity = 0,
): PackedSnapshotTransformsScratch {
  const offsets: PackedTransformOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const offsetPool: PackedTransformOffset[] = [];
  const data = new Float32Array(floatCapacity);

  for (let i = 0; i < offsetCapacity; i += 1) {
    offsetPool.push(createEmptyOffset());
  }

  return {
    data,
    offsets,
    diagnostics,
    offsetPool,
    sourceToPackedOffset: new Map(),
    result: { data, floatCount: 0, offsets, diagnostics },
  };
}

export function createPackedSnapshotPreviousTransformsScratch(
  floatCapacity = 0,
  offsetCapacity = 0,
): PackedSnapshotPreviousTransformsScratch {
  const offsets: PackedTransformOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const offsetPool: PackedTransformOffset[] = [];
  const missing: number[] = [];
  const data = new Float32Array(floatCapacity);
  const history = { total: 0, used: 0, fallback: 0, missing };

  for (let i = 0; i < offsetCapacity; i += 1) {
    offsetPool.push(createEmptyOffset());
  }

  return {
    data,
    offsets,
    diagnostics,
    offsetPool,
    missing,
    history,
    result: { data, floatCount: 0, offsets, diagnostics, history },
  };
}

export function createPackedSnapshotInstanceTintsScratch(
  floatCapacity = 0,
  offsetCapacity = 0,
): PackedSnapshotInstanceTintsScratch {
  const offsets: PackedInstanceTintOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const offsetPool: PackedInstanceTintOffset[] = [];
  const data = new Float32Array(floatCapacity);

  for (let i = 0; i < offsetCapacity; i += 1) {
    offsetPool.push(createEmptyInstanceTintOffset());
  }

  return {
    data,
    offsets,
    diagnostics,
    offsetPool,
    result: { data, floatCount: 0, offsets, diagnostics },
  };
}

export function createPackedSnapshotInstanceAttributesScratch(
  floatCapacity = 0,
  offsetCapacity = 0,
): PackedSnapshotInstanceAttributesScratch {
  const offsets: PackedInstanceAttributeOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const offsetPool: PackedInstanceAttributeOffset[] = [];
  const data = new Float32Array(floatCapacity);

  for (let i = 0; i < offsetCapacity; i += 1) {
    offsetPool.push(createEmptyInstanceAttributeOffset());
  }

  return {
    data,
    offsets,
    diagnostics,
    offsetPool,
    result: {
      layout: {
        attributes: [],
        stride: 0,
        strideFloats: 0,
        layoutKey: "",
      },
      data,
      floatCount: 0,
      offsets,
      diagnostics,
    },
  };
}

export function ensureTransformDataCapacity(
  scratch: PackedSnapshotTransformsScratch,
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

export function ensurePreviousTransformDataCapacity(
  scratch: PackedSnapshotPreviousTransformsScratch,
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

export function ensureInstanceTintDataCapacity(
  scratch: PackedSnapshotInstanceTintsScratch,
  required: number,
): void {
  if (scratch.data.length >= required) {
    return;
  }

  let capacity = Math.max(4, scratch.data.length);

  while (capacity < required) {
    capacity *= 2;
  }

  scratch.data = new Float32Array(capacity);
}

export function ensureInstanceAttributeDataCapacity(
  scratch: PackedSnapshotInstanceAttributesScratch,
  required: number,
): void {
  if (scratch.data.length >= required) {
    return;
  }

  let capacity = Math.max(4, scratch.data.length);

  while (capacity < required) {
    capacity *= 2;
  }

  scratch.data = new Float32Array(capacity);
}

export function offsetAt(
  scratch: PackedSnapshotTransformsScratch,
  index: number,
): MutablePackedTransformOffset {
  const existing = scratch.offsetPool[index] as
    | MutablePackedTransformOffset
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const offset = createEmptyOffset();

  scratch.offsetPool.push(offset);
  return offset;
}

export function previousOffsetAt(
  scratch: PackedSnapshotPreviousTransformsScratch,
  index: number,
): MutablePackedTransformOffset {
  const existing = scratch.offsetPool[index] as
    | MutablePackedTransformOffset
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const offset = createEmptyOffset();

  scratch.offsetPool.push(offset);
  return offset;
}

export function instanceTintOffsetAt(
  scratch: PackedSnapshotInstanceTintsScratch,
  index: number,
): MutablePackedInstanceTintOffset {
  const existing = scratch.offsetPool[index] as
    | MutablePackedInstanceTintOffset
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const offset = createEmptyInstanceTintOffset();

  scratch.offsetPool.push(offset);
  return offset;
}

export function instanceAttributeOffsetAt(
  scratch: PackedSnapshotInstanceAttributesScratch,
  index: number,
): MutablePackedInstanceAttributeOffset {
  const existing = scratch.offsetPool[index] as
    | MutablePackedInstanceAttributeOffset
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const offset = createEmptyInstanceAttributeOffset();

  scratch.offsetPool.push(offset);
  return offset;
}

function createEmptyOffset(): MutablePackedTransformOffset {
  return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}

function createEmptyInstanceTintOffset(): MutablePackedInstanceTintOffset {
  return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}

function createEmptyInstanceAttributeOffset(): MutablePackedInstanceAttributeOffset {
  return { renderId: 0, sourcePacketIndex: 0, packedOffset: 0 };
}
