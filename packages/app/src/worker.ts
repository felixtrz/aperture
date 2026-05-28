import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
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
import {
  createApertureEntityLookupSnapshot,
  type ApertureEntityLookupDiagnostic,
} from "./entity-lookup.js";
import {
  advanceGeneratedInputFrame,
  applyGeneratedInputEvent,
  createInputSummary,
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "./input.js";
import {
  AppEntityKey,
  LocalTransform,
  Name,
  WorldTransform,
  createSignalSummary,
  type SystemAssetHandle,
  type SystemAssetKind,
} from "./systems.js";
import type { ApertureApp } from "./advanced.js";
import type { EcsEntityRef } from "./config.js";
import {
  booleanFromValue,
  degreesToRadians,
  gamepadAxesFromPayload,
  isRecord,
  jsonSafeRecord,
  numberFromValue,
  standardGamepadButtonIndex,
  stringFromValue,
  tuple3FromValue,
  tuple3FromView,
  tuple4FromValue,
  tuple4FromView,
} from "./worker-payload.js";
import {
  createGeneratedEntityToolBridge,
  entityRefFromValue,
  type GeneratedDevtoolsToolResult,
  type GeneratedEntityToolBridge,
} from "./worker-entity-tools.js";

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

  if (request.tool === "input_action_set") {
    return callInputActionTool(bridge.app, request.payload);
  }

  if (request.tool === "input_gamepad_set") {
    return callInputGamepadTool(bridge.app, request.payload);
  }

  if (request.tool === "input_get_state") {
    return {
      ok: true,
      result: createInputSummary(bridge.app.context.input),
    };
  }

  if (request.tool === "input_reset") {
    applyGeneratedInputEvent({
      signals: bridge.app.context.input,
      config: bridge.app.config,
      event: { kind: "reset", reason: "devtools" },
    });

    return {
      ok: true,
      result: createInputSummary(bridge.app.context.input),
    };
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

function callInputActionTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const actionName =
    stringFromValue(record["action"]) ?? stringFromValue(record["name"]);

  if (actionName === undefined) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.input.actionMissing",
          severity: "error",
          message: "input_action_set requires an action name.",
          data: jsonSafeRecord(record),
          suggestedFix:
            "Pass { action: '<name>', pressed: true } using an action from aperture.config.ts.",
        },
      ],
    };
  }

  const action = app.context.input.actions[actionName];
  if (action === undefined) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.input.actionNotFound",
          severity: "error",
          message: `Input action '${actionName}' is not defined in aperture.config.ts.`,
          data: {
            action: actionName,
            available: Object.keys(app.context.input.actions),
          },
          suggestedFix:
            "Use one of the configured input action names or add the action to aperture.config.ts.",
        },
      ],
    };
  }

  const value = numberFromValue(record["value"]);
  const pressed =
    booleanFromValue(record["pressed"]) ??
    (value === undefined && action.kind === "button" ? true : undefined);
  const x = numberFromValue(record["x"]);
  const y = numberFromValue(record["y"]);

  applyGeneratedInputEvent({
    signals: app.context.input,
    config: app.config,
    event: {
      kind: "virtualAction",
      action: actionName,
      source: "devtools",
      ...(pressed === undefined ? {} : { pressed }),
      ...(value === undefined ? {} : { value }),
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
    },
  });

  return {
    ok: true,
    result: {
      action: actionName,
      ...(action.kind === "button"
        ? {
            pressed: action.pressed.value,
            value: action.value.value ? 1 : 0,
          }
        : action.kind === "axis1d"
          ? { value: action.value.value }
          : { x: action.x.value, y: action.y.value }),
      input: createInputSummary(app.context.input),
    },
  };
}

function callInputGamepadTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const index = Math.max(0, Math.floor(numberFromValue(record["index"]) ?? 0));
  const mapping = stringFromValue(record["mapping"]) ?? "standard";
  const buttons = Array.from({ length: 17 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));
  const button = stringFromValue(record["button"]);

  if (button !== undefined) {
    const buttonIndex = standardGamepadButtonIndex(button);

    if (buttonIndex === null) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.input.unsupportedGamepadButton",
            severity: "error",
            message: `Unsupported standard gamepad button '${button}'.`,
            data: { button },
            suggestedFix:
              "Use a standard gamepad button such as south, east, west, north, leftBumper, rightBumper, select, start, or dpadUp.",
          },
        ],
      };
    }

    const value = numberFromValue(record["value"]);
    const pressed =
      booleanFromValue(record["pressed"]) ??
      (value === undefined ? true : value > 0);

    buttons[buttonIndex] = {
      pressed,
      touched: booleanFromValue(record["touched"]) ?? pressed,
      value: value ?? (pressed ? 1 : 0),
    };
  }

  applyGeneratedInputEvent({
    signals: app.context.input,
    config: app.config,
    event: {
      kind: "gamepad",
      replace: false,
      gamepads: [
        {
          index,
          id: stringFromValue(record["id"]) ?? `devtools-gamepad-${index}`,
          mapping,
          connected: booleanFromValue(record["connected"]) ?? true,
          buttons,
          axes: gamepadAxesFromPayload(record),
        },
      ],
    },
  });

  const summary = createInputSummary(app.context.input);

  return {
    ok: summary.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    result: {
      index,
      input: summary,
    },
    diagnostics: summary.diagnostics,
  };
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

interface CameraToolState {
  readonly entity: EcsEntityRef;
  readonly camera: Readonly<Record<string, unknown>>;
  readonly localTransform: {
    readonly translation: readonly [number, number, number];
    readonly rotation: readonly [number, number, number, number];
    readonly scale: readonly [number, number, number];
  } | null;
}

function callCameraTool(
  app: ApertureApp,
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
): GeneratedDevtoolsToolResult {
  const payload = isRecord(request.payload) ? request.payload : {};

  if (request.tool === "camera_list") {
    return {
      ok: true,
      result: cameraEntities(app.lowLevel.world).map(cameraSummary),
    };
  }

  if (request.tool === "camera_create_agent") {
    const key = stringFromValue(payload["key"]) ?? "camera.agent";
    const existing = cameraEntityByKey(app.lowLevel.world, key);
    const entity =
      existing ??
      app.context.spawn.camera({
        key,
        name: "Agent Camera",
        transform: {
          translation: tuple3FromValue(payload["translation"]) ?? [0, 1.5, 5],
          lookAt: tuple3FromValue(payload["lookAt"]) ?? [0, 0, 0],
        },
        camera: {
          priority: 10_000,
          clearColor: [0.03, 0.035, 0.04, 1],
        },
      });

    return { ok: true, result: cameraSummary(entity) };
  }

  const entity = resolveCameraEntity(app.lowLevel.world, payload);
  if (entity === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.notFound",
          severity: "error",
          message: "No matching camera entity was found.",
          data: jsonSafeRecord(payload),
          suggestedFix:
            "Pass a camera key/entity reference, or call camera_create_agent first.",
        },
      ],
    };
  }

  if (request.tool === "camera_get") {
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_save") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = cameraState(entity);
    savedCameraStates.set(slot, state);

    return { ok: true, result: { slot, state } };
  }

  if (request.tool === "camera_restore") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = savedCameraStates.get(slot);

    if (state === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.savedStateMissing",
            severity: "error",
            message: `No saved camera state exists in slot '${slot}'.`,
            data: { slot },
            suggestedFix: "Call camera_save before camera_restore.",
          },
        ],
      };
    }

    restoreCameraState(entity, state);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_set_transform") {
    setCameraTransform(entity, payload);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_look_at") {
    const translation = tuple3FromValue(payload["translation"]) ??
      cameraState(entity).localTransform?.translation ?? [0, 1.5, 5];
    const target = tuple3FromValue(payload["target"]) ?? [0, 0, 0];
    setCameraTransform(entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_orbit" || request.tool === "camera_fit_entity") {
    const targetReport =
      request.tool === "camera_fit_entity"
        ? cameraFitTarget(app.lowLevel.world, payload)
        : {
            ok: true as const,
            target: cameraOrbitTarget(app.lowLevel.world, payload),
          };

    if (!targetReport.ok) {
      return targetReport;
    }

    const target = targetReport.target;
    const radius = numberFromValue(payload["radius"]) ?? 5;
    const yaw = degreesToRadians(numberFromValue(payload["yawDegrees"]) ?? 35);
    const pitch = degreesToRadians(
      numberFromValue(payload["pitchDegrees"]) ?? 20,
    );
    const translation = orbitPosition(target, radius, yaw, pitch);

    setCameraTransform(entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_use_agent_view") {
    entity.setValue(Camera, "priority", 10_000);
    entity.setValue(Camera, "renderTargetId", "");
    entity.getVectorView(Camera, "viewport").set([0, 0, 1, 1]);
    entity.getVectorView(Camera, "scissor").set([0, 0, 1, 1]);
    return { ok: true, result: cameraSummary(entity) };
  }

  return {
    ok: false,
    diagnostics: [
      {
        code: "aperture.camera.unsupportedTool",
        severity: "error",
        message: `Unsupported camera tool '${request.tool}'.`,
        data: { tool: request.tool },
        suggestedFix: "Use one of the registered Aperture camera tools.",
      },
    ],
  };
}

