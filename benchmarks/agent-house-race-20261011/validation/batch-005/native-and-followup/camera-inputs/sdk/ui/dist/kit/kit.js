import { box, column, row, text, } from "../builder/builder.js";
const PANEL_BG = [0.07, 0.09, 0.13, 0.92];
const PANEL_BORDER = [1, 1, 1, 0.12];
const TRACK_BG = [1, 1, 1, 0.14];
const ACCENT = [0.31, 0.65, 1, 1];
const TEXT_COLOR = [0.92, 0.94, 1, 1];
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
/** A framed, rounded surface for grouping content (game HUD panel). */
export function panel(props = {}, children = []) {
    return box({
        padding: 12,
        gap: 8,
        backgroundColor: PANEL_BG,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: PANEL_BORDER,
        ...props,
    }, children);
}
/** A text label with HUD-friendly defaults. */
export function label(content, props = {}) {
    return text(content, { fontSize: 16, color: TEXT_COLOR, ...props });
}
/**
 * A horizontal progress / resource bar (health, mana, XP). The fill width is
 * `value / max` of the track. Returns the track element with the fill child.
 */
export function hudBar(props) {
    const { value, max = 1, width = 200, height = 14, trackColor = TRACK_BG, fillColor = ACCENT, ...rest } = props;
    const ratio = clamp01(max <= 0 ? 0 : value / max) * 100;
    const radius = rest.borderRadius === undefined ? height / 2 : rest.borderRadius;
    return box({
        width,
        height,
        backgroundColor: trackColor,
        borderRadius: radius,
        clip: true,
        flexDirection: "row",
        ...rest,
    }, [
        box({
            widthPercent: ratio,
            height,
            backgroundColor: fillColor,
            borderRadius: radius,
        }),
    ]);
}
/** A flexible spacer that grows to push siblings apart. */
export function spacer(grow = 1) {
    return box({ flexGrow: grow });
}
/** Vertical stack with a default gap. */
export function vstack(props = {}, children = []) {
    return column({ gap: 8, ...props }, children);
}
/** Horizontal stack with a default gap. */
export function hstack(props = {}, children = []) {
    return row({ gap: 8, ...props }, children);
}
/** Game-oriented widget kit built on the declarative builder. */
export const kit = { panel, label, hudBar, spacer, vstack, hstack };
//# sourceMappingURL=kit.js.map