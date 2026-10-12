# Private capacity repair draft; R004 unchanged

Prepared from source reads only. No scratch inventory, cache hash/retirement,
lifecycle operation, browser, native job, test, build, model, judge journal read,
source integration, or public evidence edit was performed. All code in this
directory is unintegrated and untested. The separate recorder issue is documented
under `recorder-v3/`; it does not authorize changing old journals or rejudging.

## Concrete failure boundary

`tools/recovery/runtime_pressure.py:74` checks free space against 2,147,483,648
bytes before entering `cleanup.run_command`. It does not include the next
209,022,176-byte executable or future evidence/copies, and two concurrent shared
lifecycle jobs can both see the same available bytes. Native cache registration
occurs only after descendant reaping (`runtime_pressure.py:41`,
`cleanup.py:440`), which is the correct ownership boundary to retain.

The reviewed private 19,925-byte pressure helper has SHA256
`381320c9f4e26ac1e5e3553362eb979024dd3c7f1cc378133ba6bced7e27549c`.
It accepts only exact registered completed flat Chromium caches, checks the
compressed source, externally preserves original manifest bytes, revalidates the
whole selected set, and captures/rechecks before unlinking. `prepare` selects at
most 40; `apply` stops at observed 8 GiB or truthful bounded-plan exhaustion.
Its target is a housekeeping bound, not a future-work admission budget.

Do not restore the old incident by retrying an original preview. Do not claim
that the R004 budgets, visual feedback or eligibility became equal afterward.

## Smallest repair: explicit admission plus opt-in maintenance

1. Add a general capacity module, independently versioned and default-disabled.
   An immutable root-reviewed policy identifies the exact root/runtime/source
   pins, intended filesystem, permitted serialized job slots, scope/expiry,
   maximum maintenance operations and total retirements. The policy's hash is
   the authorization; a command-line `--pressure` switch alone is insufficient
   to authorize autonomous maintenance. Retain default wrapper behavior.
2. Before setup, assess setup/dependency/SDK/archive copying plus pending native
   work. After installation and SDK creation, reobserve free bytes and replace
   remaining-growth figures with exact installed/source-copy figures where
   possible. Freeze a second admission receipt before either author starts.
   Refuse dispatch if six allowed previews cannot fit under the common policy.
3. Recheck before each managed native job, inside a pinned external capacity
   lock held through observed wrapper exit and caller evidence checkpoint.
   This serializes cooperating capacity consumers without nesting an exclusive
   lifecycle lock around a wrapper that must acquire its own shared lifecycle
   lock. Lock order is capacity lock, lifecycle lock, registration lock. Do not
   launch helper apply under `runtime_pressure` or `cleanup.run_command`.
4. If an admission would fail, a separately authorized maintenance policy may
   prepare a fresh one-hour plan and apply it once, only between completed jobs.
   Keep the exact existing helper core/pins/40-file/8-GiB bounds. Preserve each
   before/after manifest outside scratch and checkpoint the original completed
   job receipt before maintenance. Validate one acknowledged current plan hash,
   observe actual process exit and locks, then independently verify outcome and
   joins. Recompute admission using actual free space, never proposed reclaim.
5. If known candidates are absent or bounded-plan exhaustion leaves too little
   free space, stop before dispatch/new launch with a retained capacity receipt.
   No wider cleanup, force, automatic retry, timestamp changes, altered 24-hour
   policy, lower 2-GiB floor, unknown traversal, or source/evidence removal.

Keep maintenance outside native launch and measured-frame intervals. Automatic
mode is optional; a manual exact plan/review/apply workflow remains supported.
One maintenance pass per approved between-job boundary and a policy-wide cap
prevent repeated pressure loops. A failed/partial apply latches reconciliation
required and forbids new launches; do not silently retry or reset the breaker.

## Budget arithmetic and current protocol facts

The admission module consumes **additional** growth after a timestamped free-space
observation, with pinned filesystem identity and allocation unit. Existing files
already reduced observed free bytes and must not be counted again. For serial
work, retained growth sums, simultaneous transient growth uses the maximum job
peak, and rounding/metadata allowances are explicit. Default arithmetic credits
zero future retirement even if automatic mode is enabled. This is deliberately
conservative: a proposed plan is not reclaimed space.

