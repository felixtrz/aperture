# Recovery and adoption record

## Authorization and provenance

On 2026-10-02 at 14:35:58 UTC the user authorized the one-time recovery/bootstrap
and asked that coordination state live in the repository so it survives VM loss.
This does not authorize routine replacement of missing state, publication, worker
launches, engine edits or benchmark reruns by this implementation task.

The supplied stable source and the observed upstream `main` at implementation time
were commit `68309dcb020ef94d2aa3e5e1601a2a4e75ac62cb`, tree
`43558ef81b1a9bba8f103f8142228e33180e3dc6`. The old helper location was
`/workspace/scratch/0190a8c72f8a/aperture-coordinator/workflow.py`, alongside README
and ADOPTION files. The old state was
`aperture-continuous-20261002/coordination-v1`. Those original bytes and tokens were
lost. The new API is not claimed compatible with that missing implementation.

[checkpoints/recovery-20261002.json](checkpoints/recovery-20261002.json) is a
sanitized reconstruction, never proof of a recovered original ledger. Zero epoch
and payload hashes, `unknown-recovery` incarnations and shared
`historical-unknown-scope` reservations explicitly mean missing information. Judge
owner labels are claim labels, not invented worker handles. Broad overlapping
historical reservations exist only behind the global recovery barrier. No live
secret, token, worker authority or formal benchmark result is in this checkpoint.

## Historical uncertain work

| Claim / worker                                                                         | Observation; reconciliation still required                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courtyard-surface-diagnostics-20261002`; `/root/diagnose_courtyard_surface_artifacts` | `render-first-ablations`; old tool exit 130, descendants not proven quiescent.                                                                                                               |
| `fix-nonindexed-shadows-20261002`; `/root/fix_nonindexed_shadow_casting`               | `final-regression-and-aggregate`; old tool exit 137, descendants not proven quiescent.                                                                                                       |
| `advanced-source-audit-20261002`; `/root/audit_advanced_source`                        | `advanced-audit-003-finalize`; checks completed, final report write failed when directory vanished. Worker reported quiescence; canonical resolve impossible.                                |
| `advanced-judge1-20261002`                                                             | Authorized report write succeeded; resolve/release impossible. Worker reported no pending tools/descendants. Exact report survived in parent workspace, not supplied to this implementation. |
| `advanced-judge2-20261002`                                                             | Same uncertainty and reported quiescence as judge 1; exact report survived in parent workspace.                                                                                              |
| `/root/maintain_user_memory`                                                           | `pending_init`; no confirmed new spawn/write binding. This is not idle proof.                                                                                                                |
| `/root` integration-publication                                                        | Parent claim existed with no outstanding parent operation observed. Kept quarantined until external admission/reconciliation.                                                                |

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

## Parent adoption procedure (not executed here)

1. Review the local implementation commit and tests. Preserve this recovery record
   and immutable snapshot in Git. Publishing requires the parent's separate
   authorization and working Git access. Until exact remote verification, describe
   the checkpoint as local-only.
2. Obtain an external single-VM admission decision. Establish actual prior VM,
   worker, descendant and tool quiescence, and reconcile effects against real files,
   reports, commits and tool outcomes. Retrieve surviving judge reports from the
   parent. Missing evidence keeps recovery blocked.
3. Call `bootstrap` into a new absolute private mode-0700 directory outside Git,
   using the sanitized recovery snapshot. Keep its returned authority in protected
   local storage. Existing destinations, including corrupt ones, must not be reused.
   Bootstrap leaves the recovered state unarmed and all unfinished claims quarantined.
4. After reviewing the evidence, call `reconcile_recovery` with the full quiescence /
   effect proof and external admission. Securely adopt the newly rotated authority.
   This releases the reconstructed reservations only by explicit attestation;
   it does not fabricate missing original resolve events.
5. Reserve `integration-publication` for the parent. Define canonical other domains
   before issuing any worker claims. Adapt callers to prepare, publish the sanitized
   snapshot, verify, begin once, spawn a waiting worker, bind exact incarnation and
   rotate, then separately prepare/publish/begin each bounded write.
6. Keep checkpoint commits immutable and retain their history on the reviewed
   remote branch. Publication receipts cite exact commit/tree/ref/blob observations
   outside their own manifests. Unknown publication outcomes block effect dispatch
   until reconciled. The operator's external admission remains the authority for
   the one publication owner; Git itself supplies no lock.
7. After another VM loss, use only sanitized Git state and repeat external admission
   and explicit reconciliation. Never copy a live authority directory to another
   VM or arm two restores. Every unfinished prepared/pending/unknown intent remains
   quarantined even if it appears to predate the effect.

The Python test suite uses temporary directories and local bare Git remotes. Its
pushes are isolated test fixtures, never this repository's upstream. `tick` and
checkpoint perform no automatic adoption, restarts, lease reclamation or cleanup.

## Implementation validation

The focused Python suite passed 15 tests, including local bare-remote publication
checks, multiprocessing contention and fault-injected persistence crashes. The
existing cloud-renderer Node unit suite passed 42 tests without browser launches.
The repository-wide `pnpm run check` could not start: the environment's pnpm
launcher tried dependency installation and failed creating its user data directory
(`ENOENT`). No dependencies or engine code were changed to work around that blocker.
