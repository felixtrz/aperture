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
  type GeneratedDevtoolsStepInput,
} from "./devtools/bridge.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";
import {
  createGeneratedWorkerSnapshotTransport,
  createGeneratedWorkerSummaryCadence,
  publishGeneratedWorkerSnapshot,
  type GeneratedWorkerSnapshotPublishTiming,
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
    const workerFullSummaryIntervalMilliseconds =
      readWorkerFullSummaryIntervalMilliseconds(options.start);
    const workerSummaryCadence = createGeneratedWorkerSummaryCadence(
      workerFullSummaryIntervalMilliseconds === undefined
        ? {}
        : { intervalMilliseconds: workerFullSummaryIntervalMilliseconds },
    );
    let frame = 0;
    let running = true;
    let paused = readWorkerInitialPaused(options.start);
    let tickScheduled = false;
    let previousTime = performance.now();
    const pendingDevtoolsInput: ApertureGeneratedInputEvent[] = [];
    let previousPublishTiming: GeneratedWorkerSnapshotPublishTiming | null =
      null;
    const tickScheduler = createGeneratedWorkerTickScheduler({
      tickRateHz: readWorkerTickRateHz(options.start),
    });

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
        summaryCadence: workerSummaryCadence,
        delta,
        time,
        frame,
        previousPublishTiming,
      });
      frame = report.nextFrame;
      previousPublishTiming = report.timing;

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
        const wasPaused = paused;
        paused = nextPaused;
        if (wasPaused && !paused) {
          previousTime = performance.now();
          scheduleTick();
        }
      },
      step(input: GeneratedDevtoolsStepInput) {
        paused = true;
        const now = performance.now();
        previousTime = now;
        const report = publishSnapshot(input.delta, input.time ?? now / 1000);

        return {
          paused,
          frame,
          time: {
            delta: app.context.time.delta,
            elapsed: app.context.time.elapsed,
            frame: app.context.time.frame,
          },
          fixedStep: report.step.fixedStep,
          physics: app.context.physics.summary(),
        };
      },
      getSimulationState() {
        return { paused, running, frame };
      },
    });
    options.setApp(app, entityTools, devtools);

    const reportRuntimeFailure = (error: unknown): void => {
      const diagnostic = errorToApertureDiagnostic(error, {
        code: "aperture.generatedWorker.tickFailed",
        severity: "error",
        message:
          "Generated Aperture simulation worker threw during a frame tick.",
        suggestedFix:
          "Inspect the throwing app system or per-frame asset update, then restart the generated app.",
        source: { worker: "generated-simulation" },
      });

      options.port.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.error,
        reason: diagnostic.code,
        message: diagnostic.message,
        diagnostics: [diagnostic],
      });
    };

    function scheduleTick(): void {
      if (!running || paused || tickScheduled) {
        return;
      }

      tickScheduled = true;
      tickScheduler.schedule(tick);
    }

    function tick(): void {
      tickScheduled = false;
      if (!running) {
        tickScheduler.dispose();
        return;
      }

      try {
        if (paused) {
          return;
        }

        const now = performance.now();
        const delta = Math.max(0, (now - previousTime) / 1000);
        previousTime = now;

        publishSnapshot(delta, now / 1000);
      } catch (error: unknown) {
        // A steady-state tick failure is otherwise uncaught (the reschedule
        // below never runs and the scheduler callback swallows it), leaving the
        // simulation frozen with no signal. Halt the loop and surface the
        // failure to the main thread instead.
        running = false;
        tickScheduler.dispose();
        reportRuntimeFailure(error);
        return;
      }

      scheduleTick();
    }

    options.port.postMessage({ type: SIMULATION_WORKER_PROTOCOL.ready });
    if (!paused) {
      tick();
    }

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

export interface GeneratedWorkerTickScheduler {
  schedule(callback: () => void): void;
  dispose(): void;
}

export interface GeneratedWorkerTickSchedulerOptions {
  readonly tickRateHz?: number;
}

export const DEFAULT_GENERATED_WORKER_TICK_RATE_HZ = 240;
const MIN_GENERATED_WORKER_TICK_RATE_HZ = 1;
const MAX_GENERATED_WORKER_TICK_RATE_HZ = 1000;

export function createGeneratedWorkerTickScheduler(
  options: GeneratedWorkerTickSchedulerOptions = {},
): GeneratedWorkerTickScheduler {
  const tickRateHz = normalizeGeneratedWorkerTickRateHz(options.tickRateHz);
  const intervalMilliseconds = 1000 / tickRateHz;
  let nextTickMilliseconds = nowMilliseconds() + intervalMilliseconds;

  if (typeof MessageChannel === "function") {
    const channel = new MessageChannel();
    let pending: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    channel.port1.onmessage = () => {
      const callback = pending;

      pending = null;
      if (disposed || callback === null) {
        return;
      }

      nextTickMilliseconds = nextGeneratedWorkerTickDeadline(
        nextTickMilliseconds,
        intervalMilliseconds,
      );
      callback?.();
    };
    channel.port1.start?.();

    return {
      schedule(callback) {
        if (disposed) {
          return;
        }

        const delayMilliseconds = Math.max(
          0,
          nextTickMilliseconds - nowMilliseconds(),
        );
        const postCallback = () => {
          timeout = null;
          if (disposed) {
            return;
          }

          pending = callback;
          channel.port2.postMessage(null);
        };

        if (delayMilliseconds > 0.25) {
          timeout = setTimeout(postCallback, delayMilliseconds);
        } else {
          postCallback();
        }
      },
      dispose() {
        disposed = true;
        pending = null;
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
        channel.port1.close();
        channel.port2.close();
      },
    };
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule(callback) {
      const delayMilliseconds = Math.max(
        0,
        nextTickMilliseconds - nowMilliseconds(),
      );

      timeout = setTimeout(() => {
        timeout = null;
        nextTickMilliseconds = nextGeneratedWorkerTickDeadline(
          nextTickMilliseconds,
          intervalMilliseconds,
        );
        callback();
      }, delayMilliseconds);
    },
    dispose() {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  };
}

function nextGeneratedWorkerTickDeadline(
  previousDeadlineMilliseconds: number,
  intervalMilliseconds: number,
): number {
  const now = nowMilliseconds();
  const next = previousDeadlineMilliseconds + intervalMilliseconds;

  return now - next > intervalMilliseconds * 4
    ? now + intervalMilliseconds
    : next;
}

function readWorkerTickRateHz(start: SimulationWorkerStartOptions): number {
  return normalizeGeneratedWorkerTickRateHz(start["workerTickRateHz"]);
}

function readWorkerInitialPaused(start: SimulationWorkerStartOptions): boolean {
  const value = start["simulationPaused"];

  return value === true || value === "true";
}

function readWorkerFullSummaryIntervalMilliseconds(
  start: SimulationWorkerStartOptions,
): number | undefined {
  const value = start["workerFullSummaryIntervalMilliseconds"];

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
}

function normalizeGeneratedWorkerTickRateHz(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_GENERATED_WORKER_TICK_RATE_HZ;
  }

  return Math.min(
    MAX_GENERATED_WORKER_TICK_RATE_HZ,
    Math.max(MIN_GENERATED_WORKER_TICK_RATE_HZ, Math.floor(value)),
  );
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ||
    typeof performance.now !== "function"
    ? Date.now()
    : performance.now();
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
    ...(physics.colliderGeometry === undefined
      ? {}
      : { colliderGeometry: physics.colliderGeometry }),
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
