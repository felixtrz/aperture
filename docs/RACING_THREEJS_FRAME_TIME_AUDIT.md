# Racing Three.js Frame-Time Audit

**Created:** 2026-06-17
**Updated:** 2026-06-18
**Status:** current audit after rigid mesh/shadow batching, shadow extraction
caching, particle resource reuse, GPU timing, render CPU hot-path fixes, MSAA
post-graph routing, diagnostics caching, shared snapshot fog/particle packet
support, generated-worker MessageChannel scheduling, spatial index caching,
bloom command caching, automatic shadow pass folding into the post FrameGraph,
SAB audio sideband transport, WebGPU worker-snapshot presentation catch-up,
particle view-uniform buffer reuse, baked shadow matrix upload reuse, shared
Standard frame resources, bounded multi-range transform dirty uploads, and
draw-order transform upload skipping, compact mesh-world transform packing, and
fixed-capacity dynamic ground-ribbon update ranges, plus shader-side shadow
caster world-transform instancing, analytic burst particle rendering, shared
queued built-in frame resources, matrix-slot transform dirty uploads, and
camera-frustum-independent mesh/shadow extraction cache reuse, opaque
depth-only sort identity, post-graph scene render-bundle prefix reuse, and
deferred GPU buffer retirement, plus compact render-bundle/shadow diagnostics
and frame-cadence report cleanup, plus on-demand worker entity summaries,
transient worker-summary retention cleanup, CLI/runtime entity explain fallback,
compact app-facing retained resource diagnostics, browser performance status
cadence throttling, status-only render-change-set key compaction with a full
tooling accessor, generated-worker tick-rate pacing, and time-based full worker
summary cadence, plus bounds change-set key disambiguation.

**Sources:**

- Latest current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-worker-summary-cadence.json`
  (`2026-06-18T15:06:55.712Z`, after generated worker full-summary cadence
  moved from frame-count based to time based).
- Latest live Racing diagnostics size/cadence probes after the same rebuild on
  `http://127.0.0.1:5186/`: generated app status `36.2-36.3 KB`,
  last worker summary `2.1-2.2 KB`, status summaries reported
  `full: false` with `fullSummaryIntervalMilliseconds: 500`; idle snapshot
  cadence measured about `239 Hz`, and a drive quick probe measured snapshot
  cadence about `240 Hz` with render-complete cadence about `214 Hz`.
- Latest live Racing bounds change-set probe on `http://127.0.0.1:5173/`
  after bounds keys were disambiguated by `boundsId`: idle reported
  `2 changed / 402 unchanged` bounds and drive reported
  `300 changed / 414 unchanged` bounds, replacing the previous
  `709 changed / 0 unchanged` false-churn pattern. This was not a full paired
  three.js benchmark.
- Rejected particle burst bind-group cache experiment saved at
  `/tmp/racing-frame-audit-particle-bindgroup-cache.json`
  (`2026-06-18T15:18:50.801Z`). It worsened the paired audit drive tail
  (`p99 7.10 ms`, max `151.56 ms`) and was backed out; do not treat it as an
  accepted optimization.
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-worker-paced.json`
  (`2026-06-18T14:53:24.330Z`, after browser performance status cadence
  throttling, status-only render-change-set key compaction, and generated
  worker tick-rate pacing).
- Previous live Racing diagnostics size/cadence probe after worker tick pacing on
  `http://127.0.0.1:5186/`: generated app status `46.4 KB`, diagnostics
  `26.0 KB`, last frame `24.0 KB`, status `renderChangeSet` `2.1 KB`,
  full hidden-accessor `renderChangeSet` `16.4 KB`; idle snapshot,
  presentation, render-start, and render-complete cadence all measured about
  `240 Hz` with `33` pending snapshot replacements.
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-status-changeset-compact.json`
  (`2026-06-18T14:43:06.372Z`, after status-only render-change-set key
  compaction but before generated worker tick-rate pacing).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-status-resource-compact.json`
  (`2026-06-18T13:36:24.676Z`, after generated worker/browser status
  retention cleanup and status-only retained resource compaction).
- Previous live Racing diagnostics size probe after the status-resource
  compaction rebuild on
  `http://127.0.0.1:5186/`: generated app status `51.7 KB`, diagnostics
  `41.3 KB`, last frame `39.2 KB`, `resourceReuse` `1.8 KB`, worker summary
  `2.1 KB`; no retained worker `entities`, `assets`, `resources`, or
  `physics` fields in steady state.
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-status-retention.json`
  (`2026-06-18T13:29:33.408Z`, after generated worker/browser status retention
  cleanup but before status-only retained resource compaction).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-current-final.json`
  (`2026-06-18T13:17:58.264Z`, after compact
  render-bundle key diagnostics, compact app-facing shadow diagnostics, and
  cadence report cleanup).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-telemetry-compact.json`
  (`2026-06-18T13:08:21.728Z`, after compact render-bundle key diagnostics,
  compact app-facing shadow diagnostics, and cadence report cleanup).
- Rejected scheduler experiment saved at
  `/tmp/racing-frame-audit-idle-drain.json`
  (`2026-06-18`, increased rendered submit count but worsened frame tails; not
  left as the active frame-loop policy).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-post-scene-bundle-retire.json`
  (`2026-06-18T12:39:32.299Z`, after opaque depth-only sort identity,
  post-graph scene render-bundle prefix reuse, bind-group-object bundle keying,
  and deferred transform-buffer retirement).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-post-scene-bundle.json`
  (`2026-06-18T12:33:15.424Z`, before deferred buffer retirement; it surfaced
  destroyed-transform-buffer validation warnings and is not the accepted final
  run).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-main-cache.json`
  (`2026-06-18T12:07:53.183Z`, after the camera-frustum-independent
  mesh/shadow extraction cache reuse fix).
- Latest drive change-set/cadence probe after opaque depth-only sort identity
  saved at `/tmp/racing-drive-distribution-opaque-depth-identity.json`
  (`2026-06-18T12:22:02.774Z`).
- Previous drive change-set/cadence probe saved at
  `/tmp/racing-drive-distribution-main-cache.json`
  (`2026-06-18T12:06:51.968Z`).
- Latest WebGPU write probe saved at
  `/tmp/racing-write-probe-shadow-world-transforms.json`
  (`2026-06-18T12:07:32.003Z`, after the same extraction cache fix).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-shared-builtins-matrix-ranges.json`
  (`2026-06-18T11:40:30.208Z`, after shared queued built-in frame resources
  and matrix-slot transform dirty uploads).
- Previous WebGPU write probe saved at
  `/tmp/racing-write-probe-shared-builtins-matrix-ranges.json`
  (`2026-06-18T11:36:46.126Z`).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-analytic-burst-particles.json`
  (`2026-06-18T11:15:53.036Z`, after analytic burst particle rendering).
- Previous WebGPU write probe saved at
  `/tmp/racing-write-probe-analytic-burst-particles.json`
  (`2026-06-18T11:15:40.862Z`).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-shadow-world-transforms.json`
  (`2026-06-18T10:54:30.190Z`, after shadow caster pass-matrix plus
  world-transform buffer submission).
- Earlier same-script WebGPU write-probe results from `2026-06-18T10:54:22Z`
  are cited in the historical notes below; the temporary file path was reused
  by the latest probe.
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-ground-ribbon-ranges.json`
  (`2026-06-18T10:19:32.653Z`, after compact mesh-world transform packing and
  fixed-capacity ground-ribbon update ranges).
- Previous WebGPU write probe saved at
  `/tmp/racing-write-probe-ground-ribbon-ranges.json`
  (`2026-06-18T10:18:27.416Z`).
- Previous WebGPU write probes saved at
  `/tmp/racing-write-probe-prepared-mesh-reuse.json`
  (`2026-06-18T10:14:09.595Z`) and
  `/tmp/racing-write-probe-compact-mesh-transforms.json`
  (`2026-06-18T10:00:29.862Z`).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-after-draworder-skip.json`
  (`2026-06-18T09:40:26.128Z`, after baked shadow matrix reuse, shared Standard
  frame resources, multi-range transform dirty uploads, and draw-order
  transform upload skipping).
- Previous WebGPU write probe saved at
  `/tmp/racing-write-probe-draworder-skip.json`
  (`2026-06-18T09:39:58.500Z`).
- Intermediate WebGPU write probes saved at
  `/tmp/racing-write-probe-shared-standard.json`
  (`2026-06-18T09:32:17.822Z`) and
  `/tmp/racing-write-probe-multirange.json`
  (`2026-06-18T09:37:54.545Z`).
- Previous same-day benchmark after baked shadow matrix reuse saved at
  `/tmp/racing-frame-audit-baked-shadow-cache.json`
  (`2026-06-18T09:11:23.392Z`).
- Previous current-source isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-particle-view-buffer.json`
  (`2026-06-18T08:52:40.094Z`).
