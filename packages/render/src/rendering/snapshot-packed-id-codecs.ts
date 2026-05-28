import type { MeshTopology } from "../mesh/index.js";
import type { AreaLightShape, LightKind } from "./authoring.js";
import type { RenderQueue } from "./snapshot.js";

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
