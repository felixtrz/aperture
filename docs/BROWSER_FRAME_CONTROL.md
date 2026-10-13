# Browser frame control

`startGeneratedBrowserApp` wires the simulation worker, source asset mirror,
WebGPU renderer and browser input. Its returned app exposes semantic requests,
readiness, frame inspection and disposal. A manual cadence supports editors,
embeddings, deterministic playback and application-controlled rendering.

```ts
import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import config from "./aperture.config.js";

const app = await startGeneratedBrowserApp({
  config: {
    ...config,
    render: { ...config.render, cadence: "manual" },
  },
  workerEntry: new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  }),
});

await app.ready;
await app.request("camera_look_at", {
  key: "camera.main",
  translation: [8, 4, 12],
  lookAt: [0, 1, 0],
});
await app.request("camera_set_projection", {
  key: "camera.main",
  projection: "perspective",
  fovYDegrees: 45,
  near: 0.1,
  far: 200,
});
const frame = await app.renderFrame({ deltaSeconds: 0, timeSeconds: 0 });
console.log(frame.snapshotFrame, frame.report.counts);
console.log(app.inspectRenderedFrame());
await app.dispose();
```

The worker entry uses the normal `startGeneratedSimulationWorker` bootstrap and
ECS-authored systems. Simulation and scene state remain in that worker; the main
thread receives extracted snapshots and mirrored source assets.

Bootstrap and readiness are two separate Promises. First await
`startGeneratedBrowserApp` (or Vite's exported `appPromise`) to obtain the app,
then await `app.ready`. Calling `.request` on the unawaited bootstrap Promise is
a JavaScript caller error: no engine request has been invoked yet.
Use `// @ts-check` and a TypeScript configuration with `allowJs`, `checkJs` and
`noEmit` to catch that mistake before opening a browser. Vite transpilation alone
does not perform this check. The generic
[checked embedding example](../examples/checked-browser-embedding.js) accepts the
host's own config and worker; from this repository run:

```sh
pnpm exec tsc --noEmit -p examples/tsconfig.checked-browser-embedding.json
```

`ready` resolves after GPU and worker initialization. Configured asynchronous
assets may still be loading; `request("asset_list")` reports their current state.
Initialization failures reject readiness with diagnostics. Requests made through
the returned app await readiness.

The typed `request` method supports entity queries/lookups, asset listing, camera
inspection/pose/projection edits and pause. It returns the tool's typed result and rejects
failed semantic operations with `ApertureBrowserControlError.diagnostics`.
`requestRaw` exposes other existing semantic tools through their normal
`{ ok, result, diagnostics }` response. Both use the same worker bridge as managed
MCP tooling. Requests default to a 10-second deadline, support an `AbortSignal`
and `timeoutMilliseconds`, and have a bounded pending queue.

`camera_set_projection` accepts a camera `key` or generation-checked `entity`
reference, plus optional `projection` (`"perspective"` or `"orthographic"`),
`fovYDegrees`, `near`, `far` and `orthographicHeight`. Supply at least one
projection field. Omitted fields retain current values, including the inactive
mode's FOV or height. It validates the complete prospective Float32 values and
clip matrix before any ECS field changes: positive distances/height/aspect,
`near < far`, and FOV strictly between 0 and 180 degrees. Failed patches leave
every camera field unchanged. Successful requests return `camera_get`-shaped
readback; the next `renderFrame` extracts the updated worker-owned projection.
Camera transforms, automatic aspect behavior and the worker clock are preserved.
This same semantic tool is available to headless and MCP clients; component names
or raw `fovYRadians` edits are unnecessary for projection changes.

Manual cadence starts paused and submits no initial frame. Input and resize
events update queued state without advancing its clock. `renderFrame` advances
one worker step, extracts its actual frame, mirrors the corresponding assets and
submits that frame through native WebGPU. Its Promise resolves after submission;
GPU queue completion is a separate operation owned by the caller. The returned
report is detached JSON data using the existing renderer report type.

`deltaSeconds` defaults to zero. Delta and optional time must be finite and
non-negative. Concurrent frame calls are serialized through submission, with a
bounded queue. A frame cannot be fulfilled by an initial, duplicate, unrelated
or stale snapshot. Shared frames verify the published sequence as well as the
frame number, so a later refresh at the same frame cannot silently replace the
requested data. Controlled frames send source-asset deltas against successfully
mirrored producer versions: the first frame receives current assets, unchanged
assets send no payload, and missed updates are resent. Changed mesh entries use
complete payloads so a skipped patch base cannot corrupt geometry.
Transferable and shared-buffer transports retain the same
worker/extraction boundary. A missing frame, worker failure, aborted request or
render failure rejects with its diagnostic rather than appearing successful.

Manual cadence owns the worker clock: public `requestRaw` and managed MCP reject
`ecs_step`, `ecs_step_and_diff` and `ecs_resume` with guidance to use `renderFrame`.
The exposed `worker` handle remains an advanced transport escape hatch; do not
mix direct clock messages with manual frame control. Continuous and demand
cadences keep their existing automatic behavior.

`inspectRenderedFrame` returns detached existing snapshot inspection data for
the last submitted frame, or `null` before a frame. It reports actual packet
counts, referenced asset handles and diagnostics. It exposes neither a mutable
asset registry nor shared snapshot buffers.

`dispose` is idempotent. It rejects pending requests and frames, removes browser
listeners and resize observers, stops diagnostics/audio, terminates the worker
and releases renderer feature resources plus all app-owned GPU buffers,
textures and query sets. Rendering and picking already in progress drain before
those resources are released. Borrowed source assets, caller-created GPU objects
and the public device remain with their owners. Every cleanup is attempted even
when a feature disposer or resource destruction fails; disposal then rejects
with the collected errors. New rendering, picking, start and registration calls
are rejected once disposal begins, without introducing a GPU queue fence.

Vite's `virtual:aperture/browser-entry` exports `appPromise` for integrations that
consume the generated bootstrap. After awaiting that Promise, await `app.ready`
before using semantic tools or requesting manual frames.
