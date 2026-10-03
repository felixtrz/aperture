import { startGeneratedSimulationWorker } from '/worker-modules/packages/app/dist/worker.js';
import { SIMULATION_WORKER_PROTOCOL } from '/worker-modules/packages/runtime/dist/index.js';
import { CONFIG } from './scene.mjs';
import { CraneCourtyard, sceneOwner } from './scene-system.mjs';

// Observe the exact native publication boundary. The engine still owns stepping,
// extraction, asset serialization, transfer lists and the persistent ECS world.
let connected = false;
globalThis.addEventListener('message', event => {
  if (event.data?.type !== SIMULATION_WORKER_PROTOCOL.connect) return;
  if (connected) throw Error('Second native worker connection rejected');
  connected = true;
  const port = event.data.port;
  const observedPort = {
    addEventListener: (...args) => port.addEventListener(...args),
    removeEventListener: (...args) => port.removeEventListener(...args),
    start: () => port.start(), close: () => port.close(),
    postMessage(message, transfer) {
      let outgoing = message;
      if (sceneOwner?.revision > 0 && message.type === SIMULATION_WORKER_PROTOCOL.snapshot) {
        if (!Number.isInteger(message.frame) || message.snapshot.frame !== message.frame) throw Error('Native snapshot frame mismatch');
        outgoing = { ...message, craneLive: sceneOwner.evidenceAtNativePublication(message.frame, message.snapshot) };
      }
      port.postMessage(outgoing, transfer ?? []);
    }
  };
  startGeneratedSimulationWorker({ config: CONFIG, systems: [{ default: CraneCourtyard }], port: observedPort });
});
