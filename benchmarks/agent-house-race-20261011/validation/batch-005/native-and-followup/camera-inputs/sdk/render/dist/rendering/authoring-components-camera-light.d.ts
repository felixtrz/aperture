import { EcsType } from "@aperture-engine/simulation";
export declare const Camera: import("elics").Component<{
    projection: {
        type: EcsType.Enum;
        enum: {
            readonly Perspective: "perspective";
            readonly Orthographic: "orthographic";
        };
        default: "perspective";
    };
    fovYRadians: {
        type: EcsType.Float32;
        default: number;
    };
    aspect: {
        type: EcsType.Float32;
        default: number;
    };
    autoAspect: {
        type: EcsType.Boolean;
        default: true;
    };
    near: {
        type: EcsType.Float32;
        default: number;
    };
    far: {
        type: EcsType.Float32;
        default: number;
    };
    orthographicHeight: {
        type: EcsType.Float32;
        default: number;
    };
    viewport: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    scissor: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    clearColor: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
    clearDepth: {
        type: EcsType.Float32;
        default: number;
    };
    clearStencil: {
        type: EcsType.Int32;
        default: number;
    };
    clearFlags: {
        type: EcsType.Int32;
        default: number;
    };
    layerMask: {
        type: EcsType.Int32;
        default: number;
    };
    priority: {
        type: EcsType.Int32;
        default: number;
    };
    renderTargetId: {
        type: EcsType.String;
        default: string;
    };
    frustumCulling: {
        type: EcsType.Boolean;
        default: true;
    };
    temporalJitterX: {
        type: EcsType.Float32;
        default: number;
    };
    temporalJitterY: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const Light: import("elics").Component<{
    kind: {
        type: EcsType.Enum;
        enum: {
            readonly Ambient: "ambient";
            readonly Environment: "environment";
            readonly Directional: "directional";
            readonly Point: "point";
            readonly Spot: "spot";
            readonly RectArea: "rect-area";
        };
        default: "directional";
    };
    shape: {
        type: EcsType.Enum;
        enum: {
            readonly Rect: "rect";
            readonly Disk: "disk";
            readonly Sphere: "sphere";
        };
        default: "rect";
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
    intensity: {
        type: EcsType.Float32;
        default: number;
    };
    range: {
        type: EcsType.Float32;
        default: number;
    };
    innerConeAngle: {
        type: EcsType.Float32;
        default: number;
    };
    outerConeAngle: {
        type: EcsType.Float32;
        default: number;
    };
    width: {
        type: EcsType.Float32;
        default: number;
    };
    height: {
        type: EcsType.Float32;
        default: number;
    };
    layerMask: {
        type: EcsType.Int32;
        default: number;
    };
    environmentMapId: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const LightCookie: import("elics").Component<{
    textureId: {
        type: EcsType.String;
        default: string;
    };
    samplerId: {
        type: EcsType.String;
        default: string;
    };
    intensity: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const ShadowCaster: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const ShadowReceiver: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const LightShadowSettings: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: false;
    };
    mapSize: {
        type: EcsType.Int32;
        default: number;
    };
    bias: {
        type: EcsType.Float32;
        default: number;
    };
    normalBias: {
        type: EcsType.Float32;
        default: number;
    };
    cascadeCount: {
        type: EcsType.Int32;
        default: number;
    };
    casterLayerMask: {
        type: EcsType.Int32;
        default: number;
    };
    receiverLayerMask: {
        type: EcsType.Int32;
        default: number;
    };
    shadowType: {
        type: EcsType.Int32;
        default: number;
    };
    strength: {
        type: EcsType.Float32;
        default: number;
    };
    filterRadius: {
        type: EcsType.Float32;
        default: number;
    };
    slopeBias: {
        type: EcsType.Float32;
        default: number;
    };
    centerX: {
        type: EcsType.Float32;
        default: number;
    };
    centerY: {
        type: EcsType.Float32;
        default: number;
    };
    centerZ: {
        type: EcsType.Float32;
        default: number;
    };
    orthographicSize: {
        type: EcsType.Float32;
        default: number;
    };
    near: {
        type: EcsType.Float32;
        default: number;
    };
    far: {
        type: EcsType.Float32;
        default: number;
    };
    lightDistance: {
        type: EcsType.Float32;
        default: number;
    };
}>;
//# sourceMappingURL=authoring-components-camera-light.d.ts.map