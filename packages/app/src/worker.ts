import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { EcsWorld } from "@aperture-engine/simulation";
import { Camera } from "@aperture-engine/render";
import type { ApertureConfig } from "./config.js";
import { createApertureApp, type ApertureSystemModule } from "./advanced.js";
import { serializeSourceAssetRegistry } from "./asset-mirror.js";
import {
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
  APERTURE_ENTITY_DIFF_COMMAND_CHANNEL,
  APERTURE_ENTITY_FIND_COMMAND_CHANNEL,
  APERTURE_ENTITY_GET_COMMAND_CHANNEL,
  APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL,
  isGeneratedCommandMessage,
  type ApertureGeneratedCommand,
  type ApertureGeneratedCommandMessage,
  type ApertureViewportResizeCommandPayload,
} from "./commands.js";
import { errorToApertureDiagnostic } from "./diagnostics.js";
import {
  createApertureEntityLookupSnapshot,
  diffApertureEntityLookupSnapshots,
  findApertureEntities,
  getApertureEntitySummary,
  setApertureEntityComponentField,
  type ApertureEntityLookupDiagnostic,
  type ApertureEntityLookupSnapshot,
  type ApertureEntityLookupSnapshotOptions,
  type ApertureEntityFindQuery,
  type ApertureEntityFindReport,
  type ApertureEntityGetReport,
  type ApertureEntitySetComponentFieldReport,
  type ApertureEntitySetComponentFieldRequest,
  type ApertureEntitySnapshotDiff,
} from "./entity-lookup.js";
import {
  applyGeneratedInputEvent,
  createInputSummary,
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "./input.js";
import { createSignalSummary } from "./systems.js";
import type { ApertureApp } from "./advanced.js";
import type { EcsEntityRef } from "./config.js";

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
  let app: ApertureApp | null = null;
  let entityTools: GeneratedEntityToolBridge | null = null;

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

    if (isGeneratedCommandMessage(message)) {
      if (app === null || entityTools === null) {
        pendingCommands.push(message);
      } else {
        applyGeneratedCommand(app, entityTools, message);
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
      setApp(nextApp, nextEntityTools) {
        app = nextApp;
        entityTools = nextEntityTools;

        for (const pending of pendingInput.splice(0)) {
          applyGeneratedInputEvent({
            signals: nextApp.context.input,
            config: options.config,
            event: pending.event,
          });
        }
        for (const pending of pendingCommands.splice(0)) {
          applyGeneratedCommand(nextApp, nextEntityTools, pending);
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
  readonly setApp: (
    app: ApertureApp,
    entityTools: GeneratedEntityToolBridge,
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
    options.setApp(app, entityTools);
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
          signals: createSignalSummary(app.context.signals),
          input: createInputSummary(app.context.input),
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

interface GeneratedEntityToolRequest {
  readonly channel: string;
  readonly payload: unknown;
}

interface GeneratedEntityToolStatus {
  readonly finds: number;
  readonly gets: number;
  readonly mutations: number;
  readonly snapshots: number;
  readonly diffs: number;
  readonly lastRequest: GeneratedEntityToolRequest | null;
  readonly lastFind: ApertureEntityFindReport | null;
  readonly lastGet: ApertureEntityGetReport | null;
  readonly lastMutation: ApertureEntitySetComponentFieldReport | null;
  readonly lastSnapshot: ApertureEntityLookupSnapshot | null;
  readonly lastDiff: ApertureEntitySnapshotDiff | null;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

interface GeneratedEntityToolBridge {
  handle(command: ApertureGeneratedCommand): boolean;
  summary(): GeneratedEntityToolStatus;
}

function createGeneratedEntityToolBridge(
  world: EcsWorld,
): GeneratedEntityToolBridge {
  let finds = 0;
  let gets = 0;
  let mutations = 0;
  let snapshots = 0;
  let diffs = 0;
  let lastRequest: GeneratedEntityToolRequest | null = null;
  let lastFind: ApertureEntityFindReport | null = null;
  let lastGet: ApertureEntityGetReport | null = null;
  let lastMutation: ApertureEntitySetComponentFieldReport | null = null;
  let lastSnapshot: ApertureEntityLookupSnapshot | null = null;
  let lastDiff: ApertureEntitySnapshotDiff | null = null;
  let diagnostics: readonly ApertureEntityLookupDiagnostic[] = [];

  return {
    handle(command) {
      if (command.channel === APERTURE_ENTITY_FIND_COMMAND_CHANNEL) {
        const report = findApertureEntities(
          world,
          findQueryFromPayload(command.payload, 50),
        );

        finds += 1;
        lastRequest = entityToolRequest(command);
        lastFind = report;
        diagnostics = report.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_GET_COMMAND_CHANNEL) {
        const ref = entityRefFromPayload(command.payload, lastFind, lastGet);
        const report =
          ref === null
            ? {
                ok: false as const,
                diagnostic: missingEntityRefDiagnostic(command.channel),
              }
            : getApertureEntitySummary(world, ref);

        gets += 1;
        lastRequest = entityToolRequest(command);
        lastGet = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return true;
      }

      if (command.channel === APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL) {
        const request = setComponentRequestFromPayload(
          command.payload,
          lastFind,
          lastGet,
        );
        const report =
          "diagnostic" in request
            ? {
                ok: false as const,
                diagnostic: request.diagnostic,
              }
            : setApertureEntityComponentField(world, request);

        mutations += 1;
        lastRequest = entityToolRequest(command);
        lastMutation = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return true;
      }

      if (command.channel === APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL) {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-snapshot-${snapshots + 1}`,
          ),
        );

        snapshots += 1;
        lastRequest = entityToolRequest(command);
        lastSnapshot = snapshot;
        lastDiff = null;
        diagnostics = snapshot.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_DIFF_COMMAND_CHANNEL) {
        lastRequest = entityToolRequest(command);

        if (lastSnapshot === null) {
          diagnostics = [
            {
              code: "aperture.entityTools.diffMissingSnapshot",
              severity: "error",
              message:
                "Entity diff requires a previous generated entity snapshot.",
              data: { channel: command.channel },
              suggestedFix:
                "Request aperture.devtools.entity.snapshot before requesting aperture.devtools.entity.diff.",
            },
          ];
          lastDiff = null;
          return true;
        }

        const nextSnapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-diff-${diffs + 1}`,
          ),
        );
        const diff = diffApertureEntityLookupSnapshots(
          lastSnapshot,
          nextSnapshot,
        );

        snapshots += 1;
        diffs += 1;
        lastSnapshot = nextSnapshot;
        lastDiff = diff;
        diagnostics = diff.diagnostics;
        return true;
      }

      return false;
    },
    summary() {
      return {
        finds,
        gets,
        mutations,
        snapshots,
        diffs,
        lastRequest,
        lastFind,
        lastGet,
        lastMutation,
        lastSnapshot,
        lastDiff,
        diagnostics,
      };
    },
  };
}

function findQueryFromPayload(
  payload: unknown,
  fallbackLimit: number,
): ApertureEntityFindQuery {
  const record = isRecord(payload) ? payload : {};
  const query = isRecord(record["query"]) ? record["query"] : record;
  const source = sourceFilterFromValue(query["source"]);
  const key = stringFromValue(query["key"]);
  const namePattern = stringFromValue(query["namePattern"]);
  const withComponents = stringArrayFromValue(query["withComponents"]);
  const tags = stringArrayFromValue(query["tags"]);
  const limit = numberFromValue(query["limit"]);

  return {
    ...(key === undefined ? {} : { key }),
    ...(namePattern === undefined ? {} : { namePattern }),
    ...(withComponents === undefined ? {} : { withComponents }),
    ...(tags === undefined ? {} : { tags }),
    ...(source === undefined ? {} : { source }),
    limit: limit ?? fallbackLimit,
  };
}

function entityRefFromPayload(
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
): EcsEntityRef | null {
  const record = isRecord(payload) ? payload : {};
  const explicit = entityRefFromValue(record["entity"] ?? record);

  if (explicit !== null) {
    return explicit;
  }

  const queryRef = firstEntityFromFindReportPayload(payload);
  if (queryRef !== null) {
    return queryRef;
  }

  if (lastGet?.ok) {
    return lastGet.summary.entity;
  }

  return lastFind?.summaries[0]?.entity ?? null;
}

function firstEntityFromFindReportPayload(
  payload: unknown,
): EcsEntityRef | null {
  const record = isRecord(payload) ? payload : {};
  const summaries = Array.isArray(record["summaries"])
    ? record["summaries"]
    : [];
  const first = summaries.find(isRecord);

  return first === undefined ? null : entityRefFromValue(first["entity"]);
}

function setComponentRequestFromPayload(
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
):
  | ApertureEntitySetComponentFieldRequest
  | { readonly diagnostic: ApertureEntityLookupDiagnostic } {
  const record = isRecord(payload) ? payload : {};
  const entity = entityRefFromPayload(payload, lastFind, lastGet);
  const component = stringFromValue(record["component"]);
  const field = stringFromValue(record["field"]);

  if (entity === null) {
    return {
      diagnostic: missingEntityRefDiagnostic(
        APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
      ),
    };
  }

  if (component === undefined || field === undefined) {
    return {
      diagnostic: {
        code: "aperture.entityTools.invalidMutationRequest",
        severity: "error",
        message: "Entity mutation requires component and field string values.",
        data: {
          channel: APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
          hasComponent: component !== undefined,
          hasField: field !== undefined,
        },
        suggestedFix:
          "Dispatch aperture.devtools.entity.setComponent with { entity, component, field, value }.",
      },
    };
  }

  return {
    entity,
    component,
    field,
    value: record["value"],
  };
}

function missingEntityRefDiagnostic(
  channel: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityTools.missingEntityRef",
    severity: "error",
    message:
      "Entity tool command requires an entity { index, generation } reference.",
    data: { channel },
    suggestedFix:
      "Run aperture.devtools.entity.find first and pass the returned entity reference, or select an entity in the developer panel.",
  };
}

function snapshotOptionsFromPayload(
  payload: unknown,
  fallbackLabel: string,
): ApertureEntityLookupSnapshotOptions {
  const record = isRecord(payload) ? payload : {};
  const query = isRecord(record["query"]) ? record["query"] : record;
  const source = sourceFilterFromValue(query["source"]);
  const entities = entityRefsFromValue(query["entities"]);
  const key = stringFromValue(query["key"]);
  const namePattern = stringFromValue(query["namePattern"]);
  const withComponents = stringArrayFromValue(query["withComponents"]);
  const tags = stringArrayFromValue(query["tags"]);
  const limit = numberFromValue(query["limit"]);

  return {
    label: stringFromValue(record["label"]) ?? fallbackLabel,
    ...(key === undefined ? {} : { key }),
    ...(namePattern === undefined ? {} : { namePattern }),
    ...(withComponents === undefined ? {} : { withComponents }),
    ...(tags === undefined ? {} : { tags }),
    ...(source === undefined ? {} : { source }),
    ...(limit === undefined ? {} : { limit }),
    ...(entities === undefined ? {} : { entities }),
  };
}

function entityToolRequest(
  command: ApertureGeneratedCommand,
): GeneratedEntityToolRequest {
  return {
    channel: command.channel,
    payload: jsonSafeValue(command.payload),
  };
}

function sourceFilterFromValue(
  value: unknown,
): ApertureEntityLookupSnapshotOptions["source"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const assetId = stringFromValue(value["assetId"]);
  const gltfNodeIndex = numberFromValue(value["gltfNodeIndex"]);
  const gltfNodePath = stringFromValue(value["gltfNodePath"]);

  return {
    ...(assetId === undefined ? {} : { assetId }),
    ...(gltfNodeIndex === undefined ? {} : { gltfNodeIndex }),
    ...(gltfNodePath === undefined ? {} : { gltfNodePath }),
  };
}

function entityRefFromValue(value: unknown): EcsEntityRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const index = numberFromValue(value["index"]);
  const generation = numberFromValue(value["generation"]);

  return index === undefined || generation === undefined
    ? null
    : { index, generation };
}

function entityRefsFromValue(
  value: unknown,
): ApertureEntityLookupSnapshotOptions["entities"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const refs = value
    .filter(isRecord)
    .map((entry) => ({
      index: numberFromValue(entry["index"]),
      generation: numberFromValue(entry["generation"]),
    }))
    .filter(
      (
        ref,
      ): ref is {
        readonly index: number;
        readonly generation: number;
      } => ref.index !== undefined && ref.generation !== undefined,
    );

  return refs.length === 0 ? undefined : refs;
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArrayFromValue(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter(
    (entry): entry is string => typeof entry === "string",
  );
  return strings.length === 0 ? undefined : strings;
}

function numberFromValue(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

function jsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
