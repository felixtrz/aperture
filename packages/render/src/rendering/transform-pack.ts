import type { InstanceAttributeLayout } from "../materials/index.js";
import type {
  InstanceAttributePacket,
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

export interface PackedInstanceTintOffset {
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotInstanceTints {
  readonly data: Float32Array;
  readonly floatCount: number;
  readonly offsets: readonly PackedInstanceTintOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PackedInstanceAttributeOffset {
  readonly renderId: number;
  readonly sourcePacketIndex: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotInstanceAttributes {
  readonly layout: InstanceAttributeLayout;
  readonly data: Float32Array;
  readonly floatCount: number;
  readonly offsets: readonly PackedInstanceAttributeOffset[];
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

export interface PackedSnapshotInstanceTintsScratch {
  data: Float32Array;
  readonly offsets: PackedInstanceTintOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedInstanceTintOffset[];
  readonly result: PackedSnapshotInstanceTints;
}

export interface PackedSnapshotInstanceAttributesScratch {
  data: Float32Array;
  readonly offsets: PackedInstanceAttributeOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedInstanceAttributeOffset[];
  readonly result: PackedSnapshotInstanceAttributes;
}

interface MutablePackedTransformOffset {
  renderId: number;
  sourceOffset: number;
  packedOffset: number;
}

interface MutablePackedInstanceTintOffset {
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

interface MutablePackedSnapshotInstanceTints {
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedInstanceTintOffset[];
  diagnostics: readonly RenderDiagnostic[];
}

interface MutablePackedInstanceAttributeOffset {
  renderId: number;
  sourcePacketIndex: number;
  packedOffset: number;
}

interface MutablePackedSnapshotInstanceAttributes {
  layout: InstanceAttributeLayout;
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedInstanceAttributeOffset[];
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

export function packSnapshotInstanceTints(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">,
): PackedSnapshotInstanceTints {
  const source = snapshot.instanceTints ?? new Float32Array(0);
  const offsets: PackedInstanceTintOffset[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.instanceTintOffset;

    if (sourceOffset === undefined) {
      continue;
    }

    if (!hasVec4(source, sourceOffset)) {
      diagnostics.push({
        code: "renderInstanceTintPack.missingTint",
        message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but tint buffer length is ${source.length}.`,
        severity: "warning",
        entity: draw.entity,
      });
      continue;
    }

    offsets.push({
      renderId: draw.renderId,
      sourceOffset,
      packedOffset: sourceOffset,
    });
  }

  return {
    data: new Float32Array(source),
    floatCount: source.length,
    offsets,
    diagnostics,
  };
}

export function packSnapshotInstanceTintsForVertexBuffer(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">,
  transforms: PackedSnapshotTransforms,
): PackedSnapshotInstanceTints {
  return writePackedSnapshotInstanceTintsForVertexBuffer(
    snapshot,
    transforms,
    createPackedSnapshotInstanceTintsScratch(),
  );
}

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

export function writePackedSnapshotInstanceTintsForVertexBuffer(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "instanceTints">,
  transforms: PackedSnapshotTransforms,
  scratch: PackedSnapshotInstanceTintsScratch,
): PackedSnapshotInstanceTints {
  const result = scratch.result as MutablePackedSnapshotInstanceTints;
  const source = snapshot.instanceTints ?? new Float32Array(0);
  const instanceCount = Math.ceil((transforms.floatCount ?? 0) / 16);
  const requiredFloats = instanceCount * 4;

  scratch.offsets.length = 0;
  scratch.diagnostics.length = 0;

  ensureInstanceTintDataCapacity(scratch, requiredFloats);
  scratch.data.fill(1, 0, requiredFloats);

  for (const draw of snapshot.meshDraws) {
    const sourceOffset = draw.instanceTintOffset;

    if (sourceOffset === undefined) {
      continue;
    }

    if (!hasVec4(source, sourceOffset)) {
      scratch.diagnostics.push({
        code: "renderInstanceTintPack.missingTint",
        message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but tint buffer length is ${source.length}.`,
        severity: "warning",
        entity: draw.entity,
      });
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
        code: "renderInstanceTintPack.missingPackedTransform",
        message: `Render id ${draw.renderId} references instance tint offset ${sourceOffset}, but no aligned packed transform offset was found.`,
        severity: "warning",
        entity: draw.entity,
      });
      continue;
    }

    const packedOffset = (transformPackedOffset / 16) * 4;
    const offset = instanceTintOffsetAt(scratch, scratch.offsets.length);

    scratch.data.set(
      source.subarray(sourceOffset, sourceOffset + 4),
      packedOffset,
    );
    offset.renderId = draw.renderId;
    offset.sourceOffset = sourceOffset;
    offset.packedOffset = packedOffset;
    scratch.offsets.push(offset);
  }

  result.data = scratch.data;
  result.floatCount = requiredFloats;

  return scratch.result;
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

function ensureInstanceTintDataCapacity(
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

function ensureInstanceAttributeDataCapacity(
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

function instanceTintOffsetAt(
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

function instanceAttributeOffsetAt(
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

function findTransformPackedOffset(
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

function hasTransform(transforms: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

function hasVec4(values: Float32Array, offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset + 4 <= values.length;
}

function findInstanceAttributeField(
  packet: InstanceAttributePacket,
  name: string,
): InstanceAttributePacket["fields"][number] | undefined {
  return packet.fields.find((field) => field.name === name);
}

function hasInstanceAttributeValues(
  values: Float32Array,
  field: InstanceAttributePacket["fields"][number],
): boolean {
  return (
    Number.isInteger(field.offset) &&
    field.offset >= 0 &&
    field.offset + field.components <= values.length
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
