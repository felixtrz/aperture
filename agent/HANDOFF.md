# Handoff - Racing Performance Checkpoint Commit

**Updated:** 2026-06-18 18:22 PDT

Active user goal remains open. The broad Racing performance worktree has been
validated and checkpointed on branch `racing-perf-autoshadow-reorient`.

## Final Checkpoint

- Commit created: `9bc9e344 Checkpoint racing render pacing improvements`.
- Staged and committed all meaningful source, test, docs, lockfile, and agent
  bookkeeping changes that were part of the Racing render-pacing work.
- Left only local artifacts untracked: screenshots, parity captures,
  `_euler-verify.mjs`, and `tmp/` trace/profile output.
- Added `Starter-Kit-FPS` and `Starter-Kit-Racing` to
  `scripts/setup-references.sh` so docs that cite those local references remain
  restorable by `pnpm run setup:references`.

## Validation At Checkpoint

- `git diff --check`
- `pnpm exec tsc -b packages/render packages/runtime packages/app packages/webgpu --pretty false`
- `pnpm run typecheck:test`
- `pnpm run check:progress`
- `pnpm --dir racing run build`
- `pnpm test` (`555` files / `3475` tests passed)

## Next Recommended Work

Rerun the paired idle+drive Racing benchmark after the checkpoint commit, then
target the remaining callback-p95 gap. The most likely next areas remain
drive-frame shadow caster work, particle burst CPU prep, and the pollable /
coalesced dynamic source-asset path.

---

# Handoff - Racing Auto-Shadow Cache And Mapped Profile Reorientation

**Updated:** 2026-06-18 15:21 PDT

Active user goal remains open. Work has moved from `main` to branch
`racing-perf-autoshadow-reorient` to preserve the broad shared dirty worktree.
Another agent had been making large uncommitted render/shadow/pacing changes;
that agent is now stopped. I preserved that work, fixed a syntax error in its
`render-shadow-frame.ts` object spreads, and continued from the measured Racing
perf goal.

## Completed In This Slice

- Fixed same-snapshot auto-shadow cache reuse so cached frames advance to the
  current render frame. This lets stable frames hit via the change set instead
  of rebuilding or hashing the large auto-shadow input key every RAF.
- Stored nullable auto-shadow input keys for short-circuited dirty misses and
  reported null hashes when no key was built. This avoids diagnostics causing
  the same hot work they are meant to explain.
- Added a regression assertion that a second stable auto-shadow render reuses
  from `reuseSource: "change-set"` with null current/cached key hashes.
- Added an ordered unique-key fast path to render snapshot packet-family
  comparison. Stable, same-order packet families avoid the Map/bucket fallback;
  duplicate/reordered families still use the old path.
- Added source-map-aware CPU profile summaries to
  `scripts/racing-render-loop-trace.mjs`. When the served build has `.map`
  files, summaries now include `topMappedAppSelfTime` grouped by original source
  location. Added explicit dev dependency `@jridgewell/sourcemap-codec`.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` with the current traces,
  fixed/open status, and next recommended targets.

## Current Measurements

- Fair paired trace after fixes:
  `/tmp/racing-current-after-cache-and-changeset-idle-drive-repeat3/summary.json`
  (normal non-sourcemap build, 3 paired idle+drive trials, 3 second samples).
- Aperture now wins most frame-pacing aggregates in both idle and drive.
  Idle aggregate pacing score: `d50 -0.27 ms`; drive aggregate pacing score:
  `d50 -0.12 ms`.
- Callback p95 remains open. Idle callback p95 loses by median `+0.48 ms`
  because of one tail trial. Drive callback p95 loses in all trials by median
  `+1.65 ms`.
- Internal diagnostics confirm the auto-shadow stable-frame fix:
  idle `prepareMainAutoShadow` dropped from roughly `0.63 ms` average before
  the cache-frame advance to roughly `0.02 ms` average after.
- Latest mapped profile:
  `/tmp/racing-change-set-fastpath-mapped-profile-drive-3p5s/summary.json`.
  Top mapped areas are now spread across shadow caster draw-list/readiness,
  burst particle prep, snapshot change-set/packet extraction, queued/standard
  frame resources, render-pass draw-list/batching, and shadow-frame setup.

## Validation Run

- `pnpm exec prettier --write packages/webgpu/src/app/queued-built-in-frame.ts`
- `pnpm exec prettier --write packages/webgpu/src/app/auto-shadow-frame.ts packages/webgpu/src/app/resource-cache.ts packages/webgpu/src/shadows/render-shadow-frame.ts`
- `pnpm exec prettier --write test/webgpu/webgpu-app.test.ts`
- `pnpm exec prettier --write packages/render/src/rendering/snapshot-change-set-compare.ts`
- `pnpm exec prettier --write scripts/racing-render-loop-trace.mjs package.json pnpm-lock.yaml`
- `node --check scripts/racing-render-loop-trace.mjs`
- `pnpm exec tsc -b packages/webgpu --pretty false`
- `pnpm exec tsc -b packages/render packages/webgpu --pretty false`
- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/webgpu-app.test.ts -t "auto-shadow|auto shadow|auto-renders directional shadow resources"`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "auto-renders directional shadow resources"`
- `pnpm exec vitest run test/rendering/snapshot-change-set.test.ts test/rendering/render-world-change-set-ids.test.ts test/webgpu/app-snapshot-update-metadata.test.ts`
- `pnpm --dir racing exec vite build`
- Trace runs listed above.
- `git diff --check` passed after the auto-shadow cache-frame fix; rerun before
  committing final docs because docs/package-lock changed afterward.

## Known Issues / Next Targets

- The goal is not complete: Aperture does not consistently beat three.js on
  callback p95, especially while driving.
- Next general engine target: reduce drive-frame auto-shadow dirty work. The key
  path is fixed; moving caster transforms still dirty the shadow frame and cause
  walks over all shadow caster records.
- Second target: reduce burst particle CPU prep. Racing reaches about `306`
  active burst emitters / `912` live particles while driving, causing hundreds
  of tiny per-emitter CPU updates. Prefer a general burst coalescing or
  multi-burst batch representation before changing Racing's visual authoring.
- The worktree remains very dirty from multiple prior slices and the stopped
  other agent. Do not revert unrelated files. Commit only coherent validated
  subsets.

---

# Handoff - Racing Message Pacing Sweep And Current Default Trace

**Updated:** 2026-06-18 15:25 PDT

Active user goal remains open. The latest rebuilt paired default drive trace
shows Aperture winning frame-pacing shape against the three.js Racing reference,
while still losing callback p95. Keep challenging worker-message exchanges, but
do not assume message count alone explains the remaining gap.

## Latest Completed Slice

- Added clearer trace CLI aliases for message-rate experiments, including
  `--source-assets-message-rate-hz=0|60`.
- Added delivered-message frame-pacing impact metrics to
  `scripts/racing-render-loop-trace.mjs`: the trace now reports `msgImpact`
  deltas comparing RAF windows with worker messages against RAF windows without
  worker messages.
- Backed out the unproven auto-shadow change-set fast path from this worktree.
  The repeated traces did not show a reliable drive improvement, so do not treat
  that experiment as retained progress.
- Updated `docs/SAB_RENDER_PACING_PLAN.md` with the rebuilt source-assets rate
  sweep and paired default drive result. That doc is still dirty because it
  also contains broader uncommitted audit notes.

## Latest Findings

- Follow-up message-impact traces:
  `/tmp/racing-pacing-msg-impact-default-idle-repeat3/summary.json`,
  `/tmp/racing-pacing-msg-impact-default-drive-repeat3/summary.json`, and
  `/tmp/racing-pacing-msg-impact-sourceassets-off-drive-repeat3/summary.json`
  (3 paired trials, 3 second samples, no trace/profile).
- Default idle won the aggregate frame-pacing shape against three.js:
  interval p95 `d50 -0.34 ms`, deviation p95 `d50 -0.14 ms`,
  adjacent-jitter p95 `d50 -0.38 ms`, RMS `d50 -0.20 ms`,
  `pacingInstabilityScoreMs d50 -0.43 ms`, within-1ms `d50 +7.8 pp`, and
  jitter-over-2ms `d50 -7.3 pp`. Callback p95 still lost (`d50 +0.74 ms`).
- Default drive also won the aggregate frame-pacing shape: interval p95
  `d50 -0.37 ms`, deviation p95 `d50 -0.28 ms`, adjacent-jitter p95
  `d50 -0.89 ms`, RMS `d50 -0.30 ms`, `pacingInstabilityScoreMs d50 -0.75 ms`,
  within-1ms `d50 +15.7 pp`, and jitter-over-2ms `d50 -13.4 pp`. Callback p95
  still lost (`d50 +1.42 ms`).
- Default drive delivered about `16 Hz` of worker messages, mostly
  `aperture.simulation.sourceAssets`, touching about `26%` of RAF windows.
  The new `msgImpact` split did not show those message windows as consistently
  worse: interval-p95 deltas for message windows versus no-message windows were
  `-0.64 ms`, `-1.22 ms`, and `+0.09 ms` across the three default drive trials.
- Disabling dedicated source-asset messages dropped worker delivery to about
  `2 Hz` / `3.3%` of RAF windows, but did not beat current default in this
  rebuilt comparison. Direct default-minus-off medians were interval p95
  `-0.14 ms`, adjacent-jitter p95 `-0.14 ms`, RMS `-0.04 ms`, score
  `-0.12 ms`, within-1ms `+2.2 pp`, and callback p95 effectively tied
  (`+0.01 ms`).
- Updated conclusion: keep render heartbeat poll-only and keep challenging
  thread messages with measured experiments. Raw message count is not the whole
  cause of the remaining smoothness/callback gap; the source-asset stream still
  deserves a pollable/coalesced dynamic-asset data plane because freshness
  should not require irregular `postMessage` wakeups.
- Rebuilt paired default drive trace:
  `/tmp/racing-rebuilt-default-paired-drive-repeat3/summary.json`
  (3 paired drive trials, 4 second samples, no trace/profile).
- Aperture won drive aggregate interval p95 (`d50 -0.41 ms`), interval p99
  (`d50 -0.15 ms`), max interval (`d50 -0.06 ms`), deviation p95
  (`d50 -0.20 ms`), adjacent-jitter p95 (`d50 -0.75 ms`), RMS
  (`d50 -0.20 ms`), `pacingInstabilityScoreMs` (`d50 -0.58 ms`),
  within-1ms ratio (`d50 +8.7 pp`), and jitter-over-2ms ratio
  (`d50 -9.2 pp`).
- Aperture still lost callback p95 in every paired trial (`d50 +1.30 ms`).
  Treat callback p95 as the current render-work target.
- Rebuilt Aperture-only source-asset sweep:
  `/tmp/racing-source-rate-rebuilt-default/summary.json`,
  `/tmp/racing-source-rate-rebuilt-off/summary.json`, and
  `/tmp/racing-source-rate-rebuilt-60/summary.json`.
  Default delivered about `15.7 Hz` of worker messages and touched about `26%`
  of RAF windows. Source-assets off dropped to about `2 Hz` / `3.3%` and
  improved median pacing score (`2.59 ms` -> `2.14 ms`) but barely moved
  callback p95 (`3.95 ms` -> `3.82 ms`). Source-assets at `60 Hz` touched about
  `88%` of RAF windows, improved within-1ms/jitter2, but did not solve callback
  p95.
- Conclusion: keep render heartbeat poll-only. The source-asset stream should
  become pollable/coalesced because dynamic drift-mark mesh updates should stay
  fresh without irregular `postMessage` wakeups. But the callback tail is mostly
  render work, so the next runtime fix should also pressure auto-shadow,
  particles, and resource preparation.

## Latest Validation

- `node --check scripts/racing-render-loop-trace.mjs`
- `node scripts/racing-render-loop-trace.mjs --scenario=idle --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --out=/tmp/racing-pacing-msg-impact-default-idle-repeat3`
- `node scripts/racing-render-loop-trace.mjs --scenario=drive --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --out=/tmp/racing-pacing-msg-impact-default-drive-repeat3`
- `node scripts/racing-render-loop-trace.mjs --scenario=drive --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --aperture-source-assets-rate=0 --out=/tmp/racing-pacing-msg-impact-sourceassets-off-drive-repeat3`
- `pnpm exec prettier --check docs/SAB_RENDER_PACING_PLAN.md scripts/racing-render-loop-trace.mjs`
- `pnpm --dir racing run build -- --force`
- `node scripts/racing-render-loop-trace.mjs --target=aperture --scenario=drive --repeat=1 --duration=1500 --warmup=500 --drive-settle=250 --no-trace --no-cpu-profile --out=/tmp/racing-message-impact-smoke`
- `node scripts/racing-render-loop-trace.mjs --target=aperture,three --scenario=drive --repeat=3 --duration=4000 --warmup=1000 --drive-settle=500 --no-trace --no-cpu-profile --out=/tmp/racing-rebuilt-default-paired-drive-repeat3`

## Commits Made

- `3b579936 Add racing trace message rate aliases`
- `51974790 Track racing message frame pacing impact`

## Recommended Next Task

Use a full-detail trace/profile to separate callback p95 into auto-shadow,
particles, dynamic mesh/resource prep, and source-asset handling. The next
general transport slice should be a pollable/coalesced dynamic mesh update data
plane, but do not spend it only suppressing messages: source-assets-off proves
pacing sensitivity, not a complete freshness-preserving fix.

---

# Handoff - Dynamic Mesh Alias Pruning And Idle/Drive Trace

**Updated:** 2026-06-18 14:55 PDT

Active user goal remains open: Aperture is now winning the aggregate
frame-pacing-shape metrics in the latest paired idle and drive trace, but it
still loses callback p95, especially while driving. This slice fixed a
renderer-side dynamic mesh cache issue exposed by the drift-mark source-asset
path: same-layout mesh version bumps were aliasing the same GPU buffers but
leaving stale prepared mesh cache entries behind.

## Latest Completed Slice

- `prepareMeshGpuResource()` now prunes superseded same-layout prepared mesh
  aliases for a source mesh after a cache hit, same-layout update, or new
  resource creation. The GPU buffers remain owned by the current resource; old
  version aliases no longer accumulate in the backend cache.
- Updated `test/webgpu/prepared-mesh-cache.test.ts` so same-layout source
  version bumps are expected to update in place and leave only the latest alias.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` and
  `docs/SAB_RENDER_PACING_PLAN.md` with the new idle+drive trace.

## Latest Findings

- Latest trace:
  `/tmp/racing-pacing-mesh-alias-prune-idle-drive-repeat3/summary.json`
  (3 paired idle+drive trials, 3 second samples, no trace/profile).
- Aperture won the idle aggregate on interval p95 (`d50 -0.30 ms`),
  deviation p95 (`d50 -0.14 ms`), adjacent-jitter p95 (`d50 -0.26 ms`), RMS
  (`d50 -0.22 ms`), `pacingInstabilityScoreMs` (`d50 -0.45 ms`), within-1ms
  (`d50 +8.8 pp`), and jitter-over-2ms (`d50 -7.2 pp`). Idle callback p95
  still lost overall (`d50 +0.84 ms`, `1/3` Aperture wins).
- Aperture won the drive aggregate on interval p95 (`d50 -0.24 ms`),
  deviation p95 (`d50 -0.19 ms`), adjacent-jitter p95 (`d50 -0.18 ms`), RMS
  (`d50 -0.14 ms`), `pacingInstabilityScoreMs` (`d50 -0.23 ms`), within-1ms
  (`d50 +6.8 pp`), and jitter-over-2ms (`d50 -8.3 pp`). Drive callback p95
  still lost in all three trials (`d50 +1.48 ms`).
- Resource effect is clean: final sampled idle/drive frames reported
  `preparedMeshCache.totalEntries:2`, `meshBuffersCreated:0`, and
  `preparedMeshBuffersCreated:0`. Before this pruning, sampled drive frames
  could retain `32` prepared mesh entries and occasionally report large mesh /
  bind-group creation churn.
- The source-asset message stream is still present and unchanged: idle is about
  `2 Hz` summary/snapshot messages, while drive is about `16 Hz`, mostly
  `aperture.simulation.sourceAssets`. The next real transport fix remains a
  dynamic source-asset mailbox/shared data path, not further blind throttling.

## Latest Validation

- `pnpm exec vitest run test/webgpu/prepared-mesh-cache.test.ts`
- `pnpm exec tsc -b packages/webgpu --pretty false`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build -- --force`
- `node scripts/racing-render-loop-trace.mjs --scenario=idle,drive --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --out=/tmp/racing-pacing-mesh-alias-prune-idle-drive-repeat3`

## Recommended Next Task

Keep the next implementation focused on the measured callback p95 gap. The
highest-value transport work is still a dynamic mesh/source-asset mailbox that
keeps drift-mark updates fresh while decoupling payload availability from
irregular `postMessage` wakeups. In parallel, use phase details to keep pressure
on `prepareMainAutoShadow` p95 and `prepareMainResources` p95, because
auto-shadow refreshes and resource preparation still show tail spikes even when
their medians are low.

---

# Handoff - Auto-Shadow Cache Diagnostics And Poll Pacing Evidence

**Updated:** 2026-06-18 14:45 PDT

Active user goal remains open: continue implementing proper engine/app fixes
until Aperture consistently outperforms the three.js Racing reference in both
idle and drive. This slice added first-class auto-shadow cache hit/miss
diagnostics, verified them through the renderer facade, and used a fresh Racing
trace to separate shadow-cache behavior from the remaining source-asset message
stream.

## Latest Completed Slice

- Added `resourceReuse.autoShadowFrameCache` to app-facing render reports. It
  reports `status`, `reason`, `pipelineKind`, cached/previous frame ids,
  input-key hashes/lengths, `reuseSource`, and the first changed input section
  for input-key misses.
- Preserved the existing auto-shadow change-set fast path and now reports
  `reuseSource: "change-set"` when it proves the shadow inputs are stable
  without rebuilding the full key.
- Added renderer-facade assertions for no-previous-frame miss, cache hit, camera
  input-key miss, and explicit auto-shadow disable behavior.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` and
  `docs/SAB_RENDER_PACING_PLAN.md` with the new trace evidence.

## Latest Findings

- Latest trace:
  `/tmp/racing-pacing-autoshadow-miss-reasons-drive-repeat3/summary.json`
  (3 paired drive trials, 3 second samples, no trace/profile).
- Aperture won the drive aggregate on interval p95 (`d50 -0.44 ms`), interval
  p99 (`d50 -0.09 ms`), absolute-deviation p95 (`d50 -0.07 ms`),
  adjacent-jitter p95 (`d50 -0.41 ms`), RMS deviation (`d50 -0.22 ms`),
  `pacingInstabilityScoreMs` (`d50 -0.43 ms`), within-1ms ratio
  (`d50 +8.8 pp`), and jitter-over-2ms ratio (`d50 -9.4 pp`).
- Aperture still lost callback p95 in all three trials (`d50 +1.32 ms`).
- Final sampled frames showed two auto-shadow cache hits via
  `reuseSource: "change-set"` and one miss with
  `reason: "input-key-changed"` / `firstChangedInputSection: "camera"`.
  Hit samples reduced `prepareMainAutoShadow` p50 to about `0.16 ms`; the
  camera-miss sample was about `0.94 ms` p50.
- Worker-message delivery stayed about `15.6-16.3 Hz`, mostly
  `aperture.simulation.sourceAssets`, touching about `26%` of RAF windows. The
  worker source-asset serializer commits changed versions only after a message
  carries them, so `sourceAssetsMessageRateHz=0` is a freshness tradeoff until
  there is a real shared/mailbox dynamic-asset data path.

## Latest Validation

- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "auto-renders directional shadow resources"`
- `pnpm exec tsc -b packages/webgpu --pretty false`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build -- --force`
- `node scripts/racing-render-loop-trace.mjs --scenario=drive --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --out=/tmp/racing-pacing-autoshadow-miss-reasons-drive-repeat3`

## Recommended Next Task

Implement the dynamic source-asset mailbox/data-plane slice. The current
source-asset path is still the measured worker-message stream during Racing
drive, and suppressing it without a mailbox only delays drift-mark mesh
freshness. A correct slice should keep latest dynamic mesh updates fresh while
decoupling delivery from irregular main-thread `postMessage` wakeups.

---

# Handoff - Racing Poll Pacing And Auto-Shadow Input Key

**Updated:** 2026-06-18 14:35 PDT

Active user goal remains open: keep challenging worker-thread message exchanges
with experiments, prefer pollable data paths where they are proven, and track
frame pacing as a first-class benchmark metric. This slice kept the poll-first
render heartbeat default, added/used pacing-shape metrics in the trace harness,
and made the auto-shadow callback path depend on actual shadow inputs rather
than broad snapshot-family invalidation.

## Latest Completed Slice

- `scripts/racing-render-loop-trace.mjs` now reports frame-pacing metrics that
  are usable for poll-vs-message decisions: `pacingInstabilityScoreMs`,
  adjacent jitter ratios, missed-vsyncs/second, measured
  `MessageChannel.port1` delivery rate, worker-message interval stats, and
  messages-per-RAF-window.
- `createWebGpuAppAutoShadowFrame()` skips the no-camera fallback scene fit
  when a primary shadow camera exists. That avoids walking all shadow
  caster/receiver bounds for camera-backed frames where the fallback matrix is
  unused.
- Cached auto-shadow frames now store an actual-input key instead of relying on
  broad family-count change sets. The key includes the selected shadow camera,
  directional requests, referenced lights/transforms, actual shadow casters, and
  only the bounds that can affect the selected shadow fitting mode.
- Racing drift marks now explicitly opt out of receiving shadows; they are
  unlit transparent decals and should not invalidate or participate in receiver
  fitting.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` and
  `docs/SAB_RENDER_PACING_PLAN.md` with the latest clean repeat trace and the
  auto-shadow reuse caveat.

## Latest Findings

- Latest clean trace:
  `/tmp/racing-pacing-poll-autoshadow-clean-drive-repeat3/summary.json`
  (3 paired drive trials, 3 second samples, no trace/profile).
- Poll-first remains supported by the trace: Aperture won aggregate interval
  p99 (`3/3`), max interval (`3/3`), absolute-deviation p95 (`2/3`,
  `d50 -0.13 ms`), adjacent-jitter p95 (`2/3`, `d50 -0.28 ms`), RMS deviation
  (`2/3`, `d50 -0.09 ms`), `pacingInstabilityScoreMs` (`2/3`,
  `d50 -0.23 ms`), within-1ms ratio (`3/3`, `d50 +2.9 pp`), and
  jitter-over-2ms ratio (`3/3`, `d50 -6.7 pp`).
- Aperture narrowly lost interval p95 (`1/3`, `d50 +0.02 ms`) and still lost
  callback p95 in every trial (`d50 +0.84 ms`). The perceived smoothness gap is
  now more about callback-tail work and message shape than draw count.
- Delivered worker messages remained about `15.6-16.0 Hz`, mostly
  `aperture.simulation.sourceAssets`, touching about `26%` of RAF windows. The
  next transport experiment should make dynamic source assets pollable or
  coalesced, not restore steady render heartbeat messages.
- Auto-shadow input-key cleanup is general and tested, but not yet a proven
  performance win. Final sampled frames still showed
  `autoShadowFramesCreated:1` / `autoShadowFramesReused:0`, and
  `prepareMainAutoShadow` remained around `1.05-1.10 ms` p50 /
  `1.27-1.30 ms` p95. Add cache miss-reason diagnostics before spending more
  time guessing at this path.

## Latest Validation

- `pnpm exec prettier --write packages/webgpu/src/app/auto-shadow-frame.ts packages/webgpu/src/app/queued-built-in-frame.ts packages/webgpu/src/app/resource-cache.ts packages/webgpu/src/shadows/render-shadow-frame.ts test/webgpu/app-auto-shadow-frame.test.ts racing/src/systems/drift-marks.system.ts`
- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/webgpu-app.test.ts -t "auto-shadow|auto shadow|phase timing|GPU timestamp"`
- `pnpm exec tsc -b packages/webgpu --pretty false`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build -- --force`
- `node scripts/racing-render-loop-trace.mjs --scenario=drive --repeat=3 --duration=3000 --warmup=1500 --drive-settle=1000 --no-trace --no-cpu-profile --out=/tmp/racing-pacing-poll-autoshadow-clean-drive-repeat3`

## Recommended Next Task

First add auto-shadow cache miss-reason diagnostics so `prepareMainAutoShadow`
can be attacked with proof instead of inferred key diffs. In parallel with that
direction, the highest-value transport slice is still a pollable/coalesced
dynamic source-asset mailbox for drift-mark mesh updates, because
`aperture.simulation.sourceAssets` is the remaining measured worker-message
stream during Racing drive.

---

# Handoff - Racing Channel-Delivered Frame-Pacing Metrics

**Updated:** 2026-06-18 13:59 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice tightened the trace harness so
poll-vs-message conclusions use measured-window channel delivery, not
cumulative warmup/status counters.

## Latest Completed Slice

- Extended `scripts/racing-render-loop-trace.mjs` with:
  - `pacingInstabilityScoreMs` alongside the raw RAF deviation, adjacent jitter,
    RMS, within-1ms, long-frame, and missed-vsync metrics.
  - Normalized jitter ratios and missed-vsyncs/second so runs of different
    duration are comparable.
  - Baseline/snapshot status counter deltas for the measured RAF window.
  - Trace-local `MessageChannel.port1` delivery instrumentation, reported as
    `workerMsgHz` and top delivered message type. This is the relevant route for
    Aperture generated browser apps; raw Worker `message` events were not the
    simulation receive path.
- Ran new drive repeats:
  `/tmp/racing-pacing-channel-default-drive-repeat3/summary.json` and
  `/tmp/racing-pacing-channel-heartbeat60-drive-repeat3/summary.json`
  (3 paired trials each, 3 second samples, no trace/profile).
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` and
  `docs/SAB_RENDER_PACING_PLAN.md` with the corrected interpretation.

## Latest Findings

- The previous `msg top` / `sideband top` fields are cumulative browser status
  counters. They can include startup and pre-sample traffic, so they should not
  be used as the measured RAF-window message rate.
- Default native-RAF SAB drive delivered about `16 Hz` of messages during the
  measured window, mostly `aperture.simulation.sourceAssets`.
- Forcing `--aperture-shared-message-rate=60` delivered about `52 Hz` of
  `aperture.simulation.snapshot` messages during the same kind of window.
- Direct default-vs-heartbeat medians do not justify restoring render
  heartbeat. Heartbeat worsened interval p95 by `+0.16 ms`, deviation p95 by
  `+0.09 ms`, RMS by `+0.03 ms`, within-1ms by `-2.3 pp`, jitter-over-2ms by
  `+1.1 pp`, callback p95 by `+0.11 ms`, and render p95 by `+0.44 ms`.
  Adjacent-jitter p95 improved by `0.07 ms`, and the composite score was
  effectively tied.
- Current conclusion: keep render heartbeat poll-only. Keep challenging the
  remaining source-asset message stream with experiments, but do not treat all
  cumulative message counters as in-window pacing pressure.

## Latest Validation

- `node --check scripts/racing-render-loop-trace.mjs`
- `pnpm exec prettier --check scripts/racing-render-loop-trace.mjs docs/RACING_THREEJS_FRAME_TIME_AUDIT.md docs/SAB_RENDER_PACING_PLAN.md`
- `git diff --check`

## Recommended Next Task

Design the dynamic source-asset data-plane experiment: source assets are now the
remaining measured message stream during Racing drive. The next useful slice is
not a blind lower cadence; it should test a pollable/coalesced source-asset path
or a dynamic mesh update mailbox that keeps drift-mark freshness while reducing
`aperture.simulation.sourceAssets` channel delivery.

---

# Handoff - Racing Source-Asset Poll Pressure

**Updated:** 2026-06-18 14:05 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice tested the remaining
source-asset-message stream with repeated paired frame-pacing trials and kept
the change general: lower the SAB source-asset sideband default, but do not
hide the need for a pollable dynamic-asset data plane.

## Latest Completed Slice

- Dedicated `sourceAssets` sideband messages now carry the source-asset delta,
  top-level post-message decision, and frame only. They no longer carry a full
  worker summary payload.
- Browser-side source-asset mirroring now preserves the last full worker
  summary when a lean sideband arrives, and it records post-message decisions
  from either the top-level message field or the worker summary.
- Lowered the default SAB source-asset sideband cadence to `15 Hz`
  (`sourceAssetsMessageRateHz` start option still overrides it).
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` and
  `docs/SAB_RENDER_PACING_PLAN.md` with the latest source0/source15/default
  trace evidence.

## Latest Findings

- Fresh paired repeat traces:
  `/tmp/racing-pacing-repeat3-current-default/summary.json`,
  `/tmp/racing-pacing-repeat3-source15-current/summary.json`, and
  `/tmp/racing-pacing-repeat3-source0/summary.json`.
- Current default drive still delivered about `16 Hz` of worker messages, mostly
  `aperture.simulation.sourceAssets`, and lost the aggregate on interval p95,
  adjacent jitter p95, RMS, pacing score, and within-1ms ratio.
- Explicit `--aperture-source-assets-message-rate=15` won the 3-trial drive
  aggregate on interval p95, deviation p95, adjacent jitter p95, RMS, pacing
  score, within-1ms ratio, and jitter-over-2ms ratio; it still lost callback
  p95 (`d50 +0.54 ms`).
- `--aperture-source-assets-message-rate=0` removed roughly `56` source-asset
  worker deliveries in the measured 4 second drive window and gave the strongest
  pacing sample. Direct Aperture-only medians versus current default improved
  drive interval p95 by about `0.60 ms`, adjacent jitter p95 by about
  `0.93 ms`, render p95 by about `0.48 ms`, and callback p95 by about
  `0.18 ms`.
- Source0 is proof that the notification stream is costly, not a safe default:
  the changing assets are the dynamic `racing.driftMarks.*` mesh assets. The
  generalized fix is a pollable/coalesced dynamic-asset data plane that keeps
  update freshness without a `postMessage` wakeup per asset update.

## Latest Validation

- `pnpm exec prettier --check packages/app/src/worker/snapshot.ts packages/app/src/browser/assets.ts test/app/generated-worker-shared-snapshot-message.test.ts test/app/browser-performance-status.test.ts`
- `pnpm exec vitest run test/app/generated-worker-shared-snapshot-message.test.ts test/app/browser-performance-status.test.ts`
- `pnpm exec tsc -b --force packages/app --pretty false`
- `pnpm --dir racing run build -- --force`
- Repeated trace harness exercised successfully with current default,
  `--aperture-source-assets-message-rate=15`, and
  `--aperture-source-assets-message-rate=0`.

## Recommended Next Task

Design and implement a correctness-preserving dynamic source-asset transport
improvement: shared/ring-buffered payloads, a pollable versioned asset mailbox,
or another coalesced path that avoids irregular per-frame
`sourceAssetsChanged` sideband bursts without restoring render heartbeat as a
benchmark-specific workaround. Keep using `--repeat=N` and the aggregate pacing
comparisons for any transport decision.

---

# Handoff - Racing Status Retention And Resource Diagnostics Compaction

**Updated:** 2026-06-18 06:38 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice is generalized renderer/app
diagnostics/status infrastructure, not a Racing-only benchmark shortcut. The
latest paired benchmark still does **not** prove a clean win because Aperture
trails three.js on drive p95/p99/max, rendered submit cadence, and heap.

## Latest Completed Slice

- Removed full entity summaries from normal generated-worker snapshot summaries.
  Entity details are now resolved through on-demand runtime/devtool commands,
  and the developer panel requests its initial entity snapshot explicitly.
- Updated browser worker-summary merging so transient full-summary fields
  (`resources`, `startOptions`, `assets`, `physics`, legacy `entities`) are
  dropped when thin summaries arrive, while `entityTools` remains available for
  on-demand tooling.
- Throttled the developer-api panel status renderer to 4 Hz after the initial
  on-demand entity snapshot exposed that pretty-printing status every RAF can
  make the headed WebGPU page unresponsive under Playwright tracing.
- Updated `renderExplainEntity` to resolve entity details through the generated
  runtime bridge (`ecs_find_entities` / `ecs_get_entity`) before falling back to
  legacy retained status entities.
- Added status-only retained resource compaction:
  `webGpuAppRenderReportToJsonValue(report)` remains full-detail by default,
  while the browser status path uses `detail: "status"` and drops per-entry
  retained mesh/material resource details.
- Added focused regression coverage for browser worker-summary retention,
  runtime-backed CLI entity explain, and full-vs-status resource report
  serialization.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` with the latest exact audit evidence.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-status-resource-compact.json`
(`2026-06-18T13:36:24.676Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.17 ms`, p95 `4.72 ms`, p99 `5.10 ms`, max
  `5.17 ms`, heap `69.73 MB`; WebGPU submits `1292-1339` over 6s.
- three.js idle: avg `4.17 ms`, p95 `4.73 ms`, p99 `5.07 ms`, max
  `5.18 ms`, heap `18.01 MB`.
- Aperture drive: avg `4.17 ms`, p95 `4.69 ms`, p99 `5.06 ms`, max
  `7.29 ms`, heap `68.54 MB`; WebGPU submits `855-924` over 6s.
- three.js drive: avg `4.17 ms`, p95 `4.61 ms`, p99 `4.99 ms`, max
  `5.19 ms`, heap `18.49 MB`.
- Console warnings: only the existing initialization deprecation warning.

Live rebuilt status payload check on `http://127.0.0.1:5186/`:

