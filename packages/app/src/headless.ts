import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  renderSnapshotToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  componentRegistryFromWorld,
  findDefinedComponent,
  loadScene,
  saveScene,
  serializeEntityRef,
  type ApertureSceneDocument,
  type Entity,
  type LoadSceneResult,
  type SceneDocumentDiagnostic,
} from "@aperture-engine/simulation";
import type { SimulationFixedStepClockState } from "@aperture-engine/runtime";
import {
  ApertureAppError,
  createApertureApp,
  type ApertureApp,
  type CreateApertureAppOptions,
} from "./advanced.js";
import { defineApertureConfig, type ApertureConfig } from "./config.js";
import {
  createApertureEntityLookup,
  createApertureEntityLookupSnapshot,
  type ApertureEntityLookup,
  type ApertureEntityLookupSnapshot,
} from "./entity-lookup.js";
import {
  createSignalSummary,
  type ApertureSystemInstance,
  type SignalSummary,
} from "./systems.js";
import {
  findDefinedResource,
  type ApertureResourceSummaryEntry,
} from "./systems/resources.js";
import {
  mirrorSourceAssetRegistryFromMessage,
  serializeSourceAssetRegistry,
  type SerializedSourceAssetRegistry,
  type SourceAssetMirrorReport,
} from "./asset-mirror.js";
import { jsonSafeValue } from "./internal/json-safe.js";
import {
  createApertureGeneratedFailureStatus,
  type ApertureGeneratedDiagnosticsStatus,
} from "./diagnostics.js";
import { createInputSummary, type ApertureInputSummary } from "./input.js";
import {
  advanceGeneratedInputFrame,
  createGeneratedInputEventMessage,
  drainGeneratedInputEventMessagesForFrame,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedInputEventMessage,
} from "./input/events.js";
import {
  restoreApertureFrameTime,
  snapshotApertureFrameTime,
  type ApertureFrameTimeState,
} from "./systems/frame-time.js";
import {
  restoreApertureRandom,
  snapshotApertureRandom,
  type ApertureRandomState,
} from "./systems/random.js";

export const APERTURE_SESSION_SNAPSHOT_FORMAT =
  "aperture.session-snapshot" as const;
export const APERTURE_SESSION_SNAPSHOT_VERSION = 1 as const;
export const APERTURE_SESSION_SNAPSHOT_APP_VERSION = "0.2.0" as const;

export interface CreateApertureHeadlessRunnerOptions extends Omit<
  CreateApertureAppOptions,
  "config"
> {
  readonly config: ApertureConfig;
}

export interface ApertureHeadlessSnapshotCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly lights: number;
  readonly bounds: number;
  readonly diagnostics: number;
}

export interface ApertureHeadlessStatus {
  readonly mode: "headless";
  readonly nextFrame: number;
  readonly preload: ApertureApp["preload"];
  readonly assets: ReturnType<
    ApertureApp["lowLevel"]["assets"]["createManifestReport"]
  >;
  readonly input: ApertureInputSummary;
  readonly signals: SignalSummary;
  readonly resources: ReturnType<
    ApertureApp["context"]["resources"]["summary"]
  >;
  readonly startOptions: ReturnType<
    ApertureApp["context"]["startOptions"]["summary"]
  >;
  readonly fixedStepClock: SimulationFixedStepClockState | null;
  readonly diagnostics: ReturnType<
    ApertureApp["context"]["diagnostics"]["list"]
  >;
  readonly entities: ApertureEntityLookupSnapshot;
  readonly lastSnapshot: {
    readonly frame: number;
    readonly counts: ApertureHeadlessSnapshotCounts;
  } | null;
}

export interface ApertureHeadlessStepReport {
  readonly snapshot: RenderSnapshot;
  readonly status: ApertureHeadlessStatus;
}

export interface ApertureHeadlessFailureStatus extends ApertureGeneratedDiagnosticsStatus {
  readonly mode: "headless";
}

export interface ApertureStableDigest {
  readonly algorithm: "fnv1a32-stable-json-v1";
  readonly hash: string;
  readonly byteLength: number;
}

