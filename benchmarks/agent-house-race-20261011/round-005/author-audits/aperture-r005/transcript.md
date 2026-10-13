# Public operational transcript

Lane `aperture-r005` (aperture). Raw wall time 1346.509s; preview waiting 135.763s; active budget time 1210.745s.

26 commands, 2 unsuccessful exits, 0 identical-command retries after failure.

This contains public tool operations only. Exact binary stdout/stderr survives beside each command record; text below decodes UTF-8 with non-UTF-8 bytes escaped and makes no inference about private model reasoning.

## Command 1b0346c126f74f0187cfd885a6d59ce8

2026-10-13T00:48:30.820291+00:00 → 2026-10-13T00:48:30.987717+00:00; exit 0; duration 0.167s.

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

Infrastructure may use a frozen common capacity policy. Operational reserves are conditional estimates, not quotas or lower scene limits. Actual byte sizes and free space are checked before author start and every native request. Only exact registered completed Chromium caches may retire after observed shutdown; original lifecycle receipts remain preserved. Maintenance runs outside measured frames, and verified preview waiting retains equal credit. Capacity incidents preserve original requests/counts; there are no automatic retries or budget resets.

Isolation and operational transcript rules: You start with no inherited chat. Do not contact other agents, use collaboration tools, inspect other workspaces, history, root repository, benchmark results, private provider/session data, or environment credentials. All searches, reads, shell commands and edits MUST run through the exact recorder command below. It invokes your command inside your assigned container at /work. Do not call apply_patch or unrecorded host exec commands. Use ordinary Python/Node/heredocs inside that recorded command to edit files. You can inspect the supplied image and returned preview PNGs with view_image; log each image inspection with recorder note. Do not dump the process environment or access secrets. Tools are routed cooperatively; the command container enforces filesystem separation. No browser launches, dev servers left running, Playwright installs, sandbox/flag changes or alternate rendering routes. Preview is the available browser tool.

The only host command entrypoint is:
`python3 -B /workspace/aperture/tools/agent-benchmark/author-lane.py aperture-r005 ACTION [TEXT]`
Actions: start; note PUBLIC_TEXT; exec SHELL_SCRIPT; preview; feedback PREVIEW_NUMBER; finish. Quote each shell script as one argument. This records the exact script, stdout, stderr, timestamps and exit status. A command process group is stopped at command end, so a background server cannot persist between commands. You should use functions.exec -> tools.exec_command only with this entrypoint (including no extra shell operations). Capture all failures and retries. The prompt/reference hashes and source hashes are recorded. These are visible operational records, never private reasoning.

Reference image for view_image: /workspace/aperture/.aperture-env/agent-house-race/lanes/round-005/aperture/public/reference.png
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

## Public note — 2026-10-13T00:48:35.662587+00:00

```
Inspecting the supplied reference image for composition and material details.
```

## Command 8b4a2809b6074ffb80699240d32697e1

2026-10-13T00:48:44.682338+00:00 → 2026-10-13T00:48:44.849679+00:00; exit 0; duration 0.167s.

Command:

```sh
pwd; rg --files /work /sdk/docs /sdk/docs-site-src | head -100; cat /work/package.json 2>/dev/null
```

Stdout:

```text
/work
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

## Command b7e7f41c147d4d3989b68fdb90152a16

2026-10-13T00:48:50.152215+00:00 → 2026-10-13T00:48:50.268808+00:00; exit 0; duration 0.117s.

Command:

```sh
find /work -maxdepth 2 -type f | head -30; find /sdk/docs /sdk/docs-site-src -maxdepth 3 -type f | head -80; find /sdk/source -maxdepth 2 -type d | head -50
```

Stdout:

```text
/work/src/main.js
/work/pnpm-lock.yaml
/work/.npmrc
/work/node_modules/.modules.yaml
/work/node_modules/.pnpm-workspace-state.json
/work/package.json
/work/index.html
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
/sdk/docs-site-src/components/ShowcaseCards.tsx
/sdk/docs-site-src/components/ApiPackageList.tsx
/sdk/docs-site-src/components/ReferenceSearch.tsx
/sdk/docs-site-src/components/ExampleGallery.tsx
/sdk/docs-site-src/systems/daynight.system.ts
/sdk/docs-site-src/systems/setup.system.ts
/sdk/docs-site-src/layouts/DocsLayout.astro
/sdk/docs-site-src/styles/docs.css
/sdk/docs-site-src/content/api.generated.json
/sdk/docs-site-src/content/examples.generated.json
/sdk/docs-site-src/content/docs.ts
/sdk/docs-site-src/content/showcases.ts
/sdk/docs-site-src/lib/city-layout.ts
/sdk/docs-site-src/lib/hero-story.ts
/sdk/docs-site-src/lib/hero-layout.ts
/sdk/docs-site-src/pages/index.astro
/sdk/docs-site-src/pages/about/index.astro
/sdk/docs-site-src/pages/showcases/index.astro
/sdk/docs-site-src/pages/examples/index.astro
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
/sdk/source/vite-plugin/src
/sdk/source/vite-plugin/dist
```

Stderr:

```text

```

## Command 4deeff6aa7b54298941cec386727e99d

2026-10-13T00:48:54.354705+00:00 → 2026-10-13T00:48:54.472819+00:00; exit 0; duration 0.118s.

Command:

```sh
cat /work/src/main.js; cat /sdk/docs/AGENT_AUTHORING_BASELINE.md; cat /sdk/docs/BROWSER_FRAME_CONTROL.md; cat /sdk/docs/RENDERED_GEOMETRY_INSPECTION.md
```

Stdout:

````text
// Build the assigned scene and register the benchmark adapter here.
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

Reusing cached material, queued mesh, render-bundle or static shadow resources
also refreshes their exact prepared mesh/material dependencies. A static scene
keeps its receipts available across long runs without uploading the same geometry
again. Entries that stop being used still expire after 120 render invocations;
reactivation prepares current assets if the prior dependency was retired or
replaced. This lifecycle also applies with inspection disabled. Logical cache
eviction is distinct from native buffer destruction: the app owns its GPU
allocations and releases them during replacement retirement or disposal.

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
````

Stderr:

```text

```

## Command 79075248880b4624b5cc6094ceb33fb0

2026-10-13T00:48:58.214012+00:00 → 2026-10-13T00:48:58.330818+00:00; exit 0; duration 0.117s.

Command:

```sh
cat /sdk/docs/AUTHORING.md; cat /sdk/docs/VISUAL_QUALITY.md; cat /sdk/docs-site-src/systems/setup.system.ts; cat /sdk/source/app/package.json
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