function cameraEntities(world: EcsWorld): Entity[] {
  return [...world.queryManager.registerQuery({ required: [Camera] }).entities]
    .filter((entity) => entity.active)
    .sort((a, b) => a.index - b.index || a.generation - b.generation);
}

function cameraEntityByKey(world: EcsWorld, key: string): Entity | null {
  return (
    cameraEntities(world).find(
      (entity) =>
        entity.hasComponent(AppEntityKey) &&
        entity.getValue(AppEntityKey, "value") === key,
    ) ?? null
  );
}

function resolveCameraEntity(
  world: EcsWorld,
  payload: Record<string, unknown>,
): Entity | null {
  const key = stringFromValue(payload["key"]);
  if (key !== undefined) {
    return cameraEntityByKey(world, key);
  }

  const ref = entityRefFromValue(payload["entity"] ?? payload);
  if (ref !== null) {
    const entity = world.entityManager.getEntityByIndex(ref.index);
    return entity !== null &&
      entity.active &&
      entity.generation === ref.generation &&
      entity.hasComponent(Camera)
      ? entity
      : null;
  }

  return cameraEntities(world)[0] ?? null;
}

function cameraSummary(entity: Entity): Readonly<Record<string, unknown>> {
  return {
    entity: { index: entity.index, generation: entity.generation },
    key: entity.hasComponent(AppEntityKey)
      ? entity.getValue(AppEntityKey, "value")
      : null,
    name: entity.hasComponent(Name)
      ? entity.getValue(Name, "value")
      : `Camera ${entity.index}`,
    camera: cameraComponentState(entity),
    localTransform: entity.hasComponent(LocalTransform)
      ? {
          translation: tuple3FromView(
            entity.getVectorView(LocalTransform, "translation"),
          ),
          rotation: tuple4FromView(
            entity.getVectorView(LocalTransform, "rotation"),
          ),
          scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
        }
      : null,
    worldTransform: entity.hasComponent(WorldTransform)
      ? {
          col0: tuple4FromView(entity.getVectorView(WorldTransform, "col0")),
          col1: tuple4FromView(entity.getVectorView(WorldTransform, "col1")),
          col2: tuple4FromView(entity.getVectorView(WorldTransform, "col2")),
          col3: tuple4FromView(entity.getVectorView(WorldTransform, "col3")),
        }
      : null,
  };
}

function cameraState(entity: Entity): CameraToolState {
  return {
    entity: { index: entity.index, generation: entity.generation },
    camera: cameraComponentState(entity),
    localTransform: entity.hasComponent(LocalTransform)
      ? {
          translation: tuple3FromView(
            entity.getVectorView(LocalTransform, "translation"),
          ),
          rotation: tuple4FromView(
            entity.getVectorView(LocalTransform, "rotation"),
          ),
          scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
        }
      : null,
  };
}

function cameraComponentState(
  entity: Entity,
): Readonly<Record<string, unknown>> {
  const fields: Record<string, unknown> = {};

  for (const field of Object.keys(Camera.schema)) {
    if (field === "viewport" || field === "scissor" || field === "clearColor") {
      fields[field] = tuple4FromView(
        entity.getVectorView(Camera, field as "viewport"),
      );
      continue;
    }

    fields[field] = entity.getValue(Camera, field as never);
  }

  return fields;
}

