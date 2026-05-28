import type {
  InstanceAttributePacket,
  MeshDrawPacket,
  RenderDiagnostic,
} from "./snapshot.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";

export function findTransformPackedOffset(
  transforms: PackedSnapshotTransforms,
  renderId: number,
): number | undefined {
  for (const offset of transforms.offsets) {
    if (offset.renderId === renderId) {
      return offset.packedOffset;
    }
  }

  return undefined;
}

export function hasTransform(
  transforms: Float32Array,
  offset: number,
): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

export function hasTransformRange(floatCount: number, offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset + 16 <= floatCount;
}

export function hasVec4(values: Float32Array, offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset + 4 <= values.length;
}

export function findInstanceAttributeField(
  packet: InstanceAttributePacket,
  name: string,
): InstanceAttributePacket["fields"][number] | undefined {
  return packet.fields.find((field) => field.name === name);
}

export function hasInstanceAttributeValues(
  values: Float32Array,
  field: InstanceAttributePacket["fields"][number],
): boolean {
  return (
    Number.isInteger(field.offset) &&
    field.offset >= 0 &&
    field.offset + field.components <= values.length
  );
}

export function missingTransformDiagnostic(
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
