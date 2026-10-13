import { type UiBoxProps, type UiElement, type UiTextProps } from "../builder/builder.js";
type Color = readonly [number, number, number, number];
/** A framed, rounded surface for grouping content (game HUD panel). */
export declare function panel(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** A text label with HUD-friendly defaults. */
export declare function label(content: string, props?: UiTextProps): UiElement;
export interface HudBarProps extends UiBoxProps {
    /** Current value. */
    readonly value: number;
    /** Maximum value (default 1). */
    readonly max?: number;
    /** Track (background) color. */
    readonly trackColor?: Color;
    /** Fill (foreground) color. */
    readonly fillColor?: Color;
}
/**
 * A horizontal progress / resource bar (health, mana, XP). The fill width is
 * `value / max` of the track. Returns the track element with the fill child.
 */
export declare function hudBar(props: HudBarProps): UiElement;
/** A flexible spacer that grows to push siblings apart. */
export declare function spacer(grow?: number): UiElement;
/** Vertical stack with a default gap. */
export declare function vstack(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** Horizontal stack with a default gap. */
export declare function hstack(props?: UiBoxProps, children?: readonly UiElement[]): UiElement;
/** Game-oriented widget kit built on the declarative builder. */
export declare const kit: {
    readonly panel: typeof panel;
    readonly label: typeof label;
    readonly hudBar: typeof hudBar;
    readonly spacer: typeof spacer;
    readonly vstack: typeof vstack;
    readonly hstack: typeof hstack;
};
export {};
//# sourceMappingURL=kit.d.ts.map