- Previous phase-rich isolated-header headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-isolated-latest.json`
  (`2026-06-18T08:35:14.202Z`, after the shadow extraction cache and
  presentation catch-up fixes).
- Previous SAB particle/audio/frame-matching headed Playwright benchmark saved
  at `/tmp/racing-frame-audit-isolated-latest.json` before the shadow-cache
  slice (`2026-06-18T08:07:16.282Z`).
- Previous plain-server headed Playwright benchmark saved at
  `/tmp/racing-frame-audit-latest.json` (`2026-06-18T07:25:35.078Z`).
- Live Racing diagnostics probe after the latest rebuild on the temporary
  isolated server at `http://127.0.0.1:5186/`.
- Local three.js reference: `references/Starter-Kit-Racing`.
- Current Aperture sources under `packages/`, `racing/`, and `test/`.
- Earlier recovered Codex session note from
  `~/.codex/sessions/2026/06/17/rollout-2026-06-17T18-18-45-019ed84f-222b-7bb2-83c7-2b9dbbd75043.jsonl`.

This note compares the Aperture Racing app against
`references/Starter-Kit-Racing`, the original three.js/WebGL reference. It also
tracks Aperture-specific issues that are not three.js parity issues but are
obvious engine quality gaps.

## Bottom Line

The fixes pursued here are generalized engine fixes, not Racing-only benchmark
hacks.

- Opaque rigid mesh batching is now implemented as render-phase grouping plus a
  separate draw-order transform buffer. It is keyed by real render
  compatibility, not by Racing asset names.
- Shadow batching now groups compatible caster records and preserves submesh
  index ranges. It applies to any shadow-casting mesh path with compatible
  pipeline and resources.
- Particle resource reuse now collapses hundreds of same-effect Racing smoke
  emitters to a small draw footprint. The remaining ECS count is still high, but
  the renderer no longer treats each burst as an independent expensive draw.
- GPU timestamp readbacks are opt-in, because synchronous timing drains are
  harmful for every app, not just this scene.
- Snapshot change-set comparison and report serialization now avoid broad JSON
  signature/deep-clone work on the hot path.
- Bounds change-set keys now include `boundsId`, so multiple bounds records for
  the same entity no longer overwrite each other before equality checks run.
- Worker summary publishing no longer sends a full entity lookup every snapshot;
  the browser merges retained fields for tooling.
- MSAA + bloom/tonemap now stays on the post FrameGraph path instead of falling
  back to legacy per-pass submits.
- `getDiagnostics()` now returns cached JSON for the last completed render/pick
  report instead of reserializing the full frame report on every browser RAF.
- Fog packets are now supported by the packed shared-snapshot codec, so fogged
  mesh frames no longer force the transferable path when SharedArrayBuffer is
  available.
- The generated worker uses a `MessageChannel` tick scheduler when available,
  avoiding the clamped `setTimeout(0)` loop as the normal worker cadence path.
- Spatial index population now caches adapted mesh assets and per-entity
  bounds/mesh entries by mesh, mesh version, entity version, and transform
  version, so static geometry no longer pays full spatial rebuild work every
  step.
- Bloom post-processing now caches stable bind groups/commands by resource
  identity, so unchanged bloom graphs do not recreate the same WebGPU command
  objects every frame.
- Automatic shadow caster work can now be folded into the same post FrameGraph
  submission as the scene and post passes. This removes the extra standalone
  shadow `queue.submit` without changing Racing scene content.
- Particle emitter packets are now supported by the packed shared-snapshot ABI,
  so Racing drive/smoke frames no longer force the transferable path.
- Audio packets now ride a compact placeholder snapshot sideband while render
  packets stay in SAB. The sideband copies only the audio-referenced matrices
  and rewrites their offsets, preserving the main-thread audio contract without
  transferring the full render snapshot.
- Shared snapshot decode now requires the readable SAB frame to match the worker
  message frame. Stale messages are skipped instead of decoding newer packet
  words with an older registry, which eliminated the intermittent handle-id and
  invalid-index-buffer validation errors seen during SAB probing.
- Shadow caster extraction now has its own cache bucket, separate from the
  main-camera mesh cache. Static off-camera casters keep byte-identical packets
  without re-reading mesh/material/submesh state every frame.
- Worker snapshot presentation scheduling now records a RAF tick that happens
  while a render is in flight and immediately renders the latest pending
  snapshot after the current render completes, rather than always waiting one
  additional RAF.
- Particle rendering now reuses a cache-owned view-uniform GPU buffer and
  updates it with `queue.writeBuffer` instead of allocating a fresh
  `Particle/ViewUniforms` buffer every particle frame.
- Baked directional shadow caster matrices now reuse cache-owned scratch data
  and skip `queue.writeBuffer` when the baked matrix bytes are unchanged.
- Standard material app-frame resource preparation now shares app-cache-owned
  view uniform and world-transform resources across compatible Standard routes.
- Packed transform snapshots can now carry bounded multi-range dirty windows,
  and the WebGPU resource uploader consumes those windows instead of inflating
  sparse far-apart changes into one large upload solely because the envelope is
  wide.
- The draw-order world-transform buffer now keeps a copy of the last uploaded
  bytes and skips the per-frame upload when draw-order matrices are identical.
- Mesh frame resources now use a compact mesh-world transform pack containing
  only matrices referenced by mesh draw packets. The raw extraction-order
  transform table remains available for overlay/picking paths that still need
  raw offsets.
- Dynamic mesh preparation can now reuse same-layout GPU buffers across asset
  version bumps and honor per-buffer byte update ranges. Ground ribbons publish
  fixed-capacity buffers plus per-segment update ranges, matching the reference
  drift-mark update model without Racing-specific conditionals.
- Shadow caster submission now binds one pass light matrix plus a draw-list
  world-transform storage buffer. Compatible caster records use contiguous
  `firstInstance` slots, so the shader computes `lightViewProjection * world`
  instead of the CPU rebaking and uploading one light-space matrix per caster.
- Burst particle batches now upload initial burst particle state into stable
  batch slots and evaluate age, motion, size, and color in the render shader.
  New burst slot writes are coalesced by byte range; existing live particles no
  longer reupload full simulated position/color data every particle frame.
- Queued built-in material families now share one prepared view-uniform buffer
  and one prepared world-transform buffer for the frame instead of each route
  preparing duplicate built-in buffers with the same resource key.
- Transform dirty uploads now use matrix slots as the changed unit. Sparse
  changed matrices are uploaded as matrix-aligned ranges instead of being
  inflated into large float-envelope uploads.
- Mesh and shadow-caster extraction caches no longer key static draw templates
  on the full camera frustum signature. Culling and sort depth are recomputed
  from the current view each frame, while unchanged packet templates remain
  reusable.
- Opaque/alpha-test mesh draw change detection now treats depth-only sort-key
  movement as ordering metadata, not resource identity. Transparent draw depth
  changes still invalidate as order-sensitive.
- Render bundles can now cover a stable render-pass command prefix while
  dynamic overlay/particle tail commands execute directly in the same pass.
  The post-processing graph scene node uses that prefix path, so bloom/tonemap
  routes can reuse base-scene bundles without bundling frame-local particle
  bind groups.
- Render-bundle keys include captured bind-group object identity, and replaced
  transform/uniform buffers are retired through `queue.onSubmittedWorkDone()`
  instead of being destroyed synchronously. The accepted final audit has
  `0` destroyed-buffer validation warnings.
- App-facing render-bundle diagnostics now summarize long command keys by hash
  and length, and app-facing shadow diagnostics keep exact counts plus a small
  draw sample instead of retaining the full 364-record caster list in the
  browser status object.
- Generated worker status no longer retains full entity/resource/asset/physics
  summaries in steady state. Entity lookup is now an on-demand tool/dev-panel
  path, and browser status drops transient full-summary fields when thin worker
  summaries arrive.
- App-facing render reports now keep full retained resource detail for explicit
  report/tool consumers but compact the browser status copy to totals and
  family counts, dropping per-entry retained mesh/material details from the hot
  status object.
- Generated browser performance timing still records each worker snapshot, but
  publishes the expensive rolling browser status summary only on a telemetry
  cadence.
- App-facing render change sets now compact the status-visible key lists to
  counts plus short samples. A non-enumerable full diagnostics accessor keeps
  exact keys available for CLI/debug tooling.
- The generated simulation worker now has an explicit tick-rate scheduler
  (`240 Hz` by default, configurable for unusual apps) instead of publishing
  snapshots as fast as the event/message loop can run. This prevents any
  generated app from flooding the main thread with stale snapshots.
- Heavy generated worker summaries are now published on an elapsed-time cadence
  instead of `frame % 30`. This preserves frame-0/full tooling data while
  avoiding an accidental eight full summaries per second at a 240 Hz worker
  tick rate.

