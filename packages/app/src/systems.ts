import {
  computed,
  signal as createSignal,
  type ReadonlySignal,
  type Signal,
} from "@preact/signals-core";
import type { Query, SystemQueries, SystemSchema } from "elics";
import {
  Camera,
  Light,
  LightKind,
  Material,
  Mesh,
  createGlbUriLoadCache,
  createBoxMeshAsset,
  createCamera,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createGltfEcsAuthoringCommandPlan,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfUriLoadCache,
  createLight,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  loadGlbFromUri,
  loadGltfFromUri,
  registerGltfSourceAssetsFromReports,
  registerRenderAuthoringComponents,
  replayGltfEcsAuthoringCommands,
  type CameraInput,
  type GltfEcsAuthoringCommandPlan,
  type GltfEcsCommandReplayReport,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
  type GltfReportDrivenImportReport,
  type GltfSourceAssetRegistrationReport,
  type LightInput,
  type MaterialAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  DebugMetadata,
  EcsType,
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  createEnvironmentMapHandle,
  createRootTransform,
  createSceneHandle,
  createSystem as createElicsSystem,
  createTextureHandle,
  defineComponent,
  quatFromAxisAngle,
  registerMetadataComponents,
  registerTransformComponents,
  type AssetDiagnostic,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type LocalTransformInput,
  type MaterialHandle,
  type MeshHandle,
  type SceneHandle,
  type Vec3Like,
  type Vec4Like,
} from "@aperture-engine/simulation";
import type {
  ApertureConfig,
  ApertureConfigAssetDescriptor,
  ApertureSignalDescriptor,
  AssetPreloadPolicy,
  ConfigAssetKind,
  EcsEntityRef,
} from "./config.js";
import {
  createSpatialQueries,
  type RayInput,
  type SpatialQueries,
} from "./spatial-queries.js";

export { createSpatialQueries } from "./spatial-queries.js";
export type {
  RayInput,
  SpatialPickableState,
  SpatialQueries,
  SpatialRaycastHit,
  SpatialRaycastOptions,
  SpatialRaycastableBounds,
  SpatialRaycastableMesh,
} from "./spatial-queries.js";

export {
  DebugMetadata,
  Enabled,
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  computed,
  createSignal as signal,
  defineComponent,
  quatFromAxisAngle,
};

export type ApertureEffectPhase = "input" | "update" | "postUpdate";

export interface ApertureEffectOptions {
  readonly phase?: ApertureEffectPhase;
  readonly priority?: number;
}

export interface ApertureEffectHandle {
  dispose(): void;
}

export interface ApertureEffects {
  watch<TValue>(
    watched: ReadonlySignal<TValue> | Signal<TValue>,
    callback: (value: TValue) => void,
    options?: ApertureEffectOptions,
  ): ApertureEffectHandle;
  onQueryEnter(
    query: ApertureQuery,
    callback: (entity: Entity) => void,
    options?: ApertureEffectOptions,
  ): ApertureEffectHandle;
  flush(phase?: ApertureEffectPhase): void;
  dispose(): void;
}

export interface ApertureQuery {
  readonly entities: Set<Entity>;
  subscribe?(
    type: "qualify" | "disqualify",
    callback: (entity: Entity) => void,
    immediate?: boolean,
  ): () => void;
}

export type SignalStore = Record<string, Signal<unknown>>;
export type SignalSummary = Readonly<Record<string, unknown>>;

export function createSignalSummary(signals: SignalStore): SignalSummary {
  const summary: Record<string, unknown> = {};

  for (const [key, signal] of Object.entries(signals)) {
    summary[key] = jsonSafeValue(signal.value);
  }

  return summary;
}

export interface InputActionSignals {
  readonly pressed: Signal<boolean>;
  readonly value: Signal<number>;
}

export interface InputSignals {
  readonly actions: Record<string, InputActionSignals>;
  readonly pointer: {
    readonly primary: {
      readonly position: Signal<readonly [number, number]>;
      readonly pressed: Signal<boolean>;
    };
  };
  readonly keyboard: Record<string, Signal<boolean>>;
  readonly gamepad: Record<string, Signal<number>>;
  readonly xr: {
    readonly active: Signal<boolean>;
  };
}

export type SystemAssetKind = ConfigAssetKind;

export interface SystemAssetHandle<TKind extends SystemAssetKind> {
  readonly id: string;
  readonly kind: TKind;
  readonly url: string;
  readonly preload: AssetPreloadPolicy;
  readonly ready: Signal<boolean>;
  readonly error: Signal<ApertureSystemDiagnostic | null>;
  readonly renderHandle: TKind extends "gltf" ? SceneHandle : unknown;
}

export type SystemGltfAssetHandle = SystemAssetHandle<"gltf"> & {
  readonly renderHandle: SceneHandle;
  readonly scene: Signal<SystemGltfLoadedScene | null>;
};

export interface SystemGltfLoadedScene {
  readonly assetId: string;
  readonly url: string;
  readonly sourceKind: "glb" | "gltf";
  readonly byteLength: number | null;
  readonly importReport: GltfReportDrivenImportReport;
  readonly sourceRegistration: GltfSourceAssetRegistrationReport;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport;
  readonly primitiveMaterials: GltfPrimitiveMaterialResolutionReport;
  readonly commandPlan: GltfEcsAuthoringCommandPlan;
  readonly defaultMaterialHandleKey: string;
}

