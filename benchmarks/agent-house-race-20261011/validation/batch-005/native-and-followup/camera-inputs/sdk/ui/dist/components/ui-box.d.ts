import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "@aperture-engine/simulation";
/**
 * Visual box styling for a UI node: rounded corners and borders, rendered by the
 * SDF panel shader. Layered on top of `UiPanel`/`UiImage` fill. Corner radii are
 * `[topLeft, topRight, bottomRight, bottomLeft]`; border widths are
 * `[top, right, bottom, left]`; both in pixels.
 */
export declare const UiBox: import("elics").Component<{
    borderRadius: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    borderWidth: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    borderColor: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
}>;
/** Input for {@link createUiBox} / {@link withUiBox}. */
export interface UiBoxInput {
    /** Uniform radius, or per-corner `[topLeft, topRight, bottomRight, bottomLeft]`. */
    readonly borderRadius?: number | readonly [number, number, number, number];
    /** Uniform width, or per-side `[top, right, bottom, left]`. */
    readonly borderWidth?: number | readonly [number, number, number, number];
    /** Border color (RGBA, 0..1). */
    readonly borderColor?: readonly [number, number, number, number];
}
/** Build initial {@link UiBox} data, expanding uniform shorthands. */
export declare function createUiBox(input?: UiBoxInput): ComponentInitialData<typeof UiBox>;
/** Spawn initializer that attaches a {@link UiBox} component. */
export declare function withUiBox(input?: UiBoxInput): (entity: Entity, context: {
    readonly world: EcsWorld;
}) => void;
//# sourceMappingURL=ui-box.d.ts.map