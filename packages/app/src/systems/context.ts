import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type { ApertureConfig } from "../config.js";
import {
  createInputResource,
  type InputAction,
  type InputResourceBase,
} from "../input/state.js";
import { createSpatialQueries, type SpatialQueries } from "../spatial/index.js";
import { createDiagnostics, type SystemDiagnostics } from "./diagnostics.js";
import { createScheduledEffects, type ScheduledEffects } from "./effects.js";
import { ApertureSystemError } from "./errors.js";
import { createCommandAccess, type CommandAccess } from "./commands.js";
import {
  createSystemAssetAccess,
  type ApertureAssetLoader,
  type SystemGltfAssetDecoderProvider,
  type SystemAssetAccess,
} from "./assets.js";
import { registerApertureAppComponents } from "./components.js";
import { createApertureRandom, type ApertureRandom } from "./random.js";
import {
  createApertureFrameTime,
  type ApertureFrameTime,
} from "./frame-time.js";
import {
  createApertureDeterminismDiagnostics,
  type ApertureDeterminismDiagnostics,
  type ApertureDeterminismDiagnosticsOptions,
} from "./determinism.js";
import { createCameraAccess, type CameraAccess } from "./cameras.js";
import { createGltfInstanceAccess, type GltfInstanceAccess } from "./gltf.js";
import { createHierarchyAccess, type HierarchyAccess } from "./hierarchy.js";
import {
  createInteractionAccess,
  type InteractionAccess,
} from "../interaction/access.js";
import { createMaterialAccess, type MaterialAccess } from "./materials.js";
import { createMeshAccess, type MeshAccess } from "./meshes.js";
import { createPhysicsAccess, type PhysicsAccess } from "./physics.js";
import { createPrefabAccess, type PrefabAccess } from "./prefabs.js";
import { createParticleAccess, type ParticleAccess } from "./particles.js";
import { createAudioAccess, type AudioAccess } from "./audio.js";
import { createTrailAccess, type TrailAccess } from "./trails.js";
import { createSignalStore, type SignalStore } from "./signals.js";
import { createResourceStore, type ResourceStore } from "./resources.js";
import {
  createStartOptionsAccess,
  type StartOptionsAccess,
} from "./start-options.js";
import { createSpawnCommands, type SpawnCommands } from "./spawn/index.js";
import {
  createFixedStepAccess,
  type FixedStepAccess,
  type FixedStepTaskRegistrar,
} from "./fixed-step.js";
import {
  createHtmlBridgeAccess,
  type HtmlBridgeAccess,
} from "./html-bridge.js";

// This interface is intentionally empty so generated app-local declarations can
// augment it with kind-specific action properties.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApertureGeneratedActionMap {}

export type InputActions = ApertureGeneratedActionMap &
  Record<string, InputAction>;

export type InputSignals = Omit<InputResourceBase, "actions"> & {
  readonly actions: InputActions;
};

export interface ApertureSystemContext {
  readonly world: unknown;
  readonly assetsRegistry: AssetRegistry;
  /** Deterministic seeded RNG — use instead of Math.random() for replayability. */
  readonly random: ApertureRandom;
  /** Sanctioned sim-time — use instead of Date.now()/performance.now(). */
  readonly time: ApertureFrameTime;
  readonly signals: SignalStore;
  readonly resources: ResourceStore;
  readonly startOptions: StartOptionsAccess;
  readonly input: InputSignals;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly gltf: GltfInstanceAccess;
  readonly hierarchy: HierarchyAccess;
  readonly prefabs: PrefabAccess;
  readonly particles: ParticleAccess;
  readonly audio: AudioAccess;
  readonly materials: MaterialAccess;
  readonly meshes: MeshAccess;
  readonly trails: TrailAccess;
  readonly physics: PhysicsAccess;
  readonly fixedStep: FixedStepAccess;
  readonly interaction: InteractionAccess;
  readonly html: HtmlBridgeAccess;
  readonly diagnostics: SystemDiagnostics;
  readonly effects: ScheduledEffects;
  readonly determinism: ApertureDeterminismDiagnostics;
}

