import config from "/Users/felixz/Projects/aperture/examples/developer-api/aperture.config.ts";
import * as SystemModule0 from "/Users/felixz/Projects/aperture/examples/developer-api/src/systems/setup.system.ts";
import * as SystemModule1 from "/Users/felixz/Projects/aperture/examples/developer-api/src/systems/select.system.ts";
import * as SystemModule2 from "/Users/felixz/Projects/aperture/examples/developer-api/src/systems/asset-command.system.ts";
import * as SystemModule3 from "/Users/felixz/Projects/aperture/examples/developer-api/src/systems/spin-crate.system.ts";
import { startGeneratedSimulationWorker } from "/aperture/worker-modules/packages/app/dist/worker.js";
const systems = [
  { default: SystemModule0.default },
  { default: SystemModule1.default },
  { default: SystemModule2.default },
  { default: SystemModule3.default }
];
startGeneratedSimulationWorker({ config, systems });
