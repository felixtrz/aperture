import { describe, expect, it } from "vitest";

import { defineApertureConfig } from "@aperture-engine/app/config";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";

describe("generated simulation worker start messages", () => {
  it("unwraps start options nested by createSimulationWorker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: { stop: true },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(port.posted.filter(isSimulationWorkerSnapshotMessage)).toHaveLength(
      1,
    );
  });
});

class TestGeneratedWorkerPort {
  readonly posted: unknown[] = [];
  private readonly listeners = new Set<
    (event: MessageEvent<unknown>) => void
  >();
  private waiters: {
    readonly predicate: (message: unknown) => boolean;
    readonly resolve: (message: unknown) => void;
  }[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);

    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(message)) {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        waiter.resolve(message);
      }
    }
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  start(): void {}

  dispatch(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }

  nextPostedMessage(
    predicate: (message: unknown) => boolean,
  ): Promise<unknown> {
    const existing = this.posted.find(predicate);

    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter(
          (waiter) => waiter.resolve !== resolve,
        );
        reject(new Error("Timed out waiting for generated worker message."));
      }, 1000);

      this.waiters.push({
        predicate,
        resolve(message) {
          clearTimeout(timeout);
          resolve(message);
        },
      });
    });
  }
}

function isSimulationWorkerSnapshotMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.snapshot
  );
}
