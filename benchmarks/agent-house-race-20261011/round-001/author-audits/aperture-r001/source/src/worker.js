import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import config from "./config.js";
import Scene from "./scene.js";
startGeneratedSimulationWorker({ config, systems: [{ default: Scene }] });
