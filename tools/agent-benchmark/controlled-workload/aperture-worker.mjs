import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import config from "./aperture-config.mjs";
import SceneSystem from "./aperture-scene.mjs";

startGeneratedSimulationWorker({ config, systems: [{ default: SceneSystem }] });
