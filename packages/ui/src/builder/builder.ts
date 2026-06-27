import type { Entity } from "@aperture-engine/simulation";
import {
  withTransform,
  withUiHitTarget,
  withUiImage,
  withUiNode,
  withUiPanel,
  withUiScreen,
  withUiText,
  type SpawnEntityInitializer,
} from "@aperture-engine/runtime";
import { withUiFlex, type UiFlexInput } from "../components/ui-flex.js";
import { withUiBox, type UiBoxInput } from "../components/ui-box.js";
import { withUiFreezeLayout } from "../components/ui-freeze.js";

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

function toPaddingTuple(
  padding: Padding | undefined,
): [number, number, number, number] | undefined {
  if (padding === undefined) {
    return undefined;
  }
  return typeof padding === "number"
    ? [padding, padding, padding, padding]
    : [padding[0], padding[1], padding[2], padding[3]];
}

function nodeInitializer(props: UiBoxProps): SpawnEntityInitializer {
  const padding = toPaddingTuple(props.padding);
  return withUiNode({
    ...(props.x === undefined ? {} : { x: props.x }),
    ...(props.y === undefined ? {} : { y: props.y }),
    ...(props.width === undefined ? {} : { width: props.width }),
    ...(props.height === undefined ? {} : { height: props.height }),
    ...(padding === undefined ? {} : { padding }),
    ...(props.gap === undefined ? {} : { gap: props.gap }),
    ...(props.zIndex === undefined ? {} : { zIndex: props.zIndex }),
    ...(props.opacity === undefined ? {} : { opacity: props.opacity }),
    ...(props.clip === undefined ? {} : { clip: props.clip }),
  });
}

function hasBorder(props: UiBoxProps): boolean {
  return (
    props.borderRadius !== undefined ||
    props.borderWidth !== undefined ||
    props.borderColor !== undefined
  );
}

function boxInitializers(props: UiBoxProps): SpawnEntityInitializer[] {
  const init: SpawnEntityInitializer[] = [
    nodeInitializer(props),
    withUiFlex(props),
  ];
  if (hasBorder(props)) {
    init.push(
      withUiBox({
        ...(props.borderRadius === undefined
          ? {}
          : { borderRadius: props.borderRadius }),
        ...(props.borderWidth === undefined
          ? {}
          : { borderWidth: props.borderWidth }),
        ...(props.borderColor === undefined
          ? {}
          : { borderColor: props.borderColor }),
      }),
    );
  }
  if (props.backgroundColor !== undefined) {
    init.push(withUiPanel({ color: props.backgroundColor }));
  }
  if (props.cursor !== undefined || props.priority !== undefined) {
    init.push(
      withUiHitTarget({
        ...(props.cursor === undefined ? {} : { cursor: props.cursor }),
        ...(props.priority === undefined ? {} : { priority: props.priority }),
      }),
    );
  }
  if (props.frozen === true) {
    init.push(withUiFreezeLayout());
  }
  return init;
}

/** A UI screen root. Its children flex-flow within the screen rectangle. */
export function screen(
  props: UiScreenProps = {},
  children: readonly UiElement[] = [],
): UiElement {
  return {
    initializers: [
      withUiScreen({
        ...(props.width === undefined ? {} : { width: props.width }),
        ...(props.height === undefined ? {} : { height: props.height }),
        ...(props.layerMask === undefined
          ? {}
          : { layerMask: props.layerMask }),
      }),
      // A UiNode carries the screen's padding/gap (size comes from UiScreen).
      nodeInitializer(props),
      withUiFlex(props),
    ],
    children,
  };
}

/** A flex container (column by default). */
export function box(
  props: UiBoxProps = {},
  children: readonly UiElement[] = [],
): UiElement {
  return { initializers: boxInitializers(props), children };
}

/** A horizontal flex container. */
export function row(
  props: UiBoxProps = {},
  children: readonly UiElement[] = [],
): UiElement {
  return box(
    { ...props, flexDirection: props.flexDirection ?? "row" },
    children,
  );
}

/** A vertical flex container. */
export function column(
  props: UiBoxProps = {},
  children: readonly UiElement[] = [],
): UiElement {
  return box(
    { ...props, flexDirection: props.flexDirection ?? "column" },
    children,
  );
}

/** A text leaf. */
export function text(content: string, props: UiTextProps = {}): UiElement {
  return {
    initializers: [
      ...boxInitializers(props),
      withUiText({
        text: content,
        ...(props.color === undefined ? {} : { color: props.color }),
        ...(props.fontSize === undefined ? {} : { fontSize: props.fontSize }),
        ...(props.lineHeight === undefined
          ? {}
          : { lineHeight: props.lineHeight }),
        ...(props.maxWidth === undefined ? {} : { maxWidth: props.maxWidth }),
        ...(props.fontAtlasId === undefined
          ? {}
          : { fontAtlasId: props.fontAtlasId }),
        ...(props.align === undefined ? {} : { align: props.align }),
      }),
    ],
    children: [],
  };
}

/** A textured image leaf. */
export function image(props: UiImageProps): UiElement {
  return {
    initializers: [
      ...boxInitializers(props),
      withUiImage({
        texture: props.texture,
        ...(props.sampler === undefined ? {} : { sampler: props.sampler }),
        ...(props.tint === undefined ? {} : { color: props.tint }),
        ...(props.uvRect === undefined ? {} : { uvRect: props.uvRect }),
      }),
    ],
    children: [],
  };
}

/** An interactive button: a flex container with a hit target (cursor pointer). */
export function button(
  props: UiBoxProps = {},
  children: readonly UiElement[] = [],
): UiElement {
  return box(
    {
      cursor: props.cursor ?? "pointer",
      priority: props.priority ?? 1,
      ...props,
    },
    children,
  );
}

/** Namespace of element builders, for `ui.column(...)`-style authoring. */
export const ui = { screen, box, row, column, text, image, button } as const;

/** Minimal surface a {@link mountUi} target must provide. */
export interface UiMountTarget {
  spawn(...initializers: SpawnEntityInitializer[]): Entity;
}

/**
 * Spawn a {@link UiElement} tree into the world, wiring parent links. Returns the
 * root entity.
 */
export function mountUi(
  target: UiMountTarget,
  element: UiElement,
  parent?: Entity,
): Entity {
  const initializers =
    parent === undefined
      ? [...element.initializers]
      : [...element.initializers, withTransform({ parent })];
  const entity = target.spawn(...initializers);
  for (const child of element.children) {
    mountUi(target, child, entity);
  }
  return entity;
}
