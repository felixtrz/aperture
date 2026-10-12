import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import Scene from "./scene.system.js";
import config from "./config.js";

startGeneratedSimulationWorker({
  config,
  systems: [{ default: Scene }],
});
