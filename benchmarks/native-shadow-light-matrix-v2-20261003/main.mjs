import {
  createWebGpuApp,
  webGpuAppRenderReportToJsonValue,
} from "../../packages/webgpu/dist/index.js";
import { installGpuObserver } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/gpu-observer.mjs";
import { nativeMeshEvidence } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import { createFixture, MODES, STATES, SIZE, LABEL } from "./fixture.mjs";
import { requireValue, validateRecord, VARIANTS } from "./checks.mjs";

const query = new URLSearchParams(location.search),
  mode = query.get("mode"),
  variant = query.get("variant");
const jsonValue = (value) =>
  ArrayBuffer.isView(value)
    ? Array.from(value)
    : Array.isArray(value)
      ? value.map(jsonValue)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, jsonValue(item)]),
          )
        : value;
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
const canvas = document.querySelector("#scene");
let renderer,
  partial = null;
try {
  requireValue(
    MODES.includes(mode) && VARIANTS.includes(variant),
    "Expected explicit supported mode and variant",
  );
  requireValue(
    globalThis.__APERTURE_WAIT_GPU__ && globalThis.__APERTURE_VERIFIED_GPU__,
    "Approved runVerifiedScene required",
  );
  const gpu = installGpuObserver(),
    shape = variant === "live" ? "baseline" : variant.slice(6);
  const fixture = createFixture(mode, shape);
  // This intentionally isolates the production extraction/renderSnapshot boundary.
  // It neither starts nor emulates worker transport; the retained crane run tests it.
  const manualSource = {
    start() {
      throw Error("Automatic transport is outside this fixture");
    },
    onSnapshot() {
      return () => {};
    },
    onError() {
      return () => {};
    },
  };
  const created = await createWebGpuApp({
    canvas,
    sourceAssets: fixture.extraction.assets,
    simulationWorker: manualSource,
    autoStart: false,
    useFrameGraph: true,
    tonemap: "none",
    msaaSampleCount: 1,
  });
  requireValue(
    created.ok,
    `Native renderer initialization failed: ${JSON.stringify(created)}`,
  );
  renderer = created.app;
  const states =
    variant === "live"
      ? STATES
      : [{ id: shape, shape, version: 1, reuse: false }];
  let previous = null,
    previousShape = shape;
  for (const [index, state] of states.entries()) {
    globalThis.__MATRIX_PROGRESS__ = {
      mode,
      variant,
      state: state.id,
      phase: "render",
    };
    if (state.shape !== previousShape) fixture.publish(state.shape);
    previousShape = state.shape;
    const snapshot = fixture.snapshot(index + 1);
    const result = await renderer.renderSnapshot(snapshot, {
      frame: snapshot.frame,
    });
    const proof = jsonValue(await globalThis.__APERTURE_WAIT_GPU__());
    const asset = fixture.asset();
    const mesh = nativeMeshEvidence(
      LABEL,
      asset,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      { assetVersion: fixture.version(), meshId: fixture.mesh.id },
    );
    partial = {
      mode,
      variant,
      state,
      frame: snapshot.frame,
      assetVersion: fixture.version(),
      identity: fixture.identity(),
      snapshot: jsonValue(snapshot),
      report: webGpuAppRenderReportToJsonValue(result),
      proof,
      gpu: gpu.evidence([mesh]),
      sourceMesh: mesh,
      counters: gpu.counters(),
      capture: {
        width: SIZE,
        height: SIZE,
        gpuFenceCompleted: true,
        presentationFrames: 2,
      },
    };
    // Save observed data and pixels before enforcing assertions, so failures remain inspectable.
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
  await renderer.dispose();
  await recordArtifact("complete.json", {
    mode,
    variant,
    states: states.length,
    lastFrame: previous.frame,
    scope:
      "Exploratory extraction/renderSnapshot component regression; no author score, worker transport, performance or GPU-memory claim.",
  });
  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: true,
    mode,
    variant,
    states: states.length,
  };
} catch (error) {
  await renderer?.dispose().catch(() => {});
  try {
    await recordArtifact("failure.json", {
      mode,
      variant,
      error: { message: error.message, stack: error.stack },
      partial,
    });
  } catch (recordError) {
    console.error(recordError);
  }
  globalThis.__APERTURE_RENDER_STATUS__ = { ok: false, error: error.message };
  console.error(error);
}