export interface CreateApertureSystemContextOptions {
  readonly world: EcsWorld;
  readonly assetsRegistry: AssetRegistry;
  readonly config?: ApertureConfig;
  readonly startOptions?: Readonly<Record<string, unknown>>;
  readonly assetLoader?: ApertureAssetLoader;
  readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
  readonly registerFixedStepTask?: FixedStepTaskRegistrar;
  /** Seed for the deterministic RNG (default 0) or a prebuilt RNG instance. */
  readonly random?: number | ApertureRandom;
  readonly determinism?: ApertureDeterminismDiagnosticsOptions;
}

const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";

export function installApertureSystemContext(
  world: EcsWorld,
  context: ApertureSystemContext,
): void {
  world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}

export function createApertureSystemContext(
  options: CreateApertureSystemContextOptions,
): ApertureSystemContext {
  registerApertureAppComponents(options.world);

  const diagnostics = createDiagnostics();
  const signals = createSignalStore(options.config?.signals ?? {});
  const resources = createResourceStore();
  const startOptions = createStartOptionsAccess(options.startOptions);
  const input = createInputSignals(options.config);
  const assets = createSystemAssetAccess({
    config: options.config,
    registry: options.assetsRegistry,
    diagnostics,
    loader: options.assetLoader,
    ...(options.gltfAssetDecoders === undefined
      ? {}
      : { gltfAssetDecoders: options.gltfAssetDecoders }),
  });
  const commands = createCommandAccess(assets);
  const physics = createPhysicsAccess({ world: options.world });
  const spatial = createSpatialQueries({
    colliders: {
      world: options.world,
      getPhysicsBackend: () => physics.getBackend(),
    },
  });
  const spawn = createSpawnCommands({
    world: options.world,
    registry: options.assetsRegistry,
    diagnostics,
    get assets() {
      return assets;
    },
  });
  const cameras = createCameraAccess(options.world, {
    contextKey: APERTURE_SYSTEM_CONTEXT_KEY,
  });
  const gltf = createGltfInstanceAccess(options.world);
  const hierarchy = createHierarchyAccess(options.world);
  const prefabs = createPrefabAccess(options.assetsRegistry);
  const particles = createParticleAccess({ world: options.world, assets });
  const audio = createAudioAccess({ world: options.world, assets });
  const materials = createMaterialAccess(options.assetsRegistry);
  const meshes = createMeshAccess(options.assetsRegistry);
  const trails = createTrailAccess({
    registry: options.assetsRegistry,
    meshes,
    spawn,
  });
  const fixedStep = createFixedStepAccess(options.registerFixedStepTask);
  const interaction = createInteractionAccess(options.world);
  const html = createHtmlBridgeAccess(resources);

  const random =
    typeof options.random === "object"
      ? options.random
      : createApertureRandom(options.random ?? 0);
  const time = createApertureFrameTime();
  const determinism = createApertureDeterminismDiagnostics({
    diagnostics,
    ...(options.determinism?.globals === undefined
      ? {}
      : { mode: options.determinism.globals }),
  });

  const context: ApertureSystemContext = {
    world: options.world,
    assetsRegistry: options.assetsRegistry,
    random,
    time,
    signals,
    resources,
    startOptions,
    input,
    assets,
    commands,
    spawn,
    spatial,
    cameras,
    gltf,
    hierarchy,
    prefabs,
    particles,
    audio,
    materials,
    meshes,
    trails,
    physics,
    fixedStep,
    interaction,
    html,
    diagnostics,
    effects: createScheduledEffects(),
    determinism,
  };

  installApertureSystemContext(options.world, context);
  return context;
}

export function getApertureSystemContext(
  world: EcsWorld,
): ApertureSystemContext {
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
    "resources" in value &&
    "startOptions" in value &&
    "spawn" in value &&
    "meshes" in value &&
    "gltf" in value &&
    "trails" in value &&
    "particles" in value &&
    "audio" in value &&
    "html" in value &&
    "effects" in value
  );
}

function createInputSignals(config: ApertureConfig | undefined): InputSignals {
  return createInputResource(config) as InputSignals;
}
