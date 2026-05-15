import {
  summarizeDiagnostics,
  type DiagnosticSummary,
} from "../diagnostics/index.js";
import type { DrawPackageBatchingReport } from "../rendering/index.js";
import type { FrameAssemblyReadinessReport } from "./frame-readiness.js";
import type { RenderResourceSummaryReport } from "./resource-summary.js";

export interface FrameReportInput {
  readonly frame: number;
  readonly readiness: FrameAssemblyReadinessReport;
  readonly resources: RenderResourceSummaryReport;
  readonly batching: DrawPackageBatchingReport;
}

export interface FrameReport {
  readonly frame: number;
  readonly ready: boolean;
  readonly draws: number;
  readonly batches: number;
  readonly resources: RenderResourceSummaryReport["counts"];
  readonly diagnostics: DiagnosticSummary;
}

export interface FrameReportJsonValue {
  readonly frame: number;
  readonly ready: boolean;
  readonly draws: number;
  readonly batches: number;
  readonly resources: FrameReport["resources"];
  readonly diagnostics: DiagnosticSummary;
}

export function createFrameReport(input: FrameReportInput): FrameReport {
  return {
    frame: input.frame,
    ready: input.readiness.ready,
    draws: input.batching.drawCount,
    batches: input.batching.batchCount,
    resources: input.resources.counts,
    diagnostics: summarizeDiagnostics([
      ...input.readiness.diagnostics,
      ...input.resources.diagnostics,
      ...input.batching.diagnostics,
    ]),
  };
}

export function frameReportToJsonValue(
  report: FrameReport,
): FrameReportJsonValue {
  return {
    frame: report.frame,
    ready: report.ready,
    draws: report.draws,
    batches: report.batches,
    resources: report.resources,
    diagnostics: report.diagnostics,
  };
}

export function frameReportToJson(report: FrameReport): string {
  return JSON.stringify(frameReportToJsonValue(report));
}
