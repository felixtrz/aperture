import { AssetRegistry } from "/worker-modules/packages/simulation/dist/index.js";
import {
  createSimulationWorker,
  SIMULATION_WORKER_PROTOCOL,
} from "/worker-modules/packages/runtime/dist/index.js";
import {
  createWebGpuApp,
  webGpuAppRenderReportToJsonValue,
} from "/worker-modules/packages/webgpu/dist/index.js";
import { mirrorSimulationWorkerSourceAssets } from "/worker-modules/packages/app/dist/browser/assets.js";
import { installNativeObserver } from "/native-observer.mjs";
import { SESSION } from "./session.mjs";
import {
  SCHEMA,
  READY,
  statesFor,
  requireValue,
  jsonValue,
  meshBytes,
} from "./contract.mjs";

const nativeRaf = globalThis.requestAnimationFrame.bind(globalThis);
const nativeCancel = globalThis.cancelAnimationFrame.bind(globalThis);
const canvas = document.querySelector("#scene");
const observer = installNativeObserver();
const mirror = new AssetRegistry();
const status = {
  status: "running",
  snapshots: 0,
  mirroredSourceAssets: 0,
  skippedSourceAssets: 0,
  lastFrame: null,
  lastWorkerSummary: null,
  performance: null,
  workerMessages: {
    snapshotDecisions: {
      total: 0,
      latest: null,
      postedMessages: {},
      postMessageReasons: {},
    },
    sidebandDecisions: {
      total: 0,
      latest: null,
      postedMessages: {},
      postMessageReasons: {},
    },
  },
};
const errors = [],
  messages = [],
  rendered = [],
  acknowledgments = [],
  artifacts = [],
  queued = new Map();
let next = 0,
  sequence = 0,
  latestSource = null,
  app,
  worker,
  stationary = null;
