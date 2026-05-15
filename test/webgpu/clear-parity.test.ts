import { describe, expect, it } from "vitest";

import {
  createClearParityReport,
  type ClearCompatibilityReport,
  type WebGpuClearResult,
} from "../../src/index.js";

describe("clear helper parity report", () => {
  it("reports ready when clear and frame-boundary compatibility both succeed", () => {
    expect(createClearParityReport(clear(true), compatibility(true))).toEqual({
      ready: true,
      clearReady: true,
      boundaryReady: true,
      diagnostics: [],
    });
  });

  it("reports matching failure when both paths fail", () => {
    expect(
      createClearParityReport(clear(false), compatibility(false)),
    ).toMatchObject({
      ready: false,
      clearReady: false,
      boundaryReady: false,
      diagnostics: [{ code: "clearParity.bothFailed" }],
    });
  });

  it("reports clear failure with compatible frame boundary", () => {
    expect(
      createClearParityReport(clear(false), compatibility(true)),
    ).toMatchObject({
      ready: false,
      clearReady: false,
      boundaryReady: true,
      diagnostics: [{ code: "clearParity.clearFailedBoundaryReady" }],
    });
  });

  it("reports clear success with incompatible frame boundary", () => {
    expect(
      createClearParityReport(clear(true), compatibility(false)),
    ).toMatchObject({
      ready: false,
      clearReady: true,
      boundaryReady: false,
      diagnostics: [{ code: "clearParity.clearSucceededBoundaryFailed" }],
    });
  });
});

function clear(ok: boolean): WebGpuClearResult {
  return ok
    ? { ok: true, commandBuffer: {} }
    : {
        ok: false,
        reason: "queue-unavailable",
        message: "queue missing",
      };
}

function compatibility(ready: boolean): ClearCompatibilityReport {
  return {
    ready,
    diagnostics: ready
      ? []
      : [
          {
            code: "clearCompatibility.missingQueueSubmit",
            message: "missing",
          },
        ],
  };
}
