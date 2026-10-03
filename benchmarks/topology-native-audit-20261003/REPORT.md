# Independent topology native-evidence audit

**Passed within the frozen exploratory scope.** All eight native attempts and
22 captures pass independent retained-byte inspection. No renderer defect, new
feature requirement, score, ranking, performance claim or release is established.

## Provenance and execution

- Native archive: [`8a2e900edd794d0392b133c332a3f1ba161f8302`](https://github.com/felixtrz/aperture/tree/8a2e900edd794d0392b133c332a3f1ba161f8302/benchmarks/crane-topology-regression-20261003).
  The 265 files in that local Git subtree match actual bytes. The native manifest
  covers 264 files, excluding itself. Remote publication and CI belong to the
  parent; this audit performed no external query or publication.
- Execution source freeze: `7c4b867ac432bfbb132c58066b809c530e785032`, all
  106 local subtree files matching their Git blobs. Engine source remains
  `d0333acdd4443ed9a4a0239d24184755b812b447`, version 0.3.0; 1,173 source files
  match that commit independently. Vendored three.js is 185dev.
- Admitted source-pins SHA-256:
  `773c200b542afb915ae741dc6279bff9048789bc65c8d1504a4b5cafb50d2292`.
  All 3,075 source/dependency/control/runtime files (145,454,432 bytes) and 48
  runtime symlinks match. All 29 derivations match their actual predecessor Git
  bytes. Compiled bytes retain the inherited native-control pins; no new build
  or independent source-to-compiled reproduction was performed.
- Recomputed all 3,812 loaded-input receipts, including session-literal and
  canonical import transformations. Browser 153.0.8010.0, exact approved argv,
  enabled sandbox, native SwiftShader, one device/canvas/Worker, no WebGL
  attempts, GPU errors or device losses pass for every session.
- Source-pinned worker options are 240 Hz shared messages, 240 Hz source-assets
  messages, 16 ms full summary. Actual records establish SAB without fallback
  and demand cadence. Those options are not measured timing guarantees.

## Native evidence, not just successful outcomes

All eight directories contain exactly one `attempt-001`: live plus independent
baseline/grow/shrink cold sessions for each engine. All 52 ordered artifact
receipts match actual JSON/PNG/completion bytes and their immutable receipt files.
Each of the 22 state records was revalidated, with all 15,946 recorded native
checks true. The separate Python audit executes 18,120 checks with no mismatch.

The observer was reviewed from source. It joins actual pass or executed-bundle
draws through the owning encoder's successful `finish()` return to the exact
command-buffer objects passed to successful `queue.submit()`, within the
correlated renderer call. Its stable buffer labels come from a WeakMap keyed by
the actual GPUBuffer objects. They are not engine IDs. The retained frames include
390 bundle-origin draws; all observed instance counts are one. Command-buffer
objects themselves cannot survive JSON serialization: the evidence depends on
this pinned transparent observer, its retained joins, native error/fence checks
and independent raw-byte/raster controls.

- Aperture: every submitted geometry binding joins the exact observed native
  buffer object to its successful upload history. Independently compared those
  preserved bytes with native stream raw bytes, then decoded native positions.
  This is upload observation, **not GPU readback**. Worker publication/reception,
  consumed snapshot and native report frames agree. Live frames are 2–9; the
  separate step acknowledgment is not substituted for the submitted frame.
- three.js: actual renderer-owned position/index buffers are copied after the
  correlated render and fenced with MAP_READ. The same object IDs occur in the
  submitted bindings. Readback bytes equal installed CPU and worker-source bytes.
  Normal attributes have source/CPU checks; this flat-shaded fixture does not
  invent a GPU normal buffer when none is allocated. The callback's renderer
  frame/call and mesh/geometry/attribute identities agree with the worker revision.
- Analytic cardinality, hollow openings, nondegenerate/manifold surface, active
  vertex/index ranges, index format and material-group coverage pass. Aperture
  outer/inner/rim counts are 864/864/144, 2304/2304/192 and 288/288/96.
  three.js vertex/index counts are 1248/1872, 3200/4800 and 448/672.
  Binding capacity may exceed active bytes and is checked separately.
- Live pipe versions are `1,1,2,2,3,4,5,6`. Aperture publishes 15 actual asset
  replacements over five changes; three.js replaces/disposes five geometries
  and replaces 15 attributes. Real entities/handles or Mesh identities remain
  stable. No-op counters do not advance, nonpipe raw geometry remains exact,
  and cold sessions initialize directly with no warm replacement history.

## Independent decoded controls

Pillow 12.3.0 independently decoded every actual state PNG, separate from the
recorder's decoder. All are opaque, nonuniform 1024×1024 images.

- All 16 within-engine live/cold comparisons have zero differing RGB pixels,
  zero maximum channel difference, and exact raw geometry equality. This
  includes both no-ops and both final/reset baselines in each engine.
- Both fresh baselines equal the retained successful live baseline RGB exactly.
- Grow/shrink visibly differ from baseline: Aperture 5,930/6,683 pixels with
  maximum channel differences 105/119; three.js 5,469/5,939 with maxima 87/117.

No cross-engine pixel equality is claimed. Whole-frame equality and draw evidence
do not separately isolate each light's or shadow face's pixel contribution.

## CPU checks and preserved failures

The focused Node suite independently reran **22/22**, using only adopted
`cleanup.py` SHA-256
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`.
Synthetic observer/recorder tests validate rejection behavior; they are not
native rendering evidence. This is not a full `pnpm run check` rerun.

All three preparation failures are retained and classified honestly:

1. `derive-001.log`: loader seam expected five occurrences, actual four.
2. `cpu-001.log`: missing relative contract import rewrite caused one loader
   error and cascading checks; nine passed/four failed before the pre-freeze fix.
3. `report-001.log`: the summary parser could not handle split TAP comment lines.

These are preparation/adapter/reporting errors, not native engine defects. There
is no failed native attempt in this frozen topology run. Historical failed author
or earlier post-author attempts remain failed; later controls do not relabel them.
Preparation README/pin wording saying native execution is pending is superseded
by the separate native result, without modifying that historical source.

`AUDIT-001.json` preserves the first passing audit. `AUDIT.json` adds bundle and
instance counts and completes the failure inventory after widening the audit's
log-message matcher. No benchmark evidence or acceptance gate changed.

## One next bounded regression

**Shared-mesh fan-out and native draw coalescing under demand cadence.** Current
pipe handles each serve one entity, and native draws all use one instance. CPU
intentional-sharing tests exist, but this archive does not establish a live
cardinality update reaching several entities through an actual coalesced draw.

Use three separated copies of the existing three-part pipe: nine persistent ECS
entities sharing three MeshHandles and explicit shared material handles. Publish
once per handle on each existing topology transition. Freeze transforms, camera,
appearance, one directional shadow/receiver, static sentinel, worker and demand/SAB
settings. Run the same eight-state live sequence, three shared cold states and
three visually identical unshared-handle cold states: **seven sessions, 14
captures**. Distinct control handles naturally prevent cross-entity coalescing.

Existing entrypoints: `createMeshAccess().publish` in `systems/meshes.ts`;
`prepareSpawnMeshAssets`' explicit-handle branch; the intentional-sharing example
in `test/app/anonymous-spawn-assets.test.ts`; topology `createPartAsset` and worker/
main observers; `prepareDrawOrderTransformPacking`, `writeRenderPassDrawList` /
`canCoalesceDrawListRecord`, and `createRenderPhaseBatchKey` in the WebGPU renderer.
Full paths and machine-readable acceptance/stop conditions are in
`NEXT_REGRESSION.json`.

Require all nine instance/version/transform joins, exact submitted-buffer bytes
and current ranges, actual main-pass three-instance coalescing, separate applicable
shadow coverage, eight live/cold plus three shared/unshared exact RGB controls,
visible edits, no-op/reset and sentinel invariance. The old single-instance gate
must not be reused unchanged. A fixture failing to activate batching is a coverage
blocker until diagnosed, not automatically a renderer bug. Stop on the first
mismatch; preserve it. Changes require a new freeze and separate admission.

Continuous RAF and source-assets-only sidebands remain uncovered. They should
not be added to this ownership/batching experiment. The current queue has four
existing patch items, seven maintenance items and no minor/major item. This audit
adds none. Existing live-byte/demand-frame/shadow fixes receive stronger bounded
evidence; formal-score requirements remain blocked.

## Reproduction and quiescence

Run `audit-retained.py` through the pinned cleanup wrapper with the existing
`/workspace/scratch/0190a8c72f8a/aperture-tmp` root, a new audit basename and this
folder's lifecycle-audits directory. It reads retained files/Git objects and uses
installed Pillow, with no browser/network. `revalidate.mjs` replays the existing
strict record validators and served-module transformations; it writes exclusively.
The retained wrapper commands are in the logs and lifecycle records.

All four audit-owned lifecycle jobs finished with exit 0, confirmed by their
completion events and collected tool results. No owned job remains active.
No browser, server, build, installation, source/fixture edit, external publication
or descendant was started. Only this audit folder was written. This quiescence
statement is scoped to the audit's own work. Output hashes are in `SHA256SUMS`.