For direct CPU extraction, `createApertureHeadlessRunner` accepts already
imported modules in its `systems` option: `systems: [sceneModule]`, or
`systems: [{ default: SceneSystem }]` for a default-imported class. File patterns
in `config.systems` are discovered by the host. Set scheduling priority in
`createSystem({ priority: 0 })`. Await `disposeApertureApp(runner.app)` from
`@aperture-engine/app/advanced` in a `finally` block to release systems and
features; report its returned cleanup errors without masking an earlier failure.
See the complete [CPU extraction and cleanup recipe](./AI_TOOLING.md#direct-cpu-extraction-from-an-imported-system).

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

For repeated parts with the same geometry and appearance, publish one mesh and
register one material, then pass both handles to each spawn:

```ts
import {
  createBoxMeshAsset,
  createStandardMaterialAsset,
} from "@aperture-engine/render";
import { createMaterialHandle } from "@aperture-engine/simulation";

const meshHandle = this.meshes.publish(
  "shared.part",
  createBoxMeshAsset(),
).handle;
const materialHandle = createMaterialHandle("shared.part.material");
this.assetsRegistry.register(materialHandle);
this.assetsRegistry.markReady(
  materialHandle,
  createStandardMaterialAsset({ metallicFactor: 0, roughnessFactor: 1 }),
);
for (let index = 0; index < 10; index += 1) {
  this.spawn.mesh({
    key: `part.${index}`,
    mesh: meshHandle,
    material: materialHandle,
    transform: { translation: [index * 2, 0.5, 0] },
    castShadow: true,
    receiveShadow: true,
  });
}
```

Run this setup once in your system's `init()`. Reusing a descriptor object is
different from sharing a registered asset handle. Shared handles let the renderer
reuse compatible geometry and material resources; actual batching also depends
on the draw's render state and pass. To change every part's material together,
use `this.materials.set(materialHandle, patch)` and inspect its returned result.

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

- `positions`: required array of `[x, y, z]` tuples or packed xyz
  `Float32Array`, at least three vertices
- `indices`: optional number array, `Uint16Array` or `Uint32Array`; zero-based
  integers referencing source positions. Without indices, positions are consumed
  in triples. The triangle corner count must be a positive multiple of three
- `normals`: optional `[nx, ny, nz]` tuples or packed xyz `Float32Array`,
  exactly one per source position.
  Nonzero explicit normals are normalized and preserve the authored vertex/index
  layout. Omit normals for flat shading: the factory expands each face's three
  corners and computes its own normal, so shared positions keep crisp edges
- `uvs`: optional `[u, v]` tuples or packed uv `Float32Array`, exactly one per
  source position, remapped when flat faces expand. Missing UVs are `[0, 0]`;
  this helper does not unwrap a mesh
- `tangents`: optional `[tx, ty, tz, handedness]` tuples or packed xyzw
  `Float32Array`, exactly one per source position. Requires explicit normals.
  The direction must be nonzero and nonparallel to its normal; it is normalized
  and orthogonalized. Handedness must be exactly `1` or `-1`. Output owns a
  separate `float32x4` tangent stream for normal-mapped materials
- `label`: optional string, default `"TriangleList"`

To share indexed vertices with authored smooth normals, a ramp surface can use
`positions: [[0,0,0], [2,1,0], [2,1,-1], [0,0,-1]]`,
`indices: [0,1,2, 0,2,3]` and four `[-1,2,0]` normals. Explicit normals are
not generated, welded or crease-angle averaged. Winding is unchanged even if
supplied normals face another direction. For two-sided surfaces, author both
sides or choose an appropriate material render state.

Every coordinate, normal, UV and tangent must be finite after conversion to float32.
Faces with zero-area after this conversion (including repeated indices or
positions that round together) are rejected with their triangle number and
source range. Normals must remain nonzero, all attribute counts must match, and
bounds must fit finite float32 storage. Invalid app inputs throw
`aperture.spawn.invalidTriangleListMesh` with `detail.path` and a suggested fix;
validation completes before mesh asset publication. Correct the input and retry
the same entity key; the failed attempt does not retain a partial mesh entity.

The resulting asset owns its buffers and bounds; later input mutation cannot
change it. Like other descriptors, `mesh.triangleList` shallow-copies its options
and reads nested arrays when spawned. Packed arrays honor their view offsets and
must contain complete coordinate tuples. Without tangents, output retains the
existing single interleaved position/normal/UV stream. Flat output is non-indexed. Explicit-normal
indexed output uses `uint16` up to maximum referenced index 65535 and `uint32`
above that, regardless of the input array type. Bounds use stored float32
positions; unused source positions are discarded during flat expansion, but
retained and included in bounds when explicit normals preserve the source layout.
There is one submesh and one material slot; use separate keyed entities for
multi-material parts or the lower-level `MeshAsset` schema for custom layouts.

For static geometry that needs an affine transform baked into its vertex data,
use `bakeMeshAssetTransform` from `@aperture-engine/render`. Check `valid`,
`mesh` and `diagnostics` before publishing the result with `this.meshes.publish`.
The helper owns its output, recomputes bounds, transforms normals with the inverse
transpose, orthogonalizes tangents, and corrects winding and tangent handedness
for mirrors. It accepts static triangle lists with float32 position, normal and
tangent attributes; singular/projective transforms and deformation data fail
with a field path. See the [supported layouts and bake/merge recipe](../packages/render/README.md#static-mesh-assembly).

Compatible baked assets can feed the existing `mergeMeshAssetsForBatch` helper.
Merging preserves submesh ranges and material slots; it does not by itself
promise a single draw call. Keep independently moving parts as ECS entities with
shared handles and transforms. Bake static parts only when that representation
matches how you intend to edit and render them.

`TriangleListMeshDescriptorOptions` is exported from
`@aperture-engine/app/systems`. Lower-level consumers can import
`createTriangleListMeshAsset`, `TriangleListMeshOptions`, `TriangleListPosition`,
`TriangleListNormal`, `TriangleListUv`, `TriangleListTangent`, and `TriangleListMeshError` from
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
  componentIds: [
    "aperture.metadata.name",
    "aperture.render.mesh",
    "aperture.transform.local",
  ],
  source: { assetId: "robot", gltfNodeIndex: 0 }
}
```

Tools should use `{ index, generation }` for follow-up operations and rerun
entity lookup when a generation-mismatch diagnostic says the reference is
stale.

Component selectors use the exact ids in `componentIds`, not TypeScript import
labels. For example, `Camera.id` is `"aperture.render.camera"`, rather than
`"Camera"`. Inspect `ecs_get_component_schema.mutation.writableFields` before
editing a component through tooling.

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
- `roughness` defaults to `1` (roughest surface, with specular response retained).
  Most surfaces read best
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

## Geometry and rendering cost

Choose tessellation for the object's projected size and silhouette, then inspect
the scene from several views. Curved primitives expose segment counts; lowering
those counts is useful when extra vertices do not improve the visible shape.
For custom smooth surfaces, provide explicit normals and indices to
`mesh.triangleList` so shared vertices remain indexed. Keep separate vertices
where a UV seam, tangent handedness or hard edge requires a different attribute.

Repeated parts can share explicit mesh and material handles while retaining
independent ECS transforms. See [asset reuse](./AUTHORING.md#primitive-and-glb-spawning)
and [static assembly](../packages/render/README.md#static-mesh-assembly).
Static mesh merging retains material and submesh ranges, so inspect the submitted
draws rather than assuming one merged asset means one draw call.

Measure frame time together with submitted triangles, draw calls and render
passes. A low draw count can still carry expensive geometry, fragment shading,
shadow maps and post effects. Add bloom, SSAO, normal maps or extra shadow detail
when their visible contribution justifies the measured cost. Compare the same
camera, backing resolution and effects when investigating a performance change;
software WebGPU results describe that runtime and workload.

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
import {
  AppEntityKey,
  LocalTransform,
  ScreenSpaceFraming,
  WorldTransform,
  createScreenSpaceFraming,
  createSystem,
  material,
  mesh,
  quatFromEulerYXZ,
} from "@aperture-engine/app/systems";
import {
  CAMERA_FOV_Y_DEGREES,
  CAMERA_PITCH,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  CITY_COMPOSITION_BOUNDS,
  CITY_HALF_EXTENT,
  CITY_YAW,
  TILES,
  cameraOffset,
  tileCastsShadow,
} from "../lib/city-layout.js";

const SHADOW_MAP_SIZE = 2048;
const MOBILE_SHADOW_MAP_SIZE = 1024;
const SHADOW_ORTHOGRAPHIC_SIZE = CITY_HALF_EXTENT * 2 * Math.SQRT2 * 0.5 + 3;
// Height of the street-lamp spot lights above their tile (≈ the lamp heads).
const LAMP_HEIGHT = 0.48;
const LAMP_SIDE_OFFSET = 0.3;
const LAMP_LOOK_AT_Y = 0;
const LAMP_RANGE = 4.5;
const LAMP_INNER_CONE = Math.PI / 7;
const LAMP_OUTER_CONE = Math.PI / 3;
const LIGHT_MARKER_RADIUS = 0.04;
const CITY_TRUCK_ASSET_ID = "vehicle-truck-red";
const CITY_TRUCK_WORLD_POSITION = [
  1.7677669529663689, -0.02, -0.3535533905932736,
] as const;
const CITY_TRUCK_SCALE = 1 / 6;
const CITY_TRUCK_WORLD_YAW = (3 * Math.PI) / 4;
const CITY_FOOD_STALL_ASSET_ID = "stall-food";
// Centered over authored tile { id: "road-straight", x: 0, z: 1, orientation: 0 }.
const CITY_FOOD_STALL_WORLD_POSITION = [
  0.7071067811865475, 0.05, 2.1213203435596424,
] as const;
const CITY_FOOD_STALL_SCALE = 0.425;
const CITY_FOOD_STALL_WORLD_YAW = CITY_YAW + Math.PI + Math.PI / 2;
const CITY_FOOD_STALL_OPENING_GLOW_SIZE = [0.18, 0.18] as const;
const CITY_FOOD_STALL_OPENING_LOCAL_POSITION = [0, 0.15, 0.285] as const;
const CITY_FOOD_STALL_AREA_LIGHT_LOCAL_POSITION = [0, 0.32, -0.32] as const;
const CITY_FOOD_STALL_AREA_LIGHT_TARGET = [
  0.7071067811865475, 0.16, 0.7071067811865476,
] as const;
const CITY_FOOD_STALL_AREA_LIGHT_WIDTH = 0.32;
const CITY_FOOD_STALL_AREA_LIGHT_HEIGHT = 0.2;
const CITY_FOOD_STALL_AREA_LIGHT_INTENSITY = 20;
const HEADLIGHT_LOCAL_POSITIONS = [
  [-0.42, 0.55, 1.24],
  [0.42, 0.55, 1.24],
] as const;
const HEADLIGHT_LOOK_AHEAD = 1.8;
const HEADLIGHT_INTENSITY = 10;
const HEADLIGHT_RANGE = 2.2;
const HEADLIGHT_INNER_CONE = Math.PI / 12;
const HEADLIGHT_OUTER_CONE = Math.PI / 5;
const HEADLIGHT_MARKER_RADIUS = 0.025;
const CITY_FRAMING_BOUNDS_INSET_MAX = [0, 3, 0] as const;
const SHOW_FRAMING_DEBUG_AABB = false;
const WINDOW_SIZE = [0.1, 0.2] as const;
const WINDOW_WALL_OFFSET = 0.41;
const WINDOW_COLUMNS = {
  left: -0.19,
  right: 0.19,
} as const;
const WINDOW_FLOORS = {
  second: 0.62,
  third: 1.02,
  fourth: 1.42,
} as const;
type LandingCityTile = (typeof TILES)[number];
type Vec3 = readonly [number, number, number];
type WindowColumn = keyof typeof WINDOW_COLUMNS;
type WindowFloor = keyof typeof WINDOW_FLOORS;
type WindowSlot = readonly [WindowColumn, WindowFloor];

const BUILDING_WINDOW_PATTERNS: Record<string, readonly WindowSlot[]> = {
  "building-small-a": [["right", "second"]],
  "building-small-b": [
    ["left", "second"],
    ["right", "third"],
  ],
  "building-small-c": [
    ["right", "second"],
    ["left", "third"],
    ["right", "fourth"],
  ],
  "building-small-d": [["left", "second"]],
};
const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

// Tile orientation (quarter-turns) plus the whole-town CITY_YAW rotation.
function tileRotation(r: number) {
  return quatFromEulerYXZ(0, (r * Math.PI) / 2 + CITY_YAW, 0);
}

function tileYaw(tile: LandingCityTile): number {
  return (tile.orientation * Math.PI) / 2 + CITY_YAW;
}

function tileLocalToWorld(
  tile: LandingCityTile,
  localX: number,
  localY: number,
  localZ: number,
) {
  const yaw = tileYaw(tile);
  return [
    tile.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    localY,
    tile.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  ] as const;
}

function lampPosition(tile: LandingCityTile, side: -1 | 1) {
  return tileLocalToWorld(tile, side * LAMP_SIDE_OFFSET, LAMP_HEIGHT, 0);
}

function lampLookAt(tile: LandingCityTile, side: -1 | 1) {
  const position = lampPosition(tile, side);
  return [position[0], LAMP_LOOK_AT_Y, position[2]] as const;
}

function cityTruckRotation() {
  return quatFromEulerYXZ(0, CITY_TRUCK_WORLD_YAW, 0);
}

function cityFoodStallRotation() {
  return quatFromEulerYXZ(0, CITY_FOOD_STALL_WORLD_YAW, 0);
}

function cityFoodStallOpeningRotation() {
  return quatFromEulerYXZ(0, CITY_FOOD_STALL_WORLD_YAW + Math.PI, 0);
}

function cityFoodStallLocalToWorld(
  localX: number,
  localY: number,
  localZ: number,
) {
  const root = CITY_FOOD_STALL_WORLD_POSITION;
  const yaw = CITY_FOOD_STALL_WORLD_YAW;
  return [
    root[0] + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    root[1] + localY,
    root[2] - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  ] as const;
}

function cityTruckLocalToWorld(localX: number, localY: number, localZ: number) {
  const root = CITY_TRUCK_WORLD_POSITION;
  const yaw = CITY_TRUCK_WORLD_YAW;
  const x = localX * CITY_TRUCK_SCALE;
  const y = localY * CITY_TRUCK_SCALE;
  const z = localZ * CITY_TRUCK_SCALE;
  return [
    root[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    root[1] + y,
    root[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
  ] as const;
}

function tileHasWindows(tile: LandingCityTile): boolean {
  return windowPattern(tile).length > 0;
}

function windowPattern(tile: LandingCityTile): readonly WindowSlot[] {
  return BUILDING_WINDOW_PATTERNS[tile.id] ?? [];
}

function windowPosition(tile: LandingCityTile, localX: number, localY: number) {
  return tileLocalToWorld(tile, localX, localY, WINDOW_WALL_OFFSET);
}

function windowRotation(tile: LandingCityTile) {
  const yaw = (tile.orientation * Math.PI) / 2 + CITY_YAW;
  return quatFromEulerYXZ(0, yaw, 0);
}

function cityFramingDebugBounds() {
  const { min, max } = CITY_COMPOSITION_BOUNDS;
  return {
    min,
    max: [
      max[0] - CITY_FRAMING_BOUNDS_INSET_MAX[0],
      max[1] - CITY_FRAMING_BOUNDS_INSET_MAX[1],
      max[2] - CITY_FRAMING_BOUNDS_INSET_MAX[2],
    ] as const,
  };
}

function framingDebugLinePositions(): readonly Vec3[] {
  const { min, max } = cityFramingDebugBounds();
  const nnn = [min[0], min[1], min[2]] as const;
  const xnn = [max[0], min[1], min[2]] as const;
  const xxn = [max[0], max[1], min[2]] as const;
  const nxn = [min[0], max[1], min[2]] as const;
  const nnz = [min[0], min[1], max[2]] as const;
  const xnz = [max[0], min[1], max[2]] as const;
  const xxz = [max[0], max[1], max[2]] as const;
  const nxz = [min[0], max[1], max[2]] as const;

  return [
    nnn,
    xnn,
    xnn,
    xnz,
    xnz,
    nnz,
    nnz,
    nnn,
    nxn,
    xxn,
    xxn,
    xxz,
    xxz,
    nxz,
    nxz,
    nxn,
    nnn,
    nxn,
    xnn,
    xxn,
    xnz,
    xxz,
    nnz,
    nxz,
  ];
}

// Builds the authored landing town once at startup: a fixed isometric camera, the
// sun + ambient (animated by daynight.system), every Kenney tile from the
// authored city, and warm spot lights over each street-lamp tile (lit in the
// evening by daynight.system).
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    const renderProfile = this.startOptions.string("apertureRenderProfile");
    const shadowMapSize =
      renderProfile === "mobile" ? MOBILE_SHADOW_MAP_SIZE : SHADOW_MAP_SIZE;
    const citySubject = this.createEntity();
    citySubject.addComponent(AppEntityKey, {
      value: "landing-city.subject",
    });
    citySubject.addComponent(LocalTransform);
    citySubject.addComponent(WorldTransform);

    const cameraFocus = [0, 0, 0] as const;
    const cameraRigOffset = cameraOffset(CAMERA_START_YAW, CAMERA_ZOOM);
    const camera = this.spawn.camera({
      key: "camera.main",
      name: "Landing Camera",
      transform: {
        translation: [
          cameraFocus[0] + cameraRigOffset[0],
          cameraFocus[1] + cameraRigOffset[1],
          cameraFocus[2] + cameraRigOffset[2],
        ],
        lookAt: cameraFocus,
      },
      fovYDegrees: CAMERA_FOV_Y_DEGREES,
      camera: { clearColor: [0.28, 0.46, 0.82, 1] },
    });
    camera.addComponent(
      ScreenSpaceFraming,
      createScreenSpaceFraming({
        subject: citySubject,
        slot: "landing-city",
        yawRadians: CAMERA_START_YAW,
        pitchRadians: CAMERA_PITCH,
        boundsMin: CITY_COMPOSITION_BOUNDS.min,
        boundsMax: CITY_COMPOSITION_BOUNDS.max,
        boundsInsetMax: CITY_FRAMING_BOUNDS_INSET_MAX,
        paddingPx: 0,
        minDistance: 4,
        maxDistance: 80,
        smoothingRate: 5.5,
      }),
    );

    // Sun + ambient: initial values for the opening (midday) phase; the
    // DayNightSystem drives color/intensity/angle every frame thereafter.
    this.spawn.light({
      key: "light.sun",
      name: "Sun",
      kind: "directional",
      illuminance: 3.6,
      shadow: {
        enabled: true,
        mapSize: shadowMapSize,
        bias: 0.00035,
        normalBias: 0.018,
        slopeBias: 1.0,
        strength: 0.86,
        filterRadius: 1.2,
        center: [0, 0, 0],
        orthographicSize: SHADOW_ORTHOGRAPHIC_SIZE,
        near: 1,
        far: 90,
        lightDistance: 45,
      },
      transform: { rotationEulerDegrees: [-72, -83, 0] },
    });

    this.spawn.light({
      key: "light.ambient",
      name: "Ambient",
      kind: "ambient",
      color: [0.66, 0.74, 0.86, 1],
      intensity: 1.5,
    });

    if (SHOW_FRAMING_DEBUG_AABB) {
      this.spawn.mesh({
        key: "debug.framing.aabb.lines",
        name: "Screen-Space Framing AABB",
        tags: ["debug", "framing-aabb"],
        mesh: mesh.lineList({
          label: "Screen-Space Framing AABB Lines",
          positions: framingDebugLinePositions(),
        }),
        material: material.unlit({
          label: "Framing AABB Debug Lines",
          baseColor: [0.06, 1, 1, 1],
          renderState: {
            depth: { test: false, write: false, compare: "always" },
          },
        }),
        castShadow: false,
        receiveShadow: false,
      });
    }

    // The authored city: every tile placed at (x, 0, z) with its quarter-turn.
    let windowIndex = 0;
    for (const tile of TILES) {
      this.spawn.gltf(this.assets.gltf(tile.id), {
        name: tile.id,
        tags: ["tile"],
        castShadow: tileCastsShadow(tile.id),
        receiveShadow: true,
        transform: {
          translation: [tile.x, 0, tile.z],
          rotation: tileRotation(tile.orientation),
        },
      });
      if (tileHasWindows(tile)) {
        for (const [column, floor] of windowPattern(tile)) {
          this.spawn.mesh({
            key: `window.glow.${windowIndex}`,
            name: "Glowing Window",
            tags: ["night-window"],
            mesh: mesh.plane({ size: WINDOW_SIZE }),
            material: material.standard({
              label: "Night Window Glow",
              baseColor: [1, 0.78, 0.32, 1],
              emissiveFactor: [3.8, 2.2, 0.5],
              roughness: 0.35,
              metallic: 0,
            }),
            castShadow: false,
            receiveShadow: false,
            transform: {
              translation: windowPosition(
                tile,
                WINDOW_COLUMNS[column],
                WINDOW_FLOORS[floor],
              ),
              rotation: windowRotation(tile),
            },
          });
          windowIndex += 1;
        }
      }
    }
    this.spawn.gltf(this.assets.gltf(CITY_TRUCK_ASSET_ID), {
      key: "prop.garage-truck",
      name: "Garage Truck",
      tags: ["prop", "vehicle", "garage-truck"],
      materials: GLTF_FRONT_SIDE_MATERIALS,
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: CITY_TRUCK_WORLD_POSITION,
        rotation: cityTruckRotation(),
        scale: [CITY_TRUCK_SCALE, CITY_TRUCK_SCALE, CITY_TRUCK_SCALE],
      },
    });
    this.spawn.gltf(this.assets.gltf(CITY_FOOD_STALL_ASSET_ID), {
      key: "prop.food-stall",
      name: "Food Stall",
      tags: ["prop", "stall", "food-stall"],
      materials: GLTF_FRONT_SIDE_MATERIALS,
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: cityFoodStallLocalToWorld(0, 0, 0.5),
        rotation: cityFoodStallRotation(),
        scale: [
          CITY_FOOD_STALL_SCALE,
          CITY_FOOD_STALL_SCALE,
          CITY_FOOD_STALL_SCALE,
        ],
      },
    });
    this.spawn.mesh({
      key: "window.glow.food-stall.opening",
      name: "Food Stall Opening Glow",
      tags: ["night-window", "food-stall"],
      mesh: mesh.plane({ size: CITY_FOOD_STALL_OPENING_GLOW_SIZE }),
      material: material.standard({
        label: "Food Stall Opening Glow",
        baseColor: [1, 0.78, 0.32, 1],
        emissiveFactor: [3.8, 2.2, 0.5],
        roughness: 0.35,
        metallic: 0,
      }),
      castShadow: false,
      receiveShadow: false,
      transform: {
        translation: cityFoodStallLocalToWorld(
          CITY_FOOD_STALL_OPENING_LOCAL_POSITION[0],
          CITY_FOOD_STALL_OPENING_LOCAL_POSITION[1],
          CITY_FOOD_STALL_OPENING_LOCAL_POSITION[2],
        ),
        rotation: cityFoodStallOpeningRotation(),
      },
    });
    this.spawn.light({
      key: "light.food-stall.opening.area",
      name: "Food Stall Opening Area Light",
      tags: ["food-stall", "stall-light"],
      kind: "rect-area",
      color: [1, 0.78, 0.42, 1],
      intensity: CITY_FOOD_STALL_AREA_LIGHT_INTENSITY,
      transform: {
        translation: cityFoodStallLocalToWorld(
          CITY_FOOD_STALL_AREA_LIGHT_LOCAL_POSITION[0],
          CITY_FOOD_STALL_AREA_LIGHT_LOCAL_POSITION[1],
          CITY_FOOD_STALL_AREA_LIGHT_LOCAL_POSITION[2],
        ),
        lookAt: CITY_FOOD_STALL_AREA_LIGHT_TARGET,
      },
      light: {
        shape: "rect",
        width: CITY_FOOD_STALL_AREA_LIGHT_WIDTH,
        height: CITY_FOOD_STALL_AREA_LIGHT_HEIGHT,
      },
    });
    HEADLIGHT_LOCAL_POSITIONS.forEach(([localX, localY, localZ], index) => {
      const markerPosition = cityTruckLocalToWorld(localX, localY, localZ);
      this.spawn.light({
        key: `light.garage-truck.headlight.${index}`,
        name: "Garage Truck Headlight",
        tags: ["headlight", "garage-truck-headlight"],
        kind: "spot",
        color: [1, 0.88, 0.62, 1],
        intensity: HEADLIGHT_INTENSITY,
        transform: {
          translation: markerPosition,
          lookAt: cityTruckLocalToWorld(
            localX,
            localY,
            localZ + HEADLIGHT_LOOK_AHEAD,
          ),
        },
        light: {
          range: HEADLIGHT_RANGE,
          innerConeAngle: HEADLIGHT_INNER_CONE,
          outerConeAngle: HEADLIGHT_OUTER_CONE,
        },
      });
      this.spawn.mesh({
        key: `debug.garage-truck.headlight.sphere.${index}`,
        name: "Garage Truck Headlight Debug Sphere",
        tags: ["debug", "headlight-marker", "garage-truck-headlight"],
        mesh: mesh.sphere({ radius: HEADLIGHT_MARKER_RADIUS, segments: 12 }),
        material: material.standard({
          label: "Garage Truck Headlight Debug Marker",
          baseColor: [1, 0.88, 0.62, 1],
          emissiveFactor: [4.5, 3.2, 1.1],
          roughness: 0.2,
          metallic: 0,
        }),
        castShadow: false,
        receiveShadow: false,
        transform: { translation: markerPosition },
      });
    });

    // A warm downward spot light over each street-lamp tile. They start dark
    // and DayNightSystem ramps their intensity up as the sun sets.
    let lampIndex = 0;
    for (const tile of TILES) {
      if (tile.id !== "road-straight-lightposts") {
        continue;
      }
      for (const side of [-1, 1] as const) {
        const position = lampPosition(tile, side);
        this.spawn.light({
          key: `light.lamp.${lampIndex}`,
          name: "Street Lamp",
          kind: "spot",
          color: [1.0, 0.74, 0.4, 1],
          intensity: 0,
          light: {
            range: LAMP_RANGE,
            innerConeAngle: LAMP_INNER_CONE,
            outerConeAngle: LAMP_OUTER_CONE,
          },
          transform: {
            translation: position,
            lookAt: lampLookAt(tile, side),
          },
        });
        this.spawn.mesh({
          key: `debug.light.lamp.${lampIndex}`,
          name: "Street Lamp Debug Sphere",
          tags: ["debug", "light-marker"],
          mesh: mesh.sphere({ radius: LIGHT_MARKER_RADIUS, segments: 12 }),
          material: material.standard({
            label: "Street Lamp Debug Marker",
            baseColor: [1, 0.78, 0.32, 1],
            emissiveFactor: [3.2, 1.8, 0.35],
            roughness: 0.25,
            metallic: 0,
          }),
          castShadow: false,
          receiveShadow: false,
          transform: { translation: position },
        });
        lampIndex += 1;
      }
    }
  }
}
{
  "name": "@aperture-engine/app",
  "version": "0.3.0",
  "description": "Aperture metaframework app facade, config helpers, and worker-safe system authoring API.",
  "author": "Felix Zhang",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/felixtrz/aperture.git",
    "directory": "packages/app"
  },
  "homepage": "https://github.com/felixtrz/aperture/tree/main/packages/app#readme",
  "bugs": "https://github.com/felixtrz/aperture/issues",
  "keywords": [
    "aperture",
    "ecs",
    "webgpu",
    "game-engine",
    "typescript",
    "metaframework",
    "headless"
  ],
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./config": {
      "types": "./dist/config.d.ts",
      "import": "./dist/config.js"
    },
    "./systems": {
      "types": "./dist/systems.d.ts",
      "import": "./dist/systems.js"
    },
    "./advanced": {
      "types": "./dist/advanced.d.ts",
      "import": "./dist/advanced.js"
    },
    "./headless": {
      "types": "./dist/headless.d.ts",
      "import": "./dist/headless.js"
    },
    "./headless-tools": {
      "types": "./dist/headless-tools.d.ts",
      "import": "./dist/headless-tools.js"
    },
    "./input": {
      "types": "./dist/input.d.ts",
      "import": "./dist/input.js"
    },
    "./entity-lookup": {
      "types": "./dist/entity-lookup.d.ts",
      "import": "./dist/entity-lookup.js"
    },
    "./commands": {
      "types": "./dist/commands.d.ts",
      "import": "./dist/commands.js"
    },
    "./diagnostics": {
      "types": "./dist/diagnostics.d.ts",
      "import": "./dist/diagnostics.js"
    },
    "./features": {
      "types": "./dist/features.d.ts",
      "import": "./dist/features.js"
    },
    "./asset-mirror": {
      "types": "./dist/asset-mirror.d.ts",
      "import": "./dist/asset-mirror.js"
    },
    "./vite": {
      "types": "./dist/vite.d.ts",
      "import": "./dist/vite.js"
    },
    "./browser": {
      "types": "./dist/browser.d.ts",
      "import": "./dist/browser.js"
    },
    "./worker": {
      "types": "./dist/worker.d.ts",
      "import": "./dist/worker.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@aperture-engine/audio": "workspace:^",
    "@aperture-engine/particles": "workspace:^",
    "@aperture-engine/physics": "workspace:^",
    "@aperture-engine/physics-rapier": "workspace:^",
    "@aperture-engine/render": "workspace:^",
    "@aperture-engine/runtime": "workspace:^",
    "@aperture-engine/simulation": "workspace:^",
    "@aperture-engine/vite-plugin": "workspace:^",
    "@aperture-engine/webgpu": "workspace:^",
    "@preact/signals-core": "^1.8.0",
    "elics": "^3.4.2"
  }
}
````

Stderr:

```text

```

## Command 286349b7aeb14bb3809f4121e6ef2f41

2026-10-13T00:49:10.418133+00:00 → 2026-10-13T00:49:10.539931+00:00; exit 0; duration 0.122s.

Command:

```sh
sed -n "1,220p" /sdk/docs/VISUAL_QUALITY.md; sed -n "1,180p" /sdk/source/app/src/worker.ts; sed -n "1,180p" /sdk/source/app/src/config.ts; grep -n "environment\|toneMapping\|exposure\|startGeneratedSimulationWorker" /sdk/source/app/src/config.ts /sdk/source/app/src/worker.ts /sdk/source/app/src/browser.ts
```

Stdout:

````text
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
- `roughness` defaults to `1` (roughest surface, with specular response retained).
  Most surfaces read best
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

## Geometry and rendering cost

Choose tessellation for the object's projected size and silhouette, then inspect
the scene from several views. Curved primitives expose segment counts; lowering
those counts is useful when extra vertices do not improve the visible shape.
For custom smooth surfaces, provide explicit normals and indices to
`mesh.triangleList` so shared vertices remain indexed. Keep separate vertices
where a UV seam, tangent handedness or hard edge requires a different attribute.

Repeated parts can share explicit mesh and material handles while retaining
independent ECS transforms. See [asset reuse](./AUTHORING.md#primitive-and-glb-spawning)
and [static assembly](../packages/render/README.md#static-mesh-assembly).
Static mesh merging retains material and submesh ranges, so inspect the submitted
draws rather than assuming one merged asset means one draw call.

Measure frame time together with submitted triangles, draw calls and render
passes. A low draw count can still carry expensive geometry, fragment shading,
shadow maps and post effects. Add bloom, SSAO, normal maps or extra shadow detail
when their visible contribution justifies the measured cost. Compare the same
camera, backing resolution and effects when investigating a performance change;
software WebGPU results describe that runtime and workload.

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
export { startGeneratedSimulationWorker } from "./worker/start.js";
export type { StartGeneratedSimulationWorkerOptions } from "./worker/start.js";
export * from "./config/index.js";
/sdk/source/app/src/worker.ts:1:export { startGeneratedSimulationWorker } from "./worker/start.js";
````

Stderr:

```text

```

## Command ab489763c9ae43b5aad81db9c2e2d89e

2026-10-13T00:49:15.795709+00:00 → 2026-10-13T00:49:15.963371+00:00; exit 0; duration 0.168s.

Command:

```sh
sed -n "1,180p" /sdk/source/app/src/worker/start.ts; grep -R -n "interface StandardMaterialInputOptions\|type StandardMaterialInputOptions\|interface RenderConfig\|SpawnCameraOptions" /sdk/source/app/src | head -30; sed -n "1,160p" /sdk/source/app/src/browser/start.ts; grep -R -n "camera_look_at\|camera_edit" /sdk/source/app/src/browser | head -30; cat /work/index.html
```

Stdout:

```text
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
  port.start?.();
}

function waitForWorkerPort(
  callback: (port: SimulationMessagePort) => void,
): void {
  const workerScope = globalThis as unknown as {
    addEventListener(
      type: "message",
      listener: (event: MessageEvent<unknown>) => void,
    ): void;
  };

  workerScope.addEventListener("message", (event) => {
    const message = event.data;
    if (
      typeof message === "object" &&
      message !== null &&
      (message as { readonly type?: unknown }).type ===
        SIMULATION_WORKER_PROTOCOL.connect
    ) {
      const port =
        (message as { readonly port?: SimulationMessagePort }).port ?? null;

      if (port !== null) {
        port.start?.();
        callback(port);
      }
    }
  });
}

function isStartMessage(value: unknown): value is SimulationWorkerStartOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.start
  );
}

