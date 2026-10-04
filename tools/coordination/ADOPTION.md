# Recovery and adoption record

## Replacement executor recovery, 2026-10-04

A changed kernel boot and replacement managed workspace were observed at 00:36 UTC.
The fresh checkout is `/workspace/scratch/0190a8c72f8a/aperture-recovery-20261004`;
the new private authority is `/workspace/scratch/0190a8c72f8a/aperture-authority-20261004`.
Neither old authority nor live capabilities were copied. The recovery source was
verified main `3af21132cf20a393c82e0b558070c84400560787`, tree
`68dc525e64081422dbf72aa0038abbfc37079b9a`. See
[evidence/recovery-20261004-observations.json](evidence/recovery-20261004-observations.json).

The parent and indexed-builder old claims were reconciled using actual completed
worker/tool observations and confirmed remote publication outcomes. Three older
uncertain claims retain their existing quarantines and scope bounds. Admission is
cooperative for this replacement executor, not provider fencing. The unfrozen indexed
fixture and its local CPU logs were lost; reported 74-test results are historical
observations, not restored evidence or permission to skip a new run.

The completed nonindexed shared-mesh native archive and independent audit remain
available in Git. Read-only status now uses the new private authority path. Ordered
setup is pending from pinned pnpm onward; do not claim dependency, build, browser
runtime or native-render readiness until this replacement executor clears each stage.
Every ordinary effect still requires separately published preparation and fresh begin.


## Recovery setup verified, 2026-10-02

The ordered recovery implementation in [tools/recovery](../recovery/README.md)
passed 102 focused tests and the full pnpm/dependencies/build/runtime/native-render
sequence. See [the byte inventory and verification record](evidence/recovery-verified-20261002.json).
The dependency store reuse and nested runtime isolation paths are now tested.
The full cold-VM scripted path remains a future validation case; do not claim that
the reused dependency installation was a clean cold installation. Full aggregate
engine checks were not rerun as part of this recovery-only change.

The user updated publication on 2026-10-02: publish directly through the GitHub
connector in the current dot conversation; do not create Codex publication jobs.
Read the latest remotely verified checkpoint before work. The next project stage
is benchmark preparation. Preserve all prior quarantined reservations.

## Current adoption, 2026-10-02

The schema-3 implementation was published as
`ff35dfef97f6351b53f3b9350c449e6e4ee43077`, tree
`017e26258725640bf2934fb3524a54301bbc3030`. Independent review and 44 coordinator,
38 evidence-archive and 42 renderer unit tests passed. Cloudflare Pages succeeded.
The repository-wide dependency-dependent check remains blocked as described below.

The current sanitized recovery state is
[checkpoints/current.snapshot](checkpoints/current.snapshot), encoded as canonical
JSON regardless of its extension. Its history must be published and independently
verified before relying on it as a durable checkpoint. The original reconstructed
checkpoint remains immutable. Evidence records are in [evidence](evidence/).

On the current dot host only, the private authority directory is
`/workspace/scratch/0190a8c72f8a/aperture-authority-20261002`. It is outside Git and
must never be copied, published, reset or have its capabilities printed. The local
checkout is `/workspace/scratch/0190a8c72f8a/aperture-recovery-20261002`. The read-only
status command is `python3 -B tools/coordination/workflow.py
/workspace/scratch/0190a8c72f8a/aperture-authority-20261002 tick` from that checkout.
After another verified VM loss, automatically reclone and bootstrap a fresh private
authority from the latest verified snapshot instead of reusing these host paths.

Four historical claims were individually reconciled from completed worker/tool
observations and verified effects. Three remain quarantined with conservative
reconstructed scope bounds; their quiescence and outcomes are not asserted. The
current root alone owns integration/publication and the fresh checkout. This is
cooperative single-authority admission, not provider fencing. Every ordinary new
effect still requires published preparation and fresh one-shot begin permission.

## Authorization and provenance

