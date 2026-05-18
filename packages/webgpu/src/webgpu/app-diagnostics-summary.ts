import type { MaterialQueuePhaseSummary } from "@aperture-engine/render";
import type { QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue } from "./built-in-material-app-resource-adapter.js";
import type { DirectLightReadinessReport } from "./direct-light-readiness.js";
import type { WebGpuAppMaterialQueueRouteReportJsonValue } from "./material-queue-route-report.js";
import type { QueuedMaterialFrameResourceSetSummary } from "./queued-material-frame-resource-set-summary.js";
import type { RenderFrameQueueDiagnosticsSummary } from "./render-frame-plan.js";

export interface WebGpuAppDiagnosticsSummaryInput {
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
  readonly directLighting?: DirectLightReadinessReport;
}

export interface WebGpuAppDiagnosticsSummary {
  readonly sectionCount: number;
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
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

  if (input.builtInAppResourceAdapters !== undefined) {
    summary.sectionCount += 1;
    summary.builtInAppResourceAdapters = input.builtInAppResourceAdapters;
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

export function collectWebGpuAppMaterialQueueRouteReport(
  diagnostics: readonly unknown[],
): WebGpuAppMaterialQueueRouteReportJsonValue | null {
  for (const diagnostic of diagnostics) {
    if (typeof diagnostic !== "object" || diagnostic === null) {
      continue;
    }

    const candidate = diagnostic as {
      readonly code?: unknown;
      readonly report?: unknown;
    };

    if (
      candidate.code === "webGpuApp.materialQueueRouteReport" &&
      typeof candidate.report === "object" &&
      candidate.report !== null
    ) {
      return candidate.report as WebGpuAppMaterialQueueRouteReportJsonValue;
    }
  }

  return null;
}

type MutableWebGpuAppDiagnosticsSummary = {
  -readonly [Key in keyof WebGpuAppDiagnosticsSummary]: WebGpuAppDiagnosticsSummary[Key];
};