export interface ApertureHeadlessRunner {
  readonly app: ApertureApp;
  readonly entities: ApertureEntityLookup;
  readonly sessionBootstrap: ApertureSessionSnapshotBootstrap;
  enqueueInput(event: ApertureGeneratedInputEvent, frame?: number): void;
  enqueueInputBatch(
    events: readonly ApertureGeneratedInputEvent[],
    frame?: number,
  ): void;
  getStatus(): ApertureHeadlessStatus;
  step(delta?: number, time?: number): ApertureHeadlessStepReport;
  /**
   * Advance the simulation without running render extraction (finding F18).
   * Returns only the status; the last extracted snapshot is preserved so
   * callers can extract() on demand after reaching the target state.
   */
  stepWithoutExtract(
    delta?: number,
    time?: number,
  ): { readonly status: ApertureHeadlessStatus };
  extract(frame?: number): ApertureHeadlessStepReport;
  restoreSessionSnapshot(
    snapshot: ApertureSessionSnapshot,
  ): ApertureSessionRestoreReport;
}

export interface ApertureSessionSnapshot {
  readonly format: typeof APERTURE_SESSION_SNAPSHOT_FORMAT;
  readonly version: typeof APERTURE_SESSION_SNAPSHOT_VERSION;
  readonly bootstrap: ApertureSessionSnapshotBootstrap;
  readonly simulation: {
    readonly scene: ApertureSceneDocument;
    readonly componentRegistry: ApertureSessionComponentRegistryManifest;
    readonly resources: readonly ApertureSerializedResourceEntry[];
    readonly signals: readonly ApertureSerializedSignalEntry[];
    readonly sourceAssets: unknown;
    readonly diagnostics: ApertureHeadlessStatus["diagnostics"];
  };
  readonly runtime: {
    readonly frame: number;
    readonly nextFrame: number;
    readonly time: ApertureFrameTimeState;
    readonly fixedStepClock: SimulationFixedStepClockState | null;
    readonly randomStreams: readonly ApertureSerializedRandomStreamState[];
    readonly random: ApertureRandomState | null;
    readonly systems: readonly ApertureSessionSystemStateEntry[];
  };
  readonly physics: {
    readonly mode: "rebuild-from-ecs-authoring";
    readonly diagnostics: readonly SceneDocumentDiagnostic[];
  };
  readonly inspection?: ApertureSessionSnapshotInspection;
}

export interface ApertureSessionSnapshotBootstrap {
  readonly apertureVersion: string;
  readonly appConfigId: string;
  readonly appMode: "headless";
  readonly packageVersions: Readonly<Record<string, string>>;
  readonly systemModules: readonly ApertureSessionSystemModuleManifestEntry[];
  readonly worldOptions: unknown;
  readonly fixedStepOptions?: unknown;
  readonly physics?: unknown;
  readonly startOptions?: unknown;
  readonly assetLoader: ApertureSessionAssetLoaderManifest;
  readonly limitations: readonly string[];
}

export interface ApertureSessionSystemModuleManifestEntry {
  readonly index: number;
  readonly moduleId: string;
  readonly exportName: "default";
  readonly className: string | null;
  readonly priority: number | null;
  readonly hasSnapshotState: boolean;
  readonly hasRestoreState: boolean;
  readonly hasAfterRestore: boolean;
  readonly configData?: unknown;
}

export interface ApertureSessionAssetLoaderManifest {
  readonly kind: "default" | "provided";
}

export interface ApertureSessionComponentRegistryManifest {
  readonly ids: readonly string[];
}

export type ApertureSerializedResourceEntry = ApertureResourceSummaryEntry;

export interface ApertureSerializedSignalEntry {
  readonly name: string;
  readonly kind: string;
  readonly value: unknown;
}

export interface ApertureSerializedRandomStreamState {
  readonly id: "default";
  readonly state: ApertureRandomState;
}

export interface ApertureSessionSnapshotInspection {
  /**
   * Optional renderer-only sidecar, intentionally typed as unknown so the app
   * package does not depend on the CLI-owned RenderBundle schema.
   */
  readonly renderBundle?: unknown;
}

export interface ApertureSessionSystemStateEntry {
  readonly system: string;
  readonly index: number;
  readonly version: 1;
  readonly payload: unknown;
}

export interface ApertureSessionRestoreReport {
  readonly ok: boolean;
  readonly scene: LoadSceneResult;
  readonly sourceAssets: SourceAssetMirrorReport;
  readonly resources: {
    readonly restored: number;
    readonly missing: readonly string[];
  };
  readonly signals: {
    readonly restored: number;
    readonly missing: readonly string[];
  };
  readonly random: {
    readonly restored: boolean;
  };
  readonly fixedStepClock: {
    readonly restored: boolean;
  };
  readonly systems: {
    readonly restored: number;
    readonly missing: readonly string[];
    readonly afterRestore: number;
  };
}

