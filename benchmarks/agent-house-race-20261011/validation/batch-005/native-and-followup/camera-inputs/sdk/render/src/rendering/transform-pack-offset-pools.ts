import type {
  MutablePackedInstanceAttributeOffset,
  MutablePackedInstanceTintOffset,
  MutablePackedTransformOffset,
  PackedSnapshotInstanceAttributesScratch,
  PackedSnapshotInstanceTintsScratch,
  PackedSnapshotPreviousTransformsScratch,
  PackedSnapshotTransformsScratch,
} from "./transform-pack-types.js";

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

export function createEmptyOffset(): MutablePackedTransformOffset {
  return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}

export function createEmptyInstanceTintOffset(): MutablePackedInstanceTintOffset {
  return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}

export function createEmptyInstanceAttributeOffset(): MutablePackedInstanceAttributeOffset {
  return { renderId: 0, sourcePacketIndex: 0, packedOffset: 0 };
}
