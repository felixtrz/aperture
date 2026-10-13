/**
 * Single-line caret + selection geometry from a text value. `advance` returns
 * the horizontal advance (px) of a character; supply a real per-glyph advance
 * from the MSDF atlas, or use a fixed monospace width. Keeps the geometry pure
 * and testable, independent of the renderer.
 */
export type AdvanceFn = (char: string, index: number) => number;
/** A constant per-character advance (monospace approximation). */
export declare function monospaceAdvance(width: number): AdvanceFn;
/** The x offset (px) of the caret before character `index`. */
export declare function caretOffset(value: string, index: number, advance: AdvanceFn): number;
export interface CaretGeometry {
    readonly x: number;
    readonly height: number;
}
/** Caret geometry (x offset + height) for a caret index. */
export declare function caretGeometry(value: string, index: number, options: {
    readonly advance: AdvanceFn;
    readonly fontSize: number;
}): CaretGeometry;
export interface SelectionRect {
    readonly x: number;
    readonly width: number;
    readonly height: number;
}
/** A single-line selection highlight rect for `[start, end)`. */
export declare function selectionRect(value: string, start: number, end: number, options: {
    readonly advance: AdvanceFn;
    readonly fontSize: number;
}): SelectionRect | null;
//# sourceMappingURL=caret.d.ts.map