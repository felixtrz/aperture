# Independent indexed native regression audit

## Verdict

**PASS within the frozen exploratory scope.** Seven completed native SwiftShader
WebGPU sessions retain 14 opaque 1024×1024 captures. All 11 exact decoded-RGB and
raw-geometry controls pass independently. Grow and shrink change 17,002 and
19,392 pixels, with maximum channel differences 113 and 114. No new engine defect
or missing engine capability was established by this matrix.

Primary evidence: [independent audit](full-001.json),
[frozen-validator replay and 30 corruption tests](replay-full-001.json),
[80/80 CPU tests](cpu-001.log), and [lifecycle/content review](receipts-002.json).
The actual successful outputs are retained in [audit-004.log](audit-004.log) and
[replay-002.log](replay-002.log). No browser was launched by this auditor.

## What the native records establish

- Every shared pipe part uses an actual `drawIndexedIndirect`, three instances
  per draw. The inner/outer/rims calls consume 20-byte slots at 0/20/40 in one
  exact submit-time argument-buffer object/version. `firstIndex` and signed
  `baseVertex` are zero; `firstInstance` is 0/3/6. The observed device feature
  permits those nonzero indirect first instances. Live baseline uses buffer
  object 54 at content version/submission 2; no label is substituted for identity.
- Inner/outer/rims active index counts are 864/864/144 at baseline,
  2304/2304/192 at grow, and 288/288/96 at shrink. All are genuine uint16
  identity-indexed corner streams. This proves the indexed submission path;
  it does not demonstrate vertex deduplication, nonzero baseVertex, or memory savings.
- [audit.py](audit.py) imports no fixture validators. It independently decodes
  little-endian indexed arguments and transforms, joins command/encoder/submission
  identities, checks exact uploaded vertex/index bytes and initialized ranges,
  rejects ambiguous objects and uncertain writes, expands source triangles into
  native positions, and establishes every one of the 11 consumed mesh instances
  in both main color and applicable shadow coverage. Sentinel draws remain
  nonindexed even if an unused index binding persists.
- Current sampled shadow texture/content revisions join their original successful
  shadow submissions. Reused depth draws are retained as prior draws. They are not
  relabeled as newly submitted. The frozen replay also checks analytic topology,
  open bores, mirrored assets, consumed snapshots, source versions, once-per-handle
  publications, fixed transforms, no-op allocation/cache behavior and reset/regrowth.
  The retained geometry cache is bounded at 5 → 8 → 11 entries.
- All 6,525 pinned input files match current byte lengths and SHA-256 hashes;
  the frozen replay checks runtime symlinks too. Pins SHA-256 is
  `1658813197a595f2505f3a66c87a7cc0d65aed8da87bc65ac4d580fb9041aa4d`.
  All 6,559 actually served module bodies across seven sessions were recomputed,
  including session-literal replacement and canonical import rewrites.
- Each completion receipt's artifact lengths and hashes match its actual files.
  Native runner receipts show the exact requested argv, sandbox enabled, native
  SwiftShader, zero WebGL attempts, no device loss or GPU errors, and completed
  fence/capture gates. Each executable run identity joins one exit-0 lifecycle.
  The parent owns external publication/ref/tree verification; this audit does not
  claim native artifacts were already published.

Argument and geometry bytes are CPU-upload observations at successful submission,
not GPU buffer readback. Confidence rests on the frozen observer, retained object
and submission joins, native error/fence checks, independent decoding, and pixels.

## Corruption and visible-image checks

All 30 corruptions of in-memory copies of actual native records reject. These
cover counts, firstIndex, signed/positive baseVertex, firstInstance and device
feature, STORAGE/QUERY_RESOLVE usage, absent/uninitialized/uncertain argument
bytes, stale versions/submissions, duplicate object joins, unsubmitted commands,
forged direct fields, wrong index format/bytes/usage, stale mirrors/snapshots,
second-instance transforms, facade versions, no-op allocations/cache misses,
and stale/overwritten shadow content. An independent signed decode returns -1,
while the fixture correctly rejects that changed active range. Original records
were never mutated.

The auditor opened the original live baseline, grow and shrink PNGs. They show
three separated hollow elbows, the same slab and box sentinel, and cast shadows.
Grow has finer facets; shrink is visibly coarser. This verifies scene identity
and visibility only, without assigning an artistic score.

## Preserved auditor failures

Three failed CPU audit attempts remain intact with their nonzero lifecycle exits:

1. [inspect-001.log](inspect-001.log) used compact JSON to verify the permission
   payload. The coordinator's actual canonical encoding is indented JSON plus a
   newline. [inspect-002.log](inspect-002.log) then verified exact payload,
   task/incarnation and current boot using that encoding.
2. [audit-001.log](audit-001.log) incorrectly expected per-attempt `inputs.json`
   to be the full source-pins file. It is a session descriptor carrying that
   file's hash; the descriptor and all underlying pinned bytes are now checked.
