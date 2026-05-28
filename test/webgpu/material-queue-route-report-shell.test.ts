import { describe, expect, it } from "vitest";

import {
  createWebGpuAppMaterialQueueRouteReportShell,
  webGpuAppMaterialQueueRouteReportShellToJsonValue,
  writeWebGpuAppMaterialQueueRouteReportShell,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU app material queue route report shell", () => {
  it("reuses shell maps, diagnostics, and summary across writes", () => {
    const shell = createWebGpuAppMaterialQueueRouteReportShell();
    const byFamily = shell.byFamily;
    const byPhase = shell.byPhase;
    const diagnostics = shell.diagnostics;
    const summary = shell.diagnosticSummary;

    writeWebGpuAppMaterialQueueRouteReportShell(
      {
        queueItems: [
          queueItem(1, 0, "unlit", "opaque"),
          queueItem(2, 1, "standard", "transparent"),
        ],
        routedItems: [routedItem(1, 0, "unlit", "opaque")],
        diagnostics: [
          {
            code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
            message: "Unsupported blend.",
            materialFamily: "standard",
            renderPhase: "transparent",
          },
        ],
      },
      shell,
    );

    expect(shell.valid).toBe(false);
    expect(shell.queueItemCount).toBe(2);
    expect(shell.routedItemCount).toBe(1);
    expect(shell.skippedItemCount).toBe(1);
    expect(shell.byFamily.get("unlit")).toMatchObject({
      queuedCount: 1,
      routedCount: 1,
      skippedCount: 0,
    });
    expect(shell.byFamily.get("standard")).toMatchObject({
      queuedCount: 1,
      routedCount: 0,
      skippedCount: 1,
    });
    expect(shell.diagnosticSummary).toEqual({
      total: 1,
      bySeverity: { info: 0, warning: 0, error: 1 },
      byCode: {
        "webGpuApp.unsupportedMaterialQueueBlendPreset": 1,
      },
    });

    writeWebGpuAppMaterialQueueRouteReportShell(
      {
        queueItems: [queueItem(3, 0, "matcap", "opaque")],
        routedItems: [routedItem(3, 0, "matcap", "opaque")],
      },
      shell,
    );

    expect(shell.byFamily).toBe(byFamily);
    expect(shell.byPhase).toBe(byPhase);
    expect(shell.diagnostics).toBe(diagnostics);
    expect(shell.diagnosticSummary).toBe(summary);
    expect(shell.valid).toBe(true);
    expect(shell.queueItemCount).toBe(1);
    expect(shell.routedItemCount).toBe(1);
    expect(shell.skippedItemCount).toBe(0);
    expect(shell.byFamily.has("standard")).toBe(false);
    expect(shell.byFamily.get("matcap")).toMatchObject({
      queuedCount: 1,
      routedCount: 1,
      skippedCount: 0,
    });
    expect(shell.diagnostics).toEqual([]);
    expect(shell.diagnosticSummary).toEqual({
      total: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      byCode: {},
    });
  });

  it("projects shell state through the JSON route report shape", () => {
    const shell = createWebGpuAppMaterialQueueRouteReportShell();

    writeWebGpuAppMaterialQueueRouteReportShell(
      {
        queueItems: [queueItem(4, 0, "standard", "transparent")],
        routedItems: [],
        diagnostics: [
          {
            code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
            message: "Null blend preset.",
            severity: "warning",
            materialFamily: "standard",
            renderPhase: "transparent",
            blendPreset: null,
          },
        ],
      },
      shell,
    );

    expect(webGpuAppMaterialQueueRouteReportShellToJsonValue(shell)).toEqual({
      valid: false,
      queueItemCount: 1,
      routedItemCount: 0,
      skippedItemCount: 1,
      byFamily: [
        {
          key: "standard",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      byPhase: [
        {
          key: "transparent",
          queuedCount: 1,
          routedCount: 0,
          skippedCount: 1,
        },
      ],
      diagnosticSummary: {
        total: 1,
        bySeverity: { info: 0, warning: 1, error: 0 },
        byCode: {
          "webGpuApp.unsupportedMaterialQueueBlendPreset": 1,
        },
      },
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          message: "Null blend preset.",
          severity: "warning",
          materialFamily: "standard",
          renderPhase: "transparent",
          blendPreset: null,
        },
      ],
    });
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

function routedItem(
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
  };
}
