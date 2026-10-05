import { SIMULATION_WORKER_PROTOCOL } from "/worker-modules/packages/runtime/dist/index.js";
import { createProducer } from "./producer.mjs";
let connected = false;
globalThis.addEventListener("message", (event) => {
  if (event.data?.type !== SIMULATION_WORKER_PROTOCOL.connect) return;
  if (connected) throw Error("Duplicate connection");
  connected = true;
  const port = event.data.port;
  let producer;
  port.addEventListener("message", (incoming) => {
    try {
      const message = incoming.data;
      if (message.type === SIMULATION_WORKER_PROTOCOL.start) {
        if (producer) throw Error("Duplicate start");
        producer = createProducer(port, message.options);
        port.postMessage({
          type: "sideband.probe.ready",
          state: producer.state(),
        });
      } else {
        if (!producer) throw Error("Command before start");
        producer.command(message);
      }
    } catch (error) {
      port.postMessage({
        type: SIMULATION_WORKER_PROTOCOL.error,
        reason: "sideband.probe.failed",
        message: error.stack ?? error.message,
      });
    }
  });
  port.start();
});