On 2026-10-02 at 14:35:58 UTC the user authorized the one-time recovery/bootstrap
and asked that coordination state live in the repository so it survives VM loss.
The user subsequently authorized automatic reclone/recovery/resumption after
verified VM loss, without waiting for another approval, and required benchmark
evidence to be stored in Git. This authorizes starting recovery; it does not prove
old worker effects settled or manufacture provider fencing. Normal missing-file
errors are not verified VM loss. Development and testing stay in the dot cloud
environment; separate Codex jobs are publication-only. This implementation task
itself does not launch workers or rerun benchmarks.

The supplied stable source and the observed upstream `main` at implementation time
were commit `68309dcb020ef94d2aa3e5e1601a2a4e75ac62cb`, tree
`43558ef81b1a9bba8f103f8142228e33180e3dc6`. The old helper location was
`/workspace/scratch/0190a8c72f8a/aperture-coordinator/workflow.py`, alongside README
and ADOPTION files. The old state was
`aperture-continuous-20261002/coordination-v1`. Those original bytes and tokens were
lost. The new API is not claimed compatible with that missing implementation.

[checkpoints/recovery-20261002.json](checkpoints/recovery-20261002.json) is a
sanitized reconstruction, never proof of a recovered original ledger. Its schema-3
upgrade changes only version metadata, null scope/registration slots and an opaque
auxiliary uncertainty label; no new
worker identity, observation, release or evidence is asserted. Zero epoch
and payload hashes, `unknown-recovery` incarnations and shared
`historical-unknown-scope` reservations explicitly mean missing information. Judge
owner labels are claim labels, not invented worker handles. Broad overlapping
historical reservations exist only behind the global recovery barrier. No live
secret, token, worker authority or formal benchmark result is in this checkpoint.

## Historical uncertain work

- `courtyard-surface-diagnostics-20261002`, task
  `/root/diagnose_courtyard_surface_artifacts`: `render-first-ablations`; old tool
  exit 130, descendants not proven quiescent
- `fix-nonindexed-shadows-20261002`, task `/root/fix_nonindexed_shadow_casting`:
  `final-regression-and-aggregate`; old tool exit 137, descendants not proven quiescent
- `advanced-source-audit-20261002`, task `/root/audit_advanced_source`:
  `advanced-audit-003-finalize`; checks completed, final report write failed when
  the directory vanished. Worker reported quiescence; canonical resolve impossible
- `advanced-judge1-20261002`: authorized report write succeeded; resolve/release
  impossible. Worker reported no pending tools/descendants. Exact report survived
  in the parent workspace, not supplied to this implementation
- `advanced-judge2-20261002`: same uncertainty and reported quiescence as judge 1;
  exact report survived in the parent workspace
- `auxiliary-task-status-unconfirmed`: no confirmed project claim or spawn/write
  binding. This opaque uncertainty marker is not idle proof
- `/root`, integration-publication: parent claim existed with no outstanding parent
  operation observed. Kept quarantined until external admission/reconciliation

All author/edit workers reportedly released before loss. That observation is not
recovered canonical release state. Do not discard these uncertainties based on
elapsed time, parent-process exit, tool exit or a missing VM directory.

Both engines genuinely rendered native WebGPU. The advanced exploratory trial
observed 51 independent geometry/edit checks per engine, seven edits each, 29
author native attempts and two heldout renders. Complete files were lost;
authentic full transcripts are unavailable. These are historical observations
requiring rerun, not formal scores. The only evidenced new gap was reference mounts
intruding into the exhaust lumen, not an engine feature gap. Package smoke remained
blocked by the `jpeg-js` registry 403. No benchmark evidence is reconstructed here.

## Automatic recovery and parent adoption (not executed here)

1. After **verified VM loss**, use the standing authorization to reclone the exact
   reviewed GitHub repository and inspect the latest remotely observed checkpoint.
   Check upstream without force-push, merge or release. Keep reconstructed or
   unpushed state explicitly local-only. A missing directory by itself is not proof
   every remote worker or tool has stopped.