- Generated app status: about `51.7 KB` (down from about `152 KB` before this
  retention slice).
- `diagnostics`: about `41.3 KB`.
- `diagnostics.lastFrame`: about `39.2 KB`.
- `lastFrame.resourceReuse`: about `1.8 KB` (down from about `15.9 KB` before
  status-only compaction).
- `lastWorkerSummary`: about `2.1 KB`.
- Steady worker status no longer retains `entities`, `assets`, `resources`, or
  `physics`.

Drive final-frame change sets in the latest audit:

- trial 1: `0 / 42` mesh draws and `0 / 364` shadow caster draws changed;
- trial 2: `0 / 42` mesh draws and `0 / 364` shadow caster draws changed;
- trial 3: `8 / 42` mesh draws and `6 / 364` shadow caster draws changed;
- bounds remain broad at `386 changed`, `326 unchanged`.

Latest WebGPU write probe remains the previous accepted low-volume run:
`/tmp/racing-write-probe-shadow-world-transforms.json`
(`2026-06-18T12:07:32.003Z`): idle `0.15 KB/frame`, drive `2.09 KB/frame`.

## Validation

- `pnpm exec vitest run test/app/browser-performance-status.test.ts test/cli/render-tools.test.ts`
- `pnpm exec vitest run test/app/browser-performance-status.test.ts test/cli/render-tools.test.ts test/webgpu/webgpu-app.test.ts -t "retained full worker summary fields|renderExplainEntity|initializes WebGPU and renders the unlit queue path"`
- `pnpm exec tsc -b --force packages/webgpu packages/app packages/cli --pretty false`
- `pnpm exec prettier --check packages/webgpu/src/app/report.ts packages/webgpu/src/app/create-webgpu-app.ts packages/app/src/worker/snapshot.ts packages/app/src/browser/assets.ts packages/cli/src/tools/render.ts examples/developer-api/src/dev-panel.ts test/app/browser-performance-status.test.ts test/cli/render-tools.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- Live status payload check against the rebuilt Racing server.
- Paired frame audit completed against local Racing/three.js servers:
  `/tmp/racing-frame-audit-status-resource-compact.json`.
- `pnpm exec playwright test test/e2e/developer-api.spec.ts`
  - failed before reaching the new entity-snapshot assertions; the headed
    WebGPU page became unresponsive around the first status read/resize
    boundary and timed out at `page.setViewportSize`. A focused panel
    throttling fix was kept, but this full e2e remains a separate validation
    issue.

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture drive trails three.js on p95/p99/max
  and rendered submit cadence.
- Top next engine target: heap retention and drive cadence/tail outliers now
  that draw count, upload byte pressure, status payload retention, and broad
  main-mesh identity churn are mostly controlled.
- Keep detailed `renderChangeSet.keys` available to CLI packet/entity tools, or
  replace it with an explicitly tested on-demand detail path before shrinking
  that remaining `~16.8 KB` status field.
- Heap remains much higher than three.js and needs a dedicated retention audit.
- Add frame-report upload diagnostics for full/range/skipped writes and fallback
  reasons.

---

# Handoff - Racing Diagnostics Compaction And Cadence Probe

**Updated:** 2026-06-18 06:18 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice is generalized renderer/app
diagnostics infrastructure and frame-loop evidence, not a Racing-only benchmark
shortcut. The latest paired benchmark is improved, but still does **not** prove
a clean win because Aperture has a worse drive max frame and much higher heap.

## Latest Completed Slice

- Added cadence diagnostics to `createWebGpuApp`: snapshots received,
  presentation callbacks, renders started/completed, pending replacement count,
  missed-in-flight catch-up count, callback-without-work count, and render
  failures.
- Measured and rejected an immediate scheduled-snapshot drain policy. It raised
  rendered submit count, but `/tmp/racing-frame-audit-idle-drain.json` showed
  worse p95/p99/max, so it was not kept.
- Kept the generalized one-render-in-flight, latest-pending-snapshot-wins
  scheduler contract and removed zero-only counters from the public cadence
  report.
- Summarized long render-bundle diagnostic keys by stable hash/length instead of
  publishing full command-key JSON strings in frame reports.
- Compact app-facing shadow diagnostics: exact counts remain, but the 364-entry
  caster draw list is represented by an 8-entry sample plus omitted count.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` with the latest accepted
  benchmark evidence and the remaining diagnostics/status compatibility
  boundary.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-current-final.json`
(`2026-06-18T13:17:58.264Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.17 ms`, p95 `4.70 ms`, p99 `5.05 ms`, max
  `5.20 ms`, heap `74.11 MB`; WebGPU submits `1303-1321` over 6s.
- three.js idle: avg `4.17 ms`, p95 `4.70 ms`, p99 `5.07 ms`, max
  `6.24 ms`, heap `18.20 MB`.
- Aperture drive: avg `4.17 ms`, p95 `4.65 ms`, p99 `5.03 ms`, max
  `8.33 ms`, heap `74.88 MB`; WebGPU submits `875-986` over 6s.
- three.js drive: avg `4.17 ms`, p95 `4.63 ms`, p99 `5.04 ms`, max
  `5.20 ms`, heap `18.87 MB`.
- Console warnings: `0` destroyed-buffer warnings in the accepted final run;
  only the existing initialization deprecation warning appeared.

Live rebuilt status payload check on `http://127.0.0.1:5186/`:

- `diagnostics.lastFrame` is about `53 KB`.
- Largest remaining fields: `renderChangeSet` `~16.8 KB`, `resourceReuse`
  `~15.9 KB`, `shadow` `~6.8 KB`, `diagnosticsSummary` `~6.4 KB`.
- Shadow caster draw-list diagnostics are compact (`8` draw sample entries,
  `356` omitted for the Racing shadow pass).
- `renderChangeSet.keys` remains detailed because CLI packet/entity explanation
  tools read it from browser status.

Drive distribution after opaque depth-only identity:
`/tmp/racing-drive-distribution-opaque-depth-identity.json`
(`2026-06-18T12:22:02.774Z`):

- `219` samples over 7s while holding `W+D`.
- Broad main mesh changes (`>=30` changed mesh draws): `5 / 219`, down from
  `98 / 222` before this slice.
- Broad shadow-caster changes (`>=300` changed shadow draws): `21 / 219`.
- Stable frames now show post-graph scene bundle reuse with `encodedCommands: 0`;
  dynamic particle tail commands still execute directly, so render target draw
  counts remain correct.

Latest WebGPU write probe remains the previous accepted low-volume run:
`/tmp/racing-write-probe-shadow-world-transforms.json`
(`2026-06-18T12:07:32.003Z`): idle `0.15 KB/frame`, drive `2.09 KB/frame`.

## Validation

- `pnpm exec vitest run test/webgpu/frame-boundary.test.ts test/webgpu/app-frame-boundaries.test.ts test/webgpu/webgpu-app.test.ts test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts`
- `pnpm exec tsc -b --force packages/webgpu --pretty false`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- Live status payload check against the rebuilt Racing server.
- Paired frame audit completed against local Racing/three.js servers:
  `/tmp/racing-frame-audit-current-final.json`.
- Pending before final stop: broader typecheck, prettier/docs checks,
  `pnpm run check:progress`, and `git diff --check` after docs settle.

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture drive is roughly tied with three.js
  around p95/p99 in the latest run, but still trails on max frame and rendered
  submit cadence.
- Top next engine target: heap/status retention and cadence tail outliers.
  Stable frames can reuse the post-graph scene bundle, but rendered submits are
  still only `875-986` over the 6s drive sample and pending snapshots still
  accumulate during drive.
- Investigate why some drive frames still report narrow mesh/shadow changes
  (`6-8` draw records) and miss bundle reuse, but broad main-mesh churn is no
  longer the primary blocker.
- Heap remains much higher than three.js and needs a dedicated retention audit.
  `lastWorkerSummary` plus render diagnostics/status data are visible suspects,
  but do not remove detailed `renderChangeSet.keys` without a CLI-compatible
  replacement.
- Add frame-report upload diagnostics for full/range/skipped writes and fallback
  reasons.

---

# Handoff - Racing Extraction Cache Dependency Fix

**Updated:** 2026-06-18 05:18 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice is generalized render-extraction
dependency tracking, not a Racing-only benchmark shortcut, but the latest paired
benchmark still does **not** prove a clean win.

## Latest Completed Slice

- Made mesh and shadow-caster extraction cache reuse independent from the full
  camera frustum signature:
  - frustum planes still run current per-entity visibility tests each frame;
  - main-pass cached draws refresh `sortKey.viewId` and `sortKey.depth` from
    the active view before append;
  - shadow-caster cached draws do not inherit primary-camera frustum state and
    keep stable shadow sort metadata;
  - the cache remains guarded by entity version, transform version, layer mask,
    and existing side-buffer exclusions.
- Added regression coverage proving:
  - camera movement does not invalidate unchanged shadow casters;
  - a cached main mesh entry survives camera movement while matching a cold
    extraction's refreshed sort depth.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` with the latest benchmark/write-probe
  evidence and next bottlenecks.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-main-cache.json`
(`2026-06-18T12:07:53.183Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.17 ms`, p95 `4.78 ms`, p99 `5.05 ms`, max
  `6.08 ms`, heap `71.81 MB`; WebGPU submits `1248-1299` over 6s.
- three.js idle: avg `4.17 ms`, p95 `4.74 ms`, p99 `5.12 ms`, max
  `5.20 ms`, heap `18.19 MB`.
- Aperture drive: avg `4.18 ms`, p95 `4.72 ms`, p99 `5.10 ms`, max
  `8.34 ms`, heap `58.10 MB`; WebGPU submits `829-869` over 6s.
- three.js drive: avg `4.17 ms`, p95 `4.64 ms`, p99 `4.99 ms`, max
  `5.19 ms`, heap `18.84 MB`.

Latest WebGPU write probe:
`/tmp/racing-write-probe-shadow-world-transforms.json`
(`2026-06-18T12:07:32.003Z`):

- Idle: `1.88` writes/frame and `0.15 KB/frame`; top labels are the indirect
  draw buffer at about `0.09 KB/frame` and the directional shadow pass matrix at
  about `0.06 KB/frame`.
- Drive: `8.96` writes/frame and `2.09 KB/frame`.
- The previous full `Particle/BurstBatch/...smoke...` drive upload remains
  gone. Current top drive labels are analytic burst initial-slot writes
  (`0.44 KB/frame`), compact `WorldTransforms/storage` (`0.37 KB/frame`),
  `ShadowCasterWorldTransforms/storage` (`0.24 KB/frame`), light floats
  (`0.21 KB/frame`), and burst params (`0.19 KB/frame`).
- No current drive write label is above `0.45 KB/frame`; dynamic upload byte
  pressure remains low and is no longer dominated by one buffer.

Drive change-set/cadence probe:
`/tmp/racing-drive-distribution-main-cache.json`
(`2026-06-18T12:06:51.968Z`):

- `222` samples over 7s while holding `W+D`.
- Broad main mesh changes (`>=30` changed mesh draws): `98 / 222` samples.
- Broad shadow-caster changes (`>=300` changed shadow draws): `25 / 222`
  samples.
- Latest cadence sample still showed RAF near `240 Hz`, renders completed near
  `152 Hz`, `pendingSnapshot:true`, `scheduled:true`, and `inFlight:false`.

## Validation

- `pnpm exec vitest run test/rendering/extraction.test.ts`
  - 72 tests passed.
- `pnpm exec prettier --check packages/render/src/rendering/extraction-mesh-cache.ts packages/render/src/rendering/extraction-meshes.ts test/rendering/extraction.test.ts`
- `pnpm exec tsc -b --force packages/render packages/webgpu packages/runtime packages/app --pretty false`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- Latest write probe and paired frame audit completed against the live local
  Racing/three.js servers.
- Pending before final stop: rerun `pnpm run check:progress`, `git diff --check`,
  and any broader targeted suites after the docs settle.

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture drive still trails three.js on max
  frame and rendered submit cadence; idle p95/p99/max also remain behind in the
  latest saved run.
- Top next engine target: split main mesh resource identity from view/sort
  ordering metadata so camera-driven sort-depth changes do not falsely block
  render-bundle or incremental-update decisions. Do not loosen transparent sort
  correctness.
- Frame cadence remains open: latest live probe still showed pending snapshots
  queued while no render was in flight and a presentation callback was merely
  scheduled.
- Add frame-report upload diagnostics for full/range/skipped writes and
  fallback reasons.
- Continue cadence and heap work now that dynamic upload byte pressure is low.
- Particle burst slot fragmentation and tiny initial-slot write count can still
  be improved, but particle burst uploads are no longer the top byte target.

---

# Handoff - Racing Shadow World-Transform Instancing

**Updated:** 2026-06-18 03:59 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. This slice is a generalized shadow renderer
fix, not a Racing-only benchmark shortcut, but the latest paired benchmark still
does **not** prove a clean win.

## Latest Completed Slice

- Changed directional shadow caster submission from CPU-baked per-caster
  light-space matrix uploads to a shader-side composition path:
  - group 0 binding 0 is now one per-pass light view-projection uniform;
  - group 0 binding 1 is a draw-list-order caster world-transform storage
    buffer;
  - shadow command records map each `${passKey}:${renderId}` to a contiguous
    world-transform slot and use that slot as `firstInstance`;
  - compatible shadow records still group/coalesce through the existing render
    pass draw-list path.
- Added cached shadow pass matrix buffers and a cached
  `ShadowCasterWorldTransforms/storage` buffer with dirty upload behavior:
  byte-identical frames skip, clustered moving ranges use bounded sub-writes,
  and broad changes fall back to full upload.
- Added a live-resource guard so a partially-created pass-matrix/world-transform
  bind-group path reports missing resources instead of falling back to an
  obsolete one-binding shape.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` with the latest benchmark/write-probe
  evidence.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-shadow-world-transforms.json`
(`2026-06-18T10:54:30.190Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.17 ms`, p95 `4.82 ms`, p99 `5.06 ms`, max
  `5.20 ms`, heap `92.98 MB`; WebGPU submits `1227-1244` over 6s.
- three.js idle: avg `4.17 ms`, p95 `4.67 ms`, p99 `5.05 ms`, max
  `5.19 ms`, heap `18.17 MB`.
- Aperture drive: avg `4.19 ms`, p95 `4.74 ms`, p99 `5.11 ms`, max
  `8.69 ms`, heap `63.91 MB`; WebGPU submits `823-874` over 6s.
- three.js drive: avg `4.17 ms`, p95 `4.68 ms`, p99 `5.09 ms`, max
  `5.20 ms`, heap `18.83 MB`.

Latest WebGPU write probe:
`/tmp/racing-write-probe-shadow-world-transforms.json`
(`2026-06-18T10:54:22.237Z`):

- Idle: `5.44` writes/frame and `5.1 KB/frame`; top write is
  `WorldTransforms/storage` at `4.6 KB/frame`.
- Drive: `9.31` writes/frame and `21.2 KB/frame`.
- The previous `DirectionalShadowCasterBakedMatrices/storage` drive cost
  (`17.4 KB/frame`) is gone. The replacement
  `ShadowCasterWorldTransforms/storage` cost is one `380` byte clustered write
  per shadow frame, about `0.23 KB/frame`.
- Top remaining drive write target is
  `Particle/BurstBatch/...smoke...` at about `15.0 KB/frame`, followed by
  compact `WorldTransforms/storage` at about `5.0 KB/frame`.

## Validation

- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/shadow-caster-command-record-plan.test.ts test/webgpu/shadow-caster-matrix-bind-group-resource.test.ts test/webgpu/shadow-caster-pipeline-resource.test.ts`
  - 4 files, 23 tests passed.
- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/shadow-caster-command-record-plan.test.ts test/webgpu/shadow-caster-draw-list-plan.test.ts test/webgpu/shadow-caster-frame-resource-readiness.test.ts test/webgpu/shadow-caster-matrix-bind-group-resource.test.ts test/webgpu/shadow-caster-pipeline-resource.test.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/draw-order-transform-packing.test.ts test/webgpu/transform-dirty-upload.test.ts test/rendering/transform-pack.test.ts test/webgpu/prepared-mesh-cache.test.ts test/app/meshes.test.ts`
  - 13 files, 104 tests passed.
- `pnpm exec tsc -b --force packages/simulation packages/render packages/runtime packages/webgpu packages/app --pretty false`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- Latest write probe and paired frame audit completed against the live local
  Racing/three.js servers.

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture drive still trails three.js on max
  frame and rendered submit cadence.
- Top next engine target: reduce particle burst-batch upload pressure. Burst
  draws are batched, but the renderer still repacks/uploads the full live burst
  batch buffer.
- Add frame-report upload diagnostics for full/range/skipped writes and
  fallback reasons.
- Continue cadence and heap work after the remaining large dynamic writes are
  addressed.

---

# Handoff - Racing Compact Transforms And Dynamic Ribbon Ranges

**Updated:** 2026-06-18 03:29 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. The changes in this slice are generalized
engine/app-helper fixes, not Racing-only benchmark shortcuts, but the latest
paired benchmark still does **not** prove a clean win.

## Latest Completed Slice

- Added compact mesh-world transform packing:
  - mesh frame resources now pack only transforms referenced by mesh draw
    packets into a compact buffer;
  - raw extraction-order transforms remain available for overlay/picking paths
    that still need raw offsets;
  - the fix is route/resource-prep level, with no Racing asset names or
    tree/deco conditionals.
- Added same-layout prepared mesh GPU buffer reuse:
  - prepared mesh resources can reuse existing GPU buffers across source asset
    version bumps when the upload layout is unchanged;
  - vertex/index descriptors can carry optional byte update ranges;
  - absent ranges mean full upload, empty ranges mean no upload for that buffer.
- Converted `trails.groundRibbon(...)` to fixed-capacity dynamic meshes:
  - ground ribbons now keep max-capacity vertex/index buffers and change the
    submesh draw range instead of growing buffer sizes;
  - each flushed segment marks one `288` byte vertex range;
  - index buffers are static after initial upload.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` with the latest benchmark/write-probe
  evidence and next bottlenecks.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-ground-ribbon-ranges.json`
(`2026-06-18T10:19:32.653Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.17 ms`, p95 `4.74 ms`, p99 `5.10 ms`, max
  `5.21 ms`, heap `59.20 MB`; WebGPU submits `1013-1091` over 6s.
- three.js idle: avg `4.17 ms`, p95 `4.63 ms`, p99 `5.04 ms`, max
  `5.23 ms`, heap `15.88 MB`.
- Aperture drive: avg `4.19 ms`, p95 `4.64 ms`, p99 `5.10 ms`, max
  `8.90 ms`, heap `43.70 MB`; WebGPU submits `716-836` over 6s.
- three.js drive: avg `4.17 ms`, p95 `4.59 ms`, p99 `5.03 ms`, max
  `5.20 ms`, heap `18.53 MB`.

Latest WebGPU write probe:
`/tmp/racing-write-probe-ground-ribbon-ranges.json`
(`2026-06-18T10:18:27.416Z`):

- Idle: `4.73` writes/frame and `4.4 KB/frame`; top write is compact
  `WorldTransforms/storage` at `4.0 KB/frame`.
- Drive: `11.76` writes/frame and `41.8 KB/frame`; top writes are
  `DirectionalShadowCasterBakedMatrices/storage` at `17.4 KB/frame`,
  `Particle/BurstBatch/...smoke...` at `16.8 KB/frame`, and
  `WorldTransforms/storage` at `6.2 KB/frame`.
- Drift trail vertex writes are now one `288` byte update per emitted segment:
  `Drift trail bl` `89.7 bytes/frame`, `Drift trail br` `85.6 bytes/frame`;
  drift index writes are gone from the hot list.

## Validation

- `pnpm exec vitest run test/webgpu/prepared-mesh-cache.test.ts`
- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/shadow-caster-command-record-plan.test.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/draw-order-transform-packing.test.ts test/webgpu/transform-dirty-upload.test.ts test/rendering/transform-pack.test.ts test/webgpu/prepared-mesh-cache.test.ts test/app/meshes.test.ts`
  - 9 files, 82 tests passed.
- `pnpm exec tsc -b --force packages/simulation packages/render packages/runtime packages/webgpu packages/app`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- `pnpm run check:progress`
- `git diff --check`

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture drive still trails three.js on max
  frame and rendered submit cadence.
- Top next engine target: reduce directional shadow baked-matrix upload
  pressure. The shadow path still uploads a full baked caster matrix table
  during active drive/camera changes.
- Second target: reduce particle burst-batch upload pressure. Burst draws are
  batched, but the renderer still repacks/uploads the full live burst batch
  buffer.
- Add frame-report upload diagnostics for full/range/skipped writes and
  fallback reasons.
- Continue heap/cadence work after the remaining large dynamic writes are
  addressed.

---

# Handoff - Racing Standard/Transform Upload Reuse Audit

**Updated:** 2026-06-18 02:50 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. The accepted changes in this slice are
general renderer/resource fixes, not Racing-only benchmark hacks, but the
latest current-source benchmark still does **not** prove a clean win.

## Latest Completed Slice

- Rebuilt from current source after removing stale ignored package/app bundles
  earlier in the run, so the Racing production bundle uses the live WebGPU
  source path rather than an old compatibility `dist` tree.
- Added generalized baked directional shadow matrix reuse:
  - shadow caster matrix baking now uses cache-owned scratch storage;
  - the baked matrix GPU resource keeps the last uploaded bytes;
  - identical baked caster matrix frames skip `queue.writeBuffer`;
  - buffer size changes still destroy/recreate normally.
- Added shared Standard app-frame resources:
  - StandardMaterial app frames can share app-cache-owned view-uniform and
    world-transform resources across compatible Standard routes;
  - minimal/standalone cache slots keep old behavior when no app cache exists.
- Added bounded multi-range transform dirty uploads:
  - packed transform snapshots can carry multiple dirty windows;
  - WebGPU dirty uploads write those bounded ranges when the previous GPU
    version is exactly one frame behind;
  - changed-float threshold and range-count caps still fall back to full writes.
- Added draw-order transform upload skipping:
  - draw-order transform buffers keep the last uploaded matrix bytes;
  - byte-identical sorted draw-order matrices now skip reupload.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` with the latest benchmark/write-probe
  evidence and the explicit generalized-vs-benchmark-hack distinction.

## Latest Measurements

Current-source isolated local server run:
`/tmp/racing-frame-audit-after-draworder-skip.json`
(`2026-06-18T09:40:26.128Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.167 ms`, p95 `4.767 ms`, p99 `5.087 ms`, max
  `5.205 ms`, heap `59.77 MB`; WebGPU submits `1250-1298` over 6s.
- three.js idle: avg `4.167 ms`, p95 `4.727 ms`, p99 `5.063 ms`, max
  `5.210 ms`, heap `18.13 MB`.
- Aperture drive: avg `4.174 ms`, p95 `4.680 ms`, p99 `5.050 ms`, max
  `8.465 ms`, heap `76.25 MB`; WebGPU submits `879-939` over 6s.
- three.js drive: avg `4.166 ms`, p95 `4.600 ms`, p99 `5.063 ms`, max
  `5.210 ms`, heap `18.94 MB`.
- Latest full benchmark counts: idle `meshDraws:40`, `shadowCasterDraws:364`,
  `drawPackages:40`, `drawCommands:125`, `drawCalls:25`, diagnostics `0`;
  drive `meshDraws:42`, `shadowCasterDraws:364`, `particleEmitters:306`,
  `drawPackages:42`, `drawCommands:177`, `drawCalls:34`, diagnostics `0`.

Latest WebGPU write probe:
`/tmp/racing-write-probe-draworder-skip.json`
(`2026-06-18T09:39:58.500Z`):

- Idle: `6.12` writes/frame and `53.0 KB/frame`; draw-order transform uploads
  are gone after the initial stable upload; extraction-order
  `WorldTransforms/storage` remains `2.04` writes/frame and `52.5 KB/frame`.
- Drive: `20.11` writes/frame and `227.8 KB/frame`; draw-order transform upload
  is down to `40` writes across `771` sampled frames (`0.052` writes/frame);
  extraction-order `WorldTransforms/storage` remains `3.00` writes/frame and
  `128.0 KB/frame`.

## Validation

- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/shadow-caster-command-record-plan.test.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/draw-order-transform-packing.test.ts test/webgpu/transform-dirty-upload.test.ts test/rendering/transform-pack.test.ts`
  - 7 files, 66 tests passed.
- `pnpm exec tsc -b --force packages/simulation packages/render packages/runtime packages/webgpu packages/app`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- `pnpm run check:progress`
- `git diff --check`

## Known Issues / Next Best Work

- Active goal is not achieved. Aperture idle is close, but drive still trails
  three.js on p95/max and rendered submit cadence.
- The top concrete next engine target is eliminating redundant
  extraction-order `WorldTransforms/storage` uploads for routes fully covered by
  draw-order transform packing. This should be a generalized two-phase
  resource-prep or route-coverage fix, not a Racing conditional.
- Add frame-report diagnostics for transform upload mode/fallback reason so
  future probes expose full/envelope/multi-range behavior directly.
- Active drive still reports broad mesh/shadow change-set churn
  (`42/42` mesh draws and `364/364` shadow caster draws changed), which likely
  contributes to full/large transform uploads.
- Memory pressure remains high: latest used heap is `59.77-76.25 MB` for
  Aperture versus `18.13-18.94 MB` for three.js.

---

# Handoff - Racing Particle Buffer Cache And Scheduler Experiment Rejection

**Updated:** 2026-06-18 02:01 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. The latest current-source isolated evidence
keeps diagnostics at `0`, but still does **not** prove a clean win because
drive max/tail latency and rendered cadence remain worse than three.js.

## Latest Completed Slice

- Added particle view-uniform buffer reuse:
  - `prepareParticleFrameResourcesForSnapshot()` now reuses a cache-owned
    `Particle/ViewUniforms` GPU buffer and updates it with `queue.writeBuffer`
    instead of allocating a fresh GPU buffer every particle frame.
  - The cache destroys/recreates only when a later snapshot needs a larger
    view-uniform payload.
  - Focused particle tests now prove reuse across frames and resize
    invalidation.
- Tested and rejected a bounded scheduler late-latch experiment:
  - The experiment rendered a pending worker snapshot immediately when an
    in-flight render completed before the scheduled RAF.
  - The Racing benchmark worsened drive p95/p99/max and did not consistently
    improve submit counts, so the experiment was reverted.
- Added a dedicated shadow-caster extraction cache:
  - `RenderExtractionCache` now keeps `shadowCasterDrawEntities` separate from
    main-view `meshDrawEntities`.
  - Shadow-caster extraction can reuse unchanged off-camera caster packet
    templates without inheriting main-camera frustum-cull cache state.
  - Transform-only shadow caster updates refresh matrix/bounds while preserving
    cached draw template identity.
- Added a narrow worker-snapshot presentation catch-up path:
  - `createWebGpuApp()` now records a presentation callback that fires while a
    render is in flight.
  - If a newer snapshot is pending after the in-flight render completes, the app
    renders the latest pending snapshot immediately instead of waiting for one
    additional RAF.
  - A broader display-driven RAF render-loop experiment was benchmarked, found
    worse for Racing submit cadence, and reverted.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`,
  `docs/index.html`, and `docs/render-pipeline-comparison.html` with the latest
  numbers and the remaining non-win diagnosis.

## Latest Measurements

Current-source isolated local server run after particle view-buffer reuse:
`/tmp/racing-frame-audit-particle-view-buffer.json`
(`2026-06-18T08:52:40.094Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.167 ms`, p95 `4.815 ms`, p99 `5.135 ms`, max
  `5.198 ms`; WebGPU submits `1208-1319` over 6s.
- three.js idle: avg `4.166 ms`, p95 `4.667 ms`, p99 `5.033 ms`, max
  `5.233 ms`.
- Aperture drive: avg `4.176 ms`, p95 `4.642 ms`, p99 `5.083 ms`, max
  `8.553 ms`; WebGPU submits `809-901` over 6s.
- three.js drive: avg `4.167 ms`, p95 `4.633 ms`, p99 `5.000 ms`, max
  `5.200 ms`.
- Latest sampled Aperture drive counts: `meshDraws:42`,
  `shadowCasterDraws:364`, `particleEmitters:306`, `liveParticles:918`,
  `drawPackages:42`, `drawCommands:177`, `drawCalls:34`, diagnostics `0`.

Accepted phase-rich isolated local server run:
`/tmp/racing-frame-audit-scheduler.json` and
`/tmp/racing-frame-audit-isolated-latest.json`
(`2026-06-18T08:35:14.202Z`, SharedArrayBuffer active):

- Aperture idle: avg `4.167 ms`, p95 `4.700 ms`, p99 `5.067 ms`, max
  `5.198 ms`; WebGPU submits `961-1047` over 6s; worker extraction
  `0.72-0.75 ms`.
- three.js idle: avg `4.167 ms`, p95 `4.567 ms`, p99 `5.033 ms`, max
  `5.200 ms`.
- Aperture drive: avg `4.181 ms`, p95 `4.707 ms`, p99 `5.077 ms`, max
  `8.552 ms`; WebGPU submits `802-978` over 6s; worker extraction
  `1.29-1.34 ms`.
- three.js drive: avg `4.167 ms`, p95 `4.667 ms`, p99 `5.033 ms`, max
  `5.200 ms`.
- Latest sampled Aperture idle counts: `meshDraws:40`,
  `shadowCasterDraws:364`, `drawPackages:40`, `drawCommands:125`,
  `drawCalls:25`, diagnostics `0`, particles `0`.
- Latest sampled Aperture drive counts: `meshDraws:43`,
  `shadowCasterDraws:364`, `particleEmitters:306`, `liveParticles:918`,
  `drawPackages:43`, `drawCommands:177`, `drawCalls:34`, diagnostics `0`.

## Validation

- `pnpm exec vitest run test/rendering/extraction.test.ts test/rendering/extraction-transform-only.test.ts test/rendering/extraction-scratch-reuse.test.ts`
  - 3 files, 79 tests passed.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "worker snapshots|catches up a pending worker snapshot|SharedArrayBuffer snapshots"`
  - 4 tests passed, 68 skipped by filter.
- `pnpm exec vitest run test/webgpu/particle-frame-resources.test.ts`
  - 5 tests passed.
- `pnpm exec vitest run test/webgpu/particle-frame-resources.test.ts test/webgpu/webgpu-app.test.ts -t "GPU particle app frame resources|worker snapshots|catches up a pending worker snapshot|SharedArrayBuffer snapshots"`
  - 9 tests passed, 68 skipped by filter.
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/runtime run typecheck`
- `pnpm --filter @aperture-engine/runtime run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.

## Known Issues / Next Best Work

- The active goal is not achieved. Aperture idle is near parity, but drive still
  trails three.js on max/tail latency and rendered cadence.
- Reduce render `prepare`/resource-planning cost next. Latest drive frames still
  spend about `1.9-2.0 ms` in prepare even after extraction fell below
  `1.4 ms`.
- Check in the browser benchmark runner so future slices can reproduce display
  RAF intervals, WebGPU submit cadence, worker timings, counts, particle stats,
  and phase timings without relying on `/tmp`.
- Define the high-refresh simulation/render policy. Snapshot-driven rendering
  still falls below 240 Hz under drive.
- Add a local/dev COOP/COEP serving path for repeatable SharedArrayBuffer perf
  runs without one-off static servers.
- Audit heap/GC pressure directly; the latest isolated Chromium run exposed no
  useful `jsHeapUsedSize`, while earlier precise-memory runs showed Aperture far
  above three.js.
- Fix DPR/backing-store sizing for `device-pixel-content-box` and DPR `2`.
- Investigate intermittent active-drive all-scene mesh/shadow invalidation and
  remaining idle bounds churn.

---

# Handoff - Racing SAB Transport And Frame-Time Audit Update

**Updated:** 2026-06-18 01:08 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. The latest isolated/SAB evidence is near
idle parity, but still not a clean drive win.

## Latest Completed Slice

- Exposed generated browser performance timing status:
  - `__APERTURE_GENERATED_APP__.performance.latest` now reports worker publish
    timing and transport mode.
  - rolling publish/step/low-level stats are retained for lightweight browser
    probes.