export interface RestoreApertureHeadlessRunnerFromSessionOptions extends CreateApertureHeadlessRunnerOptions {
  readonly snapshot: ApertureSessionSnapshot;
}

export interface CreateApertureSessionSnapshotOptions {
  readonly inspection?: ApertureSessionSnapshotInspection;
}

export async function createApertureHeadlessRunner(
  options: CreateApertureHeadlessRunnerOptions,
): Promise<ApertureHeadlessRunner> {
  const config = defineApertureConfig(options.config);

  if (config.mode !== "headless") {
    throw new ApertureAppError({
      code: "aperture.headless.invalidMode",
      message: "Aperture headless runner requires mode: 'headless'.",
      suggestedFix:
        "Use a headless aperture config or run browser configs through the generated Vite browser bootstrap.",
      detail: { mode: config.mode },
    });
  }

  const app = await createApertureApp({
    ...options,
    config,
  });
  const sessionBootstrap = createSessionBootstrapManifest(options, config);
  let nextFrame = 0;
  let lastSnapshot: RenderSnapshot | null = null;
  const pendingInput: ApertureGeneratedInputEventMessage[] = [];
  const entities = createApertureEntityLookup(app.lowLevel.world);

  return {
    app,
    entities,
    sessionBootstrap,
    enqueueInput(event, frame) {
      pendingInput.push(createGeneratedInputEventMessage(event, frame));
    },
    enqueueInputBatch(events, frame) {
      for (const event of events) {
        pendingInput.push(createGeneratedInputEventMessage(event, frame));
      }
    },
    getStatus() {
      return createHeadlessStatus(app, nextFrame, lastSnapshot);
    },
    step(delta = 0, time = 0) {
      const frame = nextFrame;
      const events = drainGeneratedInputEventMessagesForFrame(
        pendingInput,
        frame,
      );
      advanceGeneratedInputFrame({
        signals: app.context.input,
        config,
        events,
      });
      nextFrame += 1;
      lastSnapshot = app.stepAndExtract(delta, time, frame);

      return {
        snapshot: lastSnapshot,
        status: createHeadlessStatus(app, nextFrame, lastSnapshot),
      };
    },
    stepWithoutExtract(delta = 0, time = 0) {
      // Advance the simulation without running render extraction. Extraction is
      // ~99.8% of per-step cost at scale, so a warm loop that only needs to
      // reach a target state (then extract once) is far cheaper this way
      // (finding F18). lastSnapshot is intentionally left untouched; callers
      // extract() on demand when they want fresh render data.
      const frame = nextFrame;
      const events = drainGeneratedInputEventMessagesForFrame(
        pendingInput,
        frame,
      );
      advanceGeneratedInputFrame({
        signals: app.context.input,
        config,
        events,
      });
      nextFrame += 1;
      app.step(delta, time);

      return {
        status: createHeadlessStatus(app, nextFrame, lastSnapshot),
      };
    },
    extract(frame = nextFrame) {
      lastSnapshot = app.extract(frame);

      return {
        snapshot: lastSnapshot,
        status: createHeadlessStatus(app, nextFrame, lastSnapshot),
      };
    },
    restoreSessionSnapshot(snapshot) {
      const report = restoreApertureSessionSnapshotIntoRunner(snapshot, {
        app,
        setNextFrame(value) {
          nextFrame = value;
        },
        setLastSnapshot(value) {
          lastSnapshot = value;
        },
      });
      return report;
    },
  };
}

export async function restoreApertureHeadlessRunnerFromSessionSnapshot(
  options: RestoreApertureHeadlessRunnerFromSessionOptions,
): Promise<{
  readonly runner: ApertureHeadlessRunner;
  readonly restore: ApertureSessionRestoreReport;
}> {
  const runner = await createApertureHeadlessRunner(options);
  const restore = runner.restoreSessionSnapshot(options.snapshot);
  return { runner, restore };
}

