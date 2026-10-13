import { type RenderSnapshot, type RenderSortKey } from "@aperture-engine/render";
import { type MaybePromise } from "@aperture-engine/simulation";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
export type WebGpuFeatureCommandPhase = "opaque" | "alpha-test" | "transparent" | "overlay";
export interface WebGpuFeatureCommandGroup {
    readonly featureId: string;
    readonly phase: WebGpuFeatureCommandPhase;
    readonly sortKey?: RenderSortKey;
    readonly ordinal: number;
    readonly commands: readonly RenderPassCommand[];
}
export interface WebGpuFeatureCommandGroupDiagnostic {
    readonly code: "webGpuFeatureCommandGroup.missingSortKey";
    readonly featureId: string;
    readonly phase: WebGpuFeatureCommandPhase;
    readonly message: string;
}
export interface WebGpuFeatureFrameResult<TReport = unknown> {
    readonly valid: boolean;
    readonly commandGroups: readonly WebGpuFeatureCommandGroup[];
    readonly diagnostics?: readonly unknown[];
    readonly report?: TReport;
}
export interface WebGpuFeatureRealizer<TInput = unknown, TReport = unknown> {
    readonly id: string;
    readonly packetFamilies: readonly string[];
    prepareFrame(input: TInput): MaybePromise<WebGpuFeatureFrameResult<TReport>>;
    dispose?(): MaybePromise<void>;
}
export interface WebGpuFeatureRegistryFrameResult {
    /** Logical AND of every realizer's declared `valid` flag — and nothing else. */
    readonly valid: boolean;
    /**
     * Non-empty opaque/alpha-test/transparent groups in realizer order, sort
     * keys preserved. Interleave them with scene commands through
     * `mergeSnapshotSortedRenderPassCommands`.
     */
    readonly sceneGroups: readonly WebGpuFeatureCommandGroup[];
    /** Overlay-phase commands flattened in ascending group-ordinal order. */
    readonly overlayCommands: readonly RenderPassCommand[];
    /** Per-feature frame reports keyed by realizer id. */
    readonly reports: ReadonlyMap<string, unknown>;
    /** Realizer-reported diagnostics. Advisory: never gates frame submission. */
    readonly diagnostics: readonly unknown[];
}
export interface WebGpuFeatureRealizerRegistry<TInput = unknown> {
    register(realizer: WebGpuFeatureRealizer<TInput>): () => Promise<void>;
    list(): readonly WebGpuFeatureRealizer<TInput>[];
    prepareFrame(input: TInput): Promise<WebGpuFeatureRegistryFrameResult>;
    dispose(): Promise<void>;
}
export declare function createWebGpuFeatureRealizerRegistry<TInput = unknown>(): WebGpuFeatureRealizerRegistry<TInput>;
export declare function createWebGpuFeatureCommandGroupsFromCommands(options: {
    readonly featureId: string;
    readonly phase: WebGpuFeatureCommandPhase;
    readonly commands: readonly RenderPassCommand[];
    readonly startingOrdinal?: number;
    /** Explicit render-sort-key lookup by renderId. */
    readonly sortKeys?: ReadonlyMap<number, RenderSortKey>;
    /** Snapshot to derive the sort-key lookup from when `sortKeys` is omitted. */
    readonly snapshot?: RenderSnapshot;
}): readonly WebGpuFeatureCommandGroup[];
export declare function validateWebGpuFeatureCommandGroups(groups: readonly WebGpuFeatureCommandGroup[]): readonly WebGpuFeatureCommandGroupDiagnostic[];
export declare function orderWebGpuFeatureCommandGroups(groups: readonly WebGpuFeatureCommandGroup[]): readonly WebGpuFeatureCommandGroup[];
export interface MergedSnapshotSortedRenderPassCommands {
    readonly commands: readonly RenderPassCommand[];
    /**
     * One diagnostic per scene-phase group whose render sort key could not be
     * resolved. Such a group degrades to the end of the merged sequence; groups
     * with keys keep exact snapshot-sorted interleaving.
     */
    readonly diagnostics: readonly WebGpuFeatureCommandGroupDiagnostic[];
}
export declare function mergeSnapshotSortedRenderPassCommands(options: {
    readonly snapshot: RenderSnapshot;
    readonly baseCommands: readonly RenderPassCommand[];
    readonly overlayCommands: readonly RenderPassCommand[];
    readonly featureGroups?: readonly WebGpuFeatureCommandGroup[];
}): MergedSnapshotSortedRenderPassCommands;
//# sourceMappingURL=feature-command-groups.d.ts.map