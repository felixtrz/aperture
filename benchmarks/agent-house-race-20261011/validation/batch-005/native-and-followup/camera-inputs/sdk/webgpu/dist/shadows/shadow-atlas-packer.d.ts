import type { ShadowAtlasRegion } from "./shadow-map-descriptor.js";
/**
 * A single shadow's atlas request: a square footprint of `mapSize` texels with
 * an optional `priority` (higher packs first; ties broken by larger mapSize then
 * lower shadowId for determinism).
 */
export interface ShadowAtlasRequest {
    readonly shadowId: number;
    readonly mapSize: number;
    readonly priority?: number;
}
export interface ShadowAtlasAssignment {
    readonly shadowId: number;
    readonly region: ShadowAtlasRegion;
}
export interface ShadowAtlasPackResult {
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    /** Assignments in deterministic pack order. */
    readonly assignments: readonly ShadowAtlasAssignment[];
    /** Shadow ids that did not fit the atlas budget (dropped deterministically). */
    readonly dropped: readonly number[];
}
export interface ShadowAtlasPackInput {
    readonly requests: readonly ShadowAtlasRequest[];
    readonly atlasWidth: number;
    readonly atlasHeight: number;
}
/**
 * Deterministic shelf packer for a budgeted shadow atlas: sorts requests by
 * priority desc, mapSize desc, shadowId asc, then places each square footprint
 * left-to-right onto horizontal shelves, opening a new shelf when the current
 * row is full. Requests that do not fit the atlas budget are dropped (reported
 * in `dropped`) rather than overlapping an existing region. Pure/headless — no
 * GPU. Every assigned region is in-bounds and non-overlapping by construction.
 */
export declare function packShadowAtlas(input: ShadowAtlasPackInput): ShadowAtlasPackResult;
//# sourceMappingURL=shadow-atlas-packer.d.ts.map