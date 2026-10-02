# Durable coordination recovery

This is a conservative reconstruction authorized on 2026-10-02, not the lost
helper or ledger recovered byte for byte. It is Python 3.10+ stdlib code for a
trusted, cooperative, single-host POSIX environment. No engine code changes.
Read [ADOPTION.md](ADOPTION.md) and [ORCHESTRATION.md](ORCHESTRATION.md) before use.
No production authority has been created or admitted by this implementation task.

```sh
python3 -B -m unittest discover -s tools/coordination -v
python3 -B tools/coordination/workflow.py /absolute/private/state tick
```

The CLI accepts request objects on stdin and emits JSON. Secret-bearing commands
must use protected pipes, never shell history, transcript logs or tracked files.
The Python API has the same method names. Errors deny dispatch. Callers must also
treat EOF, timeout, exceptions and malformed responses as denial/uncertainty.
There are no dependencies, browser launches, worker restarts, pushes or cleanup
operations in the coordinator. This reviewed pre-adoption revision uses schema 3;
earlier schemas are rejected, not silently migrated. The reconstructed historical snapshot
has only schema metadata and null registration/proof slots updated, plus an opaque
auxiliary uncertainty label; no missing evidence was invented.

## Recovery and domain admission

- `bootstrap(path, snapshot)` exclusively creates a new mode-0700 directory outside
  Git. It never replaces missing/corrupt state in an existing directory. Every
  restore generates a fresh epoch and private authority, sets a global barrier,
  invalidates prior claim tokens and quarantines every unfinished claim. Even a
  snapshot with only released claims restores unarmed. Oversized snapshots fail
  before the destination is created.
- `admit_recovery(authority, admission)` records an external single-VM admission,
  clears the global admission barrier and rotates authority. It does **not** release
  any historical reservation or assert historical effects settled.
- `bound_recovery_scope(authority, claim_id, domains, evidence)` records a one-time
  evidence-backed scope bound for a quarantined claim, preserving previous domains
  and its evidence digest. Evidence is `{complete_scope: true, evidence: SHA256}`.
  Without the historical unknown-scope sentinel, new domains must be a subset of
  the old ones. This is an attestation about the entire possible effect scope,
  including children and tools; it does not establish quiescence.
- `reconcile_claim(authority, claim_id, evidence)` resolves and releases exactly one
  quarantined claim after actual worker/descendant/tool/effect reconciliation.
- `reconcile_recovery(authority, evidence, admission)` remains an explicit all-claim
  convenience for evidence covering the **entire** former authority. Do not use it
  with a partial report or simply to clear a barrier. Prefer per-claim recovery.
- `claim(authority, claim_id, owner, domains)` reserves all exact domains or none.
  Claim IDs cannot be reused, including after release. `integration-publication`
  belongs to the sole publication owner. All callers must share one canonical
  domain vocabulary; names are opaque, not hierarchical filesystem locks.

An unresolved `historical-unknown-scope` reservation blocks **every** new claim.
After external single-VM admission and evidence-backed bounds for all such scopes,
new non-overlapping domains can proceed while historical claims remain quarantined.
Overlapping quarantined scopes may coexist; an active claim can overlap neither
another active claim nor a quarantined claim. No elapsed time releases ownership.
Automatic recovery authorization permits the recovery process, not fabrication of
these evidence assertions. Missing evidence keeps the affected scope closed.

## Worker and operation lifecycle

- `register_native_execution(authority, root_id, evidence)` records one local
  native namespace after admission. It reads this host's actual boot ID and combines
  it with the current coordinator epoch and observed root conversation ID. Evidence
  has exactly `scope_observed: true`, `unique_task_paths: true`, and a reviewed
  evidence digest. Registration is immutable for this epoch. A boot ID identifies a
  kernel boot; this is no additional proof of a uniquely fenced VM.
- For the current native provider, which returns only an exact unique task path,
  include the registered scope as `specification.local_execution`.
  `native_observation(scope, returned_task_path, receipt_digest)` computes a
  `local:` incarnation from the explicit `native-local-v1` scheme, scope and exact
  path. Its separate evidence digest authenticates the original create receipt.
  This is a cooperative local logical identity, **not** a provider-issued agent ID
  or process generation. Existing-root adoption uses the same helper with an
  actual observed-root adoption receipt instead of a fabricated spawn receipt.

