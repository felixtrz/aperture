import {
  assetHandleKey,
  type AssetHandle,
  type AssetKind,
} from "@aperture-engine/simulation";

import type { MeshTopology } from "../mesh/index.js";
import type { AreaLightShape, LightKind } from "./authoring.js";
import type { MeshDrawPacket, RenderQueue } from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";

const OPTIONAL_UINT32_ABSENT = 0xffff_ffff;

const FLOAT64_SCRATCH = new Float64Array(1);
const FLOAT64_WORDS = new Uint32Array(FLOAT64_SCRATCH.buffer);

const QueueId = Object.freeze({
  Opaque: 1,
  AlphaTest: 2,
  Transparent: 3,
});

const LightKindId = Object.freeze({
  Ambient: 1,
  Environment: 2,
  Directional: 3,
  Point: 4,
  Spot: 5,
  RectArea: 6,
});

const AreaLightShapeId = Object.freeze({
  Rect: 1,
  Disk: 2,
  Sphere: 3,
});

const TopologyId = Object.freeze({
  TriangleList: 1,
  TriangleStrip: 2,
  LineList: 3,
  LineStrip: 4,
  PointList: 5,
});

export const DEFAULT_PACKED_AREA_LIGHT_SHAPE_ID = AreaLightShapeId.Rect;

export function writeEntity(
  words: Uint32Array,
  offset: number,
  entity: { readonly index: number; readonly generation: number },
): void {
  words[offset] = entity.index >>> 0;
  words[offset + 1] = entity.generation >>> 0;
}

export function readEntity(
  words: Uint32Array,
  offset: number,
): { readonly index: number; readonly generation: number } {
  return {
    index: words[offset] ?? 0,
    generation: words[offset + 1] ?? 0,
  };
}

export function writeVec3(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
}

export function readVec3(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
  ];
}

export function writeVec4(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
  writeFloat64(words, offset + 6, value[3] ?? 0);
}

export function readVec4(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
    readFloat64(words, offset + 6),
  ];
}

export function writeFloat64(
  words: Uint32Array,
  offset: number,
  value: number,
): void {
  FLOAT64_SCRATCH[0] = value;
  words[offset] = FLOAT64_WORDS[0] ?? 0;
  words[offset + 1] = FLOAT64_WORDS[1] ?? 0;
}

export function readFloat64(words: Uint32Array, offset: number): number {
  FLOAT64_WORDS[0] = words[offset] ?? 0;
  FLOAT64_WORDS[1] = words[offset + 1] ?? 0;

  return FLOAT64_SCRATCH[0] ?? 0;
}

export function writeSigned32(
  words: Uint32Array,
  offset: number,
  value: number,
): void {
  words[offset] = value >>> 0;
}

export function readSigned32(words: Uint32Array, offset: number): number {
  return (words[offset] ?? 0) | 0;
}

export function writeOptionalUint32(
  words: Uint32Array,
  offset: number,
  value: number | undefined,
): void {
  words[offset] = value === undefined ? OPTIONAL_UINT32_ABSENT : value >>> 0;
}

export function readOptionalUint32(
  words: Uint32Array,
  offset: number,
): number | undefined {
  const value = words[offset] ?? OPTIONAL_UINT32_ABSENT;

  return value === OPTIONAL_UINT32_ABSENT ? undefined : value;
}

export function boolState(value: boolean | undefined): number {
  return value === undefined ? 0 : value ? 2 : 1;
}

export function readBoolState(value: number): boolean | undefined {
  switch (value) {
    case 0:
      return undefined;
    case 1:
      return false;
    case 2:
      return true;
    default:
      throw new RangeError(`Unknown snapshot packet boolean state '${value}'.`);
  }
}

export function batchFlags(packet: MeshDrawPacket): number {
  return (
    (packet.batchKey.instanced ? 1 : 0) |
    (packet.batchKey.skinned ? 2 : 0) |
    (packet.batchKey.morphed ? 4 : 0) |
    (packet.occlusionQuery === true ? 8 : 0)
  );
}

