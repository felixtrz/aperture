import { describe, expect, it } from "vitest";
import {
  renderReport,
  webGpuAppRenderReportToJsonValue,
} from "../../packages/webgpu/src/app/report.js";
import { portableRenderStatus } from "../../packages/app/src/render-bundle.js";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppRenderReport } from "@aperture-engine/webgpu";

const webgpu = {
  format: "rgba8unorm",
  displayColorSpace: "srgb",
  adapterInfo: {},
  adapterFeatures: [],
  deviceFeatures: [],
};
function snapshot(): RenderSnapshot {
  return {
    frame: 12,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {},
  } as unknown as RenderSnapshot;
}

describe("shared portable render status", () => {
  it.each([true, false])(
    "preserves successful and failed frame warnings (ok=%s)",
    (ok) => {
      const warning = {
        code: "fixture.warning",
        severity: "warning",
        message: "Intent was omitted",
        renderId: 123,
        meshKey: "mesh:caster",
      };
      const report = renderReport({
        ok,
        snapshot: snapshot(),
        diagnostics: [warning],
      });
      expect(portableRenderStatus(report, webgpu)).toEqual({
        ok,
        frame: 12,
        diagnostics: [warning],
        metadata: { webgpu, lightingHealth: null },
      });
    },
  );

  it("preserves the actual compact shadow report shared by both backends", () => {
    const section = { ready: true, sections: {}, diagnostics: [] };
    const shadow = {
      ready: true,
      status: "ready",
      shadowKind: "directional",
      requestCount: 1,
      passCount: 1,
      drawCalls: 1,
      casterCounts: {
        includedDraws: 43,
        readyDraws: 34,
        submittedDrawCalls: 34,
      },
      descriptor: section,
      viewProjection: section,
      matrixComputation: section,
      casterDrawList: section,
      depthTexture: section,
      sampler: section,
      depthTextureKeys: [],
      matrixBufferResourceKey: null,
      sections: {},
      diagnostics: [],
      resourceReuse: {},
      commandBufferSubmission: {
        status: "submitted",
        assembledPasses: 1,
        commandBuffers: 1,
        submittedCommandBuffers: 1,
        commandBufferKeys: [],
        sections: {},
        diagnostics: [],
      },
    } as unknown as NonNullable<WebGpuAppRenderReport["shadow"]>;
    const report = renderReport({
      ok: true,
      snapshot: snapshot(),
      diagnostics: [],
      shadow,
    });
    const status = portableRenderStatus(report, webgpu);
    expect(status.shadow).toEqual(
      webGpuAppRenderReportToJsonValue(report, { detail: "status" }).shadow,
    );
    expect(status.shadow).toMatchObject({
      casterCounts: {
        includedDraws: 43,
        readyDraws: 34,
        submittedDrawCalls: 34,
      },
    });
  });
});
