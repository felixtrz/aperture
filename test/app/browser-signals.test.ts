import { describe, expect, it } from "vitest";
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  readGeneratedSignal,
  readGeneratedSignals,
  type GeneratedBrowserAppStatus,
} from "@aperture-engine/app/browser";

describe("generated browser signals", () => {
  it("reads the generated worker signal summary without exposing status shape", () => {
    const scope: Record<string, unknown> = {
      [APERTURE_GENERATED_STATUS_GLOBAL]: statusWithSignals({
        speed: 0.75,
        started: true,
      }),
    };

    expect(readGeneratedSignals(scope)).toEqual({
      speed: 0.75,
      started: true,
    });
    expect(readGeneratedSignal("speed", 0, scope)).toBe(0.75);
    expect(readGeneratedSignal("missing", "fallback", scope)).toBe("fallback");
  });

  it("returns null when generated status or signal data is absent", () => {
    expect(readGeneratedSignals({})).toBeNull();
    expect(
      readGeneratedSignals({
        [APERTURE_GENERATED_STATUS_GLOBAL]: statusWithSignals(null),
      }),
    ).toBeNull();
  });
});

function statusWithSignals(signals: unknown): GeneratedBrowserAppStatus {
  return {
    status: "running",
    webgpuOk: true,
    snapshots: 1,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    forwardedInputEvents: 0,
    forwardedInputFrames: 0,
    connectedGamepads: 0,
    lastInputReset: null,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: 1,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: signals === null ? null : { signals },
    diagnostics: null,
    render: null,
    canvas: null,
    systems: [],
  };
}