3. [audit-002.log](audit-002.log) tried to reconstruct exact float bytes from JSON
   numbers, which discard signed zero. Raw bytes are compared directly throughout;
   numeric arrays are separately checked by decoding those bytes. No native
   evidence or fixture acceptance gate was changed.

The later full pass is [full-001.json](full-001.json); the earlier five-session
[partial pass](partial-001.json) is preserved. The Pillow deprecation warning is
nonfatal and does not change decoded results.

## Next smallest useful engineering probe

**Source-assets-only sideband delivery through the continuous/SAB renderer.**
The [existing queue](../evidence/queues.json) and
[prior audit](../topology-native-audit-20261003/REPORT.md) explicitly leave
continuous RAF and source-assets-only sidebands outside the demand-frame fix.
This is a distinct delivery-path coverage gap, not a demonstrated product bug.
No additional topology/no-op/reset permutations are justified by the present pass.

Relevant source and tests:

- [browser/assets.ts](../../packages/app/src/browser/assets.ts),
  `mirrorSimulationWorkerSourceAssets`: sidebands update the mirror; snapshot
  callbacks separately enter the render path.
- [create-webgpu-app.ts](../../packages/webgpu/src/app/create-webgpu-app.ts),
  `renderSnapshotEvent`, `scheduleAutoRender`, and `start`: continuous presentation
  polls SAB, while `onSnapshot` provides demand wakes.
- [app.ts](../../packages/webgpu/src/app/app.ts), `presentationCadence` contract:
  snapshot mode schedules only when a worker snapshot arrives. Lack of automatic
  demand rendering after only a sideband is therefore not by itself a bug.
- [generated-worker-shared-snapshot-message.test.ts](../../test/app/generated-worker-shared-snapshot-message.test.ts),
  “sends changed source assets through sideband without forcing render snapshot
  messages”: producer coverage exists for updated SAB frames with source-only messages.
- [browser-performance-status.test.ts](../../test/app/browser-performance-status.test.ts),
  “mirrors source asset sideband messages without counting render snapshots”:
  mirror coverage exists without end-to-end presentation evidence.
- [webgpu-app.test.ts](../../test/webgpu/webgpu-app.test.ts),
  “waits for the matching asset message before presenting a demand-mode shared
  frame”: the established demand safety invariant must remain intact.

Smallest red/green acceptance: one mesh, one baseline frame, one changed asset/SAB
frame whose source-assets sideband is delivered separately from a deliberately
suppressed snapshot notification, and one cold changed-state control. First use
the real mirror/scheduler in a CPU test with explicit delivery ordering. Then,
under separately approved native execution, continuous/SAB must eventually show
the new mirrored bytes and match the cold control without an extra snapshot
notification. Retain which asset version and SAB frame each submission consumed.
Do not invent a cross-frame atomicity requirement absent from the continuous-mode
contract. Keep the existing demand test green: no early mismatched presentation;
a later legitimate matching snapshot wake presents the change.

Stop if these existing guarantees pass; no engine change is warranted. If a
supported delivery path stays stale, preserve the smallest failing evidence and
only then consider a compatible scheduling/mirroring fix. A desired new automatic
demand-sideband wake would be an explicit capability decision, not a regression
inferred from this audit.

## Scope, confidentiality and reproduction

Only `benchmarks/indexed-native-audit-20261004` was written. No fixture/engine
edits, installs, builds, browser/server launches, Git publication, agent descendants,
cleanup deletion, private-session reads or live-authority access occurred. The
public-candidate content screen found no credential-value patterns. Manual review
found source, test/geometry/capture evidence and permitted nonsecret recovery
metadata. Local paths and lifecycle IDs are intentionally retained. The
[hash manifest](SHA256SUMS) binds the audit deliverables and settled logs.

Use the adopted wrapper with a fresh output/log name for each rerun:

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/indexed-native-audit-20261004/lifecycle-audits" \
  run --job indexed-native-audit-reproduction --recreation 'CPU-only audit' -- \
  python3 -B benchmarks/indexed-native-audit-20261004/audit.py full-002.json
# Or after --:
# node benchmarks/indexed-native-audit-20261004/replay.mjs replay-full-002.json
```

Verified cleanup helper SHA-256:
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`.
The native wrapper hash was checked as
`89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a`
but never invoked by this auditor. Every completed audit lifecycle, including
the three failed attempts, is retained. The final hash-producing wrapper settles
after its manifest is written; its live log and lifecycle are explicitly excluded
from that self-referential inventory and are verified at final handoff.

Full repository checks, independent source-to-compiled rebuilding, hardware-GPU
portability, GPU-written indirect arguments/readback, authentic original-author
transcripts/model parity, blind artistic scoring, cross-engine results,
performance and GPU-memory measurements remain unrun or unclaimed. Frozen
preparation README/diagnostic text saying “unrun” is historical preparation
metadata; these later immutable outcomes establish the current bounded result.
