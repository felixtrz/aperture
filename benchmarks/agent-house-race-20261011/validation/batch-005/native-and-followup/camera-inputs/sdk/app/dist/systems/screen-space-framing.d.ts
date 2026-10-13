import { EcsType, type ComponentInitialData, type Entity, type Vec3Like } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { ApertureSystemContext } from "./context.js";
export declare const ScreenSpaceFramingFit: {
    readonly Contain: "contain";
};
export type ScreenSpaceFramingFit = (typeof ScreenSpaceFramingFit)[keyof typeof ScreenSpaceFramingFit];
export interface ScreenSpaceFramingInput {
    readonly subject: Entity | EcsEntityRef;
    readonly slot: string;
    readonly fit?: ScreenSpaceFramingFit;
    readonly paddingPx?: number;
    readonly alignX?: number;
    readonly alignY?: number;
    readonly yawRadians?: number;
    readonly pitchRadians?: number;
    readonly boundsMin?: Vec3Like;
    readonly boundsMax?: Vec3Like;
    /**
     * Symmetric inset applied to both min and max bounds faces before fitting.
     * Use this to frame a cropped region of a larger subject while the rest of
     * the object remains visible outside the framed AABB.
     */
    readonly boundsInset?: number | Vec3Like;
    /** Per-axis inset added to the min-side faces before fitting. */
    readonly boundsInsetMin?: Vec3Like;
    /** Per-axis inset subtracted from the max-side faces before fitting. */
    readonly boundsInsetMax?: Vec3Like;
    readonly focusOffset?: Vec3Like;
    readonly minDistance?: number;
    readonly maxDistance?: number;
    readonly smoothingRate?: number;
}
export interface ScreenSpaceFramingFrameReport {
    readonly cameras: number;
    readonly updated: number;
}
export declare const ScreenSpaceFraming: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    subjectIndex: {
        type: EcsType.Int32;
        default: number;
    };
    subjectGeneration: {
        type: EcsType.Int32;
        default: number;
    };
    slot: {
        type: EcsType.String;
        default: string;
    };
    fit: {
        type: EcsType.Enum;
        enum: {
            readonly Contain: "contain";
        };
        default: "contain";
    };
    paddingPx: {
        type: EcsType.Float32;
        default: number;
    };
    alignX: {
        type: EcsType.Float32;
        default: number;
    };
    alignY: {
        type: EcsType.Float32;
        default: number;
    };
    yawRadians: {
        type: EcsType.Float32;
        default: number;
    };
    pitchRadians: {
        type: EcsType.Float32;
        default: number;
    };
    boundsMin: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    boundsMax: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    boundsInsetMin: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    boundsInsetMax: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    focusOffset: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    minDistance: {
        type: EcsType.Float32;
        default: number;
    };
    maxDistance: {
        type: EcsType.Float32;
        default: number;
    };
    smoothingRate: {
        type: EcsType.Float32;
        default: number;
    };
    initialized: {
        type: EcsType.Boolean;
        default: false;
    };
    smoothedTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare function createScreenSpaceFraming(input: ScreenSpaceFramingInput): ComponentInitialData<typeof ScreenSpaceFraming>;
export declare function runScreenSpaceFramingFrame(context: ApertureSystemContext, delta: number): ScreenSpaceFramingFrameReport;
//# sourceMappingURL=screen-space-framing.d.ts.map