export interface SystemAssetAccess {
  gltf(id: string): SystemGltfAssetHandle;
  texture(id: string): SystemAssetHandle<"texture">;
  hdr(id: string): SystemAssetHandle<"hdr">;
  request(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void>;
  readiness(id: string): Signal<boolean>;
  error(id: string): Signal<ApertureSystemDiagnostic | null>;
  list(): readonly SystemAssetHandle<SystemAssetKind>[];
}

export interface CommandAccess {
  requestAsset(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void>;
  queue<TCommand>(channel: string, payload: TCommand): void;
  drain<TCommand = unknown>(channel: string): TCommand[];
  summary(): CommandAccessSummary;
}

export interface CommandAccessSummary {
  readonly enqueued: number;
  readonly drained: number;
  readonly queuedByChannel: Readonly<Record<string, number>>;
  readonly lastQueued: CommandChannelEntry | null;
  readonly lastDrained: CommandChannelEntry | null;
  readonly requestedAssets: readonly CommandAssetRequestSummary[];
}

export interface CommandChannelEntry {
  readonly channel: string;
  readonly payload: unknown;
}

export interface CommandAssetRequestSummary {
  readonly id: string;
  readonly status: "pending" | "ready" | "error";
  readonly ready: boolean;
  readonly errorCode?: string;
  readonly message?: string;
}

export interface CameraHandle {
  readonly entity: Entity;
  readonly ref: EcsEntityRef;
  rayFromPointer(position: readonly [number, number]): RayInput;
}

export interface CameraAccess {
  readonly main: CameraHandle;
  readonly active: readonly CameraHandle[];
  byKey(key: string): CameraHandle | null;
}

export interface SystemDiagnostics {
  info(code: string, data?: Record<string, unknown>): void;
  warn(code: string, data?: Record<string, unknown>): void;
  error(code: string, data?: Record<string, unknown>): void;
  list(): readonly ApertureSystemDiagnostic[];
}

export interface ApertureSystemDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix?: string;
}

export interface ApertureSystemContext {
  readonly world: unknown;
  readonly assetsRegistry: AssetRegistry;
  readonly signals: SignalStore;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
}

export interface SpawnMetadata {
  readonly name?: string;
  readonly key?: string;
  readonly tags?: readonly string[];
}

export interface SystemTransformInput extends LocalTransformInput {
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  readonly lookAt?: Vec3Like;
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  readonly illuminance?: number;
  readonly intensity?: number;
  readonly light?: LightInput;
}

export interface PrimitiveMeshDescriptor {
  readonly kind: "box" | "sphere" | "capsule" | "plane" | "cylinder" | "cone";
  readonly options: Record<string, unknown>;
}

export interface StandardMaterialDescriptor {
  readonly kind: "standard";
  readonly options: StandardMaterialOptions;
}

export interface StandardMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly roughness?: number;
  readonly metallic?: number;
  readonly label?: string;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: StandardMaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
}

export interface SpawnGltfOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
}

export interface SpawnCommands {
  camera(options?: SpawnCameraOptions): Entity;
  light(options?: SpawnLightOptions): Entity;
  mesh(options: SpawnMeshOptions): Entity;
  gltf(handle: SystemGltfAssetHandle, options?: SpawnGltfOptions): Entity;
}

export type ScheduledEffects = ApertureEffects;

export interface ApertureSystemInstance {
  readonly world: unknown;
  readonly queries: Record<string, Query>;
  readonly priority: number;
  readonly signals: SignalStore;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
  init(): void;
  update(delta: number, time: number): void;
  destroy(): void;
}

export type ApertureSystemConstructor<
  TSchema extends SystemSchema = SystemSchema,
  TQueries extends SystemQueries = SystemQueries,
> = {
  readonly schema: TSchema;
  readonly isSystem: boolean;
  readonly queries: TQueries;
  new (
    world: EcsWorld,
    queryManager: unknown,
    priority: number,
  ): ApertureSystemInstance & {
    readonly queries: Record<keyof TQueries, Query>;
  };
};

export const AppEntityKey = defineComponent(
  "aperture.app.entityKey",
  {
    value: { type: EcsType.String, default: "" },
  },
  "Optional globally unique app-authored entity key for tooling and diagnostics.",
);

export const AppEntityTags = defineComponent(
  "aperture.app.entityTags",
  {
    valuesJson: { type: EcsType.String, default: "[]" },
  },
  "Optional app-authored entity tags serialized for tooling and diagnostics.",
);

export const AppEntitySource = defineComponent(
  "aperture.app.entitySource",
  {
    kind: { type: EcsType.String, default: "" },
    assetId: { type: EcsType.String, default: "" },
    gltfNodeIndex: { type: EcsType.Int32, default: -1 },
    gltfNodePath: { type: EcsType.String, default: "" },
  },
  "Optional app-authored or loader-authored source metadata for tooling and diagnostics.",
);

