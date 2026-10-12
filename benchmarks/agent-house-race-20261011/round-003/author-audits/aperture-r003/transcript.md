# Public operational transcript

Lane `aperture-r003` (aperture). Raw wall time 1509.949s; preview waiting 103.257s; active budget time 1406.692s.

24 commands, 1 unsuccessful exits, 0 identical-command retries after failure.

This contains public tool operations only. Exact binary stdout/stderr survives beside each command record; text below decodes UTF-8 with non-UTF-8 bytes escaped and makes no inference about private model reasoning.

## Command 50228c2936644bbd8f320eded7c8693c

2026-10-12T09:03:50.913441+00:00 → 2026-10-12T09:03:51.030703+00:00; exit 0; duration 0.117s.

Command:

```sh
cat /reference/prompt.txt
```

Stdout:

````text
Assigned engine: Aperture, current working-tree SDK snapshot. Dependencies are preinstalled from /sdk/packages. Public docs and package sources are read-only at /sdk/docs, /sdk/docs-site-src and /sdk/source. CLI is installed. Follow the normal simulation worker, ECS, extraction snapshot and main-thread WebGPU design. Do not bypass this with a main-thread authoritative scene or another renderer.

Build a polished, moderately detailed, genuinely three-dimensional scene matching the supplied reference image. Author the house exterior with ivory stucco, terracotta tiled gable roof and chimney, dark framed inset windows, covered front porch with two posts and a door, stone path, low stone garden boundary, shrubs/trees, mailbox, curved asphalt road across the foreground and right side with curbs and broken white markings, and a blue hatchback with four wheels, body contour, glass windows, lights and trim. The distant landscape is optional. Match the warm daylight and composition. Details should remain convincing from other views. Geometry, materials, procedural textures, instancing and batching are allowed. Do not use the reference image as a texture, background or billboard; do not bake the scene into a picture. No external ready-made house/car scene or image-generation tool. You may use public assigned-engine docs and inspect its installed source.

Use only your assigned engine's actual native WebGPU renderer, with no WebGL fallback or third-party renderer. Use the common interface below. Do not alter native APIs, fake measurements or introduce timing delays. Real submitted geometry must be returned by inspectGeometry. Every visible mesh and instance must be represented. Use deterministic scene generation. If you use procedural randomness, use a fixed seed; fresh browser instances must reproduce the same geometry. Do not add an animation loop after registration. Supply a buildable Vite application with `pnpm run build` producing /work/dist.

Final trials use the same binary geometry v2 protocol for both engines: 60 warmup and 120 measured frames, followed by lossless geometry export and the same three cameras. Return owned coherent numeric arrays rather than live SharedArrayBuffer views. All positions, indices, normals, world/instance matrices and instance multiplicity are retained; ordinary Number arrays use Float64LE and typed arrays retain their dtype. Source numeric chunks are at most 4 MiB with a 256 MiB total, native upload parts at most 4 MiB with a 64 MiB total, and manifests at most 8 MiB. The observer retains final nonoverlapping native upload bytes through all measured frames, so common byte-copy instrumentation is included in CPU timings. Capture failures preserve measured samples and invalidate the trial. Native triangle accounting uses the same v2.1 policy for both engines: proven complete owned CPU-written indirect argument spans are decoded at native submit; storage, unknown GPU mutations and unreadable arguments remain explicitly unknown lower bounds. Full raw argument witnesses are deduplicated with per-frame multiplicity. Metadata capacity failure invalidates the attempt after preserving measured samples. No GPU readback or engine-reported count is substituted. Both engines receive an identical finite 1800000 ms verifier readiness/navigation deadline, not a strict whole-process timeout; controlled frame/fence waits and awaited cleanup remain required. Authors implement the same adapter and do not import or alter the harness.

You have 1800 seconds of active authoring budget, beginning when you call start. Dependency installation has already been completed. The recorder separately retains raw wall time and renderer waiting time. You may request at most three previews using the recorder; the coordinator returns only your own canvas views or actual runtime errors, without implementation advice. Preview waiting is credited equally. Each preview freezes your existing /work/dist at request time, then queues that exact build. Build before requesting a preview. Successful previews use three warmup frames, three short diagnostic frames and the same three fixed camera views (nine render requests total). Both engines receive the same numeric geometry export preflight after the six canonical frames: inspectGeometry must return owned coherent supported numeric arrays with valid triangle indices and affine world/instance matrices, within the same 256 MiB source, 4 MiB chunk, 8 MiB numeric descriptor and aggregate work limits. Preview preflight discards numeric arrays after validation and reports only counts/status or actual export errors. It adds no render requests or queue fences. A preflight failure stops the preview and returns the actual error. A valid partial export can pass this numeric check; full visible coverage, native upload parity, final complete manifest size and official eligibility remain separate final-trial checks. Full scoring uses separate final-build trials. A preview wait deadline can expire while the coordinator is still working. Use feedback with that preview number to retrieve its existing response; this spends no additional preview. Runtime error text is returned inline with its full artifact hash. When finished, stop all application processes, build the final app, record a public note describing your implementation and any limitations, and call finish. After finish, make no edits.

Isolation and operational transcript rules: You start with no inherited chat. Do not contact other agents, use collaboration tools, inspect other workspaces, history, root repository, benchmark results, private provider/session data, or environment credentials. All searches, reads, shell commands and edits MUST run through the exact recorder command below. It invokes your command inside your assigned container at /work. Do not call apply_patch or unrecorded host exec commands. Use ordinary Python/Node/heredocs inside that recorded command to edit files. You can inspect the supplied image and returned preview PNGs with view_image; log each image inspection with recorder note. Do not dump the process environment or access secrets. Tools are routed cooperatively; the command container enforces filesystem separation. No browser launches, dev servers left running, Playwright installs, sandbox/flag changes or alternate rendering routes. Preview is the available browser tool.

The only host command entrypoint is:
`python3 -B /workspace/aperture/tools/agent-benchmark/author-lane.py aperture-r003 ACTION [TEXT]`
Actions: start; note PUBLIC_TEXT; exec SHELL_SCRIPT; preview; feedback PREVIEW_NUMBER; finish. Quote each shell script as one argument. This records the exact script, stdout, stderr, timestamps and exit status. A command process group is stopped at command end, so a background server cannot persist between commands. You should use functions.exec -> tools.exec_command only with this entrypoint (including no extra shell operations). Capture all failures and retries. The prompt/reference hashes and source hashes are recorded. These are visible operational records, never private reasoning.

Reference image for view_image: /workspace/aperture/.aperture-env/agent-house-race/lanes/round-003/aperture/public/reference.png
Assigned container workspace /work. Common interface available /reference/contract.md. Reference is /reference/reference.png. Your own prompt is /reference/prompt.txt.

# Agent house benchmark contract

The editable harness lives here. Trial sources, reference images, authentic
visible author transcripts, raw measurements and images belong in separate,
append-only attempt directories under `benchmarks/agent-house-race-20261011/`.
Neither author receives the other author's work or benchmark scores.

## Application interface

The built application registers this object on `globalThis.__AGENT_BENCHMARK__`:

```ts
interface BenchmarkAdapter {
  engine: "three" | "aperture";
  canvas: HTMLCanvasElement;
  ready: Promise<void>;
  setCamera(camera: {
    position: number[];
    target: number[];
    fovYDegrees: number;
    near: number;
    far: number;
  }): Promise<void>;
  renderFrame(frame: {
    frame: number;
    deltaSeconds: number;
    timeSeconds: number;
  }): Promise<void>;
  inspectGeometry(): Promise<{
    meshes: {
      id: string;
      positions: number[] | Float32Array;
      indices?: number[] | Uint16Array | Uint32Array;
      normals?: number[] | Float32Array;
      worldMatrix: number[] | Float32Array; // column-major, 16 values
      instances?: (number[] | Float32Array)[]; // world matrices; replaces worldMatrix
    }[];
  }>;
  dispose(): Promise<void>;
}
```

There must be exactly one 1024 × 768 display canvas, with device pixel ratio 1.
The scene occupies approximately 24 × 24 world units. The house is near the
origin, the curved road runs across the foreground and right side, and the blue
car sits on that road. The canonical camera is `[14, 9, 19]`, looking at
`[0, 2.5, 1]`, with vertical FOV 37°, near 0.1 and far 200. Use ACES tonemapping,
exposure 1, 4× MSAA, a shadow-casting sun, an ambient fill and shadow receivers.
These settings and camera views apply equally to both applications.

Rendering is controlled by the harness. Do not run an animation loop after
registration. `renderFrame` resolves only after that requested frame has been
submitted to the native WebGPU queue. Do not add an artificial queue wait;
the harness owns queue fences. Camera updates must affect the next submitted
frame. Aperture keeps its normal simulation worker, ECS and extraction boundary;
the adapter waits for a worker snapshot before submitting that snapshot.
Three.js must use its WebGPU renderer without WebGL fallback.

`inspectGeometry` reads the actual scene mesh buffers, including all visible
objects and instance transforms. It must not return decorative estimates.
Avoid duplicated mesh entries for one rendered instance. The harness computes
counts, bounds, degeneracy and unique geometry from these arrays. It also attempts
to match position streams against native `writeBuffer`/mapped buffer uploads.
Unmatched streams remain explicitly lower-confidence; an independently audited
source and surviving geometry arrays are required before geometry claims.

The harness is injected before the app boots. Authors need only implement this
interface; they must not import the measurement client or modify native APIs.

# Binary geometry capture v2

This additive protocol retains the scientific contract: 60 warmup frames, 120
measured frames, three fixed cameras, three fresh-browser trials per engine,
identical scene/author budgets, and unchanged scoring weights. Both engines in a
fresh round use the same immutable v2 harness. Original v1 native modules,
recordings and failed trials remain unchanged. Old failures cannot be rerun or
rescored through this protocol.

Geometry export occurs after the last measured frame (179), before the three
camera views. Numeric copying, geometry analysis, hashing, serialization and
upload stay outside the measured window. A capture failure retains all completed
raw warmup/measured samples in failure.json and makes the attempt ineligible.
Raw vertex-upload observation remains enabled from startup through the last
measured frame. Its bounded byte copies run during measurement for both engines;
CPU timings include that common instrumentation and must not be compared directly
with v1 timings that sealed uploads before measurement.

inspectGeometry must return owned coherent arrays, including every visible mesh,
index, normal, actual world matrix and instance matrix. Live SharedArrayBuffer
views are rejected; public SDK readers can produce owned coherent copies.
Typed numeric arrays retain their element dtype, with explicit little-endian
encoding. Ordinary Number arrays and all matrix rows use IEEE754 Float64LE.
Both a supplied world matrix and supplied instance matrices are retained, even
when instance matrices determine effective transforms. No coordinates are
quantized, sampled or omitted. Index range, affine matrices, triangle counts,
degeneracy, bounds and normals are independently checked.

The source numeric stream has contiguous chunks of at most 4 MiB and a total
256 MiB limit. Raw native upload segments have 4 MiB parts and a total 64 MiB
limit. Every POST requires a matching immutable acknowledgment of path, byte
length and SHA256. The final geometry-manifest-v2.json commits all parts, field
offsets, dtype, lengths, matrix row container runs, counts, canonical hashes,
exact positive native-position witnesses and full matrix/multiplicity digest.
The host verifies all receipts, reconstructs numeric readers and native segments,
and recomputes geometry facts and hashes. A positive witness must match every
Float32 position in a submitted native vertex-buffer span. This correlation does
not independently prove native index/shader/transform interpretation or final
visibility; source audits and view judgments remain necessary.

Native capture counts final nonoverlapping retained bytes: replacing a span
subtracts the overwritten bytes before testing the cap. A genuinely over-budget
write discards any stale overlapping captured bytes and permanently marks capture
incomplete. It cannot appear as successful parity against obsolete uploads.

Limits are frozen in protocol-v2.mjs: metadata 8 MiB, 5,000 meshes, 100,000 native buffer records, 10,000 native
segments, 1,000,000 total matrix rows, 20,000 matrix-container runs, 20,000,000
transformed vertices and 10,000,000 instanced triangles. Native parity search has
20,000,000 comparisons per mesh and 1,000,000,000 per export; exhaustion is an
explicit unmatched result that reduces documented parity confidence. It does not
claim an exact positive witness or change the existing manual source-audit
eligibility requirement. Aggregate
HTTP attempts and artifact counts are bounded, with one reserved 8 MiB failure
record. Numeric, native-capture and metadata capacity exhaustion fail the entire attempt,
including omitted observer records and incomplete raw writes. Matcher comparison
work exhaustion records an unmatched witness as described above. No assets are
silently reduced. No retries or larger
unbounded JSON fallback are permitted.

Both engines receive the same 1,800,000 ms verifier readiness/navigation deadline.
It applies to approved verifier waits, not a strict whole-process wall timeout.
The client retains its 120-second interface registration deadline. Controlled
frame promises and native queue fences use the approved verifier readiness wait;
browser shutdown and lifecycle descendant reaping remain awaited. Runtime flags,
security configuration and the rendering verification route are unchanged.

Before author dispatch, preparation freezes all protocol/client/observer/runner/
recorder/summary inputs and provides the same generic transport, capture-phase,
instrumentation and deadline rules to both authors. Protocol v1 and v2 evidence
cannot be mixed within one round. A completed six-attempt sequence with an
ineligible offline summary is recorded as completed-ineligible and retains its
nonzero exit status; unresolved lifecycle/control errors halt for reconciliation.

## Native indirect triangle accounting v2.1

The common observer counts native direct arguments and fully readable CPU-written
indirect arguments at queue submission. Supported arguments are retained as exact
little-endian16B/20B byte witnesses, including first index/vertex, signed indexed
baseVertex and firstInstance. Full buffer/offset/method/topology/bytes/provenance
tuples are deduplicated; each controlled frame retains references and multiplicity.
Repeated static draws do not spend additional distinct-witness capacity.

STORAGE buffers, shared CPU sources, incomplete/opaque spans, unsupported topology
and unproven GPU mutations remain explicit unknown indirect contributions. Known
GPU buffer mutation destinations and opaque routes invalidate CPU span provenance
conservatively until a complete argument-span CPU overwrite. Indexed strips are
unknown because primitive restart is not proven by argument bytes. All real calls
remain counted; unknown contributions are0 in the documented triangle lower bound.
Source/index/shader/world-transform review remains necessary; this is not a GPU
readback or a visibility proof. No native flags, buffer usage, waits or fences change.

Samples retain known/unknown indirect calls, exact known indirect contributions,
unknown reasons and supported/lower-bound confidence. Metadata is bounded by
16,384 distinct witnesses and the existing8MiB transport capacity. Exhaustion
marks proof incomplete while observed known counters stay accurate; export fails
after all120 measured frames so numeric samples survive. Metadata is never
trimmed to make a trial eligible. Only the newly frozen common v2.1 protocol can
claim supported indirect contributions; original v1 and old v2 recordings stay
unchanged and are not rescored through this repair.

Command-buffer mutation destinations are conservatively invalidated before any
draw in the submitted list is counted, including a mutation ordered later than
an indirect draw. Indexed triangle-strip direct calls also remain unknown because
restart indices are not established; unsafe direct arithmetic is never reported
as exact. unknownDirectTriangleDrawCalls makes these lower-bound contributions
explicit. Legitimate render-bundle finish preserves readable provenance, and
replayed indirect bundles read the latest CPU-written arguments at each submit.

CPU-only indirect argument capture remains active through all three controlled
post-export camera views. POSITION upload receipts and capture statistics freeze
after measured frame 179. The observer preserves owned pre-seal argument bytes for
cached command replay and observes subsequent native queue/mapped CPU writes at
submit; GPU mutation, STORAGE, shared writes, incomplete capture and unsupported
topology retain the same conservative unknown policy. This lifetime is explicitly
versioned as `aperture.native-indirect-capture-lifetime.v2.2`. The argument proof
dictionary remains bounded to 16,384 distinct witnesses.

The 64 MiB native byte budget and 10,000 total/1,000 per-buffer segment budgets
cover frozen POSITION receipts plus live owned argument storage together. Raw
bytes that were neither exported nor needed for CPU-only indirect arguments are
released at sealing. Mixed VERTEX|INDIRECT buffers keep immutable exported bytes
and use a separately budgeted owned copy for live arguments; copying does not
establish new CPU provenance. Original pre-seal failures remain in the frozen
geometry statistics. Post-seal capacity exhaustion is explicit and fails the
attempt after retaining the 120 measured samples, rather than accepting unknown
counts as complete proof. No readback, fence, buffer usage, workload or score
weights change. Prior diagnostic artifacts and protocol freezes remain unchanged.
````

Stderr:

```text

```

## Public note — 2026-10-12T09:03:57.049475+00:00

```
Inspecting the assigned reference image to establish composition, materials and scene proportions.
```

## Command 7cfeebeba426419fb9ac6ce291217580

2026-10-12T09:04:03.956469+00:00 → 2026-10-12T09:04:04.074590+00:00; exit 0; duration 0.118s.

Command:

```sh
pwd; rg --files /sdk/docs /sdk/docs-site-src | head -60; ls -la /work; cat /work/package.json 2>/dev/null
```

Stdout:

```text
/work
total 80
drwx------  4 node node  4096 Oct 12 08:34 .
drwxr-xr-x 20 root root  4096 Oct 12 08:34 ..
-rw-------  1 node node    35 Oct 12 08:34 .npmrc
-rw-------  1 node node   171 Oct 12 08:34 index.html
drwxr-xr-x  5 root root  4096 Oct 12 08:34 node_modules
-rw-------  1 node node  2852 Oct 12 08:34 package.json
-rw-r--r--  1 root root 53177 Oct 12 08:34 pnpm-lock.yaml
drwx------  2 node node  4096 Oct 12 08:34 src
{
  "name": "house-aperture",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "8.0.16",
    "typescript": "6.0.3",
    "prettier": "3.8.3"
  },
  "dependencies": {
    "@aperture-engine/app": "file:/sdk/packages/aperture-engine-app-0.3.0.tgz",
    "@aperture-engine/audio": "file:/sdk/packages/aperture-engine-audio-0.3.0.tgz",
    "@aperture-engine/cli": "file:/sdk/packages/aperture-engine-cli-0.3.0.tgz",
    "@aperture-engine/math": "file:/sdk/packages/aperture-engine-math-0.3.0.tgz",
    "@aperture-engine/particles": "file:/sdk/packages/aperture-engine-particles-0.3.0.tgz",
    "@aperture-engine/physics": "file:/sdk/packages/aperture-engine-physics-0.3.0.tgz",
    "@aperture-engine/physics-rapier": "file:/sdk/packages/aperture-engine-physics-rapier-0.3.0.tgz",
    "@aperture-engine/reference-assets": "file:/sdk/packages/aperture-engine-reference-assets-0.3.0.tgz",
    "@aperture-engine/render": "file:/sdk/packages/aperture-engine-render-0.3.0.tgz",
    "@aperture-engine/runtime": "file:/sdk/packages/aperture-engine-runtime-0.3.0.tgz",
    "@aperture-engine/simulation": "file:/sdk/packages/aperture-engine-simulation-0.3.0.tgz",
    "@aperture-engine/ui": "file:/sdk/packages/aperture-engine-ui-0.3.0.tgz",
    "@aperture-engine/vite-plugin": "file:/sdk/packages/aperture-engine-vite-plugin-0.3.0.tgz",
    "@aperture-engine/webgpu": "file:/sdk/packages/aperture-engine-webgpu-0.3.0.tgz"
  },
  "pnpm": {
    "overrides": {
      "@aperture-engine/app": "file:/sdk/packages/aperture-engine-app-0.3.0.tgz",
      "@aperture-engine/audio": "file:/sdk/packages/aperture-engine-audio-0.3.0.tgz",
      "@aperture-engine/cli": "file:/sdk/packages/aperture-engine-cli-0.3.0.tgz",
      "@aperture-engine/math": "file:/sdk/packages/aperture-engine-math-0.3.0.tgz",
      "@aperture-engine/particles": "file:/sdk/packages/aperture-engine-particles-0.3.0.tgz",
      "@aperture-engine/physics": "file:/sdk/packages/aperture-engine-physics-0.3.0.tgz",
      "@aperture-engine/physics-rapier": "file:/sdk/packages/aperture-engine-physics-rapier-0.3.0.tgz",
      "@aperture-engine/reference-assets": "file:/sdk/packages/aperture-engine-reference-assets-0.3.0.tgz",
      "@aperture-engine/render": "file:/sdk/packages/aperture-engine-render-0.3.0.tgz",
      "@aperture-engine/runtime": "file:/sdk/packages/aperture-engine-runtime-0.3.0.tgz",
      "@aperture-engine/simulation": "file:/sdk/packages/aperture-engine-simulation-0.3.0.tgz",
      "@aperture-engine/ui": "file:/sdk/packages/aperture-engine-ui-0.3.0.tgz",
      "@aperture-engine/vite-plugin": "file:/sdk/packages/aperture-engine-vite-plugin-0.3.0.tgz",
      "@aperture-engine/webgpu": "file:/sdk/packages/aperture-engine-webgpu-0.3.0.tgz"
    }
  }
}
```

Stderr:

```text
/bin/sh: 1: rg: not found
```

## Command 449cb4ce7d7349e496127b34aacb5155

2026-10-12T09:04:15.762430+00:00 → 2026-10-12T09:04:15.932292+00:00; exit 0; duration 0.170s.

Command:

```sh
find /sdk/docs -maxdepth 2 -type f | head -50; find /work/src -type f; find /sdk/source -maxdepth 2 -type d | head -40; cat /work/src/*
```

Stdout:

```text
/sdk/docs/BROWSER_FRAME_CONTROL.md
/sdk/docs/AGENT_AUTHORING_BASELINE.md
/sdk/docs/MIXED_SHADOWS.md
/sdk/docs/VISUAL_QUALITY.md
/sdk/docs/AI_TOOLING.md
/sdk/docs/RENDERED_GEOMETRY_INSPECTION.md
/sdk/docs/AUTHORING.md
/sdk/docs/DECISIONS.md
/sdk/docs/ARCHITECTURE.md
/sdk/docs/HEADLESS_SOURCE_REALMS.md
/work/src/main.js
/sdk/source
/sdk/source/physics
/sdk/source/physics/src
/sdk/source/physics/dist
/sdk/source/physics-rapier
/sdk/source/physics-rapier/src
/sdk/source/physics-rapier/dist
/sdk/source/app
/sdk/source/app/src
/sdk/source/app/dist
/sdk/source/math
/sdk/source/math/src
/sdk/source/math/dist
/sdk/source/particles
/sdk/source/particles/src
/sdk/source/particles/dist
/sdk/source/render
/sdk/source/render/src
/sdk/source/render/dist
/sdk/source/cli
/sdk/source/cli/src
/sdk/source/cli/dist
/sdk/source/runtime
/sdk/source/runtime/src
/sdk/source/runtime/dist
/sdk/source/webgpu
/sdk/source/webgpu/src
/sdk/source/webgpu/dist
/sdk/source/reference-assets
/sdk/source/reference-assets/dist
/sdk/source/audio
/sdk/source/audio/src
/sdk/source/audio/dist
/sdk/source/ui
/sdk/source/ui/src
/sdk/source/ui/dist
/sdk/source/simulation
/sdk/source/simulation/src
/sdk/source/simulation/dist
/sdk/source/vite-plugin
// Build the assigned scene and register the benchmark adapter here.
```

Stderr:

```text

```

## Command 377e062fea8c4e41bfcccaf925cf88b3

2026-10-12T09:05:31.735406+00:00 → 2026-10-12T09:05:31.904566+00:00; exit 0; duration 0.169s.

Command:

```sh
cat /sdk/docs/AGENT_AUTHORING_BASELINE.md /sdk/docs/BROWSER_FRAME_CONTROL.md /sdk/docs/RENDERED_GEOMETRY_INSPECTION.md /sdk/docs/VISUAL_QUALITY.md
```

Stdout:

````text
# Agent authoring baseline

This offline task suite measures concrete authoring outcomes through the existing
headless/tooling surface. It complements unit tests; it is not a model benchmark,
GPU screenshot test, or a claim about time saved by an agent.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run test/cli/agent-authoring-journeys.test.ts test/app/devtools-camera-framing.test.ts test/cli/camera-framing-tools.test.ts
```

The suite uses seed 42 for authoring journeys and a local committed GLB
(`examples/developer-api/public/assets/cube.glb`). It runs strict asset loading
with HTTP disabled and verifies that no asset placeholders were substituted.
Tests create fresh worlds and require no browser, embedding model, or account.
The repository's shuffled test order remains enabled.

## Journey contracts

| Journey                   | Required outcome                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| First scene               | Boot, settle, find a keyed mesh, read its transform, extract a mesh draw                         |
| GLB import and edit       | Inspect real imported mesh data, resolve the imported root, edit scale and verify the result     |
| Compose and revise        | Capture an ECS checkpoint, edit a transform, read it back and report exactly one changed entity  |
| Diagnose an edit          | Reject an unsupported field with an actionable diagnostic and preserve the authored transform    |
| Interaction and replay    | Inject a semantic button, move the subject through an authored system, reset the seed and replay |
| Frame unfamiliar geometry | Fit unknown dimensions and hierarchies, then verify bounds with actual extracted camera matrices |

The first five journeys already passed on the baseline implementation. They
protect existing strengths rather than implying those workflows were missing.

## Framing experiment

`camera_fit_entity` preserves its existing point-plus-radius contract. Without
an explicit radius, all six controlled shape cases place the camera five units
from the subject origin. The distance alone is sufficient for only two of the
six complete AABBs, even assuming an ideal orientation:

| Case                     | Dimensions         | Aspect | Fixed distance 5 contains bounds |
| ------------------------ | ------------------ | ------ | -------------------------------- |
| Unit cube                | 1 × 1 × 1          | 1      | Yes                              |
| Large cube               | 20 × 20 × 20       | 1      | No                               |
| Tall product             | 2 × 20 × 2         | 1.5    | No                               |
| Wide product in portrait | 20 × 2 × 2         | 0.5    | No                               |
| Tiny prop                | 0.01 × 0.01 × 0.01 | 1      | Yes                              |
| Deep assembly            | 2 × 2 × 20         | 1      | No                               |

This baseline intentionally isolates radius adequacy from legacy camera
orientation behavior. It is not a six-task agent success rate, nor a diagnosis
that a caller-supplied radius is incorrect.

The new `camera_frame_entities` succeeds on all six cases without caller-side
bounds calculations or radius guesses. The test projects all eight aggregate
bounds corners with the actual extracted Float32 view-projection matrix,
checking positive clip W, X/Y margin and WebGPU depth in [0, 1]. Additional
acceptance coverage includes:

- A real GLB root with nested meshes, rotated/nonuniform/negative scales
- Perspective and orthographic cameras, narrow portrait viewports and near-pole angles
- Overlapping and disjoint selections, exclusion of descendants, and repeat calls
- An initially offscreen subject with no extracted mesh draws
- Immediate extraction after framing, with no simulation step to refresh the camera
- Headless and generated-worker routing, including cameras created after viewport resize
- A deterministic 48-case size/aspect/angle grid for each projection
- Invalid selectors, ancestor hierarchies, empty/unavailable/invalid source bounds,
  and Float32 precision errors that preserve authored camera state

## Scope of evidence

The fit is based on static mesh-source AABBs. Selected hidden or differently
layered meshes still contribute; animated skin/morph/shader displacement is not
measured. Projection containment does not establish material correctness,
lighting, occlusion, scissor visibility, or rendered pixels. Final visual
acceptance still requires `render_diagnose`/`frame_capture` and a working WebGPU
browser.

See [AI tooling](AI_TOOLING.md#frame-an-imported-model-or-composed-scene) for the
public call contract and result fields.

## Editing-affordance experiment

`test/cli/entity-editing-affordances.test.ts` covers the inspection/edit/read-back
journey using published MCP argument shapes and runtime mutation metadata.
Previously the seven entity query/selection/schema/mutation/checkpoint tools
advertised only routing keys (`target`, `appRoot`). The component schema exposed
storage types but no machine-readable editing permissions.

The expanded contracts now describe selectors, nested queries, imported-source
filters, snapshot labels/references and complete mutation values. A camera
schema identifies its 10 allowlisted fields and 9 read-only fields directly from the
existing registry. Original type values, enum maps and defaults are unchanged.

Acceptance covers valid edits, readonly-field and nested-path rejections,
unchanged numeric/quaternion checks, runtime-spawned custom schema visibility,
source matching, selector-history fallback, and JSON-RPC serialization. Mutating
a returned metadata list does not grant any additional writing capability.
These are deterministic contract checks, not measured agent success rates or
claims of superiority over another library.

## Transform-group composition

`test/app/spawn-group.test.ts` compares `spawn.group` against the prior explicit
entity/metadata/transform-component construction recipe. The helper produces the
same ordinary ECS state while avoiding that low-level boilerplate. It allocates
no mesh, material or other rendering asset.

Acceptance checks nested local transforms, world-preserving reparenting through
the existing hierarchy API, sibling isolation after revision, recursive teardown,
failed-construction cleanup, and a real GLB plus procedural base surviving a
session snapshot/restore. The restored assembly is framed and extracted through
the existing tools. This is structural evidence; no new visual-parity claim is
made from it.

## Native procedural authoring loop

The cross-feature acceptance test runs the built Node CLI as a separate process,
so Vitest's source aliases cannot substitute for shipped package imports:

```sh
pnpm run build
pnpm exec vitest run test/cli/procedural-authoring-native.test.ts
```

It writes a temporary app configuration and TypeScript system, then talks to
`aperture mcp stdio` using JSON-RPC. The system authors a transform-only group,
a low-poly torus, a box, lights and a camera. Each independently parameterized
mesh has its own key, preserving the facade's existing asset-identity contract.

The test discovers tool schemas and writable transform fields, edits the group,
checks unchanged child-local transforms and updated world transforms, and compares
matching ECS checkpoint selectors. It frames the complete assembly, saves a session,
resets and restores it, then verifies authored state with remapped parent references.
Finally it exports a real-asset render bundle and checks both mesh draws, all four
mesh/material entries, and complete dependency closure without placeholders.

Build before running the test; it intentionally does not rebuild while parallel
test workers may be reading `dist`. Temporary app files and the exact child process
are cleaned up after the test. This closes the native module-loading and MCP
integration loop, but does not execute a WebGPU renderer or validate pixels.
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
const frame = await app.renderFrame({ deltaSeconds: 0, timeSeconds: 0 });
console.log(frame.snapshotFrame, frame.report.counts);
console.log(app.inspectRenderedFrame());
await app.dispose();
```

The worker entry uses the normal `startGeneratedSimulationWorker` bootstrap and
ECS-authored systems. Simulation and scene state remain in that worker; the main
thread receives extracted snapshots and mirrored source assets.

`ready` resolves after GPU and worker initialization. Configured asynchronous
assets may still be loading; `request("asset_list")` reports their current state.
Initialization failures reject readiness with diagnostics. Requests made through
the returned app await readiness.

The typed `request` method supports entity queries/lookups, asset listing, camera
inspection/pose edits and pause. It returns the tool's typed result and rejects
failed semantic operations with `ApertureBrowserControlError.diagnostics`.
`requestRaw` exposes other existing semantic tools through their normal
`{ ok, result, diagnostics }` response. Both use the same worker bridge as managed
MCP tooling. Requests default to a 10-second deadline, support an `AbortSignal`
and `timeoutMilliseconds`, and have a bounded pending queue.

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
# Inspect submitted static mesh geometry

