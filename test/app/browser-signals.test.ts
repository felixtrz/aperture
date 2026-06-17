import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  readGeneratedSignal,
  readGeneratedSignals,
  subscribeGeneratedBrowserAppStatus,
  subscribeGeneratedSignals,
  type GeneratedBrowserAppStatus,
  type GeneratedSignalSummary,
} from "@aperture-engine/app/browser";

describe("generated browser signals", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("subscribes to signal summaries and stops after unsubscribe", () => {
    vi.useFakeTimers();
    const scope: Record<string, unknown> = {
      [APERTURE_GENERATED_STATUS_GLOBAL]: statusWithSignals({
        speed: 0.75,
      }),
    };
    const updates: GeneratedSignalSummary[] = [];
    const unsubscribe = subscribeGeneratedSignals(
      (signals) => {
        updates.push(signals);
      },
      { scope },
    );

    expect(updates).toEqual([{ speed: 0.75 }]);

    scope[APERTURE_GENERATED_STATUS_GLOBAL] = statusWithSignals({
      speed: 1.25,
      started: true,
    });
    vi.advanceTimersByTime(16);

    expect(updates).toEqual([{ speed: 0.75 }, { speed: 1.25, started: true }]);

    unsubscribe();
    scope[APERTURE_GENERATED_STATUS_GLOBAL] = statusWithSignals({
      speed: 2,
    });
    vi.advanceTimersByTime(16);

    expect(updates).toEqual([{ speed: 0.75 }, { speed: 1.25, started: true }]);
  });

  it("subscribes to generated browser status mutation and stops after unsubscribe", () => {
    vi.useFakeTimers();
    const status = statusWithSignals({ speed: 0.75 });
    const scope: Record<string, unknown> = {
      [APERTURE_GENERATED_STATUS_GLOBAL]: status,
    };
    const updates: number[] = [];
    const unsubscribe = subscribeGeneratedBrowserAppStatus(
      (next) => {
        updates.push(next.snapshots);
      },
      { scope },
    );

    expect(updates).toEqual([1]);

    status.snapshots = 2;
    vi.advanceTimersByTime(16);

    expect(updates).toEqual([1, 2]);

    unsubscribe();
    status.snapshots = 3;
    vi.advanceTimersByTime(16);

    expect(updates).toEqual([1, 2]);
  });

  it("notifies when generated browser status errors mutate in place", () => {
    vi.useFakeTimers();
    const status = statusWithSignals({ speed: 0.75 });
    const scope: Record<string, unknown> = {
      [APERTURE_GENERATED_STATUS_GLOBAL]: status,
    };
    const updates: string[] = [];
    subscribeGeneratedBrowserAppStatus(
      (next) => {
        updates.push(
          String(
            (next.lastError as { message?: string } | null)?.message ?? "",
          ),
        );
      },
      { scope },
    );

    expect(updates).toEqual([""]);

    status.lastError = { message: "first" };
    vi.advanceTimersByTime(16);
    status.lastError = { message: "second" };
    vi.advanceTimersByTime(16);

    expect(updates).toEqual(["", "first", "second"]);
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
