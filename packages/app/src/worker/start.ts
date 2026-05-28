import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { ApertureApp, ApertureSystemModule } from "../advanced.js";
import type { ApertureConfig } from "../config.js";
import {
  isApertureDevtoolsRequest,
  isGeneratedCommandMessage,
  type ApertureDevtoolsRequest,
  type ApertureGeneratedCommandMessage,
} from "../commands.js";
import {
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { applyGeneratedCommand } from "./commands.js";
import type { GeneratedDevtoolsBridge } from "./devtools/bridge.js";
import {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "./devtools/entities.js";
import { runGeneratedWorkerLoop } from "./loop.js";

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
  const pendingCommands: ApertureGeneratedCommandMessage[] = [];
  const pendingDevtools: ApertureDevtoolsRequest[] = [];
  let app: ApertureApp | null = null;
  let entityTools: GeneratedEntityToolBridge | null = null;
  let devtools: GeneratedDevtoolsBridge | null = null;

  port.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (isGeneratedInputEventMessage(message)) {
      pendingInput.push(message);
      return;
    }

    if (isGeneratedCommandMessage(message)) {
      if (app === null || entityTools === null) {
        pendingCommands.push(message);
      } else {
        applyGeneratedCommand(app, entityTools, message);
      }
      return;
    }

    if (isApertureDevtoolsRequest(message)) {
      if (devtools === null) {
        pendingDevtools.push(message);
      } else {
        devtools.handle(message);
      }
      return;
    }

    if (!isStartMessage(message)) {
      return;
    }

    void runGeneratedWorkerLoop({
      port,
      config: options.config,
      systems: options.systems,
      start: message,
      pendingInput,
      createEntityTools: createGeneratedEntityToolBridge,
      setApp(nextApp, nextEntityTools, nextDevtools) {
        app = nextApp;
        entityTools = nextEntityTools;
        devtools = nextDevtools;

        for (const pending of pendingCommands.splice(0)) {
          applyGeneratedCommand(nextApp, nextEntityTools, pending);
        }
        for (const pending of pendingDevtools.splice(0)) {
          nextDevtools.handle(pending);
        }
      },
    });
  });
  port.start?.();
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
