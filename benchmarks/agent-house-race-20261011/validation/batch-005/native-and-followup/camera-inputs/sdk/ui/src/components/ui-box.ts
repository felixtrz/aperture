import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

/**
 * Visual box styling for a UI node: rounded corners and borders, rendered by the
 * SDF panel shader. Layered on top of `UiPanel`/`UiImage` fill. Corner radii are
 * `[topLeft, topRight, bottomRight, bottomLeft]`; border widths are
 * `[top, right, bottom, left]`; both in pixels.
 */
export const UiBox = defineComponent(
  "aperture.ui.box",
  {
    borderRadius: {
      type: EcsType.Vec4,
      default: [0, 0, 0, 0] as [number, number, number, number],
    },
    borderWidth: {
      type: EcsType.Vec4,
      default: [0, 0, 0, 0] as [number, number, number, number],
    },
    borderColor: {
      type: EcsType.Color,
      default: [0, 0, 0, 1] as [number, number, number, number],
    },
  },
  "Rounded-corner + border styling for a UI node, rendered by the SDF panel shader.",
);

/** Input for {@link createUiBox} / {@link withUiBox}. */
export interface UiBoxInput {
  /** Uniform radius, or per-corner `[topLeft, topRight, bottomRight, bottomLeft]`. */
  readonly borderRadius?: number | readonly [number, number, number, number];
  /** Uniform width, or per-side `[top, right, bottom, left]`. */
  readonly borderWidth?: number | readonly [number, number, number, number];
  /** Border color (RGBA, 0..1). */
  readonly borderColor?: readonly [number, number, number, number];
}

function toVec4(
  value: number | readonly [number, number, number, number] | undefined,
): [number, number, number, number] {
  if (value === undefined) {
    return [0, 0, 0, 0];
  }
  if (typeof value === "number") {
    return [value, value, value, value];
  }
  return [value[0], value[1], value[2], value[3]];
}

/** Build initial {@link UiBox} data, expanding uniform shorthands. */
export function createUiBox(
  input: UiBoxInput = {},
): ComponentInitialData<typeof UiBox> {
  return {
    borderRadius: toVec4(input.borderRadius),
    borderWidth: toVec4(input.borderWidth),
    borderColor: (input.borderColor ?? [0, 0, 0, 1]) as [
      number,
      number,
      number,
      number,
    ],
  };
}

/** Spawn initializer that attaches a {@link UiBox} component. */
export function withUiBox(
  input: UiBoxInput = {},
): (entity: Entity, context: { readonly world: EcsWorld }) => void {
  return (entity, context) => {
    context.world.registerComponent(UiBox);
    entity.addComponent(UiBox, createUiBox(input));
  };
}
