import type { Entity } from "@aperture-engine/simulation";
import { withUiImage, type SpawnEntityInitializer } from "@aperture-engine/runtime";
import { type UiFlexInput } from "../components/ui-flex.js";
import { type UiBoxInput } from "../components/ui-box.js";
/** A spawnable UI element: its own components plus its children. */
export interface UiElement {
    readonly initializers: readonly SpawnEntityInitializer[];
    readonly children: readonly UiElement[];
}
type Padding = number | readonly [number, number, number, number];
type Color = readonly [number, number, number, number];
/** Common box/flex/visual props shared by container elements. */
export interface UiBoxProps extends UiFlexInput {
    readonly width?: number;
    readonly height?: number;
    readonly x?: number;
    readonly y?: number;
    readonly padding?: Padding;
    readonly zIndex?: number;
    readonly opacity?: number;
    readonly clip?: boolean;
    readonly backgroundColor?: Color;
    readonly borderRadius?: UiBoxInput["borderRadius"];
    readonly borderWidth?: UiBoxInput["borderWidth"];
    readonly borderColor?: UiBoxInput["borderColor"];
    readonly cursor?: string;
    readonly priority?: number;
    readonly frozen?: boolean;
}
export interface UiScreenProps extends UiBoxProps {
    readonly layerMask?: number;
}
export interface UiTextProps extends UiBoxProps {
    readonly color?: Color;
    readonly fontSize?: number;
    readonly lineHeight?: number;
    readonly maxWidth?: number;
    readonly fontAtlasId?: string;
    readonly align?: "left" | "center" | "right";
}
export interface UiImageProps extends UiBoxProps {
    readonly texture: Parameters<typeof withUiImage>[0]["texture"];
    readonly sampler?: Parameters<typeof withUiImage>[0]["sampler"];
    readonly tint?: Color;
    readonly uvRect?: readonly [number, number, number, number];
}
/** A UI screen root. Its children flex-flow within the screen rectangle. */
export declare function screen(props?: UiScreenProps, children?: readonly UiElement[]): UiElement;
/** A flex container (column by default). */
export declare function box(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** A horizontal flex container. */
export declare function row(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** A vertical flex container. */
export declare function column(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** A text leaf. */
export declare function text(content: string, props?: UiTextProps): UiElement;
/** A textured image leaf. */
export declare function image(props: UiImageProps): UiElement;
/** An interactive button: a flex container with a hit target (cursor pointer). */
export declare function button(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** Namespace of element builders, for `ui.column(...)`-style authoring. */
export declare const ui: {
    readonly screen: typeof screen;
    readonly box: typeof box;
    readonly row: typeof row;
    readonly column: typeof column;
    readonly text: typeof text;
    readonly image: typeof image;
    readonly button: typeof button;
};
/** Minimal surface a {@link mountUi} target must provide. */
export interface UiMountTarget {
    spawn(...initializers: SpawnEntityInitializer[]): Entity;
}
/**
 * Spawn a {@link UiElement} tree into the world, wiring parent links. Returns the
 * root entity.
 */
export declare function mountUi(target: UiMountTarget, element: UiElement, parent?: Entity): Entity;
export {};
//# sourceMappingURL=builder.d.ts.map