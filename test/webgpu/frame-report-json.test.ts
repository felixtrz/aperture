import { describe, expect, it } from "vitest";

import {
  frameReportToJson,
  frameReportToJsonValue,
  type FrameReport,
} from "../../src/index.js";

describe("frame report JSON helpers", () => {
  it("creates JSON-safe frame report values", () => {
    const report = frameReport(true);

    expect(frameReportToJsonValue(report)).toEqual(report);
    expect(JSON.parse(frameReportToJson(report)) as unknown).toEqual(report);
  });

  it("preserves blocked report output", () => {
    const report = frameReport(false);

    expect(frameReportToJsonValue(report)).toMatchObject({
      frame: 1,
      ready: false,
      draws: 2,
      batches: 1,
    });
  });

  it("produces stable strings across repeated calls", () => {
    const report = frameReport(true);

    expect(frameReportToJson(report)).toBe(frameReportToJson(report));
  });
});

function frameReport(ready: boolean): FrameReport {
  return {
    frame: 1,
    ready,
    draws: 2,
    batches: 1,
    resources: {
      meshResources: 1,
      meshVertexBuffers: 1,
      meshIndexBuffers: 1,
      materialBuffers: 1,
      textures: 0,
      samplers: 0,
      lightBuffers: 0,
      lightGpuBuffers: 0,
      environmentMaps: 0,
      viewUniformBuffers: 1,
      shaderModules: 1,
      pipelineHits: 1,
      pipelineMisses: 0,
      warnings: ready ? 0 : 1,
      errors: 0,
    },
    diagnostics: {
      total: ready ? 0 : 1,
      bySeverity: { info: 0, warning: ready ? 0 : 1, error: 0 },
      byCode: ready ? {} : { warning: 1 },
    },
  };
}
