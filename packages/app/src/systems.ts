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
  createBoxMeshAsset,
  createCamera,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createLight,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  registerRenderAuthoringComponents,
  type CameraInput,
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
  raycast as raycastBounds,
  registerMetadataComponents,
  registerTransformComponents,
  type AssetDiagnostic,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type LocalTransformInput,
  type MaterialHandle,
  type MeshHandle,
  type RaycastableBounds,
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
};

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
}

export interface RayInput {
  readonly origin: Vec3Like;
  readonly direction: Vec3Like;
}

export interface SpatialRaycastOptions {
  readonly query?: ApertureQuery;
  readonly maxDistance?: number;
  readonly layerMask?: number;
}

export interface SpatialRaycastHit {
  readonly entity: {
    readonly entity: Entity;
    readonly ref: EcsEntityRef;
  };
  readonly distance: number;
  readonly point: readonly [number, number, number];
}

export interface SpatialQueries {
  raycast(
    ray: RayInput,
    options?: SpatialRaycastOptions,
  ): SpatialRaycastHit | null;
  setBounds(bounds: readonly RaycastableBounds<Entity>[]): void;
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

  constructor(code: string, message: string, suggestedFix: string) {
    super(`${message} Suggested fix: ${suggestedFix}`);
    this.name = "ApertureSystemError";
    this.code = code;
    this.suggestedFix = suggestedFix;
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
      await options.loader?.load(handle);
      options.registry.markReady(registryHandle, {
        id: handle.id,
        kind: handle.kind,
        url: handle.url,
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

  return {
    requestAsset(idOrHandle) {
      return assets.request(idOrHandle);
    },
    queue(channel, payload) {
      const current = queues.get(channel) ?? [];
      current.push(payload);
      queues.set(channel, current);
    },
    drain<TCommand = unknown>(channel: string): TCommand[] {
      const current = queues.get(channel) ?? [];
      queues.set(channel, []);
      return current as TCommand[];
    },
  };
}

function createSpatialQueries(): SpatialQueries {
  let bounds: readonly RaycastableBounds<Entity>[] = [];

  return {
    raycast(ray, options = {}) {
      const queryEntities = options.query?.entities;
      const candidates =
        queryEntities === undefined
          ? bounds
          : bounds.filter((candidate) => queryEntities.has(candidate.entity));
      const [hit] = raycastBounds(candidates, ray.origin, ray.direction, {
        ...(options.maxDistance === undefined
          ? {}
          : { maxDistance: options.maxDistance }),
        ...(options.layerMask === undefined
          ? {}
          : { layerMask: options.layerMask }),
      });

      if (hit === undefined) {
        return null;
      }

      return {
        entity: {
          entity: hit.entity,
          ref: entityRef(hit.entity),
        },
        distance: hit.distance,
        point: tuple3(hit.point),
      };
    },
    setBounds(nextBounds) {
      bounds = [...nextBounds];
    },
  };
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

      const entity = createEntityWithMetadata(options.world, input, "gltf");
      addTransform(entity, input.transform);
      entity.addComponent(DebugMetadata, {
        tag: "gltf",
        note: handle.url,
      });
      return entity;
    },
  };
}

function createEntityWithMetadata(
  world: EcsWorld,
  metadata: SpawnMetadata,
  fallbackName: string,
): Entity {
  registerApertureAppComponents(world);
  const entity = world.createEntity();
  const name = metadata.name ?? fallbackName;

  entity.addComponent(Enabled, { value: true });
  entity.addComponent(Name, { value: name });

  if (metadata.key !== undefined) {
    assertUniqueKey(world, metadata.key);
    entity.addComponent(AppEntityKey, { value: metadata.key });
  }

  if (metadata.tags !== undefined) {
    entity.addComponent(AppEntityTags, {
      valuesJson: JSON.stringify([...metadata.tags]),
    });
  }

  return entity;
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
  const localInput: LocalTransformInput = {
    translation: input.translation,
    rotation: input.rotation ?? rotationFromTransformInput(input),
    scale: input.scale,
  };
  const root = createRootTransform(localInput);

  entity.addComponent(LocalTransform, root.local);
  entity.addComponent(Parent, createParentInput(input.parent ?? null));
  entity.addComponent(WorldTransform, root.world);
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

function tuple3(values: ArrayLike<number>): [number, number, number] {
  return [read3(values, 0), read3(values, 1), read3(values, 2)];
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
