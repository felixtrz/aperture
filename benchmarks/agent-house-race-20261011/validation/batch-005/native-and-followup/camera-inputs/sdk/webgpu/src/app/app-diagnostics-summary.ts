import type {
  MaterialAssetDependencyReadinessReportJsonValue,
  MaterialQueuePhaseSummary,
  RenderQueueSortPhaseReport,
} from "@aperture-engine/render";
import type { QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue } from "../materials/core/built-in-material-app-resource-adapter.js";
import type { DirectLightReadinessReport } from "../lighting/direct-light-readiness.js";
import type { GpuPassTimingReport } from "../gpu/gpu-timing.js";
import type { WebGpuAppMaterialQueueRouteReportJsonValue } from "../materials/core/material-queue-route-report.js";
import type { QueuedMaterialFrameResourceSetSummary } from "../render/queues/queued-material-frame-resource-set-summary.js";
import type { RenderFrameQueueDiagnosticsSummary } from "../render/frame/render-frame-plan.js";

export interface WebGpuAppDiagnosticsSummaryInput {
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
  readonly renderQueueSortPhases?: readonly RenderQueueSortPhaseReport[];
  readonly gpuTimings?: GpuPassTimingReport;
  readonly directLighting?: DirectLightReadinessReport;
}

export interface WebGpuAppDiagnosticsSummary {
  readonly sectionCount: number;
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly materialQueueRoute?: WebGpuAppMaterialQueueRouteReportJsonValue;
  readonly routedResourceSet?: QueuedMaterialFrameResourceSetSummary;
  readonly builtInAppResourceAdapters?: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
  readonly renderQueueSortPhases?: readonly RenderQueueSortPhaseReport[];
  readonly gpuTimings?: GpuPassTimingReport;
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

  if (input.renderQueueSortPhases !== undefined) {
    summary.sectionCount += 1;
    summary.renderQueueSortPhases = input.renderQueueSortPhases;
  }

  if (input.gpuTimings !== undefined) {
    summary.sectionCount += 1;
    summary.gpuTimings = input.gpuTimings;
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

export function collectWebGpuAppMaterialDependencyReadiness(
  diagnostics: readonly unknown[],
): MaterialAssetDependencyReadinessReportJsonValue[] {
  const readiness: MaterialAssetDependencyReadinessReportJsonValue[] = [];

  for (const diagnostic of diagnostics) {
    if (
      typeof diagnostic !== "object" ||
      diagnostic === null ||
      (diagnostic as { readonly code?: unknown }).code !==
        "webGpuApp.materialDependenciesNotReady"
    ) {
      continue;
    }

    const candidate = diagnostic as {
      readonly materialDependencyReadiness?: unknown;
    };

    if (
      typeof candidate.materialDependencyReadiness === "object" &&
      candidate.materialDependencyReadiness !== null
    ) {
      readiness.push(
        candidate.materialDependencyReadiness as MaterialAssetDependencyReadinessReportJsonValue,
      );
    }
  }

  return readiness;
}

type MutableWebGpuAppDiagnosticsSummary = {
  -readonly [Key in keyof WebGpuAppDiagnosticsSummary]: WebGpuAppDiagnosticsSummary[Key];
};