- Extended the packed shared-snapshot ABI for particle emitter packets:
  - ABI version bumped to `12`;
  - particle packets round-trip through render encode/decode and WebGPU SAB
    reconstruction;
  - Racing drive/smoke frames no longer force transferable snapshots because of
    `particleEmitters`.
- Added SAB-compatible audio sideband snapshots:
  - shared render frames now send compact placeholder snapshots containing only
    audio packets and their referenced matrices;
  - audio remains a main-thread sibling derived view without forcing full render
    snapshots onto the transferable path.
- Fixed a SAB frame/registry race:
  - WebGPU shared snapshot decode now requires the readable SAB frame to match
    the worker message frame;
  - stale events are skipped instead of decoding newer packet words with an
    older registry.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` with the clean isolated
  headed Playwright benchmark from `/tmp/racing-frame-audit-isolated-latest.json`
  (`2026-06-18T08:07:16.282Z`).

## Latest Measurements

Latest isolated local server run (`http://127.0.0.1:5186/`,
SharedArrayBuffer active):

- Aperture idle: avg `4.172 ms`, p95 `4.762 ms`, p99 `5.043 ms`, max
  `7.663 ms`.
- three.js idle: avg `4.167 ms`, p95 `4.567 ms`, p99 `5.000 ms`, max
  `5.233 ms`.
- Aperture drive: avg `4.281 ms`, p95 `4.970 ms`, p99 `8.257 ms`, max
  `8.857 ms`.
- three.js drive: avg `4.167 ms`, p95 `4.600 ms`, p99 `5.033 ms`, max
  `5.233 ms`.
- `performance.memory` did not expose used heap in this Chromium run; the prior
  precise-memory plain-server run still showed Aperture far above three.js.
- Aperture transport was `shared-array-buffer` in all six samples, with zero
  render failures and no SAB packet/index validation errors after the frame
  matching fix.
- Aperture WebGPU submits: `1317-1347` over 6s idle (`~220-225/s`) and
  `1081-1172` over 6s drive (`~180-195/s`).
- Worker publish timing:
  - idle `postMessageMilliseconds` avg `0.043-0.046 ms`;
  - drive `postMessageMilliseconds` avg `0.169-0.187 ms`;
  - drive publish avg remains `4.18-4.45 ms`.
- Last Aperture diagnostics:
  - idle main packages/descriptors/drawList/resolved `40 / 40 / 14 / 14`;
  - drive main packages/descriptors/drawList/resolved `42 / 42 / 20 / 20`;
  - shadow status `ready`, `passCount:1`, `364` caster records grouped to
    `30` shadow draws;
  - drive still has `306` particle emitters / `906` live particles;
  - two drive trials showed only `6` mesh/shadow changes, but one trial still
    showed all mesh/shadow packets changed.

## Validation

- `pnpm exec vitest run test/app/browser-performance-status.test.ts test/app/browser-signals.test.ts test/app/browser-input-forwarding.test.ts`
- `pnpm exec vitest run test/rendering/snapshot-packed-encoding.test.ts test/webgpu/app-snapshot-transport.test.ts test/app/audio-snapshot-transport.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build -- --force`
  - passed with the existing Vite large-chunk warning.
- `pnpm exec prettier --check ...` on the touched docs/code/test files.
- `git diff --check`

## Known Issues / Next Best Work

- The active goal is not achieved. Aperture idle is close to parity, but drive
  still trails three.js on p99/max jitter and rendered cadence.
- Persist the new runtime/app phase timing histograms in a checked-in benchmark
  runner. The ad hoc JSON now includes worker publish rolling stats, but the
  driver still lives outside the repo.
- Define the high-refresh simulation/render policy. The latest fixes reduced
  waste, but snapshot-driven rendering still falls below 240 Hz under drive.
- Add a local/dev COOP/COEP serving path so SAB transport can be measured in the
  normal Racing benchmark environment without a temporary server.
- Audit heap retention and GC variance directly; the latest isolated run lacked
  used-heap counters, while the prior precise-memory run remained far above
  three.js.
- Investigate intermittent active-drive all-scene mesh/shadow invalidation and
  the remaining `76` idle bounds changes.

---

# Handoff - Racing Three.js Follow-Up: Diagnostics Cache And Fog SAB Codec

**Updated:** 2026-06-17 23:34 PDT

Active user goal remains open: continue investigating and implementing proper
engine/app fixes until Aperture consistently outperforms the three.js Racing
reference in both idle and drive. The latest evidence is still near parity, not
a clean win.

## Latest Completed Slice

- Cached WebGPU app diagnostics JSON:
  - `createWebGpuApp.getDiagnostics()` now returns the cached JSON conversion
    for the latest render/pick report instead of reserializing large reports on
    every browser diagnostics RAF.
  - Added a focused identity assertion in `test/webgpu/webgpu-app.test.ts`.
- Added fog support to the packed shared snapshot ABI:
  - bumped packet ABI version to `11`;
  - added fixed-width fog packet encoding/decoding and public stride metadata;
  - reconstructed `snapshot.fogs` and `report.fogs` in
    `readWebGpuAppSharedSnapshot`;
  - removed fog from the worker's unsupported-SAB payload list;
  - added render codec, worker fallback, and WebGPU shared snapshot coverage.
- Updated `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` with:
  - the latest plain-server benchmark from
    `/tmp/racing-frame-audit-latest.json`
    (`2026-06-18T06:16:28.984Z`);
  - an isolated-header benchmark from
    `/tmp/racing-frame-audit-isolated-latest.json`
    (`2026-06-18T06:29:00.640Z`);
  - the important measurement correction that RAF interval data is display
    cadence, not Aperture rendered-frame cadence.

## Latest Measurements

- Plain local server (`http://127.0.0.1:5181/`, SAB unavailable):
  - Aperture idle: avg `4.169 ms`, p95 `4.667 ms`, p99 `5.033 ms`, heap
    `43.74 MB`.
  - three.js idle: avg `4.167 ms`, p95 `4.667 ms`, p99 `5.067 ms`, heap
    `17.94 MB`.
  - Aperture drive: avg `4.178 ms`, p95 `4.733 ms`, p99 `5.167 ms`, heap
    `57.65 MB`.
  - three.js drive: avg `4.167 ms`, p95 `4.600 ms`, p99 `5.000 ms`, heap
    `17.70 MB`.
- Isolated-header Aperture server (`http://127.0.0.1:5186/`, SAB available
  during the measurement):
  - Aperture idle: avg `4.169 ms`, p95 `4.667 ms`, p99 `5.040 ms`, heap
    `50.00 MB`.
  - three.js idle: avg `4.167 ms`, p95 `4.700 ms`, p99 `5.067 ms`, heap
    `18.11 MB`.
  - Aperture drive: avg `4.182 ms`, p95 `4.697 ms`, p99 `5.082 ms`, heap
    `52.82 MB`.
  - three.js drive: avg `4.167 ms`, p95 `4.667 ms`, p99 `5.033 ms`, heap
    `18.33 MB`.
- Live diagnostics after rebuild:
  - main resolved draws remain `14` idle / `20` drive;
  - shadow casters remain `364` records grouped to `30` shadow draw calls;
  - post graph stays active under MSAA with scene + `12` bloom nodes + tonemap;
  - plain Python server reports `SharedArrayBuffer` unavailable;
  - isolated-header probe reports active SAB transport for eligible frames, but
    drive still carries particle packets that fall back per frame.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "creates a renderer-only app that consumes worker snapshots without ECS authoring APIs"`
- `pnpm exec vitest run test/rendering/snapshot-packed-encoding.test.ts test/app/audio-snapshot-transport.test.ts test/webgpu/app-snapshot-transport.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm exec prettier --check ...` on changed code/docs
- `git diff --check`

## Known Issues / Next Best Work

- The active goal is not achieved. Aperture is still not a consistent idle and
  drive win against the three.js reference.
- The benchmark's RAF interval table mostly measures display cadence. Add
  explicit submitted-render cadence, worker snapshot cadence, and render CPU
  phase distributions before using it as the primary pass/fail gate.
- Actual Aperture submitted render cadence is still around `60-70 Hz` in these
  runs, while three.js renders every RAF. The next real fix should define and
  implement the high-refresh simulation/render policy: fixed-step
  interpolation, render-on-display using latest snapshots, or a documented lower
  render cadence.
- Particle packets still force per-frame transferable snapshots in drive. A
  shared-codec path for particle batches, or a more compact worker particle
  representation, is a likely next transport win.
- Memory remains roughly 2-3x three.js.

---

# Handoff - Racing Render Batching Implementation

**Updated:** 2026-06-17 21:35 PDT

Implemented the user-requested `docs/RACING_RENDER_BATCHING_PLAN.md` goal.

## Latest Completed Slice

- Added shared render-phase batching-key/run utilities in
  `packages/webgpu/src/render/phase/render-phase-batching.ts`.
- Implemented shadow caster instancing:
  - shadow caster draw records preserve submesh vertex/index ranges;
  - alpha-blend and alpha-test casters are excluded from the first depth-only
    slice;
  - baked caster matrices are consumed in grouped draw order;
  - compatible shadow records coalesce into grouped indexed draws.
- Implemented main-pass draw-order transform packing:
  - eligible opaque rigid draws use a separate draw-order transform buffer;
  - extraction-order snapshot transforms remain untouched for picking,
    previous-transform history, and side buffers;
  - draw commands carry a draw-order transform resource key so group-1 bind
    group selection uses the correct buffer.
- Folded main and shadow compatibility checks through the shared render-phase
  key model, including resolved pipeline key, material identity, mesh/layout,
  ranges, layer/receive-shadow state, cull/bind/buffer state where applicable,
  and negative-scale winding for main-pass rigid draws.
- Hardened FPS smoke scripts:
  - default port changed from occupied `5173` to `5182`;
  - `fps.state` reads now wait for the generated resource and can fall back to
    browser worker-summary resources when MCP `resource_get` is stale.
- Updated the public tracker pages:
  - `docs/index.html` now records the Racing batching proof and final FPS smoke
    validation;
  - `docs/render-pipeline-comparison.html` now describes the draw-order
    transform packing and grouped shadow submit paths.

## Validation

- `pnpm exec vitest run test/webgpu/shadow-caster-draw-list-plan.test.ts test/webgpu/shadow-caster-frame-resource-readiness.test.ts test/webgpu/shadow-caster-command-record-plan.test.ts test/webgpu/draw-order-transform-packing.test.ts test/webgpu/render-pass-draw-list.test.ts test/webgpu/render-pass-commands.test.ts test/webgpu/render-frame-plan.test.ts test/webgpu/app-diagnostics-summary.test.ts`
  - 8 files, 82 tests passed.
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Racing managed browser validation at `http://127.0.0.1:5181/`:
  - WebGPU OK, frame diagnostics `0`;
  - main packages/descriptors/drawList/resolved `36 / 36 / 14 / 14`;
  - main swapchain draw calls `12`;
  - shadow raw caster records `364`, grouped submitted shadow draw calls `30`;
  - screenshot saved at `/tmp/aperture-racing-batching-validation.png`.
- FPS smoke:
  - `pnpm --dir fps run smoke:full-clear`
  - `pnpm --dir fps run smoke:mechanics`
  - `pnpm --dir fps run smoke:skybox-readback`
- Tracker and formatting:
  - `pnpm run check:progress`
  - `pnpm exec prettier --check docs/index.html docs/render-pipeline-comparison.html docs/RACING_RENDER_BATCHING_PLAN.md docs/RACING_THREEJS_FRAME_TIME_AUDIT.md docs/FPS_STARTER_AUDIT_FIX_PLAN.md agent/HANDOFF.md packages/webgpu/src/render/phase/render-phase-batching.ts packages/webgpu/src/render/frame/draw-order-transform-packing.ts packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts test/webgpu/draw-order-transform-packing.test.ts fps/scripts/full-clear-smoke.mjs fps/scripts/mechanics-smoke.mjs fps/scripts/skybox-readback-smoke.mjs`
  - `git diff --check`

## Known Issues

- The broader Racing particle pooling issue from
  `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` remains separate; this slice fixes
  rigid mesh/shadow draw batching, not smoke particle burst pooling.
- Pre-existing untracked screenshot/parity artifacts remain outside this slice.
- Port `5173` is currently occupied by an unrelated
  `/private/tmp/aperture-platformer` Vite process; FPS smoke now defaults to
  `5182`.

## Recommended Next Task

Address the Racing particle pooling item from
`docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`: coalesce smoke bursts by
effect/material into pooled GPU buffers rather than one draw unit per burst.

---

# Handoff - Racing Three.js Frame-Time Audit Doc

**Updated:** 2026-06-17 20:32 PDT

User asked to preserve the recovered Racing vs three.js performance report as a
Markdown document.

## Latest Completed Slice

- Added `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md`.
- Captured the original frame-time measurements, Aperture-specific findings,
  high-DPR sizing bug, heap/task-duration observations, and six-item recommended
  fix order.
- Linked the mesh/shadow batching portion to
  `docs/RACING_RENDER_BATCHING_PLAN.md` while keeping particle pooling and other
  non-instancing work separate.

## Validation

- `pnpm exec prettier --check docs/RACING_THREEJS_FRAME_TIME_AUDIT.md agent/HANDOFF.md`
- `git diff --check`

## Known Issues

- This was documentation only; no fixes are implemented by the new audit note.
- Pre-existing untracked screenshot/parity artifacts remain outside this slice.

## Recommended Next Task

Start with `docs/RACING_THREEJS_FRAME_TIME_AUDIT.md` item 1 if prioritizing the
drive/smoke frame-time regression, or `docs/RACING_RENDER_BATCHING_PLAN.md`
slice 1 if prioritizing idle/shadow draw-call reduction.

---

# Handoff - Racing Render Batching Plan

**Updated:** 2026-06-17 20:20 PDT

User-directed research follow-up documented the corrected Racing batching plan.

## Latest Completed Slice

- Added `docs/RACING_RENDER_BATCHING_PLAN.md`, capturing the corrected
  shadow-first sequencing for Racing draw-call reduction.
- Reframed the fix around draw-order instance packing: the existing main-pass
  coalescer already emits grouped `instanceCount` records, but compatible draws
  miss because transform offsets remain in extraction order.
- Documented that no shader change is needed for rigid grouped instances because
  `firstInstance + @builtin(instance_index)` already indexes distinct transform
  matrices.
- Reverified the surrounding resource-leak context and added notes to
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`:
  - current shadow baked-caster matrices are cached/reused and destroyed on size
    mismatch, so there is no open baked-matrix leak to couple to batching;
  - particle emitter state buffers are destroyed on stale eviction and have
    existing test coverage.

## Validation

- Source inspection of:
  - `packages/webgpu/src/shadows/render-shadow-frame.ts`
  - `packages/webgpu/src/app/particles.ts`
  - `test/webgpu/particle-frame-resources.test.ts`
  - `packages/webgpu/src/render/passes/render-pass-draw-list.ts`
  - `packages/webgpu/src/render/frame/render-frame-plan.ts`
- No code tests were run; this was a documentation and source-verification
  slice.

## Known Issues

- The batching/instancing fix is not implemented yet.
- Pre-existing untracked screenshot/parity artifacts remain outside this slice.

## Recommended Next Task

Implement `docs/RACING_RENDER_BATCHING_PLAN.md` slice 1: shadow caster
instancing through grouped baked-caster matrix order, submesh/index-range
threading, and conservative rigid opaque eligibility.

---

# Handoff - FPS Audit Batch 3 Diagnostics And Particle Report Fix

**Updated:** 2026-06-17 17:55 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 3 item 3 from
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Split shadow-caster extraction diagnostics into a pass-local array and merged
  only unique diagnostics into the snapshot report, preventing duplicate
  primary mesh/material authoring diagnostics while preserving shadow-only
  diagnostics.
- Changed particle frame reporting to snapshot texture/sampler reuse counters
  at entry and report only the per-call delta. The shared app-wide reuse object
  still accumulates normally.
- Added focused coverage for duplicate mesh diagnostics under a shadow pass and
  for particle reports with pre-seeded app-wide reuse counters.
- Marked all planned confirmed-finding batches implemented in the audit plan.

## Validation

- `pnpm exec vitest run test/rendering/extraction.test.ts test/webgpu/particle-frame-resources.test.ts`
- `pnpm exec vitest run test/rendering/extraction.test.ts test/webgpu/particle-frame-resources.test.ts test/rendering/particle-emitter-extraction.test.ts test/app/particle-spawn.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm exec prettier --check packages/render/src/rendering/extraction.ts packages/webgpu/src/app/particles.ts test/rendering/extraction.test.ts test/webgpu/particle-frame-resources.test.ts`
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions were started for this slice.

## Recommended Next Task

Review the accumulated branch diff as a whole, then decide whether to continue
with deferred low-severity cleanup or prepare this branch for review.

---

# Handoff - FPS Audit Batch 3 Particle Auto-Bounds Fix

**Updated:** 2026-06-17 17:50 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 3 item 2 from
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Aligned continuous particle auto-bounds with the current GPU compute shader:
  `startSpeed.max` is the spawn spread radius, gravity and lifetime no longer
  inflate spatial bounds for continuous emitters, and the shader's `0.18`
  vertical drift term is included.
- Tightened billboard expansion to the quad half-diagonal (`Math.SQRT1_2`)
  instead of full particle size. This also tightens automatic burst bounds while
  remaining conservative for the rendered billboard corners.
- Updated extraction and app particle tests to assert the shader-matched
  continuous and burst bound radii.
- Marked Batch 3 item 2 implemented in the audit plan; Batch 3 item 3 remains
  pending.

## Validation

- `pnpm exec vitest run test/rendering/particle-emitter-extraction.test.ts`
- `pnpm exec vitest run test/rendering/particle-emitter-extraction.test.ts test/rendering/particle-burst-queue.test.ts test/app/particle-spawn.test.ts test/webgpu/particle-frame-resources.test.ts test/webgpu/particle-pipeline.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm exec prettier --check packages/render/src/rendering/extraction-particles.ts test/rendering/particle-emitter-extraction.test.ts test/app/particle-spawn.test.ts`
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions were started for this slice.

## Recommended Next Task

Continue Batch 3 with diagnostic double-counting/report inflation in
`packages/render/src/rendering/extraction-meshes.ts` and
`packages/webgpu/src/app/particles.ts`.

---

# Handoff - FPS Audit Batch 3 Trail Bounds And Upload Fix

**Updated:** 2026-06-17 17:43 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 3 item 1 from
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Changed ground ribbon trails to publish only active vertex/index ranges
  instead of the full max-capacity buffers on every flush.
- Replaced monotonic trail bounds with bounds recomputed from the active
  ring-buffer window, so wrapped trails can shrink after old samples are
  overwritten.
- Preserved render validity for empty trail meshes by publishing one unused
  zeroed vertex with a zero-count submesh and no index buffer; this avoids
  zero-byte WebGPU buffer creation while still drawing nothing.
- Added focused trail tests for empty mesh upload shape, active upload sizing,
  wrapped bounds shrinkage, and large-trail `uint32` index selection.
- Marked Batch 3 item 1 implemented in the audit plan; Batch 3 items 2 and 3
  remain pending.

## Validation

- `pnpm exec vitest run test/app/trails.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm exec prettier --check packages/app/src/systems/trails.ts test/app/trails.test.ts`
- `git diff --check`
- Managed Racing smoke through Aperture CLI:
  - fresh `pnpm --dir racing exec aperture dev up --headless --host 127.0.0.1 --port 5173 --strict-port`
  - `browser_wait_for_webgpu` succeeded
  - initial render diagnostics: `frameOk: true`, `drawPackages: 36`, `drawCalls: 46`, `diagnostics: 0`
  - after holding `KeyW` + `KeyD` for 3 seconds: vehicle `hadInput: true`, frame report included `mesh:racing.driftMarks.bl` and `mesh:racing.driftMarks.br`, `meshDraws: 41`, `drawCalls: 53`, `diagnostics: 0`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- The managed Racing dev session was stopped after validation.

## Recommended Next Task

Continue Batch 3 with continuous particle auto-bounds parity in
`packages/render/src/rendering/extraction-particles.ts`.

---

# Handoff - FPS Audit Batch 2 Bloom And Visual Baselines

**Updated:** 2026-06-17 17:29 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 2 items 0 and 1 from
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Matched the three.js `UnrealBloomPass`/`BloomNode` blur sizing model by
  supplying a per-mip `invSize` uniform based on the blur pass output target,
  not the sampled input texture.
- Cached one tiny bloom blur parameter buffer per mip level inside the bloom
  effect, updating it only when that mip's dimensions change instead of baking
  dimensions into pipeline keys.
- Added diagnostics for devices that cannot create or upload bloom blur
  parameter buffers.
- Added focused post-pass coverage for the per-mip blur texel sizes and for the
  intentional BloomNode-style default threshold of `0`.
- Strengthened the standard shader test covering cascaded shadows plus IBL so
  ambient/diffuse/specular indirect terms are not shadow-attenuated.
- Marked Batch 2 complete in the audit plan; Batch 3 remains pending.

## Validation

- `pnpm exec vitest run test/webgpu/post-pass.test.ts`
- `pnpm exec vitest run test/webgpu/post-pass.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm exec prettier --check packages/webgpu/src/post/post-pass.ts packages/webgpu/src/post/post-bloom.ts test/webgpu/post-pass.test.ts test/webgpu/standard-shader.test.ts`
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions were started for this slice.

## Recommended Next Task

Continue Batch 3 with trail bounds shrinkage and active-range upload behavior.
Validate Racing after that slice because the trail path is visible there.

---

# Handoff - FPS Audit Batch 2 Sprite Depth Fix

**Updated:** 2026-06-17 17:22 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 2 item 3 from `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Routed the sprite-only WebGPU frame path through
  `prepareSpriteFrameResourcesForSnapshot`, so mesh-less sprite frames use the
  same per-depth-mode pipeline selection as mixed render paths.
- Added `depthMode` to legacy `SpriteDrawPacket` and extraction output, then
  preserved that field when packing legacy sprite draw data.
- Exposed sprite frame resource helpers through the WebGPU test-support barrel.
- Added a focused mesh-less legacy sprite resource test proving default and
  `depthMode: "disabled"` sprites create/select distinct depth-tested and
  depth-disabled pipelines.
- Marked Batch 2 item 3 implemented in the audit plan; Batch 2 items 0 and 1
  remain pending.

## Validation

- `pnpm exec vitest run test/webgpu/sprite-frame-resources.test.ts`
- `pnpm exec vitest run test/webgpu/sprite-pipeline.test.ts test/rendering/extraction.test.ts`
- `pnpm exec vitest run test/webgpu/sprite-frame-resources.test.ts test/webgpu/sprite-pipeline.test.ts test/rendering/extraction.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm exec prettier --check packages/render/src/rendering/snapshot-packet-types.ts packages/render/src/rendering/extraction-sprites.ts packages/webgpu/src/app/sprites.ts packages/webgpu/src/app/sprite-frame.ts packages/webgpu/src/test-support.ts test/webgpu/sprite-frame-resources.test.ts`
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions were started for this slice.

## Recommended Next Task

Continue Batch 2 with visual baseline protection or bloom mip texel sizing.
Keep the bloom radius fix separate from intentional threshold/golden baseline
changes.

---

# Handoff - FPS Audit Batch 2 Vite Worker HMR Fix

**Updated:** 2026-06-17 17:14 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 2 item 2 from `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Added system graph HMR handling in the Vite plugin: config/system add,
  change, and unlink events now rewrite `.aperture/generated/aperture-worker-entry.js`
  and invalidate Aperture virtual modules.
- Exposed internal system-glob parse/match helpers and the generated worker
  entry writer/path for the HMR path.
- Added focused Vite plugin tests proving worker entry contents update after
  adding and removing `*.system.ts` files, and unrelated file changes are
  ignored.
- Marked Batch 2 item 2 implemented in the audit plan; Batch 2 items 0, 1, and
  3 remain pending.

## Validation

- `pnpm exec vitest run test/vite-plugin/system-graph-hmr.test.ts`
- `pnpm --filter @aperture-engine/vite-plugin run typecheck`
- `pnpm --filter @aperture-engine/vite-plugin run build`
- `pnpm exec prettier --check packages/vite-plugin/src/index.ts packages/vite-plugin/src/system-discovery.ts packages/vite-plugin/src/system-graph-hmr.ts packages/vite-plugin/src/virtual-modules.ts test/vite-plugin/system-graph-hmr.test.ts`
- `git diff --check`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions were started for this slice.

## Recommended Next Task

Continue Batch 2 with sprite-only depth mode or bloom mip texel sizing. Keep
visual baseline protection explicit when opening bloom or lighting files.

---

# Handoff - FPS Audit Batch 2 Render Interpolation Fixes

**Updated:** 2026-06-17 17:09 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 2 item 6 from `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Replaced per-packet `new Set()` cycle-guard allocation in render snapshot
  interpolation with reusable affected/matrix visiting sets scoped to one
  interpolation pass.
- Added direct characterization tests for the zero-interpolated-entity fast
  path, parent-chain interpolation, cyclic parent guards, and camera
  view/view-projection matrix rewriting.
- Kept existing fixed-step integration coverage green for mesh, camera, bounds,
  and shadow-caster interpolation.
- Marked Batch 2 item 6 implemented in the audit plan; Batch 2 items 0-3
  remain pending.

## Validation

- `pnpm exec vitest run test/app/render-interpolation.test.ts test/app/fixed-step-app.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm exec prettier --check packages/app/src/render-interpolation.ts test/app/render-interpolation.test.ts`
- `git diff --check`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- Managed Racing through Aperture CLI:
  - `pnpm --dir racing exec aperture dev up --headless --host 127.0.0.1 --port 5173 --strict-port`
  - `browser_wait_for_webgpu`: `webgpuOk:true`, no `lastError`/`lastFailure`
    in the managed status.
  - Static frame report: `frameOk:true`, diagnostics `0`, `meshDraws:36`,
    `shadowCasterDraws:364`, swapchain `drawCalls:33`.
  - Moving smoke after `drive` input: frame report `frameOk:true`,
    diagnostics `0`, `meshDraws:37`, `shadowCasterDraws:364`,
    `particleEmitters:306`, `drawCalls:350`.
  - Input was reset and the managed Racing session was stopped with
    `pnpm --dir racing exec aperture dev down`.

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions are expected to remain from this slice.

## Recommended Next Task

Continue Batch 2 with Vite worker-entry HMR staleness or sprite-only depth mode.
Keep bloom/golden baseline work separate so the intentional visual changes do
not get mixed with infrastructure fixes.

---

# Handoff - FPS Audit Batch 2 Particle Runtime Fixes

**Updated:** 2026-06-17 17:01 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented the Batch 2 particle items from
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Cached worker asset-summary particle runtime feature analysis by
  `SystemParticleEffectAssetHandle`, invalidating only when the descriptor
  object changes.
- Updated particle burst queue TTL to scale by `request.timeScale`, so
  slow-motion bursts remain active longer and faster-time bursts expire sooner.
- Added focused tests covering runtime-feature cache reuse/invalidation and
  slow/fast burst TTL behavior.
- Marked Batch 2 items 4 and 5 implemented in the audit plan; the rest of
  Batch 2 remains pending.

## Validation

- `pnpm exec vitest run test/rendering/particle-burst-queue.test.ts test/app/worker-asset-summary.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm exec prettier --check packages/app/src/worker/assets.ts packages/render/src/rendering/particle-burst-queue.ts test/rendering/particle-burst-queue.test.ts test/app/worker-asset-summary.test.ts`
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` was not rerun for this slice because it is already
  documented as failing on unrelated existing test typing drift.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- No managed browser sessions are expected to remain from this slice.

## Recommended Next Task

Continue Batch 2 with the render-interpolation characterization/allocation fix
or the Vite worker-entry HMR staleness fix. Keep the remaining visual work
separate from the already-protected Batch 2 particle changes.

---

# Handoff - FPS Audit Batch 1 Resource Lifecycle Fixes

**Updated:** 2026-06-17 17:02 PDT

User-directed work is on branch `fix/audit-resource-lifecycle`.

## Latest Completed Slice

- Implemented Batch 1 from `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`.
- Cached directional baked caster matrix buffers and baked caster bind groups
  across frames, with buffer destruction and bind-group invalidation when baked
  matrix byte size changes.
- Added a size guard for cached receiver shadow matrix buffers. Count/byte-size
  changes now destroy and recreate the buffer instead of writing new data into
  the wrong-sized allocation, and the stale caster bind group is invalidated.
- Destroyed particle emitter GPU state buffers when inactive particle states are
  evicted from the WebGPU app resource cache.
- Fixed partial audio lowpass patches so q-only automation preserves the
  authored frequency and frequency-only automation preserves the authored q.
- Fixed Aperture CLI `input_reset` to release left, middle, and right synthetic
  mouse buttons before forwarding the runtime reset.
- Marked Batch 1 implemented in
  `docs/FPS_STARTER_AUDIT_FIX_PLAN.md`; Batches 2 and 3 remain pending.

## Validation

- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/shadow-matrix-buffer-resource.test.ts test/webgpu/particle-frame-resources.test.ts test/app/audio-access.test.ts test/cli/input-tools.test.ts`
  - 5 files, 21 tests passed.
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed FPS at `http://127.0.0.1:5173/`:
  - `browser_wait_for_webgpu`: `webgpuOk:true`, no `lastError` or
    `lastFailure`;
  - canvas status: swapchain render target `ok:true`, draw calls present,
    render diagnostics `[]`;
  - render diagnostics: frame `ok:true`, diagnostics `0`, auto-shadow
    submission `submitted`, shadow diagnostics `[]`;
  - `input_reset` returned primary/secondary/middle pointer state unpressed.
- Managed Racing at `http://127.0.0.1:5173/`:
  - `browser_wait_for_webgpu`: `webgpuOk:true`, no `lastError` or
    `lastFailure`;
  - canvas status: swapchain render target `ok:true`, `drawCalls:33`, render
    diagnostics `[]`;
  - render diagnostics: frame `ok:true`, diagnostics `0`, `meshDraws:36`,
    `shadowCasterDraws:364`, auto-shadow submission `submitted`, shadow
    diagnostics `[]`;
  - serial `input_reset` cleared `drive` to `[0,0]` and all pointer buttons to
    unpressed.
- `pnpm exec prettier --check` on touched files
- `git diff --check`

## Known Issues

- `pnpm run typecheck:test` still fails on unrelated existing test typing drift
  outside this Batch 1 slice, including stale generated-worker snapshot helper
  types, partial `AperturePage` test fakes, missing `occlusionQuery` in a
  packed snapshot test fixture, and missing `shadowCasterDraws` in renderer
  assembly test inspection counts.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- Managed FPS and Racing sessions were stopped after validation.

## Recommended Next Task

Continue `docs/FPS_STARTER_AUDIT_FIX_PLAN.md` with Batch 2: protect intentional
visual baselines, fix bloom mip texel sizing, Vite worker HMR staleness,
sprite-only depth mode, particle burst TTL time scale, particle runtime feature
analysis caching, and render-interpolation characterization/allocation cleanup.

---

# Handoff - Racing Shadow Interpolation Lag Fix

**Updated:** 2026-06-17 15:46 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Fixed a Racing regression where the car shadow and the shadow cast by the car
  lagged behind the visible car during fixed-step interpolation.
- Root cause: the presentation-only interpolation passes rewrote
  `snapshot.meshDraws` transforms, sprites, particles, and camera views, but did
  not rewrite independently extracted `snapshot.shadowCasterDraws`. Shadow
  fitting also reads `snapshot.bounds[draw.boundsIndex].worldAabb`, so stale
  shadow-caster bounds could still trail even after matrix interpolation.
- Added `snapshot-interpolation-bounds.ts` and wired both physics interpolation
  and app `RenderInterpolation` to rewrite packet bounds from each packet's
  local bounds plus the interpolated world matrix.
- Extended tests so app render interpolation and generated-worker physics
  interpolation assert visible mesh packets, shadow-caster packets, and both
  bounds entries share the interpolated pose.

## Validation

- `pnpm exec vitest run test/app/fixed-step-app.test.ts test/app/generated-worker-start.test.ts -t "interpolat"`
- `pnpm exec vitest run test/app/fixed-step-app.test.ts test/app/generated-worker-start.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm exec prettier --check packages/app/src/physics-interpolation.ts packages/app/src/render-interpolation.ts packages/app/src/snapshot-interpolation-bounds.ts test/app/fixed-step-app.test.ts test/app/generated-worker-start.test.ts`
- Managed Racing at `http://127.0.0.1:5173/`:
  - `browser_wait_for_webgpu`: `webgpuOk:true`, no `lastError` or
    `lastFailure`;
  - short `drive=[1,1]` smoke moved the vehicle with
    `linearSpeed:1.260`, `driftIntensity:0.798`, and render diagnostics `0`;
  - post-smoke frame diagnostics: `frameOk:true`, diagnostics `0`,
    shadow status `submitted`, shadow diagnostics `0`;
  - input was reset afterward.

