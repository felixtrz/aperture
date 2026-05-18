import type { MaterialQueuePhaseSummary } from "@aperture-engine/render";
import type { DirectLightReadinessReport } from "./direct-light-readiness.js";
import type { WebGpuAppMaterialQueueRouteReportJsonValue } from "./material-queue-route-report.js";
import type { QueuedMaterialFrameResourceSetSummary } from "./queued-material-frame-resource-set-summary.js";
import type { RenderFrameQueueDiagnosticsSummary } from "./render-frame-plan.js";

export interface WebGpuAppDiagnosticsSummaryInput {
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
  readonly directLighting?: DirectLightReadinessReport;
}

export interface WebGpuAppDiagnosticsSummary {
  readonly sectionCount: number;
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
  readonly directLighting?: DirectLightReadinessReport;
}

export function createWebGpuAppDiagnosticsSummary(
  input: WebGpuAppDiagnosticsSummaryInput,
): WebGpuAppDiagnosticsSummary {
  const summary: MutableWebGpuAppDiagnosticsSummary = {
    sectionCount: 0,
  };

  if (input.materialQueue !== undefined) {
    summary.sectionCount += 1;
    summary.materialQueue = input.materialQueue;
  }

  if (input.materialQueueRoute !== undefined) {
    summary.sectionCount += 1;
    summary.materialQueueRoute = input.materialQueueRoute;
  }

  if (input.routedResourceSet !== undefined) {
    summary.sectionCount += 1;
    summary.routedResourceSet = input.routedResourceSet;
  }

  if (input.renderFrameQueue !== undefined) {
    summary.sectionCount += 1;
    summary.renderFrameQueue = input.renderFrameQueue;
  }

  if (input.directLighting !== undefined) {
    summary.sectionCount += 1;
    summary.directLighting = input.directLighting;
  }

  return summary;
}

type MutableWebGpuAppDiagnosticsSummary = {
  -readonly [Key in keyof WebGpuAppDiagnosticsSummary]: WebGpuAppDiagnosticsSummary[Key];
};