const acks = new Map();
window.addEventListener("error", (event) => errors.push(event.message));
window.addEventListener("unhandledrejection", (event) =>
  errors.push(String(event.reason)),
);
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
async function post(name, value, type = "application/json") {
  const bytes =
    type === "application/json"
      ? new TextEncoder().encode(JSON.stringify(value) + "\n")
      : new Uint8Array(await value.arrayBuffer());
  const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  const response = await fetch("/record/" + name, {
    method: "POST",
    headers: { "Content-Type": type },
    body: bytes,
  });
  const receipt = await response.json();
  requireValue(
    response.ok &&
      receipt.sha256 === sha256 &&
      receipt.bytes === bytes.length &&
      receipt.name === name,
    "Artifact acknowledgment mismatch",
  );
  artifacts.push(receipt);
  return receipt;
}
async function until(predicate, label) {
  const deadline = performance.now() + 120000;
  for (;;) {
    if (errors.length) throw Error(JSON.stringify(errors));
    if (predicate()) return;
    if (performance.now() >= deadline) throw Error("Timed out: " + label);
    await new Promise(nativeRaf);
  }
}
async function command(operation, options = {}) {
  const requestId = ++sequence;
  worker.postMessage({
    type: "sideband.probe.command",
    requestId,
    operation,
    ...options,
  });
  await until(() => acks.has(requestId), "worker command " + requestId);
  return acks.get(requestId);
}
async function tick(expected) {
  requireValue(
    queued.size === 1,
    "Expected exactly one continuous scheduler callback",
  );
  const [id, callback] = queued.entries().next().value;
  queued.delete(id);
  await new Promise((resolve) =>
    nativeRaf((time) => {
      callback(time);
      resolve();
    }),
  );
  await until(
    () => app.getDiagnostics().cadence.rendersCompleted.total === expected,
    "native render completion",
  );
  requireValue(
    app.getDiagnostics().cadence.renderFailures === 0 &&
      app.getDiagnostics().lastFrame?.ok,
    "Native renderer failed",
  );
}
async function capture(id) {
  const expected = statesFor(SESSION).find((state) => state.id === id);
  const record = rendered.at(-1);
  requireValue(
    record.frame === expected.frame &&
      record.mirrorVersion === expected.mirrorVersion,
    "Consumed frame/mirror mismatch",
  );
  const proof = jsonValue(await globalThis.__APERTURE_WAIT_GPU__());
  requireValue(
    proof.native &&
      proof.canvasWebGPU === 1 &&
      proof.webglAttempts === 0 &&
      proof.errors.length === 0 &&
      proof.deviceLost.length === 0,
    "Native proof failed",
  );
  const state = {
    schema: SCHEMA,
    session: SESSION,
    id,
    expected,
    ...record,
    proof,
    messages: jsonValue(messages),
    acknowledgments: jsonValue(acknowledgments),
    cadence: jsonValue(app.getDiagnostics().cadence),
    stationary,
    capture: {
      width: canvas.width,
      height: canvas.height,
      method: "HTMLCanvasElement.toBlob(image/png)",
      gpuFenceCompleted: true,
      presentationFrames: 2,
    },
  };
  await post(id + ".json", state);
  const png = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("Canvas PNG failed"))),
      "image/png",
    ),
  );
  await post(id + ".png", png, "image/png");
}
try {
  statesFor(SESSION);
  requireValue(
    globalThis.crossOriginIsolated && typeof SharedArrayBuffer === "function",
    "Native shared memory isolation unavailable",
  );
  worker = createSimulationWorker(new URL("./worker.mjs", import.meta.url), {
    workerOptions: { type: "module" },
  });
  const mirrored = mirrorSimulationWorkerSourceAssets(worker, mirror, status);
  worker.onError((event) => errors.push(event.message));
  worker.onSnapshot((event) =>
    messages.push({
      type: event.message.type,
      frame: event.frame,
      versions: event.message.sourceAssets.entries.map((entry) => ({
        handle: entry.handle,
        version: entry.version,
      })),
    }),
  );
  worker.onMessage((message) => {
    if (message.type === "sideband.probe.ready") latestSource = message.state;
    else if (message.type === "sideband.probe.ack") {
      latestSource = message.state;
      acks.set(message.requestId, message);
      acknowledgments.push(message);
    } else if (message.type === SIMULATION_WORKER_PROTOCOL.sourceAssets)
      messages.push({
        type: message.type,
        frame: message.frame,
        versions: message.sourceAssets.entries.map((entry) => ({
          handle: entry.handle,
          version: entry.version,
        })),
      });
  });
  // Capture only this app's scheduler callbacks. Every released callback runs
  // on native RAF; the approved proof fence keeps the native global RAF API.
  globalThis.requestAnimationFrame = (callback) => {
    queued.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => queued.delete(id);
  let created;
  try {
    created = await createWebGpuApp({
      canvas,
      simulationWorker: mirrored,
      sourceAssets: mirror,
      presentationCadence: "continuous",
      transport: "shared-array-buffer",
      tonemap: "none",
      msaa: 1,
      sharedSnapshotTransport: {
        maxEntities: 8,
        maxViews: 2,
        maxPacketWords: 2048,
        requireCrossOriginIsolated: true,
      },
    });
  } finally {
    globalThis.requestAnimationFrame = nativeRaf;
    globalThis.cancelAnimationFrame = nativeCancel;
  }
  requireValue(created.ok, "WebGPU initialization failed");
  app = created.app;
  const nativeRender = app.renderSnapshot;
  app.renderSnapshot = async function (snapshot, options) {
    const entry = mirror.get(latestSource.mesh);
    const record = {
      frame: snapshot.frame,
      mirrorVersion: entry.version,
      mirroredAsset: meshBytes(entry.asset),
      sourceAtRender: jsonValue(latestSource),
      snapshot: jsonValue(snapshot),
      snapshotNotifications: status.snapshots,
    };
    const scope = observer.begin(snapshot.frame);
    let report;
    try {
      report = await nativeRender.call(this, snapshot, options);
    } finally {
      record.native = observer.end(scope);
    }
    requireValue(
      report.ok && report.frame === snapshot.frame,
      "Native report failed/mismatched",
    );
    record.report = webGpuAppRenderReportToJsonValue(report);
    rendered.push(record);
    return report;
  };
  app.start({ probeSession: SESSION });
  await until(() => latestSource !== null, "worker startup");
  if (SESSION === "cold-changed") {
    await command("publish", { frame: 2 });
    await command("notify", { kind: "snapshot" });
    await tick(1);
    await capture("changed");
  } else {
    await command("publish", { frame: 1 });
    await command("notify", { kind: "snapshot" });
    await tick(1);
    await capture("baseline");
    await command("publish", { frame: 2, change: true });
    if (SESSION === "before-poll") {
      await command("notify", { kind: "sourceAssets" });
      await tick(2);
      await capture("changed");
    } else {
      await tick(2);
      await capture("early");
      await command("notify", { kind: "sourceAssets" });
      const submissions = globalThis.__APERTURE_VERIFIED_GPU__.submissions;
      await tick(2);
      stationary = {
        sabFrame: 2,
        mirrorVersion: mirror.get(latestSource.mesh).version,
        renderedFrames: rendered.map((record) => record.frame),
        submissionsBefore: submissions,
        submissionsAfter: globalThis.__APERTURE_VERIFIED_GPU__.submissions,
        rerendered: false,
      };
      requireValue(
        rendered.length === 2 &&
          stationary.submissionsBefore === stationary.submissionsAfter,
        "Unexpected stationary submission",
      );
      await command("publish", { frame: 3 });
      await tick(3);
      await capture("converged");
    }
  }
  requireValue(
    status.snapshots === 1,
    "Unexpected extra snapshot notification",
  );
  app.stop();
  worker.terminate();
  const proof = jsonValue(await globalThis.__APERTURE_WAIT_GPU__());
  const complete = {
    schema: SCHEMA,
    session: SESSION,
    states: statesFor(SESSION),
    artifacts: [...artifacts],
    messages,
    stationary,
    snapshotNotifications: status.snapshots,
    rendered: rendered.map(({ frame, mirrorVersion }) => ({
      frame,
      mirrorVersion,
    })),
    proof,
    workerTransport: "actual Worker and MessageChannel",
    cadenceControl:
      "real app callbacks released on native RAF; no demand-sideband or same-frame invalidation promise",
  };
  await post("complete.json", complete);
  globalThis[READY] = {
    ok: true,
    session: SESSION,
    states: statesFor(SESSION).length,
  };
} catch (error) {
  app?.stop();
  worker?.terminate();
  try {
    await post("failure.json", {
      session: SESSION,
      error: { message: error.message, stack: error.stack },
      errors,
      messages,
      acknowledgments,
      rendered,
      stationary,
    });
  } catch {}
  console.error(error);
  globalThis[READY] = { ok: false, error: error.message };
}
