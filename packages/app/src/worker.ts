import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { ApertureConfig } from "./config.js";
import { createApertureApp, type ApertureSystemModule } from "./advanced.js";
import { serializeSourceAssetRegistry } from "./asset-mirror.js";
import { createApertureEntityLookupSnapshot } from "./entity-lookup.js";
import {
  applyGeneratedInputEvent,
  createInputSummary,
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "./input.js";
import type { ApertureApp } from "./advanced.js";

export interface StartGeneratedSimulationWorkerOptions {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly port?: SimulationMessagePort;
}

export function startGeneratedSimulationWorker(
  options: StartGeneratedSimulationWorkerOptions,
): void {
  if (options.port === undefined) {
    waitForWorkerPort((port) => {
      attachWorkerPort({ ...options, port });
    });
    return;
  }

  attachWorkerPort({ ...options, port: options.port });
}

function attachWorkerPort(
  options: StartGeneratedSimulationWorkerOptions & {
    readonly port: SimulationMessagePort;
  },
): void {
  const port = options.port;
  const pendingInput: ApertureGeneratedInputEventMessage[] = [];
  let app: ApertureApp | null = null;

  port.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (isGeneratedInputEventMessage(message)) {
      if (app === null) {
        pendingInput.push(message);
      } else {
        applyGeneratedInputEvent({
          signals: app.context.input,
          config: options.config,
          event: message.event,
        });
      }
      return;
    }

    if (!isStartMessage(message)) {
      return;
    }

    void runLoop({
      port,
      config: options.config,
      systems: options.systems,
      start: message,
      setApp(nextApp) {
        app = nextApp;

        for (const pending of pendingInput.splice(0)) {
          applyGeneratedInputEvent({
            signals: nextApp.context.input,
            config: options.config,
            event: pending.event,
          });
        }
      },
    });
  });
  port.start?.();
}

async function runLoop(options: {
  readonly port: SimulationMessagePort;
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly start: SimulationWorkerStartOptions;
  readonly setApp: (app: ApertureApp) => void;
}): Promise<void> {
  try {
    const app = await createApertureApp({
      config: options.config,
      systems: options.systems,
      worldOptions:
        options.start.entityCapacity === undefined
          ? undefined
          : { entityCapacity: options.start.entityCapacity },
    });
    options.setApp(app);
    let frame = 0;
    let running = true;
    let previousTime = performance.now();

    const tick = () => {
      if (!running) {
        return;
      }

      const now = performance.now();
      const delta = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      const snapshot = app.stepAndExtract(delta, now / 1000, frame);

      options.port.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot,
        sourceAssets: serializeSourceAssetRegistry(app.lowLevel.assets),
        workerSummary: {
          input: createInputSummary(app.context.input),
          diagnostics: app.context.diagnostics.list(),
          entities: createApertureEntityLookupSnapshot(app.lowLevel.world, {
            label: "generated-worker",
          }),
        },
        frame,
      });
      frame += 1;
      setTimeout(tick, 0);
    };

    options.port.postMessage({ type: SIMULATION_WORKER_PROTOCOL.ready });
    tick();

    if (typeof options.start["stop"] === "boolean" && options.start["stop"]) {
      running = false;
    }
  } catch (error: unknown) {
    options.port.postMessage({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: "aperture.generatedWorker.failed",
      message:
        error instanceof Error
          ? error.message
          : "Generated Aperture simulation worker failed.",
    });
  }
}

function waitForWorkerPort(
  callback: (port: SimulationMessagePort) => void,
): void {
  const workerScope = globalThis as unknown as {
    addEventListener(
      type: "message",
      listener: (event: MessageEvent<unknown>) => void,
    ): void;
  };

  workerScope.addEventListener("message", (event) => {
    const message = event.data;
    if (
      typeof message === "object" &&
      message !== null &&
      (message as { readonly type?: unknown }).type ===
        SIMULATION_WORKER_PROTOCOL.connect
    ) {
      const port =
        (message as { readonly port?: SimulationMessagePort }).port ?? null;

      if (port !== null) {
        port.start?.();
        callback(port);
      }
    }
  });
}

function isStartMessage(value: unknown): value is SimulationWorkerStartOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.start
  );
}
