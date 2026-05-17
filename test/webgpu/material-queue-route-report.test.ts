import { describe, expect, it } from "vitest";

import { createWebGpuAppMaterialQueueRouteReport } from "@aperture-engine/webgpu";

describe("WebGPU app material queue route report", () => {
  it("reports all-routed queue items by material family and render phase", () => {
    const queueItems = [
      queueItem(10, 0, "unlit", "opaque"),
      queueItem(11, 1, "standard", "alpha-test"),
      queueItem(12, 2, "standard", "transparent"),
    ];
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems,
      routedItems: queueItems,
    });

    expect(report).toEqual({
      valid: true,
      queueItemCount: 3,
      routedItemCount: 3,
      skippedItemCount: 0,
      byFamily: [
        { key: "unlit", queuedCount: 1, routedCount: 1, skippedCount: 0 },
        { key: "standard", queuedCount: 2, routedCount: 2, skippedCount: 0 },
      ],
      byPhase: [
        { key: "opaque", queuedCount: 1, routedCount: 1, skippedCount: 0 },
        { key: "alpha-test", queuedCount: 1, routedCount: 1, skippedCount: 0 },
        { key: "transparent", queuedCount: 1, routedCount: 1, skippedCount: 0 },
      ],
      diagnosticSummary: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
      diagnostics: [],
    });
  });

  it("reports skipped queue items and preserves route diagnostics", () => {
    const queueItems = [
      queueItem(20, 0, "unlit", "opaque"),
      queueItem(21, 1, "debug-normal", "opaque"),
      queueItem(22, 2, "standard", "transparent"),
    ];
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems,
      routedItems: [queueItems[0] ?? queueItem(20, 0, "unlit", "opaque")],
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialQueueFamily",
          message:
            "WebGPU app material queue routing supports unlit, matcap, and standard materials, not 'debug-normal'.",
          renderId: 21,
          drawIndex: 1,
          materialFamily: "debug-normal",
          entity: { index: 7, generation: 1 },
        },
        {
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          message:
            "WebGPU app material queue routing supports StandardMaterial transparent draws with alpha blending, not blend preset 'additive'.",
          renderId: 22,
          drawIndex: 2,
          materialFamily: "standard",
          renderPhase: "transparent",
          blendPreset: "additive",
          entity: { index: 8, generation: 1 },
        },
      ],
    });

    expect(report.valid).toBe(false);
    expect(report.queueItemCount).toBe(3);
    expect(report.routedItemCount).toBe(1);
    expect(report.skippedItemCount).toBe(2);
    expect(report.byFamily).toEqual([
      { key: "unlit", queuedCount: 1, routedCount: 1, skippedCount: 0 },
      { key: "debug-normal", queuedCount: 1, routedCount: 0, skippedCount: 1 },
      { key: "standard", queuedCount: 1, routedCount: 0, skippedCount: 1 },
    ]);
    expect(report.byPhase).toEqual([
      { key: "opaque", queuedCount: 2, routedCount: 1, skippedCount: 1 },
      { key: "transparent", queuedCount: 1, routedCount: 0, skippedCount: 1 },
    ]);
    expect(report.diagnostics).toMatchObject([
      {
        code: "webGpuApp.unsupportedMaterialQueueFamily",
        renderId: 21,
        drawIndex: 1,
        materialFamily: "debug-normal",
      },
      {
        code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
        renderId: 22,
        drawIndex: 2,
        materialFamily: "standard",
        renderPhase: "transparent",
        blendPreset: "additive",
      },
    ]);
  });
});

function queueItem(
  renderId: number,
  drawIndex: number,
  materialFamily: string,
  renderPhase: string,
) {
  return {
    renderId,
    drawIndex,
    materialFamily,
    renderPhase,
    entity: { index: renderId, generation: 1 },
  };
}