The current local benchmarks are **not** yet proof of a clean Aperture win. The
latest accepted changes remove real per-frame GPU allocation/write pressure,
stabilize more main-draw identity, reuse render bundles on unchanged post-graph
scene prefixes, reduce app-facing diagnostics churn, remove the unbounded
worker snapshot publication bug, and rate-limit heavy full worker summaries by
elapsed time. In the latest exact current run, Aperture is still behind three.js
at idle p95 and materially behind in drive p95/p99/max with much higher heap;
idle p99 is slightly better than the reference in this run. The latest write
probe removes the idle
`WorldTransforms/storage` hot spot and keeps drive write pressure near
`2 KB/frame` display-normalized; the latest status probe cuts the app-facing
`diagnostics.lastFrame.renderChangeSet` copy from roughly `16.8 KB` to
`2.1 KB` while preserving the full `16.4 KB` change-set through an explicit
tooling accessor, and the latest worker-summary cadence probe keeps generated
status around `36 KB` with a thin `~2.1 KB` worker summary. The remaining
problem is frame cadence/tail latency, heap retention, residual
change-set/bounds broadness, and particle-heavy drive work, not one dominant
dynamic-buffer byte source or one stale-snapshot message flood.
Treat the frame table as a browser/display pacing signal; the submit-cadence,
WebGPU write, worker cadence, and Aperture diagnostics tables are the
renderer-cadence evidence.

## Latest Method

Fresh measurement used the current Aperture Racing production build served from
`racing/dist` and the three.js reference served locally from
`references/Starter-Kit-Racing`.

- Browser: headed Chromium through Playwright.
- Viewport: `1280x720`, DPR `1`.
- Trials: 3 paired trials per app.
- Per trial: 4 seconds warm-up, 6 seconds idle sample, then hold `W+D`, wait
  1.5 seconds, and sample 6 seconds of drive/smoke.
- Latest local run: Aperture served from `racing/dist` by a temporary static
  server with `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` on `http://127.0.0.1:5186/`;
  `SharedArrayBuffer` active in all Aperture samples.
- Instrumentation:
  - unique `requestAnimationFrame` timestamp intervals;
  - wrapped RAF callback duration;
  - WebGL/WebGPU draw-call proxies;
  - Long Task observer;
  - JS heap from `performance.memory` when exposed by Chromium;
  - Aperture generated render diagnostics for draw, shadow, change-set, and
    particle counts.

The reference is three.js `WebGLRenderer`, not three.js WebGPU. WebGL/WebGPU
proxy draw-call counts are directional; Aperture's internal frame diagnostics
are the authoritative source for Aperture draw submission shape.

Important measurement caveat: the frame-interval values below are unique RAF
timestamps observed by the page, not necessarily app render completions. The
three.js reference renders from its RAF loop. Aperture renders from simulation
worker snapshot events, while input/diagnostics still schedule their own RAF
callbacks. In the latest run Aperture reported far more RAF callbacks than
display timestamps, and WebGPU submits now track rendered graph frames at about
one submit per rendered frame.

## Latest Frame-Time Summary

Latest current-source isolated local server (`SharedArrayBuffer` active for
Aperture):

| Scenario       | Avg frame |     p50 |     p95 |     p99 | Max frame |  JS heap |
| -------------- | --------: | ------: | ------: | ------: | --------: | -------: |
| Aperture idle  |   4.17 ms | 4.17 ms | 4.75 ms | 5.05 ms |   5.19 ms | 43.50 MB |
| three.js idle  |   4.17 ms | 4.17 ms | 4.64 ms | 5.07 ms |   5.19 ms | 18.05 MB |
| Aperture drive |   4.17 ms | 4.17 ms | 4.84 ms | 6.20 ms |   8.53 ms | 67.05 MB |
| three.js drive |   4.17 ms | 4.17 ms | 4.64 ms | 5.10 ms |   5.21 ms | 18.97 MB |

This is still not a clean win. Aperture idle is essentially tied at p95/max and
slightly ahead at p99 in this run. Aperture drive remains behind at p95, p99,
and max frame, with a large `8.53 ms` tail sample and p99 `6.20 ms`. Aperture
heap improved materially after time-based full worker summaries, but still
remains far above the reference in both idle and drive; memory pressure should
be treated as an active blocker rather than a solved secondary issue.

Rendered WebGPU submit cadence in the same run:

| Scenario       | WebGPU submits in 6s | Approx submits/sec | Proxy draw calls/sec |
| -------------- | -------------------: | -----------------: | -------------------: |
| Aperture idle  |           `883-1236` |          `147-206` |               `7369` |
| Aperture drive |           `870-1090` |          `145-182` |               `9079` |

The previous plain-server run (`SharedArrayBuffer` unavailable) was much worse:
Aperture drive averaged `5.85 ms`, p95 `8.57 ms`, p99 `9.10 ms`, and only
`167-172` submits/sec. The current source is much closer, but still not enough
to declare the active goal complete.

Latest status-payload shape from the same rebuilt app:

| Status field                         | Size / shape |
| ------------------------------------ | -----------: |
| generated app status                 |    `36.2 KB` |
| `diagnostics`                        |    `26.0 KB` |
| `diagnostics.lastFrame`              |    `24.0 KB` |
| `lastFrame.resourceReuse`            |     `1.7 KB` |
| status `lastFrame.renderChangeSet`   |     `2.1 KB` |
| full accessor `renderChangeSet`      |    `16.4 KB` |
| `lastFrame.shadow`                   |     `6.7 KB` |
| `lastFrame.diagnosticsSummary`       |     `6.3 KB` |
| `lastWorkerSummary`                  |     `2.1 KB` |
| retained worker `entities/resources` |       absent |

This status cleanup is a generalized tooling/perf fix. It materially reduces
retained browser status payloads, but it did not by itself make the frame-time
benchmark a clean Aperture win.

The full render-change-set keys remain available through the non-enumerable
`__apertureRenderDiagnostics` status accessor, so CLI entity/packet explanation
tools do not depend on the compact browser status copy. In the live probe the
accessor was confirmed non-enumerable.

Latest worker cadence after generated-worker tick-rate pacing:

| Scenario       | Snapshot Hz | Presentation Hz | Render-complete Hz | Pending replacements |
| -------------- | ----------: | --------------: | -----------------: | -------------------: |
| Aperture idle  |    `~239.4` |             n/a |           `~223.2` |                `102` |
| Aperture drive |    `~240.0` |        `~219.5` |           `~214.3` |                `201` |

Before tick-rate pacing, live probes saw worker snapshot publication around
`590 Hz` idle and `444-450 Hz` drive, with thousands of pending snapshots
replaced. The new cap removes that message flood. Time-based full worker
summaries then cut visible worker-summary payloads back to about `2.1 KB` on
thin frames. These fixes do not make drive a display-rate render path because
particle-heavy drive frames still fall behind.

Latest WebGPU write pressure after shared queued built-in frame resources,
matrix-slot transform dirty uploads, and the frustum-independent extraction
cache fix:

| Scenario       | Writes/frame | Bytes/frame | Main remaining pressure                                                                                                                                                                        |
| -------------- | -----------: | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aperture idle  |       `1.88` |   `0.15 KB` | indirect draw buffer at `0.09 KB/frame`; directional shadow pass matrix at `0.06 KB/frame`                                                                                                     |
| Aperture drive |       `8.96` |   `2.09 KB` | analytic burst initial slot writes at `0.44 KB/frame`; `WorldTransforms/storage` at `0.37 KB/frame`; `ShadowCasterWorldTransforms/storage` at `0.24 KB/frame`; light floats at `0.21 KB/frame` |

The analytic burst path still works: the previous full-state
`Particle/BurstBatch/...smoke...` upload remains gone. The new shared built-in
frame-resource path removes duplicate per-material-family view/world uploads,
and the matrix-slot dirty writer stops sparse changed matrices from inflating
into broad float-envelope writes. The result is a much flatter drive write
profile: no single label is above `0.45 KB/frame` display-normalized in the
latest probe.

Interpretation:

- Browser display RAF cadence is near 240 Hz for both apps while idle.
- Aperture idle is near display-frame parity after worker tick-rate pacing, but
  still trails three.js slightly on p95 in the latest paired run.
- Aperture drive remains below display cadence and trails on p95/p99/max frame.
  The worker no longer floods snapshots, and heavy full summaries are no longer
  frame-count based, so this is now real drive-frame work, memory/tail
  pressure, and scheduler policy rather than an unbounded message loop.
- The shadow extraction cache previously moved worker extraction from
  `~1.7-1.9 ms` idle and `~2.2-2.3 ms` drive to `~0.72-0.75 ms` idle and
  `~1.29-1.34 ms` drive.
- The narrower presentation catch-up scheduler and the worker tick-rate cap are
  useful in focused tests, but the latest drive cadence remains below display
  cadence when particles are active.