## Known Issues

- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- Managed Racing remains running at `http://127.0.0.1:5173/`.

## Recommended Next Task

If the user is satisfied with Racing, continue with the previously recommended
engine backlog task `task-3097 — Replace placeholder PMREM with GGX/VNDF
prefilter sampling`; otherwise keep using managed Racing to inspect any
remaining shadow/camera feel issues.

---

# Handoff - FPS Completion Audit and Tool Client Hardening

**Updated:** 2026-06-17 15:12 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `d5126caf` (`Harden Aperture tool client for FPS audit`).
- Committed `f1334b20` (`Make FPS weapon compare free resize`).
- Committed `4c1e36c2` (`Cover FPS free resize layout`).
- Hardened the Aperture CLI browser-backed tool client:
  - retains the Playwright browser connection strongly for the page lifetime;
  - reuses a managed browser connection for repeated browser-backed tool calls
    in one process;
  - reconnects once if a cached page/context/browser has closed.
- Added source-scene parity coverage for all 11 Starter Kit FPS cloud
  transforms by parsing `references/Starter-Kit-FPS/scenes/main.tscn` and
  comparing cloud asset IDs, positions, and scales against `CLOUDS`.
- Kept the `?compare=weapon` three.js/Aperture visual probe aligned with the
  final FPS resize behavior: the Aperture and three.js panes now each fill half
  the viewport height instead of preserving a 16:9 box.
- Added a free-resize layout guard proving `fps/index.html` has no splash chrome
  or source-aspect box and the `?compare=weapon` panes stay full-height.
- Final FPS completion audit found no remaining required FPS port blocker:
  source player/weapon/enemy/HUD/audio constants are covered by focused tests,
  the source scene level/enemy/cloud transforms are source-anchored, the
  generated-input full-clear route clears all four enemies, and the live visual
  viewmodel caveat is closed by three.js comparison evidence plus user
  inspection acceptance.
- Committed `dae7ec2b` (`Remove FPS splash and viewport cap`).
- Committed `29712108` (`Make FPS canvas free resize`).
- Follow-up correction makes the playable shell/canvas fully free-resize to the
  browser viewport instead of preserving a 16:9 letterbox.
- Removed the FPS splashscreen DOM/CSS and the now-unused HUD boot-complete
  hook.
- Removed the source 1280x720 maximum size cap and the source-aspect sizing
  variables from `#game-shell`; source viewport constants remain documentation
  only and do not affect layout.
- Verified the live layout at `http://127.0.0.1:5173/` with Playwright:
  - 1600x900 viewport: shell/canvas `1600x900`;
  - 1000x900 viewport: shell/canvas `1000x900`;
  - 390x844 viewport: shell/canvas `390x844`;
  - `#boot-splash` count `0`.

## Validation

- `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts test/app/fps-hud.test.ts test/app/fps-audio.test.ts test/app/fps-effects.test.ts test/app/fps-setup.test.ts test/cli/tool-client.test.ts`
  - 8 files, 75 tests passed.
- `pnpm exec vitest run test/cli/tool-client.test.ts test/app/fps-data.test.ts`
  - 2 files, 14 tests passed after formatting.
- `pnpm exec vitest run test/app/fps-layout.test.ts test/app/fps-hud.test.ts test/app/fps-setup.test.ts`
  - 3 files, 18 tests passed.
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm exec prettier --check packages/cli/src/tools/browser.ts packages/cli/src/tools/client.ts test/cli/tool-client.test.ts test/app/fps-data.test.ts`
- `pnpm exec vitest run test/app/fps-hud.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm exec prettier --check fps/src/weapon-three-compare.ts test/app/fps-layout.test.ts`
- `git diff --check -- fps/src/weapon-three-compare.ts`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `git diff --check -- fps/index.html fps/src/lib/fps-hud.ts test/app/fps-hud.test.ts`
- `pnpm --dir fps exec aperture tool browser_canvas_status`
  - managed canvas/render target matched the managed viewport at `1920x1280`
    with aspect `1.5`; no 16:9 engine clamp.
- Playwright layout probe against `http://127.0.0.1:5173/`
  - normal route: `1000x900` viewport produced `1000x900` shell/canvas;
    `390x844` viewport produced `390x844` shell/canvas; `#boot-splash` count
    `0`;
  - `?compare=weapon`: `1000x900` viewport produced two `500x900` panes;
    `390x844` viewport produced two `195x844` panes.
- `pnpm --dir fps run smoke:full-clear -- --fresh-session --keep-running --verbose`
  - cleared all 4 enemies through managed Aperture CLI input;
  - final state: `health:60`, `shotsFired:8`, `hits:16`,
    `enemiesRemaining:0`, `destroyedEnemies:4`, `gameStatus:"cleared"`;
  - screenshot:
    `fps/.aperture/runtime/fps-full-clear-smoke.png`.
- `pnpm --dir fps run smoke:mechanics`
  - proved primary mouse shooting, middle mouse weapon switch, camera-relative
    W movement, and Space jumping through managed Aperture MCP/CLI.
- `pnpm --dir fps run smoke:skybox-readback`
  - proved one diagnostic-free source skybox, two render views, and the named
    source-facing color relationships.
- `pnpm --dir fps run smoke:full-clear`
  - fresh managed session cleared all 4 enemies with `health:60`,
    `shotsFired:8`, `hits:16`, `enemiesRemaining:0`, `destroyedEnemies:4`,
    `gameStatus:"cleared"`.
- Managed Aperture CLI regression checks:
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, frame diagnostics `0`,
    `views:1`, `meshDraws:36`, `shadowCasterDraws:364`, `drawCalls:46`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, render diagnostics `0`,
    shadow diagnostics `0`, shadow status `submitted`, `views:1`,
    `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`.
- `pnpm --dir fps exec aperture dev down`
- `pnpm --dir racing exec aperture dev down`
- `pnpm --dir shadow-lab exec aperture dev down`

## Known Issues

- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

The FPS port goal has enough current evidence to close. After closing it, resume
the normal engine backlog at `task-3097` unless the user asks for FPS polish.

---

# Handoff - FPS Pointer-Locked Input Proof

**Updated:** 2026-06-17 14:50 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `3e0130ed` (`Harden FPS pointer-locked input proof`).
- Fixed the FPS HUD bridge so source middle mouse weapon-toggle commands still
  dispatch while the canvas owns pointer lock.
- Fixed the Aperture CLI `input_pointer_click` tool for pointer-locked canvas
  sessions by dispatching canvas pointer/mouse events instead of relying on
  coordinate clicks that Chromium may not route under pointer lock.
- Extended `pnpm --dir fps run smoke:mechanics` to prove, through managed
  Aperture MCP/CLI:
  - primary mouse shooting increments `shotsFired`;
  - middle mouse switches weapons without firing;
  - W movement follows camera yaw;
  - Space produces a real jump.

## Validation

- `pnpm exec vitest run test/cli/input-tools.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-controls.test.ts`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir fps run smoke:mechanics -- --fresh-session`
  - `shoot {"before":0,"after":1}`
  - `middle-switch {"before":0,"after":1,"phase":"raising","shotsFired":0}`
  - `camera-relative-forward {"yaw":-1.56,"dx":1.099,"dz":-0.012}`
  - `jump {"verticalVelocity":7,"jumpsRemaining":1,"grounded":false}`
- `git diff --check`

## Known Issues

- `pnpm --dir fps run smoke:full-clear -- --fresh-session` reached the final
  northeast-platform traversal with three enemies destroyed, then the managed
  page/browser closed before the final enemy clear. Treat this as a remaining
  long-smoke/tool lifecycle issue, not a gameplay assertion failure.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- FPS viewmodel placement/material parity remains the main visible open FPS
  port decision.

## Recommended Next Task

Continue the final FPS viewmodel parity decision using the committed
`?compare=weapon` probe, or harden the long full-clear smoke lifecycle so the
route can finish without the managed browser closing near the final target.

---

# Handoff - FPS Weapon Three.js Compare Evidence

**Updated:** 2026-06-17 14:44 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Added a query-gated FPS weapon comparison harness at `?compare=weapon`.
- The harness reuses the Shadow Lab vendored three.js WebGPU reference renderer
  through dynamic imports so the normal FPS path does not eagerly load three.js.
- It renders `/models/blaster.glb` beside the live Aperture canvas with source,
  current Aperture, and centered weapon-position modes plus GLB/FrontSide/BackSide
  material-side modes.
- Evidence captured:
  - `/tmp/fps-weapon-three-compare.png`: three.js with the source weapon
    position renders the same filled yellow rear/stock shape, pointing away
    from a global Aperture culling bug.
  - `/tmp/fps-weapon-three-compare-current-pos.png`: the current calibrated
    Aperture weapon position is outside a vanilla three.js 40-degree weapon
    camera, so placement remains a viewmodel-calibration decision rather than
    source-literal transform parity.
- Normal FPS, racing, and Shadow Lab managed sessions were rechecked after the
  probe; all reported WebGPU ready, diagnostics `0`, and submitted directional
  shadows.

## Validation

- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-setup.test.ts`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- Plain Vite + Playwright probe for `http://127.0.0.1:5183/?compare=weapon`
  captured `/tmp/fps-weapon-three-compare.png` and
  `/tmp/fps-weapon-three-compare-current-pos.png`.
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, diagnostics `0`, counts
    `views:2`, `meshDraws:21`, `shadowCasterDraws:44`, `drawCalls:36`, shadow
    status `submitted`, shadow diagnostics `0`; screenshot
    `/tmp/fps-normal-after-weapon-compare.png`.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, diagnostics `0`, counts
    `views:1`, `meshDraws:36`, `shadowCasterDraws:364`, `drawCalls:46`, shadow
    status `submitted`, shadow diagnostics `0`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, diagnostics `0`, counts
    `views:1`, `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`, shadow
    status `submitted`, shadow diagnostics `0`.

## Known Issues

- The blaster rear/stock appearance appears to come from the source GLB as
  rendered by three.js, not from a renderer-wide Aperture inside-out/culling bug.
- The weapon placement is still not source-literal: source position renders in
  the three weapon camera, while the calibrated Aperture position tucks the gun
  lower-right for the FPS screenshot but is outside a vanilla source-aspect
  three.js weapon camera.
- The FPS Aperture CLI has no `browser_navigate` tool; direct CDP navigation of
  a managed session destabilized the FPS dev daemon. The compare URL was
  verified through a plain Vite server and Playwright instead.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- Additional unstaged FPS input/smoke/CLI changes are present in the worktree
  and were intentionally left out of this compare slice.

## Recommended Next Task

Decide the final FPS viewmodel strategy: keep the calibrated lower-right weapon
placement, or align more closely with the source SubViewport/camera transform.
Use `?compare=weapon` as the visual probe before changing material/culling code.

---

# Handoff - Strict Camera-Backed Shadow Fallback Guard

**Updated:** 2026-06-17 14:21 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `34b71d29` (`Guard camera shadow defaults from fixed fallback`).
- Tightened the default directional shadow assembly so camera-backed shadows do
  not forward fallback scene/fixed matrix options into matrix computation.
- This makes the Three.js-style fixed box physically unable to influence the
  out-of-box default. Fixed/static bounds remain explicit authored overrides or
  no-camera fallback behavior only.
- Added regression coverage proving a bogus fallback fixed matrix produces the
  same byte-for-byte matrix computation as the camera-only fit when a primary
  receiver camera exists.
- Revalidated FPS, racing, and Shadow Lab through managed Aperture tooling with
  submitted directional shadows and zero diagnostics.

## Validation

- `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts test/rendering/extraction.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: diagnostics `0`, shadow status
    `submitted`, `views:2`, `meshDraws:21`, `shadowCasterDraws:44`,
    `drawCalls:36`, screenshot `/tmp/fps-shadow-default-guard.png`.
  - Racing `http://127.0.0.1:5174/`: diagnostics `0`, shadow status
    `submitted`, `views:1`, `meshDraws:36`, `shadowCasterDraws:364`,
    `drawCalls:46`, screenshot `/tmp/racing-shadow-default-guard.png`.
  - Shadow Lab `http://127.0.0.1:5175/`: diagnostics `0`, shadow status
    `submitted`, `views:1`, `meshDraws:25`, `shadowCasterDraws:364`,
    `drawCalls:38`, screenshot `/tmp/shadow-lab-shadow-default-guard.png`.

## Known Issues

- The default directional shadow path is now guarded against fallback fixed-box
  leakage, overlay-camera selection, off-frustum caster drops, and
  off-footprint caster footprint expansion. Future quality work should move
  toward proper cascades/per-view shadows rather than reintroducing static scene
  boxes as defaults.
- FPS viewmodel rear/stock visual parity remains a separate issue; do not fix
  it by changing global culling/depth defaults without an isolated GLB/material
  comparison.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Continue FPS-visible source parity if the user prioritizes the gun artifact:
render the blaster side by side against source/three.js material state, then
change only the narrow winding/culling/material path that differs. For shadow
quality, the next renderer slice should be cascade/per-view shadow fit
hardening, not fixed scene boxes.

---

# Handoff - FPS Source Scene Parity Guard

**Updated:** 2026-06-17 14:17 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `926ac0be` (`Add FPS source scene parity guard`).
- Extended `test/app/fps-data.test.ts` with a small Godot `.tscn` parser that
  reads `references/Starter-Kit-FPS/scenes/main.tscn` at test time.
- The new coverage compares all 13 source level platform/wall entries against
  Aperture's typed `LEVEL_INSTANCES`, including asset ids, positions, and
  Y-axis rotations, and compares all 4 source enemy positions against
  `ENEMIES`.
- Re-ran the full Aperture MCP route smoke after the user's platform-reach
  concern. The generated route cleared all platform transfers, including the
  northeast double-jump path, and ended with `gameStatus:"cleared"`.

## Validation

- `pnpm --dir fps run smoke:full-clear -- --fresh-session`
  - Final state: `health:65`, `shotsFired:8`, `hits:16`,
    `destroyedEnemies:4`, `gameStatus:"cleared"`.
  - Screenshot:
    `fps/.aperture/runtime/fps-full-clear-smoke.png`.
- `pnpm exec vitest run test/app/fps-data.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `git diff --check -- test/app/fps-data.test.ts`

## Known Issues

- Platform/enemy scene placement now has executable source-scene parity
  coverage, and the full route can be cleared through Aperture MCP input.
  Collider-shape equivalence is still inferred from GLB primitive collider
  cooking rather than directly compared against Godot's concave polygon data.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.
- Existing tracked shadow fallback diffs are present in the worktree:
  `packages/webgpu/src/app/auto-shadow-frame.ts`,
  `packages/webgpu/src/shadows/render-shadow-frame.ts`, and
  `test/webgpu/shadows/render-shadow-frame.spec.ts`. They were not part of this
  FPS source-parity slice and were left unstaged.

## Recommended Next Task

Continue FPS-visible source parity. The strongest next slice is to directly
compare platform collider footprints/top surfaces against the source
`ConcavePolygonShape3D` data, then keep `smoke:full-clear` as the runtime guard.
If the visual issue is higher priority, return to the blaster rear/stock
artifact with a GLB/material/source weapon comparison.

---

# Handoff - FPS Mechanics Smoke Proof

**Updated:** 2026-06-17 14:02 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `c6a737f4` (`Add FPS mechanics smoke`).
- Added `fps/scripts/mechanics-smoke.mjs` and `pnpm --dir fps run smoke:mechanics`.
- The smoke uses the Aperture MCP stdio bridge and managed browser/session
  tools to prove the exact recent gameplay concerns:
  - primary browser left-click increments `shotsFired`;
  - yaw-relative forward input at -90 degrees moves the player along +X with
    negligible Z drift;
  - a browser `Space` tap produces upward velocity, consumes one jump, and
    leaves the player airborne.
- The script starts a fresh managed FPS session by default, pauses/steps the
  generated simulation deterministically, and cleans up the owned session.

## Validation

- `pnpm --dir fps run smoke:mechanics`
  - `shoot {"before":0,"after":1}`
  - `camera-relative-forward {"yaw":-1.56,"dx":1.099,"dz":-0.012}`
  - `jump {"verticalVelocity":7,"jumpsRemaining":1,"grounded":false}`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `git diff --check -- fps/package.json fps/scripts/mechanics-smoke.mjs`

## Known Issues

- The focused mechanics smoke proves the current input mechanics, but it does
  not compare every platform jump trajectory against the upstream Godot scene.
  Keep using `pnpm --dir fps run smoke:full-clear` for full route coverage.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Continue FPS-visible source parity. If the user still cannot reach a platform,
compare the target platform spacing/collider geometry against the source scene
using the new mechanics smoke plus the full-clear route as guardrails.

---

# Handoff - FPS Primary Shoot Coverage and Weapon Calibration Guard

**Updated:** 2026-06-17 13:54 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `145a95bb` (`Cover FPS primary mouse shooting`).
- Added focused input coverage proving the source primary mouse input maps to
  `shoot` and does not also trigger `switchWeapon`.
- Made the empty weapon-viewmodel material override readonly so the app keeps
  preserving the GLB material render state after the self-depth fix.
- Rechecked `references/Starter-Kit-FPS/objects/player.gd`: movement remains
  source-matched (`movement_speed = 5`, `jump_strength = 8`,
  `number_of_jumps = 2`) and the source has no sprint mechanic.
- Audited the pending source-literal weapon transform against prior decisions:
  `SOURCE_WEAPON_VIEW_POSITION` remains `[1.2, -1.1, -2.75]`, but the
  Aperture runtime must keep the calibrated `FPS_WEAPON_VIEW_POSITION`
  `[2.75, -1.2, -2.75]`. A live screenshot with the source-literal position
  (`/tmp/fps-source-weapon-position.png`) put the gun too near center; the
  restored calibration screenshot (`/tmp/fps-weapon-calibration-restored.png`)
  keeps it tucked into the lower-right corner.

## Validation

- `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-setup.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `git diff --check -- fps/src/lib/fps-data.ts fps/src/systems/setup.system.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts`
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, diagnostics `0`,
    `views:2`, `meshDraws:18`, `shadowCasterDraws:44`, `drawCalls:33`;
    screenshot `/tmp/fps-weapon-calibration-restored.png`.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, diagnostics `0`,
    `views:1`, `meshDraws:36`, `shadowCasterDraws:364`, `drawCalls:46`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, diagnostics `0`,
    `views:1`, `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`.

## Known Issues

- The platform-reach complaint is not explained by movement constants: they
  already match the source. If it persists, inspect collision/platform spacing
  and character-controller movement proof rather than adding a sprint mechanic.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Create a deterministic movement/jump reach proof for FPS using Aperture CLI
input/resource tools, then compare player trajectory against the source level
geometry if the user still cannot reach adjacent platforms.

---

# Handoff - FPS Weapon Self Depth and Shadow Default Audit

**Updated:** 2026-06-17 13:45 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `e189f61a` (`Preserve FPS weapon self depth`).
- Removed the FPS weapon viewmodel material override that made the GLB render
  with `depth.compare = "always"` and depth writes disabled.
- The weapon still renders through the source-style weapon camera/layer overlay,
  but it now preserves the source GLB material render state so the gun can
  self-occlude normally.
- Audited the default directional shadow path after the user clarified that a
  fixed three.js-style shadow camera box is not acceptable as the default:
  - Camera-backed app frames keep using camera/receiver/frustum auto-fit.
  - `matrix` scene-fit options passed by the app layer are fallback-only and do
    not suppress primary-camera frustum fit.
  - Fixed/static boxes are only explicit authored overrides
    (`orthographicSize > 0`) or no-camera fallback behavior.

## Validation

- `pnpm exec vitest run test/app/fps-setup.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm exec vitest run test/app/fps-setup.test.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts test/rendering/extraction.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir racing run typecheck`
- `git diff --check -- fps/src/systems/setup.system.ts test/app/fps-setup.test.ts`
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, diagnostics `0`,
    `views:2`, `meshDraws:21`, `shadowCasterDraws:44`, `drawCalls:36`;
    screenshot `/tmp/fps-weapon-depth-restored.png`.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, diagnostics `0`,
    `views:1`, `meshDraws:36`, `shadowCasterDraws:364`, `drawCalls:46`;
    screenshot `/tmp/racing-after-weapon-depth.png`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, diagnostics `0`,
    `views:1`, `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`;
    screenshot `/tmp/shadow-lab-after-weapon-depth.png`.

## Known Issues

- Default directional shadow behavior must remain camera/receiver auto-fit.
  Fixed/static boxes are not an acceptable out-of-the-box solution; future
  improvements should move toward cascades/per-view shadows rather than
  reintroducing static scene boxes as the default.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Let the user inspect FPS at `http://127.0.0.1:5173/`. If any gun parity issue
remains, compare the blaster against the source GLB/Godot setup and a three.js
render in isolation before changing engine material behavior.

---

# Handoff - Receiver-Aware Shadow Camera Default

**Updated:** 2026-06-17 13:30 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `e72fa6f3` (`Select receiver camera for shadow auto-fit`).
- Kept the default directional shadow solution camera/receiver/frustum based:
  - The selector now filters to default-target views and prefers a view whose
    layer mask overlaps visible standard shadow receivers.
  - Overlay/HUD/viewmodel cameras can no longer accidentally own the automatic
    shadow footprint when a world receiver camera is present.
  - Fixed/static bounds remain explicit authored overrides or no-camera fallback
    behavior only.
- Added a regression test where an overlay camera sorts before the world camera;
  the shadow fit still uses the world receiver camera.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html`, then
  ran the tracker checker.

## Validation

- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts test/rendering/extraction.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm run check:progress`
- `git diff --check -- packages/webgpu/src/shadows/render-shadow-frame.ts test/webgpu/app-auto-shadow-frame.test.ts docs/index.html docs/render-pipeline-comparison.html`
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, diagnostics `0`, shadow
    status `submitted`, `views:2`, `meshDraws:21`,
    `shadowCasterDraws:44`, `drawCalls:36`; screenshot
    `/tmp/fps-shadow-camera-selector.png`; sampled pixels nonblack.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, diagnostics `0`, shadow
    status `submitted`, `views:1`, `meshDraws:36`,
    `shadowCasterDraws:364`, `drawCalls:46`; screenshot
    `/tmp/racing-shadow-camera-selector.png`; sampled pixels nonblack.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, diagnostics `0`,
    shadow status `submitted`, `views:1`, `meshDraws:25`,
    `shadowCasterDraws:364`, `drawCalls:38`; screenshot
    `/tmp/shadow-lab-shadow-camera-selector.png`; sampled pixels nonblack.

## Known Issues

- FPS viewmodel rear/stock still shows the user-reported artifact. Commit
  `7465fe16` fixed authored front-face pipeline state, but the current blaster
  material still resolves through the default CCW, double-sided path.
- The default shadow path is now guarded against static-box defaults,
  off-footprint caster footprint expansion, main-frustum shadow-caster drops,
  and overlay-camera selection. Future work should continue toward proper
  cascades/per-view shadows rather than reintroducing static scene boxes as the
  default.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Continue the user-directed FPS viewmodel parity stream. The next focused slice
is to diagnose the remaining blaster rear/stock artifact against GLB material
data, winding/front-face state, and source Godot weapon/camera setup, without
changing the shadow default or regressing racing/shadow-lab.

---

# Handoff - FPS Source Input Fidelity

**Updated:** 2026-06-17 13:21 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `966186a5` (`Improve FPS input command fidelity`).
- Preserved raw pointer-lock look deltas through the FPS command channel:
  - The generated `mouseLook` action still receives clamped values for normal
    input summary compatibility.
  - The FPS system now consumes unclamped `look` commands when available, so
    source mouse motion can exceed the generated axis range.
- Added a short player-system jump tap grace window so quick command taps
  survive slow worker frames.
- Brought the remaining pointer-binding validation test in line with the
  committed multi-button pointer input behavior.

## Validation

- `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/input-pointer-binding-validation.test.ts`
- `pnpm --dir fps run typecheck`
- `git diff --check -- fps/src/hud.ts fps/src/lib/fps-data.ts fps/src/lib/fps-hud.ts fps/src/systems/player.system.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-hud.test.ts test/app/input-pointer-binding-validation.test.ts`
- Managed Aperture CLI proof:
  - `pnpm --dir fps exec aperture dev status` shows the FPS dev session running
    at `http://127.0.0.1:5173/`.
  - `browser_status` reported WebGPU ready and no app failure.
  - `render_get_diagnostics` reported diagnostics `0`, `views:2`,
    `meshDraws:21`, `shadowCasterDraws:44`, `drawCalls:36`, and the
    `auto-shadow` command buffer submitted.

## Known Issues

- FPS viewmodel rear/stock still shows the user-reported artifact in the
  screenshot. Commit `7465fe16` fixed authored front-face pipeline state, but
  the current blaster material still resolves through the default CCW,
  double-sided path.
- The shadow default must remain camera/receiver auto-fit. Fixed/static bounds
  are acceptable only as explicit authored overrides or no-camera fallback, not
  as an out-of-box solution.
- Pre-existing untracked screenshot/parity artifacts remain outside commits.

## Recommended Next Task

Continue the user-directed shadow/default and FPS viewmodel parity stream. The
next focused slice is to replace any remaining fixed-box thinking in the
directional shadow default with a robust camera/receiver fit plus independent
shadow-caster extraction, then validate FPS, racing, and shadow-lab through
Aperture CLI.

---

# Handoff - Shadow Auto-Fit Default Guard

**Updated:** 2026-06-17 13:16 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `c4bcca20` (`Guard shadow fit against off-footprint casters`).
- Added a matrix-level regression test proving the out-of-box directional
  shadow default does not behave like a static Three-style fixed box:
  - Camera/frustum fit owns the in-plane orthographic footprint.
  - A caster far outside that footprint does not change center, ortho size,
    near/far, or light position.
  - The existing in-plane caster test still proves overlapping casters can
    expand depth only, preserving correct shadow reach without softening the
    map footprint.
- This reinforces the intended default: camera/receiver auto-fit first,
  independent shadow-caster extraction for the shadow pass, fixed/static bounds
  only for explicit authored settings or no-camera fallback.

## Validation

- `pnpm exec vitest run test/webgpu/directional-shadow-matrix-computation.test.ts test/webgpu/app-auto-shadow-frame.test.ts`
- `git diff --check -- test/webgpu/directional-shadow-matrix-computation.test.ts`
- Prior same-run managed Aperture regression proof remains valid after no
  runtime code changes:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, diagnostics `0`,
    `shadowDiagnostics:[]`, screenshot `/tmp/fps-frontface-check.png`.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, diagnostics `0`,
    `shadowDiagnostics:[]`, screenshot `/tmp/racing-frontface-regression.png`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, diagnostics `0`,
    `shadowDiagnostics:[]`, screenshot
    `/tmp/shadow-lab-frontface-regression.png`.

## Known Issues

- FPS viewmodel rear/stock still shows the user-reported artifact in the
  screenshot. Commit `7465fe16` fixed authored front-face pipeline state, but
  the current blaster material still resolves through the default CCW,
  double-sided path.
- Local FPS/input edits are still unstaged and were intentionally left out of
  `7465fe16` and `c4bcca20`: `fps/src/hud.ts`, `fps/src/lib/fps-data.ts`,
  `fps/src/lib/fps-hud.ts`, `fps/src/systems/player.system.ts`, and related
  `test/app/*` files.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS/shadow parity stream. The next focused slice is
to diagnose the remaining FPS viewmodel rear-face artifact against the GLB
asset/material data and source Godot weapon/camera setup, without changing the
shadow auto-fit default or regressing racing/shadow-lab.

---

# Handoff - Material Front-Face Pipeline State

**Updated:** 2026-06-17 13:13 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Committed `7465fe16` (`Honor material front-face render state`).
- Fixed a built-in material pipeline-state bug found while investigating the
  FPS viewmodel "inside out" report:
  - `MaterialPipelineKeyInput.frontFace` now affects the pipeline key as
    `front-face:cw` for non-default CW materials; default CCW keys are
    unchanged.
  - WebGPU material render-state parsing resolves `frontFace` and exposes it in
    standard material render-state summaries.
  - Built-in standard, unlit, matcap, and debug-normal WebGPU pipelines now use
    the resolved material `frontFace` instead of hardcoding `ccw`.
  - Debug-normal descriptor validation treats `front-face:*` and `depth-bias:*`
    as render-state tokens rather than unsupported shader features.
- This does not replace the shadow default. Fixed directional shadow boxes
  remain only authored overrides/no-camera fallback; the default path is still
  camera/receiver auto-fit with independent shadow-caster extraction.

## Validation

- `pnpm exec vitest run test/materials/key-format-contract.test.ts test/webgpu/material-render-state.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/unlit-pipeline-descriptor.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `git diff --check -- <front-face slice files>`
- Managed Aperture CLI proof:
  - FPS `http://127.0.0.1:5173/`: WebGPU ready, screenshot
    `/tmp/fps-frontface-check.png`, `views:2`, `meshDraws:21`,
    `shadowCasterDraws:44`, `drawCalls:36`, diagnostics `0`,
    `shadowDiagnostics:[]`.
  - Racing `http://127.0.0.1:5174/`: WebGPU ready, screenshot
    `/tmp/racing-frontface-regression.png`, `views:1`, `meshDraws:36`,
    `shadowCasterDraws:364`, `drawCalls:46`, diagnostics `0`,
    `shadowDiagnostics:[]`.
  - Shadow Lab `http://127.0.0.1:5175/`: WebGPU ready, screenshot
    `/tmp/shadow-lab-frontface-regression.png`, `views:1`, `meshDraws:25`,
    `shadowCasterDraws:364`, `drawCalls:38`, diagnostics `0`,
    `shadowDiagnostics:[]`; Aperture/Three split remains visually aligned.

## Known Issues

- FPS viewmodel rear/stock still shows the user-reported artifact in the
  screenshot. The committed fix makes authored `frontFace` work correctly, but
  the current blaster material still resolves through the default CCW,
  double-sided path.
- Local FPS/input edits are still unstaged and were intentionally left out of
  `7465fe16`: `fps/src/hud.ts`, `fps/src/lib/fps-data.ts`,
  `fps/src/lib/fps-hud.ts`, `fps/src/systems/player.system.ts`, and related
  `test/app/*` files.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS/shadow parity stream. The next focused slice is
to diagnose the remaining FPS viewmodel rear-face artifact against the GLB
asset/material data and source Godot weapon/camera setup, without changing the
shadow auto-fit default or regressing racing/shadow-lab.

---

# Handoff - FPS Multi-Button Pointer Input

**Updated:** 2026-06-17 12:53 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Added engine-level multi-button pointer input:
  - `InputResourceBase.pointer` now models `primary`, `secondary`, and `middle`
    with shared position, pressed, and same-frame edge state.
  - Browser forwarding maps DOM button `0` to `primary`, `1` to `middle`, and
    `2` to `secondary`, while cancel/leave/lost-capture releases all modeled
    pointer buttons.
  - Config validation now accepts `input.pointer("secondary")` and
    `input.pointer("middle")` instead of rejecting them as undelivered.
  - Input summaries expose all three pointer button states for tools.
- Bound Starter Kit FPS `switchWeapon` to `input.pointer("middle")`, matching
  the source `weapon_toggle` mouse button mapping from
  `references/Starter-Kit-FPS/project.godot`.
- Adjusted the FPS HUD middle-mouse handler to prevent default browser
  aux-click behavior without synthesizing a duplicate `switchWeapon` action.
- Live Aperture CLI proof after rebuilding `@aperture-engine/app`:
  - FPS status reported WebGPU OK and `pointer.middle`/`pointer.secondary`
    in the worker input summary.
  - `input_pointer_click {"button":"middle"}` forwarded
    `lastInputEvent.pointer:"middle"` and switched from
    `weaponIndex:0` / `weaponName:"Blaster"` to
    `weaponIndex:1` / `weaponName:"Repeater"`.
  - A following left click still incremented `shotsFired` to `1`.
  - `pnpm --dir fps run smoke:full-clear` passed with `shotsFired:8`,
    `hits:16`, `destroyedEnemies:4`, `enemiesRemaining:0`, and
    `gameStatus:"cleared"`, covering jump traversal and camera-relative
    movement through the full route.

## Validation

- `pnpm exec vitest run test/app/input-state-events.test.ts test/app/browser-input-forwarding.test.ts test/app/config-validation.test.ts test/app/fps-input-config.test.ts test/app/fps-hud.test.ts test/cli/input-tools.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir fps run smoke:full-clear`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm run check:progress`
- `git diff --check`

## Known Issues

- Aperture MCP transport reported `Transport closed`; equivalent Aperture CLI
  tools were used successfully for live proof.
- Starter Kit FPS is running at `http://127.0.0.1:5173/` for user testing.
- A local unrelated change to `fps/src/lib/fps-data.ts` was present after
  validation and was intentionally left out of this commit because it appears to
  undo the prior calibrated weapon placement.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS parity stream. A good next visible slice is to
