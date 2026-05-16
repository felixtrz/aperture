import {
  AssetRegistry,
  createWorld,
  registerTransformComponents,
  resolveWorldTransforms,
  type EcsWorld,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  type RenderSnapshot,
} from "@aperture-engine/render";

export interface SimulationStepResult {
  readonly transform: TransformResolutionReport;
}

export interface SimulationApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
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

  return {
    world,
    assets,
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    step(delta = 0, time = 0) {
      world.update(delta, time);
      return { transform: resolveWorldTransforms(world) };
    },
  };
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