Enable bounded capture when creating a generated app:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  render: {
    cadence: "manual",
    geometryInspection: { maxRetainedBytes: 32 * 1024 * 1024 },
  },
  // Existing systems, components and resources remain in the worker.
});
```

Then use the browser app's read-only inspection method after a frame is rendered:

```ts
await app.ready;
await app.renderFrame({ deltaSeconds: 0 });
const geometry = app.inspectRenderedGeometry({
  maxBytes: 16 * 1024 * 1024,
  maxVertices: 250_000,
  maxIndices: 750_000,
  maxInstances: 25_000,
});

if (geometry.status === "complete") {
  for (const draw of geometry.draws) {
    const mesh = geometry.meshes.find((entry) => entry.key === draw.meshKey)!;
    // mesh.positions and mesh.normals are packed local-space float32 triples.
    // draw.worldMatrices holds every submitted WORLD matrix in GPU instance
    // order. Each matrix uses column-major storage and occupies 16 floats.
    console.log(mesh.label, mesh.indices, draw.instances, draw.worldMatrices);
  }
} else {
  console.log(geometry.omissions);
}
```

The defaults are deliberately bounded. Large scenes may return `partial` even
when every draw is a supported static mesh. Inspect the omissions before raising
limits. A `request-budget` omission can be retried synchronously with explicit
larger request bounds:

```ts
let geometry = app.inspectRenderedGeometry();
if (
  geometry.status === "partial" &&
  geometry.omissions.some((entry) => entry.reason === "request-budget")
) {
  console.log(geometry.omissions);
  geometry = app.inspectRenderedGeometry({
    maxBytes: 128 * 1024 * 1024,
    maxVertices: 2_000_000,
    maxIndices: 6_000_000,
    maxMeshes: 4_096,
    maxDraws: 10_000,
    maxInstances: 100_000,
  });
}
if (geometry.status !== "complete") console.log(geometry.omissions);
```

Raising a request limit cannot restore bytes excluded by the capture budget. If
capture reports `capture-budget`, create the app with an explicitly larger
`render.geometryInspection.maxRetainedBytes` (up to `128 * 1024 * 1024`) and submit
the scene again. Other omissions identify unsupported geometry or unavailable
bindings; increasing budgets does not resolve them. Always check the final
status before treating a result as complete within its declared scope.

`geometryInspection: true` uses the 32 MiB capture budget. Omitted or `false`
disables capture and retains no extra mesh or matrix bytes. The lower-level
`createWebGpuApp` option and `WebGpuApp.inspectRenderedGeometry` use the same
contracts. Inspection is synchronous; it never requests worker execution or
GPU readback.

Each result owns its numeric arrays. Editing or transferring those arrays cannot
change ECS, mirrored source assets, future inspection results, or rendering.
Readonly records describe those owned copies; typed arrays themselves remain
editable. A mesh appears once per submitted upload version. Draws preserve their
actual index/vertex ranges, base vertex, view, target, submesh and material slot.
Repeated or batched meshes contain every instance matrix, rather than an estimate
based on the representative draw packet.

Disposal releases the renderer's capture containers and closes inspection.
Calling `inspectRenderedGeometry` afterward throws a disposed-app error. Owned
results already returned remain the caller's responsibility.

Capture retains exact source upload bytes once per successful upload version.
An in-place update patches only the ranges actually written to the GPU. The
previous receipt stays alive while the last submitted frame still references it.
Source registry replacement, source array edits and new unsubmitted snapshots
cannot rewrite the captured frame. Failed attempts that submit no command buffer
leave the previous inspection intact. A later readback or report failure does not
erase an accepted submission. If one target submits and a later target fails,
the result retains the succeeded subset and reports the failed target. Older
asynchronous report completion cannot replace newer submitted geometry.
`submissionSerial` tracks actual recorded
submissions and is separate from the simulation `frame`.

The scope is static triangle-list mesh draws in the submitted scene passes.
Sky/fullscreen passes, shadow-only draws, sprites, UI, text and particles are
outside that scope. Fragment discard, opacity and shader visibility do not turn
source triangles into a pixel-visible geometry claim. Skinned and morphed draws,
unsupported POSITION/NORMAL formats, and unknown indirect GPU arguments receive
explicit omissions. Custom WGSL and user render/compute passes make the recorded
route unavailable because they can change geometry outside CPU static receipts.
No base-pose, shader-deformed or guessed geometry is presented as complete.
Engine-owned CPU-written indirect buffers use their exact retained argument
bytes, including signed base vertices. Arbitrary external GPU buffer writes and
compute deformation are outside this CPU-receipt API; it is not GPU readback.

Source buffers include vertices and indices outside individual draw ranges. Use
each draw's range to derive submitted triangles; multiplying full mesh buffers
by instance count also counts unused geometry. This generic recipe uses only the
public result:

```ts
import type {
  RenderedGeometryDraw,
  RenderedGeometryMesh,
} from "@aperture-engine/app/browser";

function* drawTriangles(
  mesh: RenderedGeometryMesh,
  draw: RenderedGeometryDraw,
) {
  const count = draw.indexed ? draw.indexCount : draw.vertexCount;
  const vertexAt = (element: number) =>
    draw.indexed
      ? mesh.indices![draw.firstIndex + element]! + draw.baseVertex
      : draw.firstVertex + element;
  for (let element = 0; element + 2 < count; element += 3) {
    yield [vertexAt(element), vertexAt(element + 1), vertexAt(element + 2)];
  }
}

if (geometry.status === "complete") {
  const meshes = new Map(geometry.meshes.map((mesh) => [mesh.key, mesh]));
  const referencedSourceVertices = new Set<string>();
  let submittedTriangleInstances = 0;
  for (const draw of geometry.draws) {
    const mesh = meshes.get(draw.meshKey)!;
    for (const triangle of drawTriangles(mesh, draw)) {
      for (const vertex of triangle) {
        referencedSourceVertices.add(`${mesh.key}:${vertex}`);
        const localPosition = mesh.positions.subarray(
          vertex * 3,
          vertex * 3 + 3,
        );
        // Apply each draw.worldMatrices window to this local position to inspect
        // every submitted instance. Translations occupy offsets 12, 13 and 14.
        void localPosition;
      }
      submittedTriangleInstances += draw.instances.length;
    }
  }
  console.log(referencedSourceVertices.size, submittedTriangleInstances);
}
```

Shared mesh keys deduplicate source vertex references across submeshes and draws.
Every draw and instance contributes separately to submitted triangle multiplicity,
including repeated views/targets. These are counts within the declared static
geometry scope, not total GPU allocations, pixel visibility or performance.

Missing normals and non-indexed meshes stay `null`; inspection never generates
normal or index data. POSITION and present NORMAL attributes currently require
float32x3, including valid interleaved streams and non-zero typed-array offsets.
Index buffers retain their source uint16 or uint32 format and declared count.

Capture and request budgets are separate. Capture defaults to 32 MiB and is
bounded by 128 MiB of retained typed-array payload, with at most 4,096 uploaded
mesh receipts, 10,000 submitted draw records and 100,000 instances per captured
frame, with at most 16 retained pending submissions. Pending submissions, cached
receipts and receipts pinned by the last frame
all count toward that cap. Exact world-transform and engine-written indirect
argument buffer mirrors also count toward the cap. Receipt replacement can require room for both old
and new bytes until the prior submission is released. Cache eviction releases
unreferenced receipts; app disposal releases all capture state.

The default request bounds are 16 MiB, 1,024 meshes, 250,000 vertices, 750,000
indices, 4,096 draws and 25,000 instances. Explicit requests may increase these
only up to 128 MiB, 4,096 meshes, 2,000,000 vertices, 6,000,000 indices, 10,000 draws
and 100,000 instances. Invalid, negative, fractional or non-finite limits throw.
Zero request limits are valid. A budget excludes a whole draw and its required
mesh and reports `request-budget`; it never clips an instance list silently.
`copiedBytes` and `retainedBytes` count CPU typed-array payload and make no GPU
allocation or performance claim.

This API can support author inspection and geometry export. Benchmark source
audits still establish provenance, and independent native observations still
establish actual rendering and performance.
# Visual Quality

> **Doc status (2026-07-11): CURRENT.** Matches the generated-app render
> defaults (`tonemap`/`exposure`/`bloom`/`ssao`/`defaultEnvironment`) and the
> `aperture create` templates at 0.3.x.

How Aperture apps get their look, what a fresh app ships with, and which knobs
to reach for when a scene reads flat. This is the doc to read **before**
hand-rolling lighting, skies, or post effects — most of the polished baseline
is already on by default, and the rest is one config field away.

## The default look

A generated app (anything scaffolded by `aperture create`, or any app started
through `@aperture-engine/app`) gets this without configuration:

| Feature      | Default                                        | Where                            |
| ------------ | ---------------------------------------------- | -------------------------------- |
| Tone mapping | `"aces"` (filmic) through the HDR scene buffer | `render.tonemap`                 |
| Exposure     | `1` (enables the rgba16float HDR path)         | `render.exposure`                |
| MSAA         | 4x                                             | `render.sampleCount`             |
| Pixel ratio  | device DPR capped at 2                         | `render.maxPixelRatio`           |
| Environment  | daylight gradient sky + image-based lighting   | `render.defaultEnvironment`      |
| Bloom / SSAO | off (one config field each)                    | `render.bloom` / `render.ssao`   |
| Shadows      | off (opt-in per light)                         | `spawn.light({ shadow: {...} })` |

The templates additionally author a shadow-casting directional sun, a ground
plane that receives shadows, and a subtle bloom. Copy that recipe — it is the
same one the `showcase/` games use.

```ts
render: {
  tonemap: "aces",           // filmic roll-off; the showcase default
  exposure: 1,               // HDR scene buffer; required by bloom/SSAO
  bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
  sampleCount: 4,
  maxPixelRatio: 2,
},
```

## The default environment

Unlit scenes are the single biggest source of "why does my app look bad":
`StandardMaterial` is physically based, so with no lights and no environment
it renders black on a black clear color. To make the zero-config path look
intentional, every app gets a **default daylight environment** — a procedural
gradient sky (soft blue → pale horizon → warm ground) plus matching
image-based lighting fed through the PMREM/irradiance chain, so PBR materials
are lit and have plausible reflections immediately.

The default suppresses itself when the app authors any of:

- a `ProceduralSky` (`this.spawn.proceduralSky({...})`),
- a `Skybox` (`this.spawn.skybox({...})`),
- an environment light (`this.spawn.light({ kind: "environment", ... })`),

or when the config opts out:

```ts
render: {
  defaultEnvironment: false,
},
```

Plain directional/ambient/point lights do **not** suppress it — a sun plus
the default sky is the intended combination. The environment contributes the
ambient/fill term, so scenes generally do not need an `ambient` fill light on
top of it. The illumination gradient is deliberately dimmer than the visible
sky (`DEFAULT_ENVIRONMENT_IBL_INTENSITY`): it targets the ~0.35–0.45 ambient
fill the showcases were tuned around so it can sit under a directional sun
without washing the scene out.

When the app authors **no analytic lights at all**, the default rig also adds
a soft shadowless sun (`light.sun.default`, illuminance 2.2): the
standard-material light buffer requires at least one analytic light, so an
environment-only world would otherwise fail frame resource creation rather
than render. Author any light of your own and the default sun stays out.

To replace the look, author your own sky and keep IBL:
`spawn.proceduralSky` for a gradient (see `createProceduralSky` for the
tunables — colors, horizon position/softness, sun disk), `spawn.skybox` for a
cubemap background (see `showcase/fps` for a panorama-sourced example), and an
environment light for custom IBL. Custom HDR IBL in browser apps currently
requires registering equirect pixel data imperatively (see
`examples/ibl-equirect*` for the payload shape) — the config `asset.hdr(url)`
descriptor does not yet decode pixels in the browser worker.

## Tone mapping and exposure

Operators: `"aces"` (default, filmic), `"agx"`, `"neutral"`, `"reinhard"`,
`"linear"`, `"none"` — the named ones are faithful ports of the three.js
operators. Generated apps render into an rgba16float scene buffer and apply
tonemap + exposure + sRGB encode as the final post stage.

Opt out with `tonemap: "none"`: when neither `exposure` nor a post effect is
configured, that keeps the legacy byte-identical 8-bit path — this is the
setting golden-image baselines and byte-exact render tests should pin.

## Bloom and SSAO

Both are one config field and imply the HDR path:

```ts
render: {
  bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
  ssao: true, // or { radiusPixels, intensity, power, sampleCount }
},
```

Keep bloom subtle (the showcases use intensity 0.02–0.06); it should read as
glow on emissive/bright pixels, not haze. SSAO attenuates indirect light in
creases and contact regions — it grounds objects that otherwise look pasted
onto the scene. Further post effects (SSR, DoF, TAA, FXAA) exist at the
renderer level (`docs/POST_EFFECTS.md`) and are wired through
`createWebGpuApp({ postEffects })` or user passes.

## Shadows

Off by default; enable them on the light that acts as your sun, and mark
meshes:

```ts
this.spawn.light({
  key: "light.sun",
  kind: "directional",
  illuminance: 4,
  transform: { rotationEulerDegrees: [-45, 35, 0] },
  shadow: {
    mapSize: 2048,
    cascadeCount: 1,
    shadowType: 1,
    strength: 0.75,
    filterRadius: 2,
    normalBias: 0.04,
  },
});

this.spawn.mesh({ ..., castShadow: true, receiveShadow: true });
```

A scene with no shadow receiver under the objects (e.g. no ground plane)
will look like it floats regardless of light quality.

## Materials

`material.standard()` is metallic-roughness PBR:

- **`metallic` defaults to `0` (dielectric).** A metal has no diffuse
  response — it renders near-black without an environment map — so
  hand-authored materials are dielectric unless you say otherwise. Only set
  `metallic: 1` when the scene has IBL (the default environment counts).
- **glTF imports keep the glTF spec default** (`metallicFactor: 1`) — that is
  the asset author's contract, not a scene-authoring choice.
- `roughness` defaults to `1` (fully diffuse). Most surfaces read best
  between 0.4 and 0.9; mirrors and polished metal go low.
- `emissiveFactor` may exceed 1 — with bloom enabled that is how you make
  something glow.

Material numeric colors are **linear RGB**. CSS hex palette colors are sRGB:
`color.srgbHex` decodes their RGB channels with the standard sRGB transfer,
while alpha remains straight opacity. Short and long RGB/RGBA hex forms work;
the material factories also accept them directly:

```ts
import { color, material } from "@aperture-engine/app/systems";