- An immediate scheduled-snapshot drain experiment was measured and rejected:
  it raised submit count, but the paired audit regressed p95/p99/max
  (`/tmp/racing-frame-audit-idle-drain.json`). It was not left as the active
  frame-loop policy.
- No Aperture render failures were recorded in the clean isolated benchmark.
- No destroyed-buffer validation warnings were recorded in the accepted final
  benchmark after deferred transform/uniform buffer retirement. The only
  Aperture warnings were three copies of the existing initialization
  deprecation warning.

## Current Aperture Render Shape

### Idle

- `meshDraws`: `40`
- `shadowCasterDraws`: `364`
- `drawPackages`: `40`
- frame `drawCommands`: `125`
- frame `drawCalls`: `25`
- `fogs`: `1`
- main render packages/descriptors/drawList/resolved: `40 / 40 / 14 / 14`
- command-pressure resolved draws: `14`
- command-pressure draw commands: `12`
- shadow included caster records: `364`
- shadow grouped draw calls: `30`
- post graph: shadow depth + scene + `12` bloom nodes + `1` tonemap node under
  MSAA, submitted as one graph command buffer
- proxy WebGPU submits: `883-1236` over the 6 second samples; proxy draw-call
  rate averaged about `7369` WebGPU draw calls/sec
- live cadence probe after worker pacing and summary cadence: snapshot cadence
  about `239 Hz`, render-complete cadence about `223 Hz`, with `102` pending
  snapshots replaced
- previous worker extract avg after the shadow cache: `0.72-0.75 ms`
- worker transport: `shared-array-buffer` in all latest isolated samples
- diagnostics: `0`

Idle change-set state:

- `meshDraws`: `0 changed`, `40 unchanged`
- `shadowCasterDraws`: `0 changed`, `364 unchanged`
- `bounds`: `76 changed`, `328 unchanged`

The original idle rigid-mesh problem is fixed. Aperture no longer submits one
main draw per decoration and no longer marks all static mesh/shadow packets as
changed every idle frame.

### Drive

- `meshDraws`: `42`
- `particleEmitters`: `306`
- `liveParticles`: `900` in the sampled latest run
- `drawPackages`: `42`
- frame `drawCommands`: `168`
- frame `drawCalls`: `32`
- `fogs`: `1`
- main render packages/descriptors/drawList/resolved: `42 / 42 / 20 / 20`
- command-pressure draw commands: `18`
- shadow included caster records: `364`
- shadow grouped draw calls: `30`
- post graph: shadow depth + scene + `12` bloom nodes + `1` tonemap node under
  MSAA, submitted as one graph command buffer
- proxy WebGPU submits: `870-1090` over the 6 second samples; proxy draw-call
  rate averaged about `9079` WebGPU draw calls/sec
- live cadence probe after worker pacing and summary cadence: snapshot cadence
  about `240 Hz`, render-complete cadence about `214 Hz`, with `201` pending
  snapshots replaced
- previous worker extract avg after the shadow cache: `1.29-1.34 ms`
- worker transport: `shared-array-buffer` in all latest isolated samples
- particle states created/reused: `6-8 / 299-301` in sampled latest runs
- particle texture resources created/reused: `0 / 1`
- particle sampler resources created/reused: `0 / 1`
- diagnostics: `0`

Drive change-set state is improved for shadows and substantially improved for
main mesh identity, but it is still not settled. The latest aggregate frame
reported `6 / 42` changed mesh draws, `6 / 364` changed shadow caster draws,
and `386 changed`, `326 unchanged` bounds in the final drive sample.

The separate 7 second live drive distribution probe after opaque depth-only
identity reported only `5 / 219` samples with broad main-mesh changes
(`>=30` changed mesh draws), down from `98 / 222` before that fix. Broad
shadow-caster changes were `21 / 219`; common steady buckets were narrow or
unchanged (`0/44|0/364`, `2/42|0/364`, `6/38|6/358`).

That remaining active-drive churn is not fatal to the current draw count
because render-phase grouping still collapses compatible records, the
matrix-slot uploader keeps byte pressure low, and stable scene prefixes now
reuse render bundles. It is still a clean follow-up for frame pacing and the
remaining visibility/resource changes that keep some drive frames from bundle
reuse.

The smoke path still produces many ECS/extraction emitters, but it no longer
causes the previous draw explosion. That makes the remaining emitter count an
API/extraction pressure issue rather than the dominant render-submit problem.

Implementation probes after the spatial cache, graph-folding, and shadow-cache
work showed:

- spatial post-step refresh dropped from multi-millisecond work to roughly
  `0.2 ms` on stable frames;
- standalone shadow submit pressure dropped from about two WebGPU submits per
  rendered frame to roughly one graph submit per rendered frame;
- encoded draw volume returned to the non-duplicated range after the shadow
  frame learned to plan graph-folded passes without also encoding an unused
  legacy command buffer;
- isolated transport: `SharedArrayBuffer` is available and the app-level
  transport is active; idle and drive/smoke samples now use the SAB packet path.
- audio sideband transport preserves audio packets for the main-thread audio
  engine without forcing the render snapshot back to transferable.
- shared-frame matching skips stale worker messages instead of decoding the
  latest SAB packet words with an older message registry.
- shadow caster extraction now hits a dedicated shadow cache on unchanged
  casters; the latest idle change set reports all `364` shadow caster draw
  records unchanged.

## Current Three.js Reference Anchors

The reference keeps the two important batching choices in source:

- Decorations use `THREE.InstancedMesh` in
  `references/Starter-Kit-Racing/js/Track.js`.
- Smoke uses one pooled `THREE.Points` object with capacity `1280` in
  `references/Starter-Kit-Racing/js/Particles.js`. It updates dynamic
  `position`, `aOpacity`, and `aSize` attributes and keeps draw topology flat.

Aperture now matches the rigid-decoration intent at the renderer level rather
than by exposing `InstancedMesh` as an app concept. Aperture's burst particle
path now also matches the important reference-pool property: stable per-particle
initial state is uploaded once into renderer-owned slots, while the render
shader evaluates age, motion, size, and color from time. The ECS surface still
exposes each Racing smoke burst as a separate emitter packet, but the renderer
no longer reuploads full simulated particle state for every live burst each
particle frame.

## What Was Fixed

### 1. Rigid Mesh Batching

Opaque draw-order transform packing rewrites compatible draw records into a
separate draw-order transform buffer and updates each draw's
`transformPackedOffset`. Existing coalescing can then emit `instanceCount > 1`
without shader changes.

This is general because it operates on sorted render records and compatibility
keys. It is not tied to Racing's tree, rock, or track assets.

Important constraints that keep it correct:

- It writes a separate draw-order buffer instead of mutating the extraction
  order `worldTransforms` buffer.
- It does not batch transparent depth-sorted draws.
- It excludes transform-slot-indexed side-buffer cases that would need
  lockstep repacking.
- It preserves picking and previous-transform history because those still use
  extraction-order slots.

### 2. Shadow Batching

Shadow caster planning now groups compatible caster records and emits grouped
draws. The shadow path owns its private baked matrix buffer, so it can group
without the pick/motion-vector concerns of the main pass.

Current result: `364` caster records submit as about `30` grouped shadow draw
calls in this scene.

### 3. Automatic Shadow FrameGraph Folding

Automatic directional shadow work can now be represented as shadow graph passes
and folded into the same FrameGraph submission as the built-in scene and post
passes. The shadow frame can also run in plan-only mode when graph folding owns
the eventual encoding, so the renderer no longer creates an unused legacy
shadow command buffer just to discover shadow-pass work.

This is general because it is keyed by frame graph participation and
`ShadowCasterGraphPass` data, not by Racing. The graph route also fails closed:
if shadow graph passes are provided and the post graph declines, the frame
reports a diagnostic instead of silently dropping shadows.

Current result: current Racing diagnostics report shadow status `ready`,
`passCount: 1`, `364` included caster records, `30` grouped shadow draws, and
about one WebGPU submit per rendered graph frame.

### 4. Spatial Index Population Cache

Spatial index population now caches adapted mesh assets and per-entity spatial
entries. Mesh adaptation/local AABB work is reused by mesh asset version, and
per-entity bounds/mesh entries are reused by entity version, transform version,
mesh id, and mesh version.

This is general because it optimizes the app-level spatial query path used by
picking/raycasting/interaction, not Racing rendering. The cache still prunes
despawned entities and removed mesh assets, and transform-only changes refresh
world bounds without rebuilding mesh geometry.

Implementation probes showed stable-frame post-step spatial refresh dropping
from multi-millisecond work to roughly `0.2 ms`.

### 5. Bloom Command Cache

Bloom post-processing now caches the stable command/bind-group work for
brightpass, blur, and composite passes by pipeline/resource identity. Resize or
resource replacement still invalidates the relevant slots.