function startOptionsFromMessage(
  message: SimulationWorkerStartOptions,
): SimulationWorkerStartOptions {
  const nested = message.options;

  if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
    return message;
  }

  return {
    ...message,
    ...(nested as Record<string, unknown>),
  };
}
/sdk/source/app/src/systems/spawn/types.ts:74:export interface SpawnCameraOptions extends SpawnMetadata {
/sdk/source/app/src/systems/spawn/types.ts:312:export type StandardMaterialInputOptions = Omit<
/sdk/source/app/src/systems/spawn/types.ts:472:  camera(options?: SpawnCameraOptions): Entity;
/sdk/source/app/src/systems/spawn/index.ts:34:  SpawnCameraOptions,
/sdk/source/app/src/systems.ts:477:  SpawnCameraOptions,
/sdk/source/app/src/browser/control.ts:62:  readonly camera_look_at: {
<!doctype html>
<html><head><meta charset="UTF-8"><title>House scene</title></head><body style="margin:0"><script type="module" src="/src/main.js"></script></body></html>
```

Stderr:

```text
sed: can't read /sdk/source/app/src/browser/start.ts: No such file or directory
```

## Command a6043f590349430391d5b2f8b99af853

2026-10-13T00:49:21.434351+00:00 → 2026-10-13T00:49:21.601251+00:00; exit 0; duration 0.167s.

Command:

```sh
sed -n "1,180p" /sdk/source/app/src/systems/spawn/types.ts; sed -n "260,345p" /sdk/source/app/src/systems/spawn/types.ts; sed -n "1,150p" /sdk/source/app/src/browser/control.ts; find /sdk/source/app/src/browser -maxdepth 2 -type f; grep -R -n "baseColorTexture\|normalTexture\|textureTransform" /sdk/source/app/src/systems/spawn /sdk/source/render/src/materials | head -50; grep -R -n "camera_set\|camera_look_at" /sdk/source/app/src/worker/devtools | head -30
```

Stdout:

```text
import type {
  CameraInput,
  CustomWgslMaterialAsset,
  FogInput,
  LineListMeshOptions,
  LightInput,
  LightShadowSettingsInput,
  ParticleEmitterInput,
  ProceduralSkyInput,
  RuntimeUniformInput,
  SkyboxInput,
  StandardMaterialPatch,
  TorusMeshOptions,
  TriangleListMeshOptions,
  HeightfieldMeshOptions,
  LatheMeshOptions,
  ExtrudeMeshOptions,
  RoundedBoxMeshOptions,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsGravityInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { AnimationAccess } from "@aperture-engine/runtime";
import type {
  Entity,
  EnvironmentMapHandle,
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  ParticleEffectHandle,
  PrefabFieldOverride,
  PrefabHandle,
  PrefabTransformOverride,
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
  readonly layerMask?: number;
  readonly transform?: SystemTransformInput;
}

export type LightRigPresetName = "studio-neutral" | "outdoor-neutral" | "none";

export interface SpawnLightRigOptions extends SpawnMetadata {
  readonly preset: LightRigPresetName;
  readonly environmentMap?: EnvironmentAssetDescriptorInput;
  readonly shadows?: boolean | LightShadowSettingsInput;
  readonly transform?: SystemTransformInput;
  readonly environment?:
    | (Partial<Omit<SpawnEnvironmentOptions, "source">> & {
        readonly source?: EnvironmentAssetDescriptorInput;
      })
    | false;
  readonly keyLight?: Partial<SpawnLightOptions> | false;
  readonly rimLight?: Partial<SpawnLightOptions> | false;
}

export interface SpawnedLightRig {
  readonly preset: LightRigPresetName;
  readonly root: Entity;
  readonly lights: readonly Entity[];
  remove(): void;
}

export interface SpawnFogOptions extends SpawnMetadata, FogInput {
  readonly transform?: SystemTransformInput;
}

export type SkyboxTextureDescriptorInput =
  | TextureHandle
  | SystemTextureAssetHandle;
export type SkyboxSamplerDescriptorInput = SamplerHandle;

export interface SpawnSkyboxOptions
  extends SpawnMetadata, Omit<SkyboxInput, "texture" | "sampler"> {
  readonly texture: SkyboxTextureDescriptorInput;
  readonly sampler?: SkyboxSamplerDescriptorInput | null;
  readonly transform?: SystemTransformInput;
}

export interface SpawnProceduralSkyOptions
  extends SpawnMetadata, ProceduralSkyInput {
  readonly transform?: SystemTransformInput;
}

export interface SpawnRuntimeUniformOptions extends SpawnMetadata {
  /**
   * Runtime uniform key matched by custom WGSL uniform bindings. Reusing a key
   * updates the existing runtime-uniform entity instead of spawning duplicates.
   */
  readonly uniformKey: RuntimeUniformInput["key"];
  readonly values: RuntimeUniformInput["values"];
  readonly version?: RuntimeUniformInput["version"];
}

export interface BoxMeshDescriptorOptions {
  readonly size?: number | Vec3Like;
}

/** Indexed circular bevels and spherical corners, with smooth supplied normals. */
export type RoundedBoxMeshDescriptorOptions = RoundedBoxMeshOptions;

export interface SphereMeshDescriptorOptions {
  readonly radius?: number;
  readonly segments?: number;
}

      readonly kind: "shader-asset";
      readonly handle: ShaderHandle;
    }
  | {
      readonly kind: "inline-wgsl";
      readonly code: string;
      readonly virtualPath?: string;
    };

export type ShaderAssetDescriptorInput = ShaderHandle | SystemShaderAssetHandle;

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
  readonly castShadow?: boolean;
  /** Attach a `ShadowReceiver` component so this mesh receives shadows. */
  readonly receiveShadow?: boolean;
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
}) {
  let disposed = false;
  let tail = Promise.resolve();
  let queued = 0;
  let lastReport: WebGpuAppRenderReport | null = null;
  const completed = new Map<number, WebGpuAppRenderReport>();
  let active: {
    requestId: string | null;
    receivedFrame: number | null;
    expectedFrame: number | null;
    resolve(frame: GeneratedBrowserRenderedFrame): void;
    reject(error: Error): void;
  } | null = null;

  const settle = (): void => {
    if (active?.expectedFrame === null || active === null) return;
    const report = completed.get(active.expectedFrame);
    if (report === undefined) return;
    completed.delete(active.expectedFrame);
    if (report.ok)
      active.resolve({
        snapshotFrame: active.expectedFrame,
        report: decodeTypedArrayTree(
          encodeTypedArrayTree(webGpuAppRenderReportToJsonValue(report)),
        ) as WebGpuAppRenderReportJsonValue,
      });
    else
      active.reject(
        new ApertureBrowserControlError(
          "Aperture failed to render the requested frame.",
          report.diagnostics,
        ),
      );
  };

  return {
    renderFrame(
      options: GeneratedBrowserFrameOptions = {},
    ): Promise<GeneratedBrowserRenderedFrame> {
      if (!input.manual)
        return Promise.reject(
          new ApertureBrowserControlError(
            'renderFrame requires render.cadence: "manual".',
          ),
        );
      if (disposed)
        return Promise.reject(
          new ApertureBrowserControlError("Aperture browser app was disposed."),
        );
      const delta = options.deltaSeconds ?? 0;
/sdk/source/app/src/browser/control.ts
/sdk/source/app/src/browser/input.ts
/sdk/source/app/src/browser/signals.ts
/sdk/source/app/src/browser/canvas.ts
/sdk/source/app/src/browser/devtools/dispatch.ts
/sdk/source/app/src/browser/devtools/picking.ts
/sdk/source/app/src/browser/devtools/runtime.ts
/sdk/source/app/src/browser/devtools/types.ts
/sdk/source/app/src/browser/devtools/payloads.ts
/sdk/source/app/src/browser/devtools/canvas-readback.ts
/sdk/source/app/src/browser/devtools/index.ts
/sdk/source/app/src/browser/devtools/webgpu-diagnostics.ts
/sdk/source/app/src/browser/render.ts
/sdk/source/app/src/browser/html-bridge.ts
/sdk/source/app/src/browser/status.ts
/sdk/source/app/src/browser/commands.ts
/sdk/source/app/src/browser/assets.ts
/sdk/source/app/src/browser/request.ts
/sdk/source/app/src/browser/audio.ts
/sdk/source/app/src/browser/gpu-timings-route.ts
/sdk/source/app/src/browser/app.ts
/sdk/source/app/src/browser/frame-graph-route.ts
/sdk/source/app/src/browser/diagnostics.ts
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts:5:    field: "baseColorTexture",
/sdk/source/render/src/materials/standard-texture-readiness-expectations.ts:50:    field: "normalTexture",
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts:30:  "baseColorTexture",
/sdk/source/render/src/materials/standard-texture-sampler-alignment.ts:32:  "normalTexture",
/sdk/source/render/src/materials/factories.ts:54:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/factories.ts:98:    baseColorTexture: input.baseColorTexture ?? null,
/sdk/source/render/src/materials/factories.ts:126:    normalTexture: input.normalTexture ?? null,
/sdk/source/render/src/materials/types.ts:140:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/types.ts:152:  readonly baseColorTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/types.ts:182:  readonly normalTexture: MaterialTextureBinding | null;
/sdk/source/render/src/materials/standard-texture-readiness-report.ts:24:      ...(diagnostic.textureTransform === undefined
/sdk/source/render/src/materials/standard-texture-readiness-report.ts:27:            textureTransform: cloneTextureTransform(
/sdk/source/render/src/materials/standard-texture-readiness-report.ts:28:              diagnostic.textureTransform,
/sdk/source/render/src/materials/gltf-texture-result.ts:133:    case "baseColorTexture":
/sdk/source/render/src/materials/gltf-texture-result.ts:184:    case "normalTexture":
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:34:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:46:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:48:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:49:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:50:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:83:  | "normalTexture"
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:91:    normalTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:93:      slot: "normalTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:94:      field: "normalTexture",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:95:      value: input.material.normalTexture,
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:101:      field: "normalTexture.scale",
/sdk/source/render/src/materials/gltf-material-standard-fields.ts:102:      value: recordField(input.material, "normalTexture")?.scale,
/sdk/source/render/src/materials/unlit-packing.ts:29:  readonly baseColorTextureKey: string | null;
/sdk/source/render/src/materials/unlit-packing.ts:64:    material.baseColorTexture,
/sdk/source/render/src/materials/unlit-packing.ts:90:    return { baseColorTextureKey: null, baseColorSamplerKey: null };
/sdk/source/render/src/materials/unlit-packing.ts:96:      field: "baseColorTexture.texture",
/sdk/source/render/src/materials/unlit-packing.ts:104:      field: "baseColorTexture.sampler",
/sdk/source/render/src/materials/unlit-packing.ts:110:    baseColorTextureKey:
/sdk/source/render/src/materials/standard-texture-readiness-inspection.ts:101:      textureTransform: cloneTextureTransform(input.binding.transform),
/sdk/source/render/src/materials/standard-sampler-fidelity-inspection.ts:19:  "baseColorTexture",
/sdk/source/render/src/materials/standard-sampler-fidelity-inspection.ts:28:  "normalTexture",
/sdk/source/render/src/materials/standard-proof-point.ts:5:  | "baseColorTexture"
/sdk/source/render/src/materials/standard-proof-point.ts:24:  | "normalTexture"
/sdk/source/render/src/materials/standard-proof-point.ts:42:    "baseColorTexture",
/sdk/source/render/src/materials/standard-proof-point.ts:61:    "normalTexture",
/sdk/source/render/src/materials/gltf-material-types.ts:8:  | "baseColorTexture"
/sdk/source/render/src/materials/gltf-material-types.ts:17:  | "normalTexture"
/sdk/source/render/src/materials/gltf-material-builders.ts:51:    baseColorTexture: mapTextureBinding({
/sdk/source/render/src/materials/gltf-material-builders.ts:53:      slot: "baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:54:      field: "pbrMetallicRoughness.baseColorTexture",
/sdk/source/render/src/materials/gltf-material-builders.ts:55:      value: input.pbrSource.baseColorTexture,
/sdk/source/render/src/materials/gltf-material-utils.ts:99:    (slot === "baseColorTexture" ||
/sdk/source/render/src/materials/gltf-material-utils.ts:102:      slot === "normalTexture" ||
/sdk/source/render/src/materials/standard-texture-readiness-types.ts:15:  | "baseColorTexture"
/sdk/source/render/src/materials/standard-texture-readiness-types.ts:24:  | "normalTexture"
```

Stderr:

```text

```

## Command 38d85a7d3e084383befd7d156b5a72aa

2026-10-13T00:49:28.062153+00:00 → 2026-10-13T00:49:28.179160+00:00; exit 0; duration 0.117s.

Command:

```sh
sed -n "1,170p" /sdk/source/render/src/materials/factories.ts; sed -n "30,135p" /sdk/source/render/src/materials/types.ts; grep -n "texture(\|class System" /sdk/source/app/src/systems/assets.ts /sdk/source/app/src/assets.ts; grep -n "camera.*set\|camera_update\|fovY\|near:" /sdk/source/app/src/devtools/camera.ts | head -45; grep -n "canvas\|workerEntry" /sdk/source/app/src/browser/app.ts | head -30; find /sdk/source/render/src -iname "*sky*"
```

Stdout:

```text
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

export function createStandardMaterialAsset(
  input: Partial<
    Omit<
      StandardMaterialAsset,
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
// GPU state, so the existing version-gated mirror re-prepares the GPU material.

const COLOR4_PATCH_FIELDS = new Set<string>(["baseColorFactor"]);
const VEC3_PATCH_FIELDS = new Set<string>([
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
export type BlendPreset = "none" | "alpha" | "premultiplied-alpha" | "additive";
export type ColorWriteMask = "all" | "none" | "rgb" | "alpha";

export type TextureDimension = "2d" | "cube";
export type TextureColorSpace = "srgb" | "linear" | "data";
export type TextureSemantic =
  | "base-color"
  | "emissive"
  | "clearcoat-roughness"
  | "sheen-color"
  | "sheen-roughness"
  | "iridescence"
  | "iridescence-thickness"
  | "metallic-roughness"
  | "normal"
  | "occlusion"
  | "data";
export type TextureFormat =
  | "rgba8unorm"
  | "rgba8unorm-srgb"
  | "bgra8unorm"
  | "bgra8unorm-srgb"
  | "r8unorm"
  | "rg8unorm"
  | "rgba16float"
  | "bc1-rgba-unorm"
  | "bc1-rgba-unorm-srgb"
  | "bc3-rgba-unorm"
  | "bc3-rgba-unorm-srgb"
  | "bc7-rgba-unorm"
  | "bc7-rgba-unorm-srgb"
  | "etc2-rgb8unorm"
  | "etc2-rgb8unorm-srgb"
  | "etc2-rgba8unorm"
  | "etc2-rgba8unorm-srgb"
  | "astc-4x4-unorm"
  | "astc-4x4-unorm-srgb";
export type TextureUsage = "sampled" | "copy-dst" | "render-attachment";
export type SamplerAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
export type SamplerFilterMode = "nearest" | "linear";

export interface DepthStateDescriptor {
  readonly test: boolean;
  readonly write: boolean;
  readonly compare: DepthCompare;
  readonly bias?: number;
  readonly biasSlopeScale?: number;
}

export interface BlendStateDescriptor {
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
/sdk/source/app/src/systems/assets.ts:180:  texture(id: string): SystemTextureAssetHandle;
/sdk/source/app/src/systems/assets.ts:442:    texture(id) {
/sdk/source/app/src/systems/assets.ts:448:          "Use this.assets.texture() only with asset.texture() declarations.",
/sdk/source/app/src/systems/assets.ts:871:    "Check the asset.texture() colorSpace and semantic options in aperture.config.ts.",
184:  if (request.tool === "camera_set_transform") {
29:import { resolveCanvas, installCanvasResizeSync } from "./canvas.js";
63:  readonly workerEntry: SimulationWorkerEntry;
135:  const canvas = resolveCanvas(config);
138:    readGeneratedRenderProfileEnvironment(canvas),
152:  const worker = createSimulationWorker(options.workerEntry, {
194:  installGeneratedInputForwarding(canvas, worker, status, config, {
215:    installCanvasResizeSync(canvas, worker, status, render, {
291:      canvas: canvas as unknown as WebGpuCanvasLike,
/sdk/source/render/src/rendering/snapshot-packed-sky-codec.ts
/sdk/source/render/src/rendering/extraction-skyboxes.ts
```

Stderr:

```text
grep: /sdk/source/app/src/assets.ts: No such file or directory
```

## Command d6116f556b074fb7a77866e526093199

2026-10-13T00:49:35.947691+00:00 → 2026-10-13T00:49:36.064720+00:00; exit 0; duration 0.117s.

Command:

```sh
grep -n "createTextureAsset\|createSamplerAsset" /sdk/source/render/src/materials/factories.ts; sed -n "235,325p" /sdk/source/render/src/materials/factories.ts; sed -n "140,240p" /sdk/source/app/src/devtools/camera.ts; grep -n "fovY\|camera" /sdk/source/app/src/devtools/entity-mutation.ts 2>/dev/null | head; grep -R -n "ecs_set_component\|ecs_update_component" /sdk/source/app/src/devtools | head -20; sed -n "55,100p" /sdk/source/app/src/browser/app.ts
```

Stdout:

```text
286:export function createTextureAsset(
302:export function createSamplerAsset(
    if (COLOR4_PATCH_FIELDS.has(key)) {
      next[key] = new Float32Array(value as ArrayLike<number>);
    } else if (VEC3_PATCH_FIELDS.has(key)) {
      next[key] = Array.from(value as ArrayLike<number>);
    } else if (key === "renderState") {
      next[key] = mergeRenderState(
        (prev as { readonly renderState?: RenderStateDescriptor }).renderState,
        value as Partial<RenderStateDescriptor>,
      );
    } else {
      next[key] = value;
    }
  }
  return Object.freeze(next) as T;
}

function mergeRenderState(
  previous: RenderStateDescriptor | undefined,
  patch: Partial<RenderStateDescriptor>,
): RenderStateDescriptor {
  const fallback = createDefaultRenderState();

  return createDefaultRenderState({
    ...(previous ?? fallback),
    ...patch,
    depth:
      patch.depth === undefined
        ? (previous?.depth ?? fallback.depth)
        : { ...(previous?.depth ?? fallback.depth), ...patch.depth },
    blend:
      patch.blend === undefined
        ? (previous?.blend ?? fallback.blend)
        : { ...(previous?.blend ?? fallback.blend), ...patch.blend },
  });
}

export function createDebugNormalMaterialAsset(
  input: {
    readonly label?: string;
    readonly renderState?: Partial<RenderStateDescriptor>;
    readonly unsupportedFeatures?: readonly MaterialUnsupportedFeature[];
  } = {},
): DebugNormalMaterialAsset {
  return {
    kind: "debug-normal",
    label: input.label ?? "Debug Normal Material",
    renderState: createDefaultRenderState(input.renderState),
    unsupportedFeatures: input.unsupportedFeatures ?? [],
  };
}

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
            severity: "error",
            message: `No saved camera state exists in slot '${slot}'.`,
            data: { slot },
            suggestedFix: "Call camera_save before camera_restore.",
          },
        ],
      };
    }

    restoreCameraState(app.lowLevel.world, entity, state);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_set_transform") {
    setCameraTransform(app.lowLevel.world, entity, payload);
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_look_at") {
    const translation = tuple3FromValue(payload["translation"]) ??
      cameraState(entity).localTransform?.translation ?? [0, 1.5, 5];
    const target = tuple3FromValue(payload["lookAt"] ?? payload["target"]) ?? [
      0, 0, 0,
    ];
    setCameraTransform(app.lowLevel.world, entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_orbit" || request.tool === "camera_fit_entity") {
    // An entity selected as the subject may have been edited since the last
    // simulation step. Resolve derived poses before reading its world origin.
    resolveWorldTransforms(app.lowLevel.world);
    const targetReport =
      request.tool === "camera_fit_entity"
        ? cameraFitTarget(app.lowLevel.world, payload)
        : {
            ok: true as const,
            target: cameraOrbitTarget(app.lowLevel.world, payload),
          };

    if (!targetReport.ok) {
      return targetReport;
    }

    const target = targetReport.target;
    const radius = numberFromValue(payload["radius"]) ?? 5;
    const yaw = degreesToRadians(numberFromValue(payload["yawDegrees"]) ?? 35);
    const pitch = degreesToRadians(
      numberFromValue(payload["pitchDegrees"]) ?? 20,
    );
    const translation = orbitPosition(target, radius, yaw, pitch);

    setCameraTransform(app.lowLevel.world, entity, {
      translation,
      rotation: quatLookAt(translation, target),
    });
    return { ok: true, result: cameraSummary(entity) };
  }

  if (request.tool === "camera_use_agent_view") {
    entity.setValue(Camera, "priority", 10_000);
    entity.setValue(Camera, "renderTargetId", "");
    entity.getVectorView(Camera, "viewport").set([0, 0, 1, 1]);
    entity.getVectorView(Camera, "scissor").set([0, 0, 1, 1]);
    return { ok: true, result: cameraSummary(entity) };
  }

/sdk/source/app/src/devtools/entities.ts:71:  readonly tool: "ecs_set_component_field";
/sdk/source/app/src/devtools/entities.ts:298:      if (tool === "ecs_set_component_field") {
/sdk/source/app/src/devtools/entities.ts:498:          tool: "ecs_set_component_field",
import {
  installGeneratedRenderDiagnosticsAccessor,
  installGeneratedStatus,
  type GeneratedBrowserSystemManifestEntry,
} from "./status.js";

export interface StartGeneratedBrowserAppOptions {
  readonly config: ApertureConfig;
  readonly workerEntry: SimulationWorkerEntry;
  readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
  readonly devtools?: {
    readonly enabled?: boolean;
  };
  readonly workerFactory?: (
    entry: string | URL,
    options?: WorkerOptions,
  ) => Worker;
  /**
   * Extra fields forwarded verbatim to the simulation worker's start options
   * (SimulationWorkerStartOptions). The page URL only exists on the main thread,
   * so the generated browser bootstrap reads e.g. `?map=` from location.search
   * and threads the value here; app systems read filtered app-level fields
   * through `this.startOptions`. Merged into the worker `start` message.
   */
  readonly workerStartOptions?: Record<string, unknown>;
  /**
   * Opt into main-thread audio. `true` wires the engine with defaults; an
   * options object configures buses/ducking/clip resolution. Omitted ⇒ no audio
   * engine is created (zero cost). Audio is a sibling derived view of the same
   * worker snapshot the renderer consumes.
   */
  readonly audio?: boolean | GeneratedAudioOptions;
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
  /** The wired audio engine + teardown, or null when audio was not enabled. */
  readonly audio: GeneratedAudio | null;
  /** GPU and worker initialization; assets may still load asynchronously. */
  readonly ready: Promise<void>;
  request<Key extends keyof GeneratedBrowserToolContracts>(
    tool: Key,
    ...args: undefined extends GeneratedBrowserToolContracts[Key]["payload"]
      ? [
          payload?: GeneratedBrowserToolContracts[Key]["payload"],
```

Stderr:

```text

```

## Command 365e8481c0c94c0db6fe7fba97dfa36b

2026-10-13T00:49:54.037081+00:00 → 2026-10-13T00:49:54.154285+00:00; exit 0; duration 0.117s.

Command:

```sh
grep -A38 -n "export interface TextureAsset" /sdk/source/render/src/materials/types.ts; sed -n "60,85p" /sdk/source/app/src/devtools/entities.ts; sed -n "290,335p" /sdk/source/app/src/devtools/entities.ts; grep -R -n "nearPlane\|fovY" /sdk/source/render/src/components/camera* /sdk/source/render/src/cameras* 2>/dev/null | head -30; cat /sdk/source/simulation/src/assets/handles.ts 2>/dev/null | head -70
```

Stdout:

```text
341:export interface TextureAsset {
342-  readonly kind: "texture";
343-  readonly label: string;
344-  readonly dimension: TextureDimension;
345-  readonly width: number;
346-  readonly height: number;
347-  readonly depthOrLayers: number;
348-  readonly format: TextureFormat;
349-  readonly colorSpace: TextureColorSpace;
350-  readonly semantic: TextureSemantic;
351-  readonly mipLevelCount: number;
352-  readonly usage: readonly TextureUsage[];
353-  readonly sourceData?: TextureSourceData;
354-}
355-
356-export interface SamplerAsset {
357-  readonly kind: "sampler";
358-  readonly label: string;
359-  readonly addressModeU: SamplerAddressMode;
360-  readonly addressModeV: SamplerAddressMode;
361-  readonly addressModeW: SamplerAddressMode;
362-  readonly magFilter: SamplerFilterMode;
363-  readonly minFilter: SamplerFilterMode;
364-  readonly mipmapFilter: SamplerFilterMode;
365-  readonly lodMinClamp: number;
366-  readonly lodMaxClamp: number;
367-  readonly maxAnisotropy: number;
368-}
369-
370-export type MaterialDiagnosticCode =
371-  | "material.missingTextureHandle"
372-  | "material.missingSamplerHandle"
373-  | "material.invalidAlphaCutoff"
374-  | "material.unsupportedFeature"
375-  | "material.invalidTextureColorSpace"
376-  | "material.invalidTextureColorSpaceFormat"
377-  | "material.incompatibleRenderState";
378-
379-export interface MaterialValidationDiagnostic {
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface GeneratedEntityToolBridge {
  handle(command: ApertureGeneratedCommand): boolean;
  call(tool: string, payload: unknown): GeneratedDevtoolsToolResult;
  summary(): GeneratedEntityToolStatus;
}

/** Editing support through devtools only; this is not general ECS immutability. */
export interface GeneratedComponentMutationAffordance {
  readonly tool: "ecs_set_component_field";
  readonly supported: boolean;
  readonly writableFields: readonly string[];
  readonly readOnlyFields: readonly string[];
  readonly fieldPathSyntax: "literal-top-level-field";
}

export interface GeneratedComponentSchema {
  readonly id: string;
  readonly description?: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly mutation: GeneratedComponentMutationAffordance;
}

export interface GeneratedComponentSchemaReport {
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastGet = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_set_component_field") {
        const request = setComponentRequestFromPayload(
          world,
          payload,
          lastFind,
          lastGet,
        );
        const report =
          "diagnostic" in request
            ? {
                ok: false as const,
                diagnostic: request.diagnostic,
              }
            : setApertureEntityComponentField(world, request);

        mutations += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastMutation = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_snapshot") {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            payload,
            `generated-snapshot-${snapshots + 1}`,
          ),
        );

        snapshots += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastSnapshot = snapshot;
        lastDiff = null;
        diagnostics = snapshot.diagnostics;
import { ASSET_KINDS, type AssetHandle, type AssetKind } from "./types.js";
import type {
  AnimationClipHandle,
  AudioClipHandle,
  EnvironmentMapHandle,
  FontAtlasHandle,
  MaterialHandle,
  MeshHandle,
  MorphTargetSetHandle,
  ParticleCompositeEffectHandle,
  ParticleEffectHandle,
  PrefabHandle,
  RenderTargetHandle,
  SamplerHandle,
  SceneHandle,
  SerializedAssetHandle,
  ShaderHandle,
  SkinHandle,
  TextureHandle,
} from "./types.js";

export function createAssetHandle<TKind extends AssetKind>(
  kind: TKind,
  id: string,
): AssetHandle<TKind> {
  if (!isAssetKind(kind)) {
    throw new RangeError(`Unsupported asset kind '${kind}'.`);
  }

  if (id.trim().length === 0) {
    throw new RangeError("Asset handle id must be a non-empty string.");
  }

  return Object.freeze({ kind, id }) as AssetHandle<TKind>;
}

export function createMeshHandle(id: string): MeshHandle {
  return createAssetHandle("mesh", id);
}

export function createMaterialHandle(id: string): MaterialHandle {
  return createAssetHandle("material", id);
}

export function createTextureHandle(id: string): TextureHandle {
  return createAssetHandle("texture", id);
}

export function createSamplerHandle(id: string): SamplerHandle {
  return createAssetHandle("sampler", id);
}

export function createRenderTargetHandle(id: string): RenderTargetHandle {
  return createAssetHandle("render-target", id);
}

export function createSceneHandle(id: string): SceneHandle {
  return createAssetHandle("scene", id);
}

export function createPrefabHandle(id: string): PrefabHandle {
  return createAssetHandle("prefab", id);
}

export function createAnimationClipHandle(id: string): AnimationClipHandle {
  return createAssetHandle("animation-clip", id);
}

export function createSkinHandle(id: string): SkinHandle {
  return createAssetHandle("skin", id);
```

Stderr:

```text

```

## Command bebfb5c3a62c4d2387fe578a057d67f0

2026-10-13T00:50:05.379833+00:00 → 2026-10-13T00:50:05.496875+00:00; exit 0; duration 0.117s.

Command:

```sh
grep -R -n "fovYRadians\|nearPlane\|fovY:" /sdk/source/render/src /sdk/source/app/src/systems/spawn | head -30; grep -n "function setComponentRequestFromPayload" /sdk/source/app/src/devtools/entities.ts; sed -n "620,710p" /sdk/source/app/src/devtools/entities.ts; grep -R -n "type RenderedGeometryDraw\|interface RenderedGeometryDraw" /sdk/source/webgpu/src | head
```

Stdout:

```text
/sdk/source/render/src/rendering/authoring-validation-camera.ts:15:  const fovYRadians = camera.fovYRadians ?? Math.PI / 3;
/sdk/source/render/src/rendering/authoring-validation-camera.ts:37:    (!Number.isFinite(fovYRadians) ||
/sdk/source/render/src/rendering/authoring-validation-camera.ts:38:      fovYRadians <= 0 ||
/sdk/source/render/src/rendering/authoring-validation-camera.ts:39:      fovYRadians >= Math.PI)
/sdk/source/render/src/rendering/authoring-validation-camera.ts:43:      field: "fovYRadians",
/sdk/source/render/src/rendering/authoring-validation-camera.ts:44:      message: "Perspective cameras require finite 0 < fovYRadians < PI.",
/sdk/source/render/src/rendering/authoring-components-camera-light.ts:18:    fovYRadians: { type: EcsType.Float32, default: Math.PI / 3 },
/sdk/source/render/src/rendering/extraction-views.ts:80:            readCameraNumber(entity, "fovYRadians"),
/sdk/source/render/src/rendering/authoring-types.ts:201:  readonly fovYRadians?: number;
/sdk/source/render/src/rendering/extraction-inputs.ts:94:    fovYRadians: entity.getValue(Camera, "fovYRadians") ?? Math.PI / 3,
/sdk/source/render/src/rendering/authoring-create-camera-light.ts:27:    fovYRadians: input.fovYRadians ?? Math.PI / 3,
/sdk/source/app/src/systems/spawn/commands.ts:237:          : { fovYRadians: (input.fovYDegrees * Math.PI) / 180 }),
699:function setComponentRequestFromPayload(
 *    documented convenience for chained calls.
 */
function resolveEntityRefFromPayload(
  world: EcsWorld,
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
  channel: string,
): ResolvedEntityRef {
  const record = isRecord(payload) ? payload : {};
  const explicit = entityRefFromValue(record["entity"] ?? record);

  if (explicit !== null) {
    return { ref: explicit };
  }

  const queryRef = firstEntityFromFindReportPayload(payload);
  if (queryRef !== null) {
    return { ref: queryRef };
  }

  const key = stringFromValue(record["key"]);
  const namePattern = stringFromValue(record["namePattern"]);
  if (key !== undefined || namePattern !== undefined) {
    const report = findApertureEntities(world, {
      ...(key === undefined ? {} : { key }),
      ...(namePattern === undefined ? {} : { namePattern }),
      limit: 1,
    });
    const ref = report.summaries[0]?.entity ?? null;

    if (ref !== null) {
      return { ref };
    }

    return {
      diagnostic: {
        code: "aperture.entityTools.entitySelectorNotFound",
        severity: "error",
        message: `No entity matched the requested ${
          key !== undefined
            ? `key '${key}'`
            : `namePattern '${namePattern ?? ""}'`
        }.`,
        data: {
          channel,
          ...(key === undefined ? {} : { key }),
          ...(namePattern === undefined ? {} : { namePattern }),
        },
        suggestedFix:
          "Confirm the key/name with ecs_find_entities, or pass an explicit { index, generation } entity reference.",
      },
    };
  }

  if (lastGet?.ok) {
    return { ref: lastGet.summary.entity };
  }

  const lastRef = lastFind?.summaries[0]?.entity ?? null;
  if (lastRef !== null) {
    return { ref: lastRef };
  }

  return { diagnostic: missingEntityRefDiagnostic(channel) };
}

function firstEntityFromFindReportPayload(
  payload: unknown,
): EcsEntityRef | null {
  const record = isRecord(payload) ? payload : {};
  const summaries = Array.isArray(record["summaries"])
    ? record["summaries"]
    : [];
  const first = summaries.find(isRecord);

  return first === undefined ? null : entityRefFromValue(first["entity"]);
}

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
/sdk/source/webgpu/src/app/rendered-geometry-types.ts:36:export interface RenderedGeometryDraw {
```

Stderr:

```text

```

## Command 66fbc77d04f54d9cb085c3910833b96c

2026-10-13T00:52:22.202225+00:00 → 2026-10-13T00:52:22.319603+00:00; exit 0; duration 0.117s.

Command:

```sh
cat > /work/index.html <<'EOF'
<!doctype html><html><head><meta charset="UTF-8"><title>Warm Mediterranean House</title><style>html,body{margin:0;background:#b9cce0;width:1024px;height:768px;overflow:hidden}canvas{display:block;width:1024px;height:768px}</style></head><body><canvas id="aperture" width="1024" height="768"></canvas><script type="module" src="/src/main.js"></script></body></html>
EOF
cat > /work/vite.config.js <<'EOF'
import { defineConfig } from 'vite';
export default defineConfig({build:{target:'esnext'},worker:{format:'es'}});
EOF
cat > /work/src/config.js <<'EOF'
import {defineApertureConfig} from '@aperture-engine/app/config';
export default defineApertureConfig({
 mode:'browser',canvas:'#aperture',systems:[],
 render:{cadence:'manual',defaultCamera:false,defaultLight:false,defaultEnvironment:true,pixelRatio:1,maxPixelRatio:1,sampleCount:4,tonemap:'aces',exposure:1,geometryInspection:{maxRetainedBytes:64*1024*1024},ssao:{radiusPixels:4,intensity:0.65,power:1.3,sampleCount:8}},
 diagnostics:{level:'warn'}
});
EOF
cat > /work/src/worker.js <<'EOF'
import {startGeneratedSimulationWorker} from '@aperture-engine/app/worker';
import config from './config.js';
import SceneSystem from './scene.js';
startGeneratedSimulationWorker({config,systems:[{default:SceneSystem}]});
EOF
cat > /work/src/main.js <<'EOF'
import {startGeneratedBrowserApp} from '@aperture-engine/app/browser';
import config from './config.js';
const canvas=document.querySelector('canvas');
const app=startGeneratedBrowserApp({config,workerEntry:new Worker(new URL('./worker.js',import.meta.url),{type:'module'})});
globalThis.__AGENT_BENCHMARK__={
 engine:'aperture',canvas,ready:app.ready,
 async setCamera(c){
  await app.request('camera_look_at',{key:'camera.main',translation:c.position,lookAt:c.target});
  for(const [field,value] of [['fovYRadians',c.fovYDegrees*Math.PI/180],['near',c.near],['far',c.far]]){
   const r=await app.requestRaw('ecs_set_component_field',{key:'camera.main',component:'Camera',field,value});
   if(!r.ok) throw new Error(JSON.stringify(r.diagnostics));
  }
 },
 async renderFrame(f){await app.renderFrame({deltaSeconds:f.deltaSeconds,timeSeconds:f.timeSeconds});},
 async inspectGeometry(){
  const g=app.inspectRenderedGeometry({maxBytes:64*1024*1024,maxVertices:2000000,maxIndices:6000000,maxInstances:100000,maxMeshes:4096,maxDraws:10000});
  if(g.status!=='complete')throw new Error('Geometry inspection incomplete: '+JSON.stringify(g.omissions));
  const byKey=new Map(g.meshes.map(m=>[m.key,m]));
  const meshes=[];
  for(let i=0;i<g.draws.length;i++){
   const d=g.draws[i],m=byKey.get(d.meshKey);
   let indices;
   if(d.indexed){indices=new Uint32Array(d.indexCount);for(let j=0;j<indices.length;j++)indices[j]=m.indices[d.firstIndex+j]+d.baseVertex;}
   else {indices=new Uint32Array(d.vertexCount);for(let j=0;j<indices.length;j++)indices[j]=d.firstVertex+j;}
   const instances=[];
   for(let j=0;j<d.worldMatrices.length;j+=16)instances.push(new Float32Array(d.worldMatrices.slice(j,j+16)));
   meshes.push({id:'submitted-'+i,positions:new Float32Array(m.positions),normals:m.normals?new Float32Array(m.normals):undefined,indices,worldMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],instances});
  }
  return {meshes};
 },
 async dispose(){await app.dispose();}
};
app.ready.catch(e=>{console.error(e);document.body.dataset.error=String(e);});
EOF
cat > /work/src/scene.js <<'EOF'
import {createSystem,mesh,color} from '@aperture-engine/app/systems';
import {createStandardMaterialAsset,createTextureAsset,createSamplerAsset} from '@aperture-engine/render';
import {createMaterialHandle,createTextureHandle,createSamplerHandle} from '@aperture-engine/simulation';

// Every part is authored in the simulation worker and published as ordinary ECS meshes.
// A deterministic material batching builder preserves all real surface vertices.
let seed=8137;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), mul=(a,s)=>a.map(x=>x*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/Math.hypot(...a));
const batches=new Map();
function batch(k){if(!batches.has(k))batches.set(k,{p:[],n:[],uv:[],idx:[]});return batches.get(k);}
function tri(k,a,b,c,ns,uvs){
 const q=batch(k),n=norm(cross(sub(b,a),sub(c,a))),off=q.p.length/3;
 for(let j=0;j<3;j++){q.p.push(...[a,b,c][j]);q.n.push(...(ns?ns[j]:n));q.uv.push(...(uvs?uvs[j]:[[a[0]+a[2],a[1]],[b[0]+b[2],b[1]],[c[0]+c[2],c[1]]][j]));}
 q.idx.push(off,off+1,off+2);
}
function quad(k,a,b,c,d,uvs){tri(k,a,b,c,null,uvs?[uvs[0],uvs[1],uvs[2]]:null);tri(k,a,c,d,null,uvs?[uvs[0],uvs[2],uvs[3]]:null);}
function box(k,c,s,yaw=0){
 const [x,y,z]=s.map(v=>v/2),co=Math.cos(yaw),si=Math.sin(yaw);
 const at=(a,b,d)=>[c[0]+a*co+d*si,c[1]+b,c[2]-a*si+d*co];
 const v=[at(-x,-y,-z),at(x,-y,-z),at(x,y,-z),at(-x,y,-z),at(-x,-y,z),at(x,-y,z),at(x,y,z),at(-x,y,z)];
 for(const f of [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]])quad(k,...f.map(i=>v[i]));
}
function ellipsoid(k,c,s,seg=10,rings=6){
 const p=(i,j)=>{const t=i*Math.PI/rings,a=j*2*Math.PI/seg;return [c[0]+Math.sin(t)*Math.cos(a)*s[0],c[1]+Math.cos(t)*s[1],c[2]+Math.sin(t)*Math.sin(a)*s[2]];};
 const n=p=>norm([(p[0]-c[0])/(s[0]*s[0]),(p[1]-c[1])/(s[1]*s[1]),(p[2]-c[2])/(s[2]*s[2])]);
 for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){
  const a=p(i,j),b=p(i+1,j),cc=p(i+1,j+1),d=p(i,j+1);
  if(i>0)tri(k,a,b,d,[n(a),n(b),n(d)]);
  if(i<rings-1)tri(k,b,cc,d,[n(b),n(cc),n(d)]);
 }
}
function cylinder(k,a,b,r1,r2=r1,seg=10){
 const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u);
 const point=(c,r,j)=>add(c,add(mul(u,r*Math.cos(j*2*Math.PI/seg)),mul(v,r*Math.sin(j*2*Math.PI/seg))));
 for(let j=0;j<seg;j++){
  const p=point(a,r1,j),q=point(a,r1,j+1),r=point(b,r2,j+1),s=point(b,r2,j);
  quad(k,p,q,r,s);tri(k,a,q,p);tri(k,b,s,r);
 }
}
function tube(k,c,major,minor,axis='z',segments=28,sides=8){
 const p=(i,j)=>{const a=i*2*Math.PI/segments,b=j*2*Math.PI/sides,r=major+minor*Math.cos(b),h=minor*Math.sin(b);return axis==='z'?[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),c[2]+h]:[c[0]+r*Math.cos(a),c[1]+h,c[2]+r*Math.sin(a)];};
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=p(i,j),b=p(i+1,j),cc=p(i+1,j+1),d=p(i,j+1);quad(k,a,b,cc,d);}
}
function line(k,a,b,r=.03){cylinder(k,a,b,r,r,8);}
function slab(k,points,y,thick){
 for(let i=1;i<points.length-1;i++)tri(k,[points[0][0],y,points[0][1]],[points[i+1][0],y,points[i+1][1]],[points[i][0],y,points[i][1]]);
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];quad(k,[a[0],y-thick,a[1]],[b[0],y-thick,b[1]],[b[0],y,b[1]],[a[0],y,a[1]]);}
}
function roofTile(k,x,z,span,y0,slope,dir=1){
 // Tapered half-cylinder barrel tile, with real top, undersurface, and end lips.
 const length=.58,rad=.142,steps=8;
 const at=(t,a,under=0)=>[x+Math.cos(a)*rad*(1+.09*t),y0+slope*t+Math.sin(a)*rad*.56-under,z+dir*t];
 for(let j=0;j<steps;j++){
  const a=j*Math.PI/steps,b=(j+1)*Math.PI/steps;
  quad(k,at(0,a),at(length,a),at(length,b),at(0,b));
  quad(k,at(0,b,.028),at(length,b,.028),at(length,a,.028),at(0,a,.028));
  quad(k,at(0,a,.028),at(0,a),at(0,b),at(0,b,.028));
  quad(k,at(length,b,.028),at(length,b),at(length,a),at(length,a,.028));
 }
}
function roof(width,cx,zFront,zBack,eave,ridge){
 const rz=(zFront+zBack)/2,half=(zFront-zBack)/2;
 quad('roofUnder',[cx-width/2,eave,zFront],[cx+width/2,eave,zFront],[cx+width/2,ridge,rz],[cx-width/2,ridge,rz]);
 quad('roofUnder',[cx-width/2,ridge,rz],[cx+width/2,ridge,rz],[cx+width/2,eave,zBack],[cx-width/2,eave,zBack]);
 for(const dir of [-1,1]){
  const end=dir===1?zFront:zBack;
  for(let x=cx-width/2+.14;x<cx+width/2-.06;x+=.285)for(let t=0;t<half;t+=.49){
   roofTile('tile'+Math.floor(rnd()*5),x,rz+dir*t,0,ridge-(ridge-eave)*t/half,-(ridge-eave)/half,dir);
  }
 }
 for(let x=cx-width/2;x<cx+width/2;x+=.49)cylinder('tile2',[x,ridge+.08,rz],[x+.52,ridge+.08,rz],.165,.16,10);
 for(const z of [zFront,zBack])box('fascia',[cx,eave-.07,z],[width,.14,.13]);
 for(const x of [cx-width/2,cx+width/2]){line('fascia',[x,eave,zFront],[x,ridge,rz],.075);line('fascia',[x,ridge,rz],[x,eave,zBack],.075);}
}
function windowFront(x,y,z,w=1.45,h=1.65){
 box('reveal',[x,y,z-.1],[w+.17,h+.17,.2]);box('glass',[x,y,z-.075],[w-.13,h-.13,.06]);
 box('sill',[x,y-h/2-.06,z+.08],[w+.25,.12,.34]);
 for(const a of [-1,1])box('frame',[x+a*(w/2-.035),y,z+.018],[.072,h,.09]);
 for(const a of [-1,1])box('frame',[x,y+a*(h/2-.035),z+.018],[w,.072,.09]);
 box('frame',[x,y,z+.025],[.055,h,.07]);box('frame',[x,y-.12,z+.025],[w,.045,.07]);
 // Soft pale curtains sit behind dark mullions.
 for(const a of [-1,1])box('curtain',[x+a*w*.3,y,z-.025],[w*.19,h-.16,.023]);
}
function windowSide(x,y,z,w=1,h=1.65){
 box('reveal',[x-.08,y,z],[.19,h+.17,w+.17]);box('glass',[x-.065,y,z],[.055,h-.13,w-.13]);
 box('sill',[x+.08,y-h/2-.06,z],[.34,.12,w+.25]);
 for(const a of [-1,1])box('frame',[x+.02,y,z+a*(w/2-.035)],[.09,h,.07]);
 for(const a of [-1,1])box('frame',[x+.02,y+a*(h/2-.035),z],[.09,.07,w]);
 box('frame',[x+.025,y,z],[.07,h,.05]);box('frame',[x+.025,y-.12,z],[.07,.045,w]);
}
function wallGrid(k,x0,x1,y0,y1,z,openings){
 const xs=[x0,x1,...openings.flatMap(o=>[o[0]-o[2]/2,o[0]+o[2]/2])].sort((a,b)=>a-b);
 const ys=[y0,y1,...openings.flatMap(o=>[o[1]-o[3]/2,o[1]+o[3]/2])].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  if(xs[i+1]-xs[i]<.001||ys[j+1]-ys[j]<.001||openings.some(o=>Math.abs(x-o[0])<o[2]/2&&Math.abs(y-o[1])<o[3]/2))continue;
  box(k,[x,y,z-.12],[xs[i+1]-xs[i],ys[j+1]-ys[j],.24]);
 }
}
function bush(c,size=1,count=24){
 for(let i=0;i<count;i++){
  const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*size;
  ellipsoid('leaf'+Math.floor(rnd()*5),[c[0]+Math.cos(a)*r,c[1]+rnd()*size*.45,c[2]+Math.sin(a)*r],[.18+rnd()*.2,.14+rnd()*.22,.18+rnd()*.2],7,4);
 }
}
function olive(x,z,h=4.5){
 const base=[x,.1,z],fork=[x+.18,h*.48,z-.05];cylinder('bark',base,fork,.17,.1,9);
 for(let i=0;i<8;i++){const a=i*2.4,b=[x+Math.cos(a)*(1+rnd()*.65),h*(.62+rnd()*.23),z+Math.sin(a)*(1+rnd()*.65)];
 cylinder('bark',fork,b,.075,.022,7);
 for(let j=0;j<28;j++){const an=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.9;ellipsoid('olive'+Math.floor(rnd()*4),[b[0]+Math.cos(an)*r,b[1]+(rnd()-.5)*.7,b[2]+Math.sin(an)*r],[.26+rnd()*.24,.14+rnd()*.22,.22+rnd()*.25],7,4);}
 }
}
function cypress(x,z,h){
 cylinder('bark',[x,0,z],[x,h*.7,z],.1,.025,8);
 for(let j=0;j<12;j++){const y=.55+j*h/13,r=.22+Math.sin(j/12*Math.PI)*.35;ellipsoid('cypress',[x+(rnd()-.5)*.14,y,z+(rnd()-.5)*.14],[r,h*.10,r*.8],9,5);}
}
function stoneSegment(a,b,height=.85,width=.36){
 const d=sub(b,a),len=Math.hypot(d[0],d[2]),angle=Math.atan2(-d[2],d[0]);
 box('mortar',[(a[0]+b[0])/2,height/2+.1,(a[2]+b[2])/2],[len,height,width],angle);
 const rows=Math.ceil(height/.23),n=Math.ceil(len/.55);
 for(let j=0;j<rows;j++)for(let i=0;i<n;i++){
  const t=(i+.5+(j%2)*.3)/n;if(t>1)continue;
  box('stone'+Math.floor(rnd()*5),[a[0]+d[0]*t,.23+j*.23,a[2]+d[2]*t],[len/n-.025,.2+rnd()*.02,width+.025],angle);
 }
 for(let i=0;i<n;i++){const t=(i+.5)/n;box('sill',[a[0]+d[0]*t,height+.13,a[2]+d[2]*t],[len/n-.015,.10,width+.13],angle);}
}
function pillar(x,z){
 box('mortar',[x,.72,z],[.54,1.3,.54]);
 for(let y=.15;y<1.35;y+=.23)for(const dx of [-.145,.145])for(const dz of [-.145,.145])box('stone'+Math.floor(rnd()*5),[x+dx,y+.1,z+dz],[.277,.215,.277]);
 box('sill',[x,1.43,z],[.7,.15,.7]);
}
function path(){
 for(let row=0;row<12;row++)for(let col=0;col<4;col++){
 const z=3.75+row*.27,x=-1.1+(col-1.5)*.35+(row%2)*.08;
 const points=[[x-.16,z-.12],[x+.12,z-.13],[x+.19,z+.05],[x+.1,z+.15],[x-.16,z+.1]];
 slab('stone'+Math.floor(rnd()*5),points,.14,.07);
 }
 for(let row=0;row<20;row++)for(let col=0;col<5;col++){
 const x=3.8+col*.32+(row%2)*.1,z=-4+row*.49;
 slab('stone'+Math.floor(rnd()*5),[[x-.15,z-.22],[x+.14,z-.22],[x+.18,z+.2],[x-.12,z+.23]],.1,.05);
 }
}
const carOrigin=[3.7,.15,8.1],carYaw=-.13;
function cp(p){const c=Math.cos(carYaw),s=Math.sin(carYaw);return [carOrigin[0]+p[0]*c+p[2]*s,carOrigin[1]+p[1],carOrigin[2]-p[0]*s+p[2]*c];}
function cb(k,p,s,yaw=0){const center=cp(p);box(k,center,s,carYaw+yaw);}
function cq(k,pts){quad(k,...pts.map(cp));}
function cl(k,a,b,r){line(k,cp(a),cp(b),r);}
function car(){
 const sections=[[-2.35,.76,.65,.88],[-2.15,.97,.73,1.04],[-1.45,1.02,.77,1.10],[-.55,1.00,.84,1.12],[.5,1.02,.9,1.12],[1.5,.99,.82,1.10],[2.1,.93,.72,1.0],[2.22,.83,.68,.91]];
 const ring=s=>{const [x,w,low,high]=s;return [[x,.40,-w*.90],[x,low,-w],[x,high,-w*.92],[x,high,w*.92],[x,low,w],[x,.4,w*.90]];};
 for(let j=0;j<sections.length-1;j++){const a=ring(sections[j]),b=ring(sections[j+1]);for(let i=0;i<6;i++)cq('blue',[a[i],a[(i+1)%6],b[(i+1)%6],b[i]]);}
 const f=ring(sections[0]),r=ring(sections.at(-1));for(let i=1;i<5;i++){tri('blue',cp(f[0]),cp(f[i+1]),cp(f[i]));tri('blue',cp(r[0]),cp(r[i]),cp(r[i+1]));}
 // Roof and tinted glass cabin follow the hatchback's sloping windshield and rear hatch.
 cq('blue',[[-.55,1.11,-.91],[.02,1.76,-.77],[1.26,1.77,-.77],[1.94,1.10,-.88]]);
 cq('blue',[[1.94,1.10,.88],[1.26,1.77,.77],[.02,1.76,.77],[-.55,1.11,.91]]);
 cq('blue',[[.02,1.76,-.77],[.02,1.76,.77],[1.26,1.77,.77],[1.26,1.77,-.77]]);
 cq('glass',[[-.60,1.14,.83],[-.60,1.14,-.83],[.045,1.735,-.72],[.045,1.735,.72]]);
 cq('glass',[[1.32,1.70,.71],[1.32,1.70,-.71],[1.94,1.14,-.79],[1.94,1.14,.79]]);
 for(const side of [-1,1]){
  const z=side;
  const front=[[-.48,1.17,.906*z],[.07,1.69,.789*z],[.64,1.69,.79*z],[.66,1.16,.929*z]];
  const back=[[.76,1.16,.931*z],[.74,1.69,.79*z],[1.23,1.69,.79*z],[1.77,1.16,.89*z]];
  cq('glass',side===1?front:front.reverse());cq('glass',side===1?back:back.reverse());
  cl('chrome',[-.53,1.14,.938*z],[1.88,1.14,.937*z],.014);
  cl('trim',[.69,1.13,.947*z],[.68,1.73,.79*z],.04);
  for(const x of [.48,1.55])cb('trim',[x,1.03,1.002*z],[.2,.045,.035]);
  cl('seam',[.66,.49,1.026*z],[.68,1.13,.975*z],.012);
  cl('seam',[1.72,.49,.985*z],[1.8,1.13,.94*z],.009);
  cb('blue',[-.42,1.15,1.095*z],[.30,.14,.18]);cb('glass',[-.40,1.17,1.185*z],[.21,.08,.021]);
 }
 cb('trim',[-2.32,.62,0],[.055,.26,1.55]);cb('trim',[-2.38,.43,0],[.04,.11,1.4]);
 for(const z of [-.45,-.25,0,.25,.45])cl('chrome',[-2.393,.55,z-.1],[-2.393,.55,z+.1],.009);
 cb('plate',[-2.40,.68,0],[.02,.16,.46]);
 for(const z of [-.70,.70]){
  cb('lamp',[-2.18,.94,z],[.23,.15,.39]);cb('lamp',[-2.33,.47,z],[.035,.075,.14]);
  cb('red',[2.15,.93,z],[.09,.23,.3]);
 }
 cb('trim',[2.225,.47,0],[.04,.13,1.6]);
 cl('trim',[1.44,1.785,0],[1.55,2.08,0],.012);
 for(const x of [-1.45,1.45])for(const side of [-1,1]){
  const z=1.02*side,c=cp([x,.57,z]);
  // Tire has a rounded tread crown and alloy hub; four true volumetric wheels.
  tube('tire',c,.40,.145,'z',32,10);
  cylinder('tire',cp([x,.57,z-.09]),cp([x,.57,z+.09]),.43,.43,28);
  const outer=z+side*.153;
  cylinder('alloy',cp([x,.57,outer-side*.025]),cp([x,.57,outer]),.32,.32,24);
  cylinder('trim',cp([x,.57,outer]),cp([x,.57,outer+side*.01]),.275,.275,24);
  for(let j=0;j<10;j++){
   const a=j*Math.PI/5,b=a+.09;
   const pa=[x+Math.cos(a)*.09,.57+Math.sin(a)*.09,outer+side*.02];
   const pb=[x+Math.cos(b)*.29,.57+Math.sin(b)*.29,outer+side*.025];
   cl('alloy',pa,pb,.022);
  }
  cylinder('alloy',cp([x,.57,outer]),cp([x,.57,outer+side*.032]),.09,.09,16);
 }
 cl('seam',[-2.05,1.066,-.58],[-.62,1.142,-.7],.012);cl('seam',[-2.05,1.066,.58],[-.62,1.142,.7],.012);
}
EOF
```

Stdout:

```text

```

Stderr:

```text

```

## Command a85919fdd2b44bfbaa29ad123bdeb353

2026-10-13T00:54:45.655398+00:00 → 2026-10-13T00:54:46.979590+00:00; exit 0; duration 1.324s.

Command:

```sh
cat >> /work/src/scene.js <<'EOF'
function ribbon(k,center,width,y){
 for(let i=0;i<center.length-1;i++){
  const pa=center[Math.max(0,i-1)],pb=center[Math.min(center.length-1,i+1)];
  const qa=center[i],qb=center[i+1],pc=center[Math.min(center.length-1,i+2)];
  const na=norm([-(pb[2]-pa[2]),0,pb[0]-pa[0]]),nb=norm([-(pc[2]-qa[2]),0,pc[0]-qa[0]]);
  quad(k,[qa[0]-na[0]*width/2,y,qa[2]-na[2]*width/2],[qa[0]+na[0]*width/2,y,qa[2]+na[2]*width/2],[qb[0]+nb[0]*width/2,y,qb[2]+nb[2]*width/2],[qb[0]-nb[0]*width/2,y,qb[2]-nb[2]*width/2]);
 }
}
function road(){
 const pts=[];
 for(let x=-19;x<3;x+=.5)pts.push([x,0,8]);
 for(let j=0;j<=36;j++){const a=Math.PI/2-j/36*Math.PI/2;pts.push([3+7*Math.cos(a),0,1+7*Math.sin(a)]);}
 for(let z=.5;z>-20;z-=.5)pts.push([10,0,z]);
 ribbon('asphalt',pts,4.2,.025);
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);
  if(l<.01)continue;
  const nx=-dz/l,nz=dx/l,angle=Math.atan2(-dz,dx);
  for(const side of [-1,1]){
   box('sill',[(a[0]+b[0])/2+nx*side*2.17,.095,(a[2]+b[2])/2+nz*side*2.17],[l-.012,.14,.28],angle);
   box('sidewalk',[(a[0]+b[0])/2+nx*side*2.54,.065,(a[2]+b[2])/2+nz*side*2.54],[l-.013,.1,.47],angle);
  }
  if(i%5<2)box('marking',[(a[0]+b[0])/2-.0*nx,.037,(a[2]+b[2])/2-.0*nz],[l+.008,.012,.115],angle);
 }
}
function garden(){
 path();
 stoneSegment([-12,0,5.3],[-2.1,0,5.3],.9);stoneSegment([-.15,0,5.3],[4.5,0,5.3],.9);
 for(let j=0;j<12;j++){
  const a=j/12*Math.PI/2,b=(j+1)/12*Math.PI/2;
  stoneSegment([4.5+3.3*Math.sin(a),0,2+3.3*Math.cos(a)],[4.5+3.3*Math.sin(b),0,2+3.3*Math.cos(b)],.85);
 }
 stoneSegment([7.8,0,2],[7.8,0,-9],.85);
 for(const x of [-2.1,-.15,4.5])pillar(x,5.3);
 for(let x=-11;x<4.5;x+=.75){if(x>-2.4&&x<.2)continue;bush([x,.43,4.74],.45,14);}
 for(let z=-8;z<3.8;z+=.72)bush([7.23,.44,z],.48,16);
 for(const [x,z,s] of [[-4.3,2.6,.7],[2.6,2.9,.7],[-2.8,3.7,.5],[.3,3.9,.65],[4.0,-1,.7],[4.5,-3,.75],[-6.1,-1,1.1]])bush([x,.25,z],s,32);
 olive(-8,2.6,4.8);olive(7,-4,4.6);olive(-8,-5,5.1);
 cypress(-7,-6.6,6.5);cypress(-10,-9,5.3);cypress(6.5,-9,5.8);
 // terracotta planters beside the sheltered entry
 for(const [x,z,s] of [[-2.25,3.16,.34],[.22,3.16,.29],[2.2,3.7,.37]]){
  cylinder('pot',[x,.17,z],[x,.68,z],s*.72,s,18);cylinder('potRim',[x,.65,z],[x,.73,z],s*1.03,s*1.03,18);
  cylinder('soil',[x,.734,z],[x,.745,z],s*.86,s*.86,16);
  bush([x,.87,z],s*1.25,20);
 }
 // lavender flowers around low shrubs, individual slender stems and blossom clusters
 for(let j=0;j<100;j++){
  const side=j%2===0?-1:1,x=-1.1+side*(1.25+rnd()*1.2),z=3.8+rnd()*.65,y=.33+rnd()*.25;
  line('leaf2',[x,.14,z],[x,y,z],.009);
  ellipsoid('lavender',[x,y+.055,z],[.035,.095,.035],6,4);
 }
 // small grass tuft blades on the lawn, not on the entry path
 for(let i=0;i<1700;i++){
  const x=-11+rnd()*17,z=-6+rnd()*11.0;
  if((x>-5.5&&x<3.5&&z<2.4)||(Math.abs(x+1.1)<.9&&z>3.4)||(x>3.3&&x<5.6&&z<5))continue;
  const h=.045+rnd()*.1,k='grassBlade'+Math.floor(rnd()*3);
  tri(k,[x-.016,.06,z],[x+.012,.06,z],[x+.025,.06+h,z-.015]);
  tri(k,[x+.012,.06,z],[x-.016,.06,z],[x+.025,.06+h,z-.015]);
 }
 // roadside mailbox, rounded lid, mounting post and brass latch
 box('frame',[-2.74,.8,5.17],[.1,1.5,.1]);
 box('mailbox',[-2.74,1.56,5.19],[.48,.42,.36]);
 cylinder('mailbox',[-2.98,1.76,5.19],[-2.50,1.76,5.19],.18,.18,14);
 box('chrome',[-2.74,1.6,5.38],[.075,.045,.015]);
 box('plate',[-2.74,1.44,5.38],[.13,.047,.012]);
}
function house(){
 const cx=-1,front=2.2,back=-4.4,left=-5.2,right=3.2,eave=6.25,ridge=8.15;
 const opens=[[-3.6,4.82,1.45,1.65],[1.4,4.82,1.55,1.65],[-3.65,1.78,1.1,1.60],[1.55,1.78,1.1,1.60],[-1.1,1.34,1.13,2.45]];
 wallGrid('stucco',left,right,.14,eave,front,opens);
 box('stucco',[cx,3.2,back],[8.4,6.13,.23]);
 // side walls also include real apertures via the same wall subdivision with rotation
 const before=batch('stucco').p.length;
 wallGrid('stucco',-4.4,2.2,.14,eave,0,[[-2.7,4.78,1,1.65],[.35,4.78,1,1.65],[-2.65,1.75,1,1.65],[.35,1.75,1,1.65]]);
 const sb=batch('stucco');
 for(let i=before;i<sb.p.length;i+=3){const z=sb.p[i],x=sb.p[i+2];sb.p[i]=right-x;sb.p[i+2]=z;const nx=sb.n[i],nz=sb.n[i+2];sb.n[i]=-nz;sb.n[i+2]=nx;}
 box('stucco',[left,3.2,-1.1],[.22,6.13,6.6]);
 tri('stucco',[right,eave,front],[right,ridge,-1.1],[right,eave,back]);
 tri('stucco',[left,eave,back],[left,ridge,-1.1],[left,eave,front]);
 box('foundation',[cx,.18,-1.1],[8.48,.32,6.68]);
 for(const o of opens.slice(0,4))windowFront(o[0],o[1],front,o[2],o[3]);
 for(const z of [-2.7,.35])for(const y of [1.75,4.78])windowSide(right,y,z);
 // windows and sills on rear and unseen left surfaces remain modeled
 for(const x of [-3.6,1.4])for(const y of [1.8,4.82]){
  box('reveal',[x,y,back-.13],[1.4,1.65,.04]);box('glass',[x,y,back-.16],[1.23,1.49,.02]);
  for(const a of [-1,1])box('frame',[x+a*.67,y,back-.19],[.07,1.65,.05]);
  for(const a of [-1,1])box('frame',[x,y+a*.79,back-.19],[1.4,.07,.05]);
  box('frame',[x,y,back-.2],[.06,1.6,.05]);box('sill',[x,y-.91,back-.18],[1.63,.13,.26]);
 }
 box('door',[-1.1,1.34,front-.065],[1.08,2.41,.12]);
 for(const y of [.81,1.87])for(const x of [-1.33,-.87]){
  box('doorPanel',[x,y,front+.013],[.34,.8,.016]);
  for(const dx of [-.17,.17])box('doorTrim',[x+dx,y,front+.03],[.025,.8,.025]);
  for(const dy of [-.4,.4])box('doorTrim',[x,y+dy,front+.03],[.365,.025,.025]);
 }
 box('chrome',[-1.53,1.29,front+.086],[.03,.18,.04]);box('chrome',[-1.49,1.33,front+.12],[.12,.025,.03]);
 // Roof and gutter assemblies
 roof(9.1,cx,2.68,-4.88,eave,8.22);
 for(const x of [-4.9,2.98]){line('gutter',[x,6.18,2.75],[x,5.87,2.78],.052);line('gutter',[x,5.87,2.78],[x,.32,2.78],.05);line('gutter',[x,.32,2.78],[x,.2,3.00],.048);}
 line('gutter',[-5.6,6.20,2.7],[3.6,6.20,2.7],.065);
 // The porch has a shallow tiled shed roof, ivory posts and stone step.
 for(const x of [-2.78,.73]){
  box('stucco',[x,1.47,3.71],[.26,2.67,.28]);box('sill',[x,.2,3.71],[.4,.18,.41]);box('sill',[x,2.83,3.71],[.40,.18,.41]);
 }
 box('porchWood',[-1.02,2.91,3.68],[4.20,.20,.25]);
 box('porchWood',[-1.02,3.04,2.28],[4.2,.25,.17]);
 const porchW=4.55,porchFront=4.04,porchBack=2.20,py=2.96,slope=.22;
 quad('roofUnder',[-3.295,py,porchFront],[1.255,py,porchFront],[1.255,py+slope*(porchFront-porchBack),porchBack],[-3.295,py+slope*(porchFront-porchBack),porchBack]);
 for(let x=-3.17;x<1.19;x+=.285)for(let z=porchBack;z<porchFront;z+=.48)roofTile('tile'+Math.floor(rnd()*5),x,z,0,py+slope*(porchFront-z),-slope,1);
 box('fascia',[-1.02,py-.06,porchFront],[4.63,.13,.12]);
 for(const x of [-3.34,1.30])line('porchWood',[x,py,porchFront],[x,py+slope*(porchFront-porchBack),porchBack],.06);
 box('step',[-1.02,.155,3.4],[3.9,.22,1.9]);box('step',[-1.02,.10,4.43],[3.65,.13,.3]);
 // Chimney with open cap and small clay-tiled crown
 box('stucco',[1.8,8.10,-2.1],[.63,1.65,.68]);box('sill',[1.8,8.92,-2.1],[.78,.12,.81]);
 box('chimneyDark',[1.8,9.09,-2.1],[.64,.3,.68]);
 for(const x of [1.49,2.11])for(const z of [-2.4,-1.8])box('stucco',[x,9.09,z],[.09,.36,.09]);
 box('tile2',[1.8,9.31,-2.1],[.93,.12,.92]);
 // warm black metal lantern next to the door
 line('frame',[-2.13,2.25,2.3],[-2.13,2.25,2.56],.025);
 box('lamp',[-2.13,2.02,2.53],[.16,.25,.12]);box('frame',[-2.13,2.19,2.53],[.24,.07,.23]);box('frame',[-2.13,1.84,2.53],[.23,.07,.21]);
 for(const x of [-2.23,-2.03])for(const z of [2.44,2.62])line('frame',[x,1.87,z],[x,2.17,z],.013);
 // timber side gate
 for(let i=0;i<12;i++)box('wood',[5.1+i*.16,1.08,-2.8],[.14,2,.09]);
 box('wood',[5.98,.7,-2.73],[1.95,.1,.12]);box('wood',[5.98,1.64,-2.73],[1.95,.1,.12]);
}
function landscape(){
 box('grass',[-1,-.17,-1],[34,.32,35]);
 // distant rolling land is also real low frequency triangulated terrain
 const pts=[],cols=35,rows=17;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const x=-75+i*4.5,z=-16-j*4.7;
  const y=-1+Math.max(0,(-z-22)/23)*(2.4+1.7*Math.sin(x*.08)+1.2*Math.sin(x*.2+z*.07));
  pts.push([x,y,z]);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+1,c=a+cols+2,d=a+cols+1;
  quad('hill'+((i+j)%3),pts[a],pts[b],pts[c],pts[d]);
 }
 for(let i=0;i<18;i++){const x=-32+rnd()*65,z=-19-rnd()*13;if(i%3===0)cypress(x,z,3+rnd()*3);else olive(x,z,2.8+rnd()*1.6);}
}
const palette={
 stucco:['#eee2c8',.91,0,'stucco'],foundation:['#b5aa91',.93,0,'stone'],roofUnder:['#683c28',.95,0],fascia:['#534737',.8,0],gutter:['#4c4b40',.58,.25],porchWood:['#826448',.84,0],
 tile0:['#bd7044',.85,0,'tile'],tile1:['#b06136',.84,0,'tile'],tile2:['#cb8551',.80,0,'tile'],tile3:['#a45531',.86,0,'tile'],tile4:['#d09660',.86,0,'tile'],
 reveal:['#554d43',.9,0],frame:['#323938',.56,.15],glass:['#46606a',.14,.18],sill:['#c8b998',.88,0,'stone'],curtain:['#baa98c',.98,0],door:['#4c5351',.72,0],doorPanel:['#414746',.8,0],doorTrim:['#5a615c',.7,0],porchWood:['#826f55',.84,0],
 stone0:['#b5a487',.95,0,'stone'],stone1:['#cabaa0',.95,0,'stone'],stone2:['#a99f89',.95,0,'stone'],stone3:['#c2b195',.95,0,'stone'],stone4:['#d0c1a6',.95,0,'stone'],mortar:['#827b69',1,0],step:['#bcab8c',.94,0,'stone'],sidewalk:['#afa99a',.92,0,'stone'],
 leaf0:['#526323',.97,0],leaf1:['#7f8533',.97,0],leaf2:['#687d2e',.96,0],leaf3:['#465626',.97,0],leaf4:['#899340',.97,0],
 olive0:['#7a8052',.96,0],olive1:['#626e40',.97,0],olive2:['#8b946a',.96,0],olive3:['#9ca578',.96,0],cypress:['#42512d',.98,0],bark:['#65513b',.98,0],
 grass:['#8c8d49',.97,0,'grass'],grassBlade0:['#828b39',.98,0],grassBlade1:['#a1a050',.98,0],grassBlade2:['#707d2d',.98,0],lavender:['#7f789c',.98,0],pot:['#99623c',.9,0],potRim:['#b07646',.85,0],soil:['#393326',1,0],
 asphalt:['#77716c',.95,0,'asphalt'],marking:['#dbd6be',.85,0],blue:['#2162a0',.28,.38],tire:['#242526',.92,0],alloy:['#b8b9b0',.26,.8],trim:['#242c2e',.66,.05],seam:['#243c4b',.63,0],chrome:['#9fa69f',.3,.78],lamp:['#efe5be',.2,.10],red:['#b53924',.35,.1],plate:['#cbc4ac',.75,0],
 mailbox:['#484a46',.72,.2],chimneyDark:['#463c2e',.92,0],wood:['#815b35',.94,0,'tile'],
 hill0:['#849074',1,0],hill1:['#929c80',1,0],hill2:['#798871',1,0]
};
export default class SceneSystem extends createSystem({priority:0}){
 init(){
  seed=8137;batches.clear();
  this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:.1,far:200}});
  this.spawn.light({key:'light.sun',kind:'directional',color:[1,.89,.70,1],intensity:3.15,transform:{rotationEulerDegrees:[-40,-55,0]},shadow:{enabled:true,mapSize:2048,center:[0,2,0],orthographicSize:32,near:1,far:85,lightDistance:40,bias:.0003,normalBias:.025,strength:.84,filterRadius:1.7}});
  this.spawn.light({key:'light.ambient',kind:'ambient',color:[.72,.80,1,1],intensity:.16});
  const sampler=createSamplerHandle('surface.repeat');this.assetsRegistry.register(sampler);this.assetsRegistry.markReady(sampler,createSamplerAsset({label:'Surface grain repeat'}));
  const textures={};
  for(const kind of ['stucco','stone','tile','asphalt','grass']){
   const h=createTextureHandle('procedural.'+kind),N=128,bytes=new Uint8Array(N*N*4);
   for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const r=rnd(),grain=(r-.5)*(kind==='asphalt'?85:kind==='grass'?95:35);
    let value=kind==='asphalt'?182:kind==='grass'?210:235;
    value+=grain+8*Math.sin(x*.21)*Math.sin(y*.29);
    for(let j=0;j<3;j++)bytes[(y*N+x)*4+j]=Math.max(0,Math.min(255,value+(j===2&&kind==='grass'?-8:0)));
    bytes[(y*N+x)*4+3]=255;
   }
   this.assetsRegistry.register(h);this.assetsRegistry.markReady(h,createTextureAsset({label:'Deterministic '+kind+' grain',dimension:'2d',width:N,height:N,format:'rgba8unorm-srgb',colorSpace:'srgb',semantic:'base-color',sourceData:{bytes,bytesPerRow:N*4}}));textures[kind]={texture:h,sampler};
  }
  landscape();road();house();garden();car();
  for(const [k,q] of batches){
   const pal=palette[k];if(!pal)throw new Error('Missing palette '+k);
   const mat=createMaterialHandle('material.'+k);this.assetsRegistry.register(mat);this.assetsRegistry.markReady(mat,createStandardMaterialAsset({label:k,baseColorFactor:color.srgbHex(pal[0]),roughnessFactor:pal[1],metallicFactor:pal[2],baseColorTexture:pal[3]?textures[pal[3]]:null,clearcoatFactor:k==='blue'?.42:0,clearcoatRoughnessFactor:.18}));
   this.spawn.mesh({key:'scene.'+k,mesh:mesh.triangleList({label:k+' authored batch',positions:new Float32Array(q.p),normals:new Float32Array(q.n),uvs:new Float32Array(q.uv),indices:new Uint32Array(q.idx)}),material:mat,castShadow:!['asphalt','marking','hill0','hill1','hill2','grass'].includes(k),receiveShadow:true});
  }
 }
}
EOF
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js')
s=p.read_text()
old="q.uv.push(...(uvs?uvs[j]:[[a[0]+a[2],a[1]],[b[0]+b[2],b[1]],[c[0]+c[2],c[1]]][j]));"
new="const v=[a,b,c][j];const axis=Math.abs(n[1])>Math.abs(n[0])&&Math.abs(n[1])>Math.abs(n[2])?1:Math.abs(n[0])>Math.abs(n[2])?0:2;q.uv.push(...(uvs?uvs[j]:axis===1?[v[0]*1.5,v[2]*1.5]:axis===0?[v[2]*1.5,v[1]*1.5]:[v[0]*1.5,v[1]*1.5]));"
s=s.replace(old,new)
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
dist/index.html                     0.39 kB │ gzip:   0.28 kB
dist/assets/worker-BdC4y-G-.js    880.99 kB
dist/assets/dist-drhHfUqX.js    2,261.38 kB
dist/assets/audio-BKDg4u__.js      18.89 kB │ gzip:   7.07 kB
dist/assets/index-CFEJ8N9e.js   1,536.00 kB │ gzip: 385.13 kB

✓ built in 717ms
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

Status: error; recorder-measured coordinator wait: 3.509s.

## Public preview 1 feedback

Status: error.

```text
{"schema":"aperture.agent-house-diagnostic-preview.v3","scope":"diagnostic-only-no-score","phase":"canonical-camera","engine":"aperture","elapsedMs":67.61499999463558,"frames":[],"views":[],"artifacts":[],"observations":{"submissions":0,"drawCalls":0,"submittedTriangles":0,"indirectDrawCalls":0,"nonTriangleDrawCalls":0,"unknownTopologyDrawCalls":0,"unknownCommandBuffers":0,"renderPasses":0,"computePasses":0,"buffersCreated":0,"buffersDestroyed":0,"requestedBufferBytes":0,"texturesCreated":0,"texturesDestroyed":0,"renderPipelinesCreated":0,"workerTerminationCalls":0,"lastSubmitAt":null,"workersCreated":1,"deviceCount":0,"canvasCount":0,"liveRequestedBufferBytes":0,"capturedUploadBytes":0,"submittedVertexBufferIds":[],"workerEvidence":[{"id":0,"url":"http://127.0.0.1:33315/assets/worker-BdC4y-G-.js","name":"","connected":true,"started":false,"terminated":false,"snapshotMessages":0,"snapshotPayloadObserved":false,"lastSnapshotFrame":-1,"lastSnapshotAt":null,"errors":0,"sharedFrame":null,"sharedSequence":null}]},"nativeProof":{"native":true,"adapters":[],"devices":[],"canvasWebGPU":0,"webglAttempts":0,"submissions":0,"draws":0,"errors":[],"deviceLost":[]},"error":{"message":"$1.request is not a function","stack":"TypeError: $1.request is not a function\n    at Object.setCamera (http://127.0.0.1:33315/assets/index-CFEJ8N9e.js:5359:41446)\n    at http://127.0.0.1:33315/__benchmark/preview-client-v3.mjs:184:49\n    at async withDeadline (http://127.0.0.1:33315/__benchmark/preview-client-v3.mjs:39:12)\n    at async runDiagnosticPreview (http://127.0.0.1:33315/__benchmark/preview-client-v3.mjs:184:5)"}}
```

## Command f86c4e34f83948c09e604e2358995055

2026-10-13T00:55:08.083428+00:00 → 2026-10-13T00:55:09.354292+00:00; exit 0; duration 1.271s.

Command:

```sh
grep -n "function startGeneratedBrowserApp" /sdk/source/app/src/browser/app.ts; sed -n "699,750p" /sdk/source/app/src/devtools/entities.ts; sed -n "1,65p" /sdk/source/render/src/rendering/authoring-components-camera-light.ts; sed -n "1,100p" /sdk/source/webgpu/src/app/rendered-geometry-types.ts; python3 - <<'PY'
from pathlib import Path
p=Path("/work/src/main.js")
s=p.read_text().replace("const app=startGeneratedBrowserApp", "const app=await startGeneratedBrowserApp")
p.write_text(s)
PY
pnpm run build
```

Stdout:

```text
131:export async function startGeneratedBrowserApp(
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
    environmentMapId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent light authoring component.",
);

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

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-BdC4y-G-.js               880.99 kB
dist/assets/dist-drhHfUqX.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-DwG2w4NF.js              1,532.73 kB │ gzip: 384.24 kB

✓ built in 701ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command e493f961a07447f7b19c2551b6dffdc9

2026-10-13T00:55:16.213262+00:00 → 2026-10-13T00:55:16.581875+00:00; exit 0; duration 0.369s.

Command:

```sh
grep -R -n "component.*toLowerCase\|componentName\|resolve.*Component\|componentId" /sdk/source/app/src/entity-lookup* | head -35; sed -n "130,165p" /sdk/source/app/src/browser/app.ts; node --input-type=module - <<'JS'
import Scene from "./src/scene.js";
console.log("Scene module imported",typeof Scene);
JS
```

Stdout:

```text

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const renderProfile = resolveGeneratedEffectiveRenderDefaults(
    config.render,
    readGeneratedRenderProfileEnvironment(canvas),
  );
  const render = renderProfile.render;
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  status.render = resolveGeneratedRenderSettings(
    render,
    undefined,
    renderProfile.profile,
  );
  status.systems = options.systemManifest ?? [];
  const demandDriven = render?.cadence === "demand";
  const manual = render?.cadence === "manual";
  let webgpuResult: CreateWebGpuAppResult | null = null;
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });
  const scheduleDemandStep = demandDriven
    ? createGeneratedDemandStepScheduler(worker)
    : null;
  const lifetime = new AbortController();
  const teardown: (() => void)[] = [];
  if (scheduleDemandStep !== null) teardown.push(scheduleDemandStep.dispose);
  let frames: ReturnType<typeof createGeneratedBrowserFrameControl> | null =
    null;
Scene module imported function
```

Stderr:

```text

```

## Command f30928fae44b4c51a2df56e7ca7af8eb

2026-10-13T00:55:23.290704+00:00 → 2026-10-13T00:55:23.408297+00:00; exit 2; duration 0.118s.

Command:

```sh
grep -n "Direct CPU extraction\|createApertureHeadlessRunner" /sdk/docs/AI_TOOLING.md | head -20; grep -R -n "componentAliases\|resolveComponent\|component ===\|componentName" /sdk/source/app/src/entity-lookup | head -30; cat /sdk/source/app/src/headless.ts | head -80; sed -n "1,140p" /sdk/source/app/src/headless/runner.ts
```

Stdout:

```text
143:### Direct CPU extraction from an imported system
151:import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
154:const runner = await createApertureHeadlessRunner({
import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  renderSnapshotToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  componentRegistryFromWorld,
  findDefinedComponent,
  loadScene,
  saveScene,
  serializeEntityRef,
  type ApertureSceneDocument,
  type Entity,
  type LoadSceneResult,
  type SceneDocumentDiagnostic,
} from "@aperture-engine/simulation";
import type { SimulationFixedStepClockState } from "@aperture-engine/runtime";
import {
  ApertureAppError,
  createApertureApp,
  assertApertureBootstrapAllowed,
  disposeApertureApp,
  type ApertureApp,
  type CreateApertureAppOptions,
} from "./advanced.js";
import { defineApertureConfig, type ApertureConfig } from "./config.js";
import {
  createApertureEntityLookup,
  createApertureEntityLookupSnapshot,
  type ApertureEntityLookup,
  type ApertureEntityLookupSnapshot,
} from "./entity-lookup.js";
import {
  createSignalSummary,
  type ApertureSystemInstance,
  type SignalSummary,
} from "./systems.js";
import {
  findDefinedResource,
  type ApertureResourceSummaryEntry,
} from "./systems/resources.js";
import {
  mirrorSourceAssetRegistryFromMessage,
  serializeSourceAssetRegistry,
  type SerializedSourceAssetRegistry,
  type SourceAssetMirrorReport,
} from "./asset-mirror.js";
import { jsonSafeValue } from "./internal/json-safe.js";
import {
  createApertureGeneratedFailureStatus,
  type ApertureGeneratedDiagnosticsStatus,
} from "./diagnostics.js";
import { createInputSummary, type ApertureInputSummary } from "./input.js";
import {
  advanceGeneratedInputFrame,
  createGeneratedInputEventMessage,
  drainGeneratedInputEventMessagesForFrame,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedInputEventMessage,
} from "./input/events.js";
import {
  restoreApertureFrameTime,
  snapshotApertureFrameTime,
  type ApertureFrameTimeState,
} from "./systems/frame-time.js";
import {
  restoreApertureRandom,
  snapshotApertureRandom,
  type ApertureRandomState,
} from "./systems/random.js";

export const APERTURE_SESSION_SNAPSHOT_FORMAT =
  "aperture.session-snapshot" as const;
export const APERTURE_SESSION_SNAPSHOT_VERSION = 1 as const;
export const APERTURE_SESSION_SNAPSHOT_APP_VERSION = "0.3.0" as const;

export interface CreateApertureHeadlessRunnerOptions extends Omit<
  CreateApertureAppOptions,
  "config"
```

Stderr:

```text
grep: /sdk/source/app/src/entity-lookup: No such file or directory
sed: can't read /sdk/source/app/src/headless/runner.ts: No such file or directory
```

## Command ad83de9f6ca84168a749349820e39afe

2026-10-13T00:55:29.438081+00:00 → 2026-10-13T00:55:29.555498+00:00; exit 0; duration 0.117s.

Command:

```sh
sed -n "143,195p" /sdk/docs/AI_TOOLING.md; grep -n "component" /sdk/source/app/src/entity-lookup.ts | head -35; grep -n "near\|Camera" /sdk/source/app/src/entity-lookup.ts | tail -25
```

Stdout:

````text
### Direct CPU extraction from an imported system

For an in-process CPU smoke test, pass imported modules to the headless runner.
A default-imported class needs a module wrapper:

```ts
import SceneSystem from "./systems/scene.system.js";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";

const runner = await createApertureHeadlessRunner({
  config: defineApertureConfig({ mode: "headless", systems: [] }),
  systems: [{ default: SceneSystem }],
});
try {
  const { snapshot, status } = runner.step(1 / 60, 0);
  console.log(snapshot.meshDraws.length, status.diagnostics);
} finally {
  const cleanupErrors = await disposeApertureApp(runner.app);
  if (cleanupErrors.length > 0) {
    console.error("Aperture cleanup failed", cleanupErrors);
    process.exitCode = 1;
  }
}
```

An imported namespace can be passed as `systems: [sceneModule]`. The runner's
`systems` option contains imported module objects; `config.systems` contains file
patterns that hosts discover. Set priority in the class's
`createSystem({ priority: 0 })` descriptor. Complete cleanup uses the shared
helper from `app/advanced`; direct `runner.app.dispose()` releases features only.
Stop using a disposed runner. Nonempty cleanup errors require a process restart;
report them while preserving any original operation failure.

This runs the ordinary ECS and render-extraction path without a browser. It
does not render pixels or reload cached native imports; use the CLI source-realm
flow below for source isolation and refresh.

### Smaller validation loop: `aperture headless` + `aperture render`

For a faster inner loop, the ECS/simulation layer can run in **pure Node** with
no browser. `aperture headless <config> --out <bundle.json>` loads a
`mode: "headless"` config and its `*.system.ts` (via native Node TypeScript
imports; Node 22.18+ on 22.x or 23.6+), steps a fixed timestep, optionally injects input, and writes a
self-contained `aperture.render-bundle` (the extracted `RenderSnapshot`, typed
asset closure, render target, schema metadata, diagnostics, and digest):

```sh
pnpm exec aperture headless aperture.headless.config.ts --frames 30 --out snapshot.json
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --json   # status report
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --inject input.json
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode strict
````

Stderr:

```text

```

## Command 36f0bd78271d4dfab59adda30a564de9

2026-10-13T00:55:55.217285+00:00 → 2026-10-13T00:55:57.943836+00:00; exit 1; duration 2.727s.

Command:

```sh
node --input-type=module - <<'JS'
import Scene from './src/scene.js';
import {defineApertureConfig} from '@aperture-engine/app/config';
import {createApertureHeadlessRunner} from '@aperture-engine/app/headless';
import {disposeApertureApp} from '@aperture-engine/app/advanced';
const runner=await createApertureHeadlessRunner({config:defineApertureConfig({mode:'headless',systems:[],render:{defaultCamera:false,defaultLight:false}}),systems:[{default:Scene}]});
try{
 const {snapshot,status}=runner.step(1/60,0);
 console.log('draws',snapshot.meshDraws.length,'diagnostics',JSON.stringify(status.diagnostics));
 console.log('camera',JSON.stringify(runner.app.entities.get({key:'camera.main'})));
}finally{console.log('cleanup',await disposeApertureApp(runner.app));}
JS
```

Stdout:

```text
draws 63 diagnostics []
cleanup []
```

Stderr:

```text
file:///work/[eval1]:9
 console.log('camera',JSON.stringify(runner.app.entities.get({key:'camera.main'})));
                                                         ^

TypeError: Cannot read properties of undefined (reading 'get')
    at file:///work/[eval1]:9:58
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)

Node.js v24.21.0
```

## Command fa35df6d2bbc444c9a7431909c8d97b7

2026-10-13T00:56:37.254697+00:00 → 2026-10-13T00:56:38.580387+00:00; exit 0; duration 1.326s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/main.js');s=p.read_text().replace("component:'Camera'","component:'aperture.render.camera'");p.write_text(s)
p=Path('/work/src/scene.js');s=p.read_text()
s=s.replace("const length=.58,rad=.142,steps=8;", "const length=.58,rad=.142,steps=8;\n const tq=(a,b,c,d)=>dir===1?quad(k,d,c,b,a):quad(k,a,b,c,d);")
s=s.replace("quad(k,at(", "tq(at(")
s=s.replace("tri('stucco',[right,eave,front],[right,ridge,-1.1],[right,eave,back]);","tri('stucco',[right,eave,back],[right,ridge,-1.1],[right,eave,front]);")
s=s.replace("tri('stucco',[left,eave,back],[left,ridge,-1.1],[left,eave,front]);","tri('stucco',[left,eave,front],[left,ridge,-1.1],[left,eave,back]);")
s=s.replace("cq('glass',side===1?front:front.reverse());cq('glass',side===1?back:back.reverse());","cq('glass',side===1?front.reverse():front);cq('glass',side===1?back.reverse():back);")
s=s.replace("cq('glass',[[-.60,1.14,.83],[-.60,1.14,-.83],[.045,1.735,-.72],[.045,1.735,.72]]);","cq('glass',[[.045,1.735,.72],[.045,1.735,-.72],[-.60,1.14,-.83],[-.60,1.14,.83]]);")
s=s.replace("cq('glass',[[1.32,1.70,.71],[1.32,1.70,-.71],[1.94,1.14,-.79],[1.94,1.14,.79]]);","cq('glass',[[1.94,1.14,.79],[1.94,1.14,-.79],[1.32,1.70,-.71],[1.32,1.70,.71]]);")
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
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-CTCee9hv.js               881.03 kB
dist/assets/dist-BaQC7ONp.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-AdQ5SLu8.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 735ms
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

Status: ok; recorder-measured coordinator wait: 57.449s.

## Public preview 2 feedback

Status: ok.

## Public preview 2 feedback

Status: ok.

## Public note — 2026-10-13T00:59:08.661309+00:00

```
Inspecting my second preview canonical, left-orbit, and rear-orbit images after successful native rendering and geometry preflight.
```

## Command d48f34c4abe74cab8aaff6a5670842d1

2026-10-13T01:01:49.080652+00:00 → 2026-10-13T01:01:50.407868+00:00; exit 0; duration 1.327s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js');s=p.read_text()
s=s.replace("if(i>0)tri(k,a,b,d,[n(a),n(b),n(d)]);","if(i>0)tri(k,a,d,b,[n(a),n(d),n(b)]);").replace("if(i<rings-1)tri(k,b,cc,d,[n(b),n(cc),n(d)]);","if(i<rings-1)tri(k,b,d,cc,[n(b),n(d),n(cc)]);")
s=s.replace("for(let row=0;row<12;row++)", "for(let row=0;row<9;row++)")
s=s.replace("const carOrigin=[3.7,.15,8.1],carYaw=-.13;","const carOrigin=[6.65,.15,7.15],carYaw=.72;")
s=s.replace("box('grass',[-1,-.17,-1],[34,.32,35]);","box('grass',[0,-.17,-25],[120,.32,110]);")
s=s.replace("Math.max(0,(-z-22)/23)*(2.4+1.7*Math.sin(x*.08)+1.2*Math.sin(x*.2+z*.07))","Math.min(1.5,Math.max(0,(-z-22)/23))*(2.4+1.7*Math.sin(x*.08)+1.2*Math.sin(x*.2+z*.07))")
s=s.replace("sb.p[i]=right-x;", "sb.p[i]=right-.24-x;")
# Left wall uses the same actual aperture grid, facing outward.
s=s.replace("box('stucco',[left,3.2,-1.1],[.22,6.13,6.6]);", """const lb=batch('stucco'),start=lb.p.length;
 wallGrid('stucco',-2.2,4.4,.14,eave,0,[[2.7,4.78,1,1.65],[-.35,4.78,1,1.65],[2.65,1.75,1,1.65],[-.35,1.75,1,1.65]]);
 for(let i=start;i<lb.p.length;i+=3){const z=lb.p[i],x=lb.p[i+2];lb.p[i]=left+.24+x;lb.p[i+2]=-z;const nx=lb.n[i],nz=lb.n[i+2];lb.n[i]=nz;lb.n[i+2]=-nx;}
 for(const z of [-2.7,.35])for(const y of [1.75,4.78])windowSide(left,y,z,1,1.65,-1);""")
s=s.replace("function windowSide(x,y,z,w=1,h=1.65){","function windowSide(x,y,z,w=1,h=1.65,side=1){")
s=s.replace("[x-.08,y,z]","[x-side*.08,y,z]").replace("[x-.065,y,z]","[x-side*.065,y,z]").replace("[x+.08,y-h/2-.06,z]","[x+side*.08,y-h/2-.06,z]").replace("[x+.02,y,z+a*","[x+side*.02,y,z+a*").replace("[x+.02,y+a*","[x+side*.02,y+a*").replace("[x+.025,y,z]","[x+side*.025,y,z]").replace("[x+.025,y-.12,z]","[x+side*.025,y-.12,z]")
# Reduce wheel radius and use a finer vehicle silhouette.
s=s.replace("const sections=[[-2.35,.76,.65,.88],[-2.15,.97,.73,1.04],[-1.45,1.02,.77,1.10],[-.55,1.00,.84,1.12],[.5,1.02,.9,1.12],[1.5,.99,.82,1.10],[2.1,.93,.72,1.0],[2.22,.83,.68,.91]];", "const sections=[[-2.35,.70,.61,.81],[-2.25,.85,.69,.92],[-2.05,.95,.75,1.025],[-1.65,1.005,.78,1.075],[-1.15,1.015,.80,1.10],[-.55,1.00,.84,1.12],[.1,1.015,.86,1.12],[.65,1.02,.86,1.12],[1.2,1.00,.85,1.12],[1.7,.97,.81,1.07],[2.07,.9,.75,1.0],[2.22,.80,.68,.91]];")
# Smooth normals on blue painted surfaces at shared coordinates, preserving hard creases.
s=s.replace("const mat=createMaterialHandle('material.'+k);", """if(k==='blue'){
 const groups=new Map();
 for(let i=0;i<q.p.length;i+=3){const key=q.p.slice(i,i+3).map(v=>v.toFixed(5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const source=q.n.slice();
 for(const ids of groups.values())for(const i of ids){let n=[0,0,0];for(const j of ids){const dot=source[i]*source[j]+source[i+1]*source[j+1]+source[i+2]*source[j+2];if(dot>.45)n=add(n,source.slice(j,j+3));}n=norm(n);q.n[i]=n[0];q.n[i+1]=n[1];q.n[i+2]=n[2];}
 }
 const mat=createMaterialHandle('material.'+k);""")
# All wheel geometry is transformed in vehicle space so axles track its heading.
s=s.replace("tube('tire',c,.40,.145,'z',32,10);","const tb=batch('tire'),begin=tb.p.length;tube('tire',[x,.57,z],.34,.12,'z',32,10);for(let n=begin;n<tb.p.length;n+=3){const v=cp(tb.p.slice(n,n+3));tb.p.splice(n,3,...v);const nn=tb.n.slice(n,n+3),co=Math.cos(carYaw),si=Math.sin(carYaw);tb.n.splice(n,3,nn[0]*co+nn[2]*si,nn[1],-nn[0]*si+nn[2]*co);}")
s=s.replace("]),.43,.43,28);","]),.355,.355,28);")
# Slightly rich saturated foliage, with no reflection tint.
s=s.replace("glass:['#46606a',.14,.18]","glass:['#44565a',.22,.08]")
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
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-w6z37ieh.js               882.02 kB
dist/assets/dist-BrxoC4bw.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-Bj-bsqXH.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 758ms
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

Status: ok; recorder-measured coordinator wait: 74.805s.

## Public preview 3 feedback

Status: ok.

## Public preview 3 feedback

Status: ok.

## Public note — 2026-10-13T01:04:14.872656+00:00

```
Inspecting the third and final preview images from the canonical, left-orbit, and rear-orbit cameras.
```

## Command fda3733c3f2f4493b150299d6d62b63a

2026-10-13T01:04:34.556322+00:00 → 2026-10-13T01:04:34.674026+00:00; exit 0; duration 0.118s.

Command:

```sh
date -u; wc -c /work/src/*.js; sed -n "160,265p" /work/src/scene.js
```

Stdout:

```text
Tue Oct 13 01:04:34 UTC 2026
  455 /work/src/config.js
 2068 /work/src/main.js
26056 /work/src/scene.js
  222 /work/src/worker.js
28801 total
 cq('blue',[[.02,1.76,-.77],[.02,1.76,.77],[1.26,1.77,.77],[1.26,1.77,-.77]]);
 cq('glass',[[.045,1.735,.72],[.045,1.735,-.72],[-.60,1.14,-.83],[-.60,1.14,.83]]);
 cq('glass',[[1.94,1.14,.79],[1.94,1.14,-.79],[1.32,1.70,-.71],[1.32,1.70,.71]]);
 for(const side of [-1,1]){
  const z=side;
  const front=[[-.48,1.17,.906*z],[.07,1.69,.789*z],[.64,1.69,.79*z],[.66,1.16,.929*z]];
  const back=[[.76,1.16,.931*z],[.74,1.69,.79*z],[1.23,1.69,.79*z],[1.77,1.16,.89*z]];
  cq('glass',side===1?front.reverse():front);cq('glass',side===1?back.reverse():back);
  cl('chrome',[-.53,1.14,.938*z],[1.88,1.14,.937*z],.014);
  cl('trim',[.69,1.13,.947*z],[.68,1.73,.79*z],.04);
  for(const x of [.48,1.55])cb('trim',[x,1.03,1.002*z],[.2,.045,.035]);
  cl('seam',[.66,.49,1.026*z],[.68,1.13,.975*z],.012);
  cl('seam',[1.72,.49,.985*z],[1.8,1.13,.94*z],.009);
  cb('blue',[-.42,1.15,1.095*z],[.30,.14,.18]);cb('glass',[-.40,1.17,1.185*z],[.21,.08,.021]);
 }
 cb('trim',[-2.32,.62,0],[.055,.26,1.55]);cb('trim',[-2.38,.43,0],[.04,.11,1.4]);
 for(const z of [-.45,-.25,0,.25,.45])cl('chrome',[-2.393,.55,z-.1],[-2.393,.55,z+.1],.009);
 cb('plate',[-2.40,.68,0],[.02,.16,.46]);
 for(const z of [-.70,.70]){
  cb('lamp',[-2.18,.94,z],[.23,.15,.39]);cb('lamp',[-2.33,.47,z],[.035,.075,.14]);
  cb('red',[2.15,.93,z],[.09,.23,.3]);
 }
 cb('trim',[2.225,.47,0],[.04,.13,1.6]);
 cl('trim',[1.44,1.785,0],[1.55,2.08,0],.012);
 for(const x of [-1.45,1.45])for(const side of [-1,1]){
  const z=1.02*side,c=cp([x,.57,z]);
  // Tire has a rounded tread crown and alloy hub; four true volumetric wheels.
  const tb=batch('tire'),begin=tb.p.length;tube('tire',[x,.57,z],.34,.12,'z',32,10);for(let n=begin;n<tb.p.length;n+=3){const v=cp(tb.p.slice(n,n+3));tb.p.splice(n,3,...v);const nn=tb.n.slice(n,n+3),co=Math.cos(carYaw),si=Math.sin(carYaw);tb.n.splice(n,3,nn[0]*co+nn[2]*si,nn[1],-nn[0]*si+nn[2]*co);}
  cylinder('tire',cp([x,.57,z-.09]),cp([x,.57,z+.09]),.355,.355,28);
  const outer=z+side*.153;
  cylinder('alloy',cp([x,.57,outer-side*.025]),cp([x,.57,outer]),.32,.32,24);
  cylinder('trim',cp([x,.57,outer]),cp([x,.57,outer+side*.01]),.275,.275,24);
  for(let j=0;j<10;j++){
   const a=j*Math.PI/5,b=a+.09;
   const pa=[x+Math.cos(a)*.09,.57+Math.sin(a)*.09,outer+side*.02];
   const pb=[x+Math.cos(b)*.29,.57+Math.sin(b)*.29,outer+side*.025];
   cl('alloy',pa,pb,.022);
  }
  cylinder('alloy',cp([x,.57,outer]),cp([x,.57,outer+side*.032]),.09,.09,16);
 }
 cl('seam',[-2.05,1.066,-.58],[-.62,1.142,-.7],.012);cl('seam',[-2.05,1.066,.58],[-.62,1.142,.7],.012);
}
function ribbon(k,center,width,y){
 for(let i=0;i<center.length-1;i++){
  const pa=center[Math.max(0,i-1)],pb=center[Math.min(center.length-1,i+1)];
  const qa=center[i],qb=center[i+1],pc=center[Math.min(center.length-1,i+2)];
  const na=norm([-(pb[2]-pa[2]),0,pb[0]-pa[0]]),nb=norm([-(pc[2]-qa[2]),0,pc[0]-qa[0]]);
  quad(k,[qa[0]-na[0]*width/2,y,qa[2]-na[2]*width/2],[qa[0]+na[0]*width/2,y,qa[2]+na[2]*width/2],[qb[0]+nb[0]*width/2,y,qb[2]+nb[2]*width/2],[qb[0]-nb[0]*width/2,y,qb[2]-nb[2]*width/2]);
 }
}
function road(){
 const pts=[];
 for(let x=-19;x<3;x+=.5)pts.push([x,0,8]);
 for(let j=0;j<=36;j++){const a=Math.PI/2-j/36*Math.PI/2;pts.push([3+7*Math.cos(a),0,1+7*Math.sin(a)]);}
 for(let z=.5;z>-20;z-=.5)pts.push([10,0,z]);
 ribbon('asphalt',pts,4.2,.025);
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);
  if(l<.01)continue;
  const nx=-dz/l,nz=dx/l,angle=Math.atan2(-dz,dx);
  for(const side of [-1,1]){
   box('sill',[(a[0]+b[0])/2+nx*side*2.17,.095,(a[2]+b[2])/2+nz*side*2.17],[l-.012,.14,.28],angle);
   box('sidewalk',[(a[0]+b[0])/2+nx*side*2.54,.065,(a[2]+b[2])/2+nz*side*2.54],[l-.013,.1,.47],angle);
  }
  if(i%5<2)box('marking',[(a[0]+b[0])/2-.0*nx,.037,(a[2]+b[2])/2-.0*nz],[l+.008,.012,.115],angle);
 }
}
function garden(){
 path();
 stoneSegment([-12,0,5.3],[-2.1,0,5.3],.9);stoneSegment([-.15,0,5.3],[4.5,0,5.3],.9);
 for(let j=0;j<12;j++){
  const a=j/12*Math.PI/2,b=(j+1)/12*Math.PI/2;
  stoneSegment([4.5+3.3*Math.sin(a),0,2+3.3*Math.cos(a)],[4.5+3.3*Math.sin(b),0,2+3.3*Math.cos(b)],.85);
 }
 stoneSegment([7.8,0,2],[7.8,0,-9],.85);
 for(const x of [-2.1,-.15,4.5])pillar(x,5.3);
 for(let x=-11;x<4.5;x+=.75){if(x>-2.4&&x<.2)continue;bush([x,.43,4.74],.45,14);}
 for(let z=-8;z<3.8;z+=.72)bush([7.23,.44,z],.48,16);
 for(const [x,z,s] of [[-4.3,2.6,.7],[2.6,2.9,.7],[-2.8,3.7,.5],[.3,3.9,.65],[4.0,-1,.7],[4.5,-3,.75],[-6.1,-1,1.1]])bush([x,.25,z],s,32);
 olive(-8,2.6,4.8);olive(7,-4,4.6);olive(-8,-5,5.1);
 cypress(-7,-6.6,6.5);cypress(-10,-9,5.3);cypress(6.5,-9,5.8);
 // terracotta planters beside the sheltered entry
 for(const [x,z,s] of [[-2.25,3.16,.34],[.22,3.16,.29],[2.2,3.7,.37]]){
  cylinder('pot',[x,.17,z],[x,.68,z],s*.72,s,18);cylinder('potRim',[x,.65,z],[x,.73,z],s*1.03,s*1.03,18);
  cylinder('soil',[x,.734,z],[x,.745,z],s*.86,s*.86,16);
  bush([x,.87,z],s*1.25,20);
 }
 // lavender flowers around low shrubs, individual slender stems and blossom clusters
 for(let j=0;j<100;j++){
  const side=j%2===0?-1:1,x=-1.1+side*(1.25+rnd()*1.2),z=3.8+rnd()*.65,y=.33+rnd()*.25;
  line('leaf2',[x,.14,z],[x,y,z],.009);
  ellipsoid('lavender',[x,y+.055,z],[.035,.095,.035],6,4);
 }
 // small grass tuft blades on the lawn, not on the entry path
 for(let i=0;i<1700;i++){
  const x=-11+rnd()*17,z=-6+rnd()*11.0;
  if((x>-5.5&&x<3.5&&z<2.4)||(Math.abs(x+1.1)<.9&&z>3.4)||(x>3.3&&x<5.6&&z<5))continue;
  const h=.045+rnd()*.1,k='grassBlade'+Math.floor(rnd()*3);
  tri(k,[x-.016,.06,z],[x+.012,.06,z],[x+.025,.06+h,z-.015]);
  tri(k,[x+.012,.06,z],[x-.016,.06,z],[x+.025,.06+h,z-.015]);
 }
 // roadside mailbox, rounded lid, mounting post and brass latch
 box('frame',[-2.74,.8,5.17],[.1,1.5,.1]);
 box('mailbox',[-2.74,1.56,5.19],[.48,.42,.36]);
 cylinder('mailbox',[-2.98,1.76,5.19],[-2.50,1.76,5.19],.18,.18,14);
 box('chrome',[-2.74,1.6,5.38],[.075,.045,.015]);
```

Stderr:

```text

```

## Command fa08fcced3b045bc83b101964c7d1f3b

2026-10-13T01:06:46.547064+00:00 → 2026-10-13T01:06:50.527274+00:00; exit 0; duration 3.980s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js');s=p.read_text()
s=s.replace("const carOrigin=[6.65,.15,7.15],carYaw=.72;", "const carOrigin=[6.55,-.085,6.35],carYaw=.90;")
s=s.replace("cq('blue',[[.02,1.76,-.77],[.02,1.76,.77],[1.26,1.77,.77],[1.26,1.77,-.77]]);", """const crown=(u,v)=>[.02+u*1.24,1.765+u*.005+.068*Math.sin(u*Math.PI)*(1-v*v),.77*v];
 for(let i=0;i<6;i++)for(let j=0;j<8;j++){const u=i/6,v=-1+j/4;cq('blue',[crown(u,v),crown(u,v+.25),crown(u+1/6,v+.25),crown(u+1/6,v)]);}""")
s=s.replace("cb('trim',[-2.32,.62,0],[.055,.26,1.55]);", "cb('trim',[-2.37,.65,0],[.055,.22,1.45]);")
s=s.replace("cb('plate',[-2.40,.68,0],[.02,.16,.46]);", """cb('plate',[-2.411,.61,0],[.022,.12,.45]);
 cl('chrome',[-2.405,.76,-.7],[-2.405,.76,.7],.012);
 cylinder('chrome',cp([-2.43,.785,0]),cp([-2.405,.785,0]),.072,.072,18);
 cylinder('trim',cp([-2.438,.785,0]),cp([-2.432,.785,0]),.049,.049,16);""")
s=s.replace("cb('lamp',[-2.18,.94,z],[.23,.15,.39]);", """const side=z<0?-1:1;
 const lens=[[-2.295,.825,.43*side],[-2.19,.975,.43*side],[-2.095,.976,.84*side],[-2.265,.824,.78*side]];
 const n=cross(sub(lens[1],lens[0]),sub(lens[2],lens[0]));
 cq('lamp',n[0]>0?lens.reverse():lens);
 cl('chrome',lens[0],lens[1],.014);cl('chrome',lens[1],lens[2],.014);cl('chrome',lens[2],lens[3],.014);cl('chrome',lens[3],lens[0],.014);
 for(const zz of [.53,.68,.79])cl('lampBright',[-2.25,.853,zz*side],[-2.15,.95,zz*side],.019);""")
s=s.replace("cb('red',[2.15,.93,z],[.09,.23,.3]);", "cb('red',[2.15,.91,z],[.09,.18,.3]);")
s=s.replace("const z=1.02*side,c=cp([x,.57,z]);", """const z=1.02*side,c=cp([x,.57,z]);
 for(let j=0;j<18;j++){const a=j*Math.PI/18,b=(j+1)*Math.PI/18;cl('trim',[x+.475*Math.cos(a),.57+.475*Math.sin(a),1.037*side],[x+.475*Math.cos(b),.57+.475*Math.sin(b),1.037*side],.023);}
 """)
s=s.replace("cl('seam',[-2.05,1.066,-.58]", """for(const side of [-1,1]){
 cl('chrome',[-.92,.42,.984*side],[1.09,.42,.984*side],.013);
 cl('blueHighlight',[-1.0,.90,1.027*side],[1.15,.90,1.026*side],.015);
 }
 cl('seam',[-2.05,1.066,-.58]""")
s=s.replace("grass'?95:35", "grass'?24:kind==='stucco'?12:26")
s=s.replace("blue:['#2162a0',.28,.38]", "blue:['#2162a0',.24,.32],blueHighlight:['#3d77a1',.32,.3],lampBright:['#f7f2da',.12,.12]")
s=s.replace("glass:['#44565a',.22,.08]", "glass:['#394a52',.12,.26]")
s=s.replace("box('tile2',[1.8,9.31,-2.1],[.93,.12,.92]);", """box('tile2',[1.8,9.29,-2.1],[.93,.09,.92]);
 const cap=[[1.31,9.335,-2.58],[2.29,9.335,-2.58],[2.29,9.335,-1.62],[1.31,9.335,-1.62]],peak=[1.8,9.54,-2.1];
 for(let j=0;j<4;j++)tri('tile2',cap[(j+1)%4],cap[j],peak);""")
p.write_text(s)
PY
pnpm run build
node --input-type=module - <<'JS'
import Scene from './src/scene.js';
import {defineApertureConfig} from '@aperture-engine/app/config';
import {createApertureHeadlessRunner} from '@aperture-engine/app/headless';
import {disposeApertureApp} from '@aperture-engine/app/advanced';
const runner=await createApertureHeadlessRunner({config:defineApertureConfig({mode:'headless',systems:[],render:{defaultCamera:false,defaultLight:false}}),systems:[{default:Scene}]});
try{
 const {snapshot,status}=runner.step(1/60,0);
 console.log('Final scene extraction:',snapshot.meshDraws.length,'mesh batches; diagnostics:',JSON.stringify(status.diagnostics));
 console.log('Snapshot views',snapshot.views.length);
}finally{console.log('Cleanup errors',await disposeApertureApp(runner.app));}
JS
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-BYXJB-2T.js               883.18 kB
dist/assets/dist-C5TUwv7x.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-DeUZg9tk.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 682ms
Final scene extraction: 65 mesh batches; diagnostics: []
Snapshot views 1
Cleanup errors []
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command f3cb7986e47546cd8e4621950c7b98aa

2026-10-13T01:08:35.538349+00:00 → 2026-10-13T01:08:41.037219+00:00; exit 0; duration 5.499s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js');s=p.read_text()
insert="""
function leaf(k,c,length,width,yaw,pitch){
 const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const at=(x,y,z)=>[c[0]+co*x+si*(z*cp-y*sp),c[1]+y*cp+z*sp,c[2]-si*x+co*(z*cp-y*sp)];
 const points=[at(-length,0,0),at(0,0,width),at(length,0,0),at(0,0,-width)];
 const top=at(0,.016,0),bottom=at(0,-.006,0);
 for(let j=0;j<4;j++){tri(k,points[(j+1)%4],points[j],top);tri(k,points[j],points[(j+1)%4],bottom);}
}
"""
s=s.replace("function olive(x,z,h=4.5){",insert+"\nfunction olive(x,z,h=4.5){")
old="for(let j=0;j<28;j++){const an=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.9;ellipsoid('olive'+Math.floor(rnd()*4),[b[0]+Math.cos(an)*r,b[1]+(rnd()-.5)*.7,b[2]+Math.sin(an)*r],[.26+rnd()*.24,.14+rnd()*.22,.22+rnd()*.25],7,4);}"
new="""for(let j=0;j<28;j++){
 const an=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.9,center=[b[0]+Math.cos(an)*r,b[1]+(rnd()-.5)*.7,b[2]+Math.sin(an)*r];
 ellipsoid('olive'+Math.floor(rnd()*4),center,[.15+rnd()*.1,.1+rnd()*.1,.13+rnd()*.13],7,4);
 for(let n=0;n<5;n++){const p=[center[0]+(rnd()-.5)*.55,center[1]+(rnd()-.5)*.35,center[2]+(rnd()-.5)*.55];leaf('olive'+Math.floor(rnd()*4),p,.13+rnd()*.08,.037+rnd()*.025,rnd()*Math.PI*2,(rnd()-.5)*1.6);}
 }"""
if old not in s:raise Exception('olive target missing')
s=s.replace(old,new)
# Keep shrubs dense, with some small real leaves around their outer clusters.
s=s.replace("ellipsoid('leaf'+Math.floor(rnd()*5),[c[0]+Math.cos(a)*r,c[1]+rnd()*size*.45,c[2]+Math.sin(a)*r],[.18+rnd()*.2,.14+rnd()*.22,.18+rnd()*.2],7,4);", """const p=[c[0]+Math.cos(a)*r,c[1]+rnd()*size*.45,c[2]+Math.sin(a)*r];
 ellipsoid('leaf'+Math.floor(rnd()*5),p,[.15+rnd()*.15,.13+rnd()*.16,.15+rnd()*.15],7,4);
 for(let n=0;n<3;n++)leaf('leaf'+Math.floor(rnd()*5),[p[0]+(rnd()-.5)*.42,p[1]+rnd()*.2,p[2]+(rnd()-.5)*.42],.09+rnd()*.06,.042+rnd()*.025,rnd()*Math.PI*2,(rnd()-.5)*1.8);""")
# Public author-side facts for deterministic validation; adapter still uses submitted receipts.
s=s.replace("export default class SceneSystem", "export const authoredStats={};\nexport default class SceneSystem")
s=s.replace("for(const [k,q] of batches){", "authoredStats.meshes=batches.size;authoredStats.vertices=0;authoredStats.triangles=0;\n  for(const [k,q] of batches){")
s=s.replace("const pal=palette[k];if(!pal)", "authoredStats.vertices+=q.p.length/3;authoredStats.triangles+=q.idx.length/3;\n   const pal=palette[k];if(!pal)")
p.write_text(s)
PY
pnpm run build
node --input-type=module - <<'JS'
import Scene,{authoredStats} from './src/scene.js';
import {defineApertureConfig} from '@aperture-engine/app/config';
import {createApertureHeadlessRunner} from '@aperture-engine/app/headless';
import {disposeApertureApp} from '@aperture-engine/app/advanced';
import {writeFileSync} from 'node:fs';
const runner=await createApertureHeadlessRunner({config:defineApertureConfig({mode:'headless',systems:[],render:{defaultCamera:false,defaultLight:false}}),systems:[{default:Scene}]});
try{
 const {snapshot,status}=runner.step(1/60,0);
 const summary={...authoredStats,meshDraws:snapshot.meshDraws.length,diagnostics:status.diagnostics};
 console.log(JSON.stringify(summary));writeFileSync('/work/scene-summary.json',JSON.stringify(summary,null,2));
}finally{const errors=await disposeApertureApp(runner.app);console.log('Cleanup errors:',JSON.stringify(errors));if(errors.length)process.exitCode=1;}
JS
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-DDflZynE.js               883.91 kB
dist/assets/dist-Bm8q8HXV.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-1jEBmXuk.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 701ms
{"meshes":65,"vertices":1246194,"triangles":415398,"meshDraws":65,"diagnostics":[]}
Cleanup errors: []
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command d6b864125ce44814a96841e28017c9cb

2026-10-13T01:09:31.198891+00:00 → 2026-10-13T01:09:40.260810+00:00; exit 0; duration 9.062s.

Command:

```sh
python3 - <<'PY'
from pathlib import Path
p=Path('/work/src/scene.js');s=p.read_text().replace("tri(k,points[(j+1)%4],points[j],top);tri(k,points[j],points[(j+1)%4],bottom);","tri(k,points[j],points[(j+1)%4],top);tri(k,points[(j+1)%4],points[j],bottom);");p.write_text(s)
PY
pnpm run build
node --input-type=module - <<'JS'
import Scene,{authoredStats} from './src/scene.js';
import {defineApertureConfig} from '@aperture-engine/app/config';
import {createApertureHeadlessRunner} from '@aperture-engine/app/headless';
import {disposeApertureApp} from '@aperture-engine/app/advanced';
const config=defineApertureConfig({mode:'headless',systems:[],render:{defaultCamera:false,defaultLight:false}});
for(let attempt=0;attempt<2;attempt++){
 const runner=await createApertureHeadlessRunner({config,systems:[{default:Scene}]});
 try{const {snapshot,status}=runner.step(1/60,0);console.log('Deterministic extraction',attempt+1,JSON.stringify(authoredStats),'draws',snapshot.meshDraws.length,'diagnostics',JSON.stringify(status.diagnostics));}
 finally{const errors=await disposeApertureApp(runner.app);if(errors.length)throw Error(JSON.stringify(errors));}
}
JS
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-CdXP02JE.js               883.91 kB
dist/assets/dist-CadRNxix.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-DGGJkZsT.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 754ms
Deterministic extraction 1 {"meshes":65,"vertices":1246194,"triangles":415398} draws 65 diagnostics []
Deterministic extraction 2 {"meshes":65,"vertices":1246194,"triangles":415398} draws 65 diagnostics []
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Command ffa18f2b30fe4468950dc7e4df4a0f46

2026-10-13T01:10:24.014416+00:00 → 2026-10-13T01:10:25.241315+00:00; exit 0; duration 1.227s.

Command:

```sh
pnpm run build; test -f /work/dist/index.html; test -f /work/src/scene.js
```

Stdout:

```text

> house-aperture@1.0.0 build /work
> vite build

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 865 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:   0.33 kB
dist/assets/worker-CdXP02JE.js               883.91 kB
dist/assets/dist-CadRNxix.js               2,261.38 kB
dist/assets/simulation-worker-ayV9uwZo.js      3.53 kB │ gzip:   1.35 kB
dist/assets/audio-BttgmJPm.js                 18.90 kB │ gzip:   7.07 kB
dist/assets/index-DGGJkZsT.js              1,532.74 kB │ gzip: 384.24 kB

✓ built in 720ms
```

Stderr:

```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Public note — 2026-10-13T01:10:46.709742+00:00

```
Final implementation: a deterministic worker-authored ECS scene rendered by Aperture native WebGPU with the standard extraction snapshot boundary and manual frame control. Features include ivory stucco walls with real front and side apertures, dark mullioned inset windows, paneled door and lantern, two-post tiled porch, individual barrel roof tiles, gutter/downpipes, capped chimney, paved entry and side path, low coursed stone boundary with pillars and mailbox, planters, shrubs, modeled olive/cypress trees, grass and lavender, curved asphalt road with segmented curbs and broken white center markings, and a blue contoured hatchback with crowned roof, tinted glass, mirrors, lamps, grille, badge, trim, seams, wheel arches and four tire/alloy wheel assemblies. All visible geometry is published as 65 material batches in ordinary simulation ECS; authored builder counts are 1,246,194 vertices and 415,398 triangles, not timing or native-counter estimates. inspectGeometry derives owned positions, normals, triangle ranges and complete instance matrices from the public submitted-geometry receipt API. Previews 2 and 3 passed native rendering and geometry preflight in the canonical and two orbit views; preview 1 failed at asynchronous bootstrap and was corrected. Final cosmetic adjustments after preview 3 added smaller leaves, changed car placement/ground contact and headlight/roof detail, softened grain and added a chimney crown; these final changes were build-tested and two fresh headless worker extractions completed without diagnostics, but were not browser-previewed because all three preview requests were spent. The car and vegetation remain stylized procedural approximations, and distant terrain is simple. No external scene assets, reference-image textures, custom shaders, image generation, alternate renderer or application animation loop were used. No application servers or browsers were launched by the author. All headless app checks awaited public disposal, and recorded process supervision reports no remaining descendants. Final build: /work/dist; source: /work/src/scene.js, /work/src/main.js, /work/src/worker.js, /work/src/config.js; summary: /work/scene-summary.json.
```

