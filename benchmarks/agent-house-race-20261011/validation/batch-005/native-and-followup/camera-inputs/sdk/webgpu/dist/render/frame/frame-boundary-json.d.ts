import type { DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";
import type { RenderBundleDiagnostic, RenderBundleExecutionStatus } from "../draw/render-bundle.js";
export interface FrameBoundaryRenderBundleReportJsonValue {
    readonly valid: boolean;
    readonly status: RenderBundleExecutionStatus;
    readonly key: string | null;
    readonly keyHash: string | null;
    readonly keyLength: number | null;
    readonly commandCount: number;
    readonly encodedCommands: number;
    readonly executedBundles: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly nonIndexedDrawCalls: number;
    readonly cacheSize: number;
    readonly diagnostics: readonly RenderBundleDiagnostic[];
}
export interface FrameBoundaryReportJsonValue {
    readonly valid: boolean;
    readonly sections: {
        readonly texture: boolean;
        readonly attachments: boolean | null;
        readonly encoder: boolean | null;
        readonly begin: boolean | null;
        readonly execution: boolean | null;
        readonly renderBundle: boolean | null;
        readonly end: boolean | null;
        readonly finish: boolean | null;
        readonly submit: boolean | null;
    };
    readonly counts: {
        readonly colorTargets: number;
        readonly commands: number;
        readonly executedCommands: number;
        readonly skippedCommands: number;
        readonly drawCalls: number;
        readonly renderBundleEncodedCommands: number;
        readonly executedRenderBundles: number;
        readonly submittedCommandBuffers: number;
    };
    readonly renderBundle: FrameBoundaryRenderBundleReportJsonValue | null;
    readonly diagnostics: DiagnosticSummary;
}
export declare function frameBoundaryReportToJsonValue(report: FrameBoundaryAssemblyReport): FrameBoundaryReportJsonValue;
export declare function frameBoundaryReportToJson(report: FrameBoundaryAssemblyReport): string;
//# sourceMappingURL=frame-boundary-json.d.ts.map