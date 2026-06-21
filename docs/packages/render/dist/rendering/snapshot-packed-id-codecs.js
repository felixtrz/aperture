import { FogMode } from "./authoring.js";
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
const FogModeId = Object.freeze({
    Linear: 1,
    Exp: 2,
    Exp2: 3,
});
const TopologyId = Object.freeze({
    TriangleList: 1,
    TriangleStrip: 2,
    LineList: 3,
    LineStrip: 4,
    PointList: 5,
});
const AudioVoiceKeyKindId = Object.freeze({
    Entity: 1,
    OneShot: 2,
});
const AudioPanningModelId = Object.freeze({
    EqualPower: 1,
    Hrtf: 2,
});
const AudioSimulationSpaceId = Object.freeze({
    World: 1,
    Local: 2,
});
const AudioDistanceModelId = Object.freeze({
    Inverse: 1,
    Linear: 2,
    Exponential: 3,
});
const AudioAudibilityId = Object.freeze({
    Audible: 1,
    Inaudible: 2,
});
export const DEFAULT_PACKED_AREA_LIGHT_SHAPE_ID = AreaLightShapeId.Rect;
export function queueId(queue) {
    switch (queue) {
        case "opaque":
            return QueueId.Opaque;
        case "alpha-test":
            return QueueId.AlphaTest;
        case "transparent":
            return QueueId.Transparent;
    }
}
export function queueValue(id) {
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
export function lightKindId(kind) {
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
export function lightKindValue(id) {
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
export function areaLightShapeId(shape) {
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
export function areaLightShapeValue(id) {
    switch (id) {
        case AreaLightShapeId.Rect:
            return "rect";
        case AreaLightShapeId.Disk:
            return "disk";
        case AreaLightShapeId.Sphere:
            return "sphere";
        default:
            throw new RangeError(`Unknown snapshot packet area light shape id '${id}'.`);
    }
}
export function fogModeId(mode) {
    switch (mode) {
        case FogMode.Linear:
            return FogModeId.Linear;
        case FogMode.Exp:
            return FogModeId.Exp;
        case FogMode.Exp2:
            return FogModeId.Exp2;
    }
}
export function fogModeValue(id) {
    switch (id) {
        case FogModeId.Linear:
            return FogMode.Linear;
        case FogModeId.Exp:
            return FogMode.Exp;
        case FogModeId.Exp2:
            return FogMode.Exp2;
        default:
            throw new RangeError(`Unknown snapshot packet fog mode id '${id}'.`);
    }
}
export function topologyId(topology) {
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
export function topologyValue(id) {
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
export function audioVoiceKeyKindId(value) {
    switch (value) {
        case "entity":
            return AudioVoiceKeyKindId.Entity;
        case "oneshot":
            return AudioVoiceKeyKindId.OneShot;
    }
}
export function audioVoiceKeyKindValue(id) {
    switch (id) {
        case AudioVoiceKeyKindId.Entity:
            return "entity";
        case AudioVoiceKeyKindId.OneShot:
            return "oneshot";
        default:
            throw new RangeError(`Unknown audio voice key kind id '${id}'.`);
    }
}
export function audioPanningModelId(value) {
    switch (value) {
        case "equalpower":
            return AudioPanningModelId.EqualPower;
        case "HRTF":
            return AudioPanningModelId.Hrtf;
    }
}
export function audioPanningModelValue(id) {
    switch (id) {
        case AudioPanningModelId.EqualPower:
            return "equalpower";
        case AudioPanningModelId.Hrtf:
            return "HRTF";
        default:
            throw new RangeError(`Unknown audio panning model id '${id}'.`);
    }
}
export function audioSimulationSpaceId(value) {
    switch (value) {
        case "world":
            return AudioSimulationSpaceId.World;
        case "local":
            return AudioSimulationSpaceId.Local;
    }
}
export function audioSimulationSpaceValue(id) {
    switch (id) {
        case AudioSimulationSpaceId.World:
            return "world";
        case AudioSimulationSpaceId.Local:
            return "local";
        default:
            throw new RangeError(`Unknown audio simulation space id '${id}'.`);
    }
}
export function audioDistanceModelId(value) {
    switch (value) {
        case "inverse":
            return AudioDistanceModelId.Inverse;
        case "linear":
            return AudioDistanceModelId.Linear;
        case "exponential":
            return AudioDistanceModelId.Exponential;
    }
}
export function audioDistanceModelValue(id) {
    switch (id) {
        case AudioDistanceModelId.Inverse:
            return "inverse";
        case AudioDistanceModelId.Linear:
            return "linear";
        case AudioDistanceModelId.Exponential:
            return "exponential";
        default:
            throw new RangeError(`Unknown audio distance model id '${id}'.`);
    }
}
export function audioAudibilityId(value) {
    switch (value) {
        case "audible":
            return AudioAudibilityId.Audible;
        case "inaudible":
            return AudioAudibilityId.Inaudible;
    }
}
export function audioAudibilityValue(id) {
    switch (id) {
        case AudioAudibilityId.Audible:
            return "audible";
        case AudioAudibilityId.Inaudible:
            return "inaudible";
        default:
            throw new RangeError(`Unknown audio audibility id '${id}'.`);
    }
}
//# sourceMappingURL=snapshot-packed-id-codecs.js.map