This is general because it applies to any Aperture app using the renderer-owned
bloom graph. It removes repeated WebGPU bind-group/command object churn without
changing bloom quality or Racing scene content.

### 6. Particle Submit Pressure

The first audit found drive frames around `333-335` Aperture draw calls and
roughly `1670-1682` draw commands when smoke was active. The current drive
sample reports `32` draw calls and `168` draw commands.

The remaining `306` particle emitters / `918` live particles should still be
cleaned up over time, but the render-submit shape is no longer the dominant
Racing regression.

### 7. GPU Timing Drain

GPU timestamp readbacks are now opt-in. Normal Racing frames now report
`gpuTimings: null`, avoiding the queue drain cost of timestamp readback.

Profiler evidence from the implementation pass showed submit time dropping
from roughly `2.8 ms` to about `0.25-0.30 ms` on normal frames after this was
changed.

### 8. Render CPU Hot Paths

Two CPU hot paths were removed from normal frame work:

- Render-phase batch keys no longer allocate array-entry structures and
  URI-escaped strings in the hot path.
- Snapshot change-set comparison no longer builds broad JSON string signatures
  for common packet families, and report creation avoids deep-cloning the
  already JSON-safe change-set/schedule objects.

Profiler evidence from the implementation pass:

- `prepare` dropped from roughly `12 ms` to about `1.5-1.9 ms`.
- `collect` dropped from roughly `3 ms` to about `0.5-0.6 ms`.
- Normal render CPU totals settled around `2.4-2.9 ms`.

### 9. Worker Status Payload

The generated worker no longer attaches a full entity lookup summary to normal
snapshot summaries. Entity details are now resolved through on-demand
devtool/runtime commands, and the developer panel requests its initial entity
snapshot explicitly. Thin worker summaries keep low-cost live counters and
timings.

The browser status merger also drops transient full-summary fields
(`resources`, `startOptions`, `assets`, `physics`, and legacy `entities`) when
thin summaries arrive, while preserving `entityTools` for on-demand tools. This
prevents old full summaries from being retained indefinitely in the generated
app status object.

This is a general Aperture payload fix. It cut steady Racing generated app
status from roughly `152 KB` before this slice to `51.7 KB` after retained
resource compaction, and later status change-set/full-summary cadence work
brought the latest live status probe to about `36.2-36.3 KB`. It should be
treated as tooling/runtime health rather than a standalone frame-time win.

### 10. MSAA Post FrameGraph Route

MSAA no longer forces the bloom/tonemap path back to legacy per-pass command
submission. The scene graph node now resolves the MSAA scene pass into the
graph's scene-color texture, preserving the post graph under Racing's
`sampleCount: 4` config.

Current result: the post route reports one graph order containing the shadow
depth node, scene node, `12` bloom nodes, and the final tonemap node. Local
proxy submit pressure is now roughly one submit per rendered graph frame.

### 11. Diagnostics JSON Cache

`createWebGpuApp.getDiagnostics()` now returns cached JSON values for the most
recent render and pick reports. The expensive conversion from internal report
objects to JSON-safe diagnostics happens once when the report is produced, not
again every time browser status mirroring or devtools reads diagnostics.

This is a general tooling hot-path fix. It preserves the diagnostic shape while
removing repeated report walking from the RAF diagnostics mirror.

### 12. Snapshot Presentation Coalescing And Worker Scheduling

Worker-produced snapshots are now coalesced to presentation RAF on the WebGPU
app side: the latest pending snapshot wins, one render is scheduled at a time,
and a new render is scheduled after completion if another snapshot arrived
while rendering was in flight.

This avoids building render queues for stale worker events. The generated
worker also now schedules ticks through `MessageChannel` when available, with
`setTimeout(0)` only as fallback. It does not by itself make Racing a consistent
240 Hz render path because the app is still a fixed-step worker simulation with
snapshot-driven rendering and expensive drive-frame work.

### 13. Fog In Shared Snapshot Codec

The packed snapshot ABI now includes fixed-width fog packets and increments the
packet version. Shared snapshot reconstruction preserves `snapshot.fogs` and
`report.fogs`, and fogged mesh frames no longer force full transferable
snapshots.

This is validated by render codec, worker fallback, and WebGPU shared-snapshot
tests.

### 14. Particle Packets In Shared Snapshot Codec

The packed snapshot ABI now includes fixed-width particle emitter packets and
increments the packet version. Shared snapshot reconstruction preserves
`snapshot.particleEmitters`, including burst mode and particle-effect handles.

This is general because it extends the renderer snapshot transport for any
particle-using app. In Racing it means drive/smoke frames no longer force a
full transferable snapshot solely because they contain particle emitters.

### 15. Audio Sideband For SAB Render Frames

Audio packets are consumed by the main-thread audio engine, not by the WebGPU
renderer. The shared render path now sends a compact placeholder snapshot that
contains audio emitters/listener plus only the matrices referenced by those
audio packets, with `worldTransformOffset` rewritten into that compact buffer.

This preserves the existing audio subscriber contract while keeping the bulky
render packet families in SAB. It applies to any generated browser app with
audio enabled.

### 16. Shared Frame/Registry Matching

The SAB reader now decodes only when the readable shared frame number matches
the worker message frame. If the worker has already advanced the double buffer,
the stale message is skipped instead of decoding newer packet words with an
older packet registry.

This fixed intermittent SAB-only probe failures such as unknown packet handle
ids and invalid index-buffer draw ranges.

### 17. Shadow Caster Extraction Cache

Render extraction now keeps a dedicated cache bucket for shadow-caster mesh
draw packets. This is separate from the main mesh cache, so an off-camera caster
that is invisible to the primary camera can still be cached and included in the
shadow pass without inheriting main-view culling state.

The cache is guarded by entity version, transform version, and camera/caster
layer mask. It deliberately does not key shadow-caster templates on the primary
camera frustum. Transform-only changes refresh the matrix and derived bounds
while preserving cached packet templates. It excludes the same side-buffer-heavy
cases as the main mesh cache.

Previous phase-rich result: Racing worker extraction dropped to
`0.72-0.75 ms` idle and `1.29-1.34 ms` drive after the shadow extraction cache.

### 18. Worker Snapshot Presentation Catch-Up

The WebGPU worker-snapshot loop now records a presentation callback that occurs
while a render is in flight. If another snapshot is pending when the current
render completes, the renderer immediately consumes the latest pending snapshot
instead of always waiting for one more RAF.

This is a generalized scheduler fix for snapshot-driven apps: it coalesces stale
worker events, keeps at most one render in flight, and avoids adding a
Racing-specific render path. A broader display-driven RAF loop was tested and
rejected because it reduced submit cadence in this route.

### 19. Particle View-Uniform Buffer Cache

Particle frame preparation now keeps a cache-owned `Particle/ViewUniforms`
buffer and updates it with `queue.writeBuffer` on particle frames. The old path
created a fresh GPU buffer every particle frame. If a later snapshot needs a
larger view-uniform payload, the cached buffer is destroyed and recreated at the
larger size.

This is general to all particle-using apps. Racing exposes it because drive
frames continuously prepare smoke particle resources, but the fix is not tied
to Racing emitters or smoke assets.

A bounded late-latch scheduler experiment was also tested after this cache
change. It rendered a pending worker snapshot immediately when an in-flight
render completed before the scheduled RAF. The idea was general, but the Racing
benchmark worsened drive p95/p99/max and did not consistently improve submit
counts, so the experiment was reverted.

### 20. Baked Shadow Caster Matrix Upload Reuse

The directional shadow path now owns reusable baked-matrix scratch storage and
keeps the last uploaded baked caster matrix bytes on the cached GPU resource.
If the next frame produces identical baked caster matrices, the renderer skips
the `DirectionalShadowCasterBakedMatrices/storage` write.

This is general to directional shadow caster submission. It is not a Racing
asset shortcut; it keys off byte-identical baked matrices and preserves the
existing recreate-on-size-change behavior.

### 21. Shared Standard Frame Resources

Standard material app-frame preparation now has app-cache-owned shared
view-uniform and world-transform resource slots. Compatible Standard routes can
reuse those resources instead of preparing duplicate route-local view/world
resources.

This is general to StandardMaterial frames. An intermediate Racing write probe showed
that it reduces duplicated writes/resource setup. The later compact mesh-world
transform packer is what removed most of the remaining extraction-order
world-transform bytes from mesh routes.

### 22. Multi-Range Transform Dirty Uploads

Packed transform snapshots can now carry a bounded list of dirty ranges in
addition to the existing envelope range. The WebGPU dirty uploader writes those
separate ranges when the previous GPU buffer version is exactly one frame
behind, and still falls back to a full upload when the changed-float threshold
or range-count cap says that is cheaper/safer.

This is a generalized transform-buffer optimization. It became more useful once
mesh routes stopped consuming the full extraction-order transform table.

### 23. Draw-Order Transform Upload Skip

