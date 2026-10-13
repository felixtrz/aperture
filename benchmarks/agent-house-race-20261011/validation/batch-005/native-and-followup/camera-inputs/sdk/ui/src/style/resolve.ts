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
} as const;

export type UiBreakpoint = keyof typeof UI_BREAKPOINTS;

/** Breakpoints active for a given root width (width strictly greater than threshold). */
export function activeBreakpoints(width: number): UiBreakpoint[] {
  const order: UiBreakpoint[] = ["sm", "md", "lg", "xl", "2xl"];
  return order.filter((bp) => width > UI_BREAKPOINTS[bp]);
}

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
] as const;

type LayerKey = (typeof LAYER_KEYS)[number];

/**
 * Resolve a {@link ConditionalStyle} to a flat `T` for the given state. Layers
 * are applied low-to-high precedence so the highest-priority active layer wins
 * each property.
 */
export function resolveStyle<T extends object>(
  style: ConditionalStyle<T>,
  state: UiStyleState = {},
): T {
  const base = stripLayers(style) as Record<string, unknown>;
  const result: Record<string, unknown> = { ...base };

  const apply = (layer: Partial<T> | undefined): void => {
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

  return result as T;
}

function stripLayers<T extends object>(style: ConditionalStyle<T>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (!isLayerKey(key)) {
      out[key] = value;
    }
  }
  return out as T;
}

function isLayerKey(key: string): key is LayerKey {
  return (LAYER_KEYS as readonly string[]).includes(key);
}