export function createApertureSessionSnapshot(
  runner: ApertureHeadlessRunner,
  options: CreateApertureSessionSnapshotOptions = {},
): ApertureSessionSnapshot {
  const status = runner.getStatus();
  const random = snapshotApertureRandom(runner.app.context.random);
  return {
    format: APERTURE_SESSION_SNAPSHOT_FORMAT,
    version: APERTURE_SESSION_SNAPSHOT_VERSION,
    bootstrap: runner.sessionBootstrap,
    simulation: {
      scene: saveScene(runner.app.lowLevel.world),
      componentRegistry: createSessionComponentRegistryManifest(
        runner.app.lowLevel.world,
      ),
      resources: serializeSessionResources(status.resources),
      signals: serializeSessionSignals(runner.app.config, status.signals),
      sourceAssets: encodeTypedArrayTree(
        serializeSourceAssetRegistry(runner.app.lowLevel.assets),
      ),
      diagnostics: status.diagnostics,
    },
    runtime: {
      frame: status.nextFrame,
      nextFrame: status.nextFrame,
      time: snapshotApertureFrameTime(runner.app.context.time),
      fixedStepClock: runner.app.snapshotFixedStepClock(),
      randomStreams: random === null ? [] : [{ id: "default", state: random }],
      random,
      systems: snapshotSessionSystemStates(runner.app),
    },
    physics: {
      mode: "rebuild-from-ecs-authoring",
      diagnostics: [],
    },
    ...(options.inspection === undefined
      ? {}
      : { inspection: encodeSessionInspection(options.inspection) }),
  };
}

export function createApertureHeadlessFailureStatus(
  error: unknown,
): ApertureHeadlessFailureStatus {
  return {
    mode: "headless",
    ...createApertureGeneratedFailureStatus({
      error,
      fallback: {
        code: "aperture.headless.failed",
        severity: "error",
        message: "Aperture headless app failed.",
        suggestedFix:
          "Inspect aperture.config.ts, system modules, and asset URLs before rerunning headless mode.",
      },
    }),
  };
}

export function createApertureStableDigest(
  value: unknown,
): ApertureStableDigest {
  const json = stableJsonStringify(value);
  return {
    algorithm: "fnv1a32-stable-json-v1",
    hash: fnv1a32(json),
    byteLength: json.length,
  };
}

export function createApertureHeadlessEcsDigest(
  status: Pick<ApertureHeadlessStatus, "entities">,
): ApertureStableDigest {
  return createApertureStableDigest(
    normalizedEntityDigestValue(status.entities),
  );
}

function normalizedEntityDigestValue(value: unknown): unknown {
  if (!isJsonRecord(value) || !Array.isArray(value.summaries)) {
    return value;
  }

  const summaries = value.summaries.filter(isJsonRecord);
  const sorted = summaries.slice().sort((a, b) => {
    const aKey = stableJsonStringify(entityDigestSortValue(a));
    const bKey = stableJsonStringify(entityDigestSortValue(b));
    return aKey.localeCompare(bKey);
  });
  const labels = new Map<string, string>();

  sorted.forEach((summary, index) => {
    const ref = entityRefDigestKey(summary.entity);
    if (ref !== null) {
      labels.set(ref, entityDigestLabel(summary, index));
    }
  });

  return {
    ...value,
    summaries: sorted.map((summary, index) =>
      normalizeEntitySummaryForDigest(summary, labels, index),
    ),
  };
}

function normalizeEntitySummaryForDigest(
  summary: Record<string, unknown>,
  labels: ReadonlyMap<string, string>,
  index: number,
): unknown {
  const normalized: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(summary)) {
    if (key === "entity") {
      normalized.entity = entityDigestLabel(summary, index);
      continue;
    }

    if (
      key === "name" &&
      typeof fieldValue === "string" &&
      /^Entity \d+$/u.test(fieldValue)
    ) {
      continue;
    }

    normalized[key] = normalizeEntityRefsForDigest(fieldValue, labels);
  }

  return normalized;
}

function normalizeEntityRefsForDigest(
  value: unknown,
  labels: ReadonlyMap<string, string>,
): unknown {
  const ref = entityRefDigestKey(value);
  if (ref !== null) {
    return { entityRef: labels.get(ref) ?? ref };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeEntityRefsForDigest(item, labels));
  }

  if (!isJsonRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      normalizeEntityRefsForDigest(item, labels),
    ]),
  );
}

function entityDigestSortValue(summary: Record<string, unknown>): unknown {
  const { entity: _entity, name, ...rest } = summary;
  const normalizedRest = normalizeEntityRefsForDigest(rest, new Map());
  return {
    ...(isJsonRecord(normalizedRest) ? normalizedRest : {}),
    ...(typeof name === "string" && !/^Entity \d+$/u.test(name)
      ? { name }
      : {}),
  };
}

