import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimulationWorker } from "@aperture-engine/runtime";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppRenderReport } from "@aperture-engine/webgpu";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "@aperture-engine/app/commands";
import {
  createGeneratedBrowserRequestClient,
  type GeneratedBrowserRequestClient,
} from "../../packages/app/src/browser/request.js";
import { createGeneratedBrowserFrameControl } from "../../packages/app/src/browser/control.js";

function fixture(manual = true, booted = true) {
  vi.useFakeTimers();
  const messages = new Set<(value: unknown) => void>();
  const errors = new Set<
    (error: {
      message: string;
      reason: string;
      source: "worker";
      diagnostics?: readonly unknown[];
    }) => void
  >();
  const worker = {
    postMessage: vi.fn<(message: unknown) => void>(),
    onMessage(callback: (value: unknown) => void) {
      messages.add(callback);
      return () => messages.delete(callback);
    },
    onError(callback: Parameters<SimulationWorker["onError"]>[0]) {
      errors.add(callback);
      return () => errors.delete(callback);
    },
  } as unknown as SimulationWorker;
  const requests: GeneratedBrowserRequestClient =
    createGeneratedBrowserRequestClient({
      worker,
      getWebGpuResult: () => null,
      onRequestPosted(tool, id) {
        if (tool === "ecs_step") control.requested(id);
      },
      onFailure(error) {
        control.failed(error);
      },
    });
  const control = createGeneratedBrowserFrameControl({ requests, manual });
  const emit = (message: unknown): void => {
    for (const listener of messages) listener(message);
  };
  if (booted) emit({ type: SIMULATION_WORKER_PROTOCOL.ready });
  return {
    requests,
    control,
    worker,
    messages,
    errors,
    boot() {
      emit({ type: SIMULATION_WORKER_PROTOCOL.ready });
    },
    request(index = 0) {
      return vi.mocked(worker.postMessage).mock.calls[
        index
      ]![0] as ApertureDevtoolsRequest;
    },
    respond(index: number, result: unknown, ok = true) {
      emit(
        createApertureDevtoolsResponse({
          requestId: this.request(index).requestId,
          ok,
          result,
          ...(!ok
            ? {
                diagnostics: [
                  { code: "step.failure", message: "Actual worker failure" },
                ],
              }
            : {}),
        }),
      );
    },
  };
}