The private `staged/capacity_budget.py` implements this pure arithmetic and
strictly distinguishes verified exact bytes, enforced upper bounds, declared
reserves and unbudgeted growth. An explicit reserve acknowledgement is required;
results with estimates say `admissible-under-declared-reserves`, never guaranteed.
Missing budgets cannot silently become zero. It cannot open files, retire caches
or launch commands. The I/O policy/admission/maintenance coordinator remains to
be implemented after review; code readiness must not be inferred from this draft.

Current source-derived facts for a fresh house race:

| Future allocation | Budgetable fact | Missing part / limitation |
| --- | --- | --- |
| Pinned Chrome | 209,022,176 logical bytes per new native lifecycle; file rounding extra | Actual freed blocks require post-apply statvfs; no credit for a plan |
| Six preview request freezes | Existing 256 MiB maximum each, or 1,536 MiB total | No refund for unused previews in pre-dispatch admission |
| Six preview runner input copies | At most another 256 MiB each from validated request | Harness and injected index copies need separate exact source-size budgets |
| Preview POST artifacts | Three PNGs plus preview/failure JSON each capped at 32 MiB; geometry result/error capped at 64/128 KiB | At most 160 MiB +192 KiB per attempt; final-page PNG and host reports/logs are separate |
| Six official POST artifact streams | Existing aggregate cap 448 MiB each, or 2,688 MiB total | Input/harness copies, final-page PNG, driver/root reports and logs excluded |
| Final official source copies | Exact completed build bytes can be measured after finish | Current readSourceTree has a 64-MiB individual-file cap and no aggregate/file-count cap |
| Browser runtime siblings/profile | SwiftShader/fonts and profile grow in the run | Keep all unknown/nested bytes; Chrome-only retirement does not reclaim them |
| Author workspaces/dependencies/transcripts | Actual preparation bytes can be measured before activation | Future author writes and command stdout/stderr are not disk-quota bounded |
| Source audits/evidence publication/backup | Copies can be counted when planned | Git/archive/reference/producer work must reserve space or be excluded while phase runs |

Therefore the currently bounded six-preview copy+POST portion alone is
4,033.125 MiB, before Chrome, the 2-GiB floor, author growth, harness, runtime
siblings, final-page captures and logs. Six Chrome files add 1,254,133,056 bytes.
An 8-GiB target may or may not cover actual declared remaining growth; it cannot
be treated as sufficient merely because the target was reached. The R004
unreachable-target precedent is handled by `completed-bounded-plan-exhausted`
plus a fresh admission decision, with original evidence preserved.

One small implementation should budget phases separately: preparation, author
previews, then final audited trials. Before authors, both lanes share the same
complete three-preview allowance. Before official trials, actual finished app
sizes replace estimates. No new scene/file limit, render/fence count, scoring,
deadline, preview allowance or active-author budget is imposed by capacity policy.

## Actual guarantee limits

`readSourceTree`, renderer stdout/stderr, host/browser reports, author commands,
and browser profile writes do not currently supply hard complete disk bounds.
No finite admission estimate can promise safety against unlimited output or
unrelated writes. The smallest compatible repair explicitly retains operator
reserves and fresh checks, blocks when reserves are unspecified, and records
estimated admission as conditional. Real hard guarantees require separate quota
or bounded-output work and appropriate disclosure, not a false assertion here.
Free space and policy inputs must be joined for every filesystem that holds
scratch, evidence, SDK or author workspace; cross-device deployments need separate
budgets. Shared-filesystem locations accumulate once. Do not assume `/workspace`
and scratch are always on one device from their path names.

No byte-count ledger is a hard filesystem reservation. Unmanaged writers can
still invalidate it; the adopted coordinator must exclude unbudgeted heavy work
through the phase. Existing per-step wrapper refusal remains authoritative.

## Evidence and lifecycle constraints

The general coordinator must persist: policy/admission SHA, free-space observation
and device identity, every exact argv and public stdout/stderr/exit/timing, actual
completed job manifest byte copy, maintenance plan SHA and source pins, apply
before/after manifests and cache-only retirement records, actual post-free bytes,
and successor admission. Use nofollow/inode checks and create-only fsynced external
records. Never overwrite a previously frozen manifest, proof or failure.

