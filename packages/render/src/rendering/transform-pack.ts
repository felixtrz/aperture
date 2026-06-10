import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
import {
  ensureTransformDataCapacity,
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
  result.dirtyRange = writeTransformDataWithDirtyRange(
    scratch.data,
    snapshot.transforms,
    floatCount,
    comparable,
  );
  scratch.lastFloatCount = floatCount;

  if (result.dirtyRange !== null) {
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
 * Copies the new transform floats into the persistent scratch and returns the
 * contiguous window that actually changed: `null` when the content is
 * byte-identical to the previous frame, a `full` range when the scratch has
 * no comparable history (first frame, float-count change, capacity realloc)
 * or when the changed span crosses TRANSFORM_DIRTY_FULL_WRITE_FRACTION.
 * NaN floats compare unequal to themselves and therefore stay conservatively
 * dirty — an upload too many, never a dropped update.
 */
function writeTransformDataWithDirtyRange(
  target: Float32Array,
  next: ArrayLike<number>,
  floatCount: number,
  comparable: boolean,
): PackedTransformDirtyRange | null {
  if (!comparable) {
    target.set(next);

    return floatCount === 0 ? null : { floatOffset: 0, floatCount, full: true };
  }

  let first = -1;

  for (let index = 0; index < floatCount; index += 1) {
    if (target[index] !== next[index]) {
      first = index;
      break;
    }
  }

  if (first === -1) {
    return null;
  }

  let last = first;

  for (let index = floatCount - 1; index > first; index -= 1) {
    if (target[index] !== next[index]) {
      last = index;
      break;
    }
  }

  const span = last - first + 1;

  if (span / floatCount >= TRANSFORM_DIRTY_FULL_WRITE_FRACTION) {
    target.set(next);

    return { floatOffset: 0, floatCount, full: true };
  }

  for (let index = first; index <= last; index += 1) {
    target[index] = next[index] ?? 0;
  }

  return { floatOffset: first, floatCount: span, full: false };
}
