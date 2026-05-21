import { createNoopSimulationWorker } from "./noop-simulation-worker.js";

export async function createExampleWebGpuApp(aperture, options) {
  const { worldOptions, ...webGpuOptions } = options;
  const simulation = aperture.createExtractionApp({
    ...(worldOptions === undefined ? {} : { worldOptions }),
  });
  const rendererWorker = createNoopSimulationWorker();
  const created = await aperture.createWebGpuApp({
    ...webGpuOptions,
    simulationWorker: rendererWorker,
    sourceAssets: simulation.assets,
  });

  if (!created.ok) {
    return created;
  }

  const renderer = created.app;
  const app = {
    canvas: renderer.canvas,
    initialization: renderer.initialization,
    renderWorld: renderer.renderWorld,
    world: simulation.world,
    assets: simulation.assets,
    start: (...args) => renderer.start(...args),
    stop: () => renderer.stop(),
    getDiagnostics: () => renderer.getDiagnostics(),
    renderSnapshot: (...args) => renderer.renderSnapshot(...args),
    spawn: (...initializers) => simulation.spawn(...initializers),
    registerSystem: (system) => {
      simulation.registerSystem(system);
      return app;
    },
    step: (...args) => simulation.step(...args),
    extract: (...args) => simulation.extract(...args),
    stepAndExtract: (...args) => simulation.stepAndExtract(...args),
    render: async (renderOptions = {}) => {
      const { snapshot, ...rendererOptions } = renderOptions;
      const frame = renderOptions.frame ?? 0;
      return renderer.renderSnapshot(
        snapshot ?? simulation.extract(frame),
        rendererOptions,
      );
    },
    stepAndRender: async (delta = 0, time = 0, frame = 0) => {
      const snapshot = simulation.stepAndExtract(delta, time, frame);
      return renderer.renderSnapshot(snapshot, { frame });
    },
  };

  return {
    ok: true,
    app,
    initialization: created.initialization,
  };
}