material.standard({ baseColor: "#808080" });
material.standard({ baseColor: color.srgbHex("#80808080") });
material.unlit({ baseColor: color.linear(0.5, 0.25, 0.125, 0.5) });
```

Hex strings are converted once at descriptor creation, before render assets are
created. Numeric arrays and `color.linear(r, g, b, a?)` keep their linear meaning;
the helper permits finite HDR values, defaults alpha to 1 and applies no gamma,
clamping or premultiplication. The existing numeric `hexColor(0x...)` retains its
raw normalized-channel behavior for compatibility. Material defaults, lighting,
exposure and low-level numeric render contracts remain the same.

Image declarations use explicit texture color spaces: base-color/emissive images
use `colorSpace: "srgb"`, while normal, roughness and other data maps use
`colorSpace: "data"` or `"linear"` according to their source. glTF texture semantics
continue to follow the glTF contract. Do not manually gamma-decode texture pixels
already tagged as sRGB.

## When a scene looks flat — checklist

1. **Everything near-black?** The default environment was suppressed (an
   authored `ProceduralSky`/`Skybox`/environment light exists, or
   `defaultEnvironment: false`) and no other lights were added — or a
   material sets `metallic: 1` with no IBL.
2. **Washed out / clipped highlights?** `tonemap` was set to `"none"` —
   remove the override or set `"aces"`.
3. **Objects float?** No shadow: enable `shadow` on the sun and set
   `castShadow`/`receiveShadow` on meshes, and give the scene a ground
   receiver.
4. **Everything grey and uniform?** Only ambient light — add a directional
   sun for direction and contrast; the environment supplies the fill.
5. **Glow missing?** Bloom is off — set `render.bloom` (and use emissive
   materials above 1).

## Reference configs

The showcase games are the proof points — copy their render blocks and setup
systems rather than inventing new baselines:

- `showcase/fps/aperture.config.ts` — ACES + bloom + skybox + shadow-casting
  sun + fog.
- `showcase/platformer/src/systems/setup.system.ts` — sun shadow settings +
  blob shadows.
- `showcase/city-builder/aperture.shared-config.ts` — device profiles with
  per-tier bloom.
- `packages/cli/src/create/templates/*.ts` — the scaffolded baseline
  (sun + shadows + ground + bloom over the default environment).
````

Stderr:

```text

```

## Command 0eb9c5ae15ef4f1abc755c83ccec0c8b

2026-10-12T09:05:45.471133+00:00 → 2026-10-12T09:05:45.589266+00:00; exit 0; duration 0.118s.

Command:

```sh
cat /sdk/docs/AUTHORING.md; find /sdk/source/app/src -maxdepth 3 -type f | head -70; find /sdk/source/cli -type f | grep templates | head -20
```

Stdout:

````text
# Authoring Aperture Apps

The default Aperture app is a Vite app with an `aperture.config.ts` file and
worker-discovered ECS systems. The Vite plugin owns browser bootstrap, worker
bundling, asset preload, render extraction, snapshot transport, WebGPU
submission, resize, input forwarding, command forwarding, and diagnostics.

You should be able to see a primitive mesh or GLB without calling
`createWebGpuApp()`, `createExtractionApp()`, `stepAndExtract()`, posting render
snapshots, registering renderer-side assets, or writing a main-thread scene
graph.

## First App Shape

Normal browser apps use this shape:

- `vite.config.ts`: installs the Aperture Vite plugin.
- `aperture.config.ts`: declares mode, canvas, systems, assets, render defaults,
  input actions, signals, and diagnostics.
- `src/systems/*.system.ts`: default-export ECS system classes that run in the
  simulation worker.
- `index.html`: contains the configured canvas.

`index.ts` is not required for the first scene.

```html
<canvas id="aperture"></canvas>
```

## CLI Templates

`@aperture-engine/cli` can scaffold app roots without a separate create package:

```sh
npx @aperture-engine/cli create my-app
npx @aperture-engine/cli create viewer --template glb-viewer
npx @aperture-engine/cli create game --template game
```

Available templates:

- `minimal`: primitive cube, setup/spin systems, input action, signal, AI
  adapter files, and render quality defaults.
- `glb-viewer`: local `public/assets/sample-cube.glb`, blocking GLB asset
  manifest entry, setup system, orbit system, stable `viewer.sampleCube` key,
  and deterministic priorities.
- `game`: local GLB collectible asset, player movement input actions, score and
  goal signals, camera follow, collectible/goal state, and deterministic
  priorities.

Generated apps include `.mcp.json`, `.codex/config.toml`, Claude/Cursor/Copilot
adapter files, and scripts for `dev`, `build`, and `typecheck`.

## Vite Config

```ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [aperture()],
});
```

`@aperture-engine/vite-plugin` is the canonical plugin import. The root
`@aperture-engine/app` entry does not export the plugin because Vite plugin code
is Node/build-time code. `@aperture-engine/app/vite` re-exports the same plugin
as an optional convenience subpath, but this guide uses the canonical package.

## Aperture Config

```ts
import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    floorColor: asset.texture("/assets/floor.png", { preload: "background" }),
    decal: asset.texture("/assets/decal.png", { preload: "manual" }),
  },
  signals: {
    selectedEntity: signal.ref(null),
    gameplayMode: signal.string("edit"),
  },
  input: {
    actions: {
      select: input.button([input.pointer("primary")]),
      jump: input.button([input.key("Space"), input.gamepadButton("south")]),
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft", "KeyA"],
          positiveX: ["ArrowRight", "KeyD"],
        }),
        input.gamepadStick("left"),
      ]),
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: true,
    defaultLight: true,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "warn",
  },
});
```

Asset preload policies:

- `blocking`: loaded before the first simulation tick.
- `background`: starts immediately and exposes readiness signals to systems.
- `manual`: registered in the manifest and loaded when a system or command
  requests it.

Headless apps use the same config shape with `mode: "headless"` and no canvas.
The same system files can run in browser and headless mode.

Generated browser apps default to 4x MSAA when `render.sampleCount` is omitted.
Use `sampleCount: 1` to opt out for performance-sensitive apps. Canvas backing
size follows device pixel ratio capped by `render.maxPixelRatio`, which defaults
to `2`; use `render.pixelRatio` when an app needs an exact fixed backing-scale
policy. Generated diagnostics report the CSS size, backing size, effective pixel
ratio, aspect ratio, and MSAA state.

## Setup System

Scene setup is ECS startup work in a worker system, not mutation of a
main-thread app object.

```ts
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 1.5, 5],
        lookAt: [0, 0.75, 0],
      },
      fovYDegrees: 60,
    });

    this.spawn.light({
      key: "light.key",
      name: "key-light",
      kind: "directional",
      intensity: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.mesh({
      key: "level.crate.primary",
      name: "crate",
      tags: ["interactive", "crate"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [1, 0.55, 0.25, 1],
        roughness: 0.55,
        metallic: 0.05,
      }),
      transform: { translation: [-1, 0.5, 0] },
    });

    this.spawn.gltf(this.assets.gltf("robot"), {
      key: "level.robot",
      name: "robot",
      tags: ["asset", "robot"],
      transform: { translation: [1, 0, 0] },
    });
  }
}
```

`name` is a debugging label. `key` is optional app-authored identity when a
globally unique stable lookup is useful. `tags` are optional discovery metadata
for tools and diagnostics. The canonical runtime identity remains
`{ index, generation }`.

## Primitive And GLB Spawning

Numeric material colors use linear RGB. For CSS palette colors, use
`color.srgbHex` or pass a hex string directly to the material factory:

```ts
import { color, material } from "@aperture-engine/app/systems";

const opaque = material.standard({ baseColor: "#808080" });
const rgba = material.standard({ baseColor: color.srgbHex("#80808080") });
const linear = material.standard({ baseColor: color.linear(0.5, 0.25, 0.125) });
```

The supported forms are `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, in either
case. Their RGB channels are converted to linear values; alpha is unchanged and
RGB remains unpremultiplied. Both color helpers return typed `Vec4` values.
`material.unlit` accepts the same inputs. Numeric descriptors and low-level
materials retain their existing linear semantics; only explicit hex input is
decoded. For typed factory options use `StandardMaterialInputOptions` or
`UnlitMaterialInputOptions`; returned descriptor options remain numeric.

Texture color spaces are declared independently of material constants:

```ts
asset.texture("/assets/base-color.png", {
  colorSpace: "srgb",
  semantic: "base-color",
});
asset.texture("/assets/normal.png", { colorSpace: "data", semantic: "normal" });
```

See [Visual Quality](VISUAL_QUALITY.md) for the complete lighting and color recipe.

Use `this.spawn.mesh(...)` for built-in primitives and
`this.spawn.gltf(...)` for config-declared GLB assets:

```ts
this.spawn.mesh({
  key: "level.floor",
  name: "floor",
  mesh: mesh.plane({ size: [6, 6] }),
  material: material.standard({ baseColor: [0.85, 0.88, 0.9, 1] }),
  transform: {
    rotationEulerDegrees: [-90, 0, 0],
  },
});

this.spawn.gltf(this.assets.gltf("robot"), {
  key: "level.robot",
  transform: { translation: [1, 0, 0] },
});
```

The high-level GLB path hides loader reports, source asset transfer packages,
renderer-side registration, primitive material resolution, ECS command planning,
and ECS replay. Systems consume typed config handles and the generated runtime
mirrors render assets to WebGPU.

### Subdivided planes

`mesh.plane({ size: [width, height], subdivisions: 8 })` creates an XY-plane
grid with eight cells along each axis. It has 81 shared vertices and 128
triangles, positive-Z normals and UVs spanning 0–1. Rotate the plane through
its entity transform to use it as a ground surface. Subdivision adds vertices;
it does not displace them or create terrain height automatically.

`subdivisions` defaults to 1. Finite values are floored and clamped to 1–128;
non-finite values use 1. The default preserves the original four-vertex plane.
For unequal grid dimensions, the lower-level `createPlaneMeshAsset` factory
accepts separate `widthSegments` and `heightSegments` options.

### Ring-shaped procedural parts

Use `mesh.torus` for a ring, tire, or handle without lower-level mesh-registry
plumbing. It routes directly to the existing `createTorusMeshAsset` factory:

```ts
this.spawn.mesh({
  key: "vehicle.frontWheel.ring",
  mesh: mesh.torus({
    label: "Low-poly wheel ring",
    majorRadius: 0.8,
    tubeRadius: 0.2,
    radialSegments: 12,
    tubeSegments: 6,
  }),
  material: material.standard({
    baseColor: [0.12, 0.13, 0.15, 1],
    roughness: 0.9,
  }),
  transform: {
    translation: [0, 1, 0],
    rotationEulerDegrees: [90, 0, 0],
  },
  castShadow: true,
  receiveShadow: true,
});
```

The default ring lies in the XZ plane around the Y axis; the example rotates it
upright. `majorRadius` measures from the center to the tube center, while
`tubeRadius` is the tube's cross-section radius. Choose `majorRadius > tubeRadius`
for an open center. `radialSegments` goes around the ring and `tubeSegments`
around its cross-section. Lower counts give controllable low-poly silhouettes.

Defaults match the underlying factory: `majorRadius: 0.75`, `tubeRadius: 0.25`,
`radialSegments: 32`, `tubeSegments: 12`, and label `"Torus"`. Nonpositive or
non-finite radii fall back to those defaults. Finite segment counts are floored
and clamped to 3–128; non-finite counts use 3. This is the existing factory's
normalization, not a new validation or geometry implementation.

Use unique entity keys for independently parameterized primitives. The app
facade retains key/name-based mesh-handle identity for explicitly keyed or
named spawns. If both are omitted, each spawned entity gets independent mesh
and material assets, so later anonymous primitives cannot change its geometry
or appearance. Anonymous asset IDs are deterministic for the same entity-creation
sequence and initial registry state;
use explicit handles when sharing assets is intentional. This does not introduce
content-addressed deduplication. Assets are registry-owned and remain available
after an entity is destroyed; for repeated spawn/despawn of identical parts,
reuse explicit mesh and material handles rather than allocating new descriptors.

`spawn.mesh` converts both descriptors and validates its ordinary metadata,
transform, and physics inputs before publishing descriptor assets. If those
steps throw, the partial entity is destroyed, existing registry entries stay
unchanged, and you can correct the input and retry the same key. Duplicate-key
failures also discard the new entity and leave the original entity intact.
Successful named/keyed spawns retain their existing asset-replacement behavior;
explicit handles are reused without republishing. Assets are ready when a
synchronous query requiring `Mesh` and `Material` observes the new entity.
This is input-failure recovery, not a general transaction: throwing user
accessors, query observers, or overridden registry methods can have side effects
that are not rolled back. Failed attempts may advance ECS entity generations.

`TorusMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`, and supports exactly the factory's options.
Tori can be children of `spawn.group`, included in snapshots and render bundles,
and inspected with the same mesh-bounds framing tools.

### Custom triangles for roofs, ramps, and irregular props

Use `mesh.triangleList` when primitives cannot express a part's silhouette.
Author local-space position tuples and optional indices; each consecutive triple
is one triangle. Counterclockwise winding is front-facing. For example, this
closed triangular roof uses six positions and eight outward-facing triangles:

```ts
import { mesh, material } from "@aperture-engine/app/systems";

this.spawn.mesh({
  key: "house.roof",
  mesh: mesh.triangleList({
    label: "Low-poly roof",
    positions: [
      [-1, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [-1, 0, -1],
      [1, 0, -1],
      [0, 1, -1],
    ],
    indices: [
      0,
      1,
      2,
      3,
      5,
      4, // gables
      0,
      3,
      4,
      0,
      4,
      1, // underside
      0,
      2,
      5,
      0,
      5,
      3, // left slope
      1,
      4,
      5,
      1,
      5,
      2, // right slope
    ],
  }),
  material: material.standard({ baseColor: [0.6, 0.16, 0.07, 1] }),
  transform: { translation: [0, 2, 0] },
  castShadow: true,
  receiveShadow: true,
});
```

Keep the generated app's daylight environment, a shadow-casting sun and ground
receiver; see [Visual Quality](./VISUAL_QUALITY.md) for the lighting recipe.
This is ordinary ECS mesh authoring and uses the existing triangle-list render,
spatial-query, asset-mirror and snapshot paths.

The options are intentionally small:

- `positions`: required array of `[x, y, z]` tuples, at least three vertices
- `indices`: optional number array, `Uint16Array` or `Uint32Array`; zero-based
  integers referencing source positions. Without indices, positions are consumed
  in triples. The triangle corner count must be a positive multiple of three
- `normals`: optional `[nx, ny, nz]` tuples, exactly one per source position.
  Nonzero explicit normals are normalized and preserve the authored vertex/index
  layout. Omit normals for flat shading: the factory expands each face's three
  corners and computes its own normal, so shared positions keep crisp edges
- `uvs`: optional `[u, v]` tuples, exactly one per source position, remapped when
  flat faces expand. Missing UVs are `[0, 0]`; this helper does not unwrap a mesh
- `label`: optional string, default `"TriangleList"`

To share indexed vertices with authored smooth normals, a ramp surface can use
`positions: [[0,0,0], [2,1,0], [2,1,-1], [0,0,-1]]`,
`indices: [0,1,2, 0,2,3]` and four `[-1,2,0]` normals. Explicit normals are
not generated, welded or crease-angle averaged. Winding is unchanged even if
supplied normals face another direction. For two-sided surfaces, author both
sides or choose an appropriate material render state.

Every coordinate, normal and UV must be finite after conversion to float32.
Faces with zero-area after this conversion (including repeated indices or
positions that round together) are rejected with their triangle number and
source range. Normals must remain nonzero, all attribute counts must match, and
bounds must fit finite float32 storage. Invalid app inputs throw
`aperture.spawn.invalidTriangleListMesh` with `detail.path` and a suggested fix;
validation completes before mesh asset publication. Correct the input and retry
the same entity key; the failed attempt does not retain a partial mesh entity.

The resulting asset owns its buffers and bounds; later input mutation cannot
change it. Like other descriptors, `mesh.triangleList` shallow-copies its options
and reads nested arrays when spawned. Flat output is non-indexed. Explicit-normal
indexed output uses `uint16` up to maximum referenced index 65535 and `uint32`
above that, regardless of the input array type. Bounds use stored float32
positions; unused source positions are discarded during flat expansion, but
retained and included in bounds when explicit normals preserve the source layout.
There is one submesh and one material slot; use separate keyed entities for
multi-material parts or the lower-level `MeshAsset` schema for custom layouts.

`TriangleListMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`. Lower-level consumers can import
`createTriangleListMeshAsset`, `TriangleListMeshOptions`, `TriangleListPosition`,
`TriangleListNormal`, `TriangleListUv`, and `TriangleListMeshError` from
`@aperture-engine/render`; the factory throws the latter (a `RangeError` with a
`path` property). No change to existing primitive normalization is implied.

Repository verification, after `pnpm run build` with a Node version supporting
native TypeScript, can reproduce the roof/ramp scene and a real local GLB import:

```sh
node test/fixtures/triangle-authoring/verify.mjs /tmp/triangle-authoring.json
pnpm exec vitest run test/mesh/triangle-list.test.ts \
  test/app/triangle-list-spawn.test.ts test/cli/triangle-authoring-native.test.ts
```

The first command writes a closure-checked render bundle at the supplied path.
These checks establish source geometry, extraction, bounds, byte round-trips and
package-consumer behavior. They do not verify GPU pixels or measure agent success
against another engine.

### Compose reusable procedural groups

`this.spawn.group(...)` creates a transform-only ECS entity for an assembly.
It accepts the same `name`, unique `key`, `tags` and `transform` metadata as
other spawn helpers, and returns an ordinary `Entity`. It adds no mesh,
material, light, camera, or render asset.

Inside a system's `init`, parent authored parts to that entity:

```ts
const bench = this.spawn.group({
  key: "bench.west",
  name: "West bench",
  tags: ["assembly", "editable"],
  transform: {
    translation: [-2, 0, 0],
    rotationEulerDegrees: [0, 15, 0],
  },
});

this.spawn.mesh({
  key: "bench.west.seat",
  mesh: mesh.box({ size: [2, 0.2, 0.6] }),
  material: material.standard({ baseColor: [0.35, 0.16, 0.07, 1] }),
  transform: { parent: bench, translation: [0, 0.9, 0] },
  castShadow: true,
  receiveShadow: true,
});

for (const [index, x] of [-0.75, 0.75].entries()) {
  this.spawn.mesh({
    key: `bench.west.leg.${index}`,
    mesh: mesh.box({ size: [0.18, 0.8, 0.5] }),
    material: material.standard({ baseColor: [0.12, 0.13, 0.15, 1] }),
    transform: { parent: bench, translation: [x, 0.4, 0] },
    castShadow: true,
  });
}
```

Keep the normal scene lighting/default environment from the templates. This
snippet defines an assembly, not a replacement lighting or rendering setup.
Use a key prefix when building several instances so each entity key stays
unique. Groups can parent other groups, procedural parts, or imported GLB
roots using `transform: { parent: group, ... }`.

Transforms supplied at spawn are local to `transform.parent`; without a parent,
they are root transforms. The usual simulation transform-resolution phase
computes world matrices. Moving/scaling/rotating a group's `LocalTransform`
therefore changes the whole subtree while preserving each part's local values.
For an already-authored entity, `this.hierarchy.setParent(childRef, parentRef)`
is the separate world-preserving reparenting operation and reports unsupported
transform cases.

The authoritative relationship is the ECS `Parent` component. There is no
renderer-owned group object or parallel scene graph. Names/tags, materials,
visibility and other component values are not implicitly inherited by children.
Inspect the full tree through `ecs_get_hierarchy`; use
`this.hierarchy.despawnRecursive({ index: bench.index, generation: bench.generation })`
to remove an assembly and its descendants. A bare `Entity.destroy()` is not the
recursive teardown operation.

Groups participate in ordinary ECS snapshots/restores. Agent tools can find a
group by key, revise its allowlisted local transform, and frame its descendant
mesh bounds with `camera_frame_entities`. Unknown top-level options produce the
existing spawn warning; put `parent` inside `transform`. Failed group
construction does not leave a partial entity behind.

### Imported-model lighting and appearance

Use `spawn.lightRig` for deterministic ECS-owned presentation lighting:

```ts
this.spawn.lightRig({
  key: "lighting.presentation",
  preset: "studio-neutral",
  environmentMap: this.assets.hdr("studioEnvironment"),
  shadows: true,
});
```

The public presets are `studio-neutral`, `outdoor-neutral`, and `none`; their
inspectable definitions are exported as `LIGHT_RIG_PRESETS`. The returned rig
lists its root and light entities and has `remove()` to destroy everything it
owns. Override `environment`, `keyLight`, or `rimLight` without introducing
renderer-only state. `spawn.environment({ source, intensity })` is the direct
single-entity form.

Imported glTF materials use the source policy unless `materials` is provided.
The option accepts `StandardMaterialPatch` or
`material.preset("source" | "painted-stylized" | "matte" | "preview-safe",
overrides?)`. Patches apply to cloned/reused materials for the spawned subtree;
source assets are never mutated. See
[Spawn a glTF scene](recipes/spawn-gltf-scene.md) for the complete field list
and [Lighting imported models](recipes/lighting-imported-models.md) for the
physically faithful and stylized paths.

Light `intensity` is currently a unitless renderer scalar. `illuminance`
continues to work for compatibility but is deprecated because Aperture does
not perform lux conversion. When both are supplied, `intensity` wins and the
authoring diagnostics report the conflict.

Current primitive descriptors include:

- `mesh.box({ size })`
- `mesh.roundedBox({ halfExtents?, radius?, bevelSegments?, label? })`
- `mesh.sphere({ radius, segments? })`
- `mesh.capsule({ radius, depth, segments? })`
- `mesh.plane({ size, subdivisions? })`
- `mesh.cylinder({ radius, depth, segments? })`
- `mesh.cone({ radius, depth, segments? })`

### Rounded boxes

Use `mesh.roundedBox` for a single closed part that needs softened edges. Its
`halfExtents` are half-width, half-height and half-depth, so `[1, 0.5, 0.25]`
produces a part measuring `2 × 1 × 0.5` before its ECS transform. The geometry
has indexed triangles, circular edge bevels, spherical corners, supplied smooth
normals and independent face UVs:

```ts
this.spawn.mesh({
  key: "part.rounded",
  mesh: mesh.roundedBox({
    halfExtents: [1, 0.5, 0.25],
    radius: 0.1,
    bevelSegments: 3,
  }),
  material: material.standard({ baseColor: "#808080", roughness: 0.6 }),
  castShadow: true,
  receiveShadow: true,
});
```

Defaults are `halfExtents: [0.5, 0.5, 0.5]`, radius 10% of the smallest
half-extent, and `bevelSegments: 3`. Extents must be positive and finite; radius
must be finite, nonnegative and no larger than the smallest half-extent. A fully
rounded axis is supported. `bevelSegments` must be an integer from 1 through 32;
it subdivides each half of an edge bevel. Increasing it improves the silhouette
without changing the one-submesh layout. Radius zero returns the existing flat
box geometry, including its face normals and UVs.

Parameters are checked when creating the descriptor, and float32 triangle
collapse is checked before publishing assets or spawning an entity. For tiny
bevels on very large local coordinates, increase radius relative to the extents,
reduce segments, or use a smaller local mesh with a transform. Reuse explicit
mesh/material handles for repeated parts rather than republishing identical
geometry. The same factory and options are exposed as `createRoundedBoxMeshAsset`
and `RoundedBoxMeshOptions` from `@aperture-engine/render`; the facade exports
`RoundedBoxMeshDescriptorOptions`.

## Explicit Heightfield Terrain

Use `mesh.heightfield` for a small, explicit rectangular height grid. It creates
an ordinary open triangle surface with low-poly flat face normals. The same
options are available as `HeightfieldMeshOptions` and
`createHeightfieldMeshAsset` from `@aperture-engine/render`, and as
`HeightfieldMeshDescriptorOptions` from `@aperture-engine/app/systems`.

```ts
this.spawn.mesh({
  key: "terrain.surface",
  mesh: mesh.heightfield({
    width: 8,
    depth: 6,
    heights: [
      [0, 0.2, 0.4, 0],
      [0.1, 0.8, 1.6, 0.1],
      [0, 0.5, 1.1, -0.1],
    ],
  }),
  material: material.standard({ baseColor: [0.22, 0.38, 0.12, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

Coordinate and topology contract:

- `heights[row][column]` is the local Y coordinate, in scene units. Negative
  heights are allowed; values are not normalized, scaled, or recentered
- Rows advance +Z and columns advance +X. `width` is total X extent and `depth`
  total Z extent, both centered on zero and defaulting to 1
- The grid must have at least two rows and two columns, with equal row lengths.
  Rows and the outer grid are ordinary readonly arrays, not packed typed arrays
- Dimensions must be positive finite float32 values, and all samples must be
  finite after float32 conversion. Values round to float32; adjacent grid
  coordinates must remain distinct. Bounds too large for finite float32 storage
  are rejected. No rows, columns, heights, or dimensions are silently clamped
- Each cell's diagonal joins `(r, c)` to `(r+1, c+1)`. Its two triangles are
  `[(r,c), (r+1,c), (r+1,c+1)]` and `[(r,c), (r+1,c+1), (r,c+1)]`, with
  counterclockwise winding when viewed from above (+Y). The diagonal is fixed,
  so a nonplanar cell's shape is deterministic
- UVs are `[column / (columns - 1), row / (rows - 1)]`: U increases with X,
  V with Z, and the full grid spans `[0, 1]` on both axes
- Flat normals duplicate triangle corners: `6 * (rows - 1) * (columns - 1)`
  vertices, no index buffer. Keep explicit grids modest; this is not a streaming,
  LOD, or chunked-terrain system. No smoothing, skirts, closed underside,
  collision shape, random generation, or imported heightmap is added

The factory owns its output buffers, and the result works with existing mesh
validation, upload planning, spatial queries, extraction, and snapshot bundles.
The app descriptor shallow-copies its options, just like other mesh descriptors;
keep nested height arrays stable until spawning. Invalid grids throw
`HeightfieldMeshError` in the render factory, or
`aperture.spawn.invalidHeightfieldMesh` from the app facade, with a stable
`path` such as `heights[2][3]`, `heights[1]`, `width`, or `depth`.

For edits, keep one mesh handle and publish a rebuilt asset. This refreshes
normals, bounds, and the asset version; it does not add another entity. Do not
respawn the same entity key or mutate the published buffers in place.

```ts
import { createHeightfieldMeshAsset } from "@aperture-engine/render";

const heights = [
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
];
const options = { heights, width: 8, depth: 6 };
const dynamic = this.meshes.dynamic("terrain.editable", {
  initial: createHeightfieldMeshAsset(options),
});
this.spawn.mesh({
  key: "terrain.surface",
  mesh: dynamic.handle,
  material: material.standard({ baseColor: [0.22, 0.38, 0.12, 1] }),
  castShadow: true,
  receiveShadow: true,
});

// Later, from the system that owns these samples and this handle:
heights[1]![1] = 2;
dynamic.publish(createHeightfieldMeshAsset(options));
```

`test/fixtures/heightfield-authoring/scene.ts` is a reproducible 4×5 hillside
with a camera, shadow-casting sun, standard material, and 24 triangles. The
native verifier retains the default daylight environment and subtle bloom,
raises one sample through the existing dynamic handle, verifies refreshed
bounds and an unchanged entity, and bundles the edited geometry:

```sh
pnpm run build
node test/fixtures/heightfield-authoring/verify.mjs /tmp/heightfield.json
```

The verifier checks built package exports, native app extraction, owned buffers,
bundle closure without placeholders, and deterministic reset. It does not claim
WebGPU pixel verification; a Blender geometry inspection is also a separate
check from native Aperture rendering.

## Profile-Revolved Lathe Meshes

Use `mesh.lathe({ profile, radialSegments?, label? })` for faceted columns,
bowls, rims, and other rotational parts. The render package exports the same
options as `LatheMeshOptions`, the `createLatheMeshAsset` factory, and
`LatheMeshError`; app/systems exports `LatheMeshDescriptorOptions`.

```ts
this.spawn.mesh({
  key: "bowl",
  mesh: mesh.lathe({
    radialSegments: 12,
    profile: [
      [0, 0],
      [1, 0],
      [1.2, 1],
      [1, 1],
      [0.8, 0.2],
      [0, 0.2],
    ],
  }),
  material: material.standard({ baseColor: [0.55, 0.2, 0.1, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

- `profile` is an ordinary readonly array of at least two exact `[radius, y]`
  tuples. Y is a local coordinate; radii are nonnegative. Values round to finite
  float32. Positive radii must remain positive after conversion
- The full 360-degree revolution is around Y. Positions are
  `[r * cos(theta), y, r * sin(theta)]`, starting at +X and turning toward +Z.
  `radialSegments` is an integer from 3 through 128, default 32
- Preserve profile order: outer walls ordered bottom-to-top face outward; inner
  walls ordered top-to-bottom face inward. An outward horizontal segment faces
  down; an inward horizontal segment faces up. Reversing the profile reverses
  winding. The bowl above explicitly describes underside, outside, rim, inside,
  and floor
- For adjacent profile points i/i+1 and angles j/j+1, let a=(i,j), b=(i+1,j),
  c=(i+1,j+1), d=(i,j+1). Triangles are `[a,b,d]` and `[d,b,c]`
- Radius zero is allowed only at the first or last point. Such a pole emits one
  triangle per angular segment, omitting only the analytically collapsed face.
  No automatic caps are added: positive-radius endpoints remain open. A closed
  positive-radius profile must explicitly repeat its first point at the end;
  there is no implicit last-to-first connection
- The duplicated angular seam has exactly equal positions at j=0 and j=N.
  UVs are `[j / radialSegments, i / (profile.length - 1)]`, including poles.
  V follows point order, not Y or arc length; U=0 and U=1 remain distinct
- Normals are flat per triangle, including across profile corners. Every
  triangle owns three corners in standard POSITION/NORMAL/TEXCOORD_0 buffers;
  no index buffer, smoothing, partial revolution, collider, or RNG is added
- All-axis profiles, interior axis points, consecutive points identical after
  float32 rounding, remaining zero-area triangles, and overflowing bounds are
  rejected. Nothing is silently clamped, repaired, or removed except the
  analytic pole face. Self-intersections, overlaps, and nonmanifold surfaces
  are not detected or repaired; arbitrary profiles are not guaranteed watertight

Errors carry an actionable input path such as `profile[2][0]`,
`profile[1..2].segments[3]`, or `radialSegments`. The app reports
`aperture.spawn.invalidLatheMesh`; invalid spawn leaves assets unchanged and
allows a corrected same-key retry. Unexpected accessor exceptions are preserved.
The descriptor shallow-copies options: keep nested arrays stable until spawn.
The factory owns all output buffers and does not retain input arrays.

Publish edits through a stable dynamic mesh handle, as with heightfields:

```ts
import { createLatheMeshAsset } from "@aperture-engine/render";

const dynamic = this.meshes.dynamic("bowl.mesh");
dynamic.publish(
  createLatheMeshAsset({
    radialSegments: 12,
    profile: [
      [0, 0],
      [1, 0],
      [1.4, 1.2],
      [1.2, 1.2],
      [0.8, 0.2],
      [0, 0.2],
    ],
  }),
);
```

`test/fixtures/lathe-authoring/scene.ts` authors a stepped column and thick bowl
with standard materials, a ground receiver, camera, and shadow-casting sun.
The native consumer retains daylight and subtle bloom, republishes the bowl,
checks extraction and bounds, and verifies exact mesh buffers through a bundle
round-trip and deterministic reset:

```sh
pnpm run build
node test/fixtures/lathe-authoring/verify.mjs /tmp/lathe.json
```

This verifies native geometry and built exports, not WebGPU pixel output.

## Prefabs

Prefabs are serialized `ApertureSceneDocument` blueprints. Author the source
subtree in an ECS world, serialize it with `saveScene(world)`, register the
document through `this.prefabs.register(document)`, then instantiate it with
`this.spawn.prefab(handle, options)`.

```ts
import { saveScene } from "@aperture-engine/simulation";

const document = saveScene(templateWorld);
const cratePrefab = this.prefabs.register(document, { id: "crate.prefab" });

this.spawn.prefab(cratePrefab, {
  key: "crate.instance.1",
  transform: { translation: [0, 0, 0] },
});
```

Prefab instances are ordinary ECS subtrees. Instance options can override the
root transform, and `overrides` can patch component fields by prefab-local id
without mutating the registered blueprint.

## Custom WGSL Materials

Generated browser apps can author a data-only custom WGSL material from config
assets and worker systems. Systems never create WebGPU objects; they declare
shader source, render state, binding layouts, and JSON-safe uniform values. The
main-thread WebGPU app mirrors the source assets, compiles WGSL, creates
renderer-owned buffers/bind groups/pipelines, and submits the final frame.

Declare path-loaded shader source in `aperture.config.ts`:

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    water: asset.shader("/shaders/water.wgsl", { preload: "blocking" }),
  },
});
```

Use the shader handle from a worker system:

```ts
import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

export default class WaterSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.mesh({
      key: "water",
      mesh: mesh.plane({ size: [6, 3] }),
      material: material.customWgsl({
        familyKey: "app/water",
        label: "Water",
        shader: shader.asset(this.assets.shader("water")),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        renderState: {
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
          alphaMode: "blend",
        },
        bindings: [
          material.uniform("water", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              color: { type: EcsType.Vec4, default: [0.02, 0.46, 0.9, 1] },
              time: { type: EcsType.Float32, default: 0 },
            },
            values: {
              color: [0.02, 0.46, 0.9, 1],
              time: 0,
            },
          }),
        ],
      }),
    });
  }
}
```

Inline WGSL is available for tests and small demos:

```ts
material.customWgsl({
  familyKey: "example/tint",
  label: "Inline Tint",
  shader: shader.inlineWgsl(WGSL, { virtualPath: "inline-tint.wgsl" }),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
});
```

V1 custom WGSL shaders use fixed renderer groups:

- `@group(0) @binding(0)`: view uniform, renderer-owned. The layout is
  `{ viewProjection: mat4x4f, cameraPosition: vec4f }`.
- `@group(1) @binding(0)`: read-only storage array of world transforms,
  renderer-owned. Index with `@builtin(instance_index)`.
- `@group(2)`: custom material bindings declared by `material.customWgsl(...)`.
- `@group(3)`: reserved for future renderer extensions.

Mesh vertex locations follow the built-in instance layout: `@location(0)`
position (`vec3f`), `@location(1)` normal (`vec3f`), and `@location(2)` UV
(`vec2f`). Use `runtimeUniformKey` on a group-2 uniform binding when per-frame
values should come from `this.spawn.runtimeUniform(...)`.

Current limitations: WGSL only; no shader imports; no user-supplied WebGPU
objects or callbacks; no arbitrary app-owned material adapter registration; and
lighting/environment integration is deferred. App-route custom WGSL supports
group-2 uniform buffers, texture bindings, sampler bindings, existing
instance-attribute layouts, and mixed built-in/custom frames through the normal
`createWebGpuApp()` path. Storage-buffer bindings are validated but reported as
unsupported until a renderer-independent buffer source asset exists.

See [`recipes/custom-wgsl-material.md`](./recipes/custom-wgsl-material.md) for
a complete shader and material setup.

## Runtime Systems

Systems map to EliCS systems and can query ECS components directly.

```ts
import {
  EcsType,
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinCrateSystem extends createSystem({
  priority: 100,
  queries: {
    crates: {
      required: [Name, LocalTransform],
      where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
    },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {
  override update(_delta: number, time: number): void {
    const speed = this.config.speed.value;

    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * speed));
    }
  }
}
```

Lower numeric `priority` runs earlier. Omit it to default to `0`. `priority` is
static registration metadata from the `createSystem({ ... })` descriptor; it is
not a runtime signal and does not appear in `this.config`. Fields declared under
`config` become runtime signals such as `this.config.speed.value`. System
modules default-export the class; the generated worker registers discovered
systems in priority order. The main-thread generated bootstrap receives
serializable manifest metadata, not live system classes.

`this.queries.<name>.entities` is a `Set<Entity>`. Iterate it with `for...of`,
test membership with `.has(entity)`, and use `.size` for counts.

Use negative priorities only for very early setup, keep ordinary gameplay near
`0` to `100`, and reserve larger values for late reactions such as camera follow
or UI/status synchronization.

## System Context Facades

Inside a system, `this` exposes the whole authoring surface. Everything is typed
and discoverable by autocomplete — you rarely need to import the lower-level
runtime packages directly.

| Accessor                                       | What it gives you                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `this.spawn`                                   | spawn cameras, lights, meshes, GLB, prefabs, particles, fog/sky, runtime uniforms, and non-rendered physics bodies; `this.spawn.animation(entity)` controls glTF animation |
| `this.queries`                                 | the ECS queries declared in `createSystem({ queries })` (`.entities` is a `Set<Entity>`)                                                                                   |
| `this.config`                                  | runtime signal fields declared in `createSystem({ config })` (`this.config.speed.value`)                                                                                   |
| `this.actions`                                 | typed input actions (narrow on `.kind`); `this.keyboard` / `this.gamepads` give raw edges                                                                                  |
| `this.signals`                                 | app signals declared in `aperture.config.ts`                                                                                                                               |
| `this.resources`                               | typed ECS resource store for non-entity state (`defineResource` + `resource.*`)                                                                                            |
| `this.assets`                                  | config-declared asset handles, readiness signals, and manual requests                                                                                                      |
| `this.commands`                                | worker-owned command channels (`drain`, `requestAsset`)                                                                                                                    |
| `this.spatial`                                 | synchronous raycast / overlap / closest-point queries over ECS data                                                                                                        |
| `this.cameras`                                 | camera access (`this.cameras.main.rayFromPointer(...)`)                                                                                                                    |
| `this.physics`                                 | rigid-body facade — see [Physics](#physics)                                                                                                                                |
| `this.audio`                                   | spatial audio (`loop`, `playOneShot`, `clip`)                                                                                                                              |
| `this.particles` / `this.trails`               | particle emitters / motion trails                                                                                                                                          |
| `this.hierarchy`                               | parent/child relationships                                                                                                                                                 |
| `this.materials` / `this.meshes` / `this.gltf` | runtime material / mesh / glTF-instance access                                                                                                                             |
| `this.prefabs`                                 | register and instantiate prefab blueprints                                                                                                                                 |
| `this.interaction` / `this.html`               | pointer interaction state / DOM HTML bridge                                                                                                                                |
| `this.fixedStep`                               | register fixed-step tasks                                                                                                                                                  |
| `this.effects`                                 | lifecycle-owned signal effects (`this.effects.watch(...)`)                                                                                                                 |
| `this.diagnostics`                             | structured diagnostics (`info` / `warn` / `error`)                                                                                                                         |

## Physics

Enable the Rapier rigid-body backend in `aperture.config.ts`. Setting `physics`
also turns on the fixed-step clock that drives it:

```ts
export default defineApertureConfig({
  // ...
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  // or simply: physics: true
});
```

Author bodies inline on a spawned mesh, or spawn a non-rendered body with
`this.spawn.physics(...)`. You do **not** need to import
`@aperture-engine/physics`: the `physics` helper namespace from
`@aperture-engine/app/systems` builds the descriptors, and every `type`/`kind`
is a plain string union.

```ts
import {
  createSystem,
  mesh,
  material,
  physics,
} from "@aperture-engine/app/systems";

// A rendered dynamic body:
this.spawn.mesh({
  key: "crate",
  mesh: mesh.box({ size: [1, 1, 1] }),
  material: material.standard(),
  transform: { translation: [0, 4, 0] },
  physics: {
    rigidBody: { type: "dynamic" }, // "static" | "dynamic" | "kinematicPosition" | "kinematicVelocity"
    collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
  },
});

// A static floor with the equivalent helper form:
this.spawn.physics({
  key: "floor",
  physics: physics.body({
    rigidBody: { type: "static" },
    collider: { shape: { kind: "box", halfExtents: [10, 0.5, 10] } },
  }),
});
```

### Who owns the transform

Physics is authoritative for the pose of any body it simulates, and writes that
pose back into `LocalTransform` every fixed step. This has one important
consequence:

> **Do not move a physics body by writing `LocalTransform` directly — the
> writeback overwrites it the same frame, with no error.**

- **Dynamic** bodies are driven by forces/impulses/velocity and gravity. Read
  their pose from `LocalTransform`; nudge them with `this.physics.applyImpulse`,
  `setLinearVelocity`, etc.
- **Kinematic** bodies are driven by _you_. Move them with
  `this.physics.setKinematicTarget(entity, { translation })` (rotation is
  optional — omit it to keep the current orientation). Spawn them with
  `rigidBody: { type: "kinematicPosition" }` and a `kinematicTarget`.

### Character controller

Drive a kinematic character with `this.physics.moveCharacter`, then commit the
collision-resolved result back to the body:

```ts
const result = this.physics.moveCharacter({
  entity: serializeEntityRef(body),
  desiredTranslation: [dx, dy, dz], // this frame's intended displacement
  settings: { snapToGroundDistance: 0.5, maxSlopeClimbAngle: Math.PI / 4 },
});
if (result !== null) {
  this.physics.setKinematicTarget(body, {
    translation: result.targetTranslation,
  });
  // result.grounded / result.collisions are available for jump + contact logic
}
```

`snapToGroundDistance` must exceed the rest gap between the collider and the
floor or `grounded` never latches; a small constant downward "stick" velocity
while grounded keeps the controller engaged.

## Input, Signals, And Effects

Use lifecycle-owned effects for ECS mutation driven by signals. Do not use raw
Preact `effect()` for arbitrary microtask-time ECS writes.

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SelectSystem extends createSystem({
  priority: 50,
}) {
  override init(): void {
    const select = this.actions.select;
    if (select.kind !== "button") {
      return;
    }

    this.effects.watch(
      select.pressed,
      (pressed) => {
        if (!pressed) {
          return;
        }

        this.signals.gameplayMode.value = "select";
        this.diagnostics.info("select.pressed", {
          pointer: this.input.pointer.primary.position.value,
        });
      },
      { phase: "input" },
    );
  }
}
```

Effects registered in `init()` are disposed on system destroy and flushed in
explicit simulation phases: `input` before system updates, `update` after system
updates, and `postUpdate` after interaction processing. Input actions are
forwarded from the generated browser bootstrap into worker-owned signals before
system effects run.
Use `this.actions.jump.down()` for one-frame button presses, `this.actions.move.x`
and `this.actions.move.y` for axis2d actions, `this.keyboard.down("KeyP")` for
direct keyboard edges, and `this.gamepads.primary?.down("south")` for direct
standard gamepad reads. The Vite plugin writes `.aperture/generated/aperture-env.d.ts`
so configured `input.button`, `input.axis1d`, and `input.axis2d` actions receive
kind-specific system types.

## Spatial Queries

Spatial queries are synchronous helpers over ECS-owned data in the
logic/simulation context. Bounds raycasts use `this.spatial.setBounds(...)`;
exact visual mesh raycasts use `this.spatial.setMeshes(...)` with
renderer-independent CPU mesh data and an optional mesh BVH. Both paths return
canonical entity references, and gameplay systems do not await raycasts.

```ts
const ray = this.cameras.main.rayFromPointer(
  this.input.pointer.primary.position.value,
);

const hit = this.spatial.raycastFirst(ray, {
  source: "visual-mesh",
  fallback: "bounds",
  maxDistance: 20,
});

this.signals.selectedEntity.value = hit?.entity.ref ?? null;
```

Use spatial queries from systems; do not move picking state into the renderer as
the source of truth.

## Commands And Manual Assets

Commands are the worker-owned path for browser UI, tools, or MCP-style bridges
to request simulation work. Browser code dispatches a serializable command
event; the generated bootstrap forwards it to the worker.

```ts
window.dispatchEvent(
  new CustomEvent("aperture:command", {
    detail: {
      channel: "asset.request",
      payload: { assetId: "decal" },
    },
  }),
);
```

A system drains the channel and requests the manual asset:

```ts
import { createSystem } from "@aperture-engine/app/systems";

export default class AssetCommandSystem extends createSystem({
  priority: 75,
}) {
  override update(): void {
    for (const command of this.commands.drain<{ assetId?: unknown }>(
      "asset.request",
    )) {
      if (typeof command.assetId !== "string") {
        this.diagnostics.warn("command.assetRequest.invalid", {
          suggestedFix:
            "Send { assetId: 'decal' } on the asset.request command channel.",
        });
        continue;
      }

      void this.commands.requestAsset(command.assetId).then(() => {
        this.diagnostics.info("command.assetRequest.ready", {
          asset: command.assetId,
          ready: this.assets.readiness(command.assetId).value,
        });
      });
    }
  }
}
```

Runtime asset requests should be expressed through systems and commands. User
code should not touch loader reports, transfer packages, snapshot transport, or
renderer-side registration.

## Diagnostics And Entity Lookup

Generated browser, worker, and headless statuses are JSON-safe. Systems can
publish diagnostics with stable codes:

```ts
if (this.assets.gltf("robot").error.value) {
  this.diagnostics.error("asset.robot.failed", {
    asset: "robot",
    suggestedFix: "Check the URL in aperture.config.ts.",
  });
}
```

Entity summaries use ECS identity plus optional app metadata:

```ts
{
  entity: { index: 12, generation: 0 },
  key: "level.robot",
  name: "robot",
  tags: ["asset", "robot"],
  componentIds: ["Name", "LocalTransform", "Mesh"],
  source: { assetId: "robot", gltfNodeIndex: 0 }
}
```

Tools should use `{ index, generation }` for follow-up operations and rerun
entity lookup when a generation-mismatch diagnostic says the reference is
stale.

The generated browser bridge exposes the same inspection path through
JSON-safe command channels for developer panels and MCP-style tools:

- `aperture.devtools.entity.find`
- `aperture.devtools.entity.get`
- `aperture.devtools.entity.setComponent`
- `aperture.devtools.entity.snapshot`
- `aperture.devtools.entity.diff`

Those commands are handled inside the generated simulation worker before normal
system command queues. They read or mutate only worker-owned ECS state, and the
browser observes the result through generated status such as `entityTools` and
`lastFailure`.

## Headless Mode

Headless mode uses the same system authoring shape:

```ts
import { defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
});
```

Headless tests can step the app through advanced helpers without importing DOM,
canvas, `navigator.gpu`, or WebGPU presentation code.

Browser config asset URLs such as `/assets/robot.glb` are served by Vite or the
generated app host. In Node/headless tests, provide an `assetLoader` when those
URLs need to resolve, or mark the asset `preload: "manual"` and inject ready
source assets through `app.context.assetsRegistry`.

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

const app = await createApertureApp({
  config: defineApertureConfig({
    mode: "headless",
    assets: {
      robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
    },
  }),
  assetLoader: {
    async load(assetHandle) {
      if (assetHandle.id !== "robot") {
        return;
      }

      // Load or register the test fixture, then mark the handle ready.
    },
  },
});
```

## Advanced APIs

Programmatic app creation, manual stepping, manual worker transport, direct
render snapshot inspection, source asset transfer packages, renderer-side
registration, custom render hosts, and custom WebGPU orchestration remain
available as advanced paths.

Use these only when you are building generated bootstrap internals, tests,
tools, render-only consumers, or nonstandard loops:

```ts
import { createApertureApp } from "@aperture-engine/app/advanced";
import { createExtractionApp } from "@aperture-engine/runtime";
import { createWebGpuApp } from "@aperture-engine/webgpu";
```

Start with [`ADVANCED_ORCHESTRATION.md`](./ADVANCED_ORCHESTRATION.md) when you
need the worker/main split, manual snapshot posting, source asset transfer
packages, or direct WebGPU presentation control.

### Polygon extrusion with openings

Use `mesh.extrude({ outline, holes?, depth, label? })` for one continuous wall,
facade, sign, or other straight solid. Points are `[x, y]` in local XY; the
solid extends from z=0 to positive `depth`. A doorway cut into an outer edge is
an outline notch, while an enclosed window is a hole:

```ts
this.spawn.mesh({
  key: "facade",
  mesh: mesh.extrude({
    outline: [
      [0, 0],
      [3, 0],
      [3, 2.5],
      [5, 2.5],
      [5, 0],
      [8, 0],
      [8, 5],
      [4, 7],
      [0, 5],
    ],
    holes: [
      [
        [0.5, 2],
        [2.5, 2],
        [2.5, 4],
        [0.5, 4],
      ],
    ],
    depth: 0.4,
  }),
  material: material.standard({ baseColor: [0.7, 0.5, 0.3, 1] }),
  castShadow: true,
  receiveShadow: true,
});
```

Both winding directions are accepted and normalized. Do not repeat the closing
point. Each ring needs at least three corners; redundant collinear corners,
self-intersections, repeated points, crossing or touching boundaries, holes
outside the outline, and overlapping/nested holes are rejected. Validation
uses the stored float32 coordinates and rejects collapsed or numerically
ambiguous geometry. The total boundary limit is 2048 vertices. Depth must
remain positive and finite in float32. There are no bevels, curved paths,
implicit geometry repairs, islands inside holes, or per-face materials.

Output is a closed indexed triangle mesh with POSITION, NORMAL and TEXCOORD_0.
Caps face -Z/+Z, and each wall edge has a flat outward normal (hole walls face
into the opening). Vertices are split at cap/wall and wall/wall hard edges.
Cap UVs normalize XY across the outline bounding box. Wall U is normalized
perimeter distance per ring, with its seam at the lexicographically first
point; V is z/depth. Input arrays are not mutated, output buffers are owned,
and identical input or reversed ring winding gives identical output.

`createExtrudeMeshAsset(options)` from `@aperture-engine/render` is the low-level
factory for custom registration or `dynamic.publish` updates. It throws
`ExtrudeMeshError` with an input path; spawning converts that into
`aperture.spawn.invalidExtrudeMesh` without registering partial assets.
Triangulation uses a local, ISC-licensed copy of Earcut 3.0.2, not Three. Its license
notice ships in the emitted module; no new browser import-map entry is needed.

`test/fixtures/extrude-authoring/scene.ts` authors a single cottage facade with
an open door notch and window hole. After building, run the native consumer
proof (validates extraction, dynamic edits, serialization, strict preflight,
and deterministic reset; it does not claim rendered-pixel verification):

```sh
node test/fixtures/extrude-authoring/verify.mjs /tmp/extrude.json
```

### Camera projection validation

`validateCameraInput` checks finite positive `aspect` and `near`, and finite
`far > near`, for both perspective and orthographic cameras. Perspective cameras
also require finite `0 < fovYRadians < PI`; orthographic cameras require finite
positive `orthographicHeight`. The inactive projection's size field is ignored,
so its zero sentinel remains valid. Omitted values retain the standard defaults.
`spawn.camera()` rejects invalid inputs before creating an entity, with a
structured `aperture.camera.invalidProjection` error whose `detail.diagnostics`
identifies the fields. Low-level ECS camera extraction skips invalid views with
`render.camera.*` diagnostics rather than throwing during matrix construction.
/sdk/source/app/src/input.ts
/sdk/source/app/src/physics-interpolation.ts
/sdk/source/app/src/entities/lookup/summary.ts
/sdk/source/app/src/entities/lookup/types.ts
/sdk/source/app/src/entities/lookup/mutation.ts
/sdk/source/app/src/entities/lookup/snapshot.ts
/sdk/source/app/src/entities/lookup/hierarchy.ts
/sdk/source/app/src/entities/lookup/query.ts
/sdk/source/app/src/entities/lookup/index.ts
/sdk/source/app/src/entities/lookup/resolve.ts
/sdk/source/app/src/systems/prefabs.ts
/sdk/source/app/src/systems/signals.ts
/sdk/source/app/src/systems/determinism.ts
/sdk/source/app/src/systems/trails.ts
/sdk/source/app/src/systems/resources.ts
/sdk/source/app/src/systems/json.ts
/sdk/source/app/src/systems/frame-time.ts
/sdk/source/app/src/systems/physics.ts
/sdk/source/app/src/systems/fixed-step.ts
/sdk/source/app/src/systems/html-bridge.ts
/sdk/source/app/src/systems/effects.ts
/sdk/source/app/src/systems/gltf.ts
/sdk/source/app/src/systems/meshes.ts
/sdk/source/app/src/systems/components.ts
/sdk/source/app/src/systems/errors.ts
/sdk/source/app/src/systems/spatial-index-population.ts
/sdk/source/app/src/systems/commands.ts
/sdk/source/app/src/systems/random.ts
/sdk/source/app/src/systems/color.ts
/sdk/source/app/src/systems/assets.ts
/sdk/source/app/src/systems/hierarchy.ts
/sdk/source/app/src/systems/materials.ts
/sdk/source/app/src/systems/cameras.ts
/sdk/source/app/src/systems/particles.ts
/sdk/source/app/src/systems/screen-space-framing.ts
/sdk/source/app/src/systems/audio.ts
/sdk/source/app/src/systems/spawn/lathe.ts
/sdk/source/app/src/systems/spawn/material-presets.ts
/sdk/source/app/src/systems/spawn/physics.ts
/sdk/source/app/src/systems/spawn/types.ts
/sdk/source/app/src/systems/spawn/metadata.ts
/sdk/source/app/src/systems/spawn/heightfield.ts
/sdk/source/app/src/systems/spawn/gltf.ts
/sdk/source/app/src/systems/spawn/triangle-list.ts
/sdk/source/app/src/systems/spawn/transforms.ts
/sdk/source/app/src/systems/spawn/commands.ts
/sdk/source/app/src/systems/spawn/extrude.ts
/sdk/source/app/src/systems/spawn/assets.ts
/sdk/source/app/src/systems/spawn/index.ts
/sdk/source/app/src/systems/spawn/light-rig-presets.ts
/sdk/source/app/src/systems/spawn/rounded-box.ts
/sdk/source/app/src/systems/spawn/descriptors.ts
/sdk/source/app/src/systems/context.ts
/sdk/source/app/src/systems/diagnostics.ts
/sdk/source/app/src/systems/start-options.ts
/sdk/source/app/src/internal/app-lifecycle.ts
/sdk/source/app/src/internal/bootstrap-safety.ts
/sdk/source/app/src/internal/json-safe.ts
/sdk/source/app/src/internal/diagnostic-error.ts
/sdk/source/app/src/advanced.ts
/sdk/source/app/src/entity-lookup.ts
/sdk/source/app/src/headless-tools.ts
/sdk/source/app/src/devtools/payload.ts
/sdk/source/app/src/devtools/input.ts
/sdk/source/app/src/devtools/types.ts
/sdk/source/app/src/devtools/camera-framing.ts
/sdk/source/app/src/devtools/entities.ts
/sdk/source/app/src/devtools/assets.ts
/sdk/source/app/src/devtools/camera.ts
/sdk/source/app/src/browser/control.ts
/sdk/source/cli/src/create/templates/glb-viewer.ts
/sdk/source/cli/src/create/templates/files.ts
/sdk/source/cli/src/create/templates/minimal.ts
/sdk/source/cli/src/create/templates/shared.ts
/sdk/source/cli/src/create/templates/game.ts
/sdk/source/cli/src/create/templates/studio-neutral-hdr.ts
/sdk/source/cli/src/create/templates/sample-cube.ts
/sdk/source/cli/src/create/templates/index.ts
/sdk/source/cli/src/adapter-templates.ts
/sdk/source/cli/dist/adapter-templates.d.ts.map
/sdk/source/cli/dist/adapter-templates.js
/sdk/source/cli/dist/adapter-templates.d.ts
/sdk/source/cli/dist/create/templates/index.js.map
/sdk/source/cli/dist/create/templates/shared.js.map
/sdk/source/cli/dist/create/templates/sample-cube.js.map
/sdk/source/cli/dist/create/templates/game.js.map
/sdk/source/cli/dist/create/templates/shared.d.ts.map
/sdk/source/cli/dist/create/templates/files.js
/sdk/source/cli/dist/create/templates/index.js
/sdk/source/cli/dist/create/templates/files.d.ts
````

Stderr:

```text

```

## Command 97f939c9ddbe47a6b76fd23da49f2a36

2026-10-12T09:05:54.188993+00:00 → 2026-10-12T09:05:54.358083+00:00; exit 0; duration 0.169s.

Command:

```sh
cat /sdk/source/app/src/systems/spawn/descriptors.ts | head -250; cat /sdk/source/app/src/browser/worker.ts 2>/dev/null; grep -R -n "startGeneratedSimulationWorker\|startGeneratedBrowserApp" /sdk/source/vite-plugin/src | head -35; cat /sdk/source/cli/src/create/templates/minimal.ts | head -170; cat /sdk/source/app/src/browser/control.ts | head -100; cat /sdk/source/app/src/devtools/camera.ts | head -170
```

Stdout:

```text
import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { ShaderHandle, Vec4Like } from "@aperture-engine/simulation";
import type { StandardMaterialPatch } from "@aperture-engine/render";
import type {
  BoxMeshDescriptorOptions,
  RoundedBoxMeshDescriptorOptions,
  CapsuleMeshDescriptorOptions,
  ConeMeshDescriptorOptions,
  CustomWgslMaterialDescriptor,
  CustomWgslSamplerBindingOptions,
  CustomWgslShaderDescriptor,
  CustomWgslTextureBindingOptions,
  CustomWgslUniformBindingOptions,
  CylinderMeshDescriptorOptions,
  LineListMeshDescriptorOptions,
  MaterialAppearancePresetName,
  PlaneMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
  PhysicsSpawnDescriptor,
  SphereMeshDescriptorOptions,
  StandardMaterialDescriptor,
  StandardMaterialInputOptions,
  TorusMeshDescriptorOptions,
  TriangleListMeshDescriptorOptions,
  HeightfieldMeshDescriptorOptions,
  LatheMeshDescriptorOptions,
  ExtrudeMeshDescriptorOptions,
  ShaderAssetDescriptorInput,
  UnlitMaterialDescriptor,
  UnlitMaterialInputOptions,
} from "./types.js";
import { createMaterialAppearancePreset } from "./material-presets.js";
import { color } from "../color.js";
import { validateRoundedBoxDescriptor } from "./rounded-box.js";

export const mesh = Object.freeze({
  /** Closed indexed XY outline and holes extruded from z=0 along +Z. */
  extrude(options: ExtrudeMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("extrude", options);
  },
  /** Full Y-axis revolution of explicit [radius, y] points, with flat normals. */
  lathe(options: LatheMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("lathe", options);
  },
  /** Y-up terrain: heights[row][column] advances +Z by row and +X by column. */
  heightfield(
    options: HeightfieldMeshDescriptorOptions,
  ): PrimitiveMeshDescriptor {
    return descriptor("heightfield", options);
  },
  /** Custom triangles with flat face normals unless explicit normals are supplied. */
  triangleList(
    options: TriangleListMeshDescriptorOptions,
  ): PrimitiveMeshDescriptor {
    return descriptor("triangle-list", options);
  },
  box(options: BoxMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  /** Centered rounded box: positive halfExtents, fitting radius and 1–32 bevelSegments. */
  roundedBox(
    options: RoundedBoxMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    validateRoundedBoxDescriptor(options);
    return descriptor("rounded-box", options);
  },
  sphere(options: SphereMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(options: CapsuleMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(options: PlaneMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: CylinderMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(options: ConeMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
  /** A Y-up ring; reduce radial/tube segments for low-poly procedural parts. */
  torus(options: TorusMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("torus", options);
  },
  /**
   * Native GPU line-list mesh. Positions are consumed in pairs unless indices
   * are provided; indexed line lists consume indices in pairs.
   */
  lineList(options: LineListMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("line-list", options);
  },
});

export const material = Object.freeze({
  standard(
    options: StandardMaterialInputOptions = {},
  ): StandardMaterialDescriptor {
    return Object.freeze({
      kind: "standard",
      options: linearMaterialOptions(options),
    });
  },
  unlit(options: UnlitMaterialInputOptions = {}): UnlitMaterialDescriptor {
    return Object.freeze({
      kind: "unlit",
      options: linearMaterialOptions(options),
    });
  },
  preset(
    name: MaterialAppearancePresetName,
    overrides: StandardMaterialPatch = {},
  ) {
    return createMaterialAppearancePreset(name, overrides);
  },
  customWgsl(
    options: Omit<CustomWgslMaterialDescriptor, "kind">,
  ): CustomWgslMaterialDescriptor {
    return Object.freeze({
      kind: "custom-wgsl",
      ...options,
      bindings: [...(options.bindings ?? [])],
      dependencies: [...(options.dependencies ?? [])],
    });
  },
  uniform(name: string, options: CustomWgslUniformBindingOptions) {
    return Object.freeze({
      kind: "uniform-buffer" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      fields: options.fields,
      ...(options.values === undefined ? {} : { values: options.values }),
      ...(options.runtimeUniformKey === undefined
        ? {}
        : { runtimeUniformKey: options.runtimeUniformKey }),
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  texture(name: string, options: CustomWgslTextureBindingOptions) {
    return Object.freeze({
      kind: "texture" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      texture: options.texture,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  sampler(name: string, options: CustomWgslSamplerBindingOptions) {
    return Object.freeze({
      kind: "sampler" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      sampler: options.sampler,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
});

function linearMaterialOptions<
  TOptions extends { readonly baseColor?: Vec4Like | string },
>(
  options: TOptions,
): Omit<TOptions, "baseColor"> & { readonly baseColor?: Vec4Like } {
  const { baseColor, ...rest } = options;
  return {
    ...rest,
    ...(Object.prototype.hasOwnProperty.call(options, "baseColor")
      ? {
          baseColor:
            typeof baseColor === "string"
              ? color.srgbHex(baseColor)
              : baseColor,
        }
      : {}),
  };
}

export const shader = Object.freeze({
  asset(input: ShaderAssetDescriptorInput): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "shader-asset",
      handle: readShaderHandle(input),
    });
  },
  inlineWgsl(
    code: string,
    options: { readonly virtualPath?: string } = {},
  ): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "inline-wgsl",
      code,
      ...(options.virtualPath === undefined
        ? {}
        : { virtualPath: options.virtualPath }),
    });
  },
});

export const physics = Object.freeze({
  rigidBody(input: RigidBodyInput = {}): RigidBodyInput {
    return Object.freeze({ ...input });
  },
  collider(input: ColliderInput = {}): ColliderInput {
    return Object.freeze({ ...input });
  },
  velocity(input: PhysicsVelocityInput = {}): PhysicsVelocityInput {
    return Object.freeze({ ...input });
  },
  externalForce(input: ExternalForceInput = {}): ExternalForceInput {
    return Object.freeze({ ...input });
  },
  externalImpulse(input: ExternalImpulseInput = {}): ExternalImpulseInput {
    return Object.freeze({ ...input });
  },
  kinematicTarget(input: KinematicTargetInput = {}): KinematicTargetInput {
    return Object.freeze({ ...input });
  },
  characterController(
    input: PhysicsCharacterControllerInput = {},
  ): PhysicsCharacterControllerInput {
    return Object.freeze({ ...input });
  },
  material(input: PhysicsMaterialInput = {}): PhysicsMaterialInput {
    return Object.freeze({ ...input });
  },
  joint(input: PhysicsJointInput = {}): PhysicsJointInput {
    return Object.freeze({ ...input });
  },
  debug(input: PhysicsDebugInput = {}): PhysicsDebugInput {
    return Object.freeze({ ...input });
  },
  body(input: PhysicsSpawnDescriptor = {}): PhysicsSpawnDescriptor {
    return Object.freeze({ ...input });
  },
/sdk/source/vite-plugin/src/virtual-modules.ts:78:      `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
/sdk/source/vite-plugin/src/virtual-modules.ts:79:      `startGeneratedSimulationWorker({ config, systems });`,
/sdk/source/vite-plugin/src/virtual-modules.ts:94:      `import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";`,
/sdk/source/vite-plugin/src/virtual-modules.ts:101:      `export const appPromise = startGeneratedBrowserApp({`,
/sdk/source/vite-plugin/src/virtual-modules.ts:141:    `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
/sdk/source/vite-plugin/src/virtual-modules.ts:145:    `startGeneratedSimulationWorker({ config, systems });`,
import { textTemplateFile } from "./files.js";
import type { TemplateFile } from "../types.js";

export function minimalTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("aperture.shared-config.ts", apertureSharedConfigTs()),
    textTemplateFile("aperture.config.ts", apertureConfigTs()),
    textTemplateFile("aperture.headless.config.ts", apertureHeadlessConfigTs()),
    textTemplateFile("src/systems/setup.system.ts", setupSystemTs()),
    textTemplateFile("src/systems/spin.system.ts", spinSystemTs()),
  ];
}

function apertureConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "browser",
  canvas: "#aperture",
});
`;
}

function apertureHeadlessConfigTs(): string {
  return `import { createApertureAppConfig } from "./aperture.shared-config.ts";

export default createApertureAppConfig({
  mode: "headless",
});
`;
}

function apertureSharedConfigTs(): string {
  return `import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";

interface ApertureAppConfigOptions {
  readonly mode: "browser" | "headless";
  readonly canvas?: string;
}

export function createApertureAppConfig(options: ApertureAppConfigOptions) {
  return defineApertureConfig({
    mode: options.mode,
    ...(options.mode === "browser"
      ? { canvas: options.canvas ?? "#aperture" }
      : {}),
    systems: ["src/systems/**/*.system.ts"],
    signals: {
      selectedEntity: signal.ref(null),
    },
    input: {
      actions: {
        select: input.button([input.pointer("primary"), input.key("Enter")]),
      },
    },
    render: {
      defaultCamera: false,
      defaultLight: false,
      // The filmic pipeline the showcases ship with: ACES tonemapping through
      // the HDR scene buffer, plus a subtle bloom. A daylight gradient sky and
      // image-based lighting install automatically (render.defaultEnvironment)
      // unless this app authors its own sky or environment light.
      tonemap: "aces",
      exposure: 1,
      bloom: { threshold: 0.75, intensity: 0.04, radiusPixels: 2 },
      sampleCount: 4,
      maxPixelRatio: 2,
    },
    diagnostics: {
      level: "info",
    },
  });
}
`;
}

function setupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 5],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 55,
    });

    // The sun. Ambient/fill light comes from the default daylight
    // environment's image-based lighting, so no separate fill light is
    // needed. Shadows ground objects — keep them on.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      intensity: 2.2,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
      shadow: {
        mapSize: 2048,
        cascadeCount: 1,
        shadowType: 1,
        strength: 0.75,
        filterRadius: 2,
        normalBias: 0.04,
      },
    });

    this.spawn.mesh({
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [12, 0.2, 12] }),
      material: material.standard({
        baseColor: [0.42, 0.44, 0.42, 1],
        roughness: 0.9,
      }),
      transform: { translation: [0, -0.1, 0] },
      castShadow: false,
      receiveShadow: true,
    });

    this.spawn.mesh({
      key: "starter.cube",
      name: "Starter Cube",
      tags: ["starter", "inspectable"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [0.13, 0.45, 0.95, 1],
        roughness: 0.45,
      }),
      transform: {
        translation: [0, 0.5, 0],
      },
      castShadow: true,
      receiveShadow: true,
    });
  }
}
`;
}

function spinSystemTs(): string {
  return `import {
  AppEntityKey,
  EcsType,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    cubes: { required: [AppEntityKey, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 0.8 },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.cubes.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "starter.cube") {
        continue;
      }

import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  inspectRenderSnapshot,
  type RenderSnapshotInspectionReport,
} from "@aperture-engine/render";
import {
  webGpuAppRenderReportToJsonValue,
  type WebGpuAppRenderReport,
  type WebGpuAppRenderReportJsonValue,
} from "@aperture-engine/webgpu";
import type { EcsEntityRef } from "../config.js";
import type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
} from "../entity-lookup.js";
import type { CameraToolState } from "../devtools/camera.js";
import type { createAssetSummary } from "../devtools/assets.js";
import {
  ApertureBrowserControlError,
  type GeneratedBrowserRequestClient,
  type GeneratedBrowserRequestOptions,
} from "./request.js";

