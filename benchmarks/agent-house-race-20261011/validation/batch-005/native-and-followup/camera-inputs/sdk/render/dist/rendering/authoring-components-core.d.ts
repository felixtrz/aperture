import { EcsType, type Entity } from "@aperture-engine/simulation";
/**
 * Engine-owned skeleton structure stored on the {@link Skin} component's
 * `skeleton` Object field for imported skins. Holds live joint entity refs and
 * flat column-major inverse-bind matrices by reference (same-thread only).
 */
export interface SkinSkeleton {
    /** Live joint entities, in skin.joints order. */
    readonly joints: readonly Entity[];
    /** Flat column-major inverse-bind matrices, length === joints.length * 16. */
    readonly inverseBindMatrices: Float32Array;
}
export declare const Mesh: import("elics").Component<{
    meshId: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const Material: import("elics").Component<{
    materialId: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const MaterialSlots: import("elics").Component<{
    slotsJson: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const Sprite: import("elics").Component<{
    textureId: {
        type: EcsType.String;
        default: string;
    };
    samplerId: {
        type: EcsType.String;
        default: string;
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
    width: {
        type: EcsType.Float32;
        default: number;
    };
    height: {
        type: EcsType.Float32;
        default: number;
    };
    uvRect: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    pivot: {
        type: EcsType.Vec2;
        default: [number, number];
    };
    rotation: {
        type: EcsType.Float32;
        default: number;
    };
    atlasFrame: {
        type: EcsType.Int32;
        default: number;
    };
    coordinateMode: {
        type: EcsType.Enum;
        enum: {
            readonly World: "world";
            readonly Screen: "screen";
        };
        default: "world";
    };
    billboardMode: {
        type: EcsType.Enum;
        enum: {
            readonly None: "none";
            readonly Spherical: "spherical";
            readonly Cylindrical: "cylindrical";
            readonly AxisLocked: "axis-locked";
        };
        default: "spherical";
    };
    sizeMode: {
        type: EcsType.Enum;
        enum: {
            readonly WorldUnits: "world-units";
            readonly ScreenPixels: "screen-pixels";
        };
        default: "world-units";
    };
    blendMode: {
        type: EcsType.Enum;
        enum: {
            readonly Opaque: "opaque";
            readonly Alpha: "alpha";
            readonly Additive: "additive";
            readonly Multiply: "multiply";
        };
        default: "alpha";
    };
    depthMode: {
        type: EcsType.Enum;
        enum: {
            readonly Test: "test";
            readonly Disabled: "disabled";
        };
        default: "test";
    };
}>;
export declare const ParticleEmitter: import("elics").Component<{
    effectId: {
        type: EcsType.String;
        default: string;
    };
    capacity: {
        type: EcsType.Int32;
        default: number;
    };
    seed: {
        type: EcsType.Int32;
        default: number;
    };
    resetEpoch: {
        type: EcsType.Int32;
        default: number;
    };
    timeScale: {
        type: EcsType.Float32;
        default: number;
    };
    simulationSpace: {
        type: EcsType.Enum;
        enum: {
            readonly World: "world";
            readonly Local: "local";
        };
        default: "world";
    };
    boundsCenter: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    boundsRadius: {
        type: EcsType.Float32;
        default: number;
    };
    visible: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const AudioEmitter: import("elics").Component<{
    clipId: {
        type: EcsType.String;
        default: string;
    };
    busId: {
        type: EcsType.String;
        default: string;
    };
    gain: {
        type: EcsType.Float32;
        default: number;
    };
    timeScale: {
        type: EcsType.Float32;
        default: number;
    };
    loop: {
        type: EcsType.Boolean;
        default: false;
    };
    autoplay: {
        type: EcsType.Boolean;
        default: false;
    };
    playEpoch: {
        type: EcsType.Int32;
        default: number;
    };
    stopEpoch: {
        type: EcsType.Int32;
        default: number;
    };
    seed: {
        type: EcsType.Int32;
        default: number;
    };
    priority: {
        type: EcsType.Int32;
        default: number;
    };
    muted: {
        type: EcsType.Boolean;
        default: false;
    };
    offsetSec: {
        type: EcsType.Float32;
        default: number;
    };
    loopStart: {
        type: EcsType.Float32;
        default: number;
    };
    loopEnd: {
        type: EcsType.Float32;
        default: number;
    };
    simulationSpace: {
        type: EcsType.Enum;
        enum: {
            readonly World: "world";
            readonly Local: "local";
        };
        default: "world";
    };
    panningModel: {
        type: EcsType.Enum;
        enum: {
            readonly EqualPower: "equalpower";
            readonly Hrtf: "HRTF";
        };
        default: "equalpower";
    };
    distanceModel: {
        type: EcsType.Enum;
        enum: {
            readonly Inverse: "inverse";
            readonly Linear: "linear";
            readonly Exponential: "exponential";
        };
        default: "inverse";
    };
    refDistance: {
        type: EcsType.Float32;
        default: number;
    };
    maxDistance: {
        type: EcsType.Float32;
        default: number;
    };
    rolloffFactor: {
        type: EcsType.Float32;
        default: number;
    };
    coneInnerAngle: {
        type: EcsType.Float32;
        default: number;
    };
    coneOuterAngle: {
        type: EcsType.Float32;
        default: number;
    };
    coneOuterGain: {
        type: EcsType.Float32;
        default: number;
    };
    boundsCenter: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    audibilityRadius: {
        type: EcsType.Float32;
        default: number;
    };
    occlusion: {
        type: EcsType.Float32;
        default: number;
    };
    lowpassFrequency: {
        type: EcsType.Float32;
        default: number;
    };
    lowpassQ: {
        type: EcsType.Float32;
        default: number;
    };
    active: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const AudioListener: import("elics").Component<{
    active: {
        type: EcsType.Boolean;
        default: true;
    };
    masterGain: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const UiScreen: import("elics").Component<{
    width: {
        type: EcsType.Float32;
        default: number;
    };
    height: {
        type: EcsType.Float32;
        default: number;
    };
    scaleMode: {
        type: EcsType.Enum;
        enum: {
            readonly Fixed: "fixed";
            readonly Viewport: "viewport";
        };
        default: "fixed";
    };
    layerMask: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const UiNode: import("elics").Component<{
    x: {
        type: EcsType.Float32;
        default: number;
    };
    y: {
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
    padding: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    gap: {
        type: EcsType.Float32;
        default: number;
    };
    layoutMode: {
        type: EcsType.Enum;
        enum: {
            readonly Absolute: "absolute";
            readonly Row: "row";
            readonly Column: "column";
        };
        default: "absolute";
    };
    zIndex: {
        type: EcsType.Int32;
        default: number;
    };
    opacity: {
        type: EcsType.Float32;
        default: number;
    };
    clip: {
        type: EcsType.Boolean;
        default: false;
    };
    visible: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const UiPanel: import("elics").Component<{
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
}>;
export declare const UiImage: import("elics").Component<{
    textureId: {
        type: EcsType.String;
        default: string;
    };
    samplerId: {
        type: EcsType.String;
        default: string;
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
    uvRect: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
}>;
export declare const UiText: import("elics").Component<{
    text: {
        type: EcsType.String;
        default: string;
    };
    fontAtlasId: {
        type: EcsType.String;
        default: string;
    };
    fontSize: {
        type: EcsType.Float32;
        default: number;
    };
    lineHeight: {
        type: EcsType.Float32;
        default: number;
    };
    maxWidth: {
        type: EcsType.Float32;
        default: number;
    };
    align: {
        type: EcsType.Enum;
        enum: {
            readonly Left: "left";
            readonly Center: "center";
            readonly Right: "right";
        };
        default: "left";
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
}>;
export declare const UiHitTarget: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    blocksInput: {
        type: EcsType.Boolean;
        default: true;
    };
    cursor: {
        type: EcsType.String;
        default: string;
    };
    priority: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const UiScroll: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    offset: {
        type: EcsType.Vec2;
        default: [number, number];
    };
}>;
export declare const Skybox: import("elics").Component<{
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
export declare const ProceduralSky: import("elics").Component<{
    model: {
        type: EcsType.Enum;
        enum: {
            readonly Gradient: "gradient";
        };
        default: "gradient";
    };
    priority: {
        type: EcsType.Int32;
        default: number;
    };
    topColor: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    horizonColor: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    bottomColor: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    horizonPosition: {
        type: EcsType.Float32;
        default: number;
    };
    horizonSoftness: {
        type: EcsType.Float32;
        default: number;
    };
    intensity: {
        type: EcsType.Float32;
        default: number;
    };
    sunDirection: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    sunColor: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    sunRadius: {
        type: EcsType.Float32;
        default: number;
    };
    sunGlow: {
        type: EcsType.Float32;
        default: number;
    };
    ditherStrength: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const RuntimeUniform: import("elics").Component<{
    key: {
        type: EcsType.String;
        default: string;
    };
    values: {
        type: EcsType.Object;
        default: null;
    };
    version: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const Fog: import("elics").Component<{
    mode: {
        type: EcsType.Enum;
        enum: {
            readonly Linear: "linear";
            readonly Exp: "exp";
            readonly Exp2: "exp2";
        };
        default: "linear";
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
    density: {
        type: EcsType.Float32;
        default: number;
    };
    start: {
        type: EcsType.Float32;
        default: number;
    };
    end: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const Visibility: import("elics").Component<{
    visible: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const OcclusionQuery: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const RenderLayer: import("elics").Component<{
    mask: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const RenderOrder: import("elics").Component<{
    value: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const InstanceTint: import("elics").Component<{
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
}>;
export declare const InstanceData: import("elics").Component<{
    materialKind: {
        type: EcsType.String;
        default: string;
    };
    valuesJson: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const Skin: import("elics").Component<{
    jointCount: {
        type: EcsType.Int32;
        default: number;
    };
    jointMatrices: {
        type: EcsType.Object;
        default: null;
    };
    skeleton: {
        type: EcsType.Object;
        default: null;
    };
}>;
export declare const MorphTargetWeights: import("elics").Component<{
    targetCount: {
        type: EcsType.Int32;
        default: number;
    };
    weights: {
        type: EcsType.Object;
        default: null;
    };
}>;
//# sourceMappingURL=authoring-components-core.d.ts.map