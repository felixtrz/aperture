# Aperture persistent crane adapter, initial v1

Exploratory live-edit continuation. This is not a score, performance measurement,
GPU-memory measurement, physics simulation, or new visual authoring attempt.

## Frozen geometry and appearance

`scene.mjs` is byte-for-byte copied from the permitted clean continuous-wall
front-quarter source. SHA-256:
`9fa0d6ec7e70ef394cae6d43343bf502964031bed727a65c961e1c63d79eb421`.
The camera, PBR material arguments, lights, shadow settings, clear color, native
AgX operator, MSAA and lamp bloom are preserved. The continuous wall is still the
native indexed extrusion. No engine source or other author source was changed.

The frozen shared contract hash is
`13826efcd14fe234f299d267c9938bdb36cde53026e66995a7344131a3050e09`.
The shared harness owns all 29 states, fencing, actual canvas PNG capture, reset
checks, immutable recording and final readiness. This adapter does not substitute
its own capture loop, renderer, screenshot or ready signal.

## Runtime and revision correspondence

- One `startGeneratedBrowserApp`, one native Worker, one native WebGPU device,
  one canvas and one actual worker-owned ECS world are created per attempt.
- Mesh entities are spawned exactly once. Each actual ECS `index:generation`
  and native mesh asset handle stays stable. There is no reload, respawn or
  renderer replacement to simulate an edit.
- Commands go through the existing generated command queue. The native worker
  executes its existing `ecs_step` route; the author system drains one edit,
  reconstructs current deterministic source data and uses `meshes.publish` only
  for changed native mesh assets. Unchanged mesh assets remain the same objects.
- The supplied worker MessagePort is transparently observed at native snapshot
  publication. Revision evidence is attached to that exact original snapshot
  message after stepping, world-transform resolution, extraction and native
  asset serialization. Original snapshot and transfer list remain unchanged.
- `applyAndSubmit` waits for the renderer's successful swapchain report whose
  `frame` exactly equals the observed native snapshot's frame and whose attached
  worker revision equals the requested revision. The full native frame report,
  correspondence values and published asset versions are retained. An increase
  in a queue counter alone cannot resolve this wait.

Demand cadence is retained. Shared-snapshot/source-asset notification rates are
set to 1000 Hz to ensure a per-command snapshot observation if the trusted
server enables SharedArrayBuffer; this changes transport notification cadence,
not geometry or rendering. There are no author browser-launch or server paths.

## Evidence and honest counters

`sourceGeometry` retains the complete current constructor output and runtime
source files. `nativeGeometry.meshes` is read from current actual worker native
MeshAssets and actual ECS `WorldTransform` columns after extraction. It includes
all stream descriptors, typed-array types and data, decoded native positions,
native indices, submeshes and matrices.

Most meshes are native **nonindexed** triangle streams: `indices` is the actual
empty index array, `indexed:false`, and consecutive position triples form
triangles. The continuous wall is genuinely indexed and includes the native
index-buffer format/type/data. No synthetic indices are mislabeled native.

GPU observation forwards actual native calls without modifying their arguments
or return objects. It records actual VERTEX/INDEX `GPUBuffer` object identities,
allocations, explicit destroys, binding calls, and the bytes passed to actual
`queue.writeBuffer`. Full uploaded bytes, including allocation padding, are
compared against the worker's current native stream/index bytes. This is upload
observation, **not GPU readback**. It does not infer residency or GC reclamation.

Mesh-asset object replacement, published CPU vertex/index-array replacement and
actual GPU-buffer allocation/replacement/write counters are separate and have
explicit definitions. Asset serials and versions change when geometry objects
are replaced; they are never used as the stable mesh identity. `sceneId` is a
UUID created inside the actual world and stored on its globals, and the original
world object reference is checked on every publication. Entity counts come from
native live-world tracking, not a fixed author-declared count.

## Validation completed before the initial freeze

- `node --check` passes for all authored modules.
- `node cpu-check.mjs` exercised one real native CPU app/ECS world across all 29
  requested states, including both edit cycles and all resets. It created no
  server, browser, external process or disposable fixture. Module import URL
  rewriting is in memory only, to resolve browser paths in Node.
- All 29 states have 65 meshes, 70 actual ECS entities, 261 passing native
  geometry/identity checks, unchanged genuine identities, and byte-exact baseline
  resets. Native snapshot draw count is 65 in every state.
- Final CPU counters: 65 initial native mesh assets, 524 native asset
  replacements, 524 published vertex-array replacements and 4 index-array
  replacements. Entity creates remain 70 and entity destroy calls remain zero
  throughout the edit sequence. These are CPU facts, not GPU conclusions.
- The CPU app is disposed in `finally` with `disposeApertureApp`; disposal passed.
  Full results are retained in `cpu-check-results.json`.

The obsolete original checker referenced pre-continuous-wall part names. It is
not used. The adapter verifies current native vertices/indices/matrices directly
against the preserved source; independent world-triangle comparison to static
native goldens remains the parent's audit.

## Pending native verification and scope

Only the parent may launch up to the allocated native-attempt budget through
`pnpm run render:cloud` / `runVerifiedScene` within the adopted cleanup lifecycle.
No native browser attempt has been run by this author. PNG validity, actual GPU
upload matching, shared-harness integration and native frame correlation still
require that attempt. All attempts/failures must be retained, with no source
replacement after freeze unless the separately authorized single revision is
issued. Exact model identity/full transcripts are unavailable; exploratory only.

Author process state at initial submission: quiescent, no descendants, servers,
browsers or owned background processes. No dependencies installed, publication
performed, engine edits made, or other author solution inspected.
