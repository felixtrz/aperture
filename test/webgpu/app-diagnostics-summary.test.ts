import { describe, expect, it } from "vitest";

import type { MaterialQueuePhaseSummary } from "@aperture-engine/render";
import {
  createWebGpuAppDiagnosticsSummary,
  type QueuedBuiltInResourceSetSummary,
  type RenderFrameQueueDiagnosticsSummary,
} from "@aperture-engine/webgpu";

describe("WebGPU app diagnostics summary", () => {
  it("summarizes empty diagnostic groups", () => {
    expect(createWebGpuAppDiagnosticsSummary({})).toEqual({
      sectionCount: 0,
    });
  });

  it("summarizes partial diagnostic groups", () => {
    const materialQueue = materialQueueSummary();

    expect(createWebGpuAppDiagnosticsSummary({ materialQueue })).toEqual({
      sectionCount: 1,
      materialQueue,
    });
  });

  it("summarizes full diagnostic groups without exposing app payloads", () => {
    const materialQueue = materialQueueSummary();
    const routedResourceSet = routedResourceSetSummary();
    const renderFrameQueue = renderFrameQueueSummary();
    const summary = createWebGpuAppDiagnosticsSummary({
      materialQueue,
      routedResourceSet,
      renderFrameQueue,
    });

    expect(summary).toEqual({
      sectionCount: 3,
      materialQueue,
      routedResourceSet,
      renderFrameQueue,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("meshDraws");
    expect(serialized).not.toContain("sourceMesh");
    expect(serialized).not.toContain("gpu-buffer-handle");
    expect(serialized).not.toContain("bindGroup");
  });
});

function materialQueueSummary(): MaterialQueuePhaseSummary {
  return {
    itemCount: 2,
    byPhase: [{ phase: "opaque", itemCount: 2 }],
    byFamily: [{ family: "standard", itemCount: 2 }],
    byPhaseAndFamily: [{ phase: "opaque", family: "standard", itemCount: 2 }],
  };
}

function routedResourceSetSummary(): QueuedBuiltInResourceSetSummary {
  return {
    itemCount: 2,
    byFamily: [{ family: "standard", itemCount: 2 }],
    byPipeline: [
      { pipelineKey: "standard|alpha:opaque|textures:none", itemCount: 2 },
    ],
    byFamilyAndPipeline: [
      {
        family: "standard",
        pipelineKey: "standard|alpha:opaque|textures:none",
        itemCount: 2,
      },
    ],
  };
}

function renderFrameQueueSummary(): RenderFrameQueueDiagnosticsSummary {
  return {
    ready: true,
    readyDrawCount: 2,
    blockedDrawCount: 0,
    packageCount: 2,
    packagePoolSize: 2,
    packageSlotsReused: 2,
    packageSlotsCreated: 0,
    missingPackedTransformCount: 0,
    diagnostics: {
      total: 0,
      byCode: {},
    },
  };
}