export interface GeneratedBrowserEntitySelector {
  readonly key?: string;
  readonly entity?: EcsEntityRef;
}

export interface GeneratedBrowserCameraSummary extends CameraToolState {
  readonly key: string | null;
  readonly name: string;
}

/** Typed core tools share the existing semantic worker bridge. Other tools use requestRaw. */
export interface GeneratedBrowserToolContracts {
  readonly ecs_query: {
    readonly payload: ApertureEntityFindQuery | undefined;
    readonly result: ApertureEntityFindReport;
  };
  readonly ecs_get_entity: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: ApertureEntityGetReport;
  };
  readonly ecs_pause: {
    readonly payload: undefined;
    readonly result: Readonly<Record<string, unknown>>;
  };
  readonly asset_list: {
    readonly payload: undefined;
    readonly result: { readonly assets: ReturnType<typeof createAssetSummary> };
  };
  readonly camera_list: {
    readonly payload: undefined;
    readonly result: readonly GeneratedBrowserCameraSummary[];
  };
  readonly camera_get: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_look_at: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly lookAt: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_set_transform: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly rotation?: readonly [number, number, number, number];
      readonly scale?: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
}

export interface GeneratedBrowserFrameOptions extends GeneratedBrowserRequestOptions {
  readonly deltaSeconds?: number;
  readonly timeSeconds?: number;
}

export interface GeneratedBrowserRenderedFrame {
  readonly snapshotFrame: number;
  /** Detached existing report data; excludes renderer resources and shared snapshot buffers. */
  readonly report: WebGpuAppRenderReportJsonValue;
}

export interface GeneratedBrowserFrameInspection extends RenderSnapshotInspectionReport {
  readonly frame: number;
}

