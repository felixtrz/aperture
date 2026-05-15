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
  readonly offsets: readonly PackedTransformOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export function packSnapshotTransforms(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "transforms">,
): PackedSnapshotTransforms {
  const values: number[] = [];
  const offsets: PackedTransformOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];
  const sourceToPackedOffset = new Map<number, number>();

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.worldTransformOffset;

    if (!hasTransform(snapshot.transforms, sourceOffset)) {
      diagnostics.push(missingTransformDiagnostic(draw, snapshot.transforms));
      continue;
    }

    let packedOffset = sourceToPackedOffset.get(sourceOffset);

    if (packedOffset === undefined) {
      packedOffset = values.length;
      sourceToPackedOffset.set(sourceOffset, packedOffset);
      values.push(
        ...snapshot.transforms.slice(sourceOffset, sourceOffset + 16),
      );
    }

    offsets.push({
      renderId: draw.renderId,
      sourceOffset,
      packedOffset,
    });
  }

  return {
    data: new Float32Array(values),
    offsets,
    diagnostics,
  };
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