export const mesh = Object.freeze({
  box(
    options: {
      readonly size?: number | Vec3Like;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(
    options: {
      readonly radius?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(
    options: {
      readonly size?: number | readonly [number, number];
      readonly subdivisions?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
});

const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";
const APERTURE_EFFECTS = Symbol("aperture.effects");

export function createSystem<
  TQueries extends SystemQueries = Record<string, never>,
  TSchema extends SystemSchema = Record<string, never>,
>(
  queries?: TQueries,
  schema?: TSchema,
): ApertureSystemConstructor<TSchema, TQueries> {
  const Base = createElicsSystem(queries, schema);

  class ApertureSystemBase extends Base implements ApertureSystemInstance {
    readonly #context: ApertureSystemContext;
    readonly #effects: ScheduledEffects;

    constructor(...args: ConstructorParameters<typeof Base>) {
      super(...args);
      this.#context = getApertureSystemContext(this.world as EcsWorld);
      this.#effects = createScheduledEffects();
      registerSystemEffects(this, this.#effects);
    }

    get signals(): SignalStore {
      return this.#context.signals;
    }

    get input(): InputSignals {
      return this.#context.input;
    }

    get assets(): SystemAssetAccess {
      return this.#context.assets;
    }

    get commands(): CommandAccess {
      return this.#context.commands;
    }

    get spawn(): SpawnCommands {
      return this.#context.spawn;
    }

    get spatial(): SpatialQueries {
      return this.#context.spatial;
    }

    get cameras(): CameraAccess {
      return this.#context.cameras;
    }

    get diagnostics(): SystemDiagnostics {
      return this.#context.diagnostics;
    }

    get effects(): ScheduledEffects {
      return this.#effects;
    }

    override destroy(): void {
      this.#effects.dispose();
    }
  }

  return ApertureSystemBase as unknown as ApertureSystemConstructor<
    TSchema,
    TQueries
  >;
}

export function installApertureSystemContext(
  world: EcsWorld,
  context: ApertureSystemContext,
): void {
  world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}

export function createApertureSystemContext(options: {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly config?: ApertureConfig;
  readonly assetLoader?: ApertureAssetLoader;
}): ApertureSystemContext {
  registerApertureAppComponents(options.world);

  const diagnostics = createDiagnostics();
  const signals = createSignalStore(options.config?.signals ?? {});
  const input = createInputSignals(options.config);
  const assets = createSystemAssetAccess({
    config: options.config,
    registry: options.assetsRegistry,
    diagnostics,
    loader: options.assetLoader,
  });
  const commands = createCommandAccess(assets);
  const spatial = createSpatialQueries();
  const spawn = createSpawnCommands({
    world: options.world,
    registry: options.assetsRegistry,
    diagnostics,
    get assets() {
      return assets;
    },
  });
  const cameras = createCameraAccess(options.world);

  const context: ApertureSystemContext = {
    world: options.world,
    assetsRegistry: options.assetsRegistry,
    signals,
    input,
    assets,
    commands,
    spawn,
    spatial,
    cameras,
    diagnostics,
    effects: createScheduledEffects(),
  };

  installApertureSystemContext(options.world, context);
  return context;
}

export function registerApertureAppComponents(world: EcsWorld): EcsWorld {
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  world.registerComponent(AppEntityKey);
  world.registerComponent(AppEntityTags);
  world.registerComponent(AppEntitySource);
  return world;
}

export function flushApertureSystemEffects(
  world: EcsWorld,
  phase: ApertureEffectPhase = "update",
): void {
  for (const system of world.getSystems()) {
    const effects = readRegisteredEffects(system);
    effects?.flush(phase);
  }
}

export interface ApertureAssetLoader {
  load(asset: SystemAssetHandle<SystemAssetKind>): Promise<void>;
}

function getApertureSystemContext(world: EcsWorld): ApertureSystemContext {
  const context = world.globals[APERTURE_SYSTEM_CONTEXT_KEY];

  if (isApertureSystemContext(context)) {
    return context;
  }

  throw new ApertureSystemError(
    "aperture.systemContext.missing",
    "Aperture system context is not installed on the ECS world.",
    "Create the app through createApertureApp() or installApertureSystemContext() before registering app systems.",
  );
}

function isApertureSystemContext(
  value: unknown,
): value is ApertureSystemContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "signals" in value &&
    "spawn" in value &&
    "effects" in value
  );
}

class ApertureSystemError extends Error {
  readonly code: string;
  readonly suggestedFix: string;
  readonly detail: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: string,
    message: string,
    suggestedFix: string,
    detail?: Readonly<Record<string, unknown>>,
  ) {
    super(`${message} Suggested fix: ${suggestedFix}`);
    this.name = "ApertureSystemError";
    this.code = code;
    this.suggestedFix = suggestedFix;
    this.detail = detail;
  }
}

function createSignalStore(
  descriptors: Readonly<Record<string, ApertureSignalDescriptor>>,
): SignalStore {
  const output: SignalStore = {};

  for (const [key, descriptor] of Object.entries(descriptors)) {
    output[key] = createSignal(descriptor.initial);
  }

  return output;
}

function createInputSignals(config: ApertureConfig | undefined): InputSignals {
  const actions: Record<string, InputActionSignals> = {};

  for (const action of Object.keys(config?.input?.actions ?? {})) {
    actions[action] = {
      pressed: createSignal(false),
      value: createSignal(0),
    };
  }

  return {
    actions,
    pointer: {
      primary: {
        position: createSignal([0, 0] as const),
        pressed: createSignal(false),
      },
    },
    keyboard: {},
    gamepad: {},
    xr: {
      active: createSignal(false),
    },
  };
}

function createSystemAssetAccess(options: {
  readonly config: ApertureConfig | undefined;
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly loader: ApertureAssetLoader | undefined;
}): SystemAssetAccess {
  const assets = new Map<string, SystemAssetHandle<SystemAssetKind>>();
  const glbCache = createGlbUriLoadCache();
  const gltfCache = createGltfUriLoadCache();

  for (const [id, descriptor] of Object.entries(options.config?.assets ?? {})) {
    const handle = createSystemAssetHandle(id, descriptor);
    assets.set(id, handle);

    if (!options.registry.has(handle.renderHandle as SceneHandle)) {
      options.registry.register(handle.renderHandle as SceneHandle, {
        label: descriptor.label ?? descriptor.url,
      });
    }
  }

  async function request(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void> {
    const handle =
      typeof idOrHandle === "string" ? lookup(idOrHandle) : idOrHandle;
    const registryHandle = handle.renderHandle as SceneHandle;

    if (handle.ready.value) {
      return;
    }

    const entry = options.registry.get(registryHandle);
    if (entry?.status !== "loading") {
      options.registry.markLoading(registryHandle);
    }

    try {
      if (options.loader !== undefined) {
        await options.loader.load(handle);
      } else if (handle.kind === "gltf") {
        const scene = await loadSystemGltfAsset({
          handle: handle as SystemGltfAssetHandle,
          registry: options.registry,
          glbCache,
          gltfCache,
        });
        (handle as SystemGltfAssetHandle).scene.value = scene;
      }

      options.registry.markReady(registryHandle, {
        id: handle.id,
        kind: handle.kind,
        url: handle.url,
        ...sceneReadyMetadata(handle),
      });
      handle.ready.value = true;
      handle.error.value = null;
    } catch (error: unknown) {
      const diagnostic: ApertureSystemDiagnostic = {
        code: "aperture.asset.loadFailed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Asset '${handle.id}' failed to load.`,
        data: {
          asset: handle.id,
          kind: handle.kind,
          url: handle.url,
          phase: "load",
          blocksStartup: handle.preload === "blocking",
        },
        suggestedFix: "Check the asset URL in aperture.config.ts.",
      };

      options.registry.markFailed(registryHandle, [
        {
          code: diagnostic.code,
          severity: "error",
          message: diagnostic.message,
        },
      ]);
      handle.error.value = diagnostic;
      options.diagnostics.error(diagnostic.code, diagnostic.data);
      throw error;
    }
  }

  function lookup(id: string): SystemAssetHandle<SystemAssetKind> {
    const handle = assets.get(id);

    if (handle === undefined) {
      throw new ApertureSystemError(
        "aperture.asset.unknown",
        `Asset '${id}' is not declared in aperture.config.ts.`,
        "Add the asset to the config assets object before using this.assets.",
      );
    }

    return handle;
  }

  return {
    gltf(id) {
      const handle = lookup(id);
      if (handle.kind !== "gltf") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'gltf'.`,
          "Use this.assets.gltf() only with asset.gltf() declarations.",
        );
      }

      return handle as SystemGltfAssetHandle;
    },
    texture(id) {
      const handle = lookup(id);
      if (handle.kind !== "texture") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'texture'.`,
          "Use this.assets.texture() only with asset.texture() declarations.",
        );
      }

      return handle as SystemAssetHandle<"texture">;
    },
    hdr(id) {
      const handle = lookup(id);
      if (handle.kind !== "hdr") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'hdr'.`,
          "Use this.assets.hdr() only with asset.hdr() declarations.",
        );
      }

      return handle as SystemAssetHandle<"hdr">;
    },
    request,
    readiness(id) {
      return lookup(id).ready;
    },
    error(id) {
      return lookup(id).error;
    },
    list() {
      return [...assets.values()];
    },
  };
}

function createSystemAssetHandle(
  id: string,
  descriptor: ApertureConfigAssetDescriptor,
): SystemAssetHandle<SystemAssetKind> {
  if (descriptor.kind === "gltf") {
    return {
      id,
      kind: descriptor.kind,
      url: descriptor.url,
      preload: descriptor.preload,
      ready: createSignal(false),
      error: createSignal<ApertureSystemDiagnostic | null>(null),
      renderHandle: createSceneHandle(id),
      scene: createSignal<SystemGltfLoadedScene | null>(null),
    } as SystemGltfAssetHandle;
  }

  return {
    id,
    kind: descriptor.kind,
    url: descriptor.url,
    preload: descriptor.preload,
    ready: createSignal(false),
    error: createSignal<ApertureSystemDiagnostic | null>(null),
    renderHandle:
      descriptor.kind === "texture"
        ? createTextureHandle(id)
        : descriptor.kind === "hdr"
          ? createEnvironmentMapHandle(id)
          : createSceneHandle(id),
  } as SystemAssetHandle<SystemAssetKind>;
}

function createCommandAccess(assets: SystemAssetAccess): CommandAccess {
  const queues = new Map<string, unknown[]>();
  const assetRequests = new Map<string, CommandAssetRequestSummary>();
  let enqueued = 0;
  let drained = 0;
  let lastQueued: CommandChannelEntry | null = null;
  let lastDrained: CommandChannelEntry | null = null;

  return {
    async requestAsset(idOrHandle) {
      const id = typeof idOrHandle === "string" ? idOrHandle : idOrHandle.id;

      assetRequests.set(id, {
        id,
        status: "pending",
        ready: readinessValue(assets, id),
      });

      try {
        await assets.request(idOrHandle);
        assetRequests.set(id, {
          id,
          status: "ready",
          ready: readinessValue(assets, id),
        });
      } catch (error: unknown) {
        assetRequests.set(id, {
          id,
          status: "error",
          ready: readinessValue(assets, id),
          message: error instanceof Error ? error.message : String(error),
          ...errorCode(error),
        });
        throw error;
      }
    },
    queue(channel, payload) {
      const current = queues.get(channel) ?? [];
      current.push(payload);
      queues.set(channel, current);
      enqueued += 1;
      lastQueued = {
        channel,
        payload: jsonSafeValue(payload),
      };
    },
    drain<TCommand = unknown>(channel: string): TCommand[] {
      const current = queues.get(channel) ?? [];
      queues.set(channel, []);
      drained += current.length;
      if (current.length > 0) {
        lastDrained = {
          channel,
          payload: jsonSafeValue(current[current.length - 1]),
        };
      }
      return current as TCommand[];
    },
    summary() {
      return {
        enqueued,
        drained,
        queuedByChannel: Object.fromEntries(
          [...queues.entries()].map(([channel, values]) => [
            channel,
            values.length,
          ]),
        ),
        lastQueued,
        lastDrained,
        requestedAssets: [...assetRequests.values()],
      };
    },
  };
}

function readinessValue(assets: SystemAssetAccess, id: string): boolean {
  try {
    return assets.readiness(id).value;
  } catch {
    return false;
  }
}

function errorCode(error: unknown): { readonly errorCode?: string } {
  return typeof error === "object" &&
    error !== null &&
    typeof (error as { readonly code?: unknown }).code === "string"
    ? { errorCode: (error as { readonly code: string }).code }
    : {};
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

function createCameraAccess(world: EcsWorld): CameraAccess {
  function handles(): CameraHandle[] {
    const systemsContext = world.globals[APERTURE_SYSTEM_CONTEXT_KEY];
    void systemsContext;
    const entities = collectCameraEntities(world);
    return entities.map(cameraHandle);
  }

  const access: CameraAccess = {
    get main() {
      return access.byKey("camera.main") ?? handles()[0] ?? fallbackCamera();
    },
    get active() {
      return handles();
    },
    byKey(key) {
      for (const entity of collectCameraEntities(world)) {
        if (
          entity.hasComponent(AppEntityKey) &&
          entity.getValue(AppEntityKey, "value") === key
        ) {
          return cameraHandle(entity);
        }
      }

      return null;
    },
  };

  return access;
}

function collectCameraEntities(world: EcsWorld): Entity[] {
  return world
    .getSystems()
    .flatMap(() => [] as Entity[])
    .concat(collectEntitiesByComponents(world));
}

function collectEntitiesByComponents(world: EcsWorld): Entity[] {
  const query = world.queryManager.registerQuery({ required: [Camera] });
  return [...query.entities];
}

function cameraHandle(entity: Entity): CameraHandle {
  return {
    entity,
    ref: entityRef(entity),
    rayFromPointer(position) {
      return {
        origin: [position[0], position[1], 1],
        direction: [0, 0, -1],
      };
    },
  };
}

function fallbackCamera(): CameraHandle {
  throw new ApertureSystemError(
    "aperture.camera.missing",
    "No camera entity is available.",
    "Spawn a camera in a setup system or enable render.defaultCamera in aperture.config.ts.",
  );
}

function createDiagnostics(): SystemDiagnostics {
  const diagnostics: ApertureSystemDiagnostic[] = [];

  function push(
    severity: ApertureSystemDiagnostic["severity"],
    code: string,
    data?: Record<string, unknown>,
  ): void {
    diagnostics.push({
      code,
      severity,
      message: code,
      ...(data === undefined ? {} : { data }),
    });
  }

  return {
    info(code, data) {
      push("info", code, data);
    },
    warn(code, data) {
      push("warning", code, data);
    },
    error(code, data) {
      push("error", code, data);
    },
    list() {
      return diagnostics.map((diagnostic) => ({ ...diagnostic }));
    },
  };
}

function createSpawnCommands(options: {
  readonly world: EcsWorld;
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly assets: SystemAssetAccess;
}): SpawnCommands {
  return {
    camera(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "camera");
      addTransform(entity, input.transform);
      entity.addComponent(
        Camera,
        createCamera({
          ...(input.camera ?? {}),
          ...(input.fovYDegrees === undefined
            ? {}
            : { fovYRadians: (input.fovYDegrees * Math.PI) / 180 }),
        }),
      );
      return entity;
    },
    light(input = {}) {
      const entity = createEntityWithMetadata(options.world, input, "light");
      addTransform(entity, input.transform);
      entity.addComponent(
        Light,
        createLight({
          ...(input.light ?? {}),
          kind: input.kind ?? input.light?.kind ?? LightKind.Directional,
          ...(input.color === undefined ? {} : { color: input.color }),
          intensity:
            input.illuminance ?? input.intensity ?? input.light?.intensity ?? 1,
        }),
      );
      return entity;
    },
    mesh(input) {
      const entity = createEntityWithMetadata(options.world, input, "mesh");
      const meshHandle = resolveMeshHandle(options, input);
      const materialHandle = resolveMaterialHandle(options, input);

      addTransform(entity, input.transform);
      entity.addComponent(Mesh, { meshId: assetHandleKey(meshHandle) });
      entity.addComponent(Material, {
        materialId: assetHandleKey(materialHandle),
      });
      return entity;
    },
    gltf(handle, input = {}) {
      if (!handle.ready.value) {
        throw new ApertureSystemError(
          "aperture.spawn.gltfNotReady",
          `GLTF asset '${handle.id}' is not ready.`,
          "Use preload: 'blocking', wait for this.assets.gltf(id).ready, or call this.commands.requestAsset(id) before spawning.",
        );
      }

      const loadedScene = handle.scene.value;

      if (loadedScene === null) {
        const entity = createEntityWithMetadata(options.world, input, "gltf");
        addTransform(entity, input.transform);
        entity.addComponent(DebugMetadata, {
          tag: "gltf",
          note: handle.url,
        });
        entity.addComponent(AppEntitySource, {
          kind: "gltf",
          assetId: handle.id,
          gltfNodePath: "placeholder",
        });
        return entity;
      }

      const replay = replayGltfLoadedScene(options.world, loadedScene);
      const root = firstReplayRootEntity(loadedScene, replay);

      applyGltfSourceMetadata(options.world, loadedScene, replay);
      applySpawnMetadata(options.world, root, input, "gltf");
      writeTransform(root, input.transform);
      upsertDebugMetadata(root, {
        tag: "gltf",
        note: handle.url,
      });
      return root;
    },
  };
}

async function loadSystemGltfAsset(input: {
  readonly handle: SystemGltfAssetHandle;
  readonly registry: AssetRegistry;
  readonly glbCache: ReturnType<typeof createGlbUriLoadCache>;
  readonly gltfCache: ReturnType<typeof createGltfUriLoadCache>;
}): Promise<SystemGltfLoadedScene> {
  const resolvedUrl = resolveAssetUrl(input.handle.url);

  if (resolvedUrl === null) {
    throw new ApertureSystemError(
      "aperture.asset.invalidUrl",
      `GLTF asset '${input.handle.id}' URL '${input.handle.url}' could not be resolved.`,
      "Use an absolute URL, a root-relative Vite public asset URL, or a data URL in aperture.config.ts.",
      {
        asset: input.handle.id,
        url: input.handle.url,
        kind: input.handle.kind,
        preload: input.handle.preload,
        phase: "load",
        blocksStartup: input.handle.preload === "blocking",
      },
    );
  }

  const sourceKind = gltfSourceKindFromUrl(resolvedUrl);
  const loaded =
    sourceKind === "gltf"
      ? await loadGltfFromUri(resolvedUrl, {
          cache: input.gltfCache,
          keyPrefix: input.handle.id,
          createAssetMapping: true,
          createMeshAssets: true,
        })
      : await loadGlbFromUri(resolvedUrl, {
          cache: input.glbCache,
          keyPrefix: input.handle.id,
          createAssetMapping: true,
          createMeshAssets: true,
        });
  const importReport =
    loaded.loader === null
      ? null
      : "gltfImportReport" in loaded.loader
        ? loaded.loader.gltfImportReport
        : loaded.loader.glbImportReport.importReport;

  if (!loaded.ok || importReport === null) {
    throw new ApertureSystemError(
      "aperture.asset.gltfLoadFailed",
      `GLTF asset '${input.handle.id}' failed to load. ${formatReportDiagnostics(
        loaded.diagnostics,
      )}`,
      "Check the asset URL in aperture.config.ts and use a supported glTF/GLB file.",
    );
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new ApertureSystemError(
      "aperture.asset.gltfNotRenderable",
      `GLTF asset '${input.handle.id}' did not produce renderable mesh/material reports.`,
      "Use a glTF/GLB with triangle mesh primitives and supported material inputs.",
    );
  }

  const defaultMaterialHandle = createMaterialHandle(
    `${input.handle.id}.default-material`,
  );
  const defaultMaterialHandleKey = assetHandleKey(defaultMaterialHandle);
  if (!input.registry.has(defaultMaterialHandle)) {
    input.registry.register(defaultMaterialHandle, {
      label: `${input.handle.id} default GLTF material`,
    });
    input.registry.markReady(
      defaultMaterialHandle,
      createStandardMaterialAsset({
        label: `${input.handle.id} default GLTF material`,
      }),
    );
  }

  const registration = registerGltfSourceAssetsFromReports({
    registry: input.registry,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });

  if (
    !registration.valid ||
    registration.sourceRegistration === null ||
    registration.meshRegistration === null
  ) {
    throw new ApertureSystemError(
      "aperture.asset.gltfRegistrationFailed",
      `GLTF asset '${input.handle.id}' source assets could not be registered. ${formatReportDiagnostics(
        registration.diagnostics,
      )}`,
      "Check for duplicate generated asset keys or unsupported glTF source assets.",
    );
  }

  const primitiveMaterials = createGltfPrimitiveMaterialResolutionReport({
    primitiveReport: importReport.meshPrimitive,
    registrationReport: registration.sourceRegistration,
    availableMaterialHandleKeys: [defaultMaterialHandleKey],
    defaultMaterialHandleKey,
    keyPrefix: input.handle.id,
  });

  if (!primitiveMaterials.valid) {
    throw new ApertureSystemError(
      "aperture.asset.gltfMaterialResolutionFailed",
      `GLTF asset '${input.handle.id}' primitive materials could not be resolved. ${formatReportDiagnostics(
        primitiveMaterials.diagnostics,
      )}`,
      "Use supported glTF materials or provide material data for all primitives.",
    );
  }

  const commandPlan = createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: registration.meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
  });

  if (!commandPlan.valid) {
    throw new ApertureSystemError(
      "aperture.asset.gltfCommandPlanFailed",
      `GLTF asset '${input.handle.id}' could not be converted to ECS spawn commands. ${formatReportDiagnostics(
        commandPlan.diagnostics,
      )}`,
      "Check the glTF scene hierarchy and mesh primitive data.",
    );
  }

  return {
    assetId: input.handle.id,
    url: loaded.url,
    sourceKind,
    byteLength: loaded.byteLength,
    importReport,
    sourceRegistration: registration.sourceRegistration,
    meshRegistration: registration.meshRegistration,
    primitiveMaterials,
    commandPlan,
    defaultMaterialHandleKey,
  };
}

function applyGltfSourceMetadata(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): void {
  registerApertureAppComponents(world);

  for (const [entityKey, entity] of replay.entitiesByKey) {
    upsertAppEntitySource(entity, sourceFromGltfEntityKey(scene, entityKey));
  }
}

function sourceFromGltfEntityKey(
  scene: SystemGltfLoadedScene,
  entityKey: string,
): {
  readonly kind: string;
  readonly assetId: string;
  readonly gltfNodeIndex: number;
  readonly gltfNodePath: string;
} {
  const prefix = `${scene.assetId}:`;
  const localKey = entityKey.startsWith(prefix)
    ? entityKey.slice(prefix.length)
    : entityKey;

  if (localKey.startsWith("scene:")) {
    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: -1,
      gltfNodePath: localKey,
    };
  }

  const match = /^node:(\d+)(?::mesh:(\d+):primitive:(\d+))?$/u.exec(localKey);

  if (match !== null) {
    const nodeIndex = Number(match[1]);
    const meshIndex = match[2] === undefined ? null : Number(match[2]);
    const primitiveIndex = match[3] === undefined ? null : Number(match[3]);

    return {
      kind: "gltf",
      assetId: scene.assetId,
      gltfNodeIndex: nodeIndex,
      gltfNodePath:
        meshIndex === null || primitiveIndex === null
          ? `nodes[${nodeIndex}]`
          : `nodes[${nodeIndex}].mesh[${meshIndex}].primitives[${primitiveIndex}]`,
    };
  }

  return {
    kind: "gltf",
    assetId: scene.assetId,
    gltfNodeIndex: -1,
    gltfNodePath: localKey,
  };
}

function upsertAppEntitySource(
  entity: Entity,
  value: {
    readonly kind: string;
    readonly assetId: string;
    readonly gltfNodeIndex: number;
    readonly gltfNodePath: string;
  },
): void {
  if (entity.hasComponent(AppEntitySource)) {
    entity.setValue(AppEntitySource, "kind", value.kind);
    entity.setValue(AppEntitySource, "assetId", value.assetId);
    entity.setValue(AppEntitySource, "gltfNodeIndex", value.gltfNodeIndex);
    entity.setValue(AppEntitySource, "gltfNodePath", value.gltfNodePath);
    return;
  }

  entity.addComponent(AppEntitySource, value);
}

function sceneReadyMetadata(
  handle: SystemAssetHandle<SystemAssetKind>,
): Record<string, unknown> {
  if (handle.kind !== "gltf") {
    return {};
  }

  const scene = (handle as SystemGltfAssetHandle).scene.value;

  if (scene === null) {
    return {};
  }

  return {
    sourceKind: scene.sourceKind,
    byteLength: scene.byteLength,
    sceneIndex: scene.importReport.sceneTraversal.sceneIndex,
    rootEntityKeys: scene.commandPlan.rootEntityKeys,
    commandCount: scene.commandPlan.commands.length,
    meshPrimitiveCount: scene.importReport.meshPrimitive?.meshes.length ?? 0,
    meshAssetCount: scene.meshRegistration.written.length,
    materialAssetCount: scene.sourceRegistration.written.filter(
      (entry) => entry.kind === "material",
    ).length,
  };
}

function replayGltfLoadedScene(
  world: EcsWorld,
  scene: SystemGltfLoadedScene,
): GltfEcsCommandReplayReport {
  const replay = replayGltfEcsAuthoringCommands({
    world,
    plan: scene.commandPlan,
  });

  if (!replay.valid) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfReplayFailed",
      `GLTF ECS commands could not be replayed. ${formatReportDiagnostics(
        replay.diagnostics,
      )}`,
      "Check the loaded glTF scene command plan diagnostics.",
    );
  }

  return replay;
}

function firstReplayRootEntity(
  scene: SystemGltfLoadedScene,
  replay: GltfEcsCommandReplayReport,
): Entity {
  const rootKey = scene.commandPlan.rootEntityKeys[0];
  const root =
    rootKey === undefined
      ? undefined
      : (replay.entitiesByKey.get(rootKey) ??
        replay.entitiesByKey.values().next().value);

  if (root === undefined) {
    throw new ApertureSystemError(
      "aperture.spawn.gltfRootMissing",
      "GLTF scene replay did not create a root entity.",
      "Check the loaded glTF scene traversal report.",
    );
  }

  return root;
}

function resolveAssetUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    const href = (
      globalThis as { readonly location?: { readonly href?: string } }
    ).location?.href;

    if (href === undefined) {
      return null;
    }

    try {
      return new URL(url, href).href;
    } catch {
      return null;
    }
  }
}

function gltfSourceKindFromUrl(url: string): "glb" | "gltf" {
  if (url.startsWith("data:")) {
    return "glb";
  }

  try {
    return new URL(url).pathname.toLowerCase().endsWith(".gltf")
      ? "gltf"
      : "glb";
  } catch {
    return url.toLowerCase().endsWith(".gltf") ? "gltf" : "glb";
  }
}

function formatReportDiagnostics(
  diagnostics: readonly { readonly code?: string; readonly message?: string }[],
): string {
  if (diagnostics.length === 0) {
    return "No detailed diagnostics were produced.";
  }

  return diagnostics
    .slice(0, 3)
    .map((diagnostic) =>
      diagnostic.code === undefined
        ? (diagnostic.message ?? "Unknown diagnostic.")
        : `${diagnostic.code}: ${diagnostic.message ?? "Unknown diagnostic."}`,
    )
    .join(" ");
}

function createEntityWithMetadata(
  world: EcsWorld,
  metadata: SpawnMetadata,
  fallbackName: string,
): Entity {
  const entity = world.createEntity();

  applySpawnMetadata(world, entity, metadata, fallbackName);
  return entity;
}

function applySpawnMetadata(
  world: EcsWorld,
  entity: Entity,
  metadata: SpawnMetadata,
  fallbackName: string,
): void {
  registerApertureAppComponents(world);

  if (!entity.hasComponent(Enabled)) {
    entity.addComponent(Enabled, { value: true });
  }

  if (metadata.name !== undefined) {
    upsertName(entity, metadata.name);
  } else if (!entity.hasComponent(Name)) {
    entity.addComponent(Name, { value: fallbackName });
  }

  if (metadata.key !== undefined) {
    assertUniqueKey(world, metadata.key);
    if (entity.hasComponent(AppEntityKey)) {
      entity.setValue(AppEntityKey, "value", metadata.key);
    } else {
      entity.addComponent(AppEntityKey, { value: metadata.key });
    }
  }

  if (metadata.tags !== undefined) {
    const valuesJson = JSON.stringify([...metadata.tags]);
    if (entity.hasComponent(AppEntityTags)) {
      entity.setValue(AppEntityTags, "valuesJson", valuesJson);
    } else {
      entity.addComponent(AppEntityTags, { valuesJson });
    }
  }
}

function upsertName(entity: Entity, value: string): void {
  if (entity.hasComponent(Name)) {
    entity.setValue(Name, "value", value);
    return;
  }

  entity.addComponent(Name, { value });
}

function upsertDebugMetadata(
  entity: Entity,
  value: { readonly tag: string; readonly note: string },
): void {
  if (entity.hasComponent(DebugMetadata)) {
    entity.setValue(DebugMetadata, "tag", value.tag);
    entity.setValue(DebugMetadata, "note", value.note);
    return;
  }

  entity.addComponent(DebugMetadata, value);
}

function assertUniqueKey(world: EcsWorld, key: string): void {
  const query = world.queryManager.registerQuery({
    required: [AppEntityKey],
    where: [{ component: AppEntityKey, key: "value", op: "eq", value: key }],
  });

  if (query.entities.size > 0) {
    throw new ApertureSystemError(
      "aperture.entityKey.duplicate",
      `Entity key '${key}' is already in use.`,
      "Use globally unique app keys or omit key and rely on { index, generation } identity.",
    );
  }
}

function addTransform(entity: Entity, input: SystemTransformInput = {}): void {
  writeTransform(entity, input);
}

function writeTransform(
  entity: Entity,
  input: SystemTransformInput = {},
): void {
  const localInput: LocalTransformInput = {
    translation: input.translation,
    rotation: input.rotation ?? rotationFromTransformInput(input),
    scale: input.scale,
  };
  const root = createRootTransform(localInput);
  const parent = createParentInput(input.parent ?? null);
  const local = {
    translation: root.local.translation ?? [0, 0, 0],
    rotation: root.local.rotation ?? [0, 0, 0, 1],
    scale: root.local.scale ?? [1, 1, 1],
  } as const;
  const world = {
    col0: root.world.col0 ?? [1, 0, 0, 0],
    col1: root.world.col1 ?? [0, 1, 0, 0],
    col2: root.world.col2 ?? [0, 0, 1, 0],
    col3: root.world.col3 ?? [0, 0, 0, 1],
  } as const;

  if (entity.hasComponent(LocalTransform)) {
    entity.getVectorView(LocalTransform, "translation").set(local.translation);
    entity.getVectorView(LocalTransform, "rotation").set(local.rotation);
    entity.getVectorView(LocalTransform, "scale").set(local.scale);
  } else {
    entity.addComponent(LocalTransform, local);
  }

  if (entity.hasComponent(Parent)) {
    entity.setValue(Parent, "entity", parent.entity);
  } else {
    entity.addComponent(Parent, parent);
  }

  if (entity.hasComponent(WorldTransform)) {
    entity.getVectorView(WorldTransform, "col0").set(world.col0);
    entity.getVectorView(WorldTransform, "col1").set(world.col1);
    entity.getVectorView(WorldTransform, "col2").set(world.col2);
    entity.getVectorView(WorldTransform, "col3").set(world.col3);
  } else {
    entity.addComponent(WorldTransform, world);
  }
}

function createParentInput(parent: Entity | null): {
  readonly entity: Entity | null;
} {
  return { entity: parent };
}

function rotationFromTransformInput(
  input: SystemTransformInput,
): readonly [number, number, number, number] | undefined {
  if (input.rotationEulerDegrees !== undefined) {
    return quatFromEulerDegrees(input.rotationEulerDegrees);
  }

  if (input.lookAt !== undefined && input.translation !== undefined) {
    return quatLookAt(input.translation, input.lookAt);
  }

  return undefined;
}

function quatFromEulerDegrees(
  degrees: Vec3Like,
): readonly [number, number, number, number] {
  const x = (read3(degrees, 0) * Math.PI) / 180;
  const y = (read3(degrees, 1) * Math.PI) / 180;
  const z = (read3(degrees, 2) * Math.PI) / 180;
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

function quatLookAt(
  translation: Vec3Like,
  target: Vec3Like,
): readonly [number, number, number, number] {
  const dx = read3(target, 0) - read3(translation, 0);
  const dy = read3(target, 1) - read3(translation, 1);
  const dz = read3(target, 2) - read3(translation, 2);
  const length = Math.hypot(dx, dy, dz);

  if (length <= 1e-6) {
    return [0, 0, 0, 1];
  }

  const forward: [number, number, number] = [
    dx / length,
    dy / length,
    dz / length,
  ];
  let right = normalize3(cross3([0, 1, 0], negate3(forward)));

  if (right === null) {
    right = [1, 0, 0];
  }

  const up = cross3(negate3(forward), right);
  const back = negate3(forward);

  return quatFromBasis(right, up, back);
}

function negate3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [-value[0], -value[1], -value[2]];
}

function cross3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(
  value: readonly [number, number, number],
): [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= 1e-6) {
    return null;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}

function quatFromBasis(
  right: readonly [number, number, number],
  up: readonly [number, number, number],
  back: readonly [number, number, number],
): readonly [number, number, number, number] {
  const m00 = right[0];
  const m01 = up[0];
  const m02 = back[0];
  const m10 = right[1];
  const m11 = up[1];
  const m12 = back[1];
  const m20 = right[2];
  const m21 = up[2];
  const m22 = back[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }

  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }

  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }

  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

function resolveMeshHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MeshHandle {
  if ("kind" in input.mesh && input.mesh.kind !== "mesh") {
    const id = `${input.key ?? input.name ?? "mesh"}.mesh`;
    const handle = createMeshHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      primitiveToMeshAsset(input.mesh),
    );
    return handle;
  }

  return input.mesh as MeshHandle;
}

function resolveMaterialHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MaterialHandle {
  if ("kind" in input.material && input.material.kind !== "material") {
    const id = `${input.key ?? input.name ?? "mesh"}.material`;
    const handle = createMaterialHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      materialDescriptorToAsset(input.material),
    );
    return handle;
  }

  return input.material as MaterialHandle;
}

function registerReadyAsset<TAsset>(
  registry: AssetRegistry,
  handle: MeshHandle | MaterialHandle,
  assetValue: TAsset,
): void {
  if (!registry.has(handle)) {
    registry.register(handle);
  }

  registry.markReady(handle, assetValue);
}

function primitiveToMeshAsset(
  descriptorValue: PrimitiveMeshDescriptor,
): MeshAsset {
  switch (descriptorValue.kind) {
    case "box": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size, size]
          : Array.isArray(size)
            ? size
            : [1, 1, 1];
      return createBoxMeshAsset({
        width: read3(tuple, 0),
        height: read3(tuple, 1),
        depth: read3(tuple, 2),
      });
    }
    case "sphere":
      return createSphereMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        widthSegments: numberOption(descriptorValue.options.segments, 32),
        heightSegments: numberOption(descriptorValue.options.segments, 16),
      });
    case "capsule":
      return createCapsuleMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 2),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "plane": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size]
          : Array.isArray(size)
            ? size
            : [1, 1];
      return createPlaneMeshAsset({
        width: read2(tuple, 0),
        height: read2(tuple, 1),
      });
    }
    case "cylinder":
      return createCylinderMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "cone":
      return createConeMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
  }
}

function materialDescriptorToAsset(
  descriptorValue: StandardMaterialDescriptor,
): MaterialAsset {
  return createStandardMaterialAsset({
    ...(descriptorValue.options.label === undefined
      ? {}
      : { label: descriptorValue.options.label }),
    ...(descriptorValue.options.baseColor === undefined
      ? {}
      : {
          baseColorFactor: new Float32Array([
            read4(descriptorValue.options.baseColor, 0),
            read4(descriptorValue.options.baseColor, 1),
            read4(descriptorValue.options.baseColor, 2),
            read4(descriptorValue.options.baseColor, 3),
          ]),
        }),
    ...(descriptorValue.options.roughness === undefined
      ? {}
      : { roughnessFactor: descriptorValue.options.roughness }),
    ...(descriptorValue.options.metallic === undefined
      ? {}
      : { metallicFactor: descriptorValue.options.metallic }),
  });
}

function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: Record<string, unknown>,
): PrimitiveMeshDescriptor {
  return Object.freeze({ kind, options: { ...options } });
}

function createScheduledEffects(): ScheduledEffects {
  const entries = new Set<{
    readonly phase: ApertureEffectPhase;
    readonly priority: number;
    readonly dispose: () => void;
    readonly pending: unknown[];
    readonly callback: (value: never) => void;
  }>();

  return {
    watch(watched, callback, options = {}) {
      const entry = {
        phase: options.phase ?? "input",
        priority: options.priority ?? 0,
        dispose: () => undefined,
        pending: [] as unknown[],
        callback: callback as (value: never) => void,
      };
      let initialized = false;
      const unsubscribe = watched.subscribe((value) => {
        if (!initialized) {
          initialized = true;
          return;
        }

        entry.pending.push(value);
      });
      const disposable = { ...entry, dispose: unsubscribe };
      entries.add(disposable);

      return {
        dispose() {
          unsubscribe();
          entries.delete(disposable);
        },
      };
    },
    onQueryEnter(query, callback, options = {}) {
      if (query.subscribe === undefined) {
        throw new ApertureSystemError(
          "aperture.effects.querySubscribeMissing",
          "Query enter effects require an EliCS query with subscribe().",
          "Pass an app system query from this.queries.",
        );
      }

      const entry = {
        phase: options.phase ?? "update",
        priority: options.priority ?? 0,
        dispose: () => undefined,
        pending: [] as unknown[],
        callback: callback as (value: never) => void,
      };
      const unsubscribe = query.subscribe("qualify", (entity) => {
        entry.pending.push(entity);
      });
      const disposable = { ...entry, dispose: unsubscribe };
      entries.add(disposable);

      return {
        dispose() {
          unsubscribe();
          entries.delete(disposable);
        },
      };
    },
    flush(phase = "update") {
      const ready = [...entries]
        .filter((entry) => entry.phase === phase && entry.pending.length > 0)
        .sort((a, b) => a.priority - b.priority);

      for (const entry of ready) {
        const pending = entry.pending.splice(0);

        for (const value of pending) {
          entry.callback(value as never);
        }
      }
    },
    dispose() {
      for (const entry of entries) {
        entry.dispose();
      }

      entries.clear();
    },
  };
}

function registerSystemEffects(
  system: object,
  effects: ScheduledEffects,
): void {
  Object.defineProperty(system, APERTURE_EFFECTS, {
    value: effects,
    configurable: false,
  });
}

function readRegisteredEffects(system: unknown): ScheduledEffects | null {
  if (typeof system !== "object" || system === null) {
    return null;
  }

  const value = (system as Record<PropertyKey, unknown>)[APERTURE_EFFECTS];
  return isEffects(value) ? value : null;
}

function isEffects(value: unknown): value is ScheduledEffects {
  return (
    typeof value === "object" &&
    value !== null &&
    "flush" in value &&
    "dispose" in value
  );
}

function entityRef(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function read2(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read3(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read4(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function numberOption(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function assetDiagnosticFromSystemDiagnostic(
  diagnostic: ApertureSystemDiagnostic,
): AssetDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
  };
}
