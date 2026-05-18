import { describe, expect, it } from "vitest";

import {
  createWebGpuAppMaterialQueueRouteReport,
  unknownToWebGpuAppMaterialQueueRouteDiagnostics,
  webGpuAppMaterialQueueRouteReportToJsonValue,
} from "@aperture-engine/webgpu";

describe("WebGPU app material queue route report diagnostics", () => {
  it("aggregates repeated diagnostic codes by severity", () => {
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems: [
        queueItem(1, 0, "debug-normal", "opaque"),
        queueItem(2, 1, "debug-normal", "opaque"),
        queueItem(3, 2, "standard", "transparent"),
      ],
      routedItems: [],
      diagnostics: [
        diagnostic("webGpuApp.unsupportedMaterialQueueFamily", "error"),
        diagnostic("webGpuApp.unsupportedMaterialQueueFamily", "error"),
        diagnostic("webGpuApp.unsupportedMaterialQueueBlendPreset", "warning"),
        diagnostic("webGpuApp.materialQueueRouteInspected", "info"),
      ],
    });

    expect(report.valid).toBe(false);
    expect(report.diagnosticSummary).toEqual({
      total: 4,
      bySeverity: { info: 1, warning: 1, error: 2 },
      byCode: {
        "webGpuApp.unsupportedMaterialQueueFamily": 2,
        "webGpuApp.unsupportedMaterialQueueBlendPreset": 1,
        "webGpuApp.materialQueueRouteInspected": 1,
      },
    });
    expect(webGpuAppMaterialQueueRouteReportToJsonValue(report)).toMatchObject({
      diagnosticSummary: report.diagnosticSummary,
    });
  });

  it("treats missing diagnostic severity as an error for validity", () => {
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems: [queueItem(4, 0, "standard", "transparent")],
      routedItems: [],
      diagnostics: [
        {
          code: "webGpuApp.materialQueueAssetMismatch",
          message:
            "Render object 4 pipeline family 'standard' does not match material asset kind 'unlit'.",
          renderId: 4,
          drawIndex: 0,
          materialFamily: "standard",
          materialKind: "unlit",
          renderPhase: "transparent",
          entity: { index: 4, generation: 1 },
        },
      ],
    });

    expect(report.valid).toBe(false);
    expect(report.diagnosticSummary).toEqual({
      total: 1,
      bySeverity: { info: 0, warning: 0, error: 1 },
      byCode: {
        "webGpuApp.materialQueueAssetMismatch": 1,
      },
    });
  });

  it("normalizes unknown route diagnostics through a JSON-safe allowlist", () => {
    const diagnostics = unknownToWebGpuAppMaterialQueueRouteDiagnostics({
      code: "webGpuApp.previewDiagnostic",
      message: "Preview diagnostic.",
      severity: "warning",
      renderId: 9,
      drawIndex: 2,
      materialFamily: "preview",
      materialKind: "preview-material",
      renderPhase: "transparent",
      blendPreset: "alpha",
      entity: { index: 9, generation: 3 },
      rawGpuHandle: "must-not-leak",
      sourceAsset: { rawGpuHandle: "must-not-leak" },
    });

    expect(diagnostics).toEqual([
      {
        code: "webGpuApp.previewDiagnostic",
        message: "Preview diagnostic.",
        severity: "warning",
        renderId: 9,
        drawIndex: 2,
        materialFamily: "preview",
        materialKind: "preview-material",
        renderPhase: "transparent",
        blendPreset: "alpha",
        entity: { index: 9, generation: 3 },
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /rawGpuHandle|sourceAsset|GPUDevice|GPUBuffer|GPUTexture|bindGroup/,
    );
  });

  it("skips non-object diagnostics and omits invalid optional fields", () => {
    expect(unknownToWebGpuAppMaterialQueueRouteDiagnostics(null)).toEqual([]);
    expect(unknownToWebGpuAppMaterialQueueRouteDiagnostics("missing")).toEqual(
      [],
    );
    expect(unknownToWebGpuAppMaterialQueueRouteDiagnostics({})).toEqual([]);

    expect(
      unknownToWebGpuAppMaterialQueueRouteDiagnostics({
        code: "webGpuApp.invalidOptionalFields",
        message: 12,
        severity: "debug",
        renderId: Number.NaN,
        drawIndex: Infinity,
        materialFamily: 5,
        materialKind: false,
        renderPhase: null,
        blendPreset: 8,
        entity: { index: "bad", generation: 1 },
      }),
    ).toEqual([
      {
        code: "webGpuApp.invalidOptionalFields",
        message: "",
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

function diagnostic(code: string, severity: "info" | "warning" | "error") {
  return {
    code,
    severity,
    message: `${code} fixture.`,
  };
}
