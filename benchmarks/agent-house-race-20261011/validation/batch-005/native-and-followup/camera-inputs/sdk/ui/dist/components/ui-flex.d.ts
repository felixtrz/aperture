import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "@aperture-engine/simulation";
/** Flex main-axis direction. */
export declare const UiFlexDirection: {
    readonly Row: "row";
    readonly RowReverse: "row-reverse";
    readonly Column: "column";
    readonly ColumnReverse: "column-reverse";
};
export type UiFlexDirection = (typeof UiFlexDirection)[keyof typeof UiFlexDirection];
/** Flex wrapping. */
export declare const UiFlexWrap: {
    readonly NoWrap: "no-wrap";
    readonly Wrap: "wrap";
    readonly WrapReverse: "wrap-reverse";
};
export type UiFlexWrap = (typeof UiFlexWrap)[keyof typeof UiFlexWrap];
/** Main-axis distribution. */
export declare const UiJustify: {
    readonly FlexStart: "flex-start";
    readonly Center: "center";
    readonly FlexEnd: "flex-end";
    readonly SpaceBetween: "space-between";
    readonly SpaceAround: "space-around";
    readonly SpaceEvenly: "space-evenly";
};
export type UiJustify = (typeof UiJustify)[keyof typeof UiJustify];
/** Cross-axis alignment. */
export declare const UiAlign: {
    readonly Auto: "auto";
    readonly FlexStart: "flex-start";
    readonly Center: "center";
    readonly FlexEnd: "flex-end";
    readonly Stretch: "stretch";
    readonly Baseline: "baseline";
    readonly SpaceBetween: "space-between";
    readonly SpaceAround: "space-around";
    readonly SpaceEvenly: "space-evenly";
};
export type UiAlign = (typeof UiAlign)[keyof typeof UiAlign];
/** Positioning scheme. */
export declare const UiPositionType: {
    readonly Relative: "relative";
    readonly Absolute: "absolute";
};
export type UiPositionType = (typeof UiPositionType)[keyof typeof UiPositionType];
/** Sentinel meaning "field unset" for optional numeric constraints. */
export declare const UI_FLEX_UNSET = -1;
/**
 * Full flexbox style for a UI node, layered over the legacy `UiNode` fields.
 * When present, its values override/augment the direction and box-model derived
 * from `UiNode`. Numeric constraints use -1 ({@link UI_FLEX_UNSET}) to mean
 * "unset"; `aspectRatio` uses 0 to mean unset; gaps use -1 to fall back to the
 * shared `gap`.
 */
export declare const UiFlex: import("elics").Component<{
    flexDirection: {
        type: EcsType.Enum;
        enum: {
            readonly Row: "row";
            readonly RowReverse: "row-reverse";
            readonly Column: "column";
            readonly ColumnReverse: "column-reverse";
        };
        default: "column";
    };
    flexWrap: {
        type: EcsType.Enum;
        enum: {
            readonly NoWrap: "no-wrap";
            readonly Wrap: "wrap";
            readonly WrapReverse: "wrap-reverse";
        };
        default: "no-wrap";
    };
    justifyContent: {
        type: EcsType.Enum;
        enum: {
            readonly FlexStart: "flex-start";
            readonly Center: "center";
            readonly FlexEnd: "flex-end";
            readonly SpaceBetween: "space-between";
            readonly SpaceAround: "space-around";
            readonly SpaceEvenly: "space-evenly";
        };
        default: "flex-start";
    };
    alignItems: {
        type: EcsType.Enum;
        enum: {
            readonly Auto: "auto";
            readonly FlexStart: "flex-start";
            readonly Center: "center";
            readonly FlexEnd: "flex-end";
            readonly Stretch: "stretch";
            readonly Baseline: "baseline";
            readonly SpaceBetween: "space-between";
            readonly SpaceAround: "space-around";
            readonly SpaceEvenly: "space-evenly";
        };
        default: "stretch";
    };
    alignSelf: {
        type: EcsType.Enum;
        enum: {
            readonly Auto: "auto";
            readonly FlexStart: "flex-start";
            readonly Center: "center";
            readonly FlexEnd: "flex-end";
            readonly Stretch: "stretch";
            readonly Baseline: "baseline";
            readonly SpaceBetween: "space-between";
            readonly SpaceAround: "space-around";
            readonly SpaceEvenly: "space-evenly";
        };
        default: "auto";
    };
    alignContent: {
        type: EcsType.Enum;
        enum: {
            readonly Auto: "auto";
            readonly FlexStart: "flex-start";
            readonly Center: "center";
            readonly FlexEnd: "flex-end";
            readonly Stretch: "stretch";
            readonly Baseline: "baseline";
            readonly SpaceBetween: "space-between";
            readonly SpaceAround: "space-around";
            readonly SpaceEvenly: "space-evenly";
        };
        default: "flex-start";
    };
    flexGrow: {
        type: EcsType.Float32;
        default: number;
    };
    flexShrink: {
        type: EcsType.Float32;
        default: number;
    };
    gap: {
        type: EcsType.Float32;
        default: number;
    };
    rowGap: {
        type: EcsType.Float32;
        default: number;
    };
    columnGap: {
        type: EcsType.Float32;
        default: number;
    };
    minWidth: {
        type: EcsType.Float32;
        default: number;
    };
    minHeight: {
        type: EcsType.Float32;
        default: number;
    };
    maxWidth: {
        type: EcsType.Float32;
        default: number;
    };
    maxHeight: {
        type: EcsType.Float32;
        default: number;
    };
    widthPercent: {
        type: EcsType.Float32;
        default: number;
    };
    heightPercent: {
        type: EcsType.Float32;
        default: number;
    };
    aspectRatio: {
        type: EcsType.Float32;
        default: number;
    };
    positionType: {
        type: EcsType.Enum;
        enum: {
            readonly Relative: "relative";
            readonly Absolute: "absolute";
        };
        default: "relative";
    };
    margin: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
}>;
/** Input for {@link createUiFlex} / {@link withUiFlex}. */
export interface UiFlexInput {
    readonly flexDirection?: UiFlexDirection;
    readonly flexWrap?: UiFlexWrap;
    readonly justifyContent?: UiJustify;
    readonly alignItems?: UiAlign;
    readonly alignSelf?: UiAlign;
    readonly alignContent?: UiAlign;
    readonly flexGrow?: number;
    readonly flexShrink?: number;
    readonly gap?: number;
    readonly rowGap?: number;
    readonly columnGap?: number;
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
    readonly widthPercent?: number;
    readonly heightPercent?: number;
    readonly aspectRatio?: number;
    readonly positionType?: UiPositionType;
    /** `[top, right, bottom, left]` margins in pixels. */
    readonly margin?: readonly [number, number, number, number];
}
/** Build initial {@link UiFlex} data, normalizing unset fields. */
export declare function createUiFlex(input?: UiFlexInput): ComponentInitialData<typeof UiFlex>;
/**
 * Spawn initializer that attaches a {@link UiFlex} component (registering it on
 * the world first). Compatible with `app.spawn(...)`.
 */
export declare function withUiFlex(input?: UiFlexInput): (entity: Entity, context: {
    readonly world: EcsWorld;
}) => void;
//# sourceMappingURL=ui-flex.d.ts.map