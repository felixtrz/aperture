import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "@aperture-engine/simulation";
/**
 * Styling for a scroll node's rendered scrollbar. Attach to an entity that also
 * has `UiScroll`; the extractor synthesizes a vertical thumb panel sized from
 * the content/viewport ratio when the content overflows. Without this component,
 * a scroll node still renders a default-styled thumb.
 */
export declare const UiScrollbar: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    width: {
        type: EcsType.Float32;
        default: number;
    };
    minThumb: {
        type: EcsType.Float32;
        default: number;
    };
    color: {
        type: EcsType.Color;
        default: [number, number, number, number];
    };
}>;
export interface UiScrollbarInput {
    readonly enabled?: boolean;
    readonly width?: number;
    readonly minThumb?: number;
    readonly color?: readonly [number, number, number, number];
}
export declare function createUiScrollbar(input?: UiScrollbarInput): ComponentInitialData<typeof UiScrollbar>;
export declare function withUiScrollbar(input?: UiScrollbarInput): (entity: Entity, context: {
    readonly world: EcsWorld;
}) => void;
//# sourceMappingURL=ui-scrollbar.d.ts.map