function restoreCameraState(entity: Entity, state: CameraToolState): void {
  for (const [field, value] of Object.entries(state.camera)) {
    if (field === "viewport" || field === "scissor" || field === "clearColor") {
      if (Array.isArray(value)) {
        entity.getVectorView(Camera, field as "viewport").set(value);
      }
      continue;
    }

    entity.setValue(Camera, field as never, value as never);
  }

  if (state.localTransform !== null) {
    setCameraTransform(entity, state.localTransform);
  }
}

function setCameraTransform(
  entity: Entity,
  payload: Record<string, unknown>,
): void {
  if (!entity.hasComponent(LocalTransform)) {
    entity.addComponent(LocalTransform);
  }

  const translation = tuple3FromValue(payload["translation"]);
  const rotation = tuple4FromValue(payload["rotation"]);
  const scale = tuple3FromValue(payload["scale"]);

  if (translation !== null) {
    entity.getVectorView(LocalTransform, "translation").set(translation);
  }
  if (rotation !== null) {
    entity.getVectorView(LocalTransform, "rotation").set(rotation);
  }
  if (scale !== null) {
    entity.getVectorView(LocalTransform, "scale").set(scale);
  }
}

function cameraOrbitTarget(
  world: EcsWorld,
  payload: Record<string, unknown>,
): readonly [number, number, number] {
  const explicit = tuple3FromValue(payload["target"]);
  if (explicit !== null) {
    return explicit;
  }

  const entity = entityRefFromValue(payload["entity"]);
  if (entity !== null) {
    const target = world.entityManager.getEntityByIndex(entity.index);
    if (
      target !== null &&
      target.active &&
      target.generation === entity.generation &&
      target.hasComponent(WorldTransform)
    ) {
      const col3 = target.getVectorView(WorldTransform, "col3");
      return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
    }
  }

  return [0, 0, 0];
}

function cameraFitTarget(
  world: EcsWorld,
  payload: Record<string, unknown>,
):
  | { readonly ok: true; readonly target: readonly [number, number, number] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
    } {
  const explicit = tuple3FromValue(payload["target"]);
  if (explicit !== null) {
    return { ok: true, target: explicit };
  }

  const ref = entityRefFromValue(payload["entity"]);
  if (ref === null) {
    return { ok: true, target: [0, 0, 0] };
  }

  const entity = world.entityManager.getEntityByIndex(ref.index);
  if (
    entity === null ||
    !entity.active ||
    entity.generation !== ref.generation
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.targetNotFound",
          severity: "error",
          message: "The requested camera fit target entity was not found.",
          data: { entity: ref },
          suggestedFix:
            "Call ecs_find_entities first, then pass a current entity reference to camera_fit_entity.",
        },
      ],
    };
  }

  if (!entity.hasComponent(WorldTransform)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.targetMissingWorldTransform",
          severity: "error",
          message:
            "The requested camera fit target does not have a WorldTransform component.",
          data: { entity: ref },
          suggestedFix:
            "Fit an entity with transform data, or pass an explicit target vector.",
        },
      ],
    };
  }

  const col3 = entity.getVectorView(WorldTransform, "col3");
  return { ok: true, target: [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0] };
}

function orbitPosition(
  target: readonly [number, number, number],
  radius: number,
  yaw: number,
  pitch: number,
): readonly [number, number, number] {
  const clampedRadius = Math.max(0.1, radius);
  const x = target[0] + clampedRadius * Math.cos(pitch) * Math.sin(yaw);
  const y = target[1] + clampedRadius * Math.sin(pitch);
  const z = target[2] + clampedRadius * Math.cos(pitch) * Math.cos(yaw);

  return [x, y, z];
}

function quatLookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
): readonly [number, number, number, number] {
  const dx = target[0] - eye[0];
  const dy = target[1] - eye[1];
  const dz = target[2] - eye[2];
  const yaw = Math.atan2(dx, dz);
  const distance = Math.max(0.0001, Math.hypot(dx, dz));
  const pitch = -Math.atan2(dy, distance);

  return quatFromEuler(pitch, yaw, 0);
}

function quatFromEuler(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number, number] {
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
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