- `prepare_spawn(claim_id, token, operation, correlation, specification)` records
  a random 64-hex correlation nonce and an immutable, bounded specification. The
  caller generates the nonce **before** hashing the exact waiting-only create
  request that includes it. Specifications have exactly `provider` (`native` or
  `cloud`), `parent`, `requested_task`, and `request_sha256`, plus `local_execution` for the local-native scheme. A native canonical
  requested task path can be known; for cloud creation `requested_task` must be
  null because the provider assigns the identity. No speculative identity is
  described as exact. The returned payload hashes the nonce plus specification.
- `prepare(claim_id, token, operation, "write", task, incarnation, payload)`
  records a bounded write only for an already bound exact task/incarnation.
  The payload is the SHA-256 of the immutable write specification.
- `checkpoint()` returns `{durability: "local-only", snapshot: ...}`. Write only
  the snapshot, using `workflow.encoded`, to a reviewed Git checkpoint. Authority,
  token hashes and live tokens are omitted. It does not publish.
- `begin(claim_id, token, operation, publication)` verifies the prepared checkpoint
  against the exact remote ref, commit, tree and blob, then durably marks the
  operation pending before issuing one permission. Publication fields are `repo`,
  configured `remote` name, full branch `ref`, `commit`, `tree`, `snapshot_path`.
  Commit objects must already exist locally. The spawn response includes the
  original nonce and immutable specification; write responses include the exact
  provider/task/incarnation. Local-native calls also require `root_id` from the
  adapter's current authoritative root context; `begin` rechecks it, this host's boot
  ID and the registered coordinator epoch before issuing a permit. The adapter
  must match the request before dispatch.
- `record_spawn(claim_id, token, operation, correlation, payload, observed)`
  records exactly one actual provider result from that create call. `observed`
  has `provider`, `task`, `incarnation`, `evidence` (receipt digest), plus the exact
  registered `local_execution` when using the local scheme. A `local:` incarnation
  without that scope is rejected.
  Operation, nonce, payload, provider and any native requested path must match.
  This does not bind or authorize a worker write. Duplicate observations fail.
- `bind(claim_id, token, operation, correlation, payload, observed)` requires the
  exact previously recorded observation. It binds that identity and rotates the
  claim token before a write can be prepared. Duplicate or mismatched binds fail,
  including attempts using either the old token or the newly rotated token.
- `adopt_existing(authority, claim_id, token, observed, evidence)` binds a known
  existing root/worker without inventing a spawn. It requires authority **and**
  claim token, an empty operation history, no prior binding, and `owner` equal to
  the observed task. Evidence has exactly `identity_observed: true`,
  `no_ungated_effects: true`, and the same evidence digest as `observed`. It rotates
  the token. Identity evidence must be real: either an actual provider incarnation
  or the explicit observed local scheme above. A path alone or an invented provider
  generation is insufficient. Sequential reconciled claims may adopt the same
  local logical owner; a new create may never reuse a recorded path in the same
  root-conversation namespace, even after a boot or coordinator-epoch change.
  Re-adoption does not release historical uncertain effects and still requires
  real no-ungated-effects evidence, even for proven-disjoint domains.
- `resolve(claim_id, token, operation, evidence=None)` marks unfinished effects
  unknown without evidence, keeping reservations. A reconciliation proof resolves
  an intent. Unknown spawn outcomes cannot be recorded, bound or redispatched;
  first establish quiescence and reconcile effects. A new claim/operation does not
  erase a possible orphan worker.
- `release(claim_id, token, evidence)` requires reconciled operations and fresh
  worker/descendant/tool quiescence and effect evidence. A bound spawn still needs
  this proof. Duplicate release fails. Reports or tool exit codes alone do not
  establish descendant quiescence.
- `tick()` is read-only. It never restarts workers or advances leases/state.

Only one unfinished operation per claim is allowed. Duplicate preparation and
`begin` replay deny dispatch without a save, revision increment or checkpoint
invalidation, even if a caller supplies different data. They never replace intent.
No successful dispatch response is recoverable by replay after a lost response.

A reconciliation proof has exactly `workers`, `descendants`, `tools`, `effects`
set to true and `evidence` equal to the SHA-256 of a reviewed evidence record. The
admission object has `single_vm: true` and a separate `evidence` digest identifying
an external operator/provider admission decision. These are trusted attestations,
not cryptographic proof of provider state. This module does not stop/fence a VM,
query providers, or inspect evidence contents on the caller's behalf.

Keep the evidence record and its actual referenced bytes in Git when authorized,
with a manifest naming exact repository, commit, path, hash, runtime identities,
operation/nonce/payload and observed outcomes. A digest without retrievable bytes is
not reconciled evidence. Missing benchmark transcripts, captures and scores must
be marked missing and rerun; never synthesize them from recollection. Do not commit
credentials or authority tokens. Record receipt links outside the commit they cite
so no manifest requires a self-referential commit hash.