function entityDigestLabel(
  summary: Record<string, unknown>,
  index: number,
): string {
  return typeof summary.key === "string" && summary.key.length > 0
    ? `key:${summary.key}`
    : typeof summary.name === "string" && !/^Entity \d+$/u.test(summary.name)
      ? `name:${summary.name}`
      : `entity:${index}`;
}

function entityRefDigestKey(value: unknown): string | null {
  if (!isJsonRecord(value)) {
    return null;
  }

  return Number.isInteger(value.index) && Number.isInteger(value.generation)
    ? `${String(value.index)}:${String(value.generation)}`
    : null;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createApertureHeadlessStatusDigest(
  status: ApertureHeadlessStatus,
): ApertureStableDigest {
  return createApertureStableDigest({
    mode: status.mode,
    nextFrame: status.nextFrame,
    assets: status.assets,
    input: status.input,
    signals: status.signals,
    resources: status.resources,
    startOptions: status.startOptions,
    fixedStepClock: status.fixedStepClock,
    diagnostics: status.diagnostics,
    entities: normalizedEntityDigestValue(status.entities),
    lastSnapshot: status.lastSnapshot,
  });
}

export function createApertureRenderSnapshotDigest(
  snapshot: RenderSnapshot,
): ApertureStableDigest {
  return createApertureStableDigest(renderSnapshotToJsonValue(snapshot));
}

function createHeadlessStatus(
  app: ApertureApp,
  nextFrame: number,
  lastSnapshot: RenderSnapshot | null,
): ApertureHeadlessStatus {
  return {
    mode: "headless",
    nextFrame,
    preload: app.preload,
    assets: app.lowLevel.assets.createManifestReport(),
    input: createInputSummary(app.context.input),
    signals: createSignalSummary(app.context.signals),
    resources: app.context.resources.summary(),
    startOptions: app.context.startOptions.summary(),
    fixedStepClock: app.snapshotFixedStepClock(),
    diagnostics: app.context.diagnostics.list(),
    entities: createApertureEntityLookupSnapshot(app.lowLevel.world, {
      label: "headless",
    }),
    lastSnapshot:
      lastSnapshot === null
        ? null
        : {
            frame: lastSnapshot.frame,
            counts: snapshotCounts(lastSnapshot),
          },
  };
}

function createSessionBootstrapManifest(
  options: CreateApertureHeadlessRunnerOptions,
  config: ApertureConfig,
): ApertureSessionSnapshotBootstrap {
  const fixedStepOptions =
    options.fixedStep === undefined && options.physics !== undefined
      ? {}
      : options.fixedStep;

  return {
    apertureVersion: APERTURE_SESSION_SNAPSHOT_APP_VERSION,
    appConfigId: createApertureStableDigest(jsonSafeValue(config)).hash,
    appMode: "headless",
    packageVersions: {
      "@aperture-engine/app": APERTURE_SESSION_SNAPSHOT_APP_VERSION,
    },
    systemModules: (options.systems ?? []).map(systemModuleManifestEntry),
    worldOptions: jsonSafeValue(options.worldOptions ?? {}),
    ...(fixedStepOptions === undefined
      ? {}
      : { fixedStepOptions: jsonSafeValue(fixedStepOptions) }),
    ...(options.physics === undefined
      ? {}
      : { physics: jsonSafeValue(options.physics) }),
    ...(options.startOptions === undefined
      ? {}
      : { startOptions: jsonSafeValue(options.startOptions) }),
    assetLoader: {
      kind: options.assetLoader === undefined ? "default" : "provided",
    },
    limitations: [
      "Only systems with snapshotState()/restoreState() hooks serialize private instance fields in SessionSnapshot v1.",
      "Physics backend state is rebuilt from ECS authoring state.",
      "Live callbacks, promises, DOM handles, GPU objects, and backend-native physics handles are not serialized.",
    ],
  };
}

function systemModuleManifestEntry(
  moduleValue: NonNullable<
    CreateApertureHeadlessRunnerOptions["systems"]
  >[number],
  index: number,
): ApertureSessionSystemModuleManifestEntry {
  const System = moduleValue.default;
  const prototype =
    System === undefined
      ? null
      : (System.prototype as Partial<ApertureSystemInstance>);
  const priority =
    System?.aperture?.schedule.priority !== undefined &&
    Number.isFinite(System.aperture.schedule.priority)
      ? System.aperture.schedule.priority
      : null;

  return {
    index,
    moduleId: System?.name || `system:${index}`,
    exportName: "default",
    className: System?.name ?? null,
    priority,
    hasSnapshotState: typeof prototype?.snapshotState === "function",
    hasRestoreState: typeof prototype?.restoreState === "function",
    hasAfterRestore: typeof prototype?.afterRestore === "function",
    ...(moduleValue.configData === undefined
      ? {}
      : { configData: jsonSafeValue(moduleValue.configData) }),
  };
}

function createSessionComponentRegistryManifest(
  world: ApertureApp["lowLevel"]["world"],
): ApertureSessionComponentRegistryManifest {
  return {
    ids: [...componentRegistryFromWorld(world).ids].sort(),
  };
}

function serializeSessionResources(
  summary: ApertureHeadlessStatus["resources"],
): readonly ApertureSerializedResourceEntry[] {
  return summary.entries.map((entry) => ({
    id: entry.id,
    version: entry.version,
    fields: entry.fields.map((field) => ({ ...field })),
    values: jsonSafeValue(entry.values) as Readonly<Record<string, unknown>>,
  }));
}

function serializeSessionSignals(
  config: ApertureConfig,
  summary: SignalSummary,
): readonly ApertureSerializedSignalEntry[] {
  const descriptors = config.signals ?? {};

  return Object.entries(summary)
    .map(([name, value]) => ({
      name,
      kind: descriptors[name]?.kind ?? "unknown",
      value: jsonSafeValue(value),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function restoreApertureSessionSnapshotIntoRunner(
  snapshot: ApertureSessionSnapshot,
  target: {
    readonly app: ApertureApp;
    setNextFrame(value: number): void;
    setLastSnapshot(value: RenderSnapshot | null): void;
  },
): ApertureSessionRestoreReport {
  assertSupportedSessionSnapshot(snapshot);

  destroyActiveEntities(target.app.lowLevel.world);
  // Pre-register every component the saving world knew about (#64): user
  // components are registered lazily (first addComponent/query), so a freshly
  // booted restore world may not have them yet and loadScene would skip their
  // records as `unregisteredComponent`. Module-scope defineComponent
  // singletons are recorded in the process-global registry, so the manifest
  // ids resolve back to the live component objects.
  for (const id of snapshot.simulation.componentRegistry.ids) {
    const component = findDefinedComponent(id);
    if (component !== undefined) {
      target.app.lowLevel.world.registerComponent(component);
    }
  }
  const scene = loadScene(
    target.app.lowLevel.world,
    snapshot.simulation.scene,
    {
      registry: componentRegistryFromWorld(target.app.lowLevel.world),
    },
  );
  const sourceAssets = mirrorSourceAssetRegistryFromMessage(
    target.app.lowLevel.assets,
    {
      sourceAssets: decodeTypedArrayTree(
        snapshot.simulation.sourceAssets,
      ) as SerializedSourceAssetRegistry,
    },
  );
  const resources = restoreSessionResources(
    target.app.context.resources,
    snapshot.simulation.resources,
  );
  const signals = restoreSessionSignals(
    target.app.context.signals,
    snapshot.simulation.signals,
  );
  const randomState = sessionRandomState(snapshot);
  const randomRestored =
    randomState === null
      ? false
      : restoreApertureRandom(target.app.context.random, randomState);
  const fixedStepClockRestored = target.app.restoreFixedStepClock(
    sessionFixedStepClockState(snapshot),
  );

  restoreApertureFrameTime(target.app.context.time, snapshot.runtime.time);
  const systems = restoreSessionSystemStates(
    target.app,
    snapshot.runtime.systems,
    snapshot.simulation.scene,
    scene.entities,
  );
  target.setNextFrame(sessionFrame(snapshot));
  target.setLastSnapshot(null);

  return {
    ok:
      scene.ok &&
      resources.missing.length === 0 &&
      signals.missing.length === 0 &&
      (randomState === null || randomRestored) &&
      fixedStepClockRestored &&
      systems.missing.length === 0,
    scene,
    sourceAssets,
    resources,
    signals,
    random: { restored: randomRestored },
    fixedStepClock: { restored: fixedStepClockRestored },
    systems,
  };
}

function assertSupportedSessionSnapshot(
  snapshot: ApertureSessionSnapshot,
): void {
  if (
    snapshot.format !== APERTURE_SESSION_SNAPSHOT_FORMAT ||
    snapshot.version !== APERTURE_SESSION_SNAPSHOT_VERSION
  ) {
    throw new ApertureAppError({
      code: "aperture.session.unsupportedSnapshot",
      message: `Unsupported Aperture session snapshot '${String(
        snapshot.format,
      )}' version ${String(snapshot.version)}.`,
      suggestedFix:
        "Restore a session snapshot written by the same Aperture version.",
    });
  }
}

function destroyActiveEntities(world: ApertureApp["lowLevel"]["world"]): void {
  const manager = world.entityManager as unknown as {
    readonly entityIndex?: number;
    getEntityByIndex(
      index: number,
    ): ReturnType<ApertureApp["lowLevel"]["world"]["createEntity"]> | null;
  };
  const entities: Array<
    ReturnType<ApertureApp["lowLevel"]["world"]["createEntity"]>
  > = [];
  const count = manager.entityIndex ?? 0;

  for (let index = 0; index < count; index += 1) {
    const entity = manager.getEntityByIndex(index);

    if (entity !== null) {
      entities.push(entity);
    }
  }

  const activeEntities = entities
    .filter((entity) => entity.active)
    .sort((a, b) => b.index - a.index || b.generation - a.generation);

  for (const entity of activeEntities) {
    entity.destroy();
  }
}

function restoreSessionResources(
  resources: ApertureApp["context"]["resources"],
  snapshotResources:
    | readonly ApertureSerializedResourceEntry[]
    | ApertureHeadlessStatus["resources"],
): ApertureSessionRestoreReport["resources"] {
  let restored = 0;
  const missing: string[] = [];

  for (const entry of sessionResourceEntries(snapshotResources)) {
    let patched = resources.patchById(entry.id, entry.values);
    if (patched === null) {
      // The owning system hasn't touched the store yet this session, so the
      // entry doesn't exist. Materialize it from the module-scope descriptor
      // recorded at defineResource time, then apply the snapshot values (#64).
      const descriptor = findDefinedResource(entry.id);
      if (descriptor !== undefined) {
        resources.reset(descriptor);
        patched = resources.patchById(entry.id, entry.values);
      }
    }
    if (patched === null) {
      missing.push(entry.id);
    } else {
      restored += 1;
    }
  }

  return { restored, missing };
}

function restoreSessionSignals(
  signals: ApertureApp["context"]["signals"],
  snapshotSignals: readonly ApertureSerializedSignalEntry[] | SignalSummary,
): ApertureSessionRestoreReport["signals"] {
  let restored = 0;
  const missing: string[] = [];

  for (const entry of sessionSignalEntries(snapshotSignals)) {
    const signal = signals[entry.name];
    if (signal === undefined) {
      missing.push(entry.name);
    } else {
      signal.value = entry.value;
      restored += 1;
    }
  }

  return { restored, missing };
}

function sessionResourceEntries(
  value:
    | readonly ApertureSerializedResourceEntry[]
    | ApertureHeadlessStatus["resources"],
): readonly ApertureSerializedResourceEntry[] {
  if (Array.isArray(value)) {
    return value;
  }

  return (value as ApertureHeadlessStatus["resources"]).entries;
}

function sessionSignalEntries(
  value: readonly ApertureSerializedSignalEntry[] | SignalSummary,
): readonly ApertureSerializedSignalEntry[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Object.entries(value)
    .map(([name, signalValue]) => ({
      name,
      kind: "unknown",
      value: signalValue,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sessionFrame(snapshot: ApertureSessionSnapshot): number {
  const runtime = snapshot.runtime as {
    readonly frame?: unknown;
    readonly nextFrame?: unknown;
  };

  if (
    typeof runtime.nextFrame === "number" &&
    Number.isInteger(runtime.nextFrame)
  ) {
    return runtime.nextFrame;
  }

  if (typeof runtime.frame === "number" && Number.isInteger(runtime.frame)) {
    return runtime.frame;
  }

  return 0;
}

function sessionRandomState(
  snapshot: ApertureSessionSnapshot,
): ApertureRandomState | null {
  const runtime = snapshot.runtime as {
    readonly random?: ApertureRandomState | null;
    readonly randomStreams?: readonly ApertureSerializedRandomStreamState[];
  };

  if (runtime.random !== null && runtime.random !== undefined) {
    return runtime.random;
  }

  return (
    runtime.randomStreams?.find((stream) => stream.id === "default")?.state ??
    null
  );
}

function sessionFixedStepClockState(
  snapshot: ApertureSessionSnapshot,
): SimulationFixedStepClockState | null {
  const runtime = snapshot.runtime as {
    readonly fixedStepClock?: SimulationFixedStepClockState | null;
  };

  return runtime.fixedStepClock ?? null;
}

function snapshotSessionSystemStates(
  app: ApertureApp,
): readonly ApertureSessionSystemStateEntry[] {
  const systems = app.lowLevel.world.getSystems() as readonly unknown[];
  const entries: ApertureSessionSystemStateEntry[] = [];

  systems.forEach((system, index) => {
    if (!isApertureSystemInstance(system)) {
      return;
    }

    const payload = system.snapshotState?.({
      world: app.lowLevel.world,
      context: app.context,
    });

    if (payload === undefined) {
      return;
    }

    entries.push({
      system: systemName(system, index),
      index,
      version: 1,
      payload: encodeSystemStatePayload(payload, systemName(system, index)),
    });
  });

  return entries;
}

function restoreSessionSystemStates(
  app: ApertureApp,
  entries: readonly ApertureSessionSystemStateEntry[],
  scene: ApertureSceneDocument,
  loadedEntities: readonly Entity[],
): ApertureSessionRestoreReport["systems"] {
  const systems = app.lowLevel.world.getSystems() as readonly unknown[];
  const missing: string[] = [];
  let restored = 0;
  let afterRestore = 0;
  const restoreContext = {
    world: app.lowLevel.world,
    context: app.context,
  };
  const remapEntityRef = createSessionEntityRemapper(scene, loadedEntities);

  for (const entry of entries) {
    const system = systems[entry.index];
    const label = `${entry.system}#${entry.index}`;

    if (entry.version !== 1) {
      missing.push(`${label}:unsupported-version-${entry.version}`);
      continue;
    }

    if (
      !isApertureSystemInstance(system) ||
      systemName(system, entry.index) !== entry.system ||
      typeof system.restoreState !== "function"
    ) {
      missing.push(label);
      continue;
    }

    system.restoreState(
      decodeTypedArrayTree(entry.payload),
      restoreContext,
      remapEntityRef,
    );
    restored += 1;
  }

  systems.forEach((system) => {
    if (
      !isApertureSystemInstance(system) ||
      typeof system.afterRestore !== "function"
    ) {
      return;
    }

    system.afterRestore(restoreContext);
    afterRestore += 1;
  });

  return { restored, missing, afterRestore };
}

function encodeSystemStatePayload(payload: unknown, system: string): unknown {
  const encoded = encodeTypedArrayTree(payload);

  try {
    JSON.stringify(encoded);
  } catch (error: unknown) {
    throw new ApertureAppError({
      code: "aperture.session.invalidSystemState",
      message: `System '${system}' returned a non-serializable SessionSnapshot state payload.`,
      suggestedFix:
        "Return JSON-safe state from snapshotState(); do not include functions, promises, DOM/GPU objects, or cyclic references.",
      detail: {
        system,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return encoded;
}

function encodeSessionInspection(
  inspection: ApertureSessionSnapshotInspection,
): ApertureSessionSnapshotInspection {
  return inspection.renderBundle === undefined
    ? {}
    : { renderBundle: encodeTypedArrayTree(inspection.renderBundle) };
}

function createSessionEntityRemapper(
  scene: ApertureSceneDocument,
  loadedEntities: readonly Entity[],
): (oldEntityRef: Entity | string) => Entity | undefined {
  const bySerializedRef = new Map<string, Entity>();

  scene.entities.forEach((record, index) => {
    const entity = loadedEntities[index];
    if (entity !== undefined) {
      bySerializedRef.set(record.id, entity);
    }
  });

  return (oldEntityRef) => {
    const serialized =
      typeof oldEntityRef === "string"
        ? oldEntityRef
        : serializeEntityRef(oldEntityRef);
    return bySerializedRef.get(serialized);
  };
}

function isApertureSystemInstance(
  value: unknown,
): value is ApertureSystemInstance {
  return (
    typeof value === "object" &&
    value !== null &&
    "world" in value &&
    "update" in value
  );
}

function systemName(system: ApertureSystemInstance, index: number): string {
  return (
    (system.constructor as { readonly name?: string }).name ||
    `ApertureSystem${index}`
  );
}

function snapshotCounts(
  snapshot: RenderSnapshot,
): ApertureHeadlessSnapshotCounts {
  return {
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    bounds: snapshot.bounds.length,
    diagnostics: snapshot.diagnostics.length,
  };
}

function stableJsonStringify(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (ArrayBuffer.isView(value)) {
    return stableJsonStringify(
      Array.from(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      ),
    );
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`)
    .join(",")}}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