The draw-order transform buffer now keeps a copy of its last uploaded
`Float32Array` content. When the sorted draw-order matrix bytes are unchanged,
the renderer reuses the existing GPU buffer without another
`WorldTransforms/draw-order` write.

This is general to any route using draw-order transform packing. In the
intermediate Racing write probe it removed the idle per-frame draw-order upload
entirely after the initial stable upload and kept drive draw-order uploads at
`51` writes across `1194` sampled display RAF intervals.

### 24. Compact Mesh-World Transform Packing

Mesh frame resources now pack only transforms referenced by mesh draw packets
into the mesh world-transform buffer. This is intentionally a separate buffer,
not an in-place rewrite of the raw extraction-order transform table, because
overlay sprites/text, picking, and some history paths still key off raw
extraction offsets.

This is a renderer-level route-coverage fix. It contains no Racing asset names
or tree/deco assumptions. The initial compact-packing probe moved
`WorldTransforms/storage` from the earlier `~52.5 KB/frame` idle and
`~128 KB/frame` drive extraction-order uploads down to roughly
`4.6 KB/frame` idle and `5.0 KB/frame` drive. The newer shared-builtins and
matrix-slot dirty range work below reduces the current drive value further.

### 25. Fixed-Capacity Dynamic Mesh Update Ranges

Prepared mesh resources can now reuse same-layout GPU buffers across source
asset version bumps and consume optional byte update ranges for vertex and
index buffers. Dynamic ground ribbons use that contract by publishing fixed
capacity vertex/index buffers, changing only the submesh draw range, and
marking the one segment written before each flush.

This mirrors the reference drift mark strategy (`addUpdateRange`) but is not a
Racing-only port. Any procedural mesh producer can use the same update-range
contract. In the latest drive write probe, `Drift trail bl` and
`Drift trail br` each sit around `72 bytes/frame`; drift index
writes are no longer in the hot list.

### 26. Shadow Caster World-Transform Instancing

The directional shadow caster shader now binds one per-pass light
view-projection uniform plus a caster world-transform storage buffer. Shadow
command planning maps each `${passKey}:${renderId}` to a draw-list-order world
matrix index and uses that index as `firstInstance`. Compatible caster records
therefore draw through the same instancing contract as the main pass, while the
shader computes `lightViewProjection * world * localPosition`.

This is a generalized shadow submission design, not a Racing shortcut. It
removes the need to CPU-bake and upload one light-space matrix per caster when
camera/light state changes. The world-transform buffer has a clustered dirty
upload policy: byte-identical frames skip, small clustered changes write a
bounded range, and broad changes still fall back to a full write.

In the latest Racing drive probe, the old
`DirectionalShadowCasterBakedMatrices/storage` top-line cost of about
`17.4 KB/frame` is gone. The replacement
`ShadowCasterWorldTransforms/storage` cost is one `380` byte write per shadow
frame, about `0.23 KB/frame` display-normalized.

### 27. Analytic Burst Particle Rendering

Burst particle batches now use a separate render-pipeline variant for
short-lived analytic burst effects. The renderer uploads each particle's
initial origin, birth time, velocity, lifetime, base size, and time scale into
stable batch slots. A small per-effect uniform carries current time, gravity,
and the size/color curves. The vertex shader evaluates position, size, and
color from age, so live burst particles no longer require full per-frame
position/color/size buffer uploads.

This is a generalized particle renderer fast path, not a Racing smoke special
case. It is selected by particle/emitter eligibility and keeps the old
compute/update particle path available for effects that need per-frame
simulation state. New burst slot writes are coalesced by byte range; unchanged
live bursts reuse their existing slots.

The previous Racing drive probe dropped the previous
`Particle/BurstBatch/...smoke...` full-state upload from about
`15.0 KB/frame` to initial slot writes at about `0.38 KB/frame` plus burst
parameter writes at about `0.20 KB/frame`. Total drive upload pressure fell
from `21.2 KB/frame` after the shadow slice to `7.2 KB/frame`.

### 28. Shared Queued Built-In Frame Resources And Matrix-Slot Dirty Ranges

Queued built-in frame preparation now prepares one shared view-uniform resource
and one shared world-transform resource for the frame, then passes those
prepared resources into compatible unlit, matcap, standard, and debug-normal
material routes. Material-family caches skip their duplicate view/world writes
when they receive the shared resources, and cache hits require the cached
resources to match the shared resources.

This is a renderer-level resource lifetime fix, not a Racing shortcut. The bug
shape is general: multiple built-in material families can consume the same
view/world data in one frame, so preparing duplicate buffers wastes upload work
and risks bind-group cache aliasing when resource keys are identical but backing
buffers differ.

Transform dirty uploads now also treat one 4x4 matrix as the dirty unit for
matrix buffers. The uploader groups contiguous changed matrix slots and writes
those matrix-aligned ranges. It still falls back to a full write when both the
changed fraction and dirty span are near-whole, or when the range count exceeds
the bounded cap.

This is general to every transform-buffer consumer. It deliberately avoids
Racing-specific entity ids or asset names, and it preserves the existing
versioned-buffer semantics. The latest Racing write probe shows the result:
idle upload pressure remains near `0.15 KB/frame`, and drive remains near
`2.09 KB/frame`. Compact `WorldTransforms/storage` sits at about
`0.37 KB/frame` during drive, and it disappeared from the idle hot list.

### 29. Camera-Frustum-Independent Extraction Cache Reuse

Mesh and shadow-caster extraction caches no longer treat the full camera
frustum signature as structural packet identity. A changing camera frustum
still runs the current per-entity visibility test, and main-pass cached draws
still refresh `sortKey.viewId` and `sortKey.depth` from the active view before
being appended. Shadow-caster draws keep their stable shadow sort metadata and
do not inherit primary-camera frustum state.

This is a generalized render-extraction dependency fix. Static draw templates
depend on entity render state, material/mesh compatibility, transform-derived
bounds, layers, and side-buffer eligibility; they do not depend on the exact
primary camera frustum planes. Racing exposes the issue because the camera moves
continuously through a mostly static scene, but any moving-camera scene with
static visible meshes or off-camera shadow casters benefits.

The fix is intentionally not a render-bundle or change-set hack. It preserves
fresh culling and sort depth, and it does not special-case Racing decoration or
tree ids. The new regression coverage checks both sides: a camera move no
longer invalidates unchanged shadow casters, and a cached main mesh packet keeps
the same cache entry while matching a cold extraction's updated sort depth.

The follow-up opaque identity split below closes the broad main-mesh
change-set case that remained after this extraction-cache fix.

### 30. Opaque Identity, Post-Graph Bundle Prefixes, And Deferred Buffer Retirement

Opaque and alpha-test mesh draw change detection now treats depth-only sort-key
movement as ordering metadata, not structural resource identity. Transparent
draw depth changes still invalidate, because those draws are explicitly
order-sensitive.

This is a generalized render-phase correctness fix, not a Racing benchmark
shortcut. Any moving-camera scene with stable opaque geometry can benefit, while
transparent sorting keeps the stricter old behavior.

The latest drive distribution after this change reported broad main-mesh
changes in only `5 / 219` samples, down from `98 / 222` before the slice. The
final three trial frames reported `0 / 42`, `0 / 42`, and `8 / 42` changed mesh
draws.

The post-processing scene node can now execute a stable render-pass command
prefix through a cached render bundle while dynamic tail commands, such as
frame-local particle bind groups, execute directly in the same pass. That keeps
the base-scene bundle useful in bloom/tonemap routes without pretending the
dynamic particle tail is stable. Stable sampled frames now show post-graph
scene bundle reuse with `encodedCommands: 0`, while render-target draw-call
reports still include the direct tail.

Render-bundle keys also include captured bind-group object identity, so a
semantic resource key cannot replay a bundle against a replaced bind group.
Resized/replaced view, world-transform, and draw-order buffers are now retired
after `queue.onSubmittedWorkDone()` instead of being destroyed synchronously.
The accepted final audit recorded `0` destroyed-buffer validation warnings; the
earlier pre-retirement run exposed the warning and is kept only as evidence for
the fix.

### 31. Status-Only Retained Resource Compaction

`webGpuAppRenderReportToJsonValue(report)` still returns the full detailed
retained resource summaries by default, preserving tool/test access to
per-entry mesh/material cache data. The browser status path now calls the same
serializer with `detail: "status"`, which keeps totals, cache counters, and
material family counts but drops per-entry retained mesh/material resource
details from `diagnostics.lastFrame.resourceReuse`.

This is a generalized diagnostics-payload fix. It is not keyed to Racing asset
names and does not affect rendering, picking, or explicit full report
serialization. In the live rebuilt Racing app, `lastFrame.resourceReuse`
shrunk from about `15.9 KB` to `1.8 KB`; the compact status still reported
`preparedMeshCache.totalEntries: 32`, `preparedMeshFacade.totalEntries: 14`,
and `preparedMaterialFacade.totalEntries: 8`.

