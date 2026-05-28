import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import { Camera } from "@aperture-engine/render";
import type { ApertureConfig } from "./config.js";
import { createApertureApp, type ApertureSystemModule } from "./advanced.js";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "./asset-mirror.js";
import {
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
  createApertureDevtoolsResponse,
  isApertureDevtoolsRequest,
  isGeneratedCommandMessage,
  type ApertureDevtoolsRequest,
  type ApertureGeneratedCommand,
  type ApertureGeneratedCommandMessage,
  type ApertureViewportResizeCommandPayload,
} from "./commands.js";
import { errorToApertureDiagnostic } from "./diagnostics.js";
import { createApertureEntityLookupSnapshot } from "./entity-lookup.js";
import {
  advanceGeneratedInputFrame,
  createInputSummary,
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "./input.js";
import {
  createSignalSummary,
  type SystemAssetHandle,
  type SystemAssetKind,
} from "./systems.js";
import type { ApertureApp } from "./advanced.js";
import { isRecord, numberFromValue } from "./worker-payload.js";
import {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "./worker-entity-tools.js";
import { callCameraTool, type CameraToolState } from "./worker-camera-tools.js";
import type { GeneratedDevtoolsToolResult } from "./worker-devtools-types.js";
import { callInputDevtoolsTool } from "./worker-input-tools.js";

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

    void runLoop({
      port,
      config: options.config,
      systems: options.systems,
      start: message,
      pendingInput,
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

async function runLoop(options: {
  readonly port: SimulationMessagePort;
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly start: SimulationWorkerStartOptions;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
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
    const entityTools = createGeneratedEntityToolBridge(app.lowLevel.world);
    const sourceAssetState = createSourceAssetSerializationState();
    let frame = 0;
    let running = true;
    let paused = false;
    let previousTime = performance.now();

    const publishSnapshot = (delta: number, time: number) => {
      advanceGeneratedInputFrame({
        signals: app.context.input,
        config: options.config,
        events: options.pendingInput.splice(0).map((message) => message.event),
      });
      const snapshot = app.stepAndExtract(delta, time, frame);

      options.port.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot,
        sourceAssets: serializeSourceAssetRegistry(app.lowLevel.assets, {
          state: sourceAssetState,
        }),
        workerSummary: {
          signals: createSignalSummary(app.context.signals),
          input: createInputSummary(app.context.input),
          assets: createAssetSummary(app.context.assets.list()),
          commands: app.context.commands.summary(),
          diagnostics: app.context.diagnostics.list(),
          entities: createApertureEntityLookupSnapshot(app.lowLevel.world, {
            label: "generated-worker",
          }),
          entityTools: entityTools.summary(),
        },
        frame,
      });
      frame += 1;
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

function applyGeneratedCommand(
  app: ApertureApp,
  entityTools: GeneratedEntityToolBridge,
  message: ApertureGeneratedCommandMessage,
): void {
  if (applyViewportResizeCommand(app, message.command)) {
    return;
  }

  if (entityTools.handle(message.command)) {
    return;
  }

  app.context.commands.queue(message.command.channel, message.command.payload);
}

function applyViewportResizeCommand(
  app: ApertureApp,
  command: ApertureGeneratedCommand,
): boolean {
  if (command.channel !== APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL) {
    return false;
  }

  const resize = viewportResizePayloadFromValue(command.payload);

  if (resize === null) {
    app.context.diagnostics.warn("aperture.viewportResize.invalidPayload", {
      channel: command.channel,
    });
    return true;
  }

  const query = app.lowLevel.world.queryManager.registerQuery({
    required: [Camera],
  });

  for (const entity of query.entities) {
    if (entity.getValue(Camera, "autoAspect") === false) {
      continue;
    }

    const renderTargetId = entity.getValue(Camera, "renderTargetId") ?? "";
    if (renderTargetId.length > 0) {
      continue;
    }

    const viewport = entity.getVectorView(Camera, "viewport");
    const viewportWidth = finitePositiveNumber(viewport[2]) ?? 1;
    const viewportHeight = finitePositiveNumber(viewport[3]) ?? 1;
    entity.setValue(
      Camera,
      "aspect",
      resize.aspect * (viewportWidth / viewportHeight),
    );
  }

  return true;
}

function viewportResizePayloadFromValue(
  value: unknown,
): ApertureViewportResizeCommandPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const width = finitePositiveNumber(value["width"]);
  const height = finitePositiveNumber(value["height"]);
  const displayWidth = finitePositiveNumber(value["displayWidth"]);
  const displayHeight = finitePositiveNumber(value["displayHeight"]);
  const pixelRatio = finitePositiveNumber(value["pixelRatio"]);
  const aspect = finitePositiveNumber(value["aspect"]);

  if (
    width === null ||
    height === null ||
    displayWidth === null ||
    displayHeight === null ||
    pixelRatio === null ||
    aspect === null
  ) {
    return null;
  }

  return {
    width,
    height,
    displayWidth,
    displayHeight,
    pixelRatio,
    aspect,
  };
}

function finitePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

interface GeneratedDevtoolsBridge {
  handle(request: ApertureDevtoolsRequest): void;
}

function createGeneratedDevtoolsBridge(options: {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly port: SimulationMessagePort;
  readonly setPaused: (paused: boolean) => void;
  readonly step: (delta: number) => Readonly<Record<string, unknown>>;
  readonly getSimulationState: () => Readonly<Record<string, unknown>>;
}): GeneratedDevtoolsBridge {
  const savedCameraStates = new Map<string, CameraToolState>();

  return {
    handle(request) {
      try {
        const result = callGeneratedDevtoolsTool(
          options,
          request,
          savedCameraStates,
        );

        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: result.ok,
            ...(Object.prototype.hasOwnProperty.call(result, "result")
              ? { result: result.result }
              : {}),
            ...(result.diagnostics === undefined
              ? {}
              : { diagnostics: result.diagnostics }),
          }),
        );
      } catch (error: unknown) {
        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: false,
            diagnostics: [
              {
                code: "aperture.devtools.toolFailed",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
                suggestedFix:
                  "Inspect the tool payload and generated worker diagnostics.",
              },
            ],
          }),
        );
      }
    },
  };
}

