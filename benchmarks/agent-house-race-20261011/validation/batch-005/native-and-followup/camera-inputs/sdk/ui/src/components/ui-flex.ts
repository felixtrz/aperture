import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

/** Flex main-axis direction. */
export const UiFlexDirection = {
  Row: "row",
  RowReverse: "row-reverse",
  Column: "column",
  ColumnReverse: "column-reverse",
} as const;
export type UiFlexDirection =
  (typeof UiFlexDirection)[keyof typeof UiFlexDirection];

/** Flex wrapping. */
export const UiFlexWrap = {
  NoWrap: "no-wrap",
  Wrap: "wrap",
  WrapReverse: "wrap-reverse",
} as const;
export type UiFlexWrap = (typeof UiFlexWrap)[keyof typeof UiFlexWrap];

/** Main-axis distribution. */
export const UiJustify = {
  FlexStart: "flex-start",
  Center: "center",
  FlexEnd: "flex-end",
  SpaceBetween: "space-between",
  SpaceAround: "space-around",
  SpaceEvenly: "space-evenly",
} as const;
export type UiJustify = (typeof UiJustify)[keyof typeof UiJustify];

/** Cross-axis alignment. */
export const UiAlign = {
  Auto: "auto",
  FlexStart: "flex-start",
  Center: "center",
  FlexEnd: "flex-end",
  Stretch: "stretch",
  Baseline: "baseline",
  SpaceBetween: "space-between",
  SpaceAround: "space-around",
  SpaceEvenly: "space-evenly",
} as const;
export type UiAlign = (typeof UiAlign)[keyof typeof UiAlign];

/** Positioning scheme. */
export const UiPositionType = {
  Relative: "relative",
  Absolute: "absolute",
} as const;
export type UiPositionType =
  (typeof UiPositionType)[keyof typeof UiPositionType];

/** Sentinel meaning "field unset" for optional numeric constraints. */
export const UI_FLEX_UNSET = -1;

/**
 * Full flexbox style for a UI node, layered over the legacy `UiNode` fields.
 * When present, its values override/augment the direction and box-model derived
 * from `UiNode`. Numeric constraints use -1 ({@link UI_FLEX_UNSET}) to mean
 * "unset"; `aspectRatio` uses 0 to mean unset; gaps use -1 to fall back to the
 * shared `gap`.
 */
export const UiFlex = defineComponent(
  "aperture.ui.flex",
  {
    flexDirection: {
      type: EcsType.Enum,
      enum: UiFlexDirection,
      default: UiFlexDirection.Column,
    },
    flexWrap: {
      type: EcsType.Enum,
      enum: UiFlexWrap,
      default: UiFlexWrap.NoWrap,
    },
    justifyContent: {
      type: EcsType.Enum,
      enum: UiJustify,
      default: UiJustify.FlexStart,
    },
    alignItems: { type: EcsType.Enum, enum: UiAlign, default: UiAlign.Stretch },
    alignSelf: { type: EcsType.Enum, enum: UiAlign, default: UiAlign.Auto },
    alignContent: {
      type: EcsType.Enum,
      enum: UiAlign,
      default: UiAlign.FlexStart,
    },
    flexGrow: { type: EcsType.Float32, default: 0 },
    flexShrink: { type: EcsType.Float32, default: 0 },
    gap: { type: EcsType.Float32, default: 0 },
    rowGap: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    columnGap: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    minWidth: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    minHeight: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    maxWidth: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    maxHeight: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    widthPercent: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    heightPercent: { type: EcsType.Float32, default: UI_FLEX_UNSET },
    aspectRatio: { type: EcsType.Float32, default: 0 },
    positionType: {
      type: EcsType.Enum,
      enum: UiPositionType,
      default: UiPositionType.Relative,
    },
    margin: {
      type: EcsType.Vec4,
      default: [0, 0, 0, 0] as [number, number, number, number],
    },
  },
  "Full flexbox style for a UI node, layered over the legacy UiNode fields.",
);

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
export function createUiFlex(
  input: UiFlexInput = {},
): ComponentInitialData<typeof UiFlex> {
  return {
    flexDirection: input.flexDirection ?? UiFlexDirection.Column,
    flexWrap: input.flexWrap ?? UiFlexWrap.NoWrap,
    justifyContent: input.justifyContent ?? UiJustify.FlexStart,
    alignItems: input.alignItems ?? UiAlign.Stretch,
    alignSelf: input.alignSelf ?? UiAlign.Auto,
    alignContent: input.alignContent ?? UiAlign.FlexStart,
    flexGrow: input.flexGrow ?? 0,
    flexShrink: input.flexShrink ?? 0,
    gap: input.gap ?? 0,
    rowGap: input.rowGap ?? UI_FLEX_UNSET,
    columnGap: input.columnGap ?? UI_FLEX_UNSET,
    minWidth: input.minWidth ?? UI_FLEX_UNSET,
    minHeight: input.minHeight ?? UI_FLEX_UNSET,
    maxWidth: input.maxWidth ?? UI_FLEX_UNSET,
    maxHeight: input.maxHeight ?? UI_FLEX_UNSET,
    widthPercent: input.widthPercent ?? UI_FLEX_UNSET,
    heightPercent: input.heightPercent ?? UI_FLEX_UNSET,
    aspectRatio: input.aspectRatio ?? 0,
    positionType: input.positionType ?? UiPositionType.Relative,
    margin: (input.margin ?? [0, 0, 0, 0]) as [number, number, number, number],
  };
}

/**
 * Spawn initializer that attaches a {@link UiFlex} component (registering it on
 * the world first). Compatible with `app.spawn(...)`.
 */
export function withUiFlex(
  input: UiFlexInput = {},
): (entity: Entity, context: { readonly world: EcsWorld }) => void {
  return (entity, context) => {
    context.world.registerComponent(UiFlex);
    entity.addComponent(UiFlex, createUiFlex(input));
  };
}
