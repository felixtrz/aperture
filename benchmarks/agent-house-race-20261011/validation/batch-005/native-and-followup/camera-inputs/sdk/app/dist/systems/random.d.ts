export interface ApertureRandom {
    /** The seed this stream was created from. */
    readonly seed: number;
    /** Export implementation state for deterministic restore. */
    snapshot?(): ApertureRandomState;
    /** Restore implementation state captured by `snapshot()`. */
    restore?(state: ApertureRandomState): void;
    /** Next float in [0, 1). */
    next(): number;
    /** Next integer in [0, maxExclusive). */
    int(maxExclusive: number): number;
    /** Next float in [min, max). */
    range(min: number, max: number): number;
    /** A deterministic independent sub-stream derived from a label. */
    fork(label: string): ApertureRandom;
}
export interface ApertureRandomState {
    readonly seed: number;
    readonly state: number;
}
export declare function createApertureRandom(seedOrState?: number | ApertureRandomState): ApertureRandom;
export declare function snapshotApertureRandom(random: ApertureRandom): ApertureRandomState | null;
export declare function restoreApertureRandom(random: ApertureRandom, state: ApertureRandomState): boolean;
//# sourceMappingURL=random.d.ts.map