import {
  AssetRegistry,
  DebugMetadata,
  Enabled,
  EcsType,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  assetHandleKey,
  createParent,
  createRootTransform,
  createSystem,
  createWorld,
  defineComponent,
  quatFromAxisAngle,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type AnyEcsComponent,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
  type LocalTransformInput,
  type MaterialHandle,
  type MeshHandle,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  Camera,
  Light,
  LightShadowSettings,
  Material,
  Mesh,
  RenderLayer,
  RenderOrder,
  Visibility,
  createCamera,
  createLight,
  createLightShadowSettings,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  type CameraInput,
  type LightInput,
  type LightShadowSettingsInput,
  type RenderSnapshot,
} from "@aperture-engine/render";

export interface SpawnContext {
  readonly app: SimulationApp;
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

export type SpawnEntityInitializer = (
  entity: Entity,
  context: SpawnContext,
) => void;

export interface RuntimeTransformInput extends LocalTransformInput {
  readonly parent?: Entity | null;
}

export interface SpinInput {
  readonly radiansPerSecond?: number;
  readonly axis?: readonly [number, number, number];
}

export const Spin = defineComponent(
  "aperture.runtime.spin",
  {
    radiansPerSecond: { type: EcsType.Float32, default: 1 },
    axis: { type: EcsType.Vec3, default: [0, 1, 0] },
  },
  "Simple runtime spin component for proof-point examples and tests.",
);

const SpinSystemBase = createSystem({
  spin: {
    required: [Spin, LocalTransform],
  },
});

export class SpinSystem extends SpinSystemBase {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.spin.entities) {
      const speed = entity.getValue(Spin, "radiansPerSecond") ?? 1;
      const axis = entity.getVectorView(Spin, "axis");
      const rotation = quatFromAxisAngle(
        [read(axis, 0), read(axis, 1), read(axis, 2)],
        time * speed,
      );

      entity.getVectorView(LocalTransform, "rotation").set(rotation);
    }
  }
}

export interface SimulationStepResult {
  readonly transform: TransformResolutionReport;
}

export interface SimulationApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  spawn(...initializers: SpawnEntityInitializer[]): Entity;
  registerSystem(
    system: Parameters<EcsWorld["registerSystem"]>[0],
  ): SimulationApp;
  step(delta?: number, time?: number): SimulationStepResult;
}

export interface ExtractionApp extends SimulationApp {
  extract(frame?: number): RenderSnapshot;
  stepAndExtract(delta?: number, time?: number, frame?: number): RenderSnapshot;
}

export interface CreateSimulationAppOptions {
  readonly world?: EcsWorld;
  readonly assets?: AssetRegistry;
  readonly worldOptions?: Partial<WorldOptions>;
}

export type CreateExtractionAppOptions = CreateSimulationAppOptions;

export function createSimulationApp(
  options: CreateSimulationAppOptions = {},
): SimulationApp {
  const world = options.world ?? createWorld(options.worldOptions);
  const assets = options.assets ?? new AssetRegistry();

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRuntimeComponents(world);

  const app: SimulationApp = {
    world,
    assets,
    spawn(...initializers) {
      const entity = world.createEntity();
      const context: SpawnContext = { app, world, assets };

      for (const initializer of initializers) {
        initializer(entity, context);
      }

      return entity;
    },
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    step(delta = 0, time = 0) {
      world.update(delta, time);
      return { transform: resolveWorldTransforms(world) };
    },
  };

  return app;
}

export function createExtractionApp(
  options: CreateExtractionAppOptions = {},
): ExtractionApp {
  const app = createSimulationApp(options);

  registerRenderAuthoringComponents(app.world);

  return {
    ...app,
    extract(frame = 0) {
      return extractRenderSnapshot(app.world, app.assets, { frame });
    },
    stepAndExtract(delta = 0, time = 0, frame = 0) {
      app.step(delta, time);
      return extractRenderSnapshot(app.world, app.assets, { frame });
    },
  };
}

export function registerRuntimeComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Spin);
  return world;
}

export function withComponent<TComponent extends AnyEcsComponent>(
  component: TComponent,
  data?: ComponentInitialData<TComponent>,
): SpawnEntityInitializer {
  return (entity) => {
    if (data === undefined) {
      entity.addComponent(component);
    } else {
      entity.addComponent(component, data);
    }
  };
}

export function withTransform(
  input: RuntimeTransformInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerTransformComponents(context.world);
    const root = createRootTransform(input);

    entity.addComponent(LocalTransform, root.local);
    entity.addComponent(Parent, createParent(input.parent ?? null));
    entity.addComponent(WorldTransform, root.world);
  };
}

export function withMesh(handle: MeshHandle): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Mesh, { meshId: assetHandleKey(handle) });
  };
}

export function withMaterial(handle: MaterialHandle): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Material, { materialId: assetHandleKey(handle) });
  };
}

export function withCamera(input: CameraInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Camera, createCamera(input));
  };
}

export function withLight(input: LightInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Light, createLight(input));
  };
}

export function withLightShadowSettings(
  input: LightShadowSettingsInput = {},
): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(LightShadowSettings, createLightShadowSettings(input));
  };
}

export function withVisibility(visible = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(Visibility, { visible });
  };
}

export function withRenderLayer(mask = 1): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(RenderLayer, { mask });
  };
}

export function withRenderOrder(value = 0): SpawnEntityInitializer {
  return (entity, context) => {
    registerRenderAuthoringComponents(context.world);
    entity.addComponent(RenderOrder, { value });
  };
}

export function withEnabled(value = true): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(Enabled, { value });
  };
}

export function withName(value: string): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(Name, { value });
  };
}

export function withDebugMetadata(input: {
  readonly tag?: string;
  readonly note?: string;
}): SpawnEntityInitializer {
  return (entity, context) => {
    registerMetadataComponents(context.world);
    entity.addComponent(DebugMetadata, {
      tag: input.tag ?? "",
      note: input.note ?? "",
    });
  };
}

export function withSpin(input: SpinInput = {}): SpawnEntityInitializer {
  return (entity, context) => {
    registerRuntimeComponents(context.world);
    entity.addComponent(Spin, {
      radiansPerSecond: input.radiansPerSecond ?? 1,
      axis:
        input.axis === undefined
          ? [0, 1, 0]
          : [input.axis[0], input.axis[1], input.axis[2]],
    });
  };
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}.`);
  }

  return value;
}
