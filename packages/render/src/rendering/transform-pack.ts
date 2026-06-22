import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
import {
  ensureTransformDataCapacity,
  ensureTransformNextDataCapacity,
  offsetAt,
} from "./transform-pack-scratch.js";
import type {
  MutablePackedSnapshotTransforms,
  PackedSnapshotTransforms,
  PackedSnapshotTransformsScratch,
  PackedTransformDirtyRange,
  PackedTransformOffset,
} from "./transform-pack-types.js";
import {
  hasTransform,
  missingTransformDiagnostic,
} from "./transform-pack-guards.js";

export {
  createPackedSnapshotInstanceAttributesScratch,
  createPackedSnapshotInstanceTintsScratch,
  createPackedSnapshotPreviousTransformsScratch,
  createPackedSnapshotTransformsScratch,
} from "./transform-pack-scratch.js";

export type * from "./transform-pack-types.js";
export {
  rememberPackedSnapshotTransformsByRenderId,
  writePackedSnapshotPreviousTransforms,
} from "./transform-pack-history.js";
export {
  packSnapshotInstanceAttributesForVertexBuffer,
  packSnapshotInstanceTints,
  packSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotInstanceAttributesForVertexBuffer,
  writePackedSnapshotInstanceTintsForVertexBuffer,
} from "./transform-pack-instances.js";

export function packSnapshotTransforms(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
): PackedSnapshotTransforms {
  const offsets: PackedTransformOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.worldTransformOffset;

    if (!hasTransform(snapshot.transforms, sourceOffset)) {
      diagnostics.push(missingTransformDiagnostic(draw, snapshot.transforms));
      continue;
    }

    offsets.push({
      renderId: draw.renderId,
      sourceOffset,
      packedOffset: sourceOffset,
    });
  }

  return {
    data: new Float32Array(snapshot.transforms),
    floatCount: snapshot.transforms.length,
    offsets,
    diagnostics,
  };
}

/**
 * Above this fraction of changed floats the dirty range degrades to one full
 * write (`full: true`) — a near-whole-buffer sub-range write has no upload
 * advantage over a plain whole-buffer write (AI-64 fallback).
 */
export const TRANSFORM_DIRTY_FULL_WRITE_FRACTION = 0.5;
export const TRANSFORM_DIRTY_FULL_SPAN_FRACTION = 0.875;
export const TRANSFORM_DIRTY_MAX_RANGES = 16;
const MATRIX_FLOATS = 16;

export function writePackedSnapshotTransforms(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
  scratch: PackedSnapshotTransformsScratch,
): PackedSnapshotTransforms {
  const result = scratch.result as MutablePackedSnapshotTransforms;
  const floatCount = snapshot.transforms.length;
  const comparable =
    scratch.lastFloatCount === floatCount && scratch.data.length >= floatCount;

  scratch.offsets.length = 0;
  scratch.diagnostics.length = 0;
  result.floatCount = floatCount;
  ensureTransformDataCapacity(scratch, floatCount);
  const dirty = writeTransformDataWithDirtyRange(
    scratch.data,
    snapshot.transforms,
    floatCount,
    comparable,
  );
  result.dirtyRange = dirty.range;
  result.dirtyRanges = dirty.ranges;
  scratch.lastFloatCount = floatCount;

  if (dirty.range !== null) {
    scratch.contentVersion += 1;
  }

  result.contentVersion = scratch.contentVersion;

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.worldTransformOffset;

    if (!hasTransform(snapshot.transforms, sourceOffset)) {
      scratch.diagnostics.push(
        missingTransformDiagnostic(draw, snapshot.transforms),
      );
      continue;
    }

    const offset = offsetAt(scratch, scratch.offsets.length);

    offset.renderId = draw.renderId;
    offset.sourceOffset = sourceOffset;
    offset.packedOffset = sourceOffset;
    scratch.offsets.push(offset);
  }

  result.data = scratch.data;

  return scratch.result;
}

/**
 * Packs only transforms referenced by mesh draw packets into a compact
 * render-world buffer. Full snapshots can contain camera, light, audio, bounds,
 * and helper transforms that mesh shaders never read; keeping those in the mesh
 * world-transform GPU buffer causes unrelated ECS movement to dirty every mesh
 * route. The packed offsets remain renderId-addressable, so render queues,
 * previous-transform history, instance tints, and instance attributes can keep
 * using the normal packed-transform contract.
 */
