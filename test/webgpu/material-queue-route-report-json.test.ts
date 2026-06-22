import { describe, expect, it } from "vitest";

import {
  createWebGpuAppMaterialQueueRouteReport,
  webGpuAppMaterialQueueRouteReportToJson,
  webGpuAppMaterialQueueRouteReportToJsonValue,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU app material queue route report JSON", () => {
  it("serializes ready route reports without queue item payloads", () => {
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems: [
        queueItem(1, 0, "unlit", "opaque"),
        queueItem(2, 1, "standard", "transparent"),
      ],
      routedItems: [
        queueItem(1, 0, "unlit", "opaque"),
        queueItem(2, 1, "standard", "transparent"),
      ],
    });
    const json = webGpuAppMaterialQueueRouteReportToJsonValue(report);

    expect(json).toEqual({
      valid: true,
      queueItemCount: 2,
      routedItemCount: 2,
      skippedItemCount: 0,
      byFamily: [
        { key: "unlit", queuedCount: 1, routedCount: 1, skippedCount: 0 },
        { key: "standard", queuedCount: 1, routedCount: 1, skippedCount: 0 },
      ],
      byPhase: [
        { key: "opaque", queuedCount: 1, routedCount: 1, skippedCount: 0 },
        { key: "transparent", queuedCount: 1, routedCount: 1, skippedCount: 0 },
      ],
      diagnosticSummary: {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0 },
        byCode: {},
      },
      diagnostics: [],
    });
    expect(JSON.parse(webGpuAppMaterialQueueRouteReportToJson(report))).toEqual(
      json,
    );
    expect(JSON.stringify(json)).not.toContain("queueItems");
  });

  it("serializes failed route diagnostics without raw adapters or GPU handles", () => {
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems: [
        queueItem(10, 0, "debug-normal", "opaque"),
        queueItem(11, 1, "standard", "transparent"),
      ],
      routedItems: [],
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialQueueFamily",
          message:
            "WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not 'debug-normal'.",
          renderId: 10,
          drawIndex: 0,
          materialFamily: "debug-normal",
          entity: { index: 10, generation: 1 },
        },
        {
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          message:
            "WebGPU app material queue routing supports StandardMaterial transparent draws with alpha blending, not blend preset 'additive'.",
          renderId: 11,
          drawIndex: 1,
          materialFamily: "standard",
          renderPhase: "transparent",
          blendPreset: "additive",
          entity: { index: 11, generation: 1 },
        },
      ],
    });
    const json = webGpuAppMaterialQueueRouteReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json.valid).toBe(false);
    expect(json.diagnostics).toMatchObject([
      {
        code: "webGpuApp.unsupportedMaterialQueueFamily",
        renderId: 10,
        drawIndex: 0,
        materialFamily: "debug-normal",
        entity: { index: 10, generation: 1 },
      },
      {
        code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
        renderId: 11,
        drawIndex: 1,
        materialFamily: "standard",
        renderPhase: "transparent",
        blendPreset: "additive",
        entity: { index: 11, generation: 1 },
      },
    ]);
    expect(serialized).not.toContain("adapter");
    expect(serialized).not.toContain("sourceAsset");
    expect(serialized).not.toContain("gpu-resource");
    expect(serialized).not.toContain("pipeline-handle");
    expect(serialized).not.toContain("bind-group-handle");
    expect(serialized).not.toContain("function");
  });

  it("omits absent optional diagnostic fields but preserves null blend presets", () => {
    const report = createWebGpuAppMaterialQueueRouteReport({
      queueItems: [queueItem(12, 0, "standard", "transparent")],
      routedItems: [],
      diagnostics: [
        {
          code: "webGpuApp.materialQueueAssetMismatch",
          message: "Minimal route diagnostic.",
        },
        {
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          message: "Blend preset was parsed as null.",
          severity: "warning",
          blendPreset: null,
        },
      ],
    });
    const json = webGpuAppMaterialQueueRouteReportToJsonValue(report);
    const diagnostics = json.diagnostics as unknown as readonly Record<
      string,
      unknown
    >[];

    expect(json.valid).toBe(false);
    expect(json.diagnosticSummary).toEqual({
      total: 2,
      bySeverity: { info: 0, warning: 1, error: 1 },
      byCode: {
        "webGpuApp.materialQueueAssetMismatch": 1,
        "webGpuApp.unsupportedMaterialQueueBlendPreset": 1,
      },
    });
    expect(diagnostics[0]).toEqual({
      code: "webGpuApp.materialQueueAssetMismatch",
      message: "Minimal route diagnostic.",
    });
    expect(diagnostics[0]).not.toHaveProperty("entity");
    expect(diagnostics[0]).not.toHaveProperty("blendPreset");
    expect(diagnostics[0]).not.toHaveProperty("severity");
    expect(diagnostics[1]).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
      severity: "warning",
      blendPreset: null,
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
