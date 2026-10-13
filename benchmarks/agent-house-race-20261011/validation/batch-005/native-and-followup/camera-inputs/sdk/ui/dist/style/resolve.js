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
export const UI_BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
};
/** Breakpoints active for a given root width (width strictly greater than threshold). */
export function activeBreakpoints(width) {
    const order = ["sm", "md", "lg", "xl", "2xl"];
    return order.filter((bp) => width > UI_BREAKPOINTS[bp]);
}
const LAYER_KEYS = [
    "hover",
    "active",
    "focus",
    "dark",
    "important",
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
];
/**
 * Resolve a {@link ConditionalStyle} to a flat `T` for the given state. Layers
 * are applied low-to-high precedence so the highest-priority active layer wins
 * each property.
 */
export function resolveStyle(style, state = {}) {
    const base = stripLayers(style);
    const result = { ...base };
    const apply = (layer) => {
        if (layer !== undefined) {
            Object.assign(result, layer);
        }
    };
    // Responsive (ascending size → larger overrides smaller).
    const breakpoints = activeBreakpoints(state.width ?? 0);
    for (const bp of breakpoints) {
        apply(style[bp]);
    }
    // Interaction states (dark < hover < active < focus).
    if (state.dark === true) {
        apply(style.dark);
    }
    if (state.hover === true) {
        apply(style.hover);
    }
    if (state.active === true) {
        apply(style.active);
    }
    if (state.focus === true) {
        apply(style.focus);
    }
    // Important always wins.
    apply(style.important);
    return result;
}
function stripLayers(style) {
    const out = {};
    for (const [key, value] of Object.entries(style)) {
        if (!isLayerKey(key)) {
            out[key] = value;
        }
    }
    return out;
}
function isLayerKey(key) {
    return LAYER_KEYS.includes(key);
}
//# sourceMappingURL=resolve.js.map