harden the source skybox orientation/readback with named direction samples,
using `references/Starter-Kit-FPS/scenes/main.tscn` as the source anchor.

---

# Handoff - FPS Keyboard Tap Reliability and Tool Session Stability

**Updated:** 2026-06-17 12:39 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Fixed Aperture CLI browser-backed tool calls so `aperture tool ...` no longer
  explicitly closes the managed Chrome CDP browser after every call:
  - One-shot CLI commands now flush stdout/stderr before process exit.
  - Browser-backed tools keep the CDP connection alive for the process lifetime,
    avoiding managed-session teardown during live validation.
- Split Starter Kit FPS HUD tap release timing:
  - Keyboard button releases now stay pressed for `160ms`, long enough for slow
    worker frames to observe quick Space taps.
  - Instant pointer/button releases remain `80ms`, below the fastest repeater
    cooldown, so click-shoot does not gain accidental extra shots.
- Live Aperture CLI proof after the fix:
  - Quick Space tap from the source start produced an airborne state
    (`grounded:false`, `playerY:1.07`) instead of being dropped.
  - Left click after reset incremented `shotsFired` from `0` to `1`.
  - After a virtual mouse-look pulse to yaw about `-3.31`, holding `KeyW` moved
    the player to approximately `x:-0.36, z:2.17`, proving yaw-relative forward
    movement on the current build.
  - `pnpm --dir fps run smoke:full-clear` passed with `shotsFired:8`,
    `hits:16`, `destroyedEnemies:4`, `enemiesRemaining:0`, and
    `gameStatus:"cleared"`.

## Validation

- `pnpm exec vitest run test/cli/tool-client.test.ts`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir fps run smoke:full-clear`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `git diff --check`

## Known Issues

- Starter Kit FPS is running at `http://127.0.0.1:5173/` for user testing.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS parity stream. A good next visible slice is
source middle-mouse weapon toggle through engine-level multi-button pointer
input, using `references/Starter-Kit-FPS/project.godot` as the source anchor.

---

# Handoff - Shadow Default Auto-Fit Correction

**Updated:** 2026-06-17 12:17 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Corrected the temporary directional-shadow scene-fit regression:
  - Camera-backed app frames again use primary-camera receiver/frustum fitting
    as the out-of-box default, preserving sharp shadow-map footprint coverage.
  - `shadowCasterDraws` remain extracted independently from visible
    `meshDraws`, so main-camera frustum culling does not remove a caster from
    the shadow pass.
  - Off-camera caster bounds still feed the shadow depth range when they can
    affect the fitted receiver footprint.
  - Fixed/static scene bounds are now documented as explicit authored settings
    or no-camera fallback behavior only.
- Research anchors checked:
  - Unity shadow-cascade docs, Unreal shadowing docs, and Microsoft CSM
    guidance all frame directional shadow quality around camera/cascade-relative
    coverage rather than one static whole-scene box.
  - `references/three.js/src/renderers/webgl/WebGLShadowMap.js` uses a
    shadow-camera pass for casters; three.js fixed orthographic settings are an
    authored control, not a good automatic default.
  - `references/engine/src/scene/renderer/shadow-renderer-directional.js`
    builds directional shadow cameras, culls against the shadow camera, and
    tightens depth from caster bounds.
  - `references/bevy/crates/bevy_render/src/view/visibility/mod.rs` keeps
    shadow-map visibility separate from normal render visibility.

## Validation

- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir racing run typecheck`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm run check:progress`
- Managed Aperture CLI proof:
  - Racing: WebGPU ready, screenshot
    `/tmp/racing-shadow-autofit-correction.png`, `meshDraws:36`,
    `shadowCasterDraws:364`, `drawCalls:46`, diagnostics `0`.
  - Shadow Lab: screenshot `/tmp/shadow-lab-autofit-correction.png`,
    `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`, diagnostics `0`,
    and the Aperture/Three.js split view remained visually aligned.
  - Starter Kit FPS: frame summary reported `views:2`, `meshDraws:21`,
    `shadowCasterDraws:44`, `drawCalls:36`, diagnostics `0`; filtered status
    reported `webgpuOk:true`, `playerY:0.97`, `grounded:true`, and no
    `lastError`/`lastFailure`; screenshot `/tmp/fps-autofit-correction.png`
    showed a nonblack scene with lit platforms/shadows.
  - `pnpm --dir fps run smoke:full-clear` passed through MCP with
    `shotsFired:8`, `hits:16`, `destroyedEnemies:4`, `enemiesRemaining:0`,
    and `gameStatus:"cleared"`, proving platform traversal after the shadow
    correction.

## Known Issues

- Starter Kit FPS is running at `http://127.0.0.1:5173/` for user testing.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Run managed Aperture validation for racing, Shadow Lab, and Starter Kit FPS,
then continue the user-directed FPS/shadow parity stream or return to
`task-3097` when the interruption is complete.

---

# Handoff - FPS Source Mesh Level Colliders

**Updated:** 2026-06-17 12:07 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Replaced Starter Kit FPS level box-collider approximations with source-facing
  asset-backed triangle mesh colliders:
  - FPS level collider data now references the imported GLB primitive mesh ids
    for `platform`, `platform-large-grass`, `wall-low`, and `wall-high`.
  - Generated app config validation now accepts
    `physics.colliderGeometry:{kind:"assets"}` and forwards it into
    `createApertureApp(...)`.
  - The render mesh spatial adapter now decodes byte-backed GLB vertex streams
    into typed numeric views before CPU spatial/physics geometry conversion, so
    Rapier cooks real static trimesh shapes instead of garbage byte values.
- Live Aperture CLI proof:
  - Fresh FPS dev session at `http://127.0.0.1:5173/`.
  - `physics_summary` reported Rapier simulation-worker physics with
    `bodyCount:18`, `colliderCount:18`, and `unsupportedFeatureCount:0`.
  - `browser_status` reported `grounded:true` at the source start state.
  - `physics_debug_summary {"colliderWireframes":true}` reported finite
    collider lines with bounds around the actual level
    `min:[-10.237,-0.5,-9.111]`, `max:[16.23,5.045,9.727]`.
  - Clean-session `pnpm --dir fps run smoke:full-clear` passed with
    `shotsFired:8`, `hits:16`, `destroyedEnemies:4`, `enemiesRemaining:0`, and
    `gameStatus:"cleared"`.

## Validation

- `pnpm exec vitest run test/app/physics-collider-geometry.test.ts test/app/spatial-queries.test.ts test/app/config-validation.test.ts test/app/generated-worker-start.test.ts test/app/fps-data.test.ts test/app/fps-setup.test.ts`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --dir fps run typecheck`
- `pnpm --filter @aperture-engine/render run build`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --dir fps run build`
- `pnpm --dir fps run smoke:full-clear`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`

## Known Issues

- Starter Kit FPS is intentionally still running at `http://127.0.0.1:5173/` for
  user testing.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS parity stream with another visible source-facing
slice, or return to the backlog's `task-3097` PMREM GGX/VNDF prefilter slice
when the FPS/shadow interruptions are complete.

---

# Handoff - Superseded Single-Cascade Shadow Scene Fit

**Updated:** 2026-06-17 12:01 PDT

User-directed work is on branch `fps-starter-kit-port`.

**Superseded:** the default scene-fit behavior described below was corrected by
the 2026-06-17 12:17 PDT shadow auto-fit slice because it made default shadows
too soft. The durable part of this slice is the independent
`shadowCasterDraws` extraction and shadow-pass caster submission.

## Latest Completed Slice

- Fixed the shadow regression where a platform could stop casting a shadow once
  the main render camera frustum-culled its visible mesh draw.
- Research anchors checked:
  - `references/three.js/src/renderers/webgl/WebGLShadowMap.js` culls shadow
    submissions against the shadow camera frustum, not the main visible list.
  - `references/engine/src/scene/renderer/shadow-renderer.js` and
    `references/engine/src/scene/renderer/shadow-renderer-directional.js` build
    a directional shadow camera, update that camera's frustum, then cull shadow
    casters for the shadow pass.
  - `references/bevy/crates/bevy_render/src/view/visibility/mod.rs` keeps
    `RenderShadowMapVisibleEntities` separate from normal render-visible
    entities; `references/bevy/crates/bevy_pbr/src/render/light.rs` consumes
    that shadow-visible set while queueing shadows.
- Root cause identified in this slice: the renderer already extracted
  `shadowCasterDraws` separately from visible `meshDraws`, but caster inclusion
  and shadow depth fitting still needed to consume that caster packet so
  main-view frustum culling could not remove shadow contribution.
- Superseded fix attempt: this slice disabled camera-frustum fitting for
  single-cascade shadows and routed them through broad scene-fit matrix options.
  That preserved off-camera casters but made default shadows too soft. The later
  12:17 PDT correction restores camera-backed receiver/frustum fitting as the
  default while keeping independent caster submission/depth expansion.

## Validation

- `pnpm exec vitest run test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/render run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Managed Aperture CLI proof:
  - Racing at `http://127.0.0.1:5173/`: WebGPU ready,
    `meshDraws:36`, `shadowCasterDraws:364`, `drawCalls:46`, diagnostics `0`,
    and nonblack screenshot/readback with visible track shadows.
  - Shadow Lab at `http://127.0.0.1:5173/`: WebGPU ready,
    `meshDraws:25`, `shadowCasterDraws:364`, `drawCalls:38`, diagnostics `0`,
    and nonblack screenshot/readback.
  - Starter Kit FPS at `http://127.0.0.1:5173/`: WebGPU ready, `views:2`,
    `meshDraws:21`, `shadowCasterDraws:44`, `drawCalls:36`, diagnostics `0`,
    and nonblack screenshot/readback.

## Known Issues

- The Aperture MCP transport was closed during live validation, so the same
  managed app checks were run through `pnpm exec aperture tool ...`.
- Starter Kit FPS is intentionally still running at `http://127.0.0.1:5173/` for
  user testing.
- Unrelated modified files remain unstaged from the asset-backed collider slice:
  `fps/aperture.config.ts`, `fps/src/lib/fps-data.ts`,
  `fps/src/systems/setup.system.ts`, `packages/app/src/config/index.ts`,
  `packages/app/src/config/validation.ts`, `packages/app/src/worker/loop.ts`,
  `test/app/config-validation.test.ts`, `test/app/fps-data.test.ts`, and
  `test/app/generated-worker-start.test.ts`.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Exercise the FPS app interactively from the still-running managed dev server,
then continue the user-directed FPS/shadow parity stream or return to the
backlog's `task-3097` PMREM GGX/VNDF prefilter slice when the interruption is
complete.

---

# Handoff - FPS Input Tap Reliability

**Updated:** 2026-06-17 11:49 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Fixed short FPS button taps that could be missed by the worker frame loop:
  - Source anchors checked:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - HUD keyboard and instant pointer actions now keep releases delayed for a
    short tap window below the fastest source weapon cooldown, so browser
    down/up pairs remain visible to the worker.
  - FPS player command draining now promotes `jump` and `shoot` press commands
    directly into the existing jump/shoot buffers, matching Godot-style
    `is_action_just_pressed` behavior more closely.
- Live Aperture CLI proof:
  - `browser_wait_for_webgpu` passed at `http://127.0.0.1:5173/` with WebGPU OK,
    no `lastError`, and no `lastFailure`.
  - `input_pointer_click {"x":0.5,"y":0.5,"button":"left"}` locked the canvas;
    the following worker status reported `shotsFired:1`.
  - After virtual mouse-look rotation to yaw about `-5.57`, holding `KeyW`
    moved the player to approximately `x:-2.22, z:-2.59`, proving movement is
    relative to camera/player yaw instead of fixed world -Z.
  - A standalone quick `input_key {"key":"Space","action":"press"}` after the
    fix reported a positive jump state (`verticalVelocity:5`,
    `jumpsRemaining:1`, `grounded:false`) through the managed CLI path. Later
    clean-reset attempts were interrupted by a stale unmanaged Vite listener on
    port `5173`; after clearing that Node/Vite process without touching Brave,
    a fresh managed smoke run was stable.
  - Clean-session `pnpm --dir fps run smoke:full-clear` passed after the stale
    listener cleanup, proving platform traversal, jumps, shots, and generated
    input through the managed Aperture path with `shotsFired:8`, `hits:16`,
    `destroyedEnemies:4`, `enemiesRemaining:0`, and
    `gameStatus:"cleared"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-setup.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir fps run smoke:skybox-readback`
  - `pnpm --dir fps run smoke:full-clear`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`

## Known Issues

- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS parity stream with another visible source-facing
slice, or return to the backlog's `task-3097` PMREM GGX/VNDF prefilter slice
when the FPS/shadow interruptions are complete.

---

# Handoff - FPS Weapon Viewmodel Placement

**Updated:** 2026-06-17 11:41 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Recalibrated the Starter Kit FPS weapon overlay runtime placement against the
  source screenshot framing:
  - Source anchors checked:
    `references/Starter-Kit-FPS/objects/player.tscn`,
    `references/Starter-Kit-FPS/objects/player.gd`,
    `references/Starter-Kit-FPS/weapons/blaster.tres`, and
    `references/Starter-Kit-FPS/screenshots/screenshot.png`.
  - The extracted source transform constants remain intact:
    `SOURCE_WEAPON_CONTAINER_OFFSET` is `[1.2, -1.1, -2.75]`, source weapon
    camera FOV is `40`, and source weapon rotation remains `[0, 180, 0]`.
  - Aperture's GLB/root-transform and WebGPU overlay projection path now uses a
    runtime-calibrated `FPS_WEAPON_VIEW_POSITION` of `[2.75, -1.2, -2.75]`,
    keeping the gun tucked farther into the lower-right viewport corner like the
    source screenshot.
- Live Aperture CLI proof:
  - `browser_wait_for_webgpu` passed at `http://127.0.0.1:5173/` with WebGPU OK,
    no `lastError`, and no `lastFailure`.
  - Initial screenshot proof wrote `/tmp/fps-viewmodel-adjusted.png`; the
    blaster appears in the lower-right overlay rather than near the center.
  - Pointer-lock look-down proof wrote `/tmp/fps-viewmodel-look-down.png`; the
    weapon stayed in the overlay corner while the camera rotated.
  - `render_get_frame_report` after the look proof reported `views:2`,
    `meshDraws:21`, `shadowCasterDraws:44`, one skybox, one sprite draw,
    diagnostics `0`, and a shadow caster draw list consuming all `44` caster
    draws with zero shadow diagnostics.
  - The live app was reset afterward: `pointerLock.locked:false`,
    `shotsFired:0`, `playerX:0`, and `playerZ:0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-setup.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir fps run smoke:skybox-readback`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`

## Known Issues

- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the user-directed FPS parity stream with another visible source-facing
slice, or return to the backlog's `task-3097` PMREM GGX/VNDF prefilter slice
when the FPS/shadow interruptions are complete.

---

# Handoff - FPS Escape Mouse Release

**Updated:** 2026-06-17 11:22 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Aligned FPS mouse-capture exit with the source project input map:
  - Source anchor checked: `references/Starter-Kit-FPS/project.godot`.
  - Godot `mouse_capture_exit` is Escape (`physical_keycode:4194305`).
  - The FPS HUD now maps Escape to `releaseMouse`, clears pending pointer-lock
    look deltas, releases active pointer-lock shooting, and calls
    `document.exitPointerLock()` when the canvas owns pointer lock.
  - Aperture CLI `browser_status` now reports `page.dom.pointerLock` with
    locked state, canvas ownership, and a small target summary so agents can
    prove capture/release behavior through the managed tool path.
- Live Aperture CLI proof:
  - After app reload, `browser_status` reported
    `pointerLock.locked:false`.
  - `input_pointer_click {"x":0.5,"y":0.5,"button":"left"}` locked the canvas
    (`pointerLock.locked:true`, `canvasLocked:true`,
    `target:{tagName:"canvas",id:"aperture"}`) and fired once
    (`shotsFired:1`).
  - `input_key {"key":"Escape","action":"press"}` released pointer lock
    (`pointerLock.locked:false`, `canvasLocked:false`) without incrementing
    shots again.
- Validation:
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/cli/browser-status.test.ts test/cli/input-tools.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --filter @aperture-engine/cli run build`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Commit:
  - `f69a4906` — `Add FPS Escape mouse release proof`

---

# Handoff - Shadow Caster Culling Independence

**Updated:** 2026-06-17 11:14 PDT

User-directed work is on branch `fps-starter-kit-port`.

## Latest Completed Slice

- Researched shadow caster visibility behavior in the local reference engines:
  - three.js builds shadow render lists against the shadow camera path instead
    of reusing the main render camera visible list.
  - PlayCanvas performs directional shadow caster culling through its shadow
    camera.
  - Bevy keeps shadow-map visible entities separate from main-view visibility.
- Added an optional `RenderSnapshot.shadowCasterDraws` packet family extracted
  separately from visible `meshDraws`.
  - Main `meshDraws` still use per-view camera frustum culling.
  - Shadow caster extraction requires `castsShadow`, uses the union of shadow
    caster layer masks, suppresses expected nonmatching layer diagnostics, and
    does not use main-view frustum culling.
  - The shadow auto-fit, shadow draw-list planning, mixed built-in/custom route,
    app reports, packed snapshot codec, SharedArrayBuffer transport, and
    snapshot change-set scheduler now carry the caster-only packet family.
- Racing live proof through Aperture CLI at `http://127.0.0.1:5174/`:
  - `browser_wait_for_webgpu` passed.
  - `render_get_frame_report` reported `meshDraws:36`,
    `shadowCasterDraws:364`, and a shadow caster draw list consuming all
    `364` caster draws with zero diagnostics.
  - `browser_screenshot` wrote `/tmp/racing-shadow-caster-live.png`; the image
    was not black and showed track/arch/tree shadows.
  - `render_readback_samples` returned opaque nonzero pixels for center,
    track-shadow, and grass-lit samples.
- Validation:
  - `pnpm exec vitest run test/rendering/extraction.test.ts test/rendering/snapshot-packed-encoding.test.ts test/rendering/snapshot-change-set.test.ts test/rendering/snapshot-update-scheduler.test.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/app-snapshot-transport.test.ts`
  - `pnpm --filter @aperture-engine/render run build`
  - `pnpm --filter @aperture-engine/render run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run build`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`

## Known Issues

- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Continue the current user-directed FPS/racing validation stream, or return to
the backlog's `task-3097` PMREM GGX/VNDF prefilter slice when the shadow/FPS
interruptions are complete.

---

# Handoff - FPS Gamepad Toggle Parity

**Updated:** 2026-06-17 11:14 PDT

User-directed work is now on branch `fps-starter-kit-port`, created from the
previous working state so the old state remains recoverable.

## Latest Completed Slice

- Aligned FPS gamepad weapon toggle with the source project input map:
  - Source anchor checked: `references/Starter-Kit-FPS/project.godot`.
  - Godot `weapon_toggle` has joypad `button_index:10`; Aperture's standard
    gamepad name for that index is `leftStick`.
  - `fps/aperture.config.ts` now binds `switchWeapon` to
    `input.gamepadButton("leftStick")` instead of `rightBumper`.
  - Added focused input-config coverage proving source right trigger shooting
    (`button_index:7`) and left-stick weapon toggle (`button_index:10`) both
    drive the expected actions, while right bumper does not toggle weapons.
- Live Aperture CLI proof:
  - After app reload/reset, `input_gamepad_set {"button":"rightBumper"}` left
    `weaponIndex:0`, `weaponName:"Blaster"`, and `shotsFired:0`.
  - `input_gamepad_set {"button":"rightTrigger","pressed":true,"value":1}`
    fired the weapon; the status read showed `shotsFired:4` while held.
  - After reset, `input_gamepad_set {"button":"leftStick","pressed":true}`
    switched to `weaponIndex:1`, `weaponName:"Repeater"`, with
    `shotsFired:0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-hud.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `git diff --check -- fps/aperture.config.ts test/app/fps-input-config.test.ts`
- Commit:
  - `e5cc9183` — `Align FPS gamepad weapon toggle`

## Previous Completed Slice - FPS Reset Body Hold

- Fixed FPS reset and jump buffering around the Rapier character controller:
  - Source anchors checked:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - `R` reset now holds the player body at the source start pose for three
    simulation frames so the kinematic target reaches Rapier before
    `moveCharacter(...)` can re-author the prior shot-knockback body offset.
  - Jump and shoot button buffers are not consumed during that short reset-body
    hold. A Space press that arrives while the hold is active is consumed as
    soon as the hold clears instead of being canceled by reset stabilization.
  - Added `SOURCE_RESET_BODY_HOLD_FRAMES` to the FPS source data constants and
    covered it in the source-data test.
- Live Aperture CLI proof:
  - Before the fix, a left click moved the live player to roughly
    `playerZ:0.11`; pressing `R` cleared `shotsFired` and yaw but left the
    player at the offset.
  - After the fix, left click still fired (`shotsFired:1`, `playerZ:0.15`), and
    pressing `R` returned `shotsFired:0`, `playerX:0`, `playerZ:0`,
    `yaw:0`, `pitch:0`, zero movement velocity, zero vertical velocity, and
    `jumpsRemaining:2`.
  - `ecs_get_entity {"entity":{"index":3,"generation":0}}` read
    `player.body` local transform, kinematic target, and physics body state all
    back at near-zero X/Z after reset.
  - Paused-step proof queued Space during the reset hold. During the hold the
    player stayed at `[0,1.5,0]`; after the hold cleared, one fixed step
    reported `playerY:1.62777778506279`, `verticalVelocity:7.666666666666667`,
    `grounded:false`, and `jumpsRemaining:1`.
  - Camera-relative W movement was reproved after yaw `-4.271428571428585`:
    W moved to `x:-2.369220235626244,z:1.1181099567436377`, matching the
    yaw-derived horizontal forward vector.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `git diff --check -- fps/src/lib/fps-data.ts fps/src/systems/player.system.ts test/app/fps-data.test.ts`
- Commit:
  - `68c0a0c7` — `Fix FPS reset body hold and jump buffering`

## Previous Completed Slice - FPS Pointer Input Controls

- Fixed the latest reported FPS control issues around shooting, middle-click
  weapon toggling, jump reliability, and camera-relative movement proof:
  - Source anchors checked:
    `references/Starter-Kit-FPS/project.godot` and
    `references/Starter-Kit-FPS/objects/player.gd`.
  - Removed the HUD's duplicate click/pointer shoot path. Left mouse now uses a
    held `mousedown`/`mouseup` command path, with a one-shot unlocked-click
    fallback for the first pointer-lock click.
  - Browser blur now releases active pointer-lock shooting.
  - Non-repeat keyboard button presses now always dispatch a fresh app command
    edge, so a stale browser-side latch cannot swallow the next Space/E/R press.
  - Added source middle-mouse weapon toggle handling in the FPS HUD bridge,
    matching Godot `weapon_toggle` mouse `button_index:3`.
  - Fixed the shared generated browser input forwarder so non-primary mouse
    buttons are not forwarded as `input.pointer("primary")` presses. This
    prevents middle click from also firing the weapon.
  - Extended Aperture CLI/MCP `input_pointer_click` and `input_drag` with an
    explicit `button:"left"|"middle"|"right"` option, then used it for live
    middle-click proof.
- Live Aperture CLI proof:
  - `input_pointer_click {"x":0.5,"y":0.5,"button":"middle"}` returned
    `button:"middle"`, dispatched only `switchWeapon`, and after a short worker
    tick reported `weaponIndex:1`, `weaponName:"Repeater"`, and
    `shotsFired:0`.
  - Left click still fired: after `input_pointer_click {"button":"left"}`,
    `shotsFired` advanced to `1`.
  - First clean Space press jumped: a short-delay status read showed
    `grounded:false`, `playerY:1.33`, and `jumpsRemaining:1`.
  - Camera-relative W movement was reproved after yaw `-0.111`: position moved
    from roughly `x:-0.004,z:0.111` to `x:0.212,z:-1.821`, matching the
    yaw-derived forward vector.
- Validation:
  - `pnpm exec vitest run test/app/browser-input-forwarding.test.ts test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/cli/input-tools.test.ts test/cli/dev-session.test.ts`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --dir fps run typecheck`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --filter @aperture-engine/cli run build`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
- Commit:
  - `48ca7eec` — `Fix FPS pointer input controls`
  - `e98bc98d` — `Add FPS unlocked click fallback`

## Previous Completed Slice - FPS Source Viewport Shell

- Ported the source project browser shell metadata into the FPS app:
  - Source anchor checked: `references/Starter-Kit-FPS/project.godot`.
  - Added byte-identical `fps/public/icon.png` and
    `fps/public/splash-screen.png` from the upstream Starter Kit FPS project.
  - Replaced the blank favicon with the source icon.
  - Added source project constants for the 1280x720 viewport, 16:9 aspect, and
    `boot_splash/bg_color` (`#ececf5`).
  - Wrapped the generated Aperture canvas, crosshair, HUD, and boot splash in a
    centered fixed-ratio `#game-shell`. At the default managed browser size,
    the canvas now measures `960x540` inside the `960x640` tab instead of
    stretching to `960x640`.
  - Added a source splash overlay that is visible until the first generated
    signal update, then dismissed by the HUD bridge.
  - HUD and crosshair coordinates are now absolute inside the source game shell
    instead of fixed to the whole browser window.
- Live Aperture CLI proof:
  - `browser_wait_for_webgpu` passed with no `lastError`/`lastFailure`.
  - `browser_canvas_status` reported canvas `width:960`, `height:540`,
    `displayWidth:960`, `displayHeight:540`, and
    `aspect:1.7777777777777777`.
  - `render_readback_samples` reported canvas screenshot region
    `left:0`, `top:50`, `width:960`, `height:540`,
    `screenshotWidth:960`, and `screenshotHeight:640`, confirming the
    source-aspect shell and non-splash rendered pixels.
  - Screenshot proof: `/tmp/fps-source-viewport-shell.png`.
  - `pnpm --dir fps run smoke:skybox-readback` still passed under the new shell.
- Validation:
  - `cmp -s references/Starter-Kit-FPS/icon.png fps/public/icon.png`
  - `cmp -s references/Starter-Kit-FPS/splash-screen.png fps/public/splash-screen.png`
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-controls.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir fps run smoke:skybox-readback`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
- Commit:
  - `a5c4ab49` — `Add FPS source viewport shell`

## Previous Completed Slice - FPS Shot Ordering And Reset Input Fix

- Fixed the latest reported FPS playability issues around shooting, movement
  confidence, and jump reliability:
  - Source anchors checked:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - Shooting input itself was live-proved through Aperture: virtual
    `input_action_set` hold-to-fire increments `shotsFired`, and a managed
    browser `input_pointer_click` increments `shotsFired`.
  - Damage resolution now uses the nearest physics ray hit before checking
    whether that hit is an enemy. This matches Godot `RayCast3D` nearest-hit
    behavior and prevents unsorted `raycastAll` output from making closer
    enemies unshootable or allowing hits through nearer blockers.
  - FPS reset/respawn now clears all app-specific command bridge state:
    movement, jump, shoot, weapon switch, and reset. Previously it only cleared
    shoot command state, which could leave stale movement/button state around
    after a reset path.
  - Existing camera-yaw-relative movement math was rechecked against the source
    `transform.basis * movement_velocity` path and reproved by the full-clear
    route.
  - Jump behavior was reproved through the full-clear route; held Space also
    jumped in live Aperture input testing, and the reset-state cleanup removes a
    concrete source of intermittent stale command behavior.
- Live proof:
  - `pnpm --dir fps run smoke:full-clear` passed from a fresh managed Aperture
    session.
  - Final state: `health:65`, `shotsFired:8`, `hits:16`,
    `enemiesRemaining:0`, `destroyedEnemies:4`, and
    `gameStatus:"cleared"`.
  - The smoke route jumped across the west, southeast, northeast, and elevated
    northeast platform transitions and destroyed all four enemies through
    Aperture MCP/CLI generated input.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-hud.test.ts`
  - `pnpm --dir fps run smoke:full-clear`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
- Commit:
  - `8fcc4542` — `Fix FPS shot ordering and reset inputs`

## Previous Completed Slice - FPS Skybox Readback Smoke

- Added a reusable Starter Kit FPS skybox orientation/readback proof:
  - Source/reference anchors checked:
    `references/Starter-Kit-FPS/scenes/main-environment.tres`,
    `references/Starter-Kit-FPS/sprites/skybox.png`,
    `references/bevy/examples/3d/skybox.rs`,
    `references/engine/src/scene/skybox/sky.js`, and
    `references/three.js/src/textures/CubeTexture.js`.
  - `fps/public/sprites/skybox.png` is byte-identical to the upstream source
    panorama and remains imported as the `skybox` texture asset.
  - Added `pnpm --dir fps run smoke:skybox-readback`, backed by
    `fps/scripts/skybox-readback-smoke.mjs`.
  - The smoke starts a fresh managed Aperture dev session, connects through
    `pnpm exec aperture mcp stdio`, pauses/resets the ECS worker, verifies the
    frame report has one diagnostic-free extracted skybox, then aims the real
    player camera to `source-forward-u050`, `source-left-u025`,
    `source-right-u075`, and `source-back-seam`.
  - For each view it records named `render_readback_samples` at upper-center
    and upper-left sky pixels, then asserts the source-derived upper-center
    ordering: source-left is warmer/brighter than source-forward,
    source-forward is warmer/brighter than source-right, and source-right plus
    source-back both land in the darker blue band.
  - The proof keeps skybox authoring ECS-derived through the existing
    `spawn.skybox(...)` / equirectangular cube texture asset path.
- Live proof:
  - `pnpm --dir fps run smoke:skybox-readback` passed.
  - Frame summary: `skyboxes:1`, `diagnostics:0`, `views:2`,
    `drawCalls:36`.
  - Upper-center samples:
    `source-forward-u050` `{r:152,g:149,b:195,a:255}`,
    `source-left-u025` `{r:180,g:176,b:195,a:255}`,
    `source-right-u075` `{r:129,g:129,b:194,a:255}`, and
    `source-back-seam` `{r:129,g:129,b:194,a:255}`.
  - Screenshot proof:
    `fps/.aperture/runtime/fps-skybox-readback.png`.
- Validation:
  - `node --check fps/scripts/skybox-readback-smoke.mjs`
  - `pnpm --dir fps run smoke:skybox-readback`
  - `pnpm exec vitest run test/rendering/equirect-cubemap.test.ts test/app/skybox-spawn.test.ts test/app/fps-data.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm exec prettier --check fps/package.json fps/scripts/skybox-readback-smoke.mjs`
  - `git diff --check -- fps/package.json fps/scripts/skybox-readback-smoke.mjs`
- Commit:
  - `3d05527f` — `Add FPS skybox readback smoke`

## Previous Completed Slice - CLI Screenshot Pixel Readback

- Hardened the Aperture CLI pixel-readback tooling used for FPS visual proof:
  - `browser_pick_pixel` and `render_readback_samples` now sample the managed
    browser screenshot instead of the in-page WebGPU canvas copy path, avoiding
    transparent/black readback after presentation on the current macOS browser
    stack.
  - Added a typed PNG decoder for 8-bit RGB/RGBA screenshots, including PNG
    scanline filter reconstruction.
  - The screenshot sampler resolves the active canvas DOM rect and maps
    normalized/pixel requests from canvas coordinates into screenshot pixels.
    Results report `region.source:"canvas"`, canvas-region size, and
    per-sample screenshot coordinates. If no canvas exists, it falls back to
    whole-screenshot sampling.
  - Added focused CLI tests covering canvas-region sampling for
    `render_readback_samples` / `browser_pick_pixel` and whole-screenshot
    fallback.
- Live Aperture CLI proof against the FPS app at `http://127.0.0.1:5173/`:
  - `browser_wait_for_webgpu` passed with the 960x640 FPS canvas ready.
  - `render_readback_samples` returned opaque nonzero canvas-region pixels:
    `sky-top` `{r:152,g:149,b:195,a:255}`,
    `crosshair-center` `{r:255,g:255,b:255,a:255}`, and
    `weapon-lower-right` `{r:42,g:146,b:106,a:255}` with
    `region.source:"canvas"`.
  - `browser_pick_pixel` at normalized center returned the same opaque
    center sample and embedded screenshot-backed readback metadata.
  - Direct `mcp__aperture.render_readback_samples` in this Codex session
    returned `Transport closed`; the CLI-backed Aperture tools remained usable
    and exercise the same committed dispatch path.