export function createGeneratedBrowserFrameControl(input: {
  readonly requests: GeneratedBrowserRequestClient;
  readonly manual: boolean;
  readonly getSourceAssetVersions?: () => readonly (readonly [
    string,
    number,
  ])[];
import {
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { Camera } from "@aperture-engine/render";
import type { ApertureApp } from "../advanced.js";
import type { ApertureDevtoolsRequest } from "../commands.js";
import type { EcsEntityRef } from "../config.js";
import type { ApertureEntityLookupDiagnostic } from "../entity-lookup.js";
import {
  AppEntityKey,
  LocalTransform,
  Name,
  WorldTransform,
} from "../systems.js";
import { entityRefFromValue } from "./entities.js";
import { frameCameraEntities } from "./camera-framing.js";
import { quatLookAt } from "../systems/spawn/transforms.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
import {
  degreesToRadians,
  isRecord,
  jsonSafeRecord,
  numberFromValue,
  stringFromValue,
  tuple3FromValue,
  tuple3FromView,
  tuple4FromValue,
  tuple4FromView,
} from "./payload.js";

export interface CameraToolState {
  readonly entity: EcsEntityRef;
  readonly camera: Readonly<Record<string, unknown>>;
  readonly localTransform: {
    readonly translation: readonly [number, number, number];
    readonly rotation: readonly [number, number, number, number];
    readonly scale: readonly [number, number, number];
  } | null;
}

export function callCameraTool(
  app: ApertureApp,
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
  viewportAspect?: number,
): GeneratedDevtoolsToolResult {
  const payload = isRecord(request.payload) ? request.payload : {};

  if (request.tool === "camera_frame_entities") {
    const hasKey = Object.hasOwn(payload, "key");
    const hasEntity = Object.hasOwn(payload, "entity");
    const ref = entityRefFromValue(payload["entity"]);
    if (
      (hasKey && hasEntity) ||
      (hasKey &&
        (typeof payload["key"] !== "string" || payload["key"].length === 0)) ||
      (hasEntity &&
        (ref === null ||
          !Number.isInteger(ref.index) ||
          !Number.isInteger(ref.generation) ||
          ref.index < 0 ||
          ref.generation < 0))
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.framing.invalidCameraSelector",
            severity: "error",
            message: "The framing camera selector is invalid or ambiguous.",
            suggestedFix:
              "Pass one camera key or integer { index, generation } entity reference; omit both to use camera.agent.",
          },
        ],
      };
    }
  }

  if (request.tool === "camera_list") {
    return {
      ok: true,
      result: cameraEntities(app.lowLevel.world).map(cameraSummary),
    };
  }

  if (request.tool === "camera_create_agent") {
    const key = stringFromValue(payload["key"]) ?? "camera.agent";
    const existing = cameraEntityByKey(app.lowLevel.world, key);
    const entity =
      existing ??
      app.context.spawn.camera({
        key,
        name: "Agent Camera",
        transform: {
          translation: tuple3FromValue(payload["translation"]) ?? [0, 1.5, 5],
          lookAt: tuple3FromValue(payload["lookAt"]) ?? [0, 0, 0],
        },
        camera: {
          priority: 10_000,
          clearColor: [0.03, 0.035, 0.04, 1],
        },
      });

    resolveWorldTransforms(app.lowLevel.world);
    return { ok: true, result: cameraSummary(entity) };
  }

  // camera_use_agent_view is a mutating tool; with no explicit selector it
  // must target the agent camera (the key camera_create_agent defaults to),
  // never fall back to the first camera — that silently promoted the
  // user-authored main camera (battletest finding F9).
  const resolvePayload =
    (request.tool === "camera_use_agent_view" ||
      request.tool === "camera_frame_entities") &&
    stringFromValue(payload["key"]) === undefined &&
    entityRefFromValue(payload["entity"] ?? null) === null
      ? { ...payload, key: "camera.agent" }
      : payload;

  const entity = resolveCameraEntity(app.lowLevel.world, resolvePayload);
  if (entity === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.notFound",
          severity: "error",
          message: "No matching camera entity was found.",
          data: jsonSafeRecord(payload),
          suggestedFix:
            "Pass a camera key/entity reference, or call camera_create_agent first.",
        },
      ],
    };
  }

  if (request.tool === "camera_frame_entities") {
    const framed = frameCameraEntities(app, entity, payload, viewportAspect);
    return framed.ok
      ? {
          ok: true,
          result: { ...cameraSummary(entity), framing: framed.result },
        }
      : framed;
  }

  if (request.tool === "camera_get") {
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_save") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = cameraState(entity);
    savedCameraStates.set(slot, state);

    return { ok: true, result: { slot, state } };
  }

  if (request.tool === "camera_restore") {
    const slot = stringFromValue(payload["slot"]) ?? "default";
    const state = savedCameraStates.get(slot);

    if (state === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.camera.savedStateMissing",
```

Stderr:

```text

```

## Command 0850364a376b491495afdd270ebc2aa0

2026-10-12T09:06:13.457993+00:00 → 2026-10-12T09:06:13.575625+00:00; exit 0; duration 0.118s.

Command:

```sh
sed -n "65,125p" /sdk/source/vite-plugin/src/virtual-modules.ts; grep -n "camera_set\|fovY\|near\|far" /sdk/source/app/src/devtools/camera.ts; grep -n "StandardMaterialInputOptions\|StandardMaterialDescriptorOptions\|LightSpawn\|CameraSpawn" /sdk/source/app/src/systems/spawn/types.ts; cat /sdk/source/app/src/systems/spawn/rounded-box.ts | head -100; cat /sdk/source/app/src/worker.ts | head -90; cat /sdk/source/app/src/browser.ts | head -80
```

Stdout:

```text
  if (virtualId === VIRTUAL_WORKER_SYSTEMS) {
    const manifest = await createApertureSystemManifest({
      root: options.root,
      configFile,
    });

    return workerSystemsModule(manifest);
  }

  if (virtualId === VIRTUAL_WORKER_ENTRY) {
    return [
      `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
      `import { systems } from ${JSON.stringify(VIRTUAL_WORKER_SYSTEMS)};`,
      `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
      `startGeneratedSimulationWorker({ config, systems });`,
      "",
    ].join("\n");
  }

  if (virtualId === VIRTUAL_BROWSER_ENTRY) {
    const workerEntryFile = await writeApertureGeneratedWorkerEntry({
      root: options.root,
      configFile,
    });

    return [
      `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
      `import systemManifest from ${JSON.stringify(VIRTUAL_SYSTEM_MANIFEST)};`,
      `import ApertureSimulationWorker from ${JSON.stringify(`${toModuleUrl(workerEntryFile)}?worker`)};`,
      `import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";`,
      `const worker = new ApertureSimulationWorker();`,
      `const apertureDevtoolsEnabled = ${JSON.stringify(options.aiDevtoolsEnabled)} && import.meta.env.DEV;`,
      // The page URL is only readable on the main thread (worker scope has no
      // location.search). Forward every search param to the simulation worker
      // start options so systems can read app-specific values (e.g. ?map=<codec>).
      `const apertureUrlParams = typeof location === "undefined" ? {} : Object.fromEntries(new URLSearchParams(location.search));`,
      `export const appPromise = startGeneratedBrowserApp({`,
      `  config,`,
      `  systemManifest,`,
      `  workerEntry: worker,`,
      `  devtools: { enabled: apertureDevtoolsEnabled },`,
      `  workerStartOptions: apertureUrlParams,`,
      `});`,
      "",
    ].join("\n");
  }

  return null;
}

export function apertureGeneratedWorkerEntryFile(root: string): string {
  return path.join(root, ".aperture", "generated", "aperture-worker-entry.js");
}

export async function writeApertureGeneratedWorkerEntry(options: {
  readonly root: string;
  readonly configFile: string;
}): Promise<string> {
  const manifest = await createApertureSystemManifest({
    root: options.root,
    configFile: options.configFile,
184:  if (request.tool === "camera_set_transform") {
312:export type StandardMaterialInputOptions = Omit<
import {
  createRoundedBoxMeshAsset,
  RoundedBoxMeshError,
  validateRoundedBoxMeshOptions,
  type MeshAsset,
  type RoundedBoxMeshOptions,
} from "@aperture-engine/render";
import { ApertureSystemError } from "../errors.js";

export function validateRoundedBoxDescriptor(
  options: RoundedBoxMeshOptions,
): void {
  withRoundedBoxDiagnostic(() => validateRoundedBoxMeshOptions(options));
}

export function createRoundedBoxPrimitiveMeshAsset(
  options: RoundedBoxMeshOptions,
): MeshAsset {
  return withRoundedBoxDiagnostic(() => createRoundedBoxMeshAsset(options));
}

function withRoundedBoxDiagnostic<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof RoundedBoxMeshError)) throw error;
    const diagnostic = {
      code: "aperture.spawn.invalidRoundedBoxMesh",
      message: `mesh.roundedBox() ${error.message}`,
      suggestedFix:
        "Provide three positive finite halfExtents, radius from 0 through the smallest half-extent, and integer bevelSegments from 1 through 32. For tiny bevels, increase radius relative to the extents or reduce segments; use radius 0 for an exact flat box.",
    };
    throw new ApertureSystemError(
      diagnostic.code,
      diagnostic.message,
      diagnostic.suggestedFix,
      { path: error.path },
      { cause: error },
    );
  }
}
export { startGeneratedSimulationWorker } from "./worker/start.js";
export type { StartGeneratedSimulationWorkerOptions } from "./worker/start.js";
export {
  DEFAULT_GENERATED_EXPOSURE,
  DEFAULT_GENERATED_MAX_PIXEL_RATIO,
  DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
  DEFAULT_GENERATED_TONEMAP,
  measureGeneratedCanvasResize,
  readGeneratedRenderProfileEnvironment,
  resolveGeneratedEffectiveRenderDefaults,
  resolveGeneratedRenderSettings,
  resolveGeneratedTonemapAndExposure,
} from "./browser/render.js";
export type {
  GeneratedBrowserEffectiveRenderDefaults,
  GeneratedBrowserRenderSettings,
  GeneratedBrowserRenderProfileEnvironment,
  GeneratedCanvasMeasurementSource,
  GeneratedCanvasMeasureElement,
  GeneratedCanvasResizeMeasurement,
  GeneratedCanvasResizeSource,
  GeneratedPixelRatioSource,
  GeneratedTonemapAndExposure,
} from "./browser/render.js";
export {
  APERTURE_GENERATED_VIRTUAL_INPUT_EVENT,
  dispatchApertureInputAction,
} from "./browser/input.js";
export type { ApertureVirtualActionInput } from "./browser/input.js";
export {
  dispatchApertureHtmlEvent,
  observeApertureHtmlSlots,
} from "./browser/html-bridge.js";
export type {
  ApertureHtmlSlotObserver,
  ApertureHtmlSlotObserverOptions,
} from "./browser/html-bridge.js";
export {
  APERTURE_MCP_MANAGED_GLOBAL,
  APERTURE_MCP_RUNTIME_GLOBAL,
} from "./browser/devtools/index.js";
export type { ApertureMcpRuntime } from "./browser/devtools/index.js";
export {
  APERTURE_GENERATED_RENDER_DIAGNOSTICS_PROPERTY,
  APERTURE_GENERATED_STATUS_GLOBAL,
  readGeneratedBrowserAppStatus,
  subscribeGeneratedBrowserAppStatus,
} from "./browser/status.js";
export type {
  GeneratedBrowserAppStatus,
  GeneratedBrowserRenderDiagnosticsAccessor,
  GeneratedBrowserStatusListener,
  GeneratedBrowserStatusSubscriptionOptions,
  GeneratedBrowserSystemManifestEntry,
} from "./browser/status.js";
export {
  readGeneratedSignal,
  readGeneratedSignals,
  subscribeGeneratedSignals,
} from "./browser/signals.js";
export type {
  GeneratedSignalSummary,
  GeneratedSignalsListener,
  GeneratedSignalsSubscriptionOptions,
} from "./browser/signals.js";
export {
  resolveGeneratedPostEffects,
  startGeneratedBrowserApp,
} from "./browser/app.js";
export { ApertureBrowserControlError } from "./browser/request.js";
export type {
  RenderedGeometryCaptureOptions,
  RenderedGeometryInspectionOptions,
  RenderedGeometryInspection,
  RenderedGeometryMesh,
  RenderedGeometryDraw,
  RenderedGeometryInstance,
  RenderedGeometryOmission,
  RenderedGeometryOmissionReason,
} from "@aperture-engine/webgpu";
export type { GeneratedBrowserRequestOptions } from "./browser/request.js";
export type {
```

Stderr:

```text

```

## Command 3e791f2538104c43b4d4c5bf6a91dd66

2026-10-12T09:06:27.221375+00:00 → 2026-10-12T09:06:27.338787+00:00; exit 0; duration 0.117s.

Command:

```sh
grep -n "set_component\|setComponent" /sdk/source/app/src/devtools/entities.ts /sdk/source/app/src/browser/control.ts; sed -n "270,340p" /sdk/source/app/src/systems/spawn/types.ts; grep -n "interface Camera\|interface Light\|fovYDegrees" /sdk/source/app/src/systems/spawn/types.ts; sed -n "1,110p" /sdk/source/app/src/worker/start.ts; sed -n "1,110p" /sdk/source/webgpu/src/geometry-inspection/types.ts 2>/dev/null; find /sdk/source/webgpu/src -iname "*geometry*"
```

Stdout:

```text
/sdk/source/app/src/devtools/entities.ts:71:  readonly tool: "ecs_set_component_field";
/sdk/source/app/src/devtools/entities.ts:153:        const request = setComponentRequestFromPayload(
/sdk/source/app/src/devtools/entities.ts:298:      if (tool === "ecs_set_component_field") {
/sdk/source/app/src/devtools/entities.ts:299:        const request = setComponentRequestFromPayload(
/sdk/source/app/src/devtools/entities.ts:498:          tool: "ecs_set_component_field",
/sdk/source/app/src/devtools/entities.ts:699:function setComponentRequestFromPayload(
/sdk/source/app/src/devtools/entities.ts:736:          "Dispatch aperture.devtools.entity.setComponent with { entity, component, field, value }.",

export type CustomWgslMaterialDescriptor = Omit<
  CustomWgslMaterialAsset,
  | "sourceDiscriminator"
  | "shaderLanguage"
  | "renderState"
  | "pipelineKey"
  | "bindings"
  | "dependencies"
> & {
  readonly kind: "custom-wgsl";
  readonly shader: CustomWgslShaderDescriptor;
  readonly renderState?: Partial<CustomWgslMaterialAsset["renderState"]>;
  readonly pipelineKey?: Partial<CustomWgslMaterialAsset["pipelineKey"]>;
  readonly bindings?: CustomWgslMaterialAsset["bindings"];
  readonly dependencies?: CustomWgslMaterialAsset["dependencies"];
};

export type MaterialDescriptor =
  | StandardMaterialDescriptor
  | UnlitMaterialDescriptor
  | CustomWgslMaterialDescriptor;

export interface StandardMaterialOptions {
  /** Linear RGBA; material.standard also accepts CSS hex through its input options. */
  readonly baseColor?: Vec4Like;
  /** Perceptual roughness (0 mirror → 1 diffuse). Defaults to 1. */
  readonly roughness?: number;
  /**
   * Metalness (0 dielectric → 1 metal). Defaults to 0: hand-authored
   * materials are dielectric unless stated, unlike glTF imports which keep
   * the spec default of 1. A metal with no environment map renders
   * near-black, so only set 1 when the scene has image-based lighting.
   */
  readonly metallic?: number;
  /**
   * Additive linear emissive color. Values may exceed 1 for HDR/bloom probes.
   */
  readonly emissiveFactor?: Vec3Like;
  readonly label?: string;
}

export type StandardMaterialInputOptions = Omit<
  StandardMaterialOptions,
  "baseColor"
> & {
  /** Numeric values are linear; CSS hex RGB is sRGB and alpha is unchanged. */
  readonly baseColor?: Vec4Like | string;
};

export interface UnlitMaterialOptions {
  /** Linear RGBA; material.unlit also accepts CSS hex through its input options. */
  readonly baseColor?: Vec4Like;
  readonly label?: string;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
}

export type UnlitMaterialInputOptions = Omit<
  UnlitMaterialOptions,
  "baseColor"
> & {
  /** Numeric values are linear; CSS hex RGB is sRGB and alpha is unchanged. */
  readonly baseColor?: Vec4Like | string;
};

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: MaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
  readonly physics?: PhysicsSpawnDescriptor;
  /** Attach a `ShadowCaster` component so this mesh casts shadows. */
76:  readonly fovYDegrees?: number;
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationMessagePort,
  type SimulationWorkerStartOptions,
} from "@aperture-engine/runtime";
import type { ApertureApp, ApertureSystemModule } from "../advanced.js";
import type { ApertureConfig } from "../config.js";
import {
  isApertureDevtoolsRequest,
  isGeneratedCommandMessage,
  type ApertureDevtoolsRequest,
  type ApertureGeneratedCommandMessage,
} from "../commands.js";
import {
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { applyGeneratedCommand } from "./commands.js";
import type { GeneratedDevtoolsBridge } from "./devtools/bridge.js";
import {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "../devtools/entities.js";
import { runGeneratedWorkerLoop } from "./loop.js";

export interface StartGeneratedSimulationWorkerOptions {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly port?: SimulationMessagePort;
}

export function startGeneratedSimulationWorker(
  options: StartGeneratedSimulationWorkerOptions,
): void {
  if (options.port === undefined) {
    waitForWorkerPort((port) => {
      attachWorkerPort({ ...options, port });
    });
    return;
  }

  attachWorkerPort({ ...options, port: options.port });
}

function attachWorkerPort(
  options: StartGeneratedSimulationWorkerOptions & {
    readonly port: SimulationMessagePort;
  },
): void {
  const port = options.port;
  const pendingInput: ApertureGeneratedInputEventMessage[] = [];
  const pendingCommands: ApertureGeneratedCommandMessage[] = [];
  const pendingDevtools: ApertureDevtoolsRequest[] = [];
  let app: ApertureApp | null = null;
  let entityTools: GeneratedEntityToolBridge | null = null;
  let devtools: GeneratedDevtoolsBridge | null = null;

  port.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (isGeneratedInputEventMessage(message)) {
      pendingInput.push(message);
      return;
    }

    if (isGeneratedCommandMessage(message)) {
      if (app === null || entityTools === null) {
        pendingCommands.push(message);
      } else {
        applyGeneratedCommand(app, entityTools, message);
      }
      return;
    }

    if (isApertureDevtoolsRequest(message)) {
      if (devtools === null) {
        pendingDevtools.push(message);
      } else {
        devtools.handle(message);
      }
      return;
    }

    if (!isStartMessage(message)) {
      return;
    }

    const start = startOptionsFromMessage(message);

    void runGeneratedWorkerLoop({
      port,
      config: options.config,
      systems: options.systems,
      start,
      pendingInput,
      createEntityTools: createGeneratedEntityToolBridge,
      setApp(nextApp, nextEntityTools, nextDevtools) {
        app = nextApp;
        entityTools = nextEntityTools;
        devtools = nextDevtools;

        for (const pending of pendingCommands.splice(0)) {
          applyGeneratedCommand(nextApp, nextEntityTools, pending);
        }
        for (const pending of pendingDevtools.splice(0)) {
          nextDevtools.handle(pending);
        }
      },
    });
  });
/sdk/source/webgpu/src/app/rendered-geometry-types.ts
/sdk/source/webgpu/src/app/rendered-geometry-submission.ts
/sdk/source/webgpu/src/app/rendered-geometry-frame.ts
/sdk/source/webgpu/src/app/rendered-geometry-upload.ts
/sdk/source/webgpu/src/app/rendered-geometry-inspector.ts
/sdk/source/webgpu/src/gpu/geometry-observer.ts
```

Stderr:

```text

```

## Command 7fccf53a2931461896f12a106d18dc54

2026-10-12T09:06:56.395056+00:00 → 2026-10-12T09:06:56.565792+00:00; exit 0; duration 0.171s.

Command:

```sh
sed -n "699,750p" /sdk/source/app/src/devtools/entities.ts; cat /sdk/source/webgpu/src/app/rendered-geometry-types.ts | head -220; sed -n "45,110p" /sdk/source/app/src/systems/spawn/types.ts; cat /sdk/source/app/src/entities/lookup/mutation.ts | grep -n "Camera\|fov\|field" | head -30; cat /sdk/source/vite-plugin/src/index.ts | head -140
```

Stdout:

```text
function setComponentRequestFromPayload(
  world: EcsWorld,
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
):
  | ApertureEntitySetComponentFieldRequest
  | { readonly diagnostic: ApertureEntityLookupDiagnostic } {
  const record = isRecord(payload) ? payload : {};
  const resolved = resolveEntityRefFromPayload(
    world,
    payload,
    lastFind,
    lastGet,
    APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  );
  const component = stringFromValue(record["component"]);
  const field = stringFromValue(record["field"]);

  if ("diagnostic" in resolved) {
    return { diagnostic: resolved.diagnostic };
  }

  const entity = resolved.ref;

  if (component === undefined || field === undefined) {
    return {
      diagnostic: {
        code: "aperture.entityTools.invalidMutationRequest",
        severity: "error",
        message: "Entity mutation requires component and field string values.",
        data: {
          channel: APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
          hasComponent: component !== undefined,
          hasField: field !== undefined,
        },
        suggestedFix:
          "Dispatch aperture.devtools.entity.setComponent with { entity, component, field, value }.",
      },
    };
  }

  return {
    entity,
    component,
    field,
    value: record["value"],
  };
}

function missingEntityRefDiagnostic(
  channel: string,
import type { RenderEntityRef } from "@aperture-engine/render";

/** Opt-in CPU receipts. This never reads back GPU buffers or changes ECS state. */
export interface RenderedGeometryCaptureOptions {
  /** Includes upload receipts and the last submitted frame's instance matrices. */
  readonly maxRetainedBytes?: number;
}

export interface RenderedGeometryInspectionOptions {
  readonly maxBytes?: number;
  readonly maxMeshes?: number;
  readonly maxVertices?: number;
  readonly maxIndices?: number;
  readonly maxDraws?: number;
  readonly maxInstances?: number;
}

export interface RenderedGeometryMesh {
  readonly key: string;
  readonly sourceKey: string;
  readonly sourceVersion: number;
  readonly label: string;
  /** Packed local-space float32x3 source attributes, preserving vertex order. */
  readonly positions: Float32Array;
  /** null means the source had no NORMAL attribute; normals are never generated. */
  readonly normals: Float32Array | null;
  /** null preserves a non-indexed source; indices are never manufactured. */
  readonly indices: Uint16Array | Uint32Array | null;
}

export interface RenderedGeometryInstance {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
}

export interface RenderedGeometryDraw {
  readonly renderId: number;
  readonly viewId: number;
  readonly targetKey: string;
  readonly meshKey: string;
  readonly submesh: number;
  readonly materialSlot: number;
  readonly indexed: boolean;
  readonly firstIndex: number;
  readonly indexCount: number;
  readonly baseVertex: number;
  readonly firstVertex: number;
  readonly vertexCount: number;
  readonly firstInstance: number;
  readonly instances: readonly RenderedGeometryInstance[];
  /** Column-major WORLD matrices, 16 floats per instance, in GPU instance order. */
  readonly worldMatrices: Float32Array;
}

export type RenderedGeometryOmissionReason =
  | "capture-disabled"
  | "no-submitted-frame"
  | "capture-budget"
  | "request-budget"
  | "missing-upload-receipt"
  | "unsupported-position-format"
  | "unsupported-normal-format"
  | "unsupported-topology"
  | "skinned"
  | "morphed"
  | "custom-wgsl"
  | "user-pass"
  | "unsupported-route"
  | "invalid-source-data"
  | "missing-instance-binding"
  | "submission-failed";

export interface RenderedGeometryOmission {
  readonly reason: RenderedGeometryOmissionReason;
  readonly message: string;
  readonly renderId?: number;
}

export interface RenderedGeometryInspection {
  readonly status: "complete" | "partial" | "unavailable";
  readonly scope: "submitted-static-triangle-meshes";
  /** Monotonic renderer receipt number, distinct from a simulation frame. */
  readonly submissionSerial: number | null;
  readonly frame: number | null;
  readonly meshes: readonly RenderedGeometryMesh[];
  readonly draws: readonly RenderedGeometryDraw[];
  readonly omissions: readonly RenderedGeometryOmission[];
  /** Typed array bytes in this detached result, not GPU allocation statistics. */
  readonly copiedBytes: number;
  readonly retainedBytes: number;
  /** These are scope exclusions, not estimates of their submitted counts. */
  readonly excludedScopes: readonly [
    "shadow-only-draws",
    "sky-and-fullscreen",
    "sprites-ui-text-particles",
    "shader-displacement-and-fragment-visibility",
  ];
}
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  SystemGltfAssetHandle,
  SystemAssetHandle,
  SystemParticleEffectAssetHandle,
  SystemShaderAssetHandle,
  SystemTextureAssetHandle,
} from "../assets.js";

export interface SpawnMetadata {
  readonly name?: string;
  readonly key?: string;
  readonly tags?: readonly string[];
}

export interface SystemTransformInput extends LocalTransformInput {
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  readonly lookAt?: Vec3Like;
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

/** A transform-only ECS parent for a reusable assembly of authored entities. */
export interface SpawnGroupOptions extends SpawnMetadata {
  /** Local transform relative to transform.parent, or world-root transform. */
  readonly transform?: SystemTransformInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  /** @deprecated Use `intensity`; Aperture does not currently convert lux. */
  readonly illuminance?: number;
  readonly intensity?: number;
  readonly light?: LightInput;
  /**
   * Enable shadow casting for this light. `true` uses defaults; an object
   * customizes map size, cascades, PCF radius, bias, etc. Attaches a
   * `LightShadowSettings` component (enabled). Only meshes spawned with
   * `castShadow`/`receiveShadow` participate.
   */
  readonly shadow?: boolean | LightShadowSettingsInput;
}

export type EnvironmentAssetDescriptorInput =
  | EnvironmentMapHandle
  | SystemAssetHandle<"hdr">;

export interface SpawnEnvironmentOptions extends SpawnMetadata {
  readonly source: EnvironmentAssetDescriptorInput;
  readonly intensity?: number;
  readonly color?: Vec4Like;
9:  Camera,
67:          "Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.",
72:  const setField = mutation[request.field];
80:        message: `Field '${request.field}' on component '${request.component}' is not mutable through the developer entity helper.`,
83:          field: request.field,
87:          "Use one of the whitelisted fields or add a focused mutation helper for this component field.",
101:    field: request.field,
151:    heightfieldAssetId: setColliderStringField("heightfieldAssetId"),
278:  // fields an inspect→mutate→verify loop most needs. Material parameters do
309:  [Camera.id]: {
310:    priority: setComponentIntegerField(Camera, "priority"),
311:    layerMask: setComponentIntegerField(Camera, "layerMask"),
312:    near: setComponentNumberField(Camera, "near", { positive: true }),
313:    far: setComponentNumberField(Camera, "far", { positive: true }),
314:    fovYRadians: setComponentNumberField(Camera, "fovYRadians", {
317:    aspect: setComponentNumberField(Camera, "aspect", { positive: true }),
318:    orthographicHeight: setComponentNumberField(Camera, "orthographicHeight", {
321:    frustumCulling: setComponentBooleanField(Camera, "frustumCulling"),
322:    renderTargetId: setComponentStringField(Camera, "renderTargetId"),
323:    clearColor: setComponentColorField(Camera, "clearColor"),
328: * The mutable component/field whitelist, derived from the registry itself so
336:    Object.entries(componentFieldMutations).map(([component, fields]) => [
338:      Object.keys(fields),
345:  field: string,
353:    data: { entity: request.entity, component: component.id, field },
355:      "Find an entity with the requested component, or add the component from an app system before mutating its field.",
361:  field: string,
368:    message: `Field '${field}' on component '${component.id}' requires ${requirement}.`,
372:      field,
375:    suggestedFix: `Pass ${requirement} for this component field.`,
import { createRequire } from "node:module";
import path from "node:path";

import {
  registerApertureViteDevtoolsBridge,
  scheduleApertureViteSessionWrite,
  type ApertureViteDevServer,
} from "./dev-session.js";
export {
  APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
  type ApertureViteDevServer,
} from "./dev-session.js";
import { resolveConfigFile } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";
export {
  apertureGeneratedTypeEntriesFromConfig,
  createApertureGeneratedActionTypes,
  renderApertureGeneratedTypes,
  writeApertureGeneratedActionTypes,
  type ApertureGeneratedTypeEntries,
} from "./generated-action-types.js";
export {
  createApertureSystemManifest,
  type ApertureSystemManifest,
  type ApertureVitePluginDiagnostic,
  type DiscoveredApertureSystem,
} from "./system-discovery.js";
import {
  injectApertureBrowserEntry,
  loadApertureVirtualModule,
  resolveApertureVirtualId,
} from "./virtual-modules.js";
import { installApertureSystemGraphHmr } from "./system-graph-hmr.js";
import {
  refreshApertureConfigTypesForHotUpdate,
  type ApertureConfigHmrModule,
} from "./config-type-hmr.js";

export interface ApertureVitePluginOptions {
  readonly configFile?: string;
  readonly ai?: ApertureVitePluginAiOptions;
  /**
   * Emit the COOP/COEP response headers that make the page cross-origin
   * isolated. Aperture's worker transport relies on `SharedArrayBuffer`, which
   * the browser only exposes when the document is cross-origin isolated, so
   * this defaults to `true`. Set it to `false` only if you supply the headers
   * yourself (for example via a hosting `_headers` file or another plugin).
   */
  readonly crossOriginIsolation?: boolean;
}

/**
 * Response headers required for `crossOriginIsolated === true`, which in turn
 * unlocks `SharedArrayBuffer` for the worker/main-thread snapshot transport.
 */
export const APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS: Readonly<
  Record<string, string>
> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export interface ApertureVitePluginAiOptions {
  readonly mode?: "agent" | "off";
}

export interface ApertureVitePlugin {
  readonly name: string;
  config?(config?: { readonly root?: string }): {
    readonly server?: { readonly headers?: Record<string, string> };
    readonly preview?: { readonly headers?: Record<string, string> };
    readonly worker?: { readonly format?: "es" | "iife" };
    readonly optimizeDeps?: {
      readonly include?: readonly string[];
    };
  } | void;
  configResolved?(config: {
    readonly root: string;
    readonly command?: "serve" | "build";
    readonly server?: {
      readonly host?: string | boolean;
      readonly port?: number;
    };
  }): void;
  configureServer?(server: ApertureViteDevServer): void | Promise<void>;
  handleHotUpdate?(context: {
    readonly file: string;
    readonly modules: readonly ApertureConfigHmrModule[];
  }): Promise<void>;
  resolveId?(id: string): string | null;
  load?(id: string): Promise<string | null> | string | null;
  transformIndexHtml?:
    | ((html: string) => string)
    | {
        readonly order: "pre";
        handler(html: string): string;
      };
}

export function aperture(
  options: ApertureVitePluginOptions = {},
): ApertureVitePlugin {
  let root = process.cwd();
  let command: "serve" | "build" = "serve";
  let configuredServer:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined;
  const aiDevtoolsEnabled = options.ai?.mode !== "off";
  const crossOriginIsolation = options.crossOriginIsolation !== false;

  const plugin: ApertureVitePlugin = {
    name: "aperture",
    config(config = {}) {
      const installedEngineEntries = resolveInstalledEngineEntries(
        path.resolve(config.root ?? root),
      );
      const base = {
        // Generated apps bundle an ES-module simulation worker that imports the
        // (code-split) @aperture-engine/app worker entry. Pin the worker format
        // to ES so `vite build` never falls back to IIFE, which Rollup rejects
        // for code-splitting builds (see GH #24).
        worker: { format: "es" as const },
        // Pre-bundle the generated app entry points plus engine packages the
        // consumer installed directly. This prevents a first-run discovery
        // reload (GH #31) and lets esbuild share module singletons between app
        // subpaths and direct user imports, without requiring transitive engine
        // packages that pnpm intentionally keeps out of the app root.
        optimizeDeps: {
          include: [
            "@aperture-engine/app/config",
            "@aperture-engine/app/systems",
            "@aperture-engine/app/browser",
            "@aperture-engine/app/worker",
            ...installedEngineEntries,
          ],
        },
      };
```

Stderr:

```text

```

## Command f8ccc20e368a476b8b0bb68909fb6b6d

2026-10-12T09:10:11.779479+00:00 → 2026-10-12T09:10:11.948079+00:00; exit 0; duration 0.169s.

Command:

```sh
cat > /work/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import { aperture } from '@aperture-engine/vite-plugin';
export default defineConfig({plugins:[aperture({ai:{mode:'off'}})]});
EOF
cat > /work/aperture.config.ts <<'EOF'
import { defineApertureConfig } from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser', canvas:'#aperture', systems:['src/systems/*.system.ts'],
 render:{cadence:'manual',defaultCamera:false,defaultLight:false,tonemap:'aces',exposure:1,sampleCount:4,pixelRatio:1,maxPixelRatio:1,geometryInspection:{maxRetainedBytes:96*1024*1024}},
 diagnostics:{level:'warn'}
});
EOF
cat > /work/index.html <<'EOF'
<!doctype html><html><head><meta charset="UTF-8"><title>Casa del Sole</title><style>html,body{margin:0;width:1024px;height:768px;overflow:hidden;background:#b8c9d8}canvas{display:block;width:1024px;height:768px}</style></head><body><canvas id="aperture" width="1024" height="768"></canvas><script type="module" src="/src/main.js"></script></body></html>
EOF
cat > /work/src/main.js <<'EOF'
import { appPromise } from 'virtual:aperture/browser-entry';
const canvas=document.querySelector('#aperture');
let app;
const ready=appPromise.then(async a=>{app=a;await a.ready;});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready,
 async setCamera(c){
  await ready;
  const info=await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});
  for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){
   const r=await app.requestRaw('ecs_set_component_field',{entity:info.entity,component:'Camera',field,value});
   if(!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await ready;await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){
  await ready;
  const g=app.inspectRenderedGeometry({maxBytes:96*1024*1024,maxMeshes:4096,maxVertices:2000000,maxIndices:6000000,maxDraws:10000,maxInstances:100000});
  if(g.status!=='complete')throw new Error('Geometry inspection incomplete: '+JSON.stringify(g.omissions));
  const map=new Map(g.meshes.map(m=>[m.key,m]));
  const out=[];
  for(let k=0;k<g.draws.length;k++){
   const d=g.draws[k],m=map.get(d.meshKey);
   let indices;
   if(d.indexed){indices=new Uint32Array(d.indexCount);for(let i=0;i<indices.length;i++)indices[i]=m.indices[d.firstIndex+i]+d.baseVertex;}
   else {indices=new Uint32Array(d.vertexCount);for(let i=0;i<indices.length;i++)indices[i]=d.firstVertex+i;}
   const matrices=[];for(let i=0;i<d.instances.length;i++)matrices.push(new Float32Array(d.worldMatrices.slice(i*16,i*16+16)));
   out.push({id:m.key+':draw'+k,positions:new Float32Array(m.positions),normals:m.normals?new Float32Array(m.normals):undefined,indices,worldMatrix:matrices[0]??new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),instances:matrices});
  }
  return {meshes:out};
 },
 async dispose(){await ready;await app.dispose();}
};
EOF
mkdir -p /work/src/systems
cat > /work/src/systems/setup.system.ts <<'EOF'
import { createSystem, mesh, material } from '@aperture-engine/app/systems';
import { makeScene } from '../scene.js';
export default class Setup extends createSystem({priority:0}){
 init(){
  this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:0.1,far:200,aspect:4/3}});
  this.spawn.light({key:'light.sun',kind:'directional',color:[1,.91,.78,1],intensity:3.2,transform:{rotationEulerDegrees:[-48,-40,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,strength:.85,filterRadius:2,normalBias:.035}});
  this.spawn.light({key:'light.fill',kind:'ambient',color:[.72,.81,1,1],intensity:.22});
  for(const [key,b] of makeScene()){
   this.spawn.mesh({key:'scene.'+key,mesh:mesh.triangleList({label:key,positions:b.p,normals:b.n}),material:material.standard({baseColor:b.color,roughness:b.roughness,metallic:b.metallic??0}),castShadow:b.cast!==false,receiveShadow:true});
  }
 }
}
EOF
cat > /work/src/scene.js <<'EOF'
const PI=Math.PI;
const batches=new Map();
let seed=427;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const V=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{let l=Math.hypot(...a);return a.map(v=>v/l);};
function mat(k,color,r=.8,metallic=0,cast=true){batches.set(k,{p:[],n:[],color,roughness:r,metallic,cast});return k;}
let xf=p=>p;
function tri(k,a,b,c,ns){
 a=xf(a);b=xf(b);c=xf(c);
 const normal=unit(cross(V(b,a),V(c,a)));if(!Number.isFinite(normal[0]))return;
 const q=batches.get(k);q.p.push(a,b,c);
 // Authored normals use the same current rigid transform.
 if(ns){const o=xf([0,0,0]);q.n.push(...ns.map(n=>unit(V(xf(n),o))));}else q.n.push(normal,normal,normal);
}
function quad(k,a,b,c,d,ns){tri(k,a,b,c,ns?[ns[0],ns[1],ns[2]]:null);tri(k,a,c,d,ns?[ns[0],ns[2],ns[3]]:null);}
function box(k,c,s,angle=0){
 const [x,y,z]=c,[w,h,d]=s.map(v=>v/2),co=Math.cos(angle),si=Math.sin(angle);
 const p=(a,b,e)=>[x+a*co+e*si,y+b,z-a*si+e*co];
 const v=[p(-w,-h,-d),p(w,-h,-d),p(w,h,-d),p(-w,h,-d),p(-w,-h,d),p(w,-h,d),p(w,h,d),p(-w,h,d)];
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(k,...f.map(i=>v[i]));
}
function sphere(k,c,s,seg=12,rings=7){
 const p=(t,a)=>[c[0]+s[0]*Math.sin(t)*Math.cos(a),c[1]+s[1]*Math.cos(t),c[2]+s[2]*Math.sin(t)*Math.sin(a)];
 const n=(t,a)=>unit([Math.sin(t)*Math.cos(a)/s[0],Math.cos(t)/s[1],Math.sin(t)*Math.sin(a)/s[2]]);
 for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
  let a=i*2*PI/seg,b=(i+1)*2*PI/seg,t=j*PI/rings,u=(j+1)*PI/rings;
  if(j===0)tri(k,p(t,a),p(u,b),p(u,a),[n(t,a),n(u,b),n(u,a)]);
  else if(j===rings-1)tri(k,p(t,a),p(t,b),p(u,a),[n(t,a),n(t,b),n(u,a)]);
  else quad(k,p(t,a),p(t,b),p(u,b),p(u,a),[n(t,a),n(t,b),n(u,b),n(u,a)]);
 }
}
function tube(k,a,b,r1,r2=r1,seg=10,cap=true){
 const axis=unit(V(b,a)),ref=Math.abs(axis[1])<.9?[0,1,0]:[1,0,0],u=unit(cross(axis,ref)),v=cross(axis,u);
 const p=(c,r,t)=>c.map((e,i)=>e+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t)));
 for(let i=0;i<seg;i++){
  let t=i*2*PI/seg,q=(i+1)*2*PI/seg;
  quad(k,p(a,r1,t),p(a,r1,q),p(b,r2,q),p(b,r2,t));
  if(cap){tri(k,a,p(a,r1,q),p(a,r1,t));tri(k,b,p(b,r2,t),p(b,r2,q));}
 }
}
function slab(k,points,y,th=.08){
 let c=[points.reduce((s,p)=>s+p[0],0)/points.length,y,points.reduce((s,p)=>s+p[1],0)/points.length];
 for(let i=0;i<points.length;i++){let p=points[i],q=points[(i+1)%points.length];tri(k,c,[q[0],y,q[1]],[p[0],y,p[1]]);quad(k,[p[0],y,p[1]],[q[0],y,q[1]],[q[0],y-th,q[1]],[p[0],y-th,p[1]]);}
}
function irregularStone(k,x,z,w,d,y=.12){
 let p=[];for(let i=0;i<6;i++){let a=i*2*PI/6;p.push([x+Math.cos(a)*w*(.42+rand()*.1),z+Math.sin(a)*d*(.42+rand()*.1)]);}slab(k,p,y,.07);
}
function wall(k,width,height,depth,holes,mapper){
 const old=xf;xf=p=>old(mapper(p));
 let xx=[-width/2,width/2,...holes.flatMap(h=>[h[0]-h[2]/2,h[0]+h[2]/2])].sort((a,b)=>a-b);
 let yy=[.18,height,...holes.flatMap(h=>[h[1]-h[3]/2,h[1]+h[3]/2])].sort((a,b)=>a-b);
 for(let i=0;i<xx.length-1;i++)for(let j=0;j<yy.length-1;j++){
  if(xx[i+1]-xx[i]<.01||yy[j+1]-yy[j]<.01)continue;
  let x=(xx[i]+xx[i+1])/2,y=(yy[j]+yy[j+1])/2;
  if(holes.some(h=>Math.abs(x-h[0])<h[2]/2-.001&&Math.abs(y-h[1])<h[3]/2-.001))continue;
  box(k,[x,y,0],[xx[i+1]-xx[i],yy[j+1]-yy[j],depth]);
 }
 xf=old;
}
function window(x,y,w,h,mapper){
 const old=xf;xf=p=>old(mapper(p));
 box('glass',[x,y,-.10],[w-.12,h-.12,.035]);
 box('interior',[x,y,-.16],[w,h,.02]);
 // warm curtain slats, held inside actual wall opening
 for(let side of [-1,1])box('curtain',[x+side*w*.33,y,-.08],[w*.16,h-.12,.022]);
 for(let s of [-1,1]){box('frame',[x+s*w/2,y,.028],[.09,h+.12,.105]);box('frame',[x,y+s*h/2,.028],[w+.09,.09,.105]);}
 box('frame',[x,y,.085],[.07,h,.07]);box('frame',[x,y-.03,.085],[w,.055,.07]);
 box('sill',[x,y-h/2-.12,.075],[w+.26,.14,.32]);
 xf=old;
}
function barrel(k,x,y,z,len,r,slope=0,along='z'){
 // Upper half-cylinder roof tile, closed with thin thickness.
 const p=(a,t,off=0)=>along==='z'?[x+(r-off)*Math.cos(a),y+(r-off)*Math.sin(a)+t*slope,z+t]:[x+t,y+(r-off)*Math.sin(a)+t*slope,z+(r-off)*Math.cos(a)];
 for(let i=0;i<6;i++){
  let a=i*PI/6,b=(i+1)*PI/6;
  quad(k,p(a,0),p(b,0),p(b,len),p(a,len));
  quad(k,p(a,0,.035),p(a,len,.035),p(b,len,.035),p(b,0,.035));
  quad(k,p(a,0),p(a,0,.035),p(b,0,.035),p(b,0));
  quad(k,p(a,len),p(b,len),p(b,len,.035),p(a,len,.035));
 }
}
function roof(width,front,back,eave,peak,roofm='roof'){
 const hx=width/2,zm=(front+back)/2,half=(front-back)/2;
 quad(roofm,[-hx,eave,front],[hx,eave,front],[hx,peak,zm],[-hx,peak,zm]);
 quad(roofm,[-hx,peak,zm],[hx,peak,zm],[hx,eave,back],[-hx,eave,back]);
 for(let x=-hx+.14;x<hx;x+=.285)for(let s of [-1,1]){
  for(let row=0;row<Math.ceil(half/.46);row++){
   let z=zm+s*row*.46,remain=Math.min(.51,half-row*.46);
   if(remain<=.035)continue;
   let yy=peak-Math.abs(z-zm)*(peak-eave)/half+.035;
   const old=xf;if(s===-1)xf=p=>old([p[0],p[1],2*z-p[2]]);
   barrel('tile'+(Math.floor(rand()*5)),x,yy,z,remain,.145,-(peak-eave)/half);
   xf=old;
  }
 }
 for(let x=-hx;x<hx;x+=.4)barrel('ridge',x,peak+.13,zm,.43,.20,0,'x');
 for(let z of [front,back])box('wood',[0,eave-.08,z],[width+.18,.16,.16]);
 for(let x of [-hx,hx]){
  tube('wood',[x,eave-.08,front],[x,peak-.07,zm],.065,.065,6);
  tube('wood',[x,peak-.07,zm],[x,eave-.08,back],.065,.065,6);
 }
}
export function makeScene(){
 seed=427;batches.clear();
 mat('stucco','#e8d6b6');mat('stuccoShade','#dac6a6');mat('sill','#c7b493');mat('wood','#6b4a2c');mat('roof','#965137');
 for(let i=0;i<5;i++)mat('tile'+i,['#b9673b','#c77848','#af5a32','#d18a55','#a45330'][i],.76);
 mat('ridge','#c67a48');mat('frame','#323b3c',.5);mat('glass','#293f48',.18,.3);mat('interior','#151a1a');mat('curtain','#a79577');mat('door','#3b484d',.62);mat('doorPanel','#455256',.6);mat('metal','#252b2b',.35,.55);mat('gold','#b59a63',.34,.6);mat('lamp','#edc07a',.32);mat('ground','#65783c');
 mat('grass0','#758843');mat('grass1','#5f7435');mat('grass2','#8c9650');mat('earth','#8b7653');mat('asphalt','#555354',.98,false);mat('mark','#e1dfd1',.9,0,false);mat('curb','#aaa69a');
 for(let i=0;i<6;i++)mat('stone'+i,['#b3a48a','#c1b399','#a2957d','#b7aa94','#a89e88','#c8b9a0'][i],.96);
 mat('mortar','#8e8b78');mat('bark','#67503a');mat('bark2','#806044');
 for(let i=0;i<5;i++)mat('leaf'+i,['#4b612d','#62783e','#788448','#536a37','#889054'][i],.92);
 mat('cypress','#354d2c');mat('lavender','#8b7aa4');mat('yellow','#ccab48');mat('pot','#9f5e36');mat('potEdge','#bd7850');mat('soil','#493e29');
 mat('carPaint','#22558a',.28,.32);mat('carPaintLight','#346da2',.25,.3);mat('carTrim','#202b32',.42,.25);mat('carGlass','#314651',.14,.38);mat('rubber','#252627',.91);mat('alloy','#a2a7aa',.28,.78);mat('brake','#45494b',.5,.5);mat('headlight','#dad8b8',.18,.3);mat('red','#a93423',.3);mat('plate','#e3d9b8',.6);mat('chrome','#bfc1bb',.18,.9);
 ground();house();garden();car();backdrop();
 return [...batches].filter(([k,b])=>b.p.length);
}
function ground(){
 box('earth',[0,-.24,0],[28,.42,28]);
 box('ground',[-2,-.01,-2],[22,.09,22]);
 // Elliptical roadway wraps around a fixed garden, with actual curb segments.
 const cx=-3,cz=-4,rx=12,rz=11.5;
 const P=(t,r)=>[cx+(rx+r)*Math.sin(t),cz+(rz+r)*Math.cos(t)];
 for(let i=0;i<100;i++){
  let a=-1.45+i*2.9/100,b=-1.45+(i+1)*2.9/100;
  let A=P(a,0),B=P(b,0),C=P(b,4.6),D=P(a,4.6);
  quad('asphalt',[A[0],.035,A[1]],[D[0],.035,D[1]],[C[0],.035,C[1]],[B[0],.035,B[1]]);
  let E=P(a,-.8),F=P(b,-.8);quad('curb',[E[0],.12,E[1]],[A[0],.12,A[1]],[B[0],.12,B[1]],[F[0],.12,F[1]]);
  quad('curb',[A[0],.12,A[1]],[A[0],.035,A[1]],[B[0],.035,B[1]],[B[0],.12,B[1]]);
  // segment edges articulated with a narrow mortar joint.
  tube('mortar',[A[0],.121,A[1]],[E[0],.121,E[1]],.008,.008,4);
 }
 for(let i=0;i<24;i++){
  let a=-1.4+i*.118,b=a+.057;
  let A=P(a,2.5),B=P(b,2.5),C=P(b,2.65),D=P(a,2.65);
  quad('mark',[A[0],.045,A[1]],[D[0],.045,D[1]],[C[0],.045,C[1]],[B[0],.045,B[1]]);
 }
 // Mottled lawn patches stay low and follow the garden footprint.
 for(let i=0;i<230;i++){let x=-10+rand()*17,z=-9+rand()*15;if(z>5.5||x>7.5||Math.abs(x)<4.2&&Math.abs(z)<3.3)continue;slab('grass'+i%3,Array.from({length:6},(_,j)=>{let a=j*PI/3;return [x+Math.cos(a)*(.25+rand()*.35),z+Math.sin(a)*(.2+rand()*.3)]}),.045,.005);}
}
function house(){
 const front=p=>[p[0],p[1],3+p[2]],back=p=>[-p[0],p[1],-3-p[2]],right=p=>[4+p[2],p[1],-p[0]],left=p=>[-4-p[2],p[1],p[0]];
 const holes=[[-2.5,1.6,1.2,1.55],[2.5,1.6,1.2,1.55],[-2.05,4.8,1.65,1.7],[2.05,4.8,1.65,1.7],[0,1.37,1.18,2.5]];
 wall('stucco',8,6.4,.30,holes,front);
 for(const h of holes.slice(0,4))window(...h,front);
 for(const [mapper,k] of [[right,'stuccoShade'],[left,'stucco'],[back,'stuccoShade']]){
  let hs=mapper===back?[[-2,1.65,1.3,1.55],[2,1.65,1.3,1.55],[-2,4.8,1.4,1.7],[2,4.8,1.4,1.7]]:[[-1.6,1.65,1.0,1.6],[1.6,1.65,1,1.6],[-1.6,4.8,1.0,1.7],[1.6,4.8,1,1.7]];
  wall(k,mapper===back?8:6,6.4,.3,hs,mapper);for(let h of hs)window(...h,mapper);
 }
 // Solid gables are closed prisms; ridge runs left/right.
 for(let x of [-4,4]){
  const old=xf;xf=p=>[x+(x>0?p[2]:-p[2]),p[1],p[0]];
  tri('stucco',[-3,6.4,.0],[3,6.4,.0],[0,8.35,.0]);
  tri('stucco',[0,8.35,.22],[3,6.4,.22],[-3,6.4,.22]);
  for(let [a,b] of [[[-3,6.4],[3,6.4]],[[3,6.4],[0,8.35]],[[0,8.35],[-3,6.4]]])quad('stucco',[a[0],a[1],0],[a[0],a[1],.22],[b[0],b[1],.22],[b[0],b[1],0]);
  xf=old;
 }
 roof(8.7,3.5,-3.5,6.4,8.5);
 box('sill',[0,.20,0],[8.24,.25,6.22]);
 // Downpipes and thin eave gutter.
 tube('metal',[-4.17,6.3,3.44],[4.17,6.3,3.44],.06,.06,10);
 for(let x of [-3.87,3.87]){tube('metal',[x,6.3,3.45],[x,5.99,3.22],.046,.046);tube('metal',[x,5.99,3.22],[x,.32,3.22],.046,.046);tube('metal',[x,.32,3.22],[x,.21,3.46],.046,.046);}
 // Porch slab, two broad stucco posts and capital/collar details.
 box('stone2',[0,.24,4.02],[4.65,.27,2.1]);
 box('stone1',[0,.13,5.18],[4.7,.16,.44]);
 box('stone3',[0,.055,5.48],[4.7,.1,.30]);
 for(let x of [-2.02,2.02]){
  box('stucco',[x,1.8,4.72],[.32,3.05,.34]);
  box('sill',[x,.43,4.72],[.48,.16,.5]);
  box('stucco',[x,3.30,4.72],[.48,.18,.52]);
 }
 box('wood',[0,3.4,4.66],[4.6,.20,.24]);
 // Single-slope tiled porch covering.
 const pfront=5.0,pback=3.04,h=3.55,top=4.02;
 quad('roof',[-2.4,h,pfront],[2.4,h,pfront],[2.4,top,pback],[-2.4,top,pback]);
 for(let x=-2.3;x<2.4;x+=.285)for(let row=0;row<5;row++){let z=pback+row*.41,y=top-(z-pback)*.24;barrel('tile'+Math.floor(rand()*5),x,y+.035,z,.45,.145,-.24);}
 box('wood',[0,3.53,5.0],[4.85,.16,.13]);
 for(let x of [-2.4,2.4])tube('wood',[x,3.55,5],[x,4.02,3.04],.06,.06);
 box('door',[0,1.43,2.95],[1.10,2.45,.13]);
 for(let x of [-.26,.26])for(let y of [.93,1.94])box('doorPanel',[x,y,3.031],[.40,.75,.045]);
 for(let x of [-.61,.61])box('sill',[x,1.46,3.01],[.095,2.62,.18]);
 box('sill',[0,2.79,3.01],[1.3,.12,.19]);box('gold',[-.40,1.29,3.075],[.065,.24,.05]);tube('gold',[-.4,1.3,3.11],[-.4,1.3,3.20],.025,.025);
 // Wall lantern to the left of the entry.
 box('metal',[-.96,2.57,3.22],[.09,.31,.08]);tube('metal',[-.96,2.68,3.24],[-.96,2.73,3.48],.023);
 box('lamp',[-.96,2.53,3.48],[.17,.24,.15]);
 for(let x of [-1.055,-.865])for(let z of [3.395,3.565])tube('metal',[x,2.39,z],[x,2.68,z],.013);
 box('metal',[-.96,2.38,3.48],[.23,.04,.23]);
 sphere('metal',[-.96,2.71,3.48],[.17,.10,.16],8,4);
 // Chimney on the right roof slope, with cap, visible vent cavity and tiny flue pillars.
 box('stucco',[2.25,8.52,-.7],[.67,1.74,.71]);
 box('sill',[2.25,9.39,-.7],[.79,.12,.83]);
 box('interior',[2.25,9.59,-.7],[.59,.31,.60]);
 for(let x of [1.98,2.52])for(let z of [-.97,-.43])box('stucco',[x,9.58,z],[.095,.32,.095]);
 box('sill',[2.25,9.79,-.7],[.91,.14,.91]);sphere('ridge',[2.25,9.9,-.7],[.48,.12,.48],4,2);
}
EOF
```

Stdout:

```text

```

Stderr:

```text

```

## Command c435b41a6c2d49379ae2e42e88cf18bb

2026-10-12T09:12:47.501732+00:00 → 2026-10-12T09:12:49.927728+00:00; exit 0; duration 2.426s.

Command:

```sh
cat >> /work/src/scene.js <<'EOF'
function hedge(x,z,s=1){
 for(let i=0;i<9;i++){
  let a=rand()*2*PI,r=rand()*.6*s;
  sphere('leaf'+i%5,[x+Math.cos(a)*r,.27+rand()*.37*s,z+Math.sin(a)*r],[.34*s,.3*s,.33*s],8,5);
 }
}
function tree(x,z,s=1){
 tube('bark',[x,0,z],[x+.08*s,2.3*s,z],.14*s,.07*s,9);
 for(let i=0;i<8;i++){
  let a=i*2.4,ex=x+Math.cos(a)*(.55+rand()*.8)*s,ez=z+Math.sin(a)*(.55+rand()*.7)*s,ey=(1.85+rand()*.85)*s;
  tube(i%2?'bark':'bark2',[x+.05*s,1.0*s,z],[ex,ey,ez],.075*s,.025*s,7);
  tube('bark',[ex,ey,ez],[ex+.20*s,ey+.5*s,ez-.2*s],.025*s,.008*s,5);
  for(let j=0;j<6;j++){
   sphere('leaf'+(i+j)%5,[ex+(rand()-.5)*.65*s,ey+(rand()-.2)*.65*s,ez+(rand()-.5)*.65*s],[.4*s,.3*s,.43*s],8,5);
  }
 }
}
function cypress(x,z,h=5){
 tube('bark',[x,0,z],[x,h*.65,z],.07,.025,8);
 for(let i=0;i<9;i++)sphere('cypress',[x+(rand()-.5)*.12, .5+i*h/10,z+(rand()-.5)*.1],[.3*(1-i*.055),h*.14,.29*(1-i*.055)],9,5);
}
function flowers(x,z,count=24,s=1){
 for(let i=0;i<count;i++){
  let a=rand()*2*PI,r=rand()*.55*s,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,h=.25+rand()*.33*s;
  tube('leaf1',[xx,.06,zz],[xx+.05,h,zz],.012,.008,4);
  sphere(i%3===0?'yellow':'lavender',[xx+.05,h,zz],[.045,.08,.045],5,3);
 }
}
function pot(x,z,s=1){
 tube('pot',[x,.1,z],[x,.55*s,z],.23*s,.33*s,14);
 tube('potEdge',[x,.51*s,z],[x,.59*s,z],.34*s,.34*s,16);
 tube('soil',[x,.594*s,z],[x,.602*s,z],.3*s,.3*s,14);
 tree(x,z,.34*s);
}
function garden(){
 // Path from the entry to the gap between garden piers.
 for(let row=0;row<10;row++)for(let col=0;col<3;col++){let x=-.75+col*.55+(rand()-.5)*.15,z=5.25+row*.235;irregularStone('stone'+Math.floor(rand()*6),x,z,.60,.40,.125);}
 // Side path and back terrace form real individual paving stones.
 for(let row=0;row<22;row++)for(let col=0;col<4;col++){let x=4.55+col*.43,z=-3+row*.43;irregularStone('stone'+Math.floor(rand()*6),x+(rand()-.5)*.12,z+(rand()-.5)*.12,.51,.48,.12);}
 pot(-1.42,3.68,.85);pot(1.45,3.74,.72);pot(3.23,3.6,1.0);
 // A curved masonry garden wall, each course bonded with varied stones.
 const cx=-3,cz=-4,rx=11.10,rz=10.6;
 for(let j=0;j<3;j++)for(let i=0;i<50;i++){
  let a=-1.4+(i+.5*(j%2))*2.8/50,b=a+2.8/50-.006;
  let mid=(a+b)/2,x=cx+rx*Math.sin(mid),z=cz+rz*Math.cos(mid);
  if(z>5&&Math.abs(x)<1.24)continue;
  let p1=[cx+rx*Math.sin(a),cz+rz*Math.cos(a)],p2=[cx+rx*Math.sin(b),cz+rz*Math.cos(b)];
  let width=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
  box('stone'+Math.floor(rand()*6),[x,.22+j*.28,z],[width,.26,.43],-mid);
 }
 for(let i=0;i<80;i++){
  let a=-1.4+(i+.5)*2.8/80,x=cx+rx*Math.sin(a),z=cz+rz*Math.cos(a);
  if(z>5&&Math.abs(x)<1.24)continue;
  box('stone'+i%6,[x,1.01,z],[.38,.13,.54],-a);
 }
 for(let x of [-1.32,1.32]){
  let z=cz+rz*Math.sqrt(1-((x-cx)/rx)**2);
  for(let j=0;j<5;j++)box('stone'+j%6,[x,.18+j*.25,z],[.53,.235,.56]);
  box('sill',[x,1.42,z],[.70,.15,.72]);
 }
 // Mailbox on a slender freestanding support at the entry.
 let mbx=-1.9,mbz=6.12;
 box('metal',[mbx,.66,mbz],[.08,1.28,.08]);
 box('metal',[mbx,1.38,mbz],[.5,.40,.34]);
 sphere('metal',[mbx,1.59,mbz],[.25,.18,.17],10,5);
 box('gold',[mbx,1.4,mbz+.175],[.17,.035,.008]);
 box('door',[mbx+.24,1.55,mbz],[.012,.20,.20]);
 // Greenery along front and side masonry boundary.
 for(let i=0;i<29;i++){
  let a=-1.28+i*2.55/29,x=cx+10.25*Math.sin(a),z=cz+9.8*Math.cos(a);
  if(z>4.8&&Math.abs(x)<1.75)continue;
  hedge(x,z,.6+rand()*.5);
 }
 tree(-6.5,2.7,1.45);tree(7,-2.5,1.05);tree(-7.5,-4.6,1.25);
 cypress(-8,-2.0,5.8);cypress(-6.3,-6.8,5.0);cypress(7.4,-6.6,4.5);
 for(let x of [-3.3,3.3]){hedge(x,4.7,.78);flowers(x,4.85,28,.85);}
 for(let i=0;i<9;i++){hedge(4.7,-2.5+i*.72,.72);flowers(5.0,-2.5+i*.72,12,.8);}
 flowers(-5,4.8,50,1.2);flowers(-7,1.2,35,1);
 // Timber gate closing the side passage.
 for(let i=0;i<13;i++)box('wood',[6.25,-.02+1.02,-2.6+i*.075],[.09,1.95,.065]);
 box('wood',[6.25,1.01,-2.15],[.17,1.95,.95]);
 for(let i=0;i<9;i++)box('bark2',[6.345,1.04,-2.54+i*.10],[.018,1.88,.014]);
}
function car(){
 const old=xf,angle=.77,co=Math.cos(angle),si=Math.sin(angle),cx=3.7,cz=8.0;
 xf=p=>[cx+p[0]*co+p[2]*si,p[1]+.055,cz-p[0]*si+p[2]*co];
 // Smooth hood, fenders, trunk and compound body contour.
 const sections=[
 [-2.28,.73,.73],[-2.12,.96,.90],[-1.70,1.05,.96],[-1.00,1.14,.96],[-.6,1.17,.95],[.25,1.16,.96],[1.10,1.13,.94],[1.75,1.05,.9],[2.05,.9,.8],[2.16,.74,.70]
 ];
 for(let i=0;i<sections.length-1;i++){
  let A=sections[i],B=sections[i+1];
  // Hood top slopes down over front; rear deck is narrow and under window.
  for(let side of [-1,1]){
   quad('carPaintLight',[A[0],A[1],0],[B[0],B[1],0],[B[0],B[1]-.075,side*B[2]],[A[0],A[1]-.075,side*A[2]]);
   quad('carPaint',[A[0],A[1]-.075,side*A[2]],[B[0],B[1]-.075,side*B[2]],[B[0],B[1]-.20,side*(B[2]+.02)],[A[0],A[1]-.20,side*(A[2]+.02)]);
  }
 }
 // Continuous side panels shaped around the four true wheel openings.
 const at=x=>{
  let i=sections.findIndex(s=>s[0]>=x);if(i<1)return sections[Math.max(0,i)];let a=sections[i-1],b=sections[i],t=(x-a[0])/(b[0]-a[0]);return [x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
 };
 for(let side of [-1,1])for(let i=0;i<92;i++){
  let x=-2.28+i*4.44/92,q=x+4.44/92,A=at(x),B=at(q);
  const low=x=>{let y=.43;for(let w of [-1.4,1.35])if(Math.abs(x-w)<.565)y=Math.max(y,.57+Math.sqrt(.565**2-(x-w)**2));return y;};
  let ya=low(x),yb=low(q),ta=A[1]-.20,tb=B[1]-.20;
  if(ya<ta&&yb<tb)quad('carPaint',[x,ya,side*(A[2]-.015)],[q,yb,side*(B[2]-.015)],[q,tb,side*(B[2]+.02)],[x,ta,side*(A[2]+.02)]);
  // Raised wheel arch lips run as a semicircular bodywork ribbon.
 }
 for(let x of [-1.4,1.35])for(let side of [-1,1])for(let i=0;i<20;i++){
  let a=i*PI/20,b=(i+1)*PI/20,r=.57,R=.60;
  quad('carPaintLight',[x+r*Math.cos(a),.57+r*Math.sin(a),side*.972],[x+r*Math.cos(b),.57+r*Math.sin(b),side*.972],[x+R*Math.cos(b),.57+R*Math.sin(b),side*.975],[x+R*Math.cos(a),.57+R*Math.sin(a),side*.975]);
 }
 // Roof canopy and hatch rear.
 quad('carPaintLight',[-.13,1.67,-.71],[-.13,1.67,.71],[.97,1.7,.72],[.97,1.7,-.72]);
 quad('carGlass',[-.66,1.16,-.77],[-.66,1.16,.77],[-.16,1.65,.695],[-.16,1.65,-.695]);
 quad('carGlass',[1.04,1.67,-.69],[1.04,1.67,.69],[1.78,1.08,.76],[1.78,1.08,-.76]);
 for(let side of [-1,1]){
  // Bordered side windows, front and rear trapezoids.
  quad('carTrim',[-.71,1.13,side*.88],[-.16,1.70,side*.73],[1.03,1.73,side*.74],[1.79,1.09,side*.87]);
  quad('carGlass',[-.58,1.2,side*.886],[-.1,1.64,side*.735],[.48,1.66,side*.747],[.53,1.19,side*.914]);
  quad('carGlass',[.62,1.19,side*.914],[.58,1.66,side*.75],[.98,1.65,side*.75],[1.62,1.16,side*.883]);
  tube('carPaint',[-.68,1.14,side*.89],[-.13,1.70,side*.73],.046,.042,8);
  tube('carPaint',[-.13,1.70,side*.73],[1.02,1.73,side*.74],.038,.038,8);
  tube('carPaint',[1.02,1.73,side*.74],[1.79,1.10,side*.87],.046,.042,8);
  tube('carTrim',[-.68,1.14,side*.912],[1.75,1.12,side*.928],.024,.024,7);
  tube('carTrim',[.55,1.16,side*.935],[.52,1.69,side*.74],.034,.034,7);
  // Door gaps below glazing, handles, rocker trim and mirror assemblies.
  tube('carTrim',[.56,.56,side*.955],[.56,1.13,side*.979],.009,.009,4);
  tube('carTrim',[-.67,.54,side*.93],[-.67,1.14,side*.979],.008,.008,4);
  tube('carTrim',[1.75,.58,side*.895],[1.72,1.07,side*.924],.009,.009,4);
  tube('carTrim',[-.8,.46,side*.94],[.8,.46,side*.94],.033,.033,8);
  box('carTrim',[.29,1.06,side*.981],[.19,.045,.05]);box('carTrim',[1.35,1.05,side*.956],[.17,.045,.05]);
  tube('carTrim',[-.56,1.18,side*.87],[-.6,1.19,side*1.04],.038,.038,7);
  sphere('carPaint',[-.61,1.22,side*1.08],[.16,.095,.11],12,6);
  box('carGlass',[-.61,1.245,side*1.171],[.19,.075,.012]);
 }
 // Sculpted nose and bumpers.
 quad('carPaint',[-2.29,.75,-.72],[-2.29,.75,.72],[-2.14,1.00,.86],[-2.14,1.00,-.86]);
 box('carPaint',[-2.22,.56,0],[.18,.27,1.67]);
 box('carTrim',[-2.323,.58,0],[.015,.18,1.02]);
 box('carTrim',[-2.312,.86,0],[.02,.16,.90]);
 for(let y of [.52,.58,.64,.82,.88])box('chrome',[-2.335,y,0],[.01,.014,1.00]);
 for(let s of [-1,1]){
  quad('headlight',[-2.327,.82,s*.48],[-2.23,.83,s*.84],[-2.12,.985,s*.87],[-2.32,.965,s*.46]);
  tube('chrome',[-2.32,.81,s*.47],[-2.23,.82,s*.84],.018,.018,6);
  sphere('headlight',[-2.323,.63,s*.64],[.018,.051,.071],8,5);
  box('carTrim',[-2.28,.63,s*.64],[.015,.11,.19]);
  // Rear lamp stacks, hatch seams.
  box('red',[2.13,.94,s*.65],[.05,.19,.28]);
  box('headlight',[2.161,.94,s*.65],[.012,.04,.19]);
 }
 box('carPaint',[2.12,.62,0],[.15,.28,1.52]);box('carTrim',[2.20,.49,0],[.02,.075,1.42]);
 box('plate',[-2.342,.70,0],[.012,.14,.36]);box('plate',[2.205,.76,0],[.016,.14,.36]);
 tube('chrome',[-2.347,.925,0],[-2.365,.925,0],.056,.056,16);
 sphere('chrome',[2.20,1.015,0],[.012,.04,.04],12,5);
 tube('carTrim',[.7,1.73,0],[.86,1.99,0],.013,.006,7);
 // Wipers on the windscreen.
 tube('carTrim',[-.57,1.235,-.63],[-.38,1.39,-.16],.014,.011,5);
 tube('carTrim',[-.57,1.235,.14],[-.37,1.39,.64],.014,.011,5);
 // Four wheels: round shoulder/tread profiles, alloy spokes, hub and brake disk.
 for(let x of [-1.4,1.35])for(let side of [-1,1]){
  const z=side*.95,cy=.56;
  const profile=[[-.145,.33],[-.115,.43],[-.06,.495],[.06,.495],[.115,.43],[.145,.33]];
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<32;i++){
   const a=i*2*PI/32,b=(i+1)*2*PI/32,p=(ang,j)=>[x+Math.cos(ang)*profile[j][1],cy+Math.sin(ang)*profile[j][1],z+profile[j][0]];
   quad('rubber',p(a,j),p(b,j),p(b,j+1),p(a,j+1));
  }
  const out=z+side*.145;
  tube('brake',[x,cy,out-side*.025],[x,cy,out],.322,.322,24);
  for(let i=0;i<10;i++){
   let a=i*2*PI/10;
   const u=[x+Math.cos(a)*.09,cy+Math.sin(a)*.09,out+side*.018],v=[x+Math.cos(a+.08)*.312,cy+Math.sin(a+.08)*.312,out+side*.012];
   tube('alloy',u,v,.024,.028,5);
  }
  tube('alloy',[x,cy,out],[x,cy,out+side*.028],.085,.085,12);
  for(let i=0;i<32;i++){
   let a=i*2*PI/32,b=(i+1)*2*PI/32;
   quad('alloy',[x+.306*Math.cos(a),cy+.306*Math.sin(a),out],[x+.306*Math.cos(b),cy+.306*Math.sin(b),out],[x+.336*Math.cos(b),cy+.336*Math.sin(b),out],[x+.336*Math.cos(a),cy+.336*Math.sin(a),out]);
  }
  for(let i=0;i<5;i++){let a=i*2*PI/5;tube('chrome',[x+.05*Math.cos(a),cy+.05*Math.sin(a),out+side*.03],[x+.05*Math.cos(a),cy+.05*Math.sin(a),out+side*.038],.009,.009,6);}
 }
 // Dashboard and seats visible through side glints are actual interior volumes.
 box('carTrim',[-.35,1.15,0],[.48,.14,1.3]);
 for(let x of [.12,.85])for(let z of [-.43,.43]){sphere('interior',[x,1.24,z],[.19,.23,.19],10,5);sphere('interior',[x+.1,1.47,z],[.13,.12,.15],8,5);}
 xf=old;
}
function backdrop(){
 // Distant low terrain and olive groves provide a soft horizon.
 for(let i=0;i<9;i++){
  let x=-24+i*6,z=-24-rand()*5;
  sphere(i%2?'leaf1':'leaf2',[x,-1.6,z],[6,3.3+rand()*2.5,5],14,6);
 }
 for(let i=0;i<12;i++)tree(-14+i*2.6,-12-rand()*3,.65+rand()*.4);
}
EOF
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.38 kB │ gzip:   0.28 kB
dist/assets/aperture-worker-entry-DLU8R-GF.js    877.83 kB
dist/assets/dist-j6c_PkQ3.js                   2,261.40 kB
dist/assets/audio-CO_YoAgg.js                     18.89 kB │ gzip:   7.07 kB
dist/assets/index-Cjh6tfsq.js                  1,534.33 kB │ gzip: 383.50 kB

✓ built in 1.43s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 1

Status: error; recorder-measured coordinator wait: 3.517s.

## Public preview 1 feedback

Status: error.

```text
{"schema":"aperture.agent-house-diagnostic-preview.v3","scope":"diagnostic-only-no-score","phase":"canonical-camera","engine":"aperture","elapsedMs":740.3249999955297,"frames":[],"views":[],"artifacts":[],"observations":{"submissions":0,"drawCalls":0,"submittedTriangles":0,"indirectDrawCalls":0,"nonTriangleDrawCalls":0,"unknownTopologyDrawCalls":0,"unknownCommandBuffers":0,"renderPasses":0,"computePasses":0,"buffersCreated":0,"buffersDestroyed":0,"requestedBufferBytes":0,"texturesCreated":0,"texturesDestroyed":0,"renderPipelinesCreated":0,"workerTerminationCalls":0,"lastSubmitAt":null,"workersCreated":1,"deviceCount":1,"canvasCount":1,"liveRequestedBufferBytes":0,"capturedUploadBytes":0,"submittedVertexBufferIds":[],"workerEvidence":[{"id":0,"url":"/assets/aperture-worker-entry-DLU8R-GF.js","name":"","connected":true,"started":true,"terminated":false,"snapshotMessages":0,"snapshotPayloadObserved":false,"lastSnapshotFrame":-1,"lastSnapshotAt":null,"errors":0,"sharedFrame":0,"sharedSequence":0}]},"nativeProof":{"native":true,"adapters":[{"vendor":"google","architecture":"swiftshader","device":"","description":""}],"devices":[{"adapter":{"vendor":"google","architecture":"swiftshader","device":"","description":""},"label":""}],"canvasWebGPU":1,"webglAttempts":0,"submissions":0,"draws":0,"errors":[],"deviceLost":[]},"error":{"message":"[{\"code\":\"aperture.entityLookup.componentMutationUnsupported\",\"severity\":\"error\",\"message\":\"Component 'Camera' is not mutable through the developer entity helper.\",\"data\":{\"component\":\"Camera\",\"entity\":{\"index\":0,\"generation\":0}},\"suggestedFix\":\"Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.\"}]","stack":"Error: [{\"code\":\"aperture.entityLookup.componentMutationUnsupported\",\"severity\":\"error\",\"message\":\"Component 'Camera' is not mutable through the developer entity helper.\",\"data\":{\"component\":\"Camera\",\"entity\":{\"index\":0,\"generation\":0}},\"suggestedFix\":\"Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.\"}]\n    at Object.setCamera (http://127.0.0.1:44705/assets/index-Cjh6tfsq.js:5423:25684)\n    at async withDeadline (http://127.0.0.1:44705/__benchmark/preview-client-v3.mjs:39:12)\n    at async runDiagnosticPreview (http://127.0.0.1:44705/__benchmark/preview-client-v3.mjs:184:5)"}}
```

## Command 688fd12ca73944779dd82caa6f8afb83

2026-10-12T09:13:33.516186+00:00 → 2026-10-12T09:13:34.088746+00:00; exit 0; duration 0.573s.

Command:

```sh
node --input-type=module <<'EOF'
import {makeScene} from './src/scene.js';
const bs=makeScene();
let vertices=0;
for(const [k,b] of bs){vertices+=b.p.length;if(!b.p.every(p=>p.every(Number.isFinite)))throw Error(k+' invalid');}
console.log(JSON.stringify({batches:bs.length,vertices,triangles:vertices/3,numericBytes:vertices*24}));
EOF
```

Stdout:

```text
{"batches":59,"vertices":440430,"triangles":146810,"numericBytes":10570320}
```

Stderr:

```text

```

## Public preview 1 feedback

Status: error.

```text
{"schema":"aperture.agent-house-diagnostic-preview.v3","scope":"diagnostic-only-no-score","phase":"canonical-camera","engine":"aperture","elapsedMs":740.3249999955297,"frames":[],"views":[],"artifacts":[],"observations":{"submissions":0,"drawCalls":0,"submittedTriangles":0,"indirectDrawCalls":0,"nonTriangleDrawCalls":0,"unknownTopologyDrawCalls":0,"unknownCommandBuffers":0,"renderPasses":0,"computePasses":0,"buffersCreated":0,"buffersDestroyed":0,"requestedBufferBytes":0,"texturesCreated":0,"texturesDestroyed":0,"renderPipelinesCreated":0,"workerTerminationCalls":0,"lastSubmitAt":null,"workersCreated":1,"deviceCount":1,"canvasCount":1,"liveRequestedBufferBytes":0,"capturedUploadBytes":0,"submittedVertexBufferIds":[],"workerEvidence":[{"id":0,"url":"/assets/aperture-worker-entry-DLU8R-GF.js","name":"","connected":true,"started":true,"terminated":false,"snapshotMessages":0,"snapshotPayloadObserved":false,"lastSnapshotFrame":-1,"lastSnapshotAt":null,"errors":0,"sharedFrame":0,"sharedSequence":0}]},"nativeProof":{"native":true,"adapters":[{"vendor":"google","architecture":"swiftshader","device":"","description":""}],"devices":[{"adapter":{"vendor":"google","architecture":"swiftshader","device":"","description":""},"label":""}],"canvasWebGPU":1,"webglAttempts":0,"submissions":0,"draws":0,"errors":[],"deviceLost":[]},"error":{"message":"[{\"code\":\"aperture.entityLookup.componentMutationUnsupported\",\"severity\":\"error\",\"message\":\"Component 'Camera' is not mutable through the developer entity helper.\",\"data\":{\"component\":\"Camera\",\"entity\":{\"index\":0,\"generation\":0}},\"suggestedFix\":\"Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.\"}]","stack":"Error: [{\"code\":\"aperture.entityLookup.componentMutationUnsupported\",\"severity\":\"error\",\"message\":\"Component 'Camera' is not mutable through the developer entity helper.\",\"data\":{\"component\":\"Camera\",\"entity\":{\"index\":0,\"generation\":0}},\"suggestedFix\":\"Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.\"}]\n    at Object.setCamera (http://127.0.0.1:44705/assets/index-Cjh6tfsq.js:5423:25684)\n    at async withDeadline (http://127.0.0.1:44705/__benchmark/preview-client-v3.mjs:39:12)\n    at async runDiagnosticPreview (http://127.0.0.1:44705/__benchmark/preview-client-v3.mjs:184:5)"}}
```

## Command 275d53d16dad464496edf67afa57e1ce

2026-10-12T09:13:42.306291+00:00 → 2026-10-12T09:13:42.425120+00:00; exit 0; duration 0.119s.

Command:

```sh
grep -R -n "export const Camera\|id:.*Camera\|id:.*camera" /sdk/source/render/src | head -25; grep -n "componentFieldMutations\|getComponent" /sdk/source/app/src/entities/lookup/mutation.ts | head -20; sed -n "1,100p" /sdk/source/app/src/entities/lookup/mutation.ts
```

Stdout:

```text
/sdk/source/render/src/rendering/authoring-components-camera-light.ts:10:export const Camera = defineComponent(
/sdk/source/render/src/rendering/authoring-types.ts:25:export const CameraProjection = {
56:  const mutation = componentFieldMutations[request.component];
112:const componentFieldMutations: Readonly<
336:    Object.entries(componentFieldMutations).map(([component, fields]) => [
import {
  LocalTransform,
  Name,
  type AnyEcsComponent,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Camera,
  InstanceTint,
  Light,
  RenderLayer,
  Visibility,
} from "@aperture-engine/render";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsColliderAxis,
  PhysicsColliderShapeKind,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
} from "@aperture-engine/physics";
import { entitySummary, jsonSafeValue } from "./summary.js";
import { resolveActiveEntity } from "./resolve.js";
import type {
  ApertureEntityLookupDiagnostic,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
} from "./types.js";
import { DebugMetadata } from "../../systems.js";
import { tuple3FromValue, tuple4FromValue } from "../../devtools/payload.js";

export function setApertureEntityComponentField(
  world: EcsWorld,
  request: ApertureEntitySetComponentFieldRequest,
): ApertureEntitySetComponentFieldReport {
  const resolved = resolveActiveEntity(world, request.entity);

  if (!resolved.ok) {
    return resolved;
  }

  const mutation = componentFieldMutations[request.component];

  if (mutation === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentMutationUnsupported",
        severity: "error",
        message: `Component '${request.component}' is not mutable through the developer entity helper.`,
        data: { component: request.component, entity: request.entity },
        suggestedFix:
          "Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.",
      },
    };
  }

  const setField = mutation[request.field];

  if (setField === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentFieldUnsupported",
        severity: "error",
        message: `Field '${request.field}' on component '${request.component}' is not mutable through the developer entity helper.`,
        data: {
          component: request.component,
          field: request.field,
          entity: request.entity,
        },
        suggestedFix:
          "Use one of the whitelisted fields or add a focused mutation helper for this component field.",
      },
    };
  }

  const diagnostic = setField(resolved.entity, request);

  if (diagnostic !== null) {
    return { ok: false, diagnostic };
  }

  return {
    ok: true,
    component: request.component,
```

Stderr:

```text

```

## Command 94e8f298f685468dab7b0df4625ed7ba

2026-10-12T09:13:50.353611+00:00 → 2026-10-12T09:13:50.471989+00:00; exit 0; duration 0.118s.

Command:

```sh
head -60 /sdk/source/render/src/rendering/authoring-components-camera-light.ts; date -u; cat /work/src/main.js | head -20
```

Stdout:

```text
import { EcsType, defineComponent } from "@aperture-engine/simulation";

import {
  AreaLightShape,
  CameraProjection,
  LightKind,
} from "./authoring-types.js";
import { tuple4 } from "./authoring-utils.js";

export const Camera = defineComponent(
  "aperture.render.camera",
  {
    projection: {
      type: EcsType.Enum,
      enum: CameraProjection,
      default: CameraProjection.Perspective,
    },
    fovYRadians: { type: EcsType.Float32, default: Math.PI / 3 },
    aspect: { type: EcsType.Float32, default: 1 },
    autoAspect: { type: EcsType.Boolean, default: true },
    near: { type: EcsType.Float32, default: 0.1 },
    far: { type: EcsType.Float32, default: 1000 },
    orthographicHeight: { type: EcsType.Float32, default: 10 },
    viewport: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    scissor: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    clearColor: { type: EcsType.Color, default: tuple4(0, 0, 0, 1) },
    clearDepth: { type: EcsType.Float32, default: 1 },
    clearStencil: { type: EcsType.Int32, default: 0 },
    clearFlags: { type: EcsType.Int32, default: 3 },
    layerMask: { type: EcsType.Int32, default: 1 },
    priority: { type: EcsType.Int32, default: 0 },
    renderTargetId: { type: EcsType.String, default: "" },
    frustumCulling: { type: EcsType.Boolean, default: true },
    temporalJitterX: { type: EcsType.Float32, default: 0 },
    temporalJitterY: { type: EcsType.Float32, default: 0 },
  },
  "Renderer-independent camera authoring component.",
);

export const Light = defineComponent(
  "aperture.render.light",
  {
    kind: {
      type: EcsType.Enum,
      enum: LightKind,
      default: LightKind.Directional,
    },
    shape: {
      type: EcsType.Enum,
      enum: AreaLightShape,
      default: AreaLightShape.Rect,
    },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    intensity: { type: EcsType.Float32, default: 1 },
    range: { type: EcsType.Float32, default: 10 },
    innerConeAngle: { type: EcsType.Float32, default: Math.PI / 8 },
    outerConeAngle: { type: EcsType.Float32, default: Math.PI / 6 },
    width: { type: EcsType.Float32, default: 2 },
    height: { type: EcsType.Float32, default: 2 },
    layerMask: { type: EcsType.Int32, default: 1 },
Mon Oct 12 09:13:50 UTC 2026
import { appPromise } from 'virtual:aperture/browser-entry';
const canvas=document.querySelector('#aperture');
let app;
const ready=appPromise.then(async a=>{app=a;await a.ready;});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready,
 async setCamera(c){
  await ready;
  const info=await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});
  for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){
   const r=await app.requestRaw('ecs_set_component_field',{entity:info.entity,component:'Camera',field,value});
   if(!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await ready;await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){
  await ready;
  const g=app.inspectRenderedGeometry({maxBytes:96*1024*1024,maxMeshes:4096,maxVertices:2000000,maxIndices:6000000,maxDraws:10000,maxInstances:100000});
  if(g.status!=='complete')throw new Error('Geometry inspection incomplete: '+JSON.stringify(g.omissions));
  const map=new Map(g.meshes.map(m=>[m.key,m]));
```

Stderr:

```text

```

## Command e892d8af57ba44828a168d3b43ebc4dd

2026-10-12T09:14:45.541080+00:00 → 2026-10-12T09:14:47.778313+00:00; exit 0; duration 2.237s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/main.js')
s=p.read_text().replace("component:'Camera'","component:'aperture.render.camera'")
p.write_text(s)
p=Path('/work/src/scene.js')
s=p.read_text()
s=s.replace("a=xf(a);b=xf(b);c=xf(c);", """const o0=xf([0,0,0]), ax=V(xf([1,0,0]),o0), ay=V(xf([0,1,0]),o0), az=V(xf([0,0,1]),o0);
 if(cross(ax,ay).reduce((v,n,i)=>v+n*az[i],0)<0){[b,c]=[c,b];if(ns)ns=[ns[0],ns[2],ns[1]];}
 a=xf(a);b=xf(b);c=xf(c);""")
s=s.replace("mat('asphalt','#555354',.98,false)","mat('asphalt','#555354',.98,0,false)")
# Winding for side canopy, spokes rim and exterior tire surface follows side normal.
s=s.replace("""  // Bordered side windows, front and rear trapezoids.
  quad('carTrim',""", """  // Bordered side windows, front and rear trapezoids.
  const before=xf;
  if(side===1)xf=p=>before([p[0],p[1],-p[2]]);
  const ss=side===1?-1:side;
  quad('carTrim',""")
# Rather than rewrite transformed side world orientation, mirror coordinates twice and reverse winding for only glass quads.
s=s.replace("""  const before=xf;
  if(side===1)xf=p=>before([p[0],p[1],-p[2]]);
  const ss=side===1?-1:side;
""", "")
# Make glazing and trim two-sided geometry while maintaining actual surface positions.
s=s.replace("function quad(k,a,b,c,d,ns){tri(k,a,b,c,ns?[ns[0],ns[1],ns[2]]:null);tri(k,a,c,d,ns?[ns[0],ns[2],ns[3]]:null);}", """function quad(k,a,b,c,d,ns){tri(k,a,b,c,ns?[ns[0],ns[1],ns[2]]:null);tri(k,a,c,d,ns?[ns[0],ns[2],ns[3]]:null);
 if(k==='carGlass'||k==='carTrim'){tri(k,c,b,a);tri(k,d,c,a);}
}""")
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.38 kB │ gzip:   0.28 kB
dist/assets/aperture-worker-entry-CdtcoW8G.js    878.04 kB
dist/assets/dist-Bz46skwM.js                   2,261.40 kB
dist/assets/audio-CgC5iP9K.js                     18.89 kB │ gzip:   7.07 kB
dist/assets/index-M-8GLELC.js                  1,534.35 kB │ gzip: 383.51 kB

✓ built in 1.48s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 2

Status: ok; recorder-measured coordinator wait: 49.619s.

## Public preview 2 feedback

Status: ok.

## Public preview 2 feedback

Status: ok.

## Public note — 2026-10-12T09:16:09.895128+00:00

```
Inspecting preview 2 canonical, left-orbit and rear-orbit images returned by the recorder.
```

## Command 169891fe80974070b3a90dd206849416

2026-10-12T09:18:27.773870+00:00 → 2026-10-12T09:18:30.349771+00:00; exit 0; duration 2.576s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js')
s=p.read_text()
s=s.replace("box('ground',[-2,-.01,-2],[22,.09,22]);", """slab('ground',Array.from({length:120},(_,i)=>{let a=i*2*PI/120;return [-3+11.18*Math.sin(a),-4+10.67*Math.cos(a)];}),.043,.045);""")
s=s.replace("[width,.26,.43],-mid)","[width,.26,.43],mid)")
s=s.replace("[.38,.13,.54],-a)","[.38,.13,.54],a)")
s=s.replace("const cx=-3,cz=-4,rx=11.10,rz=10.6;", """const cx=-3,cz=-4,rx=11.10,rz=10.6;
 for(let i=0;i<100;i++){
  let a=-1.4+i*2.8/100,b=a+2.8/100,mid=(a+b)/2,x=cx+rx*Math.sin(mid),z=cz+rz*Math.cos(mid);
  if(z>5&&Math.abs(x)<1.24)continue;
  let A=[cx+(rx-.17)*Math.sin(a),cz+(rz-.17)*Math.cos(a)],B=[cx+(rx-.17)*Math.sin(b),cz+(rz-.17)*Math.cos(b)],C=[cx+(rx+.17)*Math.sin(b),cz+(rz+.17)*Math.cos(b)],D=[cx+(rx+.17)*Math.sin(a),cz+(rz+.17)*Math.cos(a)];
  slab('mortar',[A,B,C,D],.92,.86);
 }""")
s=s.replace("cx=3.7,cz=8.0","cx=7.4,cz=5.8")
s=s.replace("[-1.70,1.05,.96],[-1.00,1.14,.96]","[-1.70,1.15,.96],[-1.00,1.20,.96]")
s=s.replace("""   quad('carPaintLight',[A[0],A[1],0],[B[0],B[1],0],[B[0],B[1]-.075,side*B[2]],[A[0],A[1]-.075,side*A[2]]);
   quad('carPaint',[A[0],A[1]-.075,side*A[2]],[B[0],B[1]-.075,side*B[2]],[B[0],B[1]-.20,side*(B[2]+.02)],[A[0],A[1]-.20,side*(A[2]+.02)]);
""", """   let pp=[[A[0],A[1],0],[B[0],B[1],0],[B[0],B[1]-.075,side*B[2]],[A[0],A[1]-.075,side*A[2]]];
   if(side===1)pp.reverse();
   quad('carPaintLight',...pp);
""")
s=s.replace("Math.abs(x-w)<.565","Math.abs(x-w)<.50")
s=s.replace(".57+Math.sqrt(.565**2-(x-w)**2)",".48+Math.sqrt(.50**2-(x-w)**2)")
s=s.replace("ta=A[1]-.20,tb=B[1]-.20","ta=A[1]-.075,tb=B[1]-.075")
s=s.replace("r=.57,R=.60","r=.50,R=.525")
s=s.replace(".57+r*Math.sin(a)",".48+r*Math.sin(a)").replace(".57+r*Math.sin(b)",".48+r*Math.sin(b)").replace(".57+R*Math.sin(a)",".48+R*Math.sin(a)").replace(".57+R*Math.sin(b)",".48+R*Math.sin(b)")
s=s.replace("const z=side*.95,cy=.56;","const z=side*.95,cy=.48;")
s=s.replace("[-.115,.43],[-.06,.495],[.06,.495],[.115,.43]","[-.115,.40],[-.06,.445],[.06,.445],[.115,.40]")
# Rim and headlights are double sided thin faces, with real retained triangles.
s=s.replace("k==='carGlass'||k==='carTrim'","k==='carGlass'||k==='carTrim'||k==='headlight'||k==='alloy'")
# Shrink chimney height enough to preserve a little sky at the canonical camera.
s=s.replace("box('stucco',[2.25,8.52,-.7],[.67,1.74,.71]);","box('stucco',[2.25,8.32,-.7],[.67,1.34,.71]);")
for a,b in [("9.39","8.99"),("9.59","9.19"),("9.58","9.18"),("9.79","9.39"),("9.9","9.50")]:s=s.replace(a,b)
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.38 kB │ gzip:   0.28 kB
dist/assets/aperture-worker-entry-CM0jCEDO.js    878.40 kB
dist/assets/dist-DoGJ6bSR.js                   2,261.40 kB
dist/assets/audio-DpJAWhoS.js                     18.89 kB │ gzip:   7.07 kB
dist/assets/index-RLmxaNo6.js                  1,534.35 kB │ gzip: 383.51 kB

✓ built in 1.75s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command aa20aa8d3b234ccca4b41fb0f1bc7987

2026-10-12T09:18:30.675397+00:00 → 2026-10-12T09:18:30.795514+00:00; exit 0; duration 0.120s.

Command:

```sh
cat /sdk/source/app/src/systems/materials.ts | head -180; cat /sdk/source/app/src/systems/assets.ts | head -150; grep -R -n "createStandardMaterialAsset\|baseColorTexture" /sdk/source/app/src/systems/spawn/assets.ts | head -20; date -u
```

Stdout:

```text
import {
  patchMatcapMaterial,
  patchStandardMaterial,
  patchUnlitMaterial,
  type MaterialAsset,
  type StandardMaterialPatch,
} from "@aperture-engine/render";
import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";

// M7-T6: mutate a material's scalar/color uniform parameters at runtime by
// re-registering a patched asset through the versioned asset registry
// (markReady bumps version+1), which rides the version-gated asset mirror so the
// GPU material is re-prepared — no GPU calls and no new handle on the authoring
// side (ECS/worker invariant).

export interface MaterialSetDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export type MaterialSetResult =
  | { readonly ok: true; readonly version: number; readonly kind: string }
  | { readonly ok: false; readonly diagnostic: MaterialSetDiagnostic };

// The standard patch is the superset; unlit/matcap apply only the fields they
// have (mergeMaterialAsset ignores fields the target asset lacks).
export type MaterialPatch = StandardMaterialPatch;

export interface MaterialAccess {
  get(handle: MaterialHandle): MaterialAsset | undefined;
  set(handle: MaterialHandle, patch: MaterialPatch): MaterialSetResult;
}

export function createMaterialAccess(registry: AssetRegistry): MaterialAccess {
  return {
    get(handle) {
      return (
        registry.get<"material", MaterialAsset>(handle)?.asset ?? undefined
      );
    },
    set(handle, patch) {
      const entry = registry.get<"material", MaterialAsset>(handle);
      if (entry === undefined || entry.asset === null) {
        return {
          ok: false,
          diagnostic: {
            code: "aperture.materials.notReady",
            message: `Material '${handle.id}' is not registered with a ready asset.`,
            data: { handle: handle.id },
          },
        };
      }

      const asset = entry.asset;
      const next = patchByKind(asset, patch);
      if (next === null) {
        return {
          ok: false,
          diagnostic: {
            code: "aperture.materials.unsupportedKind",
            message: `Material '${handle.id}' of kind '${asset.kind}' does not support runtime parameter mutation.`,
            data: { handle: handle.id, kind: asset.kind },
          },
        };
      }

      const updated = registry.markReady<"material", MaterialAsset>(
        handle,
        next,
      );
      return { ok: true, version: updated.version, kind: asset.kind };
    },
  };
}

function patchByKind(
  asset: MaterialAsset,
  patch: MaterialPatch,
): MaterialAsset | null {
  switch (asset.kind) {
    case "standard":
      return patchStandardMaterial(asset, patch);
    case "unlit":
      return patchUnlitMaterial(asset, patch);
    case "matcap":
      return patchMatcapMaterial(asset, patch);
    default:
      return null;
  }
}
import { signal as createSignal, type Signal } from "@preact/signals-core";
import {
  createGlbUriLoadCache,
  createGltfEcsAuthoringCommandPlan,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfUriLoadCache,
  createBasisUniversalKtx2Transcoder,
  createDracoMeshDecoder,
  createMeshoptDecoder as createMeshoptBufferDecoder,
  createWgslShaderAsset,
  createAudioClipAsset,
  createParticleEffectAsset,
  createTextureAsset,
  createStandardMaterialAsset,
  decodeImageUrlToTextureSource,
  loadGlbFromUri,
  loadGltfFromUri,
  registerGltfSourceAssetsFromReports,
  validateAudioClipAsset,
  validateParticleEffectAsset,
  validateTextureAsset,
  type DracoMeshDecoder,
  type AudioClipAsset,
  type GltfAnimationImportReport,
  type GltfImageBytesDecoder,
  type GltfEcsAuthoringCommandPlan,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
  type GltfReportDrivenImportReport,
  type GltfSkinImportReport,
  type GltfSourceAssetRegistrationReport,
  type Ktx2BasisTranscoder,
  type Ktx2TextureCompressionSupport,
  type MeshoptBufferDecoder,
  type ParticleEffectAsset,
  type ParticleRendererModuleInput,
  type TextureAsset,
  type TextureColorSpace,
  type TextureSemantic,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createAnimationClipHandle,
  createAudioClipHandle,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createParticleEffectHandle,
  createSamplerHandle,
  createSceneHandle,
  createShaderHandle,
  createTextureHandle,
  type AnimationClip,
  type AnimationClipHandle,
  type AudioClipHandle,
  type EnvironmentMapHandle,
  type AssetRegistry,
  type AssetHandle,
  type ParticleEffectHandle,
  type SamplerHandle,
  type SceneHandle,
  type ShaderHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type {
  ApertureConfig,
  ApertureAudioAssetDescriptor,
  ApertureConfigAsset,
  ApertureParticleCompositeEffectAssetDescriptor,
  ApertureParticleEffectAssetDescriptor,
  ApertureParticleEmitterEffectAssetDescriptor,
  ApertureTextureAssetDescriptor,
  AssetPreloadPolicy,
  ConfigAssetKind,
} from "../config.js";
import {
  formatReportDiagnostics,
  type ApertureSystemDiagnostic,
  type SystemDiagnostics,
} from "./diagnostics.js";
import { ApertureSystemError } from "./errors.js";

export type SystemAssetKind = ConfigAssetKind;

export interface SystemAssetHandle<TKind extends SystemAssetKind> {
  readonly id: string;
  readonly kind: TKind;
  readonly url?: string;
  readonly label?: string;
  readonly preload: AssetPreloadPolicy;
  readonly ready: Signal<boolean>;
  readonly error: Signal<ApertureSystemDiagnostic | null>;
  readonly renderHandle: TKind extends "gltf"
    ? SceneHandle
    : TKind extends "shader"
      ? ShaderHandle
      : TKind extends "audio"
        ? AudioClipHandle
        : TKind extends "texture"
          ? TextureHandle
          : TKind extends "hdr"
            ? EnvironmentMapHandle
            : TKind extends "particle-effect"
              ? ParticleEffectHandle
              : unknown;
}

export type SystemGltfAssetHandle = SystemAssetHandle<"gltf"> & {
  readonly url: string;
  readonly renderHandle: SceneHandle;
  readonly scene: Signal<SystemGltfLoadedScene | null>;
};

export type SystemShaderAssetHandle = SystemAssetHandle<"shader"> & {
  readonly url: string;
  readonly renderHandle: ShaderHandle;
};

export type SystemAudioAssetHandle = SystemAssetHandle<"audio"> & {
  readonly url: string;
  readonly renderHandle: AudioClipHandle;
  readonly streaming: boolean;
  readonly durationHint?: number;
  readonly channels?: number;
  readonly captionTrackId?: string;
};

export type SystemTextureAssetHandle = SystemAssetHandle<"texture"> & {
  readonly url: string;
  readonly renderHandle: TextureHandle;
  readonly colorSpace: TextureColorSpace;
  readonly semantic: TextureSemantic;
  readonly mimeType?: string;
};

export type SystemParticleEffectAssetHandle =
  SystemAssetHandle<"particle-effect"> & {
    readonly renderHandle: ParticleEffectHandle;
    readonly descriptor: ApertureParticleEffectAssetDescriptor;
    readonly texture?: TextureHandle | null;
    readonly sampler?: SamplerHandle | null;
  };

/** A glTF animation clip registered in the AssetRegistry under a handle. */
export interface SystemGltfAnimationClip {
  readonly animationIndex: number;
  readonly name: string;
  readonly handle: AnimationClipHandle;
  readonly clip: AnimationClip;
}

11:  createStandardMaterialAsset,
292:  return createStandardMaterialAsset({
Mon Oct 12 09:18:30 UTC 2026
```

Stderr:

```text

```

## Command 591271d4dcd14ee991b177361b184a39

2026-10-12T09:18:58.534557+00:00 → 2026-10-12T09:18:58.656721+00:00; exit 0; duration 0.122s.

Command:

```sh
grep -R -n "interface StandardMaterialPatch\|baseColorTexture" /sdk/source/render/src/materials | head -35; grep -n "Material\|AssetRegistry\|dynamic" /sdk/source/app/src/systems.ts | head -35; grep -n "get.*material\|material:" /sdk/source/app/src/systems/spawn/index.ts | head -30; grep -n "this.context\|context:" /sdk/source/app/src/create-system.ts 2>/dev/null; find /sdk/source/app/src -maxdepth 2 -iname "*system*"; grep -n "registerTexture\|texture(\|createTexture" /sdk/source/app/src/systems/assets.ts | head -25; grep -n "export const Material" /sdk/source/render/src/rendering/*.ts
```

Stdout:

```text
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts:5:    field: "baseColorTexture",
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts:30:  "baseColorTexture",
/sdk/source/render/src/materials/factories.ts:54:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/factories.ts:98:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/factories.ts:150:export interface StandardMaterialPatch {
/sdk/source/render/src/materials/types.ts:140:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/types.ts:152:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/gltf-texture-result.ts:133:    case "baseColorTexture":
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:34:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:46:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:48:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:49:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:50:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/unlit-packing.ts:29:  readonly baseColorTextureKey: string | null;
/sdk/source/render/src/materials/unlit-packing.ts:64:    material.baseColorTexture,
/sdk/source/render/src/materials/unlit-packing.ts:90:    return { baseColorTextureKey: null, baseColorSamplerKey: null };
/sdk/source/render/src/materials/unlit-packing.ts:96:      field: "baseColorTexture.texture",
/sdk/source/render/src/materials/unlit-packing.ts:104:      field: "baseColorTexture.sampler",
/sdk/source/render/src/materials/unlit-packing.ts:110:    baseColorTextureKey:
/sdk/source/render/src/materials/standard-sampler-fidelity-inspection.ts:19:  "baseColorTexture",
/sdk/source/render/src/materials/standard-proof-point.ts:5:  | "baseColorTexture"
/sdk/source/render/src/materials/standard-proof-point.ts:42:    "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-types.ts:8:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-builders.ts:51:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-builders.ts:53:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:54:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:55:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/gltf-material-utils.ts:99:    (slot === "baseColorTexture" ||
/sdk/source/render/src/materials/standard-texture-readiness-types.ts:15:  | "baseColorTexture"
/sdk/source/render/src/materials/bindings.ts:9:        ["baseColorTexture", material.baseColorTexture],
/sdk/source/render/src/materials/bindings.ts:20:        ["baseColorTexture", material.baseColorTexture],
/sdk/source/render/src/materials/standard-texture-readiness-utils.ts:30:    (input.field === "baseColorTexture" ||
52:  type AssetRegistry,
76:import type { MaterialAccess } from "./systems/materials.js";
352:  MaterialAccess,
353:  MaterialPatch,
354:  MaterialSetDiagnostic,
355:  MaterialSetResult,
357:export { createMaterialAccess } from "./systems/materials.js";
448:  createMaterialAppearancePreset,
459:  CustomWgslMaterialDescriptor,
468:  MaterialAppearancePresetDescriptor,
469:  MaterialAppearancePresetName,
470:  MaterialDescriptor,
483:  SpawnGltfMaterialOverrides,
495:  StandardMaterialDescriptor,
496:  StandardMaterialInputOptions,
497:  StandardMaterialOptions,
506:  UnlitMaterialDescriptor,
507:  UnlitMaterialInputOptions,
508:  UnlitMaterialOptions,
593:  readonly assetsRegistry: AssetRegistry;
604:  readonly materials: MaterialAccess;
751:    get assetsRegistry(): AssetRegistry {
795:    get materials(): MaterialAccess {
/sdk/source/app/src/systems
/sdk/source/app/src/interaction/system.ts
/sdk/source/app/src/systems.ts
13:  createTextureAsset,
51:  createTextureHandle,
180:  texture(id: string): SystemTextureAssetHandle;
442:    texture(id) {
448:          "Use this.assets.texture() only with asset.texture() declarations.",
612:      renderHandle: createTextureHandle(id),
638:                : createTextureHandle(leafRenderer.texture),
840:    createTextureAsset({
871:    "Check the asset.texture() colorSpace and semantic options in aperture.config.ts.",
/sdk/source/render/src/rendering/authoring-components-core.ts:45:export const Material = defineComponent(
/sdk/source/render/src/rendering/authoring-components-core.ts:53:export const MaterialSlots = defineComponent(
```

Stderr:

```text

```

## Command c887e22a73d7414182a349662c3edaa1

2026-10-12T09:21:48.447016+00:00 → 2026-10-12T09:21:48.617989+00:00; exit 1; duration 0.171s.

Command:

```sh
sed -n "145,230p" /sdk/source/render/src/materials/factories.ts; sed -n "80,140p" /sdk/source/render/src/materials/types.ts; sed -n "34,56p" /sdk/source/render/src/rendering/authoring-components-core.ts; sed -n "570,610p" /sdk/source/app/src/systems.ts; grep -n "function createTextureAsset\|interface TextureAsset" /sdk/source/render/src/textures/*.ts; sed -n "1,130p" /sdk/source/render/src/textures/factories.ts 2>/dev/null; grep -n "createTextureHandle\|createMaterialHandle" /sdk/source/app/src/systems.ts
```

Stdout:

```text
  "emissiveFactor",
  "attenuationColor",
  "sheenColorFactor",
]);

export interface StandardMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly emissiveFactor?: Vec3Like;
  readonly occlusionStrength?: number;
  readonly normalScale?: number;
  readonly ior?: number;
  readonly transmissionFactor?: number;
  readonly thickness?: number;
  readonly attenuationColor?: Vec3Like;
  readonly attenuationDistance?: number;
  readonly sheenColorFactor?: Vec3Like;
  readonly sheenRoughnessFactor?: number;
  readonly iridescenceFactor?: number;
  readonly label?: string;
}

export interface UnlitMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly label?: string;
}

export interface MatcapMaterialPatch {
  readonly baseColorFactor?: Vec4Like;
  readonly renderState?: Partial<RenderStateDescriptor>;
  readonly label?: string;
}

function materialColor(value: Vec4Like | undefined): Vec4 {
  if (value === undefined) {
    return vec4(1, 1, 1, 1);
  }

  return vec4(
    readVec4Component(value, 0),
    readVec4Component(value, 1),
    readVec4Component(value, 2),
    readVec4Component(value, 3),
  );
}

function readVec4Component(value: Vec4Like, index: number): number {
  const component = value[index];
  if (component === undefined) {
    throw new RangeError(
      `Material baseColorFactor is missing numeric value at index ${index}.`,
    );
  }
  return component;
}

export function patchStandardMaterial(
  prev: StandardMaterialAsset,
  patch: StandardMaterialPatch,
): StandardMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchUnlitMaterial(
  prev: UnlitMaterialAsset,
  patch: UnlitMaterialPatch,
): UnlitMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

export function patchMatcapMaterial(
  prev: MatcapMaterialAsset,
  patch: MatcapMaterialPatch,
): MatcapMaterialAsset {
  return mergeMaterialAsset(prev, patch);
}

function mergeMaterialAsset<T extends object>(prev: T, patch: object): T {
  const next: Record<string, unknown> = {
    ...(prev as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch)) {
    // Only update fields the asset already has, so a cross-kind patch (e.g. a
  readonly preset: BlendPreset;
}

export interface RenderStateDescriptor {
  readonly alphaMode: MaterialAlphaMode;
  readonly alphaCutoff: number;
  readonly cullMode: MaterialCullMode;
  readonly frontFace: MaterialFrontFace;
  readonly depth: DepthStateDescriptor;
  readonly blend: BlendStateDescriptor;
  readonly colorWriteMask: ColorWriteMask;
}

export interface MaterialTextureBinding {
  readonly texture: TextureHandle | null;
  readonly sampler: SamplerHandle | null;
  readonly texCoord?: number;
  readonly transform?: MaterialTextureTransform;
}

export interface MaterialTextureTransform {
  readonly offset?: readonly [number, number];
  readonly scale?: readonly [number, number];
  readonly rotation?: number;
}

export interface TextureMipLevelSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly width: number;
  readonly height: number;
}

export interface TextureSourceData {
  readonly bytes: Uint8Array;
  readonly bytesPerRow: number;
  readonly rowsPerImage?: number;
  readonly mipLevels?: readonly TextureMipLevelSourceData[];
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonRecord = { readonly [key: string]: JsonValue };

export interface BaseMaterialAsset {
  readonly kind: MaterialKind;
  readonly label: string;
  readonly renderState: RenderStateDescriptor;
  readonly unsupportedFeatures: readonly MaterialUnsupportedFeature[];
}

export type MaterialUnsupportedFeature = "stencil" | "custom-shader";

export interface UnlitMaterialAsset extends BaseMaterialAsset {
  readonly kind: "unlit";
  readonly baseColorFactor: Color;
  readonly baseColorTexture: MaterialTextureBinding | null;
  readonly inverseBindMatrices: Float32Array;
}

export const Mesh = defineComponent(
  "aperture.render.mesh",
  {
    meshId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent mesh authoring component that stores a mesh asset handle id only.",
);

export const Material = defineComponent(
  "aperture.render.material",
  {
    materialId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent material authoring component that stores a material asset handle id only.",
);

export const MaterialSlots = defineComponent(
  "aperture.render.materialSlots",
  {
    slotsJson: { type: EcsType.String, default: "[]" },
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
  StatefulGamepadStickState,
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./input/state.js";

export interface ApertureSystemInstance {
  readonly world: unknown;
  readonly queries: Record<string, Query>;
  readonly config: Record<string, Signal<unknown>>;
  readonly priority: number;
  readonly random: ApertureRandom;
  readonly time: ApertureFrameTime;
  readonly signals: SignalStore;
  readonly resources: ResourceStore;
  readonly startOptions: StartOptionsAccess;
  readonly input: InputSignals;
  readonly actions: InputActions;
  readonly keyboard: StatefulKeyboardState;
  readonly gamepads: StatefulGamepadsState;
  readonly assetsRegistry: AssetRegistry;
  readonly assets: SystemAssetAccess;
  readonly commands: CommandAccess;
  readonly spawn: SpawnCommands;
  readonly spatial: SpatialQueries;
  readonly cameras: CameraAccess;
  readonly gltf: GltfInstanceAccess;
  readonly hierarchy: HierarchyAccess;
  readonly prefabs: PrefabAccess;
  readonly particles: ParticleAccess;
  readonly audio: AudioAccess;
  readonly materials: MaterialAccess;
  readonly meshes: MeshAccess;
  readonly trails: TrailAccess;
  readonly physics: PhysicsAccess;
  readonly fixedStep: FixedStepAccess;
  readonly interaction: InteractionAccess;
  readonly html: HtmlBridgeAccess;
```

Stderr:

```text
grep: /sdk/source/render/src/textures/*.ts: No such file or directory
```

## Command d1d577856b4c4897a20604f8ffa57d2c

2026-10-12T09:22:10.347112+00:00 → 2026-10-12T09:22:10.517717+00:00; exit 0; duration 0.171s.

Command:

```sh
find /sdk/source/render/src -iname "*texture*" | head -30; grep -R -n "export function createTextureAsset\|export function createSamplerAsset" /sdk/source/render/src | head -15; sed -n "1,80p" /sdk/source/render/src/materials/factories.ts; grep -R -n "class AssetRegistry\|register<\|markReady<" /sdk/source/simulation/src/assets | head -25; grep -n "createTextureHandle" /sdk/source/simulation/src/index.ts; grep -n "color," /sdk/source/app/src/systems.ts | head
```

Stdout:

```text
/sdk/source/render/src/materials/gltf-texture-report.ts
/sdk/source/render/src/materials/gltf-material-texture-transform.ts
/sdk/source/render/src/materials/gltf-material-textures.ts
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts
/sdk/source/render/src/materials/standard-texture-readiness-texture.ts
/sdk/source/render/src/materials/gltf-texture-resolution.ts
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts
/sdk/source/render/src/materials/gltf-texture.ts
/sdk/source/render/src/materials/gltf-material-texture-info.ts
/sdk/source/render/src/materials/gltf-texture-browser-decoder.ts
/sdk/source/render/src/materials/standard-texture-readiness-report.ts
/sdk/source/render/src/materials/gltf-texture-create.ts
/sdk/source/render/src/materials/gltf-texture-result.ts
/sdk/source/render/src/materials/gltf-material-texture-resolver.ts
/sdk/source/render/src/materials/gltf-texture-loading.ts
/sdk/source/render/src/materials/standard-texture-readiness-inspection.ts
/sdk/source/render/src/materials/gltf-texture-utils.ts
/sdk/source/render/src/materials/gltf-texture-source-mapping.ts
/sdk/source/render/src/materials/gltf-texture-sampler-mapping.ts
/sdk/source/render/src/materials/gltf-texture-image-bytes.ts
/sdk/source/render/src/materials/standard-texture-readiness-types.ts
/sdk/source/render/src/materials/standard-texture-readiness.ts
/sdk/source/render/src/materials/gltf-texture-prepare.ts
/sdk/source/render/src/materials/standard-texture-readiness-utils.ts
/sdk/source/render/src/materials/gltf-texture-types.ts
/sdk/source/render/src/materials/image-texture-decode.ts
/sdk/source/render/src/materials/factories.ts:286:export function createTextureAsset(
/sdk/source/render/src/materials/factories.ts:302:export function createSamplerAsset(
/sdk/source/render/src/materials/gltf-texture-create.ts:12:export function createTextureAssetFromGltfTexture(
/sdk/source/render/src/materials/gltf-sampler-mapping.ts:23:export function createSamplerAssetFromGltfSampler(
import { vec4 } from "@aperture-engine/simulation";
import type { Vec3Like, Vec4, Vec4Like } from "@aperture-engine/simulation";
import type {
  DebugNormalMaterialAsset,
  CustomMaterialDependencyDeclaration,
  CustomWgslMaterialAsset,
  CustomWgslMaterialPipelineKeyInput,
  CustomWgslShaderRef,
  MaterialUnsupportedFeature,
  MatcapMaterialAsset,
  RenderStateDescriptor,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  UnlitMaterialAsset,
  WgslShaderAsset,
} from "./types.js";

export function createDefaultRenderState(
  overrides: Partial<RenderStateDescriptor> = {},
): RenderStateDescriptor {
  return {
    alphaMode: overrides.alphaMode ?? "opaque",
    alphaCutoff: overrides.alphaCutoff ?? 0.5,
    cullMode: overrides.cullMode ?? "back",
    frontFace: overrides.frontFace ?? "ccw",
    depth: overrides.depth ?? {
      test: true,
      write: true,
      compare: "less",
    },
    blend: overrides.blend ?? { preset: "none" },
    colorWriteMask: overrides.colorWriteMask ?? "all",
  };
}

export function createUnlitMaterialAsset(
  input: Partial<
    Omit<
      UnlitMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): UnlitMaterialAsset {
  return {
    kind: "unlit",
    label: input.label ?? "Unlit Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    baseColorTexture: input.baseColorTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

export function createMatcapMaterialAsset(
  input: Partial<
    Omit<
      MatcapMaterialAsset,
      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): MatcapMaterialAsset {
  return {
    kind: "matcap",
    label: input.label ?? "Matcap Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    matcapTexture: input.matcapTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

/sdk/source/simulation/src/assets/collections.ts:60:    this.#registry.register<TKind, TAsset>(
/sdk/source/simulation/src/assets/collections.ts:79:    this.#registry.register<TKind, TAsset>(
/sdk/source/simulation/src/assets/collections.ts:100:    return this.#registry.unregister<TKind, TAsset>(handle);
/sdk/source/simulation/src/assets/registry.ts:18:export class AssetRegistry {
/sdk/source/simulation/src/assets/registry.ts:21:  register<TKind extends AssetKind, TAsset = unknown>(
/sdk/source/simulation/src/assets/registry.ts:49:  unregister<TKind extends AssetKind, TAsset = unknown>(
/sdk/source/simulation/src/assets/registry.ts:90:  markReady<TKind extends AssetKind, TAsset>(
```

Stderr:

```text

```

## Command 48a79007810841b9b66c1594f2488bd2

2026-10-12T09:22:29.147586+00:00 → 2026-10-12T09:22:29.266246+00:00; exit 0; duration 0.119s.

Command:

```sh
sed -n "286,329p" /sdk/source/render/src/materials/factories.ts; cat /sdk/source/simulation/src/assets/registry.ts | head -110; grep -n "interface TextureAsset\|interface SamplerAsset\|sampler\|wrap" /sdk/source/render/src/materials/types.ts | head -20; sed -n "224,287p" /sdk/source/render/src/materials/types.ts; grep -R -n "createTextureHandle" /sdk/source/simulation/dist/index* | head -5; sed -n "85,140p" /sdk/source/render/src/materials/factories.ts
```

Stdout:

```text
export function createTextureAsset(
  input: Omit<
    TextureAsset,
    "kind" | "depthOrLayers" | "mipLevelCount" | "usage"
  > &
    Partial<Pick<TextureAsset, "depthOrLayers" | "mipLevelCount" | "usage">>,
): TextureAsset {
  return {
    kind: "texture",
    depthOrLayers: input.depthOrLayers ?? 1,
    mipLevelCount: input.mipLevelCount ?? 1,
    usage: input.usage ?? ["sampled"],
    ...input,
  };
}

export function createSamplerAsset(
  input: Partial<Omit<SamplerAsset, "kind" | "label">> & {
    readonly label?: string;
  } = {},
): SamplerAsset {
  return {
    kind: "sampler",
    label: input.label ?? "Sampler",
    addressModeU: input.addressModeU ?? "repeat",
    addressModeV: input.addressModeV ?? "repeat",
    addressModeW: input.addressModeW ?? "repeat",
    magFilter: input.magFilter ?? "linear",
    minFilter: input.minFilter ?? "linear",
    mipmapFilter: input.mipmapFilter ?? "linear",
    lodMinClamp: input.lodMinClamp ?? 0,
    lodMaxClamp: input.lodMaxClamp ?? 32,
    maxAnisotropy: input.maxAnisotropy ?? 1,
  };
}

export function createWgslShaderAsset(input: {
  readonly label?: string;
  readonly source: string;
  readonly url?: string;
  readonly virtualPath?: string;
}): WgslShaderAsset {
  return {
    kind: "shader",
import { assetHandleKey } from "./handles.js";
import { ASSET_KINDS } from "./types.js";
import type {
  AssetDependencyDiagnostic,
  AssetDependencyReport,
  AssetDiagnostic,
  AssetHandle,
  AssetKind,
  AssetListFilter,
  AssetManifestDependencyEdge,
  AssetManifestReport,
  AssetProvenance,
  AssetRegistryEntry,
  AssetStatus,
  RegisterAssetOptions,
} from "./types.js";

export class AssetRegistry {
  readonly #entries = new Map<string, AssetRegistryEntry>();

  register<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
    options: RegisterAssetOptions = {},
  ): AssetRegistryEntry<TKind, TAsset> {
    const key = assetHandleKey(handle);

    if (this.#entries.has(key)) {
      throw new Error(`Asset '${key}' is already registered.`);
    }

    const entry: AssetRegistryEntry<TKind, TAsset> = {
      handle,
      kind: handle.kind,
      label: options.label ?? handle.id,
      status: "registered",
      version: 0,
      asset: null,
      dependencies: [...(options.dependencies ?? [])],
      diagnostics: [...(options.diagnostics ?? [])],
      ...(options.provenance === undefined
        ? {}
        : { provenance: options.provenance }),
    };

    this.#entries.set(key, entry as AssetRegistryEntry);
    return entry;
  }

  unregister<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    const key = assetHandleKey(handle);
    const entry = this.#entries.get(key) as
      | AssetRegistryEntry<TKind, TAsset>
      | undefined;

    if (entry === undefined) {
      return undefined;
    }

    this.#entries.delete(key);
    return entry;
  }

  has(handle: AssetHandle): boolean {
    return this.#entries.has(assetHandleKey(handle));
  }

  get<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> | undefined {
    return this.#entries.get(assetHandleKey(handle)) as
      | AssetRegistryEntry<TKind, TAsset>
      | undefined;
  }

  getStatus(handle: AssetHandle): AssetStatus | undefined {
    return this.get(handle)?.status;
  }

  markLoading<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update<TKind, TAsset>(handle, {
      status: "loading",
      asset: null,
    });
  }

  markReady<TKind extends AssetKind, TAsset>(
    handle: AssetHandle<TKind>,
    asset: TAsset,
    diagnostics: readonly AssetDiagnostic[] = [],
    provenance: AssetProvenance = "loaded",
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update(handle, {
      status: "ready",
      asset,
      diagnostics,
      provenance,
    });
  }

  markFailed<TKind extends AssetKind, TAsset = unknown>(
    handle: AssetHandle<TKind>,
    diagnostics: readonly AssetDiagnostic[],
  ): AssetRegistryEntry<TKind, TAsset> {
    return this.update<TKind, TAsset>(handle, {
      status: "failed",
      asset: null,
95:  readonly sampler: SamplerHandle | null;
207:  | "sampler";
290:  readonly kind: "sampler";
291:  readonly sampler: SamplerHandle;
292:  readonly samplerType?: "filtering" | "non-filtering" | "comparison";
311:      readonly kind: "sampler";
341:export interface TextureAsset {
356:export interface SamplerAsset {
357:  readonly kind: "sampler";
      readonly kind: "inline-wgsl";
      readonly code: string;
      readonly virtualPath?: string;
    };

/** @public */
export type CustomWgslUniformFieldType =
  | "float32"
  | "Float32"
  | "int32"
  | "Int32"
  | "uint32"
  | "Uint32"
  | "vec2"
  | "Vec2"
  | "vec3"
  | "Vec3"
  | "vec4"
  | "Vec4"
  | "Color"
  | "mat4x4";

/** @public */
export interface CustomWgslUniformField {
  readonly type: CustomWgslUniformFieldType;
  readonly default?: JsonPrimitive | readonly number[];
}

export interface BaseCustomWgslBindingDeclaration {
  readonly name: string;
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly label?: string;
}

export interface CustomWgslUniformBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "uniform-buffer";
  readonly fields: Readonly<Record<string, CustomWgslUniformField>>;
  readonly values?: Readonly<Record<string, JsonPrimitive | readonly number[]>>;
  readonly runtimeUniformKey?: string;
}

/** @public */
export interface CustomWgslStorageBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "storage-buffer";
  readonly access?: "read" | "read-write";
  readonly resourceKey?: string;
}

/** @public */
export interface CustomWgslTextureBindingDeclaration extends BaseCustomWgslBindingDeclaration {
  readonly kind: "texture";
  readonly texture: TextureHandle;
  readonly sampleType?:
    | "float"
    | "unfilterable-float"
    | "depth"
    | "sint"
    | "uint";
  readonly viewDimension?: "2d" | "cube";
  readonly multisampled?: boolean;
}

      "kind" | "label" | "renderState" | "baseColorFactor"
    >
  > & {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly baseColorFactor?: Vec4Like;
  } = {},
): StandardMaterialAsset {
  return {
    kind: "standard",
    label: input.label ?? "Standard Material",
    renderState: createDefaultRenderState(input.renderState),
    baseColorFactor: materialColor(input.baseColorFactor),
    baseColorTexture: input.baseColorTexture ?? null,
    metallicFactor: input.metallicFactor ?? 1,
    roughnessFactor: input.roughnessFactor ?? 1,
    clearcoatFactor: input.clearcoatFactor ?? 0,
    clearcoatTexture: input.clearcoatTexture ?? null,
    clearcoatRoughnessFactor: input.clearcoatRoughnessFactor ?? 0,
    clearcoatRoughnessTexture: input.clearcoatRoughnessTexture ?? null,
    transmissionFactor: input.transmissionFactor ?? 0,
    transmissionTexture: input.transmissionTexture ?? null,
    // KHR_materials_ior default is 1.5; KHR_materials_volume defaults to no
    // bounded volume (thickness 0, white attenuation). attenuationDistance uses
    // 0 as the JSON-safe sentinel for "no Beer-Lambert absorption" (the glTF
    // default attenuationDistance is +Infinity, which is not JSON-serializable).
    ior: input.ior ?? 1.5,
    thickness: input.thickness ?? 0,
    attenuationColor: input.attenuationColor ?? [1, 1, 1],
    attenuationDistance: input.attenuationDistance ?? 0,
    sheenColorFactor: input.sheenColorFactor ?? [0, 0, 0],
    sheenColorTexture: input.sheenColorTexture ?? null,
    sheenRoughnessFactor: input.sheenRoughnessFactor ?? 0,
    sheenRoughnessTexture: input.sheenRoughnessTexture ?? null,
    iridescenceFactor: input.iridescenceFactor ?? 0,
    iridescenceTexture: input.iridescenceTexture ?? null,
    iridescenceThicknessTexture: input.iridescenceThicknessTexture ?? null,
    iridescenceIor: input.iridescenceIor ?? 1.3,
    iridescenceThicknessMinimum: input.iridescenceThicknessMinimum ?? 100,
    iridescenceThicknessMaximum: input.iridescenceThicknessMaximum ?? 400,
    metallicRoughnessTexture: input.metallicRoughnessTexture ?? null,
    normalTexture: input.normalTexture ?? null,
    normalScale: input.normalScale ?? 1,
    occlusionTexture: input.occlusionTexture ?? null,
    occlusionStrength: input.occlusionStrength ?? 1,
    emissiveFactor: input.emissiveFactor ?? [0, 0, 0],
    emissiveTexture: input.emissiveTexture ?? null,
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

// M7-T6: runtime material parameter mutation. Each patch* returns a NEW frozen
// asset with the provided scalar/color uniform fields merged over `prev` — `prev`
// is never mutated. Scoped to same-variant uniform-level fields (color/scalar
// factors); fields that flip a shader variant (e.g. enabling clearcoat) are out
// of scope. Mutation flows through the versioned asset registry (markReady), not
```

Stderr:

```text

```

## Command 584064d833044e0c8d49985585e396ff

2026-10-12T09:23:34.520952+00:00 → 2026-10-12T09:23:34.840262+00:00; exit 0; duration 0.319s.

Command:

```sh
sed -n "335,380p" /sdk/source/render/src/materials/types.ts; node --input-type=module -e "import * as s from \"@aperture-engine/simulation\"; import * as r from \"@aperture-engine/render\"; console.log([typeof s.createTextureHandle,typeof s.createSamplerHandle,typeof s.createMaterialHandle,typeof r.createTextureAsset,typeof r.createSamplerAsset]);"
```

Stdout:

```text
  readonly bindings: readonly CustomWgslBindingDeclaration[];
  readonly dependencies: readonly CustomMaterialDependencyDeclaration[];
  readonly instanceAttributes?: InstanceAttributeLayoutInput;
  readonly metadata?: JsonRecord;
}

export interface TextureAsset {
  readonly kind: "texture";
  readonly label: string;
  readonly dimension: TextureDimension;
  readonly width: number;
  readonly height: number;
  readonly depthOrLayers: number;
  readonly format: TextureFormat;
  readonly colorSpace: TextureColorSpace;
  readonly semantic: TextureSemantic;
  readonly mipLevelCount: number;
  readonly usage: readonly TextureUsage[];
  readonly sourceData?: TextureSourceData;
}

export interface SamplerAsset {
  readonly kind: "sampler";
  readonly label: string;
  readonly addressModeU: SamplerAddressMode;
  readonly addressModeV: SamplerAddressMode;
  readonly addressModeW: SamplerAddressMode;
  readonly magFilter: SamplerFilterMode;
  readonly minFilter: SamplerFilterMode;
  readonly mipmapFilter: SamplerFilterMode;
  readonly lodMinClamp: number;
  readonly lodMaxClamp: number;
  readonly maxAnisotropy: number;
}

export type MaterialDiagnosticCode =
  | "material.missingTextureHandle"
  | "material.missingSamplerHandle"
  | "material.invalidAlphaCutoff"
  | "material.unsupportedFeature"
  | "material.invalidTextureColorSpace"
  | "material.invalidTextureColorSpaceFormat"
  | "material.incompatibleRenderState";

export interface MaterialValidationDiagnostic {
  readonly code: MaterialDiagnosticCode;
[ 'function', 'function', 'function', 'function', 'function' ]
```

Stderr:

```text

```

## Command 8d4ab09df7514c4bb6ecdc33591df72b

2026-10-12T09:24:29.899086+00:00 → 2026-10-12T09:24:32.924640+00:00; exit 0; duration 3.026s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js')
s=p.read_text()
s=s.replace("n:[],color","n:[],uv:[],color")
s=s.replace("const q=batches.get(k);q.p.push(a,b,c);", """const q=batches.get(k);q.p.push(a,b,c);
 const abs=normal.map(Math.abs),dominant=abs.indexOf(Math.max(...abs)),scale=k==='asphalt'?.34:k.startsWith('tile')?.9:1.1;
 for(const p of [a,b,c])q.uv.push(dominant===1?[p[0]*scale,p[2]*scale]:dominant===0?[p[2]*scale,p[1]*scale]:[p[0]*scale,p[1]*scale]);""")
s=s.replace("['#b9673b','#c77848','#af5a32','#d18a55','#a45330']","['#b96d42','#b5673d','#b76b41','#c1784a','#aa5c36']")
s=s.replace("mat('carGlass','#314651',.14,.38)","mat('carGlass','#495f6e',.14,.18)")
s=s.replace("mat('glass','#293f48',.18,.3)","mat('glass','#3f5158',.18,.15)")
p.write_text(s)
PY
cat > /work/src/surface.js <<'EOF'
import {createTextureAsset,createSamplerAsset,createStandardMaterialAsset} from '@aperture-engine/render';
import {createTextureHandle,createSamplerHandle,createMaterialHandle} from '@aperture-engine/simulation';
import {color} from '@aperture-engine/app/systems';
export function surfaceMaterials(registry){
 const sampler=createSamplerHandle('surface.repeat');
 registry.register(sampler);registry.markReady(sampler,createSamplerAsset({label:'Repeating grain',maxAnisotropy:4}));
 const textures={};
 for(const [name,contrast] of [['stucco',.15],['stone',.30],['asphalt',.40],['tile',.18],['grass',.21]]){
  let state=1321;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const size=256,bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   let grain=random(),broad=(Math.sin(x*.034)+Math.sin(y*.023)+Math.sin((x+y)*.018))*.04;
   let value=Math.round(255*(1-contrast*(.7-grain*.65)+broad*.3));
   if(name==='asphalt'&&grain>.985)value=Math.min(255,value+25);
   for(let j=0;j<3;j++)bytes[(y*size+x)*4+j]=value;
   bytes[(y*size+x)*4+3]=255;
  }
  const texture=createTextureHandle('surface.'+name);
  registry.register(texture);registry.markReady(texture,createTextureAsset({label:'Seeded '+name+' grain',dimension:'2d',width:size,height:size,format:'rgba8unorm-srgb',colorSpace:'srgb',semantic:'base-color',sourceData:{bytes,bytesPerRow:size*4}}));
  textures[name]=texture;
 }
 return (key,b)=>{
  const type=key.startsWith('stucco')?'stucco':key.startsWith('stone')||key==='curb'||key==='sill'?'stone':key==='asphalt'?'asphalt':key.startsWith('tile')||key==='ridge'?'tile':key==='ground'||key.startsWith('grass')?'grass':null;
  const handle=createMaterialHandle('surface.material.'+key);
  registry.register(handle,{dependencies:type?[textures[type],sampler]:[]});
  registry.markReady(handle,createStandardMaterialAsset({label:key,baseColorFactor:color.srgbHex(b.color),roughnessFactor:b.roughness,metallicFactor:b.metallic??0,baseColorTexture:type?{texture:textures[type],sampler}:null}));
  return handle;
 };
}
EOF
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/systems/setup.system.ts')
s=p.read_text().replace("import { makeScene } from '../scene.js';","import { makeScene } from '../scene.js';\nimport {surfaceMaterials} from '../surface.js';")
s=s.replace("  for(const [key,b] of makeScene()){","  const surfaces=surfaceMaterials(this.assetsRegistry);\n  for(const [key,b] of makeScene()){")
s=s.replace("positions:b.p,normals:b.n","positions:b.p,normals:b.n,uvs:b.uv")
s=s.replace("material:material.standard({baseColor:b.color,roughness:b.roughness,metallic:b.metallic??0})","material:surfaces(key,b)")
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.38 kB │ gzip:   0.28 kB
dist/assets/aperture-worker-entry-DkSTYXye.js    879.84 kB
dist/assets/dist-LyqdB6in.js                   2,261.40 kB
dist/assets/audio-CAedLHzV.js                     18.89 kB │ gzip:   7.07 kB
dist/assets/index-B2E2irAM.js                  1,534.35 kB │ gzip: 383.51 kB

✓ built in 2.27s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Preview 3

Status: ok; recorder-measured coordinator wait: 50.121s.

## Public preview 3 feedback

Status: ok.

## Public preview 3 feedback

Status: ok.

## Public note — 2026-10-12T09:26:42.745383+00:00

```
Inspecting all three recorder preview 3 images to verify the road, masonry, car body and procedural surface materials.
```

## Command 0dec75cb799445e1b0b4641fbd91577e

2026-10-12T09:27:52.986817+00:00 → 2026-10-12T09:27:57.597048+00:00; exit 0; duration 4.610s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/surface.js')
s=p.read_text().replace("bytes[(y*size+x)*4+j]=value;","bytes[(y*size+x)*4+j]=Math.max(0,Math.min(255,value));")
p.write_text(s)
p=Path('/work/src/scene.js')
s=p.read_text()
s=s.replace("function slab(k,points,y,th=.08){", """function slab(k,points,y,th=.08){
 let area=points.reduce((s,p,i)=>{let q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0);
 if(area<0)points=[...points].reverse();""")
s=s.replace("if(z>5.5||x>7.5||Math.abs(x)<4.2&&Math.abs(z)<3.3)continue;", "if(z>5.5||x>7.5||((x+3)/11.0)**2+((z+4)/10.5)**2>.92||Math.abs(x)<4.2&&Math.abs(z)<3.3)continue;")
s=s.replace("cx=7.4,cz=5.8","cx=6.0,cz=5.4")
s=s.replace("[2.05,.9,.8],[2.16,.74,.70]","[2.05,1.0,.8],[2.16,.94,.70]")
s=s.replace("box('red',[2.13,.94,s*.65],[.05,.19,.28]);","box('red',[2.18,.81,s*.65],[.05,.14,.25]);")
s=s.replace("box('headlight',[2.161,.94,s*.65],[.012,.04,.19]);","box('headlight',[2.209,.81,s*.65],[.012,.035,.18]);")
p.write_text(s)
PY
node --input-type=module <<'EOF'
import {makeScene} from './src/scene.js';
import {createTriangleListMeshAsset} from '@aperture-engine/render';
import {createHash} from 'node:crypto';
function inspect(){
 const scene=makeScene(), h=createHash('sha256');
 let vertices=0,triangles=0;
 for(const [key,b] of scene){
  const asset=createTriangleListMeshAsset({label:key,positions:b.p,normals:b.n,uvs:b.uv});
  h.update(key);h.update(JSON.stringify(b.p));h.update(JSON.stringify(b.n));h.update(JSON.stringify(b.uv));
  vertices+=b.p.length;triangles+=b.p.length/3;
 }
 return {batches:scene.length,vertices,triangles,sha256:h.digest('hex')};
}
const a=inspect(),b=inspect();if(a.sha256!==b.sha256)throw Error('Non-deterministic scene');
console.log(JSON.stringify({nativeMeshValidation:'passed',deterministic:true,...a}));
EOF
pnpm run build
```

Stdout:

```text
{"nativeMeshValidation":"passed","deterministic":true,"batches":59,"vertices":448344,"triangles":149448,"sha256":"40646abb6ca4af416e06a8dcfacc78cb8e797e27e4c5993dcea9b635c9d3ac07"}

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.38 kB │ gzip:   0.28 kB
dist/assets/aperture-worker-entry-CKMHuzR8.js    880.00 kB
dist/assets/dist-BPTqoPog.js                   2,261.40 kB
dist/assets/audio-ByWhU9y0.js                     18.89 kB │ gzip:   7.07 kB
dist/assets/index-DEX-t46G.js                  1,534.35 kB │ gzip: 383.51 kB

✓ built in 1.52s
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public note — 2026-10-12T09:28:56.420950+00:00

```
Final implementation: a deterministic fully three-dimensional Mediterranean house scene built inside Aperture's normal simulation worker and ECS, extracted through the SDK snapshot boundary and rendered by native WebGPU. Includes ivory stucco walls with real inset openings and dark mullioned windows on all sides, individual terracotta barrel tiles on gable and porch roofs, a capped chimney, porch posts and trim, paneled door and lantern, irregular paving, curved bonded stone garden boundary and curbs, mailbox, seeded shrubs, olive-like trees, cypresses, flower beds, pots, and a curved marked asphalt road. The blue hatchback has contoured body panels, wheel arches, four profiled wheels with alloy spokes, framed glazing, mirrors, wipers, lights, plates, bumpers and trim. Five seeded repeating surface-grain textures are registered as native worker assets. The benchmark adapter uses manual SDK frame control and exports owned arrays from inspectRenderedGeometry, including all submitted draw matrices and ranges. Final pnpm run build passed; native triangle-list construction validation passed for every material batch, and two independent generation passes matched exactly. Scene has 59 material batches and 149448 authored triangles. No application servers or browser processes were launched by the author; recorder command supervision stopped descendants. Previews 2 and 3 completed successfully in all three supplied views; preview 1 retained the camera-component lookup error. Final post-preview fixes clamp texture bytes, correct lawn winding, restrict grass patches to the garden, lower/reposition the car, and inset the rear lamps. All three preview requests were used, so these last corrections were source-validated and built but not visually previewed. Limitations: foliage and distant hills are stylized procedural forms, the car is a generic authored hatchback rather than a licensed vehicle model, and this scene approximates the reference rather than providing photorealistic detail.
```

