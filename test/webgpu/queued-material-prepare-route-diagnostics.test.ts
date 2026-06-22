import { describe, expect, it } from "vitest";
import type { MaterialQueueItem } from "@aperture-engine/render";
import { queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic } from "../../packages/webgpu/src/render/queues/queued-material-prepare-route-diagnostics.js";

describe("queued prepare route diagnostics", () => {
  it("normalizes missing adapter diagnostics to app route diagnostics", () => {
    expect(
      queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
        {
          code: "queuedMaterialPrepareRoute.missingAdapter",
          materialKind: "unlit",
        },
        queueItem(),
      ),
    ).toEqual({
      code: "webGpuApp.unsupportedMaterialQueueFamily",
      renderId: 7,
      drawIndex: 2,
      materialFamily: "custom-preview",
      entity: { index: 4, generation: 1 },
      message:
        "WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not 'custom-preview'.",
    });
  });

  it("normalizes material mismatch diagnostics to app route diagnostics", () => {
    expect(
      queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
        {
          code: "queuedMaterialPrepareRoute.materialMismatch",
          materialKind: "matcap",
        },
        queueItem(),
      ),
    ).toEqual({
      code: "webGpuApp.materialQueueAssetMismatch",
      renderId: 7,
      drawIndex: 2,
      materialFamily: "custom-preview",
      materialKind: "matcap",
      entity: { index: 4, generation: 1 },
      message:
        "Render object 7 pipeline family 'custom-preview' does not match material asset kind 'matcap'.",
    });
  });

  it("passes through unknown diagnostics", () => {
    const diagnostic = { code: "custom.routeDiagnostic", value: 1 };

    expect(
      queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
        diagnostic,
        queueItem(),
      ),
    ).toBe(diagnostic);
    expect(
      queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
        "diagnostic",
        queueItem(),
      ),
    ).toBe("diagnostic");
  });
});

function queueItem(): MaterialQueueItem {
  return {
    renderId: 7,
    drawIndex: 2,
    entity: { index: 4, generation: 1 },
    renderPhase: "opaque",
    materialFamily: "custom-preview",
    pipelineKey: "custom-preview|opaque",
    meshKey: "mesh:source",
    materialKey: "material:source",
    meshResourceKey: "mesh:prepared",
    materialResourceKey: "material:prepared",
    meshLayoutKey: "mesh-layout:position",
    topology: "triangle-list",
    depth: 0,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "custom-preview|opaque",
      materialResourceKey: "material:prepared",
      meshResourceKey: "mesh:prepared",
      depth: 0,
      stableId: 7,
      drawIndex: 2,
    },
  };
}
