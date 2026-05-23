import type { DiagnosticSummary } from "@aperture-engine/simulation";
import type { FrameBoundaryAssemblyReport } from "./frame-boundary.js";
import type {
  RenderBundleDiagnostic,
  RenderBundleExecutionStatus,
} from "./render-bundle.js";
import { summarizeFrameBoundaryDiagnostics } from "./frame-boundary-diagnostics.js";

export interface FrameBoundaryRenderBundleReportJsonValue {
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

export function frameBoundaryReportToJsonValue(
  report: FrameBoundaryAssemblyReport,
): FrameBoundaryReportJsonValue {
  return {
    valid: report.valid,
    sections: {
      texture: report.texture.valid,
      attachments: report.attachments?.valid ?? null,
      encoder: report.encoder?.valid ?? null,
      begin: report.begin?.valid ?? null,
      execution: report.execution?.valid ?? null,
      renderBundle: report.renderBundle?.valid ?? null,
      end: report.end?.valid ?? null,
      finish: report.finish?.valid ?? null,
      submit: report.submit?.valid ?? null,
    },
    counts: {
      colorTargets: report.attachments?.plan?.colorAttachments.length ?? 0,
      commands: report.execution?.commandCount ?? 0,
      executedCommands: report.execution?.executedCommands ?? 0,
      skippedCommands: report.execution?.skippedCommands ?? 0,
      drawCalls: report.execution?.drawCalls ?? 0,
      renderBundleEncodedCommands: report.renderBundle?.encodedCommands ?? 0,
      executedRenderBundles: report.renderBundle?.executedBundles ?? 0,
      submittedCommandBuffers: report.submit?.submitted ?? 0,
    },
    renderBundle:
      report.renderBundle === undefined || report.renderBundle === null
        ? null
        : {
            valid: report.renderBundle.valid,
            status: report.renderBundle.status,
            key: report.renderBundle.key,
            commandCount: report.renderBundle.commandCount,
            encodedCommands: report.renderBundle.encodedCommands,
            executedBundles: report.renderBundle.executedBundles,
            drawCalls: report.renderBundle.drawCalls,
            indexedDrawCalls: report.renderBundle.indexedDrawCalls,
            nonIndexedDrawCalls: report.renderBundle.nonIndexedDrawCalls,
            cacheSize: report.renderBundle.cacheSize,
            diagnostics: report.renderBundle.diagnostics,
          },
    diagnostics: summarizeFrameBoundaryDiagnostics(report).diagnostics,
  };
}

export function frameBoundaryReportToJson(
  report: FrameBoundaryAssemblyReport,
): string {
  return JSON.stringify(frameBoundaryReportToJsonValue(report));
}