- Validation:
  - `pnpm exec vitest run test/cli/png-readback.test.ts`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --filter @aperture-engine/cli run build`
  - `pnpm exec prettier --check packages/cli/src/tools/dispatch.ts packages/cli/src/tools/png-readback.ts test/cli/png-readback.test.ts`
  - `git diff --check -- packages/cli/src/tools/dispatch.ts packages/cli/src/tools/png-readback.ts test/cli/png-readback.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Commit:
  - `e1ca148b` — `Use screenshot sampling for CLI pixel readback`

## Previous Completed Slice - FPS Click Shoot And Rapid Jump Fix

- Fixed the latest reported FPS controls issues:
  - Source anchors checked:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - Removed the HUD's artificial delayed button releases. Aperture input state
    already preserves same-frame press/release edges, so the delay could keep a
    virtual button held long enough to swallow fast second Space presses.
  - Added `shoot` to the app-specific `fps.input` command channel and consumed
    it in `PlayerSystem`, so pointer-lock/click shooting has the same reliable
    command fallback as keyboard movement and jump.
  - Pointer-lock shoot now dispatches both the generated input action and the
    `fps.input` command fallback on press/release.
  - Added focused tests for the source mouse-look-right yaw convention,
    command-backed `shoot`, and same-frame button edge recovery.
- Live Aperture CLI proof against `http://127.0.0.1:5173/`:
  - Real `input_pointer_click {"x":0.5,"y":0.5}` incremented
    `shotsFired` to `1` and set `shotCooldown` to
    `0.23333333333333334`.
  - Two rapid `input_key {"key":"Space","action":"press"}` calls across
    adjacent paused `ecs_step` frames consumed both jumps:
    after the first step `jumpsRemaining:1`, after the second
    `jumpsRemaining:0`, with `verticalVelocity:7.666666666666667`.
  - At `yaw:-PI/2`, generated forward movement produced positive X movement
    velocity (`movementVelocity:[3.699347...,0,~0]`), proving forward remains
    camera-yaw-relative for the source mouse-look-right sign.
  - `pnpm --dir fps run smoke:full-clear` still completed the full route with
    `health:60`, `shotsFired:9`, `hits:16`, `enemiesRemaining:0`,
    `destroyedEnemies:4`, and `gameStatus:"cleared"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/input-state-events.test.ts`
    passed 52 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir fps run smoke:full-clear`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm exec prettier --check fps/src/hud.ts fps/src/lib/fps-data.ts fps/src/systems/player.system.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts`
  - `git diff --check -- fps/src/hud.ts fps/src/lib/fps-data.ts fps/src/systems/player.system.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts`
- Commit:
  - `2d010e61` — `Fix FPS click shoot and rapid jumps`

## Previous Completed Slice - FPS Full-Clear Smoke Route Hardening

- Hardened the packaged generated-input full-clear smoke proof:
  - `pnpm --dir fps run smoke:full-clear` now runs
    `node scripts/full-clear-smoke.mjs --fresh-session`, so the package-level
    proof starts from a clean owned headless Aperture dev session instead of
    inheriting a stale managed browser. Manual script users can still omit
    `--fresh-session` to reuse an existing session.
  - The script tracks session ownership and tears down the fresh session after
    completion unless `--keep-running` is passed.
  - This addresses a reproduced failure where the game route reached the final
    elevated platform, then CDP returned
    `Target page, context or browser has been closed` after reusing an older
    dev session.
  - Latest package-script proof from a fresh managed session:
    `health:60`, `shotsFired:9`, `hits:16`, `enemiesRemaining:0`,
    `destroyedEnemies:4`, `gameStatus:"cleared"`. Screenshot:
    `fps/.aperture/runtime/fps-full-clear-smoke.png`.
  - The proof continues to drive only generated input actions plus `fps.state`
    reads through Aperture MCP/CLI tooling; it does not directly mutate player
    transforms or enemy health.
- Validation:
  - `pnpm --dir fps run smoke:full-clear`
  - `node --check fps/scripts/full-clear-smoke.mjs`
  - `pnpm exec prettier --check fps/package.json fps/scripts/full-clear-smoke.mjs`
  - `git diff --check -- fps/package.json fps/scripts/full-clear-smoke.mjs`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/app/fps-setup.test.ts`
    passed 39 tests.
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Commit:
  - `5fda9117` — `Harden FPS full-clear smoke session`

## Previous Completed Slice - FPS Full-Clear Smoke Route

- Packaged the generated-input Starter Kit FPS full-clear proof:
  - Added `pnpm --dir fps run smoke:full-clear`, backed by
    `fps/scripts/full-clear-smoke.mjs`.
  - The script starts/reuses the managed Aperture dev session, connects through
    `pnpm exec aperture mcp stdio`, waits for WebGPU, pauses/resets the ECS
    worker, and drives only generated input actions (`move`, `mouseLook`,
    `jump`, `shoot`, `reset`) through the Aperture tool path.
  - The route captures the previous manual platform-aware proof in source:
    spawn kill for `enemy.0`, jump to west grass for `enemy.1`, return through
    start grass, jump to southeast grass for `enemy.2`, and double-jump across
    northeast platforms for `enemy.3`.
  - Added landing checks after jump waypoints plus explicit double-jump support
    for the long northeast transitions, which directly revalidates jump
    consumption and camera-relative movement through live gameplay.
  - Final live proof state from a fresh managed Aperture session:
    `health:60`, `shotsFired:8`, `hits:16`, `enemiesRemaining:0`,
    `destroyedEnemies:4`, every `enemyDestroyed.*:true`,
    `gameStatus:"cleared"`. Screenshot:
    `fps/.aperture/runtime/fps-full-clear-smoke.png`.
  - The proof does not mutate player transforms or enemy health directly;
    gameplay state remains ECS-owned.
- Validation:
  - `node --check fps/scripts/full-clear-smoke.mjs`
  - `pnpm --dir fps run smoke:full-clear -- --keep-running --verbose`
  - `git diff --check -- fps/package.json fps/scripts/full-clear-smoke.mjs`
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-hud.test.ts`
    passed 40 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Commit:
  - `0ed3e278` — `Add FPS full-clear smoke route`

## Previous Completed Slice - FPS Weapon Culling

- Fixed the FPS weapon stock/back-end rendering inside-out:
  - Source anchors checked:
    `references/Starter-Kit-FPS/models/blaster.glb`,
    `references/Starter-Kit-FPS/models/blaster-repeater.glb`,
    `references/Starter-Kit-FPS/objects/player.tscn`, and
    `references/Starter-Kit-FPS/objects/player.gd`.
  - The source GLB materials are `doubleSided: true`, and the source player
    instantiates the same weapon model at `rotation = Vector3(0, 180, 0)`.
    The Aperture transform matched the source; the bug was the local
    `WEAPON_VIEWMODEL_MATERIALS` override forcing `cullMode: "back"`, which
    overrode the GLB's double-sided culling.
  - `WEAPON_VIEWMODEL_MATERIALS` now only disables depth for the weapon overlay
    and leaves the source material cull state intact.
  - Live Aperture CLI proof:
    `render_get_frame_report` reported `diagnostics: 0` and the weapon overlay
    pipeline `standard|baseColorTexture|opaque|none|always|none` with
    `itemCount: 3`. Screenshot saved at `/tmp/fps-weapon-cull-fix.png`.
- Validation:
  - `pnpm exec vitest run test/app/fps-setup.test.ts test/app/fps-data.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir fps exec aperture tool browser_wait_for_webgpu --json '{"timeoutMs":10000}'`
  - `pnpm --dir fps exec aperture tool render_get_frame_report --json '{"summaryOnly":false}'`
  - `pnpm --dir fps exec aperture tool browser_screenshot --json '{"outputPath":"/tmp/fps-weapon-cull-fix.png"}'`
- Commit:
  - `7993b007` — `Preserve FPS weapon double-sided materials`

## Previous Completed Slice - FPS Shadow Fit Tightening

- Fixed the soft FPS directional shadows by tightening the default single-cascade
  auto-fit:
  - Live Aperture CLI diagnostics showed FPS was using `mapSize: 2048` and
    `filterRadiusTexels: 2`, but the shadow matrix had
    `orthographicSize: 243` because the fit covered the full `far=80`,
    `fov=80` camera frustum, including empty sky/background.
  - `DirectionalShadowMatrixComputationInput` now accepts receiver bounds.
    Single-cascade camera fitting intersects the camera-frustum light-space AABB
    with standard-material receiver bounds, then uses existing caster bounds to
    tighten depth. Cascaded shadows keep the previous Bevy-style frustum path.
  - `RenderShadowFrameReport` now publishes compact shadow `descriptor`,
    `viewProjection`, `matrixComputation`, and `casterDrawList` reports, so
    `render_get_frame_report` can expose the actual fit numbers through the
    Aperture CLI/tooling path.
  - Live FPS verification after rebuild/reload:
    `browser_wait_for_webgpu` passed, `render_get_frame_report` reported no
    shadow diagnostics, and the FPS shadow ortho dropped from `243` to `13`
    at start-position inspection, then `8` from the later moved camera sample.
    Screenshot saved at `/tmp/fps-shadow-tight.png`.
- Validation:
  - `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts`
  - `pnpm exec vitest run test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/webgpu/app-frame-boundaries.test.ts test/webgpu/shadows/render-shadow-frame.spec.ts test/webgpu/app-auto-shadow-frame.test.ts test/webgpu/directional-shadow-matrix-computation.test.ts`
    passed 73 tests.
- Commit:
  - `2a60c0d8` — `Tighten directional shadow receiver fit`

## Previous Completed Slice - Starter Kit FPS Source Sun And Viewmodel

- Followed up the source-style FPS weapon overlay with lighting and viewmodel
  parity fixes:
  - Source anchors:
    `references/Starter-Kit-FPS/scenes/main.tscn`,
    `references/Starter-Kit-FPS/scenes/main-environment.tres`,
    `references/Starter-Kit-FPS/objects/player.tscn`, and
    `references/Starter-Kit-FPS/objects/player.gd`.
  - The FPS sun now uses `SOURCE_SUN_ROTATION` directly. The earlier temporary
    Euler runtime mapping produced live light travel with positive Y, so
    up-facing platform surfaces were mostly shade-side. Live
    `ecs_find_entities {"key":"light.sun"}` now reports the source quaternion
    and the source basis matrix from `main.tscn`.
  - The source movement values are `movement_speed = 5`, `jump_strength = 8`,
    and `number_of_jumps = 2`; there is no sprint mechanic in the source. The
    port already matches those constants with `PLAYER_SPEED = 5`,
    `JUMP_STRENGTH = 8`, and `MAX_JUMPS = 2`.
  - The weapon viewmodel calibration is now `[2.05, -1.05, -2.75]` for
    Aperture's weapon camera while preserving
    `SOURCE_WEAPON_VIEW_POSITION = [1.2, -1.1, -2.75]`. The screenshot
    `/tmp/fps-weapon-calibrated-205-105.png` shows the weapon tucked lower/right
    like the source reference; `/tmp/fps-weapon-calibrated-look-down-platform.png`
    shows the weapon remains visible over the platform at pitch `-PI/2`.
- Aperture tooling proof:
  - Started the managed FPS app at `http://127.0.0.1:5173/` with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173 --strict-port`.
  - `browser_wait_for_webgpu` passed with WebGPU ready, 94 mirrored source
    assets, `pitch:0`, `yaw:0`, and no last error/failure after reset.
  - Note: keep Aperture CLI browser-tool calls serial. A parallel batch of
    browser/render/ECS tool calls tore down this managed session once during
    validation.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/webgpu/app-frame-boundaries.test.ts`
    passed 55 tests.
  - `pnpm --dir fps run build`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
  - Additional live control recheck after reset:
    - normalized `input_pointer_click {"x":0.5,"y":0.5}` incremented
      `shotsFired` from `0` to `1`;
    - held Space moved player Y from `0.9699` to `1.1608`, set
      `grounded:false`, and reduced `jumpsRemaining` to `1` before landing;
    - setting yaw to `PI/2` and pressing forward moved X from `0` to
      `-2.0643` while Z stayed near `0`, matching camera-relative forward.
- Commit:
  - `a6c45fbb` — `Calibrate FPS source sun and weapon view`

## Previous Completed FPS/Tooling Slices

- Restored the source-style Starter Kit FPS weapon overlay path and fixed the
  latest reported control issues:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/player.gd` and
    `references/Starter-Kit-FPS/project.godot`.
  - Reference anchors for the renderer slice:
    `references/three.js/src/renderers/WebGLRenderer.js`,
    `references/three.js/src/renderers/webgl/WebGLBackground.js`, and
    `references/engine/src/scene/renderer/frame-pass-postprocessing.js`.
  - Renderer frame-boundary assembly now supports post-processed same-swapchain
    overlay views by loading scene color for later views, clearing depth for
    transparent/disjoint-layer overlays, preserving MSAA color when another view
    still targets the same surface, and presenting post effects only after the
    final same-target view.
  - FPS setup now spawns `camera.main` for world content and `camera.weapon`
    for weapon-layer content, with source FOVs `80` and `40` respectively.
    Weapon meshes and the player muzzle flash render on the weapon layer,
    parented under the weapon camera with transparent clear.
  - Added an app-level `fps.input` command channel from the browser HUD to the
    simulation worker. Keyboard movement, jump, switch-weapon, and reset now
    have a narrow command fallback in addition to generated input actions.
  - Canvas click now emits a short pointer-lock shoot action as a fallback, so
    unlocked click-to-shoot works even when pointer-lock acquisition and pointer
    action forwarding race.
  - Movement remains camera-relative through the existing yaw-based movement
    math; live proof showed W at yaw `0` moved Z negative, and W at yaw
    `0.148571...` produced both negative X and negative Z velocity.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - Direct MCP calls still failed with `Transport closed`; the same Aperture
    tools were used through the CLI, and the managed browser's CDP port was
    used only for tight per-frame state sampling.
  - Space jump proof: per-frame sampling around a keyboard event moved player Y
    from `0.970100...` to `1.655889...`, set `grounded:false`, and reduced
    `jumpsRemaining` to `1`.
  - Shoot proof: a canvas click produced `virtualAction: shoot` and incremented
    `shotsFired` from `1` to `2`.
  - Movement proof: W at yaw `0` produced
    `movementVelocity:[0,0,-4.7794...]`; after camera yaw changed to
    `0.148571...`, W produced
    `movementVelocity:[-0.7083...,0,-4.7326...]`.
  - Render proof: `render_get_frame_report` reported two swapchain views, draw
    calls `19` world plus `4` weapon, total draw calls `36`, diagnostics `0`,
    and bloom plus HDR tonemap running once on final view `1`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-hud.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 45 tests.
  - `pnpm exec vitest run test/webgpu/app-frame-boundaries.test.ts test/webgpu/post-graph-parity.test.ts test/webgpu/post-tonemap.test.ts`
    passed 24 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir packages/webgpu run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `285fa3dd` — `Restore FPS weapon overlay controls`

- Anchored Starter Kit FPS enemy scene/script constants:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/enemy.tscn` and
    `references/Starter-Kit-FPS/objects/enemy.gd`.
  - The source enemy scene authors a sphere hitbox with `radius = 0.75`, a
    `CollisionShape3D` offset of `[0, 0.25, 0]`, a raycast target
    `[0, 0, 5]`, two muzzle offsets `[-0.45, 0.3, 0.4]` and
    `[0.45, 0.3, 0.4]`, and a `Timer.wait_time = 0.25`.
  - The source enemy script applies `damage(5)`, rolls muzzle flashes in the
    `[-45, 45]` degree range, and integrates
    `target_position.y += cos(time * 5) * 1 * delta`.
  - The port now exports the corresponding `SOURCE_ENEMY_*` constants, derives
    attack distance from `SOURCE_ENEMY_RAYCAST_TARGET`, routes setup/player
    systems through those constants, and uses `sourceEnemyHoverPosition(...)`
    for the closed-form enemy hover position.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready and diagnostics
    `[]`.
  - With the worker paused, `ecs_find_entities {"key":"enemy.0.hitbox"}` read
    `physicsCollider.shapeKind:"sphere"`, `physicsCollider.radius:0.75`, and
    an offset from `enemy.0` of `[0,0.25,0]` both before and after a paused
    `ecs_step {"delta":0.25}`.
  - The same paused step moved `enemy.0` from
    `[-3.5,2.56318,-6]` to `[-3.5,2.593785,-6]`, delta
    `[0,0.030605,0]`, proving only source hover Y changed while X/Z stayed
    anchored.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 35 tests.
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 62 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `pnpm run check:progress`
  - `git diff --check`
- Commit:
  - `25825757` — `Anchor FPS enemy source constants`

- Anchored Starter Kit FPS cloud hover math:
  - Source anchor: `references/Starter-Kit-FPS/objects/cloud.gd`.
  - The source randomizes `random_velocity` and `random_time` in `[0.1, 2.0]`
    and integrates `position.y += cos(time * random_time) * random_velocity *
delta`, which yields a sine offset of `random_velocity / random_time`.
  - The port now exposes `SOURCE_CLOUD_RANDOM_MIN = 0.1` and
    `SOURCE_CLOUD_RANDOM_MAX = 2.0`, uses `sourceCloudHoverPosition(...)` as
    the shared source formula, and keeps deterministic per-cloud hover values
    inside the source random range.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Reproved the user-reported control paths through the live generated worker:
    one generated `shoot` step produced `shotsFired:1`,
    `shotCooldown:0.25`, and `movementVelocity.z:6.664182862170411`;
    yaw `1.5707963267948966` plus forward movement produced
    `movementVelocity:[-0.8333333333333333,0,-5.102694996447305e-17]`;
    a grounded generated `jump` step moved Y from `0.97009998762951` to
    `1.0978777594864368`, set `verticalVelocity:7.666666666666667`, and left
    `jumpsRemaining:1`.
  - `render_get_frame_report --summaryOnly` reported two views, 49 draw calls,
    and render diagnostics `0`.
  - With the worker paused, `ecs_find_entities {"key":"deco.cloud.0"}` before
    and after `ecs_step {"delta":0.25}` showed translation delta
    `[0,-0.01747608184814453,0]`; X/Z stayed fixed and only Y hovered.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 60 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `3dadd9ab` — `Anchor FPS cloud hover source math`

- Aligned Starter Kit FPS weapon-switch ordering and shared cooldown:
  - Source anchor: `references/Starter-Kit-FPS/objects/player.gd`.
  - The source `handle_controls(delta)` calls `action_shoot()` before
    `action_weapon_toggle()`, and `action_weapon_toggle()` only starts the
    weapon tween and weapon-change sound; it does not reset the shared
    `$Cooldown` timer.
  - The port now advances active switch animation first, resolves the currently
    usable weapon for shooting, processes shooting, and only then handles a new
    `switchWeapon` edge.
  - Switching no longer clears `shotCooldown`, so same-frame
    switch-plus-shoot during cooldown starts the source hide animation but does
    not fire an extra shot.
  - Source weapon-switch timing constants are now exported as
    `SOURCE_WEAPON_SWITCH_HIDE_DURATION = 0.1` and
    `SOURCE_WEAPON_SWITCH_RAISE_RATE = 10`.
- Aperture tooling proof:
  - Started/reused the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Paused/reset the live worker, fired once, then released for one step:
    `shotsFired:1`, `shotCooldown:0.23333333333333334`,
    `weaponSwitchPhase:"ready"`.
  - Pressed `switchWeapon` and `shoot` together while cooldown was active and
    stepped once: `weaponSwitchPhase:"hiding"`, `weaponSwitchProgress:0`,
    `shotsFired:1`, and `shotCooldown:0.21666666666666667`.
  - After crossing the source 0.1s hide duration, resource state reported
    `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"raising"`, and `weaponSwitchProgress:0.5833333333333333`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 58 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `f3128229` — `Align FPS source weapon switch cooldown`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source shot body knockback and movement smoothing:
  - Source anchors:
    `references/Starter-Kit-FPS/objects/player.gd`,
    `references/Starter-Kit-FPS/weapons/blaster.tres`, and
    `references/Starter-Kit-FPS/weapons/blaster-repeater.tres`.
  - The source player script sets local `movement_velocity` from movement
    input, calls `action_shoot()` before movement application, adds
    `Vector3(0, 0, weapon.knockback)` on shot, transforms it through
    `transform.basis`, then lerps body velocity with `delta * 10`.
  - The port now exposes `SOURCE_MOVEMENT_LERP_RATE = 10`, carries
    `fps.state.movementVelocity`, and uses
    `sourceMovementTargetVelocity(...)` plus `sourceSmoothedMovementStep(...)`
    to lerp horizontal body velocity toward the same source target.
  - Shot body knockback now folds into the source movement target on the shot
    frame instead of using the previous independent recoil impulse/recovery
    approximation.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed with WebGPU ready, generated FPS input
    actions present, and render diagnostics `[]`.
  - Pre-shot `resource_get {"id":"fps.state"}` reported
    `movementVelocity:[0,0,0]`, `shotsFired:0`, and `shotCooldown:0`.
  - With the simulation paused, a reset step followed by
    `input_action_set {"action":"shoot","pressed":true}` and one `ecs_step`
    produced `shotsFired:1`, `shotCooldown:0.25`,
    `movementVelocity:[-0.17953479649859896,0,6.664248772464203]`, and
    `playerPosition.z:0.11107081174850464`; the `z` velocity matches the
    source blaster knockback path (`40 * 10 / 60`) within the small random yaw
    kick from source camera recoil.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 58 tests.
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `1f1ebf66` — `Align FPS source shot body knockback`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source look and weapon-camera layering:
  - `references/Starter-Kit-FPS/objects/player.gd` uses
    `mouse_sensitivity = 700`, `gamepad_sensitivity = 0.075`, a persistent
    `rotation_target`, source controller diagonal limiting, and
    `lerp_angle(..., delta * 25)`.
  - The port now keeps pointer-lock mouse look separate from
    controller/keyboard look through a virtual-only `mouseLook` generated
    action backed by a new `input.virtual()` config binding.
  - Pointer-lock mouse look applies the source immediate path at `26/700`
    radians per virtual unit; controller/keyboard `look` advances the source
    rotation target and lerps the camera/player yaw and pitch toward it.
  - Shot recoil now updates both the current camera rotation and the source
    rotation target.
  - FPS setup now spawns `camera.weapon` parented to `camera.main`, uses the
    source weapon `CameraItem` `fov = 40`, renders world and weapon content on
    separate render layers, and keeps lights visible to both layers.
  - Weapon GLB roots, actual GLB mesh primitive descendants, and the player
    muzzle flash are assigned to the weapon render layer; the main player
    camera keeps world content on the world layer.
  - Devtools entity summaries now expose `renderLayer.mask`, which made the
    layer proof direct instead of inferred from draw counts.
- Aperture tooling proof:
  - Started the managed FPS app with
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`.
  - CLI `browser_wait_for_webgpu` passed; `mouseLook` was present in generated
    input actions and WebGPU was ready.
  - CLI `render_get_frame_report` reported two swapchain views with diagnostics
    `0`: world view `drawCalls:19`, weapon view `drawCalls:4`.
  - CLI `camera_list` reported `camera.main` at `fov=80`, priority `0`, layer
    mask `1`; `camera.weapon` at `fov=40`, priority `1`, layer mask `2`,
    transparent clear color, and frustum culling disabled.
  - CLI `ecs_find_entities {"key":"camera.weapon","limit":1}` found
    `camera.weapon` parented to `camera.main`.
  - CLI `ecs_find_entities` for the live `blaster` mesh primitive reported
    `componentIds` including `aperture.render.layer` and `renderLayer.mask:2`.
  - CLI `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` reported
    `renderLayer.mask:2`, additive blend, disabled depth, and alpha `0` at
    idle.
  - After reset, MCP `input_action_set {"action":"mouseLook","x":-1,"y":0.5}`
    plus one `ecs_step` produced `yaw:-0.037142857142857144` and
    `pitch:0.018571428571428572`, matching `-26/700` and `13/700`.
  - MCP `input_action_set {"action":"look","x":1,"y":0}` plus one 1/60s
    `ecs_step` produced `yaw:0.03125`, matching `0.075 * 25 / 60`.
  - Forward movement at nonzero yaw moved the player to
    `x:-0.004134966501879944,z:-0.08322144762976791`, proving movement remains
    camera-relative.
  - MCP `input_pointer_click {"x":0.5,"y":0.5}` plus one `ecs_step` produced
    `shotsFired:1` and `shotCooldown:0.25`.
  - MCP jump input produced `verticalVelocity:7.666666666666667`,
    `jumpsRemaining:1`, and `grounded:false`.
- Validation:
  - `pnpm exec vitest run test/app/config-validation.test.ts test/app/input-state-events.test.ts test/app/developer-api.test.ts test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts`
    passed 134 tests.
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --dir packages/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commit:
  - `9b5b6206` — `Align FPS source look and weapon camera`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS player weapon view placement:
  - `references/Starter-Kit-FPS/objects/player.tscn` authors the weapon
    subviewport `CameraItem` at `fov = 40.0`, the `Container` at
    `[1.2, -1, -2.25]`, and the runtime `container_offset` in
    `references/Starter-Kit-FPS/objects/player.gd` is `[1.2, -1.1, -2.75]`.
  - `references/Starter-Kit-FPS/weapons/blaster.tres` and
    `blaster-repeater.tres` leave weapon model position at the `Weapon`
    script default `[0,0,0]`, set rotation `[0,180,0]`, and set
    `muzzle_position = [0.1,-0.4,1.5]`.
  - The port now exposes source weapon-view constants, places both weapon GLB
    roots at `[1.2,-1.1,-2.75]` relative to the player camera, and derives
    muzzle flash placement from source `container.position -
weapon.muzzle_position`, including movement sway offset.
- Hardened generated browser input forwarding:
  - `packages/app/src/browser/input.ts` now treats pointer capture/release as
    best-effort so synthetic or pointer-lock-transition events cannot prevent
    generated input from reaching the simulation worker.
  - Added focused coverage in `test/app/browser-input-forwarding.test.ts`.
- Focused coverage:
  - Added `fps-data` tests for source weapon container, weapon-camera,
    switch/drop, shot-kick, model position, rotation, and muzzle data.
  - Added `fps-controls` tests for source weapon muzzle local/world placement
    and movement sway offset.
- Aperture proof:
  - Reloaded the managed FPS app through Aperture CLI and waited for WebGPU.
  - CLI and MCP `ecs_find_entities {"key":"weapon.0","limit":1}` reported
    active weapon local translation
    `[1.2000000476837158,-1.100000023841858,-2.75]` and diagnostics `0`.
  - A generated center click reported `shotsFired:1`; CLI and MCP
    `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` then reported
    visible sprite alpha `1`, source sprite width/height near `2.56`,
    `depthMode:"disabled"`, and source-derived muzzle translation around
    `[0.9220132231712341,0.27010002732276917,-4.292131423950195]` with
    diagnostics `0`.
  - A fresh managed-browser click through `input_pointer_click` changed
    `fps.state.shotsFired` from `0` to `1`, set `shotCooldown:0.25`, and the
    frame report showed `spriteDraws:2`, `quadInstances:2`, diagnostics `0`.
  - `input_key Space press` plus one `ecs_step` produced
    `verticalVelocity:7.666666666666667`, `jumpsRemaining:1`, and
    `grounded:false`.
  - After generated look input, forward movement changed position from near the
    origin to `[0.02215035724262293,0.9701670107679092,0.08033558259526785]`
    at `yaw:15.977000000029802`, proving movement follows camera yaw instead
    of fixed world `-Z`.
  - Latest post-proof render frame report had diagnostics `0`; latest console
    entries after the fresh session contained no new pointer-capture
    `InvalidStateError`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts test/app/browser-input-forwarding.test.ts test/app/input-state-events.test.ts`
    passed 56 tests.
  - `pnpm --dir packages/app run typecheck`
  - `pnpm --dir packages/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Commits:
  - `15b3cacf` — `Harden generated pointer capture forwarding`
  - `75c4ac57` — `Align FPS weapon view source placement`

## Previous Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source player capsule/body data:
  - `references/Starter-Kit-FPS/objects/player.tscn` positions the
    `CharacterBody3D` at `y = 0.5`, the `Head` at local `y = 1`, and the
    `Collider` at local `y = 0.55`.
  - The source `CapsuleShape3D` uses `radius = 0.3` and `height = 1.0`.
    Godot 4.6 documents `height` as the full capsule height including both
    hemispheres, so the Rapier/Aperture capsule half-height is derived as
    `(1.0 - 2 * 0.3) / 2 = 0.2`.
  - The port now exposes explicit source player constants, keeps
    `PLAYER_EYE_HEIGHT` at `1.5`, starts the player physics body at
    `[0, 0.5, 0]`, and writes the source collider offset `[0, 0.55, 0]` onto
    `player.body`.
- Focused coverage:
  - Added `fps-data` coverage for the source root/head/collider/capsule values,
    the derived capsule half-height, player body start, and eye height.
- Aperture proof:
  - Started the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`
    and waited for WebGPU through Aperture CLI.
  - CLI and MCP entity reads for `player.body` reported capsule
    `radius:0.30000001192092896`, `halfHeight:0.20000000298023224`,
    `offsetTranslation:[0,0.550000011920929,0]`, and diagnostics `0`.
  - CLI and MCP `resource_get {"id":"fps.state"}` after a generated shot and
    Space jump reported `shotsFired:1`, `grounded:false`,
    `jumpsRemaining:1`, `verticalVelocity:7.333333333333334`, and diagnostics
    `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts`
    passed 36 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `70726167` — `Align FPS player capsule source data`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS source reload/respawn semantics:
  - `references/Starter-Kit-FPS/objects/player.gd` reloads the current scene
    when `position.y < -10` or `health < 0`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` applies
    `collider.damage(5)` from enemy attack raycasts, which can trip the same
    reload path.
  - The port now extracts `sourcePlayerShouldRespawn(...)` and uses it both
    after fall/health checks and immediately after enemy attack damage.
  - Source reload reset now restores player position, yaw, pitch, vertical
    velocity, jumps, grounded state, health, weapon index, cooldown,
    shots/hits, enemy health/destroyed state, pulses, last destroyed enemy, the
    player physics body, and transient gameplay visual/audio timers.
  - The respawn frame suppresses weapon switch, shooting, enemy attacks, and
    weapon movement sway so post-reload state is stable.
- Focused coverage:
  - Added `sourcePlayerShouldRespawn(...)` threshold tests for the source
    `position.y < -10` and `health < 0` reload conditions.
- Aperture proof:
  - Started the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless --host 127.0.0.1 --port 5173`
    and waited for WebGPU through Aperture CLI.
  - CLI `resource_set {"id":"fps.state","values":{"health":-1}}` followed by
    one `ecs_step` proved the live worker resets `health` to `100`, `yaw` to
    `0`, `pitch` to `0`, `enemiesRemaining` to `4`, and `destroyedEnemies` to
    `0`.
  - MCP `resource_get {"id":"fps.state"}` read back the same reset state after
    the proof, with diagnostics `0`.
  - Direct lethal enemy-attack proof was not performed because the current MCP
    shortcut set does not expose a safe direct physics-body teleport; the live
    proof exercises the shared predicate and the enemy damage path calls that
    predicate immediately after applying damage.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-input-config.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts`
    passed 35 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `76e885d0` — `Align FPS source respawn reset`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS look input direction with source action-vector
  semantics:
  - `references/Starter-Kit-FPS/objects/player.gd` reads controller look with
    `Input.get_vector("camera_right", "camera_left", "camera_down",
"camera_up")`.
  - The port now maps right-look input to negative generated `look.x`, left-look
    input to positive `look.x`, down-look input to negative `look.y`, and
    up-look input to positive `look.y`.
  - Browser-standard gamepad right-stick X is inverted to match the source
    camera action vector.
  - Keyboard look helpers now follow the same IJKL semantics: `L`/`I` map to
    source right/up and `J`/`K` map to source left/down.
  - Pointer-lock mouse X dispatch is inverted so mouse movement and generated
    action input drive the same source yaw direction.
- Focused coverage:
  - Expanded `test/app/fps-input-config.test.ts` to cover browser-standard
    gamepad X/Y look axes and keyboard IJKL look helpers.
  - Expanded `test/app/fps-hud.test.ts` to cover pointer-lock mouse delta
    conversion through the shared source action-vector helper.
- Aperture proof:
  - Reloaded the managed FPS app through Aperture CLI/MCP and waited for
    WebGPU.
  - `input_gamepad_set` with right-stick right/up and forward movement resolved
    to `look.x:-1`, `look.y:1`, moved `fps.state` to
    `yaw:-0.041666666666666664,pitch:0.041666666666666664`, and advanced the
    player to positive X/negative Z, proving movement is still camera-relative
    under the corrected look signs.
  - A normalized center `input_pointer_click` followed by one `ecs_step`
    produced `shotsFired:1` and `shotCooldown:0.23333333333333334`, proving
    browser pointer shooting works through the managed app.
  - `input_key Space press` followed by one `ecs_step` produced
    `grounded:false`, `jumpsRemaining:1`, and
    `verticalVelocity:7.666666666666667`, proving browser Space jump input
    reaches the player system.
- Validation:
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-hud.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts`
    passed 34 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `68d0ab80` — `Align FPS look input direction`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS HUD styling with source scene/script data:
  - `references/Starter-Kit-FPS/scenes/main.tscn` scales the 128px crosshair
    texture by `0.35`, so the source crosshair renders at `44.8px`.
  - The source health label uses `font_size = 36`, `outline_size = 12`,
    outline alpha `0.470588`, a `45px` line-height-sized rect, and `48px`
    left/bottom offsets.
  - The port now writes those values through explicit HUD source constants and
    CSS variables, while keeping the generated app HUD as DOM overlay state
    derived from ECS health.
  - The health formatter now clamps negative health to `0%` and falls back to
    `100%` for non-finite values.
