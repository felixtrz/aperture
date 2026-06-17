import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationWorkerFixedStepOptions,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { Ktx2TextureCompressionSupport } from "@aperture-engine/render";
import {
  createApertureApp,
  type ApertureApp,
  type CreateApertureAppOptions,
} from "../advanced.js";
import type { AperturePhysicsAppConfig } from "../config.js";
import { createDefaultSystemGltfAssetDecoderProvider } from "../systems.js";
import { createSourceAssetSerializationState } from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { errorToApertureDiagnostic } from "../diagnostics.js";
import type {
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputEventMessage,
} from "../input.js";
import type { ApertureSystemModule } from "../advanced.js";
import {
  createGeneratedDevtoolsBridge,
  type GeneratedDevtoolsBridge,
} from "./devtools/bridge.js";
import type { GeneratedEntityToolBridge } from "./devtools/entities.js";
import {
  createGeneratedWorkerSnapshotTransport,
  publishGeneratedWorkerSnapshot,
  type GeneratedWorkerSnapshotPublishReport,
} from "./snapshot.js";

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
    const workerAssetDecoders = readWorkerAssetDecoderOptions(options.start);
    const fixedStep = readWorkerFixedStepOptions(options.start);
    const physicsInterpolation = readWorkerPhysicsInterpolationOption(
      options.start,
    );
    const snapshotTransport = createGeneratedWorkerSnapshotTransport(
      options.start,
    );
    const decoderBaseUrl =
      workerAssetDecoders?.baseUrl ?? options.config.assetDecoders?.baseUrl;
    const physicsOption = resolveConfigPhysicsOption(options.config.physics);
    const app = await createApertureApp({
      config: options.config,
      systems: options.systems,
      gltfAssetDecoders: createDefaultSystemGltfAssetDecoderProvider({
        ...(decoderBaseUrl === undefined ? {} : { baseUrl: decoderBaseUrl }),
        ...(workerAssetDecoders?.ktx2TextureCompression === undefined
          ? {}
          : {
              ktx2TextureCompression:
                workerAssetDecoders.ktx2TextureCompression,
            }),
      }),
      worldOptions:
        options.start.entityCapacity === undefined
          ? undefined
          : { entityCapacity: options.start.entityCapacity },
      ...(fixedStep === undefined ? {} : { fixedStep }),
      ...(physicsInterpolation === undefined ? {} : { physicsInterpolation }),
      ...(physicsOption === undefined ? {} : { physics: physicsOption }),
      startOptions: options.start,
    });
    // Legacy bridge: keep the raw `start` options visible on world globals for
    // older apps. New app systems should use the filtered public
    // `this.startOptions` accessor installed on ApertureSystemContext.
    publishWorkerStartOptions(app.lowLevel.world, options.start);
    const entityTools = options.createEntityTools(app.lowLevel.world);
    const sourceAssetState = createSourceAssetSerializationState();
    let frame = 0;
    let running = true;
    let paused = false;
    let previousTime = performance.now();
    const pendingDevtoolsInput: ApertureGeneratedInputEvent[] = [];

    const publishSnapshot = (
      delta: number,
      time: number,
    ): GeneratedWorkerSnapshotPublishReport => {
      const immediateInputEvents = pendingDevtoolsInput.splice(0);
      const report = publishGeneratedWorkerSnapshot({
        app,
        config: options.config,
        port: options.port,
        transport: snapshotTransport,
        pendingInput: options.pendingInput,
        immediateInputEvents,
        sourceAssetState,
        entityTools,
        delta,
        time,
        frame,
      });
      frame = report.nextFrame;

      return report;
    };
    const devtools = createGeneratedDevtoolsBridge({
      app,
      entityTools,
      port: options.port,
      enqueueInputEvent(event) {
        pendingDevtoolsInput.push(event);
      },
      setPaused(nextPaused) {
        paused = nextPaused;
      },
      step(delta) {
        paused = true;
        const now = performance.now();
        previousTime = now;
        const report = publishSnapshot(delta, now / 1000);

        return {
          paused,
          frame,
          fixedStep: report.step.fixedStep,
          physics: app.context.physics.summary(),
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

/**
 * Legacy globals key under which raw simulation-worker start options are
 * published on the ECS world. Prefer `this.startOptions` in app systems; this
 * remains for old callers that reached into world globals directly.
 */
export const APERTURE_WORKER_START_OPTIONS_KEY = "aperture.workerStartOptions";

function publishWorkerStartOptions(
  world: ApertureApp["lowLevel"]["world"],
  start: SimulationWorkerStartOptions,
): void {
  const globals = (world as { globals?: Record<string, unknown> }).globals;
  if (globals !== undefined) {
    globals[APERTURE_WORKER_START_OPTIONS_KEY] = start;
  }
}

interface WorkerAssetDecoderOptions {
  readonly baseUrl?: string;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}

type WorkerFixedStepOptions = false | SimulationWorkerFixedStepOptions;

interface MutableWorkerFixedStepOptions {
  enabled?: boolean;
  fixedDelta?: number;
  maxSubsteps?: number;
  maxAccumulatedTime?: number;
}

function readWorkerFixedStepOptions(
  start: SimulationWorkerStartOptions,
): WorkerFixedStepOptions | undefined {
  const value = start.fixedStep;

  if (value === undefined) {
    return undefined;
  }

  if (value === false) {
    return false;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const fixedStep: MutableWorkerFixedStepOptions = {};

  copyBooleanOption(record, fixedStep, "enabled");
  copyNumberOption(record, fixedStep, "fixedDelta");
  copyNumberOption(record, fixedStep, "maxSubsteps");
  copyNumberOption(record, fixedStep, "maxAccumulatedTime");

  return fixedStep;
}

function resolveConfigPhysicsOption(
  physics: boolean | AperturePhysicsAppConfig | undefined,
): CreateApertureAppOptions["physics"] {
  if (physics === undefined || physics === false) {
    return undefined;
  }

  if (physics === true) {
    return true;
  }

  if (physics.enabled === false) {
    return undefined;
  }

  return {
    ...(physics.backend === undefined ? {} : { backend: physics.backend }),
    ...(physics.gravity === undefined ? {} : { gravity: physics.gravity }),
  };
}

function readWorkerPhysicsInterpolationOption(
  start: SimulationWorkerStartOptions,
): boolean | undefined {
  const value = start.physicsInterpolation;

  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const enabled = (value as Record<string, unknown>)["enabled"];

  return typeof enabled === "boolean" ? enabled : undefined;
}

function copyBooleanOption(
  source: Record<string, unknown>,
  target: MutableWorkerFixedStepOptions,
  key: "enabled",
): void {
  const value = source[key];

  if (typeof value === "boolean") {
    target[key] = value;
  }
}

function copyNumberOption(
  source: Record<string, unknown>,
  target: MutableWorkerFixedStepOptions,
  key: "fixedDelta" | "maxSubsteps" | "maxAccumulatedTime",
): void {
  const value = source[key];

  if (typeof value === "number") {
    target[key] = value;
  }
}

function readWorkerAssetDecoderOptions(
  start: SimulationWorkerStartOptions,
): WorkerAssetDecoderOptions | null {
  const value = start.assetDecoders;

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const baseUrl =
    typeof record.baseUrl === "string" && record.baseUrl.trim().length > 0
      ? record.baseUrl
      : undefined;
  const ktx2TextureCompression = readKtx2TextureCompressionSupport(
    record.ktx2TextureCompression,
  );

  return {
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(ktx2TextureCompression === null ? {} : { ktx2TextureCompression }),
  };
}

function readKtx2TextureCompressionSupport(
  value: unknown,
): Ktx2TextureCompressionSupport | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    astc: record.astc === true,
    bc: record.bc === true,
    etc2: record.etc2 === true,
  };
}
