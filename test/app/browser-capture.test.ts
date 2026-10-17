import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "../helpers/wait.js";
import { AssetRegistry } from "@aperture-engine/simulation";
import type { SimulationWorker } from "@aperture-engine/runtime";
import type { WebGpuApp, WebGpuCapturedFrame } from "@aperture-engine/webgpu";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "../../packages/app/src/commands.js";
import { createGeneratedFrameCaptureController } from "../../packages/app/src/browser/capture.js";

function fixture() {
  const messages = new Set<(value: unknown) => void>();
  const errors = new Set<(value: { message: string }) => void>();
  const posted: ApertureDevtoolsRequest[] = [];
  const worker = {
    onMessage(fn: (value: unknown) => void) {
      messages.add(fn);
      return () => {
        messages.delete(fn);
      };
    },
    onError(fn: (value: { message: string }) => void) {
      errors.add(fn);
      return () => {
        errors.delete(fn);
      };
    },
    postMessage(value: ApertureDevtoolsRequest) {
      posted.push(value);
    },
  } as unknown as SimulationWorker;
  const release = vi.fn();
  const captureSnapshot = vi.fn(async (selected: Promise<unknown>) => {
    await selected;
    return {
      frame: 3,
      report: { ok: true },
      timings: { totalMs: 1 },
      release,
    } as unknown as WebGpuCapturedFrame;
  });
  const onHoldChanged = vi.fn();
  const controller = createGeneratedFrameCaptureController({
    worker,
    app: { captureSnapshot } as unknown as WebGpuApp,
    sourceAssets: new AssetRegistry(),
    onHoldChanged,
  });
  return {
    controller,
    posted,
    release,
    onHoldChanged,
    captureSnapshot,
    messages,
    errors,
    reply(request: ApertureDevtoolsRequest, ok = true, result: unknown = {}) {
      for (const fn of [...messages])
        fn(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok,
            result,
          }),
        );
    },
  };
}
afterEach(() => vi.useRealTimers());

describe("generated frame capture", () => {
  it("correlates selection and release, retains the hold through readback, and releases idempotently", async () => {
    const f = fixture();
    const pending = f.controller.captureFrame({ time: 2, delta: 0 });
    expect(f.posted[0]).toMatchObject({
      tool: "render_capture_snapshot",
      payload: { time: 2, delta: 0 },
    });
    expect(f.captureSnapshot).toHaveBeenCalledOnce();
    f.reply({ ...f.posted[0]!, requestId: "unrelated" });
    expect(f.messages.size).toBe(1);
    f.reply(f.posted[0]!, true, {
      snapshot: { frame: 3 },
      sourceAssets: { entries: [] },
    });
    const frame = await pending;
    expect(frame.frame).toBe(3);
    expect(f.release).not.toHaveBeenCalled();
    await expect(f.controller.captureFrame()).rejects.toThrow("Release");
    const released = frame.release();
    expect(frame.release()).toBe(released);
    expect(f.posted[1]).toMatchObject({
      tool: "render_capture_release",
      payload: { token: f.posted[0]!.requestId },
    });
    f.reply(f.posted[1]!);
    await released;
    expect(f.release).toHaveBeenCalledOnce();
    expect(f.onHoldChanged.mock.calls).toEqual([[true], [false]]);
    expect(f.messages.size + f.errors.size).toBe(0);
  });

  it("handles a late worker rejection when the renderer has already rejected capture", async () => {
    const f = fixture();
    f.captureSnapshot.mockRejectedValueOnce(new Error("renderer disposed"));
    const pending = f.controller.captureFrame();
    const rejected = expect(pending).rejects.toThrow("renderer disposed");
    await waitFor(() => f.posted.length === 2);
    f.reply(f.posted[0]!, false);
    f.reply(f.posted[1]!);
    await rejected;
    expect(f.onHoldChanged).toHaveBeenLastCalledWith(false);
    expect(f.messages.size + f.errors.size).toBe(0);
  });

  it("releases presentation and listener state even if the worker rejects release", async () => {
    const f = fixture();
    const pending = f.controller.captureFrame();
    f.reply(f.posted[0]!, true, { snapshot: { frame: 3 } });
    const frame = await pending;
    const released = frame.release();
    f.reply(f.posted[1]!, false);
    await expect(released).rejects.toThrow("failed");
    expect(f.release).toHaveBeenCalledOnce();
    expect(f.onHoldChanged).toHaveBeenLastCalledWith(false);
    expect(f.messages.size + f.errors.size).toBe(0);
  });

  it("cleans up both phases after a timed-out worker without leaking the hold", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = f.controller.captureFrame({ timeoutMs: 10000 });
    const rejected = expect(pending).rejects.toThrow(
      "Capture and release failed",
    );
    await vi.advanceTimersByTimeAsync(20000);
    await rejected;
    expect(f.posted.map((r) => r.tool)).toEqual([
      "render_capture_snapshot",
      "render_capture_release",
    ]);
    expect(f.onHoldChanged).toHaveBeenLastCalledWith(false);
    expect(f.messages.size + f.errors.size).toBe(0);
  });
});
