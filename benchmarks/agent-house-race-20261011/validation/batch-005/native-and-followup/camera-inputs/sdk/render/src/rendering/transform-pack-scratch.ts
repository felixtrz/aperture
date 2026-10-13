import type { RenderDiagnostic } from "./snapshot.js";
import {
  createEmptyInstanceAttributeOffset,
  createEmptyInstanceTintOffset,
  createEmptyOffset,
} from "./transform-pack-offset-pools.js";
import type {
  PackedInstanceAttributeOffset,
  PackedInstanceTintOffset,
  PackedSnapshotInstanceAttributesScratch,
  PackedSnapshotInstanceTintsScratch,
  PackedSnapshotPreviousTransformsScratch,
  PackedSnapshotTransformsScratch,
  PackedTransformOffset,
} from "./transform-pack-types.js";

export {
  ensureInstanceAttributeDataCapacity,
  ensureInstanceTintDataCapacity,
  ensurePreviousTransformDataCapacity,
  ensureTransformDataCapacity,
  ensureTransformNextDataCapacity,
} from "./transform-pack-scratch-capacity.js";
export {
  instanceAttributeOffsetAt,
  instanceTintOffsetAt,
  offsetAt,
  previousOffsetAt,
} from "./transform-pack-offset-pools.js";

export function createPackedSnapshotTransformsScratch(
  floatCapacity = 0,
  offsetCapacity = 0,
): PackedSnapshotTransformsScratch {
  const offsets: PackedTransformOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const offsetPool: PackedTransformOffset[] = [];
  const data = new Float32Array(floatCapacity);
  const nextData = new Float32Array(floatCapacity);

  for (let i = 0; i < offsetCapacity; i += 1) {
    offsetPool.push(createEmptyOffset());
  }

  return {
    data,
    nextData,
    offsets,
    diagnostics,
    offsetPool,
    sourceOffsets: [],
    sourceOffsetToPackedOffset: new Map(),
    result: { data, floatCount: 0, offsets, diagnostics, contentVersion: 0 },
    lastFloatCount: -1,
    contentVersion: 0,
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
