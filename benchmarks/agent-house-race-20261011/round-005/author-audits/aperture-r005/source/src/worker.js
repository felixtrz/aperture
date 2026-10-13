import {startGeneratedSimulationWorker} from '@aperture-engine/app/worker';
import config from './config.js';
import SceneSystem from './scene.js';
startGeneratedSimulationWorker({config,systems:[{default:SceneSystem}]});