- Focused coverage:
  - Added `test/app/fps-hud.test.ts` for source HUD constants, health text
    formatting, and CSS variable emission.
- Aperture proof:
  - Reused the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless` and waited for WebGPU
    through Aperture CLI.
  - Captured `.aperture/runtime/fps-hud-source-proof.png`, visually confirming
    the source-sized centered crosshair and large outlined lower-left health
    text.
  - `render_get_frame_report {"summaryOnly":true}` and MCP
    `render_get_frame_report` both reported one live view, 19 mesh draws,
    `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-hud.test.ts test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 32 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `b5496245` — `Align FPS HUD source styling`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS player muzzle sprite sizing with source scene data:
  - `references/Starter-Kit-FPS/objects/player.tscn` uses an
    `AnimatedSprite3D` muzzle node with default `SpriteBase3D.pixel_size`.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` uses 256px atlas
    frames from `sprites/burst.png`, so the unscaled player muzzle world size
    is `256 * 0.01 = 2.56`.
  - The port now spawns `effect.muzzle-burst` as a square `[2.56, 2.56]`
    sprite and keeps the existing source runtime scale range `0.40..0.75`
    from `references/Starter-Kit-FPS/objects/player.gd`.
  - Because the source muzzle is rendered through the transparent weapon
    subviewport on layer 2, the port now disables world-scene depth testing for
    `effect.muzzle-burst`.
- Focused coverage:
  - Added `SOURCE_PLAYER_MUZZLE_WORLD_SIZE` / sprite-size coverage beside the
    existing enemy muzzle and impact size tests.
- Aperture proof:
  - Started/reused the managed FPS app through
    `pnpm --dir fps exec aperture dev up --headless` and waited for WebGPU
    through Aperture CLI.
  - `ecs_find_entities {"key":"effect.muzzle-burst","limit":1}` reported
    `renderSprite.width` and `renderSprite.height` approximately `2.56`,
    `localTransform.scale` approximately `[0.4,0.4,0.4]` while hidden,
    `depthMode:"disabled"`, and diagnostics `0`.
  - After one generated `shoot` step, the same entity reported visible alpha
    `1`, `localTransform.scale:[0.4106,0.4106,0.4106]`, the same `2.56`
    width/height base size, and `depthMode:"disabled"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `815d6af6` — `Align FPS player muzzle sprite size`
  - `69c929e8` — `Align FPS player muzzle overlay depth`

## Earlier Completed FPS/Tooling Slices

- Hardened Starter Kit FPS shooting input for fast click/release cases:
  - The player system now stores a short `0.08s` shoot buffer when the generated
    `shoot` button reports a down edge.
  - Held shooting still uses the upstream-style pressed state and weapon
    cooldown, so repeater/held-fire behavior remains intact.
  - The buffer is consumed after a shot and cleared on reset/respawn so stale
    click edges cannot leak across gameplay resets.
- Focused coverage:
  - Extracted `shouldConsumeBufferedShot(...)` beside the existing jump-buffer
    helper.
  - Added coverage for held shooting, buffered click consumption, empty input,
    and cooldown blocking.
- Aperture proof:
  - Reloaded the managed FPS app through `pnpm --dir fps exec aperture tool
browser_reload` and waited for WebGPU.
  - Paused the generated worker, reset `fps.state`, queued `shoot` pressed
    `true` then `false` before the next `ecs_step`, and read
    `resource_get {"id":"fps.state"}`: `shotsFired:1` and
    `shotCooldown:0.25`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-input-config.test.ts`
    passed 28 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `61684e3a` — `Harden FPS shooting input`
  - `8c5d8bf6` — `Cover FPS shooting input buffer`

## Earlier Completed FPS/Tooling Slices

- Aligned Starter Kit FPS enemy muzzle runtime scale with source script data:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` gives each enemy muzzle
    `AnimatedSprite3D` node a transform scale of `0.5`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` only rewinds/plays the
    muzzle animation and randomizes `rotation_degrees.z`; it does not apply a
    second random scale at fire time.
  - The port now keeps `effect.enemy.*.muzzle.*` sprite dimensions at the
    previously derived `[1.28, 1.28]` source size and writes identity runtime
    transform scale instead of multiplying by the old `0.72` factor.
- Aperture proof:
  - Reused the managed FPS app through `pnpm exec aperture dev up --open`.
  - `browser_wait_for_webgpu` passed with WebGPU ready and diagnostics `0`.
  - MCP `ecs_query {"key":"effect.enemy.0.muzzle.0","limit":1}` reported
    `localTransform.scale:[1,1,1]`, `renderSprite.width` and
    `renderSprite.height` approximately `1.28`, `blendMode:"additive"`, and
    `depthMode:"test"`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 27 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `1c56da13` — `Align FPS enemy muzzle runtime scale`

## Older Completed FPS/Tooling Slices

- Aligned Starter Kit FPS enemy muzzle sprite sizing with source scene data:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` uses two
    `AnimatedSprite3D` muzzle nodes with `transform` scale `0.5`.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` uses 256px atlas
    frames from `sprites/burst.png`.
  - Godot `SpriteBase3D.pixel_size` defaults to `0.01`, so the source enemy
    muzzle world size is `256 * 0.01 * 0.5 = 1.28`.
  - The port now spawns `effect.enemy.*.muzzle.*` sprites at `[1.28, 1.28]`
    instead of `[0.42, 0.42]`.
- Aligned Starter Kit FPS one-shot audio pool behavior with
  `references/Starter-Kit-FPS/scripts/audio.gd`:
  - Source pooled `AudioStreamPlayer` instances use `volume_db = -10`.
  - Each queued one-shot randomizes `pitch_scale` with
    `randf_range(0.9, 1.1)`.
  - The port now routes landing, weapon switch, shooting, jump, enemy attack,
    enemy hurt, and enemy destroy one-shots through source gain and pitch
    scaling.
- Focused coverage:
  - Added source enemy muzzle world-size conversion coverage alongside the
    existing impact sprite size tests.
  - Added source one-shot gain and pitch-scale range coverage.
- Aperture proof:
  - Started the managed FPS app through `pnpm exec aperture dev up --open` and
    waited for WebGPU with Aperture MCP.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` reported
    `renderSprite.width` and `renderSprite.height` as approximately `1.28`,
    `blendMode:"additive"`, and `depthMode:"test"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1577`,
    one view, `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-audio.test.ts` passed 5 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts` passed 5 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 26 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `f5a2f3df` — `Align FPS enemy muzzle sprite size`
  - `d966ebe4` — `Align FPS one-shot audio pool`

## Older Completed FPS/Tooling Slices

- Aligned two small Starter Kit FPS source-fidelity details:
  - `references/Starter-Kit-FPS/objects/enemy.gd` plays the enemy hurt sound
    before the destroy sound on lethal damage. The port now emits
    `enemy-hurt` for every valid enemy hit and then `enemy-destroy` when the
    hit is lethal.
  - `references/Starter-Kit-FPS/objects/impact.tscn` sets
    `AnimatedSprite3D.pixel_size = 0.0025` on 128px atlas frames from
    `sprites/hit.png`, so the source world size is `0.32`. The port now spawns
    impact hit sprites at `[0.32, 0.32]` instead of the older `[0.85, 0.85]`.
- Focused coverage:
  - Added `sourceEnemyDamageAudioEvents(...)` tests for nonlethal, lethal, and
    already-destroyed enemy damage audio cases.
  - Added source `AnimatedSprite3D` world-size conversion coverage for impact
    sprites.
- Aperture proof:
  - Reused the managed FPS app through `pnpm exec aperture dev up --open` and
    waited for WebGPU with Aperture MCP.
  - `ecs_find_entities {"key":"effect.impact-hit.0"}` reported
    `renderSprite.width` and `renderSprite.height` as approximately `0.32`,
    `blendMode:"alpha"`, and `depthMode:"disabled"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1056`,
    one view, `skyboxes:1`, `fogs:1`, 33 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-audio.test.ts` passed 4 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts` passed 4 tests.
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-data.test.ts test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-input-config.test.ts`
    passed 25 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `71ce56f8` — `Align FPS enemy damage audio`
  - `63aacbec` — `Align FPS impact sprite size`

## Historical Completed FPS/Tooling Slices

- Aligned Starter Kit FPS ray-target semantics with upstream
  `references/Starter-Kit-FPS/objects/player.gd` and
  `references/Starter-Kit-FPS/objects/enemy.gd`:
  - Player pellet spread now uses the source RayCast target vector
    `[spreadX, spreadY, -maxDistance]` rotated through the camera basis, rather
    than a hard-coded `spread * 0.035` offset.
  - Enemy look, attack range, and line-of-sight raycasts now target the source
    upper-body point. Because Aperture stores `playerPosition` as the camera eye
    position, that target is represented as `playerEye.y - 0.5`.
  - FPS gamepad input now maps browser-standard gamepad axes explicitly, with
    Y-axis inversion for forward movement and look-up behavior.
- Focused coverage:
  - Added source pellet spread direction tests for centered, corner, and pitched
    camera-basis cases.
  - Updated enemy look/muzzle tests to use the source upper-body target.
  - Added `test/app/fps-input-config.test.ts` for standard gamepad Y-axis
    forward/look-up mapping.
- Aperture proof:
  - Restarted/reused the managed FPS app through `pnpm --dir fps exec aperture
dev up --headless --host 127.0.0.1 --port 5173`, waited for WebGPU, and
    paused/stepped the generated worker through Aperture MCP/CLI tools.
  - `resource_get {"id":"fps.state"}` and
    `ecs_find_entities {"key":"enemy.0"}` showed the live enemy forward vector
    matching the source target `playerEye.y - 0.5`; computed dot product was
    `1.0000000107` for the source target versus `0.9897974997` for the old
    eye-plus target.
  - Reproved the reported gamepad controls after the implementation commit:
    left-stick forward (`y:-1`) moved to
    `playerPosition.z:-0.16666670143604279`; turn-then-forward movement
    produced `yaw:0.08333333333333333`, `x:-0.013872818771099915`, and
    `z:-0.1660883559553863`; right trigger produced `shotsFired:1`; and south
    button jump produced `verticalVelocity:7.666666666`, `jumpsRemaining:1`,
    and `grounded:false`.
  - Reproved aimed shooting after the combined changes: generated look+shoot
    against `enemy.0` reported `shotsFired:1`, `hits:3`, and enemy health
    `100 -> 25`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `123`, one
    view, 18 mesh draws, `skyboxes:1`, `fogs:1`, 32 draw calls, and diagnostics
    `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-data.test.ts test/app/fps-effects.test.ts test/app/fps-audio.test.ts`
    passed 22 tests.
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/fps-audio.test.ts test/app/fps-effects.test.ts`
    passed 21 tests.
  - `pnpm exec vitest run test/app/fps-input-config.test.ts test/app/fps-controls.test.ts test/app/input-state-events.test.ts`
    passed 33 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `0164f083` — `Align FPS ray targets and gamepad axes`

## Archived Completed FPS/Tooling Slices

- Aligned Starter Kit FPS shot impacts with upstream
  `references/Starter-Kit-FPS/objects/player.gd`:
  - Source `action_shoot()` instantiates and plays `objects/impact.tscn`
    inside the `for n in weapon.shot_count` pellet loop whenever a raycast
    collides.
  - The port now creates `effect.impact-hit.0`, `.1`, and `.2` from the maximum
    source weapon `shot_count` instead of collapsing a blaster volley to one
    nearest impact sprite.
  - Impact sprites keep the existing source-style four-frame 30fps atlas
    playback, alpha `1` on visible frames, hidden reset state, and disabled
    depth behavior.
- Preserved Starter Kit FPS `objects/platform_large_grass.tscn` child
  decorations:
  - The source packed scene has `grass`, `grass-small`, and `grass2` child
    models under each `platform-large-grass` instance.
  - The port now spawns those three local children under every large grass
    platform root, so all five authored platforms carry the same source grass
    detail.
- Focused coverage:
  - Added `IMPACT_EFFECT_SLOT_COUNT` / `impactEffectKey(...)` coverage so the
    visible impact slot count stays tied to source weapon pellet counts.
  - Added platform-large-grass child decoration key/transform coverage.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm exec aperture dev up
--headless --host 127.0.0.1 --port 5173` and waited for WebGPU.
  - Used generated `look` input to aim at `enemy.0`, generated `shoot` once,
    and read `fps.state`: `shotsFired:1`, `hits:3`, and `enemy.0` health
    `100 -> 25`.
  - Immediately read `effect.impact-hit.0`, `.1`, and `.2`; each reported
    `renderSprite.color[3] = 1`, `atlasFrame:0`, and distinct impact
    translations around the enemy hitbox.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `6462`,
    one view, 20 mesh draws, `spriteDraws:4`, `skyboxes:1`, `fogs:1`, 37 draw
    calls, and diagnostics `0`.
  - `ecs_find_entities {"tags":["decoration","grass"]}` returned 15 grass
    child entities, including `level.platform-large-grass.0.grass.0` and
    `level.platform-large-grass.4.grass-small.0` with source local transforms.
- Validation:
  - `pnpm exec vitest run test/app/fps-data.test.ts test/app/fps-effects.test.ts test/app/fps-controls.test.ts test/app/fps-audio.test.ts`
    passed 19 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `f14a3e1d` — `Align FPS impact and grass details with source`

- Aligned Starter Kit FPS jump/ceiling handling with upstream
  `references/Starter-Kit-FPS/objects/player.gd`:
  - Source `handle_gravity(...)` only clears upward gravity when
    `is_on_ceiling()` is true, and only refreshes jumps on floor contact after
    downward gravity.
  - The port no longer treats any clipped upward character-controller movement
    as a jump block. It cancels upward velocity only when the Rapier character
    controller reports a ceiling-like collision normal.
  - The port now ignores transient controller-grounded reports while
    source-style upward velocity is active, preventing an ascent frame from
    immediately restoring jump count.
- Focused coverage:
  - Added `hasCeilingCollision(...)` and `sourceGroundedAfterMove(...)` tests.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
--headless --port 5173` and waited for WebGPU.
  - Confirmed pause behavior held by reading `fps.state` at version `1371`,
    waiting one second, and reading version `1371` again.
  - Used Aperture CLI `physics_move_character` against live `player.body` with
    upward/forward motion into `level.platform.2.collider`; the Rapier
    character route returned three collisions with `normal[1]` approximately
    `-0.571`, `-0.572`, and `-0.574`, matching the helper's ceiling threshold.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1891`, one
    view, 16 mesh draws, `skyboxes:1`, 30 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-audio.test.ts test/app/fps-effects.test.ts`
    passed 17 tests.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `20866fb3` — `Align FPS jump ceiling handling`

- Aligned two more Starter Kit FPS source fidelity gaps:
  - `references/Starter-Kit-FPS/objects/player.tscn` keeps
    `SoundFootsteps` autoplaying at `volume_db = -5`, while
    `objects/player.gd` pauses/unpauses it based on grounded horizontal
    velocity components exceeding `1`. The port now computes actual horizontal
    velocity after character movement, keeps the walking loop owned by the
    audio facade, and mutes/unmutes it using the source threshold and gain.
  - `references/Starter-Kit-FPS/scenes/main-environment.tres` uses
    `sprites/skybox.png` as a panorama sky with `energy_multiplier = 0.5`.
    The port now loads that texture, derives an ECS cube texture asset through
    a renderer-independent equirectangular-to-cubemap helper, and spawns
    `skybox.main` at source intensity `0.5`.
- Aperture/library work:
  - Added `spawn.skybox(...)` to `@aperture-engine/app/systems`, so generated
    app systems can author skyboxes through the same app spawn facade as
    cameras, lights, fog, meshes, particles, physics, GLTFs, and prefabs.
  - Added `createEquirectangularCubeTextureAsset(...)` in
    `@aperture-engine/render` for byte-backed RGBA 2D panorama sources. The
    helper uses the same +Z-centered equirect UV convention as the existing
    WebGPU equirect-to-cube compute path, but outputs a renderer-independent
    cube `TextureAsset`.
  - Checkpointed a small app input hardening fix: same-frame virtual press plus
    release events now remain visible for one simulation frame before the
    virtual edge is cleared.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
--open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"skybox.main"}` returned one enabled entity with
    `aperture.render.skybox`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1570`,
    one view, 16 mesh draws, `skyboxes:1`, 30 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/rendering/equirect-cubemap.test.ts test/app/skybox-spawn.test.ts test/rendering/extraction.test.ts`
    passed 70 tests.
  - `pnpm exec vitest run test/app/fps-audio.test.ts test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 15 tests.
  - `pnpm exec vitest run test/app/input-state-events.test.ts` passed 17 tests.
  - `pnpm --filter @aperture-engine/render run typecheck`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/render run build`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `79136c79` — `Align FPS footstep audio with source`
  - `05c40843` — `Add FPS source panorama skybox`
  - `bec7cb87` — `Preserve same-frame virtual input presses`

- Enemy attack ownership:
- Aligned FPS enemy attack ownership with the upstream per-enemy attack model:
  - `references/Starter-Kit-FPS/objects/enemy.gd` gives each enemy its own
    timer/raycast attack path. The port no longer selects only the nearest
    living enemy on each shared attack tick.
  - `PlayerSystem` now iterates every living enemy within
    `ENEMY_ATTACK_DISTANCE` and line of sight, applying damage/audio and
    triggering that attacker's own per-enemy muzzle effect entities.
  - The attacker filter is exposed as a focused `sourceEnemyAttackers(...)`
    helper with unit coverage for alive/range/line-of-sight filtering.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
--open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` and
    `ecs_find_entities {"key":"effect.enemy.3.muzzle.1"}` each returned one
    sprite entity with hidden baseline alpha `0`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `1177`,
    one view, 16 mesh draws, 29 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
    passed 13 tests after the helper extraction.
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `5bb6b7cb` — `Align FPS enemy attack ownership`
  - `f3c31dc8` — `Extract FPS enemy attacker selection`

- Source basis and enemy muzzle ownership:
- Aligned FPS source-basis control helpers and enemy muzzle ownership with the
  upstream scene model:
  - Camera forward/right helpers now match `quatFromEulerYXZ(...)` rotation of
    local camera axes. The focused tests now prove `yaw = Math.PI / 2` moves
    forward along negative X and strafes right along negative Z, matching the
    camera quaternion basis.
  - Buffered jump consumption is now a testable helper and is checked again
    after ground contact refreshes `jumpsRemaining`, so a just-before-landing
    jump buffer can still consume after the source-style grounded refresh.
  - `references/Starter-Kit-FPS/objects/enemy.tscn` owns two muzzle
    `AnimatedSprite3D` children per enemy. The port now spawns per-enemy muzzle
    effect entities (`effect.enemy.0.muzzle.0` ...
    `effect.enemy.3.muzzle.1`) instead of one global enemy muzzle pair.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
--open --port 5173` and waited for WebGPU.
  - `ecs_find_entities {"key":"effect.enemy.0.muzzle.0"}` and
    `ecs_find_entities {"key":"effect.enemy.3.muzzle.1"}` each returned one
    sprite entity with hidden baseline alpha `0`.
  - `ecs_find_entities {"key":"effect.enemy-muzzle.0"}` returned zero
    summaries, proving the old global enemy muzzle key is gone.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `245`,
    one view, 16 mesh draws, 29 draw calls, and diagnostics `0`.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `85cb569d` — `Align FPS source basis and enemy muzzle ownership`

- Enemy muzzle source-child placement:
- Aligned FPS enemy muzzle flash placement with upstream Godot child-transform
  behavior:
  - `references/Starter-Kit-FPS/objects/enemy.tscn` places `MuzzleA` and
    `MuzzleB` as `AnimatedSprite3D` children of the enemy root at local offsets
    `[-0.45, 0.3, 0.4]` and `[0.45, 0.3, 0.4]`.
  - `references/Starter-Kit-FPS/objects/enemy.gd` rotates the enemy root with
    `look_at(player.position + Vector3(0, 0.5, 0), Vector3.UP, true)`, so
    muzzle offsets inherit both yaw and pitch.
  - The port now routes enemy muzzle offsets through the same source-style look
    quaternion used for the visible enemy root instead of applying yaw-only
    placement.
- Aperture proof:
  - Restarted the managed FPS app through `pnpm --dir fps exec aperture dev up
--open --port 5173`, waited for WebGPU, and used generated movement toward
    `enemy.0`.
  - The enemy attack path still fired through normal generated input; `fps.state`
    reported health dropping to `90`, and `render_get_frame_report
{"summaryOnly":true}` reported diagnostics `0`.
  - `ecs_find_entities` read `effect.enemy-muzzle.0` and
    `effect.enemy-muzzle.1`; their random source-style rotations remained in the
    upstream `+/-45 degree` range. The live read missed the short visible muzzle frame
    after pausing, so exact placement is pinned by the focused unit test.
- Validation:
  - `pnpm exec vitest run test/app/fps-controls.test.ts test/app/fps-effects.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `c6b0fa33` — `Align FPS enemy muzzle placement`

- Sprite effect opacity:
- Aligned FPS shot-effect opacity with upstream Godot `AnimatedSprite3D`
  behavior:
  - `references/Starter-Kit-FPS/objects/impact.tscn` plays a four-frame
    non-looping `shot` animation at `30fps` and queues the node free on
    `animation_finished`; it does not fade modulate alpha over lifetime.
  - `references/Starter-Kit-FPS/sprites/burst_animation.tres` does the same
    source-style discrete frame playback for muzzle flashes, with a final null
    frame for the hidden/resting state.
  - The port now uses a testable `fps/src/lib/fps-effects.ts` helper for
    source-style frame selection and constant visible-frame opacity. Impact,
    player muzzle, and enemy muzzle sprites stay at alpha `1` while their
    current source frame is visible, then hide at the end/null frame.
- Aperture proof:
  - Reloaded the managed FPS app, waited for WebGPU, paused simulation, aimed
    at `enemy.0`, and fired through generated `shoot`.
  - The shot reported `shotsFired:1`, `hits:3`, and `enemy.0` health `25`.
  - Immediate `ecs_find_entities {"key":"effect.impact-hit"}` reported
    `atlasFrame:0`, `uvRect:[0,0,0.5,0.5]`, `color:[1,1,1,1]`, and
    `renderSprite.depthMode:"disabled"`.
  - After the animation elapsed, `effect.impact-hit` reported translation
    `[0,-100,0]`, full fallback UVs, and `color:[1,1,1,0]`.
- Validation:
  - `pnpm exec vitest run test/app/fps-effects.test.ts test/app/fps-controls.test.ts`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
- Committed implementation:
  - `99aa7fbf` — `Align FPS sprite effect opacity`

- Control proof and CLI client cleanup coverage:
- Reproved the latest reported FPS controls through Aperture MCP/CLI tools on
  the managed `fps/` session:
  - Generated `shoot` input from a paused deterministic step incremented
    `shotsFired` by `1` and set `shotCooldown` to `0.25`.
  - Canvas `input_pointer_click` on the running app incremented `shotsFired`
    by `1`, proving the browser click path still drives shooting.
  - Generated `move` and browser `KeyW` input at yaw `Math.PI / 2` moved the
    player by `+0.083333` on X and `0` on Z, proving movement is relative to
    camera yaw.
  - Browser `Space` input raised the player by `0.127778`, set
    `grounded:false`, `verticalVelocity:7.666667`, and `jumpsRemaining:1`.
  - An aimed shot from spawn toward `enemy.0` registered `3` pellet hits and
    changed enemy health `100 -> 25`, proving fired shots still damage hitboxes.
- Investigated an apparent Aperture tool/browser cleanup concern. Playwright
  `connectOverCDP` cleanup remained the existing `browser.close()` path; added
  `test/cli/tool-client.test.ts` to cover that browser-backed CLI tools close
  their Playwright CDP client after use.
- Validation:
  - `pnpm exec vitest run test/cli/tool-client.test.ts test/app/fps-controls.test.ts`
  - `pnpm --filter @aperture-engine/cli run build`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run build`

- Impact sprite depth:
- Added first-class sprite depth-mode authoring so ECS-authored sprites can opt
  into source-style no-depth-test rendering without app-local WebGPU plumbing.
- New render API/data path:
  - `SpriteDepthMode.Test` remains the default and preserves existing sprite
    behavior.
  - `SpriteDepthMode.Disabled` validates through authoring, extracts into quad
    batches, survives packed snapshot encoding, and specializes WebGPU sprite
    pipelines with `depthCompare: "always"` while keeping depth writes disabled.
  - App/entity summaries now expose `renderSprite.depthMode` so Aperture tools
    can prove authored depth behavior.
- Aligned FPS `effect.impact-hit` with upstream
  `references/Starter-Kit-FPS/objects/impact.tscn`, where the source
  `AnimatedSprite3D` sets `no_depth_test = true`.
- Aperture proof:
  - Reused the managed FPS session at `http://127.0.0.1:5173/`; WebGPU
    readiness returned `webgpuOk:true`.
  - `ecs_find_entities {"key":"effect.impact-hit"}` reported
    `renderSprite.depthMode:"disabled"`.
  - `ecs_find_entities {"key":"effect.muzzle-burst"}` reported the default
    `renderSprite.depthMode:"test"`.
  - `render_get_frame_report {"summaryOnly":true}` reported frame `357`,
    one view, 16 mesh draws, 29 total draw calls, and `diagnostics:0`.
- Validation:
  - `pnpm exec vitest run test/rendering/extraction.test.ts test/rendering/snapshot-packed-encoding.test.ts test/webgpu/sprite-pipeline.test.ts test/app/developer-api.test.ts`
  - `pnpm --filter @aperture-engine/render run typecheck`
  - `pnpm --filter @aperture-engine/webgpu run typecheck`
  - `pnpm --filter @aperture-engine/app run typecheck`
  - `pnpm --filter @aperture-engine/render run build`
  - `pnpm --filter @aperture-engine/webgpu run build`
  - `pnpm --filter @aperture-engine/app run build`
  - `pnpm --filter @aperture-engine/cli run typecheck`
  - `pnpm --dir fps run typecheck`
  - `pnpm --dir fps run build`
  - `pnpm --dir racing run typecheck`
  - `pnpm --dir racing run build`
  - `pnpm --dir shadow-lab run typecheck`
  - `pnpm --dir shadow-lab run build`
  - `git diff --check`
- Committed implementation:
  - `81ab390e` — `Add sprite depth mode for FPS impacts`

- Source-like HUD:
  - Aligned the visible FPS browser HUD with upstream `scenes/main.tscn` and
    `scripts/hud.gd`: only the crosshair image and large health percentage
    remain visible.
  - Removed the port-only weapon counter, enemy counter, clear banner, hit
    flash, damage flash, and enemy-destroyed overlay from the DOM/CSS/browser
    HUD layer.
  - Kept generated gameplay signals/resources intact for proof and future
    tooling; this is only a visible HUD parity change, not a simulation-state
    removal.
  - Aperture proof:
    - Fresh managed FPS session at `http://127.0.0.1:5173/`, WebGPU healthy.
    - `render_get_frame_report {"summaryOnly":true}` reported one view, 16 mesh
      draws, 29 total draw calls, and `diagnostics:0`.
    - `browser_screenshot` wrote `/tmp/fps-source-like-hud.png`; visual
      inspection showed only crosshair plus bottom-left `100%` health over the
      WebGPU scene.
    - `browser_console_logs {"lines":20}` showed only Vite reconnect/debug lines
      plus the known deprecated-parameter warning.
  - Validation:
    - `git diff --check -- fps/index.html fps/src/hud.ts`
    - `pnpm exec vitest run test/app/fps-controls.test.ts`
    - `pnpm --dir fps run typecheck`
    - `pnpm --dir fps run build`
    - `pnpm --dir racing run typecheck`
    - `pnpm --dir racing run build`
    - `pnpm --dir shadow-lab run typecheck`
    - `pnpm --dir shadow-lab run build`
  - Committed implementation:
    - `f293ecdf` — `Align FPS HUD with source`

- Enemy hitbox and look target:
  - Aligned enemy hitboxes with upstream `objects/enemy.tscn`: the source
    `CollisionShape3D` sphere is offset by local `y=0.25`, and the port now
    applies the same offset to each keyed ECS hitbox entity at spawn time and
    during per-frame enemy hover updates.
  - Aligned enemy facing with upstream `objects/enemy.gd`: enemies now pitch/yaw
    toward `player.position + Vector3(0, 0.5, 0)` instead of yaw-only look.
  - Kept gameplay authority in ECS by writing `LocalTransform` on the visible
    enemy roots and `${enemy}.hitbox` physics entities; no renderer-owned
    collision or aim state was introduced.
  - Committed implementation:
    - `684ccc2f` — `Align FPS enemy hitbox and look target`

- Player damage threshold:
  - Aligned player damage/reload semantics with upstream
    `objects/player.gd::damage(amount)`: player health now reaches exactly `0`
    without resetting, and the scene-style reset only happens once health drops
    below `0`.
  - Removed the enemy attack damage clamp, so source-style repeated
    `collider.damage(5)` calls can move health from `0` to `-5` instead of
    sticking at zero.
  - Committed implementation:
    - `f3ed9e1f` — `Align FPS player damage threshold`

- Weapon viewmodel motion:
  - Replaced the FPS weapon-view cooldown recoil approximation with a source-like
    viewmodel offset from upstream `objects/player.gd`: the active weapon now
    lerps toward `-localVelocity / 30`, and shooting adds a transient `+0.25`
    local-Z kick before smoothing back.
  - Kept this ECS-owned by writing `LocalTransform` on the keyed weapon entities
    (`weapon.0`, `weapon.1`). No renderer-owned first-person weapon container was
    introduced.
  - Extracted `weaponViewmodelOffsetTarget(...)` into `fps/src/lib/fps-controls.ts`
    and covered forward, strafe, and diagonal normalization in
    `test/app/fps-controls.test.ts`.
  - Committed implementation:
    - `582cfed3` — `Add FPS weapon viewmodel kick`
    - `60df8919` — `Cover FPS weapon viewmodel offset`

- Input hardening and impact placement:
  - Hardened the browser-facing FPS shoot path by forwarding primary
    `pointerdown` / `pointerup` events through the same generated `shoot`
    action used for pointer-lock mouse input.
  - Added a short `0.12s` jump buffer and prevented lingering grounded contact
    from cancelling the jump frame.
  - Added source-like impact placement from upstream `objects/player.gd`:
    impact sprites now use nearest raycast hit point plus `normal / 10`.
  - Committed implementation:
    - `f64cb627` — `Harden FPS input handling`

- Generated `resource_set` proof tooling:
  - Added schema-validated generated-worker `resource_set` support so Aperture
    CLI/MCP tools can patch initialized app resources by id during deterministic
    proof setup.
  - Registered `resource_set` in the CLI/MCP tool surface and documented the
    now-current resource get/set decision.
  - Used the new tool in the FPS proof instead of app-specific debug hooks:
    `resource_set` fixed the player yaw for deterministic setup, generated
    `move` input drove the real character controller into enemy range, health
    changed `100 -> 95`, and `ecs_find_entities` read enemy muzzle sprite
    rotations `-0.363` and `-0.516` radians, both inside the upstream `±45°`
    roll range.
  - Committed implementation/tooling:
    - `2f4773e7` — `Add generated resource set tool`

