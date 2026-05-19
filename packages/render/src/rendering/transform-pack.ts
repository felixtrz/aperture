import type {
  MeshDrawPacket,
  RenderDiagnostic,
  RenderSnapshot,
} from "./snapshot.js";

export interface PackedTransformOffset {
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotTransforms {
  readonly data: Float32Array;
  readonly floatCount?: number;
  readonly offsets: readonly PackedTransformOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PackedSnapshotTransformsScratch {
  data: Float32Array;
  readonly offsets: PackedTransformOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedTransformOffset[];
  readonly sourceToPackedOffset: Map<number, number>;
  readonly result: PackedSnapshotTransforms;
}

interface MutablePackedTransformOffset {
  renderId: number;
  sourceOffset: number;
  packedOffset: number;
}

interface MutablePackedSnapshotTransforms {
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedTransformOffset[];
  diagnostics: readonly RenderDiagnostic[];
}

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

function ensureTransformDataCapacity(
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

function offsetAt(
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

function createEmptyOffset(): MutablePackedTransformOffset {
  return { renderId: 0, sourceOffset: 0, packedOffset: 0 };
}

function hasTransform(transforms: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

function missingTransformDiagnostic(
  draw: MeshDrawPacket,
  transforms: Float32Array,
): RenderDiagnostic {
  return {
    code: "renderTransformPack.missingTransform",
    message: `Render id ${draw.renderId} references transform offset ${draw.worldTransformOffset}, but transform buffer length is ${transforms.length}.`,
    severity: "warning",
    entity: draw.entity,
  };
}
