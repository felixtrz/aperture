import {
  createPhysicsWorldSyncState,
  stepPhysicsWorld,
  type PhysicsBackend,
  type PhysicsColliderGeometryProvider,
  type PhysicsExecutionMode,
  type PhysicsHeightfieldGeometry,
  type PhysicsVec3,
} from "@aperture-engine/physics";
import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type {
  SimulationFixedStepCallback,
  SimulationFixedStepTaskOptions,
} from "@aperture-engine/runtime";
import { createAssetBackedPhysicsColliderGeometryProvider } from "./physics-collider-geometry.js";
import type { PhysicsAccess } from "./systems/physics.js";

export type AperturePhysicsBackendConfig =
  | "rapier"
  | PhysicsBackend
  | (() => PhysicsBackend | Promise<PhysicsBackend>);

export type AperturePhysicsColliderGeometryConfig =
  | { readonly kind: "none" }
  | {
      readonly kind: "provider";
      readonly provider: PhysicsColliderGeometryProvider;
    }
  | {
      readonly kind: "assets";
      readonly heightfields?:
        | ReadonlyMap<string, PhysicsHeightfieldGeometry>
        | Readonly<Record<string, PhysicsHeightfieldGeometry>>;
    };

export interface AperturePhysicsConfig {
  readonly backend?: AperturePhysicsBackendConfig;
  readonly gravity?: PhysicsVec3;
  readonly execution?: PhysicsExecutionMode;
  readonly colliderGeometry?: AperturePhysicsColliderGeometryConfig;
}

export interface AperturePhysicsFacade {
  readonly backend: PhysicsBackend;
  unregister(): void;
  dispose(): void;
}

export interface InstallApertureAppPhysicsOptions {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly physics: PhysicsAccess;
  readonly config: AperturePhysicsConfig;
  readonly registerFixedStepTask: (
    task: SimulationFixedStepCallback,
    options?: SimulationFixedStepTaskOptions,
  ) => () => void;
}

export async function installApertureAppPhysics(
  options: InstallApertureAppPhysicsOptions,
): Promise<AperturePhysicsFacade> {
  const colliderGeometryProvider = createColliderGeometryProvider(options);
  const execution = options.config.execution ?? "simulation-worker";
  const backend = await createConfiguredPhysicsBackend(options.config, {
    execution,
    ...(colliderGeometryProvider === undefined
      ? {}
      : { colliderGeometryProvider }),
  });

  await backend.init({
    ...(options.config.gravity === undefined
      ? {}
      : { gravity: options.config.gravity }),
    execution,
    ...(colliderGeometryProvider === undefined
      ? {}
      : { colliderGeometryProvider }),
  });
  options.physics.setBackend(backend);

  const state = createPhysicsWorldSyncState();
  const unregister = options.registerFixedStepTask((context) => {
    const report = stepPhysicsWorld({
      world: context.world,
      backend,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
      state,
    });

    options.physics.setStepReport(report);
  });

  return {
    backend,
    unregister,
    dispose() {
      unregister();
      options.physics.setBackend(null);
      options.physics.clearEvents();
      backend.dispose();
    },
  };
}

function createColliderGeometryProvider(
  options: InstallApertureAppPhysicsOptions,
): PhysicsColliderGeometryProvider | undefined {
  const config = options.config.colliderGeometry;

  if (config === undefined || config.kind === "none") {
    return undefined;
  }

  if (config.kind === "provider") {
    return config.provider;
  }

  return createAssetBackedPhysicsColliderGeometryProvider({
    assets: options.assets,
    ...(config.heightfields === undefined
      ? {}
      : { heightfields: config.heightfields }),
  });
}

async function createConfiguredPhysicsBackend(
  config: AperturePhysicsConfig,
  options: {
    readonly colliderGeometryProvider?: PhysicsColliderGeometryProvider;
    readonly execution: PhysicsExecutionMode;
  },
): Promise<PhysicsBackend> {
  const backend = config.backend ?? "rapier";

  if (backend === "rapier") {
    const { createRapierPhysicsBackend } =
      await import("@aperture-engine/physics-rapier");

    return createRapierPhysicsBackend({
      ...(config.gravity === undefined ? {} : { gravity: config.gravity }),
      execution: options.execution,
      ...(options.colliderGeometryProvider === undefined
        ? {}
        : { colliderGeometryProvider: options.colliderGeometryProvider }),
    });
  }

  if (typeof backend === "function") {
    return backend();
  }

  return backend;
}
