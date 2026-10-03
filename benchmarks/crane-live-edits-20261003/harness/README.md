# Persistent crane live-edit harness

Exploratory native-WebGPU continuation of the fixed front-quarter crane sources.
There are no scores, GPU-memory measurements, or performance claims. Exact model
identity and full authentic author transcripts remain unavailable.

`contract.mjs` is the frozen author contract. Its initial SHA-256 is
`13826efcd14fe234f299d267c9938bdb36cde53026e66995a7344131a3050e09`.
Import `installLiveEditTracking` and `runLiveEditHarness` from
`/harness/client.mjs`. Install tracking before constructing any app, renderer,
Worker or WebGPU device. Submit each requested revision and expose complete native
buffers/matrices through the contract. Mesh identity means the native ECS entity
and stable mesh asset handle, or the actual native three.js Mesh identity.
Geometry/buffer replacements must be counted separately.

Native nonindexed triangle-list assets retain `indexed: false`, empty actual
`indices`, their real full streams and real submesh vertex ranges. The validator
checks vertex/byte counts, POSITION stride/offset decoding against the actual
stream, triangle-list topology and bounded vertex ranges with zero index ranges.
It never synthesizes an index buffer. Indexed assets retain strict index bounds
and triangle-count validation. This is a native-format clarification; the frozen
contract file is unchanged.

## Execution ownership

The parent alone starts browser attempts after fresh adopted dispatch permission.
Invoke the runner inside the existing `tools/recovery/runtime_pressure.py run`
lifecycle, with `APERTURE_WEBGPU_RUNTIME` set to the verified existing runtime.
The wrapper supplies `APERTURE_TMP_RUN`. This runner never installs dependencies,
provisions a runtime, or launches through another browser API.

The inner command is:

```
node benchmarks/crane-live-edits-20261003/harness/run.mjs \
  aperture attempt-001 benchmarks/crane-live-edits-20261003/author-a/v1
```

Use `threejs` with `benchmarks/crane-live-edits-20261003/author-b/v1` for the
control. Each engine accepts only its admitted `author-a` or `author-b` subtree,
checked both before and after realpath resolution. Only the adopted lifecycle root
`/workspace/scratch/0190a8c72f8a/aperture-tmp` is accepted.
The exact source path is served at its repository-relative URL, so
relative imports retain their normal path semantics. `/scene/` aliases the same
directory, `/harness/` exposes shared browser modules, and the two frozen clean
source directories are readable at their normal repository-relative URLs.
The standard `/worker-modules/`, `/packages/`, `/node_modules/` and two pinned
three.js module routes remain available. No external origin is admitted.

Output is new-only `renders/<engine>/<attempt-NNN>`. Reusing an attempt fails;
failed and partial attempts are preserved. One ephemeral loopback server and one
`runVerifiedScene` call serve the entire 29-state session. READY follows all 58
acknowledged state JSON/PNG files and the acknowledged completion manifest.
The approved runner independently verifies native SwiftShader WebGPU, native
launch flags, zero WebGL calls/errors/device loss and final browser cleanup.
Its report is separate from browser-side progress.

## Evidence and failure semantics

Every state includes full JSON-safe source geometry and all native stream data,
indices and world matrices. Evidence is posted as separate immutable JSON and
PNG artifacts, capped at 16 MiB and 8 MiB respectively. Successful acknowledgments
contain exact byte counts and SHA-256 values and survive as separate receipts.
The recorder revalidates sequence, identity, camera, appearance, baseline reset,
proof and surviving bytes before accepting completion. The parent separately
compares native world-space triangles against the previously captured static
goldens, which is outside this harness's identity/reset checks.

PNG bytes come from the actual native WebGPU canvas using `toBlob` after the
approved GPU fence and two presentation opportunities. Browser canvas lifetime
can affect post-presentation readout: this requires real-attempt verification.
The recorder decodes PNG pixels using Node's built-in zlib, validates CRCs and
dimensions, and rejects blank, transparent, or effectively uniform captures.
Rejected input is retained; no source-generated or proxy raster is substituted.
The final browser page screenshot is supplementary and never replaces state PNGs.

Full native/source state JSON is acknowledged before its PNG, so geometry survives
even when the image fails. Failed recognized artifacts remain at their original
paths; rejection metadata and any otherwise unpreserved bounded input are kept
under `rejected`. Browser failure and runner failure are separate. Input pins
cover shared harness, both frozen sources, selected author source, approved
runner/lifecycle and pinned three.js modules before and after. Runtime files
actually requested are additionally hashed and rechecked after the run.

Main-thread instrumentation forwards original native methods and observes native
Worker/device/canvas identity and buffer/texture creation/destruction calls. Counts
are explicit calls, not memory usage, GC reclamation, resource residency, speed,
or an assertion that engine-internal resources are leak-free. The actual source
and artifact bytes remain available for independent inspection.

## Node-only unit tests

Run `node benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs` only
inside the adopted `tools/recovery/cleanup.py run` lifecycle/root. Tests create
and remove only their own temporary fixture directories under `APERTURE_TMP_RUN`.
Retain stdout/stderr logs outside disposable storage. Fixtures are explicitly
synthetic and cannot constitute renderer/benchmark evidence. Tests exercise PNG
filters/corruption/blank rejection, all-state acknowledgment, immutable writes,
partial/failure preservation, payload bounds, identity/reset drift and missing
native correspondence. They launch no browser, bind no server and use no new
dependency.

`history/implementation-19-tests` preserves reverse-patch source history whose
six module hashes match retained observations; its README preimage lacks a
retained pre-patch hash and is explicitly unverified. The routing/root correction
followed the parent's in-scope instruction before a later read-only hold arrived.
`history/implementation-20-tests` directly preserves the then-current corrected
source before nonindexed native-format edits. The history provenance records
that timing and keeps the corresponding test logs.
