import type { InstanceAttributeLayout } from "../materials/index.js";
import type { RenderSnapshot } from "./snapshot.js";
import {
  createPackedSnapshotInstanceAttributesScratch,
  ensureInstanceAttributeDataCapacity,
  instanceAttributeOffsetAt,
} from "./transform-pack-scratch.js";
import type {
  MutablePackedSnapshotInstanceAttributes,
  PackedSnapshotInstanceAttributes,
  PackedSnapshotInstanceAttributesScratch,
  PackedSnapshotTransforms,
} from "./transform-pack-types.js";
import {
  findInstanceAttributeField,
  findTransformPackedOffset,
  hasInstanceAttributeValues,
} from "./transform-pack-guards.js";

export {
  packSnapshotInstanceTints,
  packSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotInstanceTintsForVertexBuffer,
} from "./transform-pack-instance-tints.js";

export function packSnapshotInstanceAttributesForVertexBuffer(
  snapshot: Pick<
    RenderSnapshot,
    "meshDraws" | "instanceAttributes" | "instanceAttributePackets"
  >,
  transforms: PackedSnapshotTransforms,
  layout: InstanceAttributeLayout,
  options: { readonly materialKind?: string } = {},
): PackedSnapshotInstanceAttributes {
  return writePackedSnapshotInstanceAttributesForVertexBuffer(
    snapshot,
    transforms,
    layout,
    createPackedSnapshotInstanceAttributesScratch(),
    options,
  );
}

export function writePackedSnapshotInstanceAttributesForVertexBuffer(
  snapshot: Pick<
    RenderSnapshot,
    "meshDraws" | "instanceAttributes" | "instanceAttributePackets"
  >,
  transforms: PackedSnapshotTransforms,
  layout: InstanceAttributeLayout,
  scratch: PackedSnapshotInstanceAttributesScratch,
  options: { readonly materialKind?: string } = {},
): PackedSnapshotInstanceAttributes {
  const result = scratch.result as MutablePackedSnapshotInstanceAttributes;
  const source = snapshot.instanceAttributes ?? new Float32Array(0);
  const packets = snapshot.instanceAttributePackets ?? [];
  const instanceCount = Math.ceil((transforms.floatCount ?? 0) / 16);
  const requiredFloats = instanceCount * layout.strideFloats;

  scratch.offsets.length = 0;
  scratch.diagnostics.length = 0;
  ensureInstanceAttributeDataCapacity(scratch, requiredFloats);
  scratch.data.fill(0, 0, requiredFloats);

  for (const draw of snapshot.meshDraws) {
    const packetIndex = draw.instanceAttributePacketIndex;

    if (packetIndex === undefined) {
      continue;
    }

    const packet = packets[packetIndex];

    if (packet === undefined) {
      scratch.diagnostics.push({
        code: "renderInstanceAttributePack.missingPacket",
        message: `Render id ${draw.renderId} references instance attribute packet ${packetIndex}, but only ${packets.length} packets exist.`,
        severity: "warning",
        entity: draw.entity,
      });
      continue;
    }

    if (
      options.materialKind !== undefined &&
      packet.materialKind !== options.materialKind
    ) {
      continue;
    }

    const transformPackedOffset = findTransformPackedOffset(
      transforms,
      draw.renderId,
    );

    if (
      transformPackedOffset === undefined ||
      transformPackedOffset < 0 ||
      transformPackedOffset % 16 !== 0
    ) {
      scratch.diagnostics.push({
        code: "renderInstanceAttributePack.missingPackedTransform",
        message: `Render id ${draw.renderId} references instance attributes, but no aligned packed transform offset was found.`,
        severity: "warning",
        entity: draw.entity,
      });
      continue;
    }

    const packedOffset = (transformPackedOffset / 16) * layout.strideFloats;

    for (const attribute of layout.attributes) {
      const field = findInstanceAttributeField(packet, attribute.name);

      if (field === undefined) {
        scratch.diagnostics.push({
          code: "renderInstanceAttributePack.missingAttribute",
          message: `Render id ${draw.renderId} is missing instance attribute '${attribute.name}'.`,
          severity: "warning",
          entity: draw.entity,
        });
        continue;
      }

      if (field.components !== attribute.components) {
        scratch.diagnostics.push({
          code: "renderInstanceAttributePack.componentMismatch",
          message: `Render id ${draw.renderId} instance attribute '${attribute.name}' has ${field.components} components; expected ${attribute.components}.`,
          severity: "warning",
          entity: draw.entity,
        });
        continue;
      }

      if (!hasInstanceAttributeValues(source, field)) {
        scratch.diagnostics.push({
          code: "renderInstanceAttributePack.missingValues",
          message: `Render id ${draw.renderId} instance attribute '${attribute.name}' references offset ${field.offset}, but attribute buffer length is ${source.length}.`,
          severity: "warning",
          entity: draw.entity,
        });
        continue;
      }

      scratch.data.set(
        source.subarray(field.offset, field.offset + field.components),
        packedOffset + attribute.floatOffset,
      );
    }

    const offset = instanceAttributeOffsetAt(scratch, scratch.offsets.length);

    offset.renderId = draw.renderId;
    offset.sourcePacketIndex = packetIndex;
    offset.packedOffset = packedOffset;
    scratch.offsets.push(offset);
  }

  result.layout = layout;
  result.data = scratch.data;
  result.floatCount = requiredFloats;

  return scratch.result;
}