export function writePackedSnapshotMeshTransforms(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
  scratch: PackedSnapshotTransformsScratch,
): PackedSnapshotTransforms {
  const result = scratch.result as MutablePackedSnapshotTransforms;
  const sourceOffsets = scratch.sourceOffsets;
  const sourceOffsetToPackedOffset = scratch.sourceOffsetToPackedOffset;

  scratch.offsets.length = 0;
  scratch.diagnostics.length = 0;
  sourceOffsets.length = 0;
  sourceOffsetToPackedOffset.clear();

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.worldTransformOffset;

    if (!hasTransform(snapshot.transforms, sourceOffset)) {
      continue;
    }

    if (!sourceOffsetToPackedOffset.has(sourceOffset)) {
      sourceOffsetToPackedOffset.set(sourceOffset, -1);
      sourceOffsets.push(sourceOffset);
    }
  }

  sourceOffsets.sort(compareNumbers);

  const floatCount = sourceOffsets.length * MATRIX_FLOATS;
  const comparable =
    scratch.lastFloatCount === floatCount && scratch.data.length >= floatCount;

  result.floatCount = floatCount;
  ensureTransformDataCapacity(scratch, floatCount);
  ensureTransformNextDataCapacity(scratch, floatCount);

  for (let index = 0; index < sourceOffsets.length; index += 1) {
    const sourceOffset = sourceOffsets[index] ?? 0;
    const packedOffset = index * MATRIX_FLOATS;

    scratch.nextData.set(
      snapshot.transforms.subarray(sourceOffset, sourceOffset + MATRIX_FLOATS),
      packedOffset,
    );
    sourceOffsetToPackedOffset.set(sourceOffset, packedOffset);
  }

  const dirty = writeTransformDataWithDirtyRange(
    scratch.data,
    scratch.nextData,
    floatCount,
    comparable,
  );
  result.dirtyRange = dirty.range;
  result.dirtyRanges = dirty.ranges;
  scratch.lastFloatCount = floatCount;

  if (dirty.range !== null) {
    scratch.contentVersion += 1;
  }

  result.contentVersion = scratch.contentVersion;

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.worldTransformOffset;

    if (!hasTransform(snapshot.transforms, sourceOffset)) {
      scratch.diagnostics.push(
        missingTransformDiagnostic(draw, snapshot.transforms),
      );
      continue;
    }

    const packedOffset = sourceOffsetToPackedOffset.get(sourceOffset);

    if (packedOffset === undefined || packedOffset < 0) {
      scratch.diagnostics.push(
        missingTransformDiagnostic(draw, snapshot.transforms),
      );
      continue;
    }

    const offset = offsetAt(scratch, scratch.offsets.length);

    offset.renderId = draw.renderId;
    offset.sourceOffset = sourceOffset;
    offset.packedOffset = packedOffset;
    scratch.offsets.push(offset);
  }

  result.data = scratch.data;

  return scratch.result;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

/**
 * Copies the new transform floats into the persistent scratch and returns the
 * contiguous window that actually changed: `null` when the content is
 * byte-identical to the previous frame, a `full` range when the scratch has
 * no comparable history (first frame, float-count change, capacity realloc)
 * or when the changed span crosses TRANSFORM_DIRTY_FULL_WRITE_FRACTION.
 * NaN floats compare unequal to themselves and therefore stay conservatively
 * dirty — an upload too many, never a dropped update.
 */
interface TransformDirtyWriteResult {
  readonly range: PackedTransformDirtyRange | null;
  readonly ranges?: readonly PackedTransformDirtyRange[] | null;
}

