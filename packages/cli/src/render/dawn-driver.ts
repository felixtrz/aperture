import { fork } from "node:child_process";
import { ApertureCliError } from "../errors.js";
import type {
  NodeDeviceMetadata,
  NodeDeviceOptions,
} from "@aperture-engine/adapter-node";
import type {
  ApertureRenderSession,
  ApertureRenderSessionOptions,
  RenderBundleResult,
} from "./types.js";
import type { DawnWorkerRequest, DawnWorkerResponse } from "./dawn-protocol.js";

/** One process/device per session; hard cancellation never leaves native work running. */
export async function createDawnRenderSession(
  options: ApertureRenderSessionOptions,
): Promise<ApertureRenderSession> {
  const policy =
    options.adapter ??
    options.native?.adapter ??
    process.env["APERTURE_DAWN_ADAPTER"] ??
    "auto";
  if (policy !== "auto" && policy !== "hardware" && policy !== "software")
    throw new ApertureCliError(
      "aperture.render.invalidAdapter",
      "Dawn adapter must be auto, hardware, or software.",
    );
  const worker = fork(new URL("./dawn-worker.js", import.meta.url), [], {
    execArgv: [],
    serialization: "advanced",
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stderr = "";
  worker.stderr?.on("data", (data: Buffer) => {
    stderr = (stderr + data.toString()).slice(-8192);
  });
  worker.stdout?.resume();
  let nextId = 0;
  let disposed = false;
  let exited = false;
  let fatal: Error | null = null;
  let disposal: Promise<void> | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const pending = new Map<
    number,
    {
      resolve: (value: DawnWorkerResponse) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const closed = new Promise<void>((resolve) =>
    worker.once("close", () => {
      exited = true;
      resolve();
    }),
  );
  const invalidate = (error: Error): void => {
    fatal ??= error;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  };
  worker.on("error", (error) => invalidate(error));
  worker.on("exit", (code, signal) => {
    exited = true;
    if (pending.size > 0 || !disposed)
      invalidate(
        new ApertureCliError(
          "aperture.dawn.workerExited",
          `Native renderer exited (${signal ?? code}). ${stderr}`,
        ),
      );
  });
  worker.on("message", (response: DawnWorkerResponse) => {
    const entry = pending.get(response.id);
    if (entry === undefined) return;
    clearTimeout(entry.timer);
    pending.delete(response.id);
    entry.resolve(response);
  });
  const terminate = async (): Promise<void> => {
    if (!exited) worker.kill("SIGKILL");
    await closed;
  };
  async function request(
    input:
      | Omit<Extract<DawnWorkerRequest, { kind: "initialize" }>, "id">
      | Omit<Extract<DawnWorkerRequest, { kind: "render" }>, "id">
      | { kind: "dispose" },
    timeoutMs = 60_000,
  ): Promise<DawnWorkerResponse> {
    if (fatal !== null) throw fatal;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new ApertureCliError(
        "aperture.render.invalidTimeout",
        "Render timeout must be positive and finite.",
      );
    const id = ++nextId;
    const result = new Promise<DawnWorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new ApertureCliError(
          "aperture.dawn.timeout",
          `Native renderer exceeded ${timeoutMs}ms; its worker was terminated.`,
        );
        invalidate(error);
        void terminate();
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      worker.send({ ...input, id }, (error) => {
        if (error !== null) invalidate(error);
      });
    });
    try {
      const response = await result;
      if (!response.ok)
        throw new ApertureCliError(response.code, response.error);
      return response;
    } catch (error) {
      if (fatal !== null) await terminate();
      throw error;
    }
  }
  let metadata: NodeDeviceMetadata;
  try {
    const initialized = await request({
      kind: "initialize",
      options: { ...options.native, adapter: policy } as NodeDeviceOptions,
    });
    metadata = (initialized as Extract<DawnWorkerResponse, { ok: true }>)
      .result as NodeDeviceMetadata;
  } catch (error) {
    await terminate();
    throw error;
  }
  return {
    backend: "dawn",
    dawn: metadata,
    render(renderOptions) {
      if (disposed)
        return Promise.reject(
          new ApertureCliError(
            "aperture.render.sessionDisposed",
            "This render session has been disposed; create a new one.",
          ),
        );
      const job = chain.then(async () => {
        const response = await request(
          { kind: "render", options: renderOptions },
          renderOptions.timeoutMs,
        );
        const result = (response as Extract<DawnWorkerResponse, { ok: true }>)
          .result as RenderBundleResult;
        return { ...result, png: Buffer.from(result.png) };
      });
      chain = job.catch(() => undefined);
      return job;
    },
    dispose() {
      if (disposal !== null) return disposal;
      disposed = true;
      disposal = (async () => {
        await chain;
        if (fatal !== null) {
          await terminate();
          return;
        }
        try {
          if (!exited) await request({ kind: "dispose" });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              closed,
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(
                      new ApertureCliError(
                        "aperture.dawn.shutdownTimeout",
                        "Dawn acknowledged disposal but its worker did not exit cleanly.",
                      ),
                    ),
                  10_000,
                );
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        } catch (error) {
          await terminate();
          throw error;
        }
      })();
      return disposal;
    },
  };
}