export function queueId(queue: RenderQueue): number {
  switch (queue) {
    case "opaque":
      return QueueId.Opaque;
    case "alpha-test":
      return QueueId.AlphaTest;
    case "transparent":
      return QueueId.Transparent;
  }
}

export function queueValue(id: number): RenderQueue {
  switch (id) {
    case QueueId.Opaque:
      return "opaque";
    case QueueId.AlphaTest:
      return "alpha-test";
    case QueueId.Transparent:
      return "transparent";
    default:
      throw new RangeError(`Unknown snapshot packet render queue id '${id}'.`);
  }
}

export function lightKindId(kind: LightKind): number {
  switch (kind) {
    case "ambient":
      return LightKindId.Ambient;
    case "environment":
      return LightKindId.Environment;
    case "directional":
      return LightKindId.Directional;
    case "point":
      return LightKindId.Point;
    case "spot":
      return LightKindId.Spot;
    case "rect-area":
      return LightKindId.RectArea;
  }
}

export function lightKindValue(id: number): LightKind {
  switch (id) {
    case LightKindId.Ambient:
      return "ambient";
    case LightKindId.Environment:
      return "environment";
    case LightKindId.Directional:
      return "directional";
    case LightKindId.Point:
      return "point";
    case LightKindId.Spot:
      return "spot";
    case LightKindId.RectArea:
      return "rect-area";
    default:
      throw new RangeError(`Unknown snapshot packet light kind id '${id}'.`);
  }
}

export function areaLightShapeId(shape: AreaLightShape | undefined): number {
  switch (shape) {
    case "disk":
      return AreaLightShapeId.Disk;
    case "sphere":
      return AreaLightShapeId.Sphere;
    case "rect":
    case undefined:
      return AreaLightShapeId.Rect;
  }
}

export function areaLightShapeValue(id: number): AreaLightShape {
  switch (id) {
    case AreaLightShapeId.Rect:
      return "rect";
    case AreaLightShapeId.Disk:
      return "disk";
    case AreaLightShapeId.Sphere:
      return "sphere";
    default:
      throw new RangeError(
        `Unknown snapshot packet area light shape id '${id}'.`,
      );
  }
}

export function topologyId(topology: MeshTopology): number {
  switch (topology) {
    case "triangle-list":
      return TopologyId.TriangleList;
    case "triangle-strip":
      return TopologyId.TriangleStrip;
    case "line-list":
      return TopologyId.LineList;
    case "line-strip":
      return TopologyId.LineStrip;
    case "point-list":
      return TopologyId.PointList;
  }
}

export function topologyValue(id: number): MeshTopology {
  switch (id) {
    case TopologyId.TriangleList:
      return "triangle-list";
    case TopologyId.TriangleStrip:
      return "triangle-strip";
    case TopologyId.LineList:
      return "line-list";
    case TopologyId.LineStrip:
      return "line-strip";
    case TopologyId.PointList:
      return "point-list";
    default:
      throw new RangeError(`Unknown snapshot packet topology id '${id}'.`);
  }
}

export function readRequiredHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKind: TKind,
): AssetHandle<TKind> {
  const handle = registry.handleValue(id);

  if (handle === null) {
    throw new RangeError(
      `Expected ${expectedKind} handle id, received null handle id.`,
    );
  }

  assertHandleKind(handle, [expectedKind]);

  return handle as AssetHandle<TKind>;
}

export function readNullableHandle<TKind extends AssetKind>(
  registry: SnapshotPacketEncodingRegistry,
  id: number,
  expectedKinds: readonly TKind[],
): AssetHandle<TKind> | null {
  const handle = registry.handleValue(id);

  if (handle === null) {
    return null;
  }

  assertHandleKind(handle, expectedKinds);

  return handle as AssetHandle<TKind>;
}

function assertHandleKind(
  handle: AssetHandle,
  expectedKinds: readonly AssetKind[],
): void {
  if (!expectedKinds.includes(handle.kind)) {
    throw new RangeError(
      `Expected ${expectedKinds.join(" or ")} handle, received '${assetHandleKey(
        handle,
      )}'.`,
    );
  }
}
