import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateConfigTypeMetadata } from "../../packages/vite-plugin/src/config-type-evaluation.js";

const workers = vi.hoisted(() => ({
  current: undefined as MockWorker | undefined,
}));

class MockWorker extends EventEmitter {
  readonly terminate = vi.fn(async () => 0);

  constructor(readonly token: string) {
    super();
  }

  reply(metadata: unknown): void {
    this.emit("message", this.envelope(metadata));
  }

  envelope(metadata: unknown): Record<string, unknown> {
    return {
      protocol: "aperture:config-type-metadata:v1",
      token: this.token,
      metadata,
    };
  }
}

vi.mock("node:worker_threads", () => ({
  Worker: class {
    constructor(
      _url: unknown,
      options: { readonly workerData: { readonly token: string } },
    ) {
      const worker = new MockWorker(options.workerData.token);
      workers.current = worker;
      return worker;
    }
  },
}));

describe("config type evaluation worker lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    workers.current = undefined;
  });

  it("waits for termination before exposing a successful result", async () => {
    const result = evaluateConfigTypeMetadata("/config.ts");
    const worker = workers.current!;
    let terminated: () => void = () => {};
    worker.terminate.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          terminated = () => resolve(0);
        }),
    );
    const metadata = { input: { actions: {} }, signals: {} };
    worker.reply(metadata);
    let resolved = false;
    void result.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(resolved).toBe(false);
    // An error delivered during shutdown must still have a listener.
    worker.emit("error", new Error("during shutdown"));
    terminated();
    expect(await result).toEqual(metadata);
    expect(worker.eventNames()).toEqual([]);
  });

  it.each(["error", "exit", "message"])(
    "cleans up a worker after %s failure",
    async (event) => {
      vi.useFakeTimers();
      const result = evaluateConfigTypeMetadata("/config.ts");
      const worker = workers.current!;
      worker.emit("message", { ready: true });
      if (event === "message") worker.reply(null);
      else
        worker.emit(event, event === "error" ? new Error("bad config") : null);
      expect(await result).toBeNull();
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(worker.eventNames()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("ignores unrelated and malformed messages until a correlated result arrives", async () => {
    const result = evaluateConfigTypeMetadata("/config.ts");
    const worker = workers.current!;
    const metadata = {
      input: { actions: { correct: { kind: "button" } } },
      signals: {},
    };
    for (const message of [
      "ready",
      null,
      [],
      { ready: true },
      metadata,
      { ...worker.envelope(metadata), protocol: "other-protocol" },
      { ...worker.envelope(metadata), token: "other-call" },
      { protocol: "aperture:config-type-metadata:v1", token: worker.token },
      worker.envelope(undefined),
      worker.envelope({}),
      worker.envelope({ input: { actions: [] }, signals: {} }),
      worker.envelope({
        input: { actions: { invalid: { kind: 42 } } },
        signals: {},
      }),
    ])
      worker.emit("message", message);
    await Promise.resolve();
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.reply(metadata);
    expect(await result).toEqual(metadata);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("uses a distinct correlation token for each evaluation", async () => {
    const first = evaluateConfigTypeMetadata("/config.ts");
    const firstWorker = workers.current!;
    const second = evaluateConfigTypeMetadata("/config.ts");
    const secondWorker = workers.current!;
    expect(firstWorker.token).not.toBe(secondWorker.token);
    expect(typeof firstWorker.token).toBe("string");
    firstWorker.reply(null);
    secondWorker.reply(null);
    await Promise.all([first, second]);
  });

  it("terminates a worker that never returns metadata", async () => {
    vi.useFakeTimers();
    const result = evaluateConfigTypeMetadata("/config.ts");
    const worker = workers.current!;
    worker.emit("message", { ready: true });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await result).toBeNull();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
