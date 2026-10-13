/**
 * Single-line caret + selection geometry from a text value. `advance` returns
 * the horizontal advance (px) of a character; supply a real per-glyph advance
 * from the MSDF atlas, or use a fixed monospace width. Keeps the geometry pure
 * and testable, independent of the renderer.
 */

export type AdvanceFn = (char: string, index: number) => number;

/** A constant per-character advance (monospace approximation). */
export function monospaceAdvance(width: number): AdvanceFn {
  return () => width;
}

/** The x offset (px) of the caret before character `index`. */
export function caretOffset(
  value: string,
  index: number,
  advance: AdvanceFn,
): number {
  const chars = [...value];
  const stop = Math.min(Math.max(index, 0), chars.length);
  let x = 0;
  for (let i = 0; i < stop; i += 1) {
    x += advance(chars[i]!, i);
  }
  return x;
}

export interface CaretGeometry {
  readonly x: number;
  readonly height: number;
}

/** Caret geometry (x offset + height) for a caret index. */
export function caretGeometry(
  value: string,
  index: number,
  options: { readonly advance: AdvanceFn; readonly fontSize: number },
): CaretGeometry {
  return {
    x: caretOffset(value, index, options.advance),
    height: options.fontSize,
  };
}

export interface SelectionRect {
  readonly x: number;
  readonly width: number;
  readonly height: number;
}

/** A single-line selection highlight rect for `[start, end)`. */
export function selectionRect(
  value: string,
  start: number,
  end: number,
  options: { readonly advance: AdvanceFn; readonly fontSize: number },
): SelectionRect | null {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (lo === hi) {
    return null;
  }
  const x = caretOffset(value, lo, options.advance);
  const right = caretOffset(value, hi, options.advance);
  return { x, width: right - x, height: options.fontSize };
}
