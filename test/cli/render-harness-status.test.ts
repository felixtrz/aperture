import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  renderReport,
  webGpuAppRenderReportToJsonValue,
} from "../../packages/webgpu/src/app/report.js";
import type { RenderSnapshot } from "@aperture-engine/render";

// Execute the shipped assignment, rather than a second interpretation of status.
const source = readFileSync(
  new URL(
    "../../packages/cli/assets/render-harness/render-harness.main.js",
    import.meta.url,
  ),
  "utf8",
);
const start = source.indexOf(
  "  const status = webGpuAppRenderReportToJsonValue",
);
const end = source.indexOf("\n}", start);
const assign = new Function(
  "globalThis",
  "report",
  "bundle",
  "webgpu",
  "lightingHealth",
  "webGpuAppRenderReportToJsonValue",
  source.slice(start, end),
);

describe("render harness status", () => {
  it.each([true, false])(
    "keeps successful and failed frame warnings (ok=%s)",
    (ok) => {
      const warning = {
        code: "fixture.warning",
        severity: "warning",
        message: "Intent was omitted",
        renderId: 123,
        meshKey: "mesh:caster",
      };
      const snapshot = {
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
      const report = renderReport({ ok, snapshot, diagnostics: [warning] });
      const target: { __APERTURE_RENDER_STATUS__?: unknown } = {};
      assign(
        target,
        report,
        {},
        { backend: "webgpu" },
        { status: "healthy" },
        webGpuAppRenderReportToJsonValue,
      );
      expect(target.__APERTURE_RENDER_STATUS__).toEqual({
        ok,
        frame: 12,
        diagnostics: [warning],
        metadata: {
          webgpu: { backend: "webgpu" },
          lightingHealth: { status: "healthy" },
        },
      });
    },
  );
  it("uses the compact serializer's shadow field unchanged", () => {
    const shadow = {
      casterCounts: {
        includedDraws: 43,
        readyDraws: 34,
        submittedDrawCalls: 34,
      },
    };
    const target: { __APERTURE_RENDER_STATUS__?: unknown } = {};
    const serialize = (_report: unknown, options: unknown) => {
      expect(options).toEqual({ detail: "status" });
      return { diagnostics: [], shadow };
    };
    assign(target, { ok: true }, { frame: 7 }, {}, {}, serialize);
    expect(target.__APERTURE_RENDER_STATUS__).toMatchObject({
      ok: true,
      frame: 7,
      shadow,
    });
  });
});
