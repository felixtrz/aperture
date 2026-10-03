# Next controlled benchmark: worker-delivered shadow edits

## Recommendation

Increase one boundary's complexity: run the existing four-light, same-handle
asset-edit matrix through the real generated browser app, native Worker, source
asset mirroring and shared-snapshot demand cadence. Keep the scene, light modes,
edit sequence and render settings frozen. This is an exploratory integration
regression using existing APIs, not a new engine feature or author score.

The component matrix deliberately never starts its `manualSource` transport and
calls `renderer.renderSnapshot` directly. Its 16 native sessions establish the
renderer side of the contract. The crane's later 29-state run establishes a real
worker path for its particular directional-shadow scene, but neither result alone
establishes the four-mode matrix across that worker/mirror/cadence boundary.

## Audit findings from retained bytes

- All 231 entries of `native-shadow-light-matrix-v2-20261003/native-manifest.json`
  match their SHA-256 and length. All 2,369 entries of its source pins match.
  All 232 files under that matrix in local Git archive
  `740e74bc26694104cac3a1dbddad0bbf0e6b37b6` match actual worktree bytes, including
  the manifest. This audit did not query GitHub or independently verify remote CI.
- I read all 48 actual state records and all 16 outcomes/runner records. Each
  native frame has the expected asset version, requested/served shadow coverage,
  pipeline, cache decision and submitted caster work. Actual preserved source
  bytes equal the observed bound vertex/index upload bytes in every state.
  Every recorded session has the exact requested launch argv, native SwiftShader,
  no WebGL/error/device loss, unchanged pins and closed server.
- Independent decoding of all 48 state PNGs reproduces the 36 exact RGB
  live/fresh equalities and eight visible mutations. Dimensions, nonblank content
  and opacity pass. These are whole-frame equivalence checks, not proof of
  per-light/per-face occlusion contributions.
- The original static author comparison remains exploratory: its 216-file
  manifest matches. The live author archive's 264 entries and both Aperture
  author submission inventories match. Aperture author v1 timed out before the
  baseline; v2 reached frame correspondence but failed the original strict
  byte-evidence gate. Neither becomes a passing author attempt retroactively.
- Post-author attempt 003 passed baseline then failed the first shoulder edit.
  Its retained diagnosis found stale uploaded bytes on 22 changed meshes.
  After the narrow asset-publication/demand-frame fixes, attempt 004 passed
  29 states and 13,253 recorded checks, yet the widened arch exposed the distinct
  stale-shadow result (5,186 differing pixels). After shadow invalidation repair,
  attempt 005 passed all 29 states and 13,253 recorded checks; the retained
  independent geometry/pixel report closes that arch discrepancy. I independently
  verified all 58 artifact hashes and zero failed recorded checks for each
  passing run. Three.js initial live attempt independently retains 29 states,
  58 matching artifact hashes and 24,505 passing recorded native checks.
- The later source-validation archives match their manifests: asset validation
  135 files, shadow validation 157, test-discovery integration 36, final PCSS
  extension 18, continuous-wall evidence 147. These integrity checks do not rerun
  those tests. The latest retained integration result is 4,717 canonical Vitest
  tests in 668 files, plus 24 Node recorder tests and seven approved CLI captures;
  it is not a complete `pnpm run check` result.

`AUDIT.json` contains source hashes, per-state observations, attempt identities,
queue-reference resolution and decoded-image comparisons. `audit-retained.py`
only reads retained files/Git objects and writes this audit's JSON. Its initial
path resolver incorrectly chose the repository README for three relative README
entries. `AUDIT-initial-path-resolution.json` preserves that audit-tool error;
the corrected resolver finds no evidence mismatch. No retained benchmark was
changed to make that correction.

## Deduplicated queue audit

`benchmarks/evidence/queues.json` has ten distinct IDs: four patch items, six
maintenance items, zero minor and zero major items. All 18 evidence references
resolve to existing local files or Git commits. No duplicate IDs or additional
capability/breaking-change requirement is evidenced.

- `P-PCSS-SINGLE`: completed; keep the controlled PCSS repair evidence separate
  from broad-radius artistic guidance.
