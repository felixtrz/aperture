import { type RenderPassCommandExecutionReport, type RenderPassEncoderLike } from "../passes/render-pass-command-executor.js";
import type { RenderPassCommand } from "../passes/render-pass-commands.js";
export type RenderBundleExecutionStatus = "disabled" | "unsupported" | "created" | "reused" | "failed";
export type RenderBundleDiagnosticCode = "renderBundle.createEncoderFailed" | "renderBundle.missingFinish" | "renderBundle.finishFailed" | "renderBundle.executeBundlesFailed";
export interface RenderBundleDiagnostic {
    readonly code: RenderBundleDiagnosticCode;
    readonly message: string;
}
export interface RenderBundleEncoderDescriptorLike {
    readonly label?: string;
    readonly colorFormats: readonly string[];
    readonly depthStencilFormat?: string;
    readonly sampleCount?: number;
}
export interface RenderBundleDeviceLike {
    createRenderBundleEncoder?: (descriptor: RenderBundleEncoderDescriptorLike) => RenderBundleEncoderLike;
}
export interface RenderBundleEncoderLike extends RenderPassEncoderLike {
    finish?: () => unknown;
}
export interface RenderBundleRenderPassLike extends RenderPassEncoderLike {
    executeBundles?: (bundles: readonly unknown[]) => void;
}
export interface RenderBundleCacheEntry {
    readonly key: string;
    readonly bundle: unknown;
    readonly commandCount: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly nonIndexedDrawCalls: number;
}
export interface RenderBundleCache {
    readonly entries: Map<string, RenderBundleCacheEntry>;
    readonly objectIds: WeakMap<object, number>;
    nextObjectId: number;
}
export interface RenderBundleCommandKeyOptions {
    readonly targetKey: string;
    readonly colorFormats: readonly string[];
    readonly depthStencilFormat?: string | null;
    readonly sampleCount?: number;
    readonly commands: readonly RenderPassCommand[];
}
export interface RenderBundleExecutionReport {
    readonly valid: boolean;
    readonly status: RenderBundleExecutionStatus;
    readonly key: string | null;
    readonly commandCount: number;
    readonly encodedCommands: number;
    readonly executedBundles: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly nonIndexedDrawCalls: number;
    readonly cacheSize: number;
    readonly diagnostics: readonly RenderBundleDiagnostic[];
}
export interface RenderBundleKeySummary {
    readonly key: string | null;
    readonly keyHash: string | null;
    readonly keyLength: number | null;
}
export interface ExecuteRenderPassCommandsWithRenderBundleOptions {
    readonly pass: RenderBundleRenderPassLike;
    readonly device: RenderBundleDeviceLike;
    readonly commands: readonly RenderPassCommand[];
    readonly bundledCommandCount?: number;
    readonly cache: RenderBundleCache;
    readonly key: string;
    readonly descriptor: RenderBundleEncoderDescriptorLike;
    readonly label?: string;
    readonly enabled?: boolean;
}
export interface RenderBundleCommandExecutionResult {
    readonly execution: RenderPassCommandExecutionReport;
    readonly renderBundle: RenderBundleExecutionReport;
}
export declare function createRenderBundleCache(): RenderBundleCache;
export declare function createRenderBundleCommandKey(options: RenderBundleCommandKeyOptions, cache: RenderBundleCache): string;
export declare function summarizeRenderBundleKey(key: string | null): RenderBundleKeySummary;
export declare function executeRenderPassCommandsWithRenderBundle(options: ExecuteRenderPassCommandsWithRenderBundleOptions): RenderBundleCommandExecutionResult;
//# sourceMappingURL=render-bundle.d.ts.map