Before maintenance, require the root-marked Store exclusive lock, verified known
run metadata showing completed/retired states, no unresolved active known run,
no unreconciled pressure-stage/error state, and registration locks. Unknown root
entries/nested/source/raw data are preserved and not opened recursively. The
reviewed helper still performs all hash/inode/registration checks. If a known
lifecycle is invalid/active or a lock is busy, preserve everything and refuse.

Caller evidence checkpoint matters: retirement must not occur inside the old
wrapper before official-trial/preview code records its completed lifecycle bytes.
Perform it before the next launch, after those original receipts exist. A later
validator accepts a current manifest change only through an exact original-copy,
plan, retirement and after-manifest chain, with original state, created/completed
timestamps, exit code, job and all unrelated registrations preserved.

Preview queue maintenance is symmetric and uses no additional preview. Verified
waiting retains its existing equal credit; raw wall time includes the actual
queue/maintenance interval. If a capacity incident still occurs after dispatch,
retain the request/error and record infrastructure invalidation; do not change
counts/budgets, silently resubmit or fabricate comparable feedback.

## Proposed files and integration order

- `tools/recovery/runtime_capacity.py`: policy/admission arithmetic, create-only
  receipts, pinned external capacity lock, before-launch and checkpoint APIs.
- `tools/recovery/pressure_cache_retirement.py`: promote the reviewed core only
  after its original tests plus new auto-policy tests pass; retain exact CLI
  pins, TTL, cap, target and truthful cache-only manifest semantics.
- `tools/recovery/runtime_pressure.py`: additive pinned admission hook checked
  before launch; floor and existing default route remain intact. A supported
  capacity session serializes consumers; legacy route is explicit outside it.
- `tools/recovery/cleanup.py`: at most an additive before-launch callback inside
  its current lock, preserving existing subreaper/completion behavior. Do not
  mutate helper semantics merely to hide pressure errors.
- General future coordinator caller: immutable completed-lifecycle snapshot and
  next-slot admission before maintenance/launch. Benchmark-specific preparation,
  preview service and official driver wire the same generic API; retained old
  coordinator/round bytes remain historical.
- Future source freeze/disclosure: include capacity/helper/caller source pins and
  common maintenance procedure in new preparation inputs. Both authors get the
  same generic infrastructure statement; no outcome/scene advice. Keep original
  R004 method, controls, budgets, feedback and combined exclusion unchanged.

## Meaningful pending validation

Private pure test sources cover floor-only refusal, full retained growth vs serial
transient peak, exact boundary, already occupied bytes, unknown growth, explicit
reserve acknowledgement, target insufficiency, zero prospective reclaim credit,
bounded exhaustion, rounding and invalid arithmetic/duplicate jobs.

Future actual lifecycle synthetic tests must additionally prove:

1. Two concurrent admission requests cannot spend one observation twice.
2. A shared lifecycle or registration holder blocks maintenance without changing
   any file; dangling active known manifests block automatic mode.
3. Zero candidates/unreachable 8-GiB target yields truthful stop and no launch;
   successful retirement still refuses when actual remaining budget is too large.
4. A just-completed child plus detached descendant is not eligible until reaped;
   the original caller manifest copy precedes retirement.
5. Before/after metadata retains job/state/timestamps/exit/all other registrations;
   old frozen evidence pins join through immutable originals and explicit bridges.
6. Stale plan/policy/source/package/directory/manifest/inode/unknown-neighbor
   changes fail closed; unknown/nested/source/raw evidence bytes remain untouched.
7. Audit/fsync/write/capture/unlink failures latch a reconciliation breaker,
   preserve truthful partial effects, and never launch or silently retry.
8. Same generic maintenance admission/queue wait treatment for both lanes; a
   post-dispatch storage incident preserves preview count/budget and invalidation.
9. Cross-device paths get separate budgets; same-device evidence/scratch counts
   accumulate once; filesystem rounding and sudden unrelated writes are visible.
10. Policy per-pass/per-phase/expiry/source bounds cannot be overridden by argv,
    untrusted author code, cache names, role labels or a bare pressure switch.

Only after R004 freeze and explicit root scheduling: run pinned small Python
focused tests under the adopted CPU lifecycle, retain exact logs/exit; then root
may schedule a small real native pair to prove admission/retirement order and
receipt joins. No old failed preview or judge attempt is rerun. Future whole gates
and SDK preparations must freeze the reviewed implementation before use.
