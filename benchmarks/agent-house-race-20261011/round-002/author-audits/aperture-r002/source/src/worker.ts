import { startGeneratedSimulationWorker } from '@aperture-engine/app/worker';
import config from '../aperture.config';
import Setup from './scene';
startGeneratedSimulationWorker({config,systems:[{default:Setup}]});
