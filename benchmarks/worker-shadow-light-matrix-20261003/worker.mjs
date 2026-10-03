import { startGeneratedSimulationWorker } from "../../packages/app/dist/worker.js";
import { SIMULATION_WORKER_PROTOCOL } from "../../packages/runtime/dist/index.js";
import { CONFIG } from "./contract.mjs";
import { observeStartSettings } from "./worker-proof.mjs";
import { createMatrixSystem } from "./scene-system.mjs";

const query = new URL(import.meta.url).searchParams;
let owner = null,
  connected = false,
  observedStart = null;
const MatrixScene = createMatrixSystem(
  query.get("mode"),
  query.get("variant"),
  (value) => {
    owner = value;
  },
);
globalThis.addEventListener("message", (event) => {
  if (event.data?.type !== SIMULATION_WORKER_PROTOCOL.connect) return;
  if (connected) throw Error("Second native Worker connection rejected");
  connected = true;
  const port = event.data.port;
  port.addEventListener("message", (event) => {
    if (event.data?.type !== SIMULATION_WORKER_PROTOCOL.start) return;
    observedStart = observeStartSettings(event.data);
    globalThis.postMessage({
      type: "matrix-worker-start",
      observedStart,
      nativeWorkerScope: globalThis instanceof DedicatedWorkerGlobalScope,
    });
  });
  const observedPort = {
    addEventListener: (...args) => port.addEventListener(...args),
    removeEventListener: (...args) => port.removeEventListener(...args),
    start: () => port.start(),
    close: () => port.close(),
    postMessage(message, transfer) {
      let outgoing = message;
      if (message.type === SIMULATION_WORKER_PROTOCOL.snapshot) {
        const trace = {
          type: "matrix-publication",
          frame: message.frame,
          snapshotFrame: message.snapshot.frame,
          revision: owner?.revision ?? 0,
          stateId: owner?.stateId ?? null,
          transport: message.transport?.mode ?? null,
          sourceAssets: (message.sourceAssets?.entries ?? []).map(
            ({ handle, version, status }) => ({ handle, version, status }),
          ),
          summaryCadence: message.workerSummary?.summaryCadence ?? null,
          postMessageDecision:
            message.workerSummary?.postMessageDecision ?? null,
        };
        if (owner?.revision > 0)
          outgoing = {
            ...message,
            matrixEvidence: {
              ...owner.evidenceAtNativePublication(
                message.frame,
                message.snapshot,
              ),
              observedStart,
              publication: trace,
            },
          };
        // Observe only. Original message fields, snapshot, payload arrays and
        // transfer list remain engine-owned and are passed through unchanged.
        port.postMessage(outgoing, transfer ?? []);
        globalThis.postMessage(trace);
        return;
      }
      port.postMessage(outgoing, transfer ?? []);
    },
  };
  startGeneratedSimulationWorker({
    config: CONFIG,
    systems: [{ default: MatrixScene }],
    port: observedPort,
  });
});