function report(frame: number, ok = true): WebGpuAppRenderReport {
  const snapshot: RenderSnapshot = {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    runtimeUniforms: [],
    bounds: [],
    diagnostics: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
  return {
    ok,
    frame,
    snapshot,
    counts: { views: 0, meshDraws: 0 },
    resourceReuse: {},
    diagnostics: ok ? [] : [{ code: "render.failure" }],
    pipeline: null,
    resources: null,
    boundary: null,
  } as unknown as WebGpuAppRenderReport;
}

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("browser frame control", () => {
  it("awaits worker readiness before posting a controlled step", async () => {
    const test = fixture(true, false);
    const frame = test.control.renderFrame();
    await flush();
    expect(test.worker.postMessage).not.toHaveBeenCalled();
    test.boot();
    await flush();
    expect(test.worker.postMessage).toHaveBeenCalledTimes(1);
    test.respond(0, { snapshotFrame: 0 });
    test.control.presented(report(0));
    await frame;
    test.requests.dispose();
  });

  it("bounds boot readiness and does not post after initialization fails", async () => {
    const test = fixture(true, false);
    const frame = test.control.renderFrame();
    const rejection = expect(frame).rejects.toThrow("initialization timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(test.worker.postMessage).not.toHaveBeenCalled();
    test.requests.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not step an aborted queued frame and cleans abort listeners", async () => {
    const test = fixture();
    const first = test.control.renderFrame();
    const abort = new AbortController();
    const second = test.control.renderFrame({ signal: abort.signal });
    const rejection = expect(second).rejects.toThrow("aborted");
    abort.abort();
    await flush();
    test.respond(0, { snapshotFrame: 0 });
    test.control.presented(report(0));
    await first;
    await rejection;
    expect(test.worker.postMessage).toHaveBeenCalledTimes(1);
    test.requests.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not accept or submit unsolicited initial and duplicate snapshots", async () => {
    const test = fixture();
    expect(test.control.acceptSnapshot(0, {})).toBe(false);
    expect(test.worker.postMessage).not.toHaveBeenCalled();
    const frame = test.control.renderFrame();
    await flush();
    const id = test.request().requestId;
    expect(
      test.control.acceptSnapshot(0, { controlledFrameRequestId: "unrelated" }),
    ).toBe(false);
    expect(
      test.control.acceptSnapshot(0, { controlledFrameRequestId: id }),
    ).toBe(true);
    expect(
      test.control.acceptSnapshot(0, { controlledFrameRequestId: id }),
    ).toBe(false);
    test.control.presented(report(0));
    test.respond(0, { frame: 1, snapshotFrame: 0 });
    expect((await frame).snapshotFrame).toBe(0);
    test.requests.dispose();
  });

  it("matches the actual snapshot when presentation arrives before the next-counter response", async () => {
    const test = fixture();
    const frame = test.control.renderFrame({
      deltaSeconds: 0.02,
      timeSeconds: 4,
    });
    await flush();
    expect(test.request().payload).toEqual({ delta: 0.02, time: 4 });
    test.control.presented(report(7));
    test.respond(0, { frame: 8, snapshotFrame: 7 });
    const rendered = await frame;
    expect(rendered.snapshotFrame).toBe(7);
    expect(rendered.report.frame).toBe(7);
    expect("snapshot" in rendered.report).toBe(false);
    test.requests.dispose();
  });

  it("waits for actual native presentation after the step response and ignores an old frame", async () => {
    const test = fixture();
    test.control.presented(report(3));
    const frame = test.control.renderFrame();
    let resolved = false;
    void frame.then(() => {
      resolved = true;
    });
    await flush();
    test.respond(0, { snapshotFrame: 4 });
    await flush();
    expect(resolved).toBe(false);
    test.control.presented(report(4));
    await frame;
    expect(resolved).toBe(true);
    test.requests.dispose();
  });

  it("serializes concurrent frame calls through submission and recovers after a rejected step", async () => {
    const test = fixture();
    const first = test.control.renderFrame();
    const rejection = expect(first).rejects.toMatchObject({
      diagnostics: [{ code: "step.failure" }],
    });
    const second = test.control.renderFrame();
    await flush();
    expect(test.worker.postMessage).toHaveBeenCalledTimes(1);
    test.respond(0, {}, false);
    await rejection;
    await flush();
    expect(test.worker.postMessage).toHaveBeenCalledTimes(2);
    test.respond(1, { snapshotFrame: 1 });
    test.control.presented(report(1));
    await second;
    test.requests.dispose();
  });

  it("rejects renderer diagnostics promptly and accepts a later successful frame", async () => {
    const test = fixture();
    const failed = test.control.renderFrame();
    const rejection = expect(failed).rejects.toMatchObject({
      diagnostics: [{ code: "render.failure" }],
    });
    await flush();
    test.respond(0, { snapshotFrame: 0 });
    test.control.presented(report(0, false));
    await rejection;
    const next = test.control.renderFrame();
    await flush();
    test.respond(1, { snapshotFrame: 1 });
    test.control.presented(report(1));
    await next;
    test.requests.dispose();
  });

  it("rejects a response whose frame differs from the accepted snapshot", async () => {
    const test = fixture();
    const frame = test.control.renderFrame();
    const rejection = expect(frame).rejects.toThrow("frame differ");
    await flush();
    test.control.acceptSnapshot(0, {
      controlledFrameRequestId: test.request().requestId,
    });
    test.respond(0, { snapshotFrame: 1 });
    await rejection;
    test.requests.dispose();
  });

  it("rejects invalid input and automatic cadence without taking ownership of its clock", async () => {
    const test = fixture();
    await expect(
      test.control.renderFrame({ deltaSeconds: NaN }),
    ).rejects.toThrow("finite");
    await expect(test.control.renderFrame({ timeSeconds: -1 })).rejects.toThrow(
      "non-negative",
    );
    expect(test.worker.postMessage).not.toHaveBeenCalled();
    test.requests.dispose();
    const automatic = fixture(false);
    await expect(automatic.control.renderFrame()).rejects.toThrow("manual");
    automatic.requests.dispose();
  });

  it("returns detached inspection and frame reports without sharing renderer buffers", async () => {
    const test = fixture();
    const actual = report(0);
    const frame = test.control.renderFrame();
    await flush();
    test.respond(0, { snapshotFrame: 0 });
    test.control.presented(actual);
    const rendered = await frame;
    expect(rendered.report.counts).not.toBe(actual.counts);
    const first = test.control.inspectRenderedFrame()!;
    const second = test.control.inspectRenderedFrame()!;
    expect(first.frame).toBe(0);
    expect(first).toEqual(second);
    expect(first.counts).not.toBe(second.counts);
    test.requests.dispose();
  });

  it("bounds presentation waits and cleans timers and pending work on disposal", async () => {
    const test = fixture();
    const frame = test.control.renderFrame();
    const rejection = expect(frame).rejects.toThrow("presentation timed out");
    await flush();
    test.respond(0, { snapshotFrame: 0 });
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    const pending = test.control.renderFrame();
    const disposed = expect(pending).rejects.toThrow("disposed");
    await flush();
    test.requests.dispose();
    test.control.dispose();
    await disposed;
    expect(vi.getTimerCount()).toBe(0);
    expect(test.messages.size).toBe(0);
    expect(test.errors.size).toBe(0);
  });

  it("cleans a synchronous post failure immediately and bounds outstanding requests", async () => {
    const test = fixture();
    vi.mocked(test.worker.postMessage).mockImplementationOnce(() => {
      throw new Error("send failed");
    });
    await expect(test.requests.requestRaw("ecs_query")).rejects.toThrow(
      "send failed",
    );
    expect(vi.getTimerCount()).toBe(0);
    const pending = Array.from({ length: 128 }, () =>
      test.requests.requestRaw("ecs_query").catch(() => {}),
    );
    await expect(test.requests.requestRaw("ecs_query")).rejects.toThrow(
      "128 pending",
    );
    test.requests.dispose();
    await Promise.all(pending);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates worker error diagnostics to every pending request", async () => {
    const test = fixture();
    const pending = test.requests.requestRaw("ecs_query");
    const rejection = expect(pending).rejects.toMatchObject({
      diagnostics: [{ code: "worker.failure" }],
    });
    for (const callback of test.errors)
      callback({
        message: "worker failed",
        reason: "failure",
        source: "worker",
        diagnostics: [{ code: "worker.failure" }],
      });
    await rejection;
    await expect(test.requests.requestRaw("ecs_query")).rejects.toThrow(
      "worker failed",
    );
    test.requests.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
