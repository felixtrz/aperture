/**
 * Conditional + responsive style resolution, mirroring uikit's layered model.
 * Given a base style plus conditional override layers, this computes the final
 * flat style for the current interaction state and screen width by merging
 * layers in precedence order (highest priority wins per property):
 *
 *   important > focus > active > hover > dark > 2xl > xl > lg > md > sm > base
 *
 * Responsive layers cascade: every breakpoint whose threshold the width exceeds
 * contributes, with the larger breakpoint overriding the smaller.
 */
/** Tailwind-style breakpoint thresholds (min width, exclusive lower bound). */
export declare const UI_BREAKPOINTS: {
    readonly sm: 640;
    readonly md: 768;
    readonly lg: 1024;
    readonly xl: 1280;
    readonly "2xl": 1536;
};
export type UiBreakpoint = keyof typeof UI_BREAKPOINTS;
/** Breakpoints active for a given root width (width strictly greater than threshold). */
export declare function activeBreakpoints(width: number): UiBreakpoint[];
/** Interaction state + viewport used to resolve conditional layers. */
export interface UiStyleState {
    readonly hover?: boolean;
    readonly active?: boolean;
    readonly focus?: boolean;
    readonly dark?: boolean;
    /** Root/screen width, for responsive breakpoints. */
    readonly width?: number;
}
/** A base style `T` plus optional conditional and responsive override layers. */
export type ConditionalStyle<T> = T & {
    readonly hover?: Partial<T>;
    readonly active?: Partial<T>;
    readonly focus?: Partial<T>;
    readonly dark?: Partial<T>;
    readonly important?: Partial<T>;
    readonly sm?: Partial<T>;
    readonly md?: Partial<T>;
    readonly lg?: Partial<T>;
    readonly xl?: Partial<T>;
    readonly "2xl"?: Partial<T>;
};
/**
 * Resolve a {@link ConditionalStyle} to a flat `T` for the given state. Layers
 * are applied low-to-high precedence so the highest-priority active layer wins
 * each property.
 */
export declare function resolveStyle<T extends object>(style: ConditionalStyle<T>, state?: UiStyleState): T;
//# sourceMappingURL=resolve.d.ts.map