### 32. Browser Performance Status Cadence

Generated browser runtime status still records every worker performance timing
sample, but it no longer republishes the expensive sorted rolling performance
summary on every worker snapshot. The app-facing `status.performance` object is
published on a telemetry cadence, while the underlying sample retention remains
intact.

This is a generalized generated-app runtime fix. Any worker-driven Aperture app
can publish snapshots faster than humans or tools need full rolling timing
JSON. Racing exposed the overhead because it was already running near
high-refresh cadence.

### 33. Status Render-Change-Set Key Compaction

Full render-change-set keys are still serialized by default for explicit report
consumers. The browser status path now asks for `detail: "status"`, which keeps
exact changed/unchanged/removed counts and replaces long key arrays with
`count`, `sample`, and `omitted` objects. A non-enumerable
`__apertureRenderDiagnostics` accessor on generated browser status returns the
full diagnostics for CLI/devtool consumers.

This is not a Racing-only deletion of useful data. It separates the compact
app-facing status copy from the full tooling report. In the latest live Racing
probe, status `renderChangeSet` shrank to `2.1 KB`, while the hidden full
accessor still exposed a `16.4 KB` exact render-change-set and was confirmed
non-enumerable.

### 34. Generated Worker Tick-Rate Pacing

The generated simulation worker now uses an explicit tick scheduler with a
default `240 Hz` cap and a configurable `workerTickRateHz` start option. The
old worker loop reposted immediately through the event/message queue and could
publish snapshots far faster than the browser could present or the WebGPU app
could render.

This is a production runtime policy, not a benchmark shortcut. Unbounded worker
publication wastes main-thread message handling, replaces stale pending
snapshots, and makes frame pacing depend on event-loop speed. The live Racing
probe before this slice saw about `590 Hz` idle and `444-450 Hz` drive snapshot
publication with thousands of pending replacements. After pacing, idle snapshot,
presentation, render-start, and render-complete cadence measured around
`240 Hz` with low replacement counts. Drive still falls behind when particles
are active, which means the cap fixed one general scheduler bug but did not
hide the remaining render/simulation work.

### 35. Time-Based Full Worker Summary Cadence

Generated worker summaries always include cheap live fields such as signals,
input, command diagnostics, particle queue counters, and previous publish
timing. The expensive full fields (`resources`, `startOptions`, `assets`,
`physics`, and entity-tool summaries) are now published by elapsed time instead
of `frame % 30`.

This is a generalized high-refresh runtime fix. The old `frame % 30` policy was
approximately `500 ms` only when workers published at `60 Hz`; after the worker
tick cap moved generated apps to `240 Hz`, the same frame interval became
roughly `125 ms`. The new default is explicitly `500 ms`, with frame `0` still
publishing a full summary for startup/tooling compatibility.

In the latest live Racing probe, the visible generated app status stayed around
`36.2-36.3 KB`, `lastWorkerSummary` stayed around `2.1-2.2 KB`, and
`summaryCadence.full` was `false` on the sampled steady frames with
`fullSummaryIntervalMilliseconds: 500`. The paired audit after this change
reduced average measured heap from the previous worker-paced run
(`54.28 MB` idle / `97.87 MB` drive) to `43.50 MB` idle / `67.05 MB` drive.

## Remaining Aperture Findings

### 1. Frame Pacing Is Still The Most Important Follow-Up

The latest isolated SAB benchmark puts Aperture idle close to three.js, but it
is still not a clean win. Aperture idle p95/p99 were `4.75 ms` / `5.05 ms`
versus three.js `4.64 ms` / `5.07 ms`. Aperture drive averaged `4.17 ms`
versus three.js `4.17 ms`, but the larger gap is tail latency and render
cadence: Aperture p95/p99 were `4.84 ms` / `6.20 ms` with max `8.53 ms`, while
three.js reported p95/p99 `4.64 ms` / `5.10 ms` with max `5.21 ms`.

Wrapped RAF callback durations are small and the Long Task observer reported
zero long tasks, so the remaining issue is worker/snapshot/render cadence and
drive-frame work, not only draw count.

The generated worker no longer publishes unbounded snapshots; the latest live
idle probe measured snapshot cadence around `239 Hz` and render-complete
cadence around `223 Hz`. Drive still measured snapshot cadence around `240 Hz`
but render-complete cadence around `214 Hz` with `201` pending replacements.
High-refresh apps still need explicit
simulation/render cadence contracts, lower render CPU prepare cost,
interpolation, or a better render-on-display policy rather than relying on
snapshot availability to define presentation.

### 2. Frame Cadence And Change Churn Are Now The Main Follow-Ups

Compact mesh-world transform packing, fixed-capacity ribbon ranges, and
shader-side shadow caster world transforms moved the drive write profile away
from trail and baked shadow matrix buffers. Analytic burst particle rendering
then removed the previous full live-particle burst upload from the hot list.
Shared queued built-in frame resources and matrix-slot transform dirty ranges
then removed the idle world-transform hot spot and keep drive write pressure
near `2 KB/frame`. The latest drive probe is now led by several small labels,
not one dominant byte source:

- analytic burst initial slot writes: about `0.44 KB/frame`;
- compact `WorldTransforms/storage`: about `0.37 KB/frame`;
- `ShadowCasterWorldTransforms/storage`: about `0.24 KB/frame`;
- light floats: about `0.21 KB/frame`;
- burst particle parameter uniforms: about `0.19 KB/frame`.

The shadow issue that was visible in an earlier probe is fixed by the new
pass-matrix plus world-transform path. The duplicate built-in view/world buffer
issue is also fixed for the queued material-family path. Keep both monitored
with upload diagnostics, but neither is a top drive write-pressure target now.

The full particle burst batch upload issue is fixed for eligible analytic burst
effects. The remaining particle-side cleanup is lower priority: slot
fragmentation and tiny initial-slot write count can still be improved, but
those writes are no longer byte-dominant. The larger next renderer target is
why some drive frames still carry narrow mesh/shadow resource changes and why
submit cadence remains below display cadence even after dynamic upload bytes are
small.

### 3. Memory Pressure Remains High

The latest isolated run did expose `jsHeapUsedSize`, and Aperture still retained
far more JS heap than three.js:

- Aperture idle average: `43.50 MB`
- Aperture drive average: `67.05 MB`
- three.js idle average: `18.05 MB`
- three.js drive average: `18.97 MB`

That is still enough evidence for a direct heap audit. Likely contributors
include ECS/extraction packet volume, retained diagnostics/status data,
benchmark status retention, renderer resource metadata, and per-frame typed
array/scratch lifetimes that have not yet been pooled.

### 4. High-DPR Sizing Is Still Broken

At `1280x720` CSS with DPR `2`, the previous quick check reported:

- three.js canvas backing store: `2560x1440`
- Aperture canvas backing store: `1280x720`
- Aperture status:
  - `displayWidth: 640`
  - `displayHeight: 360`
  - `pixelRatio: 2`
  - `measurementSource: "device-pixel-content-box"`

High-DPR visual quality and performance comparisons remain invalid until the
`device-pixel-content-box` sizing path is fixed.

### 5. Active Bounds Churn Remains Broad

Idle mesh/shadow packet churn is fixed. The latest active drive samples are
much narrower than the previous extraction-cache-only run: the latest aggregate
final drive frame reported `6 / 42` changed mesh draws and `6 / 364` changed
shadow caster draws. The earlier 7 second live drive distribution saw broad
main-mesh change sets in only `5 / 219` samples, down from `98 / 222`; broad
shadow-caster churn was `21 / 219` samples. A later bounds-key fix removed a
false duplicate-key churn path: the newest quick drive probe reported
`300 changed` and `414 unchanged` bounds instead of the earlier all-changed
`709 / 0` pattern.

Remaining target: stable static scenery should stay unchanged under active
vehicle motion unless shadow/light state genuinely invalidates it, and bounds
updates should narrow to the entities whose transforms or geometry actually
changed.

### 6. Bounds Churn Remains Visible

Idle now reports only a small number of changed bounds in the latest quick
probe (`2 changed / 402 unchanged`), but active-drive bounds churn remains
large enough to keep as a follow-up. It is no longer the dominant frame-time
issue, but static scenery should not need repeated bounds changes.

### 7. Shared Snapshot Transport Needs A Local/Dev Header Story

The engine can now encode the Racing idle and drive packet families through the
SAB path, but normal local serving still needs an ergonomic COOP/COEP story.
The latest benchmark used a temporary isolated static server; the existing
plain Python server and default generated dev route do not make isolation
automatic.

Follow-up: the generated dev/static serving path should make COOP/COEP support
easy to enable for local perf work, with clear diagnostics when SAB is
unavailable.

