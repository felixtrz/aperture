import { parentPort, workerData } from "node:worker_threads";
const protocol = "aperture.headless-realm.v1";
let last = 0;
parentPort.on("message", (request) => {
  const base = {
    protocol,
    executionRevision: workerData.executionRevision,
    id: request.id,
    ok: true,
  };
  if (request.method === "dispose") {
    parentPort.postMessage({
      ...base,
      result: { graceful: true, cleanupFailures: [] },
      cleanup: { graceful: true, cleanupFailures: [] },
    });
    parentPort.close();
    return;
  }
  if (request.input.kind === "hang") return;
  if (request.input.kind === "invalid") {
    parentPort.postMessage({ ...base, executionRevision: "wrong-realm" });
    return;
  }
  if (request.input.kind === "exit") {
    process.exit(2);
    return;
  }
  const result = { echo: request.input, last: ++last };
  parentPort.postMessage({ ...base, result });
  if (request.input.kind === "duplicate")
    parentPort.postMessage({
      ...base,
      result: { last: 999 },
      metadata: { executionRevision: "poison" },
    });
});