- Muzzle flash random style:
  - Added source-style muzzle flash randomization from upstream
    `objects/player.gd` and `objects/enemy.gd`.
  - Player shots now sample the authored `randf_range(-45,45)` sprite roll and
    `randf_range(0.40,0.75)` sprite scale for `effect.muzzle-burst`.
  - Enemy attacks now sample independent source-like Z rolls for both
    `effect.enemy-muzzle.0` and `effect.enemy-muzzle.1`.
  - Kept the effect state ECS-owned by writing `Sprite.rotation` and
    `LocalTransform.scale`; no renderer-owned effect objects or gameplay state
    were introduced.
  - Validation:
    - `pnpm exec vitest run test/app/fps-controls.test.ts`
    - `pnpm --dir fps run typecheck`
    - `pnpm --dir fps run build`
    - `pnpm run typecheck`
    - `pnpm run typecheck:test`
    - `pnpm --dir racing run typecheck`
    - `pnpm --dir racing run build`
    - `pnpm --dir shadow-lab run typecheck`
    - `pnpm --dir shadow-lab run build`
    - Aperture CLI/runtime proof from `fps/`: `browser_reload`,
      `browser_wait_for_webgpu`, generated `input_action_set`, `ecs_step`,
      `ecs_find_entities`, `ecs_get_entity`, and `resource_get`.
    - Proof observed player muzzle `shotsFired:1`, sprite scale
      `[0.4168,0.4168,0.4168]`, `Sprite.rotation:-0.2156`, and alpha `0.8333`.
    - Proof observed enemy range still gated correctly (`farHealthDelta:0`,
      `nearHealthDelta:-5`) and both enemy muzzle sprites had source-like roll:
      `0.213` and `-0.0584`.
  - Committed implementation:
    - `861368bd` — `Randomize FPS muzzle flash style`

## Earlier Completed FPS Slices

- Player shadow proof cleanup:
  - Extracted FPS `player.shadow` setup into `#spawnPlayerShadow()` while
    keeping the existing upstream-textured blob material/sampler path intact.
  - Reproved the textured blob after an explicit Aperture `browser_reload`.
    Important tooling note: proof screenshots written under `fps/.aperture/`
    triggered Vite reloads during this run; write inspection screenshots to
    `/tmp` when the app must stay stable.
  - Close inspection proof used a low-priority Aperture agent camera fitted to
    `player.shadow`, disabled frustum culling only on that proof camera, and
    compared normal scale against a temporary scale-zero shadow. The visible and
    hidden captures differed (`43825` vs `35395` bytes), with local PNG
    analysis reporting `207995` changed pixels and max channel-distance `26`.
    The shadow scale was restored to `[1,1,1]` afterward.
  - Committed implementation cleanup:
    - `e884df65` — `Extract FPS player shadow setup helper`
- Canvas shooting and enemy attack range:
- Fixed the browser-facing shoot path: primary mouse down on the FPS canvas now
  drives the generated `shoot` action even before pointer lock succeeds, while
  still requesting pointer lock for look input. This covers managed-browser and
  browser-denied pointer-lock cases where a click previously left
  `shotsFired` unchanged.
- Aligned enemy attack cadence/range with upstream `objects/enemy.tscn` /
  `objects/enemy.gd`: attack interval is now `0.25` seconds and the source
  raycast range is represented as a 5-unit line-of-sight damage gate.
- Reproved the reported controls through Aperture runtime tools: generated
  shoot increments `shotsFired`, W after yaw moves relative to camera direction,
  and jump leaves the ground with positive vertical velocity.
- Committed implementation:
  - `ba78c09e` — `Fix FPS canvas shooting before pointer lock`
  - `e9e94c9c` — `Align FPS enemy attack range`

- Weapon recoil:
  - Added source-style weapon recoil from upstream `objects/player.gd` /
    `weapons/*.tres`: each shot now samples the weapon's authored min/max
    camera kick, nudges pitch/yaw, and adds a short backwards movement impulse.
  - Kept recoil ECS/simulation-owned by feeding the transient impulse through
    the existing character-controller movement path; no renderer-owned weapon or
    camera state was introduced.
  - Added focused control-helper coverage proving recoil points backward
    relative to camera yaw.
  - Committed implementation: `6ea8464a` — `Add FPS weapon recoil kick`.
- Player blob shadow:
  - Added a source-like player blob shadow as ECS-authored render data. Setup
    now registers the upstream `blob_shadow` sprite, creates an unlit
    transparent material/sampler asset, and spawns `player.shadow` as a
    non-casting, non-receiving mesh plane at the player's feet.
  - `PlayerSystem` keeps `player.shadow` aligned with
    `fps.state.playerPosition` without adding a renderer-owned player scene
    graph or hidden gameplay state.
  - Re-ran the reported control concerns through Aperture CLI stepping:
    camera-relative movement follows yaw, jump leaves the ground with positive
    vertical velocity, and generated shoot input increments `shotsFired`.
  - Committed implementation: `694d60a1` — `Add FPS player blob shadow`.
- Full-clear proof:
  - Proved the Starter Kit FPS port can reach the all-enemies-cleared gameplay
    state through generated gameplay input only. The proof drove configured
    `move`, `look`, `jump`, and `shoot` actions through Aperture tools; it did
    not mutate enemy health, player transforms, or ECS gameplay state.
  - Replaced the failed straight-line route with a platform-aware path: start
    platform -> enemy.1 perch -> southeast grass platform for `enemy.2` ->
    center platform edge -> elevated northeast platform for `enemy.3`.
  - Final proof state: `health:55`, `shotsFired:12`, `hits:16`,
    `enemiesRemaining:0`, `destroyedEnemies:4`, every `enemyDestroyed.*:true`,
    `gameStatus:"cleared"`, HUD enemies text `CLEAR`, and
    `body[data-game-status="cleared"]`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-full-clear-proof.png`.
- Landing camera bob:
- Added upstream-style landing camera bob from `objects/player.gd`: landing
  after a jump dips the first-person camera by `-0.1`, then lerps it back toward
  the neutral player eye position at the upstream recovery rate.
- Kept the effect ECS-owned by writing the bobbed `LocalTransform` on
  `camera.main`; no renderer-owned camera object was introduced.
- Added `landingBob` and `landingPulse` to `fps.state` so Aperture tools can
  prove both the landing pulse and recovery.
- Committed:
  - `57c48500` — `Add FPS landing camera bob`
  - `bff2a66f` — `Add FPS weapon switch animation`
- Weapon switch:
  - Added source-like weapon switch animation from upstream
    `objects/player.gd`: the current weapon lowers, the active model swaps, then
    the new weapon raises back to its authored on-screen position.
  - Kept the implementation ECS-first by animating `LocalTransform` on the keyed
    weapon entities (`weapon.0` and `weapon.1`) rather than adding a mutable
    renderer-owned weapon container.
  - Added `weaponVisualIndex`, `weaponSwitchProgress`, and `weaponSwitchPhase`
    to `fps.state` for generated-worker proof and future HUD/tooling inspection.
- Controls:
  - Fixed pointer-lock shooting in the browser HUD. While the canvas is locked,
    primary mouse down/up now drives the generated `shoot` action directly, and
    release is delayed by 40 ms so a fast click cannot collapse into an
    unobservable same-frame virtual down/up pair.
  - Moved FPS control math into `fps/src/lib/fps-controls.ts` and added
    `test/app/fps-controls.test.ts` to lock camera-relative movement, diagonal
    normalization, pitch-aware shot direction, and upward-move snap behavior.
  - Kept movement relative to camera yaw: after a rightward look, W moves mostly
    along +X instead of world -Z.
  - Fixed unreliable jumps by using the no-snap character-controller settings
    only while desired vertical movement is upward. Normal grounded movement
    still uses the configured snap-to-ground distance.
- Authored clouds:
  - Added the remaining authored cloud instances from upstream
    `scenes/main.tscn`; the FPS port now spawns 11 cloud roots instead of the
    previous 4.
  - Preserved source cloud transforms as ECS data by storing source-derived
    quaternions and scale values in `CLOUDS`, with setup passing `rotation`
    into `spawn.gltf(...)` instead of collapsing cloud orientation to yaw-only
    values.
  - Added `src/systems/clouds.system.ts`, an ECS system that applies
    deterministic source-like hover motion equivalent to upstream
    `objects/cloud.gd`.
- Enemy destruction/status:
  - Added explicit enemy-destruction status for the Starter Kit FPS port,
    following the upstream `objects/enemy.gd` `destroy()` behavior by making
    dead enemies non-renderable/non-colliding instead of leaving active hitboxes.
  - `fps.state` now summarizes `enemyDestroyed`, `enemiesRemaining`,
    `destroyedEnemies`, `enemyDestroyedPulse`, `lastDestroyedEnemy`, and
    `gameStatus` so generated-worker tools can prove enemy death and HUD state.
  - The FPS HUD now flashes on enemy destruction, reports the remaining enemy
    count from generated signals, and has a clear-state banner for the eventual
    all-enemies-cleared state.
- Tooling support:
  - ECS entity lookup summaries now expose top-level `enabled` for entities with
    the `Enabled` component, and snapshot diffs include enabled-state changes.
- Committed:
  - `aaa83107` — `Port Starter Kit FPS slice to Aperture`
  - `37bc0e5e` — `Add FPS pointer lock look bridge`
  - `bd85c5e4` — `Add FPS physics character and raycast gameplay`
  - `fc8dd87e` — `Update handoff for FPS physics slice`
  - `4f44aa73` — `Add FPS HUD damage and hit feedback`
  - `40eb3bc3` — `Update handoff for FPS HUD feedback`
  - `70959002` — `Animate FPS sprite effects and expose sprite summaries`
  - `ba516abc` — `Preserve same-frame input button edges`
  - `35f50305` — `Add FPS enemy destruction status feedback`

## Latest Validation

- `git diff --check -- fps/index.html fps/src/hud.ts`
- `pnpm exec vitest run test/app/fps-controls.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Aperture CLI/runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5173/`;
    `browser_wait_for_webgpu` succeeded with `webgpuOk:true`.
  - `render_get_frame_report {"summaryOnly":true}` reported `diagnostics:0`.
  - `browser_screenshot` wrote `/tmp/fps-source-like-hud.png`; visual
    inspection confirmed the source-like visible HUD: crosshair plus bottom-left
    health only.
  - `browser_console_logs {"lines":20}` showed only Vite reconnect/debug lines
    plus the known deprecated-parameter warning.
- Previous player-shadow Aperture CLI/runtime proof from `fps/`:
  - Active managed session: `http://127.0.0.1:5174/`, WebGPU healthy.
  - `resource_get {"id":"fps.state"}` after reset reported fresh gameplay:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `gameStatus:"active"`.
  - `render_explain_entity {"key":"player.shadow"}` reported
    `rendered:true`, `hasBounds:true`, `renderKey:"mesh-draw:2"`,
    `boundsKey:"bounds:2:0"`, and zero diagnostics.
  - Deterministic paused stepping with generated actions reproved the reported
    controls: after yaw `0.8333`, forward movement produced `dx:1.8504`,
    `dz:-1.681`; jump produced `grounded:false`, `verticalVelocity:7`,
    `jumpsRemaining:1`, `deltaY:0.3667`; shoot produced `shotsFired:1` and
    `shotCooldown:0.2333`.
  - The live FPS session was reset afterward to fresh gameplay.
- Previous full-clear Aperture CLI/runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and drove only configured generated
    actions: `move`, `look`, `jump`, and `shoot`.
  - Killed `enemy.0` from spawn: `shotsBefore:0`, `shotsAfter:2`,
    `health:0`, `dist:7.02`.
  - Moved to a safe west perch on the start platform and killed `enemy.1`:
    `shotsBefore:2`, `shotsAfter:5`, `health:0`, `dist:7.86`.
  - Routed over the southeast platform gap through `center edge`,
    `jump to ground4 corner`, and `ground4 center` without falling, then killed
    `enemy.2`: `shotsBefore:5`, `shotsAfter:8`, `health:0`, `dist:3.92`.
  - Routed back through the center/north edge, jumped to `platform3`, jumped to
    the elevated northeast grass platform, and killed `enemy.3`:
    `shotsBefore:8`, `shotsAfter:12`, `health:0`, `dist:4.81`.
  - Final `fps.state`: `health:55`, `enemiesRemaining:0`,
    `destroyedEnemies:4`, every `enemyDestroyed.*:true`,
    `gameStatus:"cleared"`, `shotsFired:12`, `hits:16`.
  - HUD/browser proof: `#enemies` text was `CLEAR` and
    `document.body.dataset.gameStatus` was `cleared`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-full-clear-proof.png`.
  - The live FPS session was reset afterward and left paused at fresh gameplay:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `gameStatus:"active"`.
- `pnpm run check:progress`
- Previous landing-bob validation:
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped generated jump/landing input.
  - Initial proof state: `landingBob:0`, `landingPulse:0`, `cameraY:1.4945`.
  - Airborne proof state: `grounded:false`, `verticalVelocity:7.6667`,
    `playerY:1.6223`.
  - Landing proof state: `grounded:true`, `landingBob:-0.1`,
    `landingPulse:1`, `playerY:1.5201`, `cameraY:1.4201`, proving camera Y
    includes the landing dip.
  - Recovery proof state: `landingBob:-0.0175`, `landingPulse:1`,
    `cameraY:1.5026`.
  - Reset proof state: `health:100`, `enemiesRemaining:4`, `landingBob:0`,
    `landingPulse:0`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Previous weapon-switch validation:
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped generated `switchWeapon`.
  - Initial proof state: `weaponIndex:0`, `weaponVisualIndex:0`,
    `weaponSwitchPhase:"ready"`, `weapon0Y:-0.48`, `weapon1Y:-100`.
  - Hiding proof state: `weaponIndex:0`, `weaponVisualIndex:0`,
    `weaponSwitchPhase:"hiding"`, `weaponSwitchProgress:0.25`,
    `weapon0Y:-1.2207`, `weapon1Y:-100`.
  - Raising proof state: `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"raising"`, `weaponSwitchProgress:0.6528`,
    `weapon0Y:-100`, `weapon1Y:-1.1744`.
  - Finished proof state: `weaponIndex:1`, `weaponVisualIndex:1`,
    `weaponSwitchPhase:"ready"`, `weaponSwitchProgress:1`,
    `weapon1Y:-0.48`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
  - The live FPS session was reset to fresh gameplay afterward:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`,
    `weaponIndex:0`, `weaponVisualIndex:0`, `weaponSwitchPhase:"ready"`,
    then resumed.
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Previous controls validation:
- `pnpm exec vitest run test/app/fps-controls.test.ts`
- `pnpm --dir fps run typecheck`
- `pnpm --dir fps run build`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed FPS at `http://127.0.0.1:5174/`; `browser_wait_for_webgpu`
    succeeded with `webgpuOk:true` and no `lastError`/`lastFailure`.
  - Paused/reset the generated worker and stepped a jump input:
    `grounded:false`, `verticalVelocity:7.6667`, `jumpsRemaining:1`,
    `playerY:1.6225`.
  - Stepped 40 frames of generated look input, then held W for 30 frames:
    `yaw:1.6667`, `dx:2.4885`, `dz:0.2393`, proving movement follows camera
    yaw.
  - Stepped generated `shoot` and browser pointer-click input:
    `generatedShots:1`, `browserClickShots:1`.
  - Final runtime status remained `webgpuOk:true` with no `lastError` or
    `lastFailure`.
  - The live FPS session was reset to fresh gameplay afterward:
    `health:100`, `enemiesRemaining:4`, `shotsFired:0`, `hits:0`, then resumed.
- Previous cloud validation:
- `pnpm --filter @aperture-engine/app typecheck`
- `pnpm --filter @aperture-engine/app build`
- Previous cloud Aperture CLI proof:
  - `ecs_list_systems` included `src/systems/clouds.system.ts`.
  - `ecs_find_entities { tags:["cloud"] }` returned 11 `deco.cloud.*`
    entities.
  - After 90 `ecs_step` frames, all 11 cloud roots had changed Y translation
    while X/Z, scale, and rotation stayed stable.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-cloud-hover-proof.png`.
- Previous enemy-destruction validation:
- `pnpm exec vitest run test/app/developer-api.test.ts -t "publishes JSON-safe entity lookup summaries"`
- `pnpm exec vitest run test/app/developer-api.test.ts`
- Previous sprite/input validation:
- `pnpm exec vitest run test/app/input-state-events.test.ts`
- Previous physics slice validation:
- `pnpm run typecheck` from repo root
- `pnpm run typecheck:test` from repo root
- `pnpm --filter @aperture-engine/app typecheck && pnpm --filter @aperture-engine/app build`
- `pnpm --filter @aperture-engine/cli typecheck && pnpm --filter @aperture-engine/cli build`
- `pnpm --filter @aperture-engine/render typecheck && pnpm --filter @aperture-engine/render build`
- `pnpm run typecheck && pnpm run build` from `fps/`
- `pnpm run typecheck && pnpm run build` from `racing/`
- `pnpm run typecheck && pnpm run build` from `shadow-lab/`
- Aperture CLI runtime proof from `fps/`:
  - Restarted managed dev at `http://127.0.0.1:5174/`.
  - `browser_status` reported `status:"running"`, `webgpuOk:true`, no
    `lastError`/`lastFailure`.
  - `asset_list` reported FPS GLTF/audio/texture assets ready, including
    `muzzle-burst` and `impact-hit`.
  - `render_get_diagnostics` reported no worker failure, no frame diagnostics,
    and no last render error.
  - `physics_summary` reported Rapier `simulation-worker`, 18 bodies, 18
    colliders, and 0 unsupported features.
  - `ecs_find_entities` confirmed `player.body` has `RigidBody`,
    `Collider`, `KinematicTarget`, `PhysicsVelocity`,
    `PhysicsCharacterController`, and `PhysicsBodyState`.
  - `physics_move_character` on `player.body` returned grounded movement and a
    target translation through Rapier.
  - `physics_raycast_all` from the player eye toward `enemy.0` hit
    `enemy.0.hitbox` first.
  - Stepped input proof aimed at `enemy.0`, fired once, and read `fps.state`:
    `shotsFired:1`, `hits:3`, `enemy.0` health `100 -> 25`.
  - `browser_screenshot` wrote
    `fps/.aperture/runtime/fps-physics-raycast-proof.png`.

## Current Notes

- No managed FPS session should be left running after final cleanup. If a future
  proof needs the app, start it with
  `pnpm --dir fps exec aperture dev up --headless --port 5173`.
- The latest HUD slice deliberately removed browser-only visible status
  elements, but generated `fps.state` values and signal summaries still expose
  `weaponName`, `enemiesRemaining`, `gameStatus`, hit/damage pulses, and related
  proof data to Aperture tools.
- The generated-input full-clear proof is now packaged as
  `pnpm --dir fps run smoke:full-clear`. The script uses explicit platform
  waypoints, grounded landing checks, and double-jump steps before claiming
  `gameStatus:"cleared"`.
- Pre-existing untracked screenshots,
  racing parity artifacts, and `racing/parity/` remain outside commits.
- Muzzle flash proof reads should use `ecs_find_entities` / `ecs_get_entity`
  immediately after the shot/attack frame; reset correctly hides the effect
  sprites and restores baseline scale/rotation.
- Use `value:0` rather than `pressed:false` for button-release CLI scripts when
  an immediate following `ecs_step` proof must be unambiguous.
- For held look input through the CLI, queue `input_action_set` with `x`/`y`
  before each `ecs_step`; a single vector input is consumed by one frame.
- `ecs_find_entities` now includes `enabled` and `renderSprite`, so future
  proofs can read entity enabled state, sprite `uvRect`, `atlasFrame`, and
  alpha directly instead of depending on fragile pixel timing.
- `render_readback_samples` / `browser_pick_pixel` still need follow-up if
  future FPS proofs require pixel samples; screenshot capture is reliable.

## Recommended Next Task

Continue the FPS port with another visible Starter Kit fidelity slice. Good
next options are improving enemy attack polish, adding more source-like
weapon/player detail parity, filling any remaining impact-rendering differences
such as depth behavior, or hardening the skybox orientation/readback proof now
that the reusable full-clear smoke route exists.

---

# Handoff - Racing Library-Gap Plan Complete

**Updated:** 2026-06-16 21:56 PDT

Current user-directed work executed
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working. The plan is complete for
this pass.

## Latest Completed Slice

- Finished the final no-cache racing verification slice after the post-port
  genericity cleanup commit.
- Stopped the racing managed dev session, removed `racing/node_modules/.vite`,
  and relaunched racing with
  `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173`.
- Verified fresh racing runtime through Aperture MCP: managed browser running
  on `127.0.0.1:5173` / CDP `6173`, `webgpuOk:true`, no
  `lastError`/`lastFailure`, submitted directional shadows, clean baseline
  render snapshot, and console tail with only Vite logs plus the known
  deprecated-parameter warning.
- Proved fresh-session smoke/HUD by pausing ECS, applying `drive=[1,1]`,
  resuming briefly, pausing, and reading MCP status:
  `particleEmitters:306`, `liveParticles:906`, `texturedEmitters:306`,
  `diagnostics:0`, `started:true`, `throttle:1`, `speed:0.937`, and
  `driftIntensity:1.057`.
- Verified Shadow Lab stayed isolated on its own Aperture session at
  `127.0.0.1:8861` / CDP `9861`; typecheck/build still pass.

## Latest Validation

- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- `pnpm exec aperture dev down` from `racing/`
- `rm -rf racing/node_modules/.vite`
- `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173` from
  `racing/`
- Aperture MCP `browser_status`, `browser_console_logs`,
  `render_get_snapshot_summary`, `input_reset`, `ecs_pause`,
  `input_action_set`, and `ecs_resume` for the racing proof described above.
- `pnpm exec aperture dev status` from `shadow-lab/` confirmed Shadow Lab's
  separate managed session remained alive on `127.0.0.1:8861` / CDP `9861`.

## Current Notes

- Managed racing is running at `http://127.0.0.1:5173/` through Aperture dev
  and was left resumed after the fresh no-cache smoke proof with virtual inputs
  reset.
- Shadow Lab remains alive at `http://127.0.0.1:8861/`; it was not restarted or
  attached through racing's MCP tools.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Return to the broader visible-feature queue. The first ready task is
`task-3097 — Replace placeholder PMREM with GGX/VNDF prefilter sampling`
anchored to `references/three.js/src/extras/PMREMGenerator.js` and
`references/engine/src/scene/graphics/reproject-texture.js`.

---

# Handoff - Generated Audio Unlock Startup

**Updated:** 2026-06-16 19:06 PDT

Current user-directed work is executing
`racing/docs/RACING_EXPERIENCE_LIBRARY_GAP_PLAN.md` in validated, committed
slices while keeping racing and Shadow Lab working.

## Latest Completed Slice

- Hardened `@aperture-engine/audio` voice realization so snapshot-authored
  playback intent is distinct from Web Audio source starts. While the backend is
  suspended, voices can track loop/one-shot epochs, but buffer sources and
  streaming sources are not created or started.
- Autoplay loops now start after `unlock()`/resume when the backend is running.
  Pre-unlock one-shot epoch bumps are treated as stale and dropped; fresh
  post-unlock one-shots still play. Running-context ducking still responds to
  pending decode intent, preserving existing mixer behavior.
- Added engine-level tests for initially suspended autoplay loops and stale
  pre-unlock one-shot suppression, plus generated-browser integration coverage
  proving `installGeneratedAudio(...)` keeps worker-authored loop intent silent
  until unlock.
- Rebuilt `@aperture-engine/audio` and `@aperture-engine/app`, then restarted
  only racing through Aperture after clearing `racing/node_modules/.vite`.
  Shadow Lab stayed on its existing `8861` managed session.
- Fresh racing console after the cold-cache relaunch had no new
  `AudioContext was not allowed to start` warning. Held `KeyW` + `KeyA` through
  Aperture input tooling and reproved smoke at `emitters:306`,
  `liveParticles:906`, `texturedEmitters:306`, with no runtime
  `lastError`/`lastFailure`.

## Latest Validation

- `pnpm exec vitest run test/audio/resume.test.ts test/app/audio-integration.test.ts`
- `pnpm exec vitest run test/audio/voice-manager.test.ts test/audio/streaming.test.ts test/audio/fixes.test.ts`
- `pnpm exec vitest run test/audio`
- `pnpm --filter @aperture-engine/audio run typecheck`
- `pnpm --filter @aperture-engine/audio run build`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed Aperture racing proof described above: `dev down`, cache clear,
  `dev up --open --host 127.0.0.1 --port 5173`, WebGPU wait, console tail,
  held-input smoke proof, post-drive status.
- Managed Shadow Lab proof: existing session reported `running`,
  `webgpuOk:true`, `lastError:null`, `lastFailure:null`; console tail only had
  Vite connection logs.

## Current Notes

- The managed racing app is running at `http://127.0.0.1:5173/` and was left
  resumed after a cache-busted restart. Inputs were released after the live
  smoke check.
- Shadow Lab remains alive at `http://127.0.0.1:8861/`; it was validated by
  typecheck/build and by runtime status during this slice and was not restarted.
- Racing console history still contains older `AudioContext was not allowed`
  warnings and one older worker transport error, but no new AudioContext warning
  appeared after the cold-cache restart or the held-input proof.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Recommended Next Task

Add worker-safe audio loop lifecycle controls and automation descriptors so
systems can pause/resume stable loops and schedule generic gain/rate/filter
ramps without exposing Web Audio nodes or adding browser-side app audio code.

---

## Previous Completed Slice

- Fixed hierarchical render interpolation in `@aperture-engine/app` so opted-in
  child objects compose against interpolated parent transforms instead of
  current-tick parent transforms. The user confirmed racing's staggered car body
  and wheel motion is fixed.
- Tightened GLTF node lookup so authored node queries exclude hidden primitive
  render children, keeping app-facing lookup behavior aligned with authored GLTF
  scene nodes.
- Fixed the Shadow Lab three.js comparison orbit camera to orbit at the authored
  camera offset distance instead of panning-like motion from a hardcoded radius.
- Fixed WebGPU frame routes so particle emitters are prepared, submitted, and
  reported in queued built-in, mixed custom WGSL, and custom WGSL render paths.
  The bug was route-level: racing emitted particles, but the queued route did
  not append particle commands/reports.
- Fixed the HDR scene-pass format bug exposed by racing smoke: particle
  pipelines were keyed from the swapchain format (`bgra8unorm`) while the HDR
  scene pass expected `rgba16float`, causing WebGPU attachment-state validation
  errors and invalid command-buffer submits when smoke emitted. Added a shared
  scene-pass color-format helper and migrated particles, sprites, text, UI,
  skybox, and custom WGSL frame helpers to use the scene target format.
- Added a mesh to the content-showcase example so its smoke-particle check
  exercises the queued built-in route rather than only the sprite-only route.
- Added an inline empty favicon to racing's HTML so reloads do not add a red
  `/favicon.ico` 404 to the browser console.
- Updated the racing library-gap plan with a genericity audit for the landed
  app/library work.

## Previous Validation

- `pnpm exec prettier --write packages/webgpu/src/app/queued-built-in-frame.ts packages/webgpu/src/app/mixed-custom-wgsl-frame.ts packages/webgpu/src/app/custom-wgsl-frame.ts examples/content-showcase-scene.js examples/content-showcase.worker.js test/e2e/content-showcase.spec.ts`
- `pnpm exec vitest run test/app/fixed-step-app.test.ts test/app/gltf-instance-lookup.test.ts`
- `pnpm --filter @aperture-engine/app run typecheck`
- `pnpm --filter @aperture-engine/app run build`
- `pnpm --filter @aperture-engine/cli run typecheck`
- `pnpm --filter @aperture-engine/cli run build`
- `pnpm --filter @aperture-engine/webgpu run typecheck`
- `pnpm --filter @aperture-engine/webgpu run build`
- `pnpm exec vitest run test/webgpu/particle-frame-resources.test.ts test/webgpu/particle-pipeline.test.ts`
- `pnpm exec prettier --write packages/webgpu/src/app/render-color-format.ts packages/webgpu/src/app/particles.ts packages/webgpu/src/app/sprites.ts packages/webgpu/src/app/text.ts packages/webgpu/src/app/ui.ts packages/webgpu/src/app/skybox.ts packages/webgpu/src/app/custom-wgsl-frame.ts packages/webgpu/src/app/mixed-custom-wgsl-frame.ts test/webgpu/particle-frame-resources.test.ts`
- `pnpm run typecheck:test`
- `pnpm --dir racing run typecheck`
- `pnpm --dir racing run build`
- `pnpm --dir racing run build` after the favicon HTML cleanup
- `pnpm --dir shadow-lab run typecheck`
- `pnpm --dir shadow-lab run build`
- Managed racing was restarted with
  `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173`; Aperture MCP
  `browser_wait_for_webgpu` passed with WebGPU/assets/systems ready.
- Robust particle proof used only Aperture MCP after the HDR format fix:
  restarted managed racing, focused the canvas, paused ECS, held `KeyW` and
  `KeyD`, stepped deterministic fixed updates until
  `racing.vehicle.driftIntensity` reached `0.758`, then read snapshot/frame
  reports while smoke was active. Snapshot frame 3367 reported
  `counts.particleEmitters:2` and diagnostics `0`. Frame report frame 3367
  reported `ok:true`, `summary.particles.emitters:2`, `liveParticles:6`,
  `texturedEmitters:2`, `statesCreated:2`, `textureResourcesCreated:1`,
  diagnostics `[]`, plus bloom/tonemap post effects. Console logs after the
  restarted fixed session showed no new particle attachment-state errors; the
  remaining WebGPU warnings are timestamped before the restart.
- Inputs were reset and ECS resumed after the paused particle proof.

## Previous Notes

- `pnpm exec playwright test test/e2e/content-showcase.spec.ts --reporter=line`
  was started after the content-showcase queued-route coverage change but
  produced no useful output for more than two minutes and was interrupted. Treat
  that specific e2e validation as not completed until rerun/debugged.
- Racing is running at `http://127.0.0.1:5173/` through the managed Aperture dev
  session. Shadow Lab was not restarted or disturbed during the particle proof.
- The current racing console still contains old append-only WebGPU validation
  logs from the broken session. After the favicon cleanup/reload there is no
  fresh 404 entry; runtime status is healthy: `webgpuOk:true`,
  `lastError:null`, `lastFailure:null`.
- Pre-existing untracked screenshot/parity artifacts remain outside the commit.

## Previous Recommended Next Task

Either rerun/debug the content-showcase Playwright smoke proof for the queued
particle route, or continue RACE-LIB-20 by adding a reusable app-level camera
follow/control helper and migrating racing's camera-follow system to it while
preserving current camera feel.

---

# Handoff - Shadow Lab Fixed-Step Render Interpolation

**Updated:** 2026-06-15 22:03 PDT

This run completed the user-directed Shadow Lab/racing parity slice for
fixed-step migration fallout and GLB front-side culling parity.

## Completed

- Added priority-aware fixed-step task registration in
  `@aperture-engine/runtime`, preserving insertion order for equal priorities.
- Added the app-level `fixedUpdate(context)` hook so systems can declare
  deterministic fixed-step work without manual disposer boilerplate.
- Added opt-in `RenderInterpolation` ECS state and app-side snapshot
  interpolation for presentation-only smoothing of mesh transforms and camera
  view matrices between fixed ticks.
- Migrated the racing vehicle and camera systems to `fixedUpdate(context)`.
- Fixed wheel spin to scale by fixed delta while preserving the prior 60 Hz
  feel, and removed misleading fixed-step `dt` clamps.
- Added material patch support for render-state updates and forced imported GLB
  materials in Shadow Lab/racing through `cullMode: "back"` so Aperture matches
  three.js `FrontSide` behavior unless a source material opts into
  double-sided/no-cull.
- Updated architecture, decision, dashboard, and render-pipeline tracker docs.

## Validation Run

- `pnpm exec vitest run test/runtime/fixed-step-schedule.test.ts test/app/fixed-step-app.test.ts`
  passed with 2 test files and 8 tests.
- `pnpm run build` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check:boundaries` passed.
- `pnpm run check:doc-paths` passed.
- `pnpm run check:progress` passed.
- `pnpm run typecheck` passed in `shadow-lab/`.
- `pnpm run typecheck` passed in `racing/`.
- Targeted `pnpm exec eslint ...` over changed root TypeScript files passed.
  The root ESLint config ignores the changed app project files, so those are
  covered by their app typechecks.
- Targeted `pnpm exec prettier --check ...` over changed files passed.
- Aperture MCP browser status was `running` with `lastError:null`; a no-reload
  screenshot was captured at
  `shadow-lab/.aperture/runtime/current-fixedupdate-render-interpolation-culling.png`.

## Known Issues

- Full `pnpm run format:check` still fails on pre-existing formatting drift in
  many untouched files.
- Full `pnpm run lint` still fails on pre-existing vendored Shadow Lab
  three.js/compat-rule lint issues after the local unused import was fixed.
- Render interpolation currently covers opted-in `LocalTransform` hierarchies
  and camera view matrices. Future shared-buffer publication may want the same
  presentation-only rewrite closer to packed snapshot transport.

## Recommended Next Task

Continue Shadow Lab parity by comparing the remaining StandardMaterial shader
variant/resource behavior against three.js with the same side-by-side scene,
especially bloom intensity, shadow filtering, and any residual imported material
differences now that fixed-step cadence and GLB culling parity are corrected.
