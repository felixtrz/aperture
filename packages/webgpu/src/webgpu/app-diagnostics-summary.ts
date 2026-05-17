import type { MaterialQueuePhaseSummary } from "@aperture-engine/render";
import type { QueuedBuiltInResourceSetSummary } from "./queued-built-in-resource-set-summary.js";
import type { RenderFrameQueueDiagnosticsSummary } from "./render-frame-plan.js";

export interface WebGpuAppDiagnosticsSummaryInput {
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly routedResourceSet?: QueuedBuiltInResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
}

export interface WebGpuAppDiagnosticsSummary {
  readonly sectionCount: number;
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly routedResourceSet?: QueuedBuiltInResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
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

  if (input.routedResourceSet !== undefined) {
    summary.sectionCount += 1;
    summary.routedResourceSet = input.routedResourceSet;
  }

  if (input.renderFrameQueue !== undefined) {
    summary.sectionCount += 1;
    summary.renderFrameQueue = input.renderFrameQueue;
  }

  return summary;
}

type MutableWebGpuAppDiagnosticsSummary = {
  -readonly [Key in keyof WebGpuAppDiagnosticsSummary]: WebGpuAppDiagnosticsSummary[Key];
};