function callGeneratedDevtoolsTool(
  bridge: {
    readonly app: ApertureApp;
    readonly entityTools: GeneratedEntityToolBridge;
    readonly setPaused: (paused: boolean) => void;
    readonly step: (delta: number) => Readonly<Record<string, unknown>>;
    readonly getSimulationState: () => Readonly<Record<string, unknown>>;
  },
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
): GeneratedDevtoolsToolResult {
  if (request.tool === "ecs_pause") {
    bridge.setPaused(true);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_resume") {
    bridge.setPaused(false);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_step") {
    return {
      ok: true,
      result: bridge.step(devtoolsStepDelta(request.payload)),
    };
  }

  if (request.tool.startsWith("input_")) {
    const result = callInputDevtoolsTool(
      bridge.app,
      request.tool,
      request.payload,
    );

    if (result !== null) {
      return result;
    }
  }

  if (request.tool === "asset_list") {
    return {
      ok: true,
      result: {
        assets: createAssetSummary(bridge.app.context.assets.list()),
      },
    };
  }

  if (request.tool.startsWith("camera_")) {
    return callCameraTool(bridge.app, request, savedCameraStates);
  }

  return bridge.entityTools.call(request.tool, request.payload);
}

function devtoolsStepDelta(payload: unknown): number {
  const record = isRecord(payload) ? payload : {};
  const delta = numberFromValue(record["delta"]);

  return delta === undefined || delta < 0 ? 1 / 60 : delta;
}

function createAssetSummary(
  handles: readonly SystemAssetHandle<SystemAssetKind>[],
): readonly Record<string, unknown>[] {
  return handles.map((handle) => ({
    id: handle.id,
    kind: handle.kind,
    url: handle.url,
    preload: handle.preload,
    ready: handle.ready.value,
    error: handle.error.value,
  }));
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
