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

## Execution and scope

`run.mjs` serves a trusted built application and calls the existing
`runVerifiedScene` route. It requires an active adopted `runtime_pressure.py`
lifecycle, exact pinned browser runtime and a new retained attempt directory.
It never launches a browser itself or alters the verifier's flags or proof.
Before browser work it retains every built application byte under `frozen-app/`
and all harness source under `frozen-harness/`, plus the exact injected HTML in
`served-index.html`. `inputs.json` inventories paths, sizes and SHA-256 hashes,
including these surviving copies. Failed attempts retain the same full inputs.

```sh
node tools/agent-benchmark/run.mjs \
  --app /absolute/built-app \
  --engine aperture \
  --output /absolute/new-attempt \
  --trial 1
```

Each trial has 60 warmup frames and 120 measured frames, serially fenced.
Run at least three fresh-browser trials per engine, sequentially, alternating
the starting engine by trial. Never run performance trials concurrently. The
three views are canonical, left orbit and rear orbit. Raw timings and native
counters remain in `measurement.json`; canvas PNGs and geometry arrays survive
separately. No timing sample is silently dropped or replaced. Minimum, median,
p95 and maximum are descriptive statistics, never relative timing test gates.

The left orbit camera is `[-19, 10, 15]`; the rear orbit camera is `[14, 10, -19]`.
Both keep the canonical target, FOV and clipping distances.

CPU submission duration ends at the last native queue submission attributable
to the requested frame. Queue completion latency starts at that submission and
ends when all observed device queues finish. End-to-end duration starts at the
frame request and ends at queue completion. The application's promise duration
is retained separately. These are elapsed browser timings on CPU SwiftShader,
including scheduling and worker round trips. They are not physical GPU timings,
timestamp-query measurements, GPU utilization or GPU-memory measurements.

Submitted triangles include all shadow, scene and fullscreen passes and instance
multiplicity; indirect draws without readable arguments are reported as unknown.
The newly frozen v2.1 observer can decode complete owned CPU-written16B/20B
indirect args at submit, with raw deduplicated witnesses and frame multiplicity.
STORAGE/unproven GPU mutation/shared/incomplete arguments stay explicit unknown
lower bounds. Proof metadata exhaustion fails export without changing known
native counters or dropping measured samples. See [binary geometry v2](GEOMETRY_V2.md).
Unique authored triangles exclude duplicated geometry but include actual source
degeneracy. Resources count successful native creation and explicit destruction;
requested buffer bytes are not resident GPU memory. Draws are attributed through
finished command buffers and native queue submission, including reused render
bundles, rather than assuming every encoded draw was submitted.

Aperture eligibility requires an observed native simulation worker connected
through its normal MessageChannel protocol, with real render snapshot payloads
and advancing snapshot frames across the measurement interval. The same worker
must remain present without errors or termination. Shared-buffer frame advancement
is observed from the actual transport header when that normal path is used.
Native protocol observation still requires independent source audit to confirm
ECS/extraction runs on that worker and the renderer consumes its snapshots;
an unrelated or dummy worker cannot establish architectural eligibility.

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
