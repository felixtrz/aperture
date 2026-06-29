/**
 * Framework-agnostic flexbox layout model. These types describe layout intent
 * independent of any layout engine; the Yoga adapter maps them onto
 * `yoga-layout`. Keeping them engine-neutral preserves the option of swapping in
 * a Taffy-backed adapter later (see docs/UI_PACKAGE_PLAN.md).
 */

/** A length that may be a pixel number, a percentage string, or `"auto"`. */
export type LayoutDimension = number | `${number}%` | "auto";

/** A length that may be a pixel number or a percentage string (no `"auto"`). */
export type LayoutLength = number | `${number}%`;

/** A margin value: pixel number, percentage string, or `"auto"`. */
export type LayoutMarginValue = number | `${number}%` | "auto";

export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";

export type FlexWrap = "no-wrap" | "wrap" | "wrap-reverse";

export type JustifyContent =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type Align =
  | "auto"
  | "flex-start"
  | "center"
  | "flex-end"
  | "stretch"
  | "baseline"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type PositionType = "static" | "relative" | "absolute";

export type Overflow = "visible" | "hidden" | "scroll";

export type Display = "flex" | "none" | "contents";

/**
 * The complete flexbox style for one layout node. Every field is optional; unset
 * fields fall back to {@link DEFAULT_LAYOUT_STYLE}. Shorthands (`padding`,
 * `margin`, `border`, `gap`) are overridden by their per-side / per-axis
 * counterparts when both are present.
 */
export interface LayoutStyle {
  readonly display?: Display;

  readonly flexDirection?: FlexDirection;
  readonly flexWrap?: FlexWrap;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly flexBasis?: LayoutDimension;

  readonly justifyContent?: JustifyContent;
  readonly alignItems?: Align;
  readonly alignSelf?: Align;
  readonly alignContent?: Align;

  readonly gap?: number;
  readonly rowGap?: number;
  readonly columnGap?: number;

  readonly width?: LayoutDimension;
  readonly height?: LayoutDimension;
  readonly minWidth?: LayoutLength;
  readonly minHeight?: LayoutLength;
  readonly maxWidth?: LayoutLength;
  readonly maxHeight?: LayoutLength;
  readonly aspectRatio?: number;

  readonly positionType?: PositionType;
  readonly top?: LayoutLength;
  readonly right?: LayoutLength;
  readonly bottom?: LayoutLength;
  readonly left?: LayoutLength;

  readonly padding?: number;
  readonly paddingTop?: LayoutLength;
  readonly paddingRight?: LayoutLength;
  readonly paddingBottom?: LayoutLength;
  readonly paddingLeft?: LayoutLength;

  readonly margin?: number;
  readonly marginTop?: LayoutMarginValue;
  readonly marginRight?: LayoutMarginValue;
  readonly marginBottom?: LayoutMarginValue;
  readonly marginLeft?: LayoutMarginValue;

  readonly border?: number;
  readonly borderTop?: number;
  readonly borderRight?: number;
  readonly borderBottom?: number;
  readonly borderLeft?: number;

  readonly overflow?: Overflow;
}

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
} as const satisfies LayoutStyle;

/** The resolved layout of a node, relative to its parent's border box. */
export interface ComputedRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly paddingTop: number;
  readonly paddingRight: number;
  readonly paddingBottom: number;
  readonly paddingLeft: number;
  readonly borderTop: number;
  readonly borderRight: number;
  readonly borderBottom: number;
  readonly borderLeft: number;
}

/** How a measured dimension is constrained, mirroring Yoga's measure modes. */
export type MeasureMode = "undefined" | "exactly" | "at-most";

export interface MeasureSize {
  readonly width: number;
  readonly height: number;
}

/**
 * A leaf measure function (e.g. text). Called by the engine with the available
 * space and constraint mode for each axis; returns the intrinsic size.
 */
export type MeasureFn = (
  availableWidth: number,
  widthMode: MeasureMode,
  availableHeight: number,
  heightMode: MeasureMode,
) => MeasureSize;