### 8. Diagnostics/Status Should Stay Rate-Limited

The current entity-summary throttling, diagnostics JSON cache, status-only
retained-resource report, performance telemetry cadence, and status-only
render-change-set key compaction are the right direction. The app-facing shadow
report has been compacted from a full caster draw array to counts plus a sample,
long render-bundle keys are summarized by hash/length, worker entity snapshots
are on-demand, transient full worker summary fields are dropped from steady
browser status, and the browser status render-change-set copy now keeps counts
plus samples. A live rebuild check measured `diagnostics.lastFrame` at about
`24.0 KB`, with `renderChangeSet` down to `2.1 KB`; the full `16.4 KB`
change-set remains available through the non-enumerable tooling accessor.

## Historical First-Audit Findings

The first audit measured the older pre-batching path:

| Scenario       | Avg frame |     p95 |     p99 | Notes                            |
| -------------- | --------: | ------: | ------: | -------------------------------- |
| Aperture idle  |   4.17 ms | 4.30 ms | 4.60 ms | Held 240 Hz in that run          |
| three.js idle  |   4.17 ms | 4.47 ms | 4.70 ms | Held 240 Hz                      |
| Aperture drive |   4.62 ms | 8.30 ms | 8.43 ms | Intermittently dropped to 120 Hz |
| three.js drive |   4.17 ms | 4.30 ms | 4.53 ms | Still held 240 Hz                |

It also found:

- idle draw calls around `50`;
- drive draw calls around `351-358`;
- all idle mesh and shadow packets marked changed every frame;
- high-DPR backing-store mismatch;
- much higher Aperture heap/task pressure;
- Racing smoke represented as many Aperture emitters while three.js used one
  pooled `THREE.Points`.

Updated status:

- Rigid mesh batching: fixed.
- Shadow batching: fixed.
- Idle mesh/shadow packet churn: fixed.
- Particle draw explosion: fixed at the renderer/resource level; emitter count
  remains high.
- GPU timing readback overhead: fixed by making timings opt-in.
- Render CPU key/signature hot paths: fixed.
- Full entity summary every snapshot: fixed for steady status; entity summaries
  are now on-demand through devtool/runtime commands.
- MSAA post-processing fallback: fixed for the Racing bloom/tonemap route.
- Repeated diagnostics JSON conversion: fixed.
- Fog blocking shared snapshot transport: fixed in the codec/worker guard.
- Generated worker `setTimeout(0)` normal-path scheduling: fixed with a
  `MessageChannel` scheduler and timeout fallback.
- Static spatial index rebuild pressure: mitigated with mesh/entity caches.
- Stable bloom bind-group/command churn: mitigated with resource-keyed command
  cache slots.
- Automatic shadow standalone submit: fixed by graph-folding shadow caster work
  into the post FrameGraph when available.
- Particle blocking shared snapshot transport: fixed in the codec/worker guard.
- Audio forcing full transferable render snapshots: fixed with compact audio
  placeholder sideband snapshots.
- SAB stale-message/newer-buffer registry mismatch: fixed by requiring shared
  frame/message frame equality before decode.
- Shadow caster extraction rebuild pressure: fixed for unchanged eligible
  casters with a dedicated shadow-cache bucket.
- Snapshot-driven missed-presentation scheduling: partially fixed with a
  catch-up path after in-flight renders; broader rendered cadence remains open.
- Particle view-uniform buffer churn: fixed by reusing a cache-owned buffer and
  resizing only when the view-uniform payload grows.
- Baked shadow caster matrix scratch/allocation churn: fixed; identical baked
  matrix bytes skip the GPU write.
- Duplicate Standard view/world frame-resource writes: mitigated with shared
  app-cache-owned Standard resources.
- Sparse transform dirty upload envelopes: mitigated with bounded dirty-range
  lists and WebGPU multi-range upload support.
- Draw-order transform buffer rewrites: fixed for byte-identical sorted
  matrices; idle stable draw-order uploads now skip after initial upload.
- Extraction-order mesh world-transform storage uploads: mitigated with compact
  mesh-world transform packing; no longer the top drive write-pressure target.
- Dynamic drift ribbon uploads: fixed for the ground-ribbon helper with
  fixed-capacity buffers and per-segment update ranges.
- Directional shadow baked caster matrix uploads: fixed by binding pass
  light matrices plus a draw-list world-transform buffer and using normal
  instanced `firstInstance` indexing.
- Particle burst batch full live-state uploads: fixed for eligible analytic
  burst effects with stable burst slots and shader-side age/motion/size/color
  evaluation.
- Duplicate queued built-in view/world uploads across material families: fixed
  by preparing shared frame resources once and threading them through unlit,
  matcap, standard, and debug-normal routes.
- Sparse matrix transform dirty uploads inflating into large float-envelope
  writes: fixed for matrix buffers with matrix-slot range grouping and a
  near-whole-span fallback.
- Bounded late-latch scheduler experiment: tested and reverted after the Racing
  benchmark worsened.
- App-facing retained resource report bloat: fixed for browser status with
  status-only resource detail compaction; full report serialization remains
  detailed by default.
- Per-snapshot browser performance status recomputation: fixed by publishing
  the rolling browser performance summary on a telemetry cadence while retaining
  every timing sample internally.
- App-facing render-change-set key bloat: fixed for browser status with
  count/sample/omitted summaries; full exact keys remain available through a
  non-enumerable tooling accessor.
- Generated worker unbounded snapshot publication: fixed with a configurable
  tick-rate scheduler, defaulting to `240 Hz`.
- Frame-count-based heavy worker summaries: fixed with elapsed-time cadence,
  defaulting to `500 ms`.
- Bounds change-set duplicate-key churn: fixed by including `boundsId` in bounds
  change-set keys; latest quick drive probe reports `300 / 414` changed versus
  unchanged bounds instead of `709 / 0`.
- Particle burst bind-group cache experiment: tested and backed out after the
  paired audit worsened drive p99/max.
- High-DPR backing-store mismatch: still open.
- Memory pressure: still open; latest isolated run shows Aperture at
  `43.50-67.05 MB` used heap versus three.js at `18.05-18.97 MB`.
- Frame pacing/render cadence: still open. Snapshot publication is capped, but
  drive render-complete cadence still falls below display cadence.
- Particle burst write count/slot fragmentation: still open, but no longer the
  top byte-pressure target.
- Active-drive main-mesh/change-set broadness: still open but much narrower.
  The latest aggregate final drive frame was `6 / 42` changed mesh draws; after
  the bounds-key fix, the latest quick drive probe still shows `300` changed
  bounds.
- Physics/writeback broadness from the first audit was not directly remeasured
  in the latest pass; do not treat the old `88` writes count as current without
  a fresh worker-side measurement.

## Recommended Fix Order

1. Check in the browser benchmark runner. The latest ad hoc runner now separates
   display RAF intervals, WebGPU submit intervals, worker publish timings,
   cadence diagnostics, counts, particles, and compact phase timings, but it is
   still not versioned.
2. Diagnose drive-frame render cadence and particle-heavy work together. The
   worker is no longer flooding snapshots, so remaining drive loss should be
   attributed to actual render/simulation pressure, scheduler policy, or heap
   churn.
3. Audit heap retention directly. The latest drive run retained `67.05 MB`,
   far above the three.js reference and high enough to explain tail spikes or
   GC-sensitive variance.
4. Expose dynamic-buffer upload diagnostics in frame reports so future probes
   show full writes, range writes, skipped writes, and fallback reasons.
5. Reduce broader render `prepare`/resource planning cost. Submit cadence
   remains below display cadence even after the write-byte reductions.
6. Define the high-refresh simulation/render policy: fixed-step interpolation,
   render-on-display using latest snapshots, or a documented lower render
   cadence. Then benchmark against three.js using the same concept of "frame."
7. Add a local/dev COOP/COEP serving path so SAB transport can be enabled
   without a one-off static server.
8. Fix DPR/backing-store sizing for `device-pixel-content-box` and DPR `2`.
9. Reduce remaining bounds/change-set churn, especially active-drive bounds
   churn.
10. Reduce particle burst slot fragmentation/tiny initial-slot write count if
    it shows up in count-dominant probes after the larger cadence and transform
    work.
11. Keep render batching counters as regression gates: main resolved draws
    should remain around `14-20`, shadow `364` caster records should remain
    grouped to about `30` shadow draws, and drive draw calls should stay near the
    current `32` rather than regressing to the old `300+` range.

## Follow-Up Links

- `docs/RACING_RENDER_BATCHING_PLAN.md` documents the rigid mesh/shadow batching
  design and correctness constraints.
- `docs/research/PARTICLE_SYSTEM_AUDIT.md` has broader particle-system context.
- `docs/FPS_STARTER_AUDIT_FIX_PLAN.md` tracks related FPS starter-kit audit
  work and should stay aligned where the fixes are shared engine issues.
