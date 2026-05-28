import type { RenderDiagnostic, RenderSnapshot } from "./snapshot.js";
import {
  ensureTransformDataCapacity,
  offsetAt,
} from "./transform-pack-scratch.js";
import type {
  MutablePackedSnapshotTransforms,
  PackedSnapshotTransforms,
  PackedSnapshotTransformsScratch,
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

export function writePackedSnapshotTransforms(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
  scratch: PackedSnapshotTransformsScratch,
): PackedSnapshotTransforms {
  const result = scratch.result as MutablePackedSnapshotTransforms;

  scratch.offsets.length = 0;
  scratch.diagnostics.length = 0;
  scratch.sourceToPackedOffset.clear();
  result.floatCount = snapshot.transforms.length;
  ensureTransformDataCapacity(scratch, snapshot.transforms.length);
  scratch.data.set(snapshot.transforms);

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
