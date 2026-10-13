// @ts-check
import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";

/**
 * The embedding host supplies its own config, canvas and normal simulation worker.
 * @param {import("@aperture-engine/app/browser").StartGeneratedBrowserAppOptions} options
 */
export async function startCheckedViewport(options) {
  const app = await startGeneratedBrowserApp({
    ...options,
    config: {
      ...options.config,
      render: { ...options.config.render, cadence: "manual" },
    },
  });
  await app.ready;
  return app;
}

/**
 * @param {import("@aperture-engine/app/browser").GeneratedBrowserApp} app
 * @param {import("@aperture-engine/app/browser").GeneratedBrowserCameraProjectionOptions} projection
 */
export async function inspectCameraFrame(app, projection) {
  const camera = await app.request("camera_set_projection", projection);
  const frame = await app.renderFrame({ deltaSeconds: 0, timeSeconds: 0 });
  const entity = await app.request("ecs_get_entity", { entity: camera.entity });
  return { camera, entity, frame, inspection: app.inspectRenderedFrame() };
}

// The host owns the returned app and awaits app.dispose() in its teardown/finally.
