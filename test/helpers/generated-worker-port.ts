import type { SimulationMessagePort } from "@aperture-engine/runtime";

/**
 * In-process fake of the generated simulation worker's MessagePort. One
 * shared implementation: the previous per-file copies drifted (one fixed the
 * timed-out-waiter cleanup, the other kept comparing against the wrapped
 * resolve and never matched).
 */
export class TestGeneratedWorkerPort implements SimulationMessagePort {
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
      // Generous deadline: the awaited messages arrive after a full
      // in-process app boot (config eval, asset decode, physics init), which
      // can exceed 1s under coverage instrumentation on a loaded runner. The
      // wait resolves as soon as the message lands.
      const waiter = {
        predicate,
        resolve(message: unknown) {
          clearTimeout(timeout);
          resolve(message);
        },
      };
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error("Timed out waiting for generated worker message."));
      }, 10_000);

      this.waiters.push(waiter);
    });
  }
}
