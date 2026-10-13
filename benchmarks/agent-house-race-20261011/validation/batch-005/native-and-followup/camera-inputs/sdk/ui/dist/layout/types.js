/**
 * Framework-agnostic flexbox layout model. These types describe layout intent
 * independent of any layout engine; the Yoga adapter maps them onto
 * `yoga-layout`. Keeping them engine-neutral preserves the option of swapping in
 * a Taffy-backed adapter later (see docs/UI_PACKAGE_PLAN.md).
 */
/**
 * Documented engine defaults applied to any field a {@link LayoutStyle} leaves
 * unset. Chosen for in-scene UI: column stacking, no grow/shrink, stretch
 * cross-axis. The engine never relies on hidden Yoga config defaults — layout is
 * fully determined by the style plus these values.
 */
export const DEFAULT_LAYOUT_STYLE = {
    display: "flex",
    flexDirection: "column",
    flexWrap: "no-wrap",
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    justifyContent: "flex-start",
    alignItems: "stretch",
    alignSelf: "auto",
    alignContent: "flex-start",
    gap: 0,
    width: "auto",
    height: "auto",
    positionType: "relative",
    padding: 0,
    margin: 0,
    border: 0,
    overflow: "visible",
};
//# sourceMappingURL=types.js.map