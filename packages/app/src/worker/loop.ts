import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import { createApertureApp, type ApertureApp } from "../advanced.js";
import {
  createSourceAssetSerializationState,
  type SourceAssetSerializationState,
} from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { errorToApertureDiagnostic } from "../diagnostics.js";
import type { ApertureGeneratedInputEventMessage } from "../input.js";
import type { ApertureSystemModule } from "../advanced.js";
import {
  createGeneratedDevtoolsBridge,
  type GeneratedDevtoolsBridge,
} from "./devtools/bridge.js";
import type { GeneratedEntityToolBridge } from "./devtools/entities.js";
import { publishGeneratedWorkerSnapshot } from "./snapshot.js";

export async function runGeneratedWorkerLoop(options: {
  readonly port: SimulationMessagePort;
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly start: SimulationWorkerStartOptions;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
  readonly createEntityTools: (
    world: ApertureApp["lowLevel"]["world"],
  ) => GeneratedEntityToolBridge;
  readonly setApp: (
    app: ApertureApp,
    entityTools: GeneratedEntityToolBridge,
    devtools: GeneratedDevtoolsBridge,
  ) => void;
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
    const entityTools = options.createEntityTools(app.lowLevel.world);
    const sourceAssetState = createSourceAssetSerializationState();
    let frame = 0;
    let running = true;
    let paused = false;
    let previousTime = performance.now();

    const publishSnapshot = (delta: number, time: number) => {
      frame = publishGeneratedWorkerSnapshot({
        app,
        config: options.config,
        port: options.port,
        pendingInput: options.pendingInput,
        sourceAssetState,
        entityTools,
        delta,
        time,
        frame,
      });
    };
    const devtools = createGeneratedDevtoolsBridge({
      app,
      entityTools,
      port: options.port,
      setPaused(nextPaused) {
        paused = nextPaused;
      },
      step(delta) {
        paused = true;
        const now = performance.now();
        previousTime = now;
        publishSnapshot(delta, now / 1000);

        return {
          paused,
          frame,
        };
      },
      getSimulationState() {
        return { paused, running, frame };
      },
    });
    options.setApp(app, entityTools, devtools);

    const tick = () => {
      if (!running) {
        return;
      }

      const now = performance.now();
      const delta = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;

      if (!paused) {
        publishSnapshot(delta, now / 1000);
      }

      setTimeout(tick, 0);
    };

    options.port.postMessage({ type: SIMULATION_WORKER_PROTOCOL.ready });
    tick();

    if (typeof options.start["stop"] === "boolean" && options.start["stop"]) {
      running = false;
    }
  } catch (error: unknown) {
    const diagnostic = errorToApertureDiagnostic(error, {
      code: "aperture.generatedWorker.failed",
      severity: "error",
      message: "Generated Aperture simulation worker failed during startup.",
      suggestedFix:
        "Inspect aperture.config.ts and discovered system modules, then restart the generated app.",
      source: { worker: "generated-simulation" },
    });

    options.port.postMessage({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: diagnostic.code,
      message: diagnostic.message,
      diagnostics: [diagnostic],
    });
  }
}

export type GeneratedWorkerSourceAssetState = SourceAssetSerializationState;
