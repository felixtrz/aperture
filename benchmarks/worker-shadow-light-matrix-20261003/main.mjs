import {
  startGeneratedBrowserApp,
  readGeneratedBrowserAppStatus,
} from "../../packages/app/dist/browser.js";
import {
  createGeneratedCommandMessage,
  createApertureDevtoolsRequest,
} from "../../packages/app/dist/commands.js";
import { webGpuAppRenderReportToJsonValue } from "../../packages/webgpu/dist/index.js";
import { installGpuObserver } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/gpu-observer.mjs";
import {
  nativeMeshEvidence,
  jsonValue,
} from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import {
  CONFIG,
  WORKER_SETTINGS,
  CHANNEL,
  SIZE,
  statesFor,
} from "./contract.mjs";
import { requireValue, validateRecord } from "./checks.mjs";
import { inspectFrameCorrespondence } from "./frame-proof.mjs";

const query = new URLSearchParams(location.search),
  mode = query.get("mode"),
  variant = query.get("variant");
const published = new Map(),
  received = new Map(),
  completed = new Map(),
  availableAssets = new Map();
const publicationTrace = [],
  receptionTrace = [],
  stepAcks = [],
  errors = [];
const canvas = document.querySelector("#scene");
let app,
  renderer,
  workerObject,
  nativeStart,
  partial = null,
  receivedMesh = null,
  terminateCalls = 0;
