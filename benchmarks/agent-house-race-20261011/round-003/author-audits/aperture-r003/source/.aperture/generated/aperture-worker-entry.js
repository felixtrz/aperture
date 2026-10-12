import config from "/work/aperture.config.ts";
import * as SystemModule0 from "/work/src/systems/setup.system.ts";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
const systems = [
  { default: SystemModule0.default }
];
startGeneratedSimulationWorker({ config, systems });