- `P-LIVE-MESH-BYTES`: native-validated; attempts 003 and 004 preserve the
  before/after rather than creating a duplicate issue for every affected mesh.
- `P-DEMAND-SHARED-FRAME`: native-validated within demand/snapshot scope; retain
  its explicit continuous-RAF and source-assets-only sideband exclusions.
- `P-SHADOW-ASSET-INVALIDATION`: native-validated; attempt 005 and the subsequent
  four-mode matrix strengthen the same item's evidence, not a new patch.
- `M-RAW-BYTE-EVIDENCE`, `M-TEST-DISCOVERY`, `M-CLI-APPROVED-ROUTE`: validated;
  original failed runs remain historical evidence, not current failures.
- `M-CONTINUOUS-WALL-AUTHORING`: completed existing-extrusion guidance; cottage
  and crane wall seams remain one issue.
- `M-SHADOW-RADIUS-GUIDANCE`: validated bounded authoring advice, not proof of
  another renderer defect.
- `M-FORMAL-SCORE-GATES`: still blocked for formal scoring because exact equal
  author model/settings and complete authentic transcripts are missing. Do not
  invent transcripts, scores, rankings or provenance.

The queue's 09:52 timestamp predates the 14:23 matrix run. The matrix README's
“native execution pending” is an immutable fixture-stage statement, superseded
by its separate passing native manifest/outcomes. Likewise old diagnostic
reports describe their historical open issues. Read those in sequence; do not
rewrite archives or reopen closed fixes. A later authorized queue refresh can
append the matrix archive link to the existing shadow item, with no new feature
item. This audit did not edit the queue.

## Implementation scope and source map

Create a new benchmark directory; do not mutate the v2 matrix or any author run.
Use only current engine APIs. Preserve the tested engine/runtime pins, recording
any necessary pre-existing compiled/source reconciliation explicitly before a
native run. The matrix identifies engine source
`d0333acdd4443ed9a4a0239d24184755b812b447`.

Reusable concrete sources:

1. `benchmarks/native-shadow-light-matrix-v2-20261003/fixture.mjs`:
   `MODES`, `STATES`, `casterAsset`, camera, materials, ECS components, fixed bounds
   and one shadow-requesting light. Maintain the exact generated typed-array
   content and numeric material/light values when moving authority into a worker.
2. Its `main.mjs`, `checks.mjs`, `run.mjs`, `compare.py`: immutable recording,
   strict native/cache/pixel gates, approved launch route and fresh controls.
   Replace the inactive `manualSource` and page-driven render loop; keep the
   GPU observer and byte-preserving evidence imports pinned.
3. `benchmarks/crane-live-edits-20261003/author-a/post-author-byte-diagnostic/`:
   `main.mjs` observes actual generated-app render completion and worker events;
   `worker.mjs` observes native publication without replacing engine extraction,
   serialization or transfer lists; `scene-system.mjs` shows persistent ECS-owned
   command handling and `this.meshes.publish`; `frame-proof.mjs` joins publication
   to completion. Adapt the frame proof to 512 pixels; never drop its gates.
4. `packages/app/src/browser/app.ts`: `startGeneratedBrowserApp`,
   `workerFactory`, `workerStartOptions`, source-asset mirror, demand-to-snapshot
   cadence, explicit render defaults. There is no top-level generated-app
   `transport` option: require actual diagnostics to report shared-array-buffer
   and fail if this environment falls back. Do not invent an option or patch the
   engine to force success.
5. `packages/webgpu/src/app/create-webgpu-app.ts`:
   `nextRenderableSnapshotEvent` documents why demand cadence waits for matching
   message-delivered assets instead of sampling newer SAB data prematurely.

### Frozen experiment

- Same directional, two-cascade directional, spot and six-face point-array modes.
  One shadow-requesting light per scene; ambient stays unchanged.
- Same 512×512 orthographic camera, 48-vertex/36-index caster, receiver, materials,
  transforms, bounds, draw range, hard shadow filter, raw tonemap, sample count 1,
  frame graph and default-environment-disabled behavior. No added post effects.
- One native worker, renderer, device, canvas, persistent ECS world, caster entity
  and mesh handle for each live session. No-op commands still produce an actual
  requested snapshot/presentation but never publish a new asset.
