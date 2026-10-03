import { startGeneratedSimulationWorker } from '/worker-modules/packages/app/dist/worker.js';
import { config } from './config.mjs';
import CottageSetup from './cottage-scene.mjs';
startGeneratedSimulationWorker({ config, systems: [{ default: CottageSetup }] });