2. Obtain an actual external single-VM admission observation/decision. Establish
   the fate of the prior VM and copied authorities; no local process can invent
   provider fencing. Retrieve surviving worker/judge reports and inspect real
   provider identities, descendants, tools and effects. Missing observations remain
   unresolved. Automatic recovery permission never substitutes for these facts.
3. Call `bootstrap` into a new private directory outside Git. It rotates authority
   and keeps all unfinished claims quarantined behind the global admission barrier.
   Never reuse an existing missing/corrupt destination or copy a live authority.
4. Prefer `admit_recovery` for the verified single-VM admission, preserving all
   quarantined reservations. Use `reconcile_claim` only for claims with actual full
   evidence. If evidence establishes a complete bounded effect scope but not full
   quiescence, use `bound_recovery_scope` once and retain quarantine. The unknown
   historical scope sentinel blocks all new claims until bounded or reconciled.
   After all unknown scopes are bounded, proven-disjoint new work may proceed;
   overlapping historical effects remain blocked. The all-claim
   `reconcile_recovery` shortcut requires evidence covering the entire old authority.
5. Once available, reserve `integration-publication` for the parent. Use the guarded
   `register_native_execution` and `adopt_existing` paths with the observed boot,
   root conversation, exact task path and adoption receipt. The explicitly derived
   local identity is not a provider-issued generation. Do not invent a spawn or
   provider ID. Actual provider generations remain an alternative when exposed. Define canonical domains before other claims.
   Follow [ORCHESTRATION.md](ORCHESTRATION.md) for provider-assigned IDs, published
   preparation, one gated create, one observed result, exact binding/token rotation
   and separately published bounded writes. A provider without the required gate or
   identity observations remains unsupported for consequential dispatch.
6. Commit actual benchmark evidence manifests and bytes under the repository's
   evidence workflow. Manifests must identify exact source commits, run IDs,
   artifact paths and byte hashes, with explicit missing/rerun status where files
   were lost. A recollection is not a recovered transcript, capture, formal score or
   reconciliation receipt. Reference reviewed evidence by its digest plus exact
   Git manifest/commit/path in the evidence record. Do not add fabricated links.
7. Keep immutable canonical checkpoint commits and their evidence history on the
   reviewed remote branch. Publication receipts cite exact commit/tree/ref/blob
   outside their own manifests. Unknown pushes block dispatch until reconciled.
   The external admission, not Git alone, establishes the single publication owner.
8. On subsequent loss, repeat this automatic recovery process and actual evidence
   checks. Resume only scopes whose admission and disjointness are established.
   Unresolved historical work stays quarantined even when it appears to predate an
   effect. At capacity, close admitted work and archive a terminal checkpoint; never
   prune unknown work or reuse IDs to make space.

The Python test suite uses temporary directories and local bare Git remotes. Its
pushes are isolated test fixtures, never this repository's upstream. `tick` and
checkpoint perform no automatic adoption, restarts, lease reclamation or cleanup.

## Implementation validation

The updated focused Python suite covers replacement-ref and Git-environment attacks,
oversized state rejection and reserved closure capacity, byte-stable replays,
provider-assigned identities, exact observed binding, guarded existing-owner adoption,
partial quarantined recovery, local bare-remote publication, multiprocessing
contention and persistence crash windows. Test proofs are synthetic fixtures in
private temporary directories. The production recovery artifact is loaded and
verified as quarantined, never reconciled with a synthetic proof.

The cloud-renderer Node unit suite passes 42 tests without browser launches. In this
dot cloud checkout, `pnpm run check` cannot start: its fallback dependency install
fails creating `/home/agent/.local/share/pnpm` (`ENOENT`). Direct package-boundary
checks are also blocked by missing `typescript`. These are not full aggregate passes.
No dependency, credential, security setting or engine code was changed to make a
check pass. See the final review report for the current focused test count.
