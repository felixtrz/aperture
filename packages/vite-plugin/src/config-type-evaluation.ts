import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const CONFIG_EVALUATION_TIMEOUT_MS = 30_000;
const CONFIG_TYPE_PROTOCOL = "aperture:config-type-metadata:v1";

// Keep this bootstrap independent of local module paths so it also works when
// a tool bundles the plugin. Only config metadata crosses the worker boundary:
// factories may contain callbacks, class instances, and non-cloneable signals.
// MessagePort framing is independent of any console output from the config.
const CONFIG_TYPE_WORKER = new URL(
  `data:text/javascript,${encodeURIComponent(`
    import { parentPort, workerData } from "node:worker_threads";
    const { configFile, token } = workerData;

    function respond(metadata) {
      parentPort.postMessage({ protocol: ${JSON.stringify(CONFIG_TYPE_PROTOCOL)}, token, metadata });
    }

    function descriptors(entries) {
      return Object.fromEntries(Object.entries(entries ?? {}).map(([name, entry]) => {
        const kind = entry?.kind;
        return [name, { kind: typeof kind === "string" ? kind : null }];
      }));
    }

    try {
      const { default: config } = await import(configFile);
      respond(typeof config === "object" && config !== null ? {
        input: { actions: descriptors(config.input?.actions) },
        signals: descriptors(config.signals),
      } : null);
    } catch {
      respond(null);
    }
  `)}`,
);

/**
 * Evaluate one config in a disposable module graph. Native ESM import caches
 * transitive dependencies (including failed imports); changing the root URL
 * cannot refresh them. A worker gives each invocation fresh ESM and CJS caches
 * without changing app/runtime singleton semantics or rewriting user imports.
 * This is execution isolation, not a security sandbox for untrusted configs.
 */
export async function evaluateConfigTypeMetadata(
  configFile: string,
): Promise<unknown> {
  const token = randomUUID();
  const worker = new Worker(CONFIG_TYPE_WORKER, {
    workerData: { configFile: pathToFileURL(configFile).href, token },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<unknown>((resolve) => {
      // Config dependencies may also use parentPort. Ignore their traffic;
      // only this bootstrap's correlated, well-formed response completes us.
      worker.on("message", (message: unknown) => {
        if (isConfigTypeResponse(message, token)) resolve(message.metadata);
      });
      worker.once("error", () => resolve(null));
      worker.once("exit", () => resolve(null));
      // A config can leave a top-level await pending or keep handles open.
      // Unavailable metadata retains the existing sibling/AST fallback.
      timer = setTimeout(() => resolve(null), CONFIG_EVALUATION_TIMEOUT_MS);
    });
  } finally {
    clearTimeout(timer);
    // Await termination even after success: user configs may leave timers or
    // other handles alive. No worker may outlive a completed generation.
    await worker.terminate();
    worker.removeAllListeners();
  }
}

function isConfigTypeResponse(
  message: unknown,
  token: string,
): message is { readonly metadata: unknown } {
  if (
    !isRecord(message) ||
    message["protocol"] !== CONFIG_TYPE_PROTOCOL ||
    message["token"] !== token ||
    !Object.hasOwn(message, "metadata")
  ) {
    return false;
  }
  const metadata = message["metadata"];
  return (
    metadata === null ||
    (isRecord(metadata) &&
      isRecord(metadata["input"]) &&
      isDescriptorRecord(metadata["input"]["actions"]) &&
      isDescriptorRecord(metadata["signals"]))
  );
}

function isDescriptorRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) &&
        (typeof entry["kind"] === "string" || entry["kind"] === null),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