- Nine live states: baseline, no-op, vertices, vertices-no-op, vertex-reset,
  indices, indices-no-op, index-reset, reset-no-op. Asset versions remain
  `1,1,2,2,3,4,4,5,5`. Exactly three fresh worker sessions initialize baseline,
  vertices and indices independently at version 1 for each light mode.
- Total remains 16 native sessions and 48 captured states. No fresh control may
  inherit warmed live caches. The old component matrix is the differential
  control; do not replace fresh controls with cached screenshots.
- Serialize one command/acknowledged state at a time using supported deterministic
  step timestamps. Retain the established crane adapter's explicit message/full
  summary settings initially (240 Hz shared/assets, 16 ms full summary), logging
  effective settings. No continuous-animation, burst-edit or timing-jitter axis
  is added in this experiment.

### Required acceptance checks

1. Before native execution, freeze exact source/dependency/helper hashes, the
   scene contract and effective settings. Add fail-closed fixture checks for
   wrong revisions, missing publication, wrong received/consumed frame, missing
   assets, byte corruption/signed-zero loss, fallback transport and omitted light
   requests. Run the appropriate focused CPU suites only under a separate permit.
2. Prove an actual native Worker and shared-array-buffer transport. Observe state
   ID/revision, worker-publication snapshot frame, source asset version/bytes,
   received frame, actual consumed snapshot and completed native report frame.
   Require exact joins and monotonic state progression. Bootstrap frames may
   precede the first state; never assume worker frame 1 is baseline. A successful
   `ecs_step` response, parameter echo or GPU counter is insufficient evidence.
3. Capture only after the matching real swapchain submission and GPU fence.
   Observe production rendering; do not manually call `renderSnapshot`, import
   the worker's authoritative registry into the main thread, manufacture a
   snapshot event or compare JSON-reconstructed float bytes.
4. Keep all existing byte/identity/cache gates: both bound native upload byte
   views equal preserved worker-origin Uint8 bytes; caster identity/mesh handle
   and frozen snapshot inputs stay stable; one light request is served with none
   omitted; pipeline is exact. Each edit/reset must invalidate first through
   `caster-mesh-assets` and submit caster draws. Each no-op reuses the shadow
   frame and submits zero new caster draws. Preserve actual resource counters
   without calling replacement arrays in-place authoring or measuring memory.
5. All 36 live/fresh decoded RGB comparisons must be exact, including no-ops and
   resets. All eight edits must visibly differ from baseline. Also compare the
   worker-backed fresh controls to the corresponding retained component images
   under unchanged pins. Any mismatch is retained and investigated; do not relax
   tolerance, retune lighting or update the old golden to obtain a pass.
6. Require native SwiftShader, exact approved launch flags, zero WebGL attempts,
   GPU errors and device losses, one persistent device/canvas per session,
   nonblank opaque 512-square images, immutable record receipts, before/after
   source pins, and completed server/browser/descendant cleanup records. Execute
   only through the adopted lifecycle plus `runVerifiedScene`/`render:cloud`.
7. Stop on the first real mismatch, retain the failed attempt and partial frame/
   publication/asset evidence, then diagnose the earliest divergent boundary.
   A changed fixture requires a new identified attempt and fresh admission.
   A passing matrix closes this bounded coverage extension, without automatically
   creating a patch, minor/major task, release, or scored author comparison.

## Limitations and quiescence

Continuous RAF, source-assets-only sidebands, transferable fallback, mixed
shadow-requesting lights, moving cameras, continuous/burst animation, complex
material combinations, hardware GPUs, throughput and memory residency remain
outside this recommendation. Adding one of those now would confound the chosen
worker-boundary increase. Actual per-face pixel occlusion is not established by
six submitted cube faces alone.

This worker ran only read-only shell/Python/Git content audits and wrote files
inside `benchmarks/next-benchmark-audit-20261003`. It ran no repository tests,
browser, server, package build, installation, publication or descendant agent.
All invoked commands returned synchronously; no tool session/process or descendant
owned by this worker remains active. This statement is scoped to this worker,
not unrelated work elsewhere in the shared repository. The final output hashes
are in `SHA256SUMS`; no existing engine, fixture, queue or historical evidence
file was written by this worker.
