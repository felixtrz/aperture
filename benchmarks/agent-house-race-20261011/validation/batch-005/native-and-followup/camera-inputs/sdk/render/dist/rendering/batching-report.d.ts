import type { BatchCompatibilityKey } from "./snapshot.js";
import type { RenderWorldDrawPackage } from "./draw-package.js";
export interface DrawPackageBatchGroup {
    readonly key: string;
    readonly batchKey: BatchCompatibilityKey;
    readonly drawCount: number;
    readonly renderIds: readonly number[];
    readonly meshResourceKeys: readonly string[];
    readonly materialResourceKeys: readonly string[];
}
export interface DrawPackageBatchingDiagnostic {
    readonly code: "drawBatching.emptyPackages";
    readonly message: string;
    readonly severity: "info";
}
export interface DrawPackageBatchingReport {
    readonly drawCount: number;
    readonly batchCount: number;
    readonly groups: readonly DrawPackageBatchGroup[];
    readonly diagnostics: readonly DrawPackageBatchingDiagnostic[];
}
export interface MergedDrawPackageBatchingReport {
    readonly reportCount: number;
    readonly drawCount: number;
    readonly batchCount: number;
    readonly diagnostics: readonly DrawPackageBatchingDiagnostic[];
}
export declare function createDrawPackageBatchingReport(packages: readonly RenderWorldDrawPackage[]): DrawPackageBatchingReport;
export declare function mergeDrawPackageBatchingReports(reports: readonly DrawPackageBatchingReport[]): MergedDrawPackageBatchingReport;
//# sourceMappingURL=batching-report.d.ts.map