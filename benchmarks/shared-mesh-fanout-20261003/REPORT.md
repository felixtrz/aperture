# CPU preparation report

Passed within the bounded CPU-only scope. Native sessions, submitted GPU
coalescing and pixel controls remain unrun and require separate admission.
No engine defect, feature requirement, queue change, score, ranking, memory or
performance result is established.

## Implemented

The derived scene has nine persistent pipe entities, shared three ways through
three explicit MeshHandles and three corresponding MaterialHandles, plus a slab
receiver and static crate sentinel. One camera and one directional shadow light
bring the actual ECS count to 13. The original topology pipe bytes are reused;
fixed translations separate the copies. Demand cadence and SAB options remain
240 Hz shared messages, 240 Hz source-asset messages and a 16 ms full summary.
Those are settings, not measured timing guarantees.

All seven planned CPU sessions and fourteen states pass against real installed
ECS, extraction, serialization and source-asset mirror implementations. Versions
are 1,1,2,2,3,4,5,6 for all shared handles, with exactly fifteen actual replacements.
No-op serialization sends no new assets. All three copies, sentinel bytes, raw
shared/unshared controls and reset bytes remain exact where required.

Installed transform-packing and draw-list algorithms produce three 3-instance
CPU runs at packed float offsets 0,48,96. Distinct unshared mesh handles select no
packing runs. This establishes supported eligibility; the strict future native
gate still requires actual submitted 3-instance main/color draws.

## Observation and gates

A transparent observer preserves every native call, joins pass/bundle draws to
actual encoder finish and exact command-buffer objects passed to successful
queue.submit, then snapshots successful uploads from the exact GPUBuffer objects.
The object-ID-plus-submission map preserves changed versions and avoids repeating
the same transform/uniform allocations for each draw. This is not GPU readback.
Actual descriptors and pinned WGSL classify main/color and shadow/depth passes.
World matrix storage uses main group 1/binding 0, shadow group 0/binding 1 and the
actual firstInstance to validate every instance's exact packed matrix bytes.

Cached shadows retain their original submitted command and frame, including null
for pre-wrapper boot submissions, rather than fabricating fresh draws. Every
reused texture must be the exact texture sampled by current color draws, with
matching content revision, geometry and transforms. Submitted clear-only passes,
overwrite/discard, supported observed copy/write boundaries and destruction
invalidate prior depth history. Unobserved or unsupported paths fail coverage.
A regression control specifically covers valid shadow → clear-only submission →
current color sampling the same texture, and rejects the old coverage.

Focused CPU suite: 8/8 pass (cpu-006.log), including 28 named mutation controls.
Observer controls also exercise orphan commands, bundles, failed calls, per-
submission byte versions, unchanged cache reuse, discard, texture write/copy and
destruction. CPU synthetic evidence cannot stand in for native proof.

Synthetic grow inventories occupy about 6.36 MB shared and 9.97 MB unshared,
with an additional conservative 2 MiB metadata reserve checked against the
unchanged 16 MiB record gate. Actual native capture size is still unknown and
must fail, rather than raise that limit, if the bound is exceeded.

## Frozen provenance and pending work

source-pins.json freezes source/dependency/helper/runtime/settings bytes and all
48 inherited runtime symlink targets. Engine source remains
d0333acdd4443ed9a4a0239d24184755b812b447 (0.3.0); paired topology source is
7c4b867ac432bfbb132c58066b809c530e785032 and full native archive is
8a2e900edd794d0392b133c332a3f1ba161f8302. Fourteen derivations are checked against
that source commit, not local HEAD. Compiled runtime bytes retain inherited pins;
there was no build, installation or independent source-to-compiled reproduction.
Old fixture/evidence bytes were not edited.

The CPU browser-module preflight resolves 949 pinned modules and proves optional
audio disabled from actual source. It starts no server or browser.

PARENT_NATIVE_COMMANDS.json contains seven exact commands, one per separately
admitted session. All use runVerifiedScene and runtime_pressure.py (SHA-256
89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a), which adds
low-space protection and pinned runtime registration. CPU checks use cleanup.py
(SHA-256 1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d).
Each has only attempt-001. After all sessions, revalidate.mjs strictly replays all
records and compare.py independently decodes all fourteen PNGs with Pillow,
requiring eight live/cold and three shared/unshared exact RGB/raw-geometry controls
and visible mutations. Stop at the first mismatch; changes need a new freeze.

Authentic original-author transcript and exact model gates remain missing. This
is exploratory engineering validation only.

## Preserved preparation failures

- preparation-failure-001.log: the lifecycle wrapper rejected a relative audit
  path before starting Node; corrected to the absolute owned audit path.
- cpu-001.log: fixture fields named assets/materials collided with existing
  getter-only system APIs. Renamed to fixtureAssets/fixtureMaterials before any
  native execution. Four cascading tests failed; this is a preparation error.

All failed logs remain unchanged. Subsequent passing runs do not relabel them.
The final machine-readable manifest and scoped quiescence receipt accompany this
report. No browser, server, build, install, publication or descendant was started.