Local-native follow-up turns can remain the same logical owner only while prior
effects and descendants are reconciled and every new bounded effect is gated. This
scheme does not promise detection of internal process restarts. Cloud identity
continues to require actual `threadId` and `turnId`, without local substitution.

## Capacity and retained history

Reads and saves share a hard **4,000,000 encoded-byte** state limit. Before any
replacement, `save` validates the complete new state and reserves worst-case schema
space for current claims' observation/binding, resolve/release proofs, recovery
admission and a fixed 19-digit revision field. Revision values are bounded by
`2**63 - 1`; new state must leave enough remaining revisions to resolve/release all
current unfinished work. Admission/preparation that would
exhaust this closing budget fails with the old state bytes and revision unchanged.
The reserve uses maximum identifier and proof sizes, including status-length
changes. This guarantees capacity for closing admitted work; it does not promise
room for another claim, operation, or scope-bound history record.

Released claims and resolved operations remain in the current epoch. There is no
automatic pruning, history rewriting or ID reuse. Near capacity, stop admitting
work, reconcile/release current work, and publish/verify the complete terminal
checkpoint and actual evidence. Starting a fresh, empty epoch requires an explicit
reviewed handover and real single-VM/reconciliation evidence; retain the terminal
checkpoint and its Git history. Preserve native path-usage records for the same
root namespace when handing over epochs; clearing history cannot authorize reuse.
Never drop unresolved history to gain capacity.

## Persistence and publication boundary

Local mutations use nonblocking `flock`, exclusive private temp files, atomic
rename, file fsync and directory fsync. State, lock and path symlinks are rejected;
files must be owned, mode 0600, regular and not hard linked. Missing, corrupt,
unknown-version or busy existing state is never initialized implicitly. All clients
must share this one lock inode on a local filesystem with working POSIX semantics.
Do not rename/delete the authority directory, replace the lock, initialize Git
above it, copy live authority or use network filesystems. Empty sandbox-mounted
`.git` placeholders are allowed; real Git directories/worktree markers are not.
The host/user and ancestor directories are trusted, not a hostile-user boundary.

Git stores sanitized checkpoints, **not a distributed mutex**. An external owner
must admit exactly one VM and stop or fence all prior/restored VMs before admission.
Local token rotation does not revoke a copied authority on another VM. There is no
provider fencing, automatic lease reclamation or hard ten-minute guarantee.

Publication is the narrow control-plane action of the admitted
`integration-publication` owner. Under separately granted publication authority,
that owner reviews, commits and publishes an immutable prepared snapshot. It does
not recursively create an intent for publishing that same snapshot. Other worker
effects require prepared-intent publication first. `verify_publication` reads the
remote ref twice and checks the local commit's exact tree/blob with
`--no-replace-objects`. All inherited `GIT_*` variables are removed; global/system
configuration and replacement objects are disabled. The explicitly selected
checkout and its configured remote are trusted. A receipt cannot promise the
remote will retain the ref forever; no receipt is embedded in its own commit.

If push returns unknown, reconcile the exact remote ref/tree/blob. Divergence
requires reconciliation, never force-push, merging authorities, expiry or blind
retry. Local commits remain local-only. Do not advance the checkpoint branch
between verification and dispatch; the integration owner serializes publication.
Actual state changes invalidate old checkpoints; byte-stable replays do not.

Crash windows remain conservative:

1. Before remotely observed preparation, no effect is permitted.
2. Restored prepared intent is potentially executed even if its snapshot predates
   local `begin`. A pre-effect-looking snapshot does not make retry safe.
3. After local pending persistence but before its response, permission may be lost.
   Replay denies; reconcile rather than repeat.
4. After create but before observation/binding/token delivery, the worker waits
   without write authority. Unknown responses keep its reservation. A lost binding
   response requires quiescence/recovery, not token retrieval.
5. After a write but before resolve/checkpoint, recover as uncertain.

`dispatch_authorized=true` means at-most-once **permission issuance**, not
exactly-once execution. The effect adapter must consume a permit once, match the
operation/payload/identity, and remain inside reserved domains. This module cannot
prevent an uncooperative process, copied permit, stale external worker or direct
tool call from writing. It never executes effects. Strict schemas exclude arbitrary
reports and authority fields from snapshots; reviewers must still ensure labels,
request hashes and evidence records do not expose secrets.
