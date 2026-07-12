// The standard Penner easing set as pure, allocation-free `(t) => number`
// functions over normalized time `t` in `[0, 1]` (decision 0007: plain
// functions, no tween classes). Every function maps `0 -> 0` and `1 -> 1`;
// the Back and Elastic families overshoot outside `[0, 1]` in between (that
// is their purpose). Formulas follow the canonical closed forms
// (easings.net); inputs outside `[0, 1]` are not clamped — the curves simply
// extrapolate.

/** A normalized easing curve: maps `t` in `[0, 1]` with `f(0)=0`, `f(1)=1`. */
export type EasingFunction = (t: number) => number;

const BACK_OVERSHOOT = 1.70158; // Penner's default: 10% overshoot.
const BACK_OVERSHOOT_IN_OUT = BACK_OVERSHOOT * 1.525;
const ELASTIC_PERIOD = (2 * Math.PI) / 3;
const ELASTIC_PERIOD_IN_OUT = (2 * Math.PI) / 4.5;
const BOUNCE_STIFFNESS = 7.5625;
const BOUNCE_INTERVAL = 2.75;

/** Identity easing (constant velocity). */
export function easeLinear(t: number): number {
  return t;
}

/** Quadratic ease-in: `t^2`. */
export function easeInQuad(t: number): number {
  return t * t;
}

/** Quadratic ease-out: `1 - (1-t)^2`. */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Quadratic ease-in-out. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
}

/** Cubic ease-in: `t^3`. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Cubic ease-out: `1 - (1-t)^3`. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/** Cubic ease-in-out. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Quartic ease-in: `t^4`. */
export function easeInQuart(t: number): number {
  return t * t * t * t;
}

/** Quartic ease-out: `1 - (1-t)^4`. */
export function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

/** Quartic ease-in-out. */
export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2;
}

/** Quintic ease-in: `t^5`. */
export function easeInQuint(t: number): number {
  return t * t * t * t * t;
}

/** Quintic ease-out: `1 - (1-t)^5`. */
export function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

/** Quintic ease-in-out. */
export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - (-2 * t + 2) ** 5 / 2;
}

/** Sinusoidal ease-in: a quarter cosine wave. */
export function easeInSine(t: number): number {
  return 1 - Math.cos((t * Math.PI) / 2);
}

/** Sinusoidal ease-out: a quarter sine wave. */
export function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}

/** Sinusoidal ease-in-out: a half cosine wave. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Exponential ease-in: `2^(10t - 10)`, pinned to `0` at `t = 0`. */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : 2 ** (10 * t - 10);
}

/** Exponential ease-out: `1 - 2^(-10t)`, pinned to `1` at `t = 1`. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

/** Exponential ease-in-out, pinned to exact endpoints. */
export function easeInOutExpo(t: number): number {
  if (t === 0) {
    return 0;
  }
  if (t === 1) {
    return 1;
  }
  return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
}

/** Circular ease-in: a quarter circle arc. */
export function easeInCirc(t: number): number {
  return 1 - Math.sqrt(1 - t * t);
}

/** Circular ease-out: a quarter circle arc. */
export function easeOutCirc(t: number): number {
  return Math.sqrt(1 - (t - 1) * (t - 1));
}

/** Circular ease-in-out. */
export function easeInOutCirc(t: number): number {
  return t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
}

/** Back ease-in: pulls behind `0` before accelerating (10% overshoot). */
export function easeInBack(t: number): number {
  const c3 = BACK_OVERSHOOT + 1;
  return c3 * t * t * t - BACK_OVERSHOOT * t * t;
}

/** Back ease-out: overshoots past `1` before settling (10% overshoot). */
export function easeOutBack(t: number): number {
  const c3 = BACK_OVERSHOOT + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + BACK_OVERSHOOT * u * u;
}

/** Back ease-in-out: overshoots on both ends (Penner's scaled constant). */
export function easeInOutBack(t: number): number {
  const c2 = BACK_OVERSHOOT_IN_OUT;
  return t < 0.5
    ? (4 * t * t * ((c2 + 1) * 2 * t - c2)) / 2
    : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

/** Elastic ease-in: an exponentially growing oscillation into the start. */
export function easeInElastic(t: number): number {
  if (t === 0) {
    return 0;
  }
  if (t === 1) {
    return 1;
  }
  return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ELASTIC_PERIOD);
}

/** Elastic ease-out: an exponentially decaying oscillation past the end. */
export function easeOutElastic(t: number): number {
  if (t === 0) {
    return 0;
  }
  if (t === 1) {
    return 1;
  }
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_PERIOD) + 1;
}

/** Elastic ease-in-out: oscillates into and out of the midpoint. */
export function easeInOutElastic(t: number): number {
  if (t === 0) {
    return 0;
  }
  if (t === 1) {
    return 1;
  }
  const angle = Math.sin((20 * t - 11.125) * ELASTIC_PERIOD_IN_OUT);
  return t < 0.5
    ? -(2 ** (20 * t - 10) * angle) / 2
    : (2 ** (-20 * t + 10) * angle) / 2 + 1;
}

/** Bounce ease-out: four decaying parabolic bounces settling on `1`. */
export function easeOutBounce(t: number): number {
  const n1 = BOUNCE_STIFFNESS;
  const d1 = BOUNCE_INTERVAL;

  if (t < 1 / d1) {
    return n1 * t * t;
  }
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

/** Bounce ease-in: `easeOutBounce` mirrored to bounce away from `0`. */
export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

/** Bounce ease-in-out: bounces away from `0` and again onto `1`. */
export function easeInOutBounce(t: number): number {
  return t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;
}
