export interface WebGpuAppMaterialQueueRouteEntityRef {
    readonly index: number;
    readonly generation: number;
}
export interface WebGpuAppMaterialQueueRouteQueueItem {
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily: string;
    readonly renderPhase: string;
    readonly entity?: WebGpuAppMaterialQueueRouteEntityRef;
}
export interface WebGpuAppMaterialQueueRouteRoutedItem {
    readonly renderId: number;
    readonly drawIndex: number;
    readonly materialFamily: string;
    readonly renderPhase: string;
}
export type WebGpuAppMaterialQueueRouteDiagnosticSeverity = "info" | "warning" | "error";
export interface WebGpuAppMaterialQueueRouteDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly severity?: WebGpuAppMaterialQueueRouteDiagnosticSeverity;
    readonly renderId?: number;
    readonly drawIndex?: number;
    readonly materialFamily?: string;
    readonly materialKind?: string;
    readonly renderPhase?: string;
    readonly blendPreset?: string | null;
    readonly entity?: WebGpuAppMaterialQueueRouteEntityRef;
}
export interface WebGpuAppMaterialQueueRouteBucketSummary {
    readonly key: string;
    readonly queuedCount: number;
    readonly routedCount: number;
    readonly skippedCount: number;
}
export interface WebGpuAppMaterialQueueRouteDiagnosticSummary {
    readonly total: number;
    readonly bySeverity: Record<WebGpuAppMaterialQueueRouteDiagnosticSeverity, number>;
    readonly byCode: Record<string, number>;
}
export interface WebGpuAppMaterialQueueRouteMutableBucketSummary {
    key: string;
    queuedCount: number;
    routedCount: number;
    skippedCount: number;
}
export interface WebGpuAppMaterialQueueRouteMutableDiagnosticSummary {
    total: number;
    readonly bySeverity: Record<WebGpuAppMaterialQueueRouteDiagnosticSeverity, number>;
    readonly byCode: Record<string, number>;
}
export interface WebGpuAppMaterialQueueRouteReportShell {
    valid: boolean;
    queueItemCount: number;
    routedItemCount: number;
    skippedItemCount: number;
    readonly byFamily: Map<string, WebGpuAppMaterialQueueRouteMutableBucketSummary>;
    readonly byPhase: Map<string, WebGpuAppMaterialQueueRouteMutableBucketSummary>;
    readonly diagnosticSummary: WebGpuAppMaterialQueueRouteMutableDiagnosticSummary;
    readonly diagnostics: WebGpuAppMaterialQueueRouteDiagnostic[];
    readonly routedKeys: Set<string>;
}
export interface WebGpuAppMaterialQueueRouteReport {
    readonly valid: boolean;
    readonly queueItemCount: number;
    readonly routedItemCount: number;
    readonly skippedItemCount: number;
    readonly byFamily: readonly WebGpuAppMaterialQueueRouteBucketSummary[];
    readonly byPhase: readonly WebGpuAppMaterialQueueRouteBucketSummary[];
    readonly diagnosticSummary: WebGpuAppMaterialQueueRouteDiagnosticSummary;
    readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}
export type WebGpuAppMaterialQueueRouteReportJsonValue = WebGpuAppMaterialQueueRouteReport;
export interface WebGpuAppMaterialQueueRouteReportOptions {
    readonly queueItems: readonly WebGpuAppMaterialQueueRouteQueueItem[];
    readonly routedItems: readonly WebGpuAppMaterialQueueRouteRoutedItem[];
    readonly diagnostics?: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}
export declare function createWebGpuAppMaterialQueueRouteReport(options: WebGpuAppMaterialQueueRouteReportOptions): WebGpuAppMaterialQueueRouteReport;
export declare function createWebGpuAppMaterialQueueRouteReportShell(): WebGpuAppMaterialQueueRouteReportShell;
export declare function resetWebGpuAppMaterialQueueRouteReportShell(shell: WebGpuAppMaterialQueueRouteReportShell): WebGpuAppMaterialQueueRouteReportShell;
export declare function writeWebGpuAppMaterialQueueRouteReportShell(options: WebGpuAppMaterialQueueRouteReportOptions, shell: WebGpuAppMaterialQueueRouteReportShell): WebGpuAppMaterialQueueRouteReportShell;
export declare function webGpuAppMaterialQueueRouteReportShellToReport(shell: WebGpuAppMaterialQueueRouteReportShell): WebGpuAppMaterialQueueRouteReport;
export declare function webGpuAppMaterialQueueRouteReportToJsonValue(report: WebGpuAppMaterialQueueRouteReport): WebGpuAppMaterialQueueRouteReportJsonValue;
export declare function webGpuAppMaterialQueueRouteReportShellToJsonValue(shell: WebGpuAppMaterialQueueRouteReportShell): WebGpuAppMaterialQueueRouteReportJsonValue;
export declare function webGpuAppMaterialQueueRouteReportToJson(report: WebGpuAppMaterialQueueRouteReport): string;
export declare function unknownToWebGpuAppMaterialQueueRouteDiagnostics(diagnostic: unknown): WebGpuAppMaterialQueueRouteDiagnostic[];
//# sourceMappingURL=material-queue-route-report.d.ts.map