const digest = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
async function recordArtifact(name, value) {
  const png = value instanceof Blob,
    bytes = png
      ? new Uint8Array(await value.arrayBuffer())
      : new TextEncoder().encode(JSON.stringify(value) + "\n");
  const response = await fetch(`/record/${name}`, {
    method: "POST",
    headers: { "Content-Type": png ? "image/png" : "application/json" },
    body: bytes,
  });
  const receipt = await response.json();
  requireValue(
    response.ok &&
      receipt.sha256 === (await digest(bytes)) &&
      receipt.bytes === bytes.length,
    `Artifact acknowledgement failed: ${name}`,
  );
}
async function until(read, label) {
  const deadline = performance.now() + 180000;
  while (performance.now() < deadline) {
    if (errors.length) throw Error(`${label}: ${JSON.stringify(errors)}`);
    const value = read();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw Error(`Timed out waiting for ${label}`);
}
function traces() {
  return {
    publicationTrace,
    receptionTrace,
    stepAcks,
    nativeStart,
    completed: [...completed.values()],
    published: [...published.values()],
    received: [...received.values()],
    diagnostics: renderer?.getDiagnostics({ detail: "full" }) ?? null,
    errors,
  };
}
window.addEventListener("error", (event) =>
  errors.push({ type: "window", message: event.message }),
);
window.addEventListener("unhandledrejection", (event) =>
  errors.push({
    type: "rejection",
    message: String(event.reason?.stack ?? event.reason),
  }),
);
async function dispose() {
  await renderer?.dispose();
  app?.worker.terminate();
}
try {
  const states = statesFor(mode, variant);
  requireValue(
    globalThis.__APERTURE_WAIT_GPU__ && globalThis.__APERTURE_VERIFIED_GPU__,
    "Approved runVerifiedScene required",
  );
  requireValue(
    crossOriginIsolated && typeof SharedArrayBuffer === "function",
    "Native SAB isolation required",
  );
  const gpu = installGpuObserver(),
    workerEntry = new URL("./worker.mjs", import.meta.url);
  workerEntry.search = new URLSearchParams({ mode, variant });
  app = await startGeneratedBrowserApp({
    config: CONFIG,
    workerEntry,
    workerStartOptions: WORKER_SETTINGS,
    workerFactory(url, options) {
      requireValue(!workerObject, "Second native Worker rejected");
      workerObject = new Worker(url, options);
      const nativeTerminate = workerObject.terminate;
      workerObject.terminate = function (...args) {
        terminateCalls++;
        return nativeTerminate.apply(this, args);
      };
      workerObject.addEventListener("error", (event) =>
        errors.push({ type: "native-worker", message: event.message }),
      );
      workerObject.addEventListener("message", (event) => {
        if (event.data?.type === "matrix-publication")
          publicationTrace.push(event.data);
        if (event.data?.type === "matrix-worker-start")
          nativeStart = event.data;
      });
      return workerObject;
    },
  });
  requireValue(
    app.webgpu.ok,
    `Native renderer initialization failed: ${JSON.stringify(app.webgpu)}`,
  );
  renderer = app.webgpu.app;
  const nativeRenderSnapshot = renderer.renderSnapshot;
  // Only production calls reach this transparent observer. This fixture never
  // drives renderSnapshot, constructs snapshot events, or mirrors assets itself.
  renderer.renderSnapshot = async function (snapshot, options) {
    const actualSnapshot = jsonValue(snapshot);
    const result = await nativeRenderSnapshot.call(this, snapshot, options);
    requireValue(
      result.frame === actualSnapshot.frame &&
        result.snapshot.frame === actualSnapshot.frame,
      "Production completion changed snapshot frame",
    );
    completed.set(result.frame, {
      frame: webGpuAppRenderReportToJsonValue(result),
      snapshot: actualSnapshot,
    });
    return result;
  };
  app.worker.onError((event) =>
    errors.push({ type: "worker-protocol", ...jsonValue(event) }),
  );
  app.worker.onMessage((message) => {
    if (message.type === "aperture.devtools.response") {
      stepAcks.push(jsonValue(message));
      if (!message.ok)
        errors.push({ type: "step", message: jsonValue(message) });
    }
  });
  app.worker.onSnapshot((event) => {
    try {
      const evidence = event.message.matrixEvidence;
      const deliveredAssets = (event.message.sourceAssets?.entries ?? []).map(
        ({ handle, version, status }) => ({ handle, version, status }),
      );
      for (const entry of event.message.sourceAssets?.entries ?? []) {
        availableAssets.set(`${entry.handle.kind}:${entry.handle.id}`, {
          handle: entry.handle,
          version: entry.version,
          status: entry.status,
        });
        if (
          evidence &&
          entry.handle.kind === "mesh" &&
          entry.handle.id === evidence.identity.meshId
        ) {
          requireValue(
            entry.asset?.kind === "mesh",
            "Expected full original mesh delivery for replacement arrays",
          );
          receivedMesh = nativeMeshEvidence(
            evidence.sourceMesh.name,
            entry.asset,
            evidence.sourceMesh.worldMatrix,
            {
              entityId: evidence.identity.entityId,
              meshId: entry.handle.id,
              assetVersion: entry.version,
            },
          );
        }
      }
      const reception = {
        frame: event.frame,
        snapshotFrame: event.snapshot.frame,
        stateId: evidence?.stateId ?? null,
        revision: evidence?.revision ?? 0,
        assetVersion: receivedMesh?.assetVersion ?? null,
        sourceMesh: receivedMesh,
        transport: event.message.transport?.mode ?? null,
        deliveredAssets,
        availableAssets: [...availableAssets.values()],
        summaryCadence: event.message.workerSummary?.summaryCadence ?? null,
      };
      receptionTrace.push({
        frame: reception.frame,
        snapshotFrame: reception.snapshotFrame,
        stateId: reception.stateId,
        revision: reception.revision,
        deliveredAssets,
      });
      received.set(event.frame, jsonValue(reception));
      if (evidence) published.set(event.frame, jsonValue(evidence));
    } catch (error) {
      errors.push({ type: "reception", message: error.message });
    }
  });
  // The pinned generated app has no await between app.start() and return.
  // These observers attach in that same microtask checkpoint, before Worker /
  // MessagePort / RAF tasks can dispatch. Initial resize demand steps can still
  // coalesce. Cross the already-scheduled RAF/resize callbacks, then send a real
  // deterministic empty step barrier and join ITS actual completion instead of
  // assuming the first generated-demand frame was presented.
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  app.worker.postMessage(
    createApertureDevtoolsRequest({
      requestId: "matrix-bootstrap",
      tool: "ecs_step",
      payload: { delta: 0, time: 0 },
    }),
  );
  const bootstrap = await until(() => {
    const ack = stepAcks.find(
      (value) => value.requestId === "matrix-bootstrap",
    );
    const diagnostic = renderer.getDiagnostics({ detail: "full" });
    const frame = ack?.result?.frame;
    return nativeStart &&
      Number.isInteger(frame) &&
      received.has(frame - 1) &&
      completed.has(frame - 1) &&
      !diagnostic.cadence.inFlight &&
      !diagnostic.cadence.pendingSnapshot &&
      !diagnostic.cadence.scheduled
      ? { ack, frame: frame - 1 }
      : null;
  }, "observed empty generated-app bootstrap completion");
  requireValue(
    completed.get(bootstrap.frame).snapshot.meshDraws.length === 0 &&
      completed.get(bootstrap.frame).snapshot.shadowRequests.length === 0,
    "Bootstrap pre-warmed scene/shadow caches",
  );
  let previous = null;
  for (const [index, state] of states.entries()) {
    const revision = index + 1;
    globalThis.__MATRIX_PROGRESS__ = {
      mode,
      variant,
      state: state.id,
      revision,
      phase: "worker-command",
    };
    app.worker.postMessage(
      createGeneratedCommandMessage({
        channel: CHANNEL,
        payload: { id: state.id, index, revision },
      }),
    );
    app.worker.postMessage(
      createApertureDevtoolsRequest({
        requestId: `matrix-${revision}`,
        tool: "ecs_step",
        payload: { delta: 1 / 60, time: revision / 60 },
      }),
    );
    const observed = await until(() => {
      const ack = stepAcks.find(
        (value) => value.requestId === `matrix-${revision}`,
      );
      for (const completion of [...completed.values()].reverse()) {
        const gate = inspectFrameCorrespondence(
          state,
          revision,
          published,
          received,
          completion,
          ack,
        );
        if (gate.ok) return { ...completion, ack, gate };
      }
      return null;
    }, `state ${state.id} exact worker/reception/production-completion join`);
    const proof = jsonValue(await globalThis.__APERTURE_WAIT_GPU__());
    const frame = observed.frame.frame,
      worker = published.get(frame),
      diagnostic = renderer.getDiagnostics({ detail: "full" });
    requireValue(
      diagnostic.lastFrame?.frame === frame,
      "Presentation advanced before capture",
    );
    partial = {
      mode,
      variant,
      state,
      revision,
      frame,
      assetVersion: worker.assetVersion,
      identity: worker.identity,
      snapshot: observed.snapshot,
      report: observed.frame,
      proof,
      sourceMesh: worker.sourceMesh,
      gpu: gpu.evidence([worker.sourceMesh]),
      counters: gpu.counters(),
      worker,
      reception: received.get(frame),
      completion: {
        nativeRenderMethodCompletionObserved: true,
        ack: observed.ack,
        gate: observed.gate,
      },
      runtime: {
        nativeWorkerCount: workerObject instanceof Worker ? 1 : 0,
        nativeWorkerScope: nativeStart.nativeWorkerScope,
        crossOriginIsolated,
        transport: jsonValue(diagnostic.transport),
        cadence: jsonValue(diagnostic.cadence),
        config: CONFIG,
        useFrameGraph: renderer.useFrameGraph,
        renderSettings: jsonValue(readGeneratedBrowserAppStatus()?.render),
        validationErrors: jsonValue(errors),
        bootstrap,
      },
      capture: {
        width: SIZE,
        height: SIZE,
        gpuFenceCompleted: true,
        presentationFrames: 2,
      },
    };
    await recordArtifact(`${state.id}.json`, partial);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(Error("PNG capture failed")),
        "image/png",
      ),
    );
    await recordArtifact(`${state.id}.png`, blob);
    validateRecord(partial, state, previous);
    previous = partial;
  }
  const trace = traces();
  await dispose();
  requireValue(
    terminateCalls === 1,
    "Native worker termination not observed exactly once",
  );
  await recordArtifact("complete.json", {
    mode,
    variant,
    states: states.length,
    lastFrame: previous.frame,
    workerTerminated: true,
    nativeWorkerTerminateCalls: terminateCalls,
    rendererDisposed: true,
    trace,
    scope:
      "Exploratory native worker/SAB demand shadow matrix; no score, throughput or memory claim.",
  });
  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: true,
    mode,
    variant,
    states: states.length,
  };
} catch (error) {
  const trace = traces();
  try {
    await dispose();
  } catch (disposeError) {
    errors.push({ type: "dispose", message: disposeError.message });
  }
  try {
    await recordArtifact("failure.json", {
      mode,
      variant,
      error: { message: error.message, stack: error.stack },
      partial,
      trace,
      terminateCalls,
    });
  } catch (recordError) {
    console.error(recordError);
  }
  globalThis.__APERTURE_RENDER_STATUS__ = { ok: false, error: error.message };
  console.error(error);
}