function writeTransformDataWithDirtyRange(
  target: Float32Array,
  next: ArrayLike<number>,
  floatCount: number,
  comparable: boolean,
): TransformDirtyWriteResult {
  if (!comparable) {
    target.set(next);

    if (floatCount === 0) {
      return { range: null, ranges: null };
    }

    return { range: { floatOffset: 0, floatCount, full: true } };
  }

  if (floatCount % MATRIX_FLOATS === 0) {
    return writeMatrixTransformDataWithDirtyRange(target, next, floatCount);
  }

  let first = -1;
  let last = -1;
  let changedFloatCount = 0;
  const ranges: PackedTransformDirtyRange[] = [];

  let index = 0;
  while (index < floatCount) {
    if (target[index] === next[index]) {
      index += 1;
      continue;
    }

    const rangeStart = index;

    if (first === -1) {
      first = rangeStart;
    }

    while (index < floatCount && target[index] !== next[index]) {
      index += 1;
    }

    const rangeFloatCount = index - rangeStart;
    changedFloatCount += rangeFloatCount;
    last = index - 1;
    ranges.push({
      floatOffset: rangeStart,
      floatCount: rangeFloatCount,
      full: false,
    });
  }

  if (first === -1) {
    return { range: null, ranges: null };
  }

  const span = last - first + 1;

  if (
    changedFloatCount / floatCount >= TRANSFORM_DIRTY_FULL_WRITE_FRACTION ||
    ranges.length > TRANSFORM_DIRTY_MAX_RANGES
  ) {
    target.set(next);

    return { range: { floatOffset: 0, floatCount, full: true } };
  }

  for (const range of ranges) {
    for (
      let rangeIndex = range.floatOffset;
      rangeIndex < range.floatOffset + range.floatCount;
      rangeIndex += 1
    ) {
      target[rangeIndex] = next[rangeIndex] ?? 0;
    }
  }

  return {
    range:
      ranges.length === 1
        ? (ranges[0] ?? null)
        : { floatOffset: first, floatCount: span, full: false },
    ranges,
  };
}

function writeMatrixTransformDataWithDirtyRange(
  target: Float32Array,
  next: ArrayLike<number>,
  floatCount: number,
): TransformDirtyWriteResult {
  let first = -1;
  let last = -1;
  let changedFloatCount = 0;
  let openRange: PackedTransformDirtyRange | null = null;
  const ranges: PackedTransformDirtyRange[] = [];

  for (
    let matrixOffset = 0;
    matrixOffset < floatCount;
    matrixOffset += MATRIX_FLOATS
  ) {
    if (!matrixChanged(target, next, matrixOffset)) {
      openRange = null;
      continue;
    }

    if (first === -1) {
      first = matrixOffset;
    }

    last = matrixOffset + MATRIX_FLOATS - 1;
    changedFloatCount += MATRIX_FLOATS;

    if (
      openRange !== null &&
      openRange.floatOffset + openRange.floatCount === matrixOffset
    ) {
      const index = ranges.length - 1;
      const expanded: PackedTransformDirtyRange = {
        floatOffset: openRange.floatOffset,
        floatCount: openRange.floatCount + MATRIX_FLOATS,
        full: false,
      };

      ranges[index] = expanded;
      openRange = expanded;
    } else {
      openRange = {
        floatOffset: matrixOffset,
        floatCount: MATRIX_FLOATS,
        full: false,
      };
      ranges.push(openRange);
    }
  }

  if (first === -1) {
    return { range: null, ranges: null };
  }

  const span = last - first + 1;

  if (
    (changedFloatCount / floatCount >= TRANSFORM_DIRTY_FULL_WRITE_FRACTION &&
      span / floatCount >= TRANSFORM_DIRTY_FULL_SPAN_FRACTION) ||
    ranges.length > TRANSFORM_DIRTY_MAX_RANGES
  ) {
    target.set(next);

    return { range: { floatOffset: 0, floatCount, full: true } };
  }

  for (const range of ranges) {
    for (
      let rangeIndex = range.floatOffset;
      rangeIndex < range.floatOffset + range.floatCount;
      rangeIndex += 1
    ) {
      target[rangeIndex] = next[rangeIndex] ?? 0;
    }
  }

  return {
    range:
      ranges.length === 1
        ? (ranges[0] ?? null)
        : { floatOffset: first, floatCount: span, full: false },
    ranges,
  };
}

function matrixChanged(
  target: Float32Array,
  next: ArrayLike<number>,
  matrixOffset: number,
): boolean {
  for (let index = 0; index < MATRIX_FLOATS; index += 1) {
    const floatOffset = matrixOffset + index;

    if (target[floatOffset] !== next[floatOffset]) {
      return true;
    }
  }

  return false;
}
