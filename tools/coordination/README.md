# Durable coordination recovery

This is a conservative reconstruction authorized on 2026-10-02, not the lost
helper or ledger recovered byte for byte. It is Python 3.10+ stdlib code for a
trusted, cooperative, single-host POSIX environment. No engine code changes.
Read [ADOPTION.md](ADOPTION.md) before using it. No production authority has been
created or admitted by this implementation task.

```sh
python3 -B -m unittest discover -s tools/coordination -v
python3 -B tools/coordination/workflow.py /absolute/private/state tick
```

The CLI accepts request objects on stdin and emits JSON. Secret-bearing commands
must use protected pipes, never shell history, transcript logs or tracked files.
The Python API has the same method names. Errors deny dispatch. Callers must also
treat EOF, timeout, exceptions and malformed responses as denial/uncertainty.
There are no dependencies, browser launches, worker restarts, pushes or cleanup
operations in the coordinator.

## Authority and operations

- `bootstrap(path, snapshot)` exclusively creates a new mode-0700 directory outside
  Git; it never replaces missing/corrupt state in an existing directory. Every
  restore generates a fresh epoch and private authority, sets a global barrier,
  invalidates prior claim tokens and quarantines all unfinished claims. Even a
  snapshot with only released claims restores unarmed.
- `reconcile_recovery(authority, evidence, admission)` requires all-worker,
  descendant, tool and effect reconciliation plus an external single-VM admission
  attestation. It releases historical reservations, retains their records and
  rotates authority again. It does not prove those assertions or fence a VM.
- `claim(authority, claim_id, owner, domains)` atomically reserves all exact domain
  names or none. Claim IDs cannot be reused, including after release. Canonical
  domain `integration-publication` is reserved for the sole integration/publication
  owner. Every caller must use the same domain vocabulary; domain names are opaque,
  not filesystem paths or hierarchical locks. No lease or clock can reclaim them.
- `prepare(claim_id, token, operation, kind, task, incarnation, payload)` records a
  stable operation ID, exact planned worker identity/incarnation, action kind
  (`spawn` or `write`) and SHA-256 of the immutable bounded action specification.
  Domains must already be reserved. It never authorizes dispatch. Only one
  unfinished operation per claim is allowed. Duplicate preparation denies dispatch
  and never replaces the existing intent. Use nonsecret labels and payload hashes.
- `checkpoint()` returns `{durability: "local-only", snapshot: ...}`. Write only
  the snapshot, encoded with `workflow.encoded`, to the reviewed Git checkpoint.
  It omits authority and claim hashes as well as live tokens. It never publishes.
- `begin(claim_id, token, operation, publication)` verifies the prepared checkpoint
  against the exact remote ref, commit, tree and snapshot bytes, then persists
  pending status before returning `dispatch_authorized=true` for one bounded action.
  `publication` contains `repo`, `remote` (configured remote name), `ref` (full
  branch ref), `commit`, `tree`, and `snapshot_path`. Commit objects must already
  exist locally. A changed local snapshot or remote ref denies dispatch. Replays
  deny dispatch, including after a lost successful response. The payload hash is
  returned so the effect adapter can check the exact action before executing it.
- `bind(claim_id, token, operation, task, incarnation)` accepts only the exact
  pending spawn target, records the actual worker and rotates the claim token
  **before** any worker write may be prepared. The initial spawned worker must
  wait for this new token and subsequent write permission before consequential
  work. If the spawn API cannot preassign an exact identity/incarnation, an adapter
  must reserve one and enforce the binding; do not weaken this check.
- `resolve(claim_id, token, operation, evidence=None)` marks an effect unknown when
  evidence is absent; reservations remain. An explicit reconciliation proof can
  resolve a prepared, pending or unknown intent. Unknown spawn outcomes cannot be
  bound or redispatched. Stop/reconcile before a new operation.
- `release(claim_id, token, evidence)` requires reconciled operations and fresh
  evidence of real worker, descendant and tool quiescence and effect reconciliation.
  A bound spawn still requires this evidence. Reports or exit codes alone do not
  establish descendant quiescence. Duplicate release fails closed.
- `tick()` is read-only. It neither restarts workers nor advances leases or state.

A proof object has exactly `workers`, `descendants`, `tools`, `effects` set to true
and `evidence` equal to the SHA-256 of a separately reviewed evidence record. The
admission object has `single_vm: true` and a separate evidence digest identifying
an external operator/provider admission decision. Never submit these attestations
merely to clear a blocked operation. Evidence must cover all affected resources;
recovery reconciliation covers the entire former authority, not just one worker.

## Persistence and publication boundary

Local mutations use nonblocking `flock`, exclusive private temp files, atomic
rename, file fsync and directory fsync. State, lock and path symlinks are rejected;
files must be owned, mode 0600, regular and not hard linked. Existing missing,
corrupt, unknown-version or busy state is never initialized implicitly. All clients
must share this one lock inode on a local filesystem with working POSIX semantics.
Do not rename/delete the authority directory, replace the lock, initialize Git
above it, copy live authority, or use network filesystems. Empty sandbox-mounted
`.git` placeholders are allowed; real Git directories and worktree markers are not.
The host/user and ancestor directories are trusted; this is not a hostile-user
filesystem security boundary.

Git stores sanitized checkpoints, **not a distributed mutex**. An external owner
must admit exactly one VM and stop or fence all prior/restored VMs before arming.
Local token rotation does not revoke a different VM's copied authority. There is
no provider fencing, automatic lease reclamation or hard ten-minute guarantee.

Publication is the narrowly scoped control-plane action of the already admitted
`integration-publication` owner. Under separately granted publication authority,
that owner reviews and commits an immutable prepared snapshot, then publishes it.
It does not recursively create a dispatch intent for publishing that same snapshot.
All worker effects require prepared-intent publication first. `verify_publication`
reads the remote ref twice and checks the local commit's exact tree and blob. It
returns an observation receipt outside the manifest; it cannot promise the remote
will retain that ref forever. No receipt is embedded in its own commit.

If push returns unknown, do not repeat the effect or call the snapshot durable.
Reconcile the exact remote ref/tree/blob. A mismatch or divergent branch is a
conflict requiring operator reconciliation, not force push, merge of authorities,
lease expiry or optimistic retry. Local commits alone remain local-only. Do not
advance the checkpoint branch between verification and dispatch; publication is
serialized by the single integration owner. Other local state changes invalidate
an old checkpoint and require another reviewed snapshot.

Crash windows are deliberately conservative:

1. Before preparation is remotely observed: no effect is permitted.
2. After remote prepared snapshot, before or after local `begin`: restore treats
   the intent as potentially executed. It cannot infer that a pre-effect snapshot
   permits a safe retry.
3. After local persistence, before the response: permission may be lost; replay
   denies. Reconcile, never blindly repeat.
4. After spawn, before binding/token delivery: spawned worker waits; reservations
   remain. Lost binding response requires quiescence/recovery, not token retrieval.
5. After effect, before resolve or its later checkpoint: recover as uncertain.

`dispatch_authorized=true` means at-most-once **permission issuance**, not
exactly-once execution. The actual effect adapter must consume the permission only
once, verify its operation/payload/worker binding and remain inside reserved domains.
This module cannot prevent an uncooperative process, copied permit, stale external
worker or direct tool invocation from writing. It deliberately never executes the
effect. Strict schema projection prevents authority fields and free-form reports
from entering snapshots; reviewers must still ensure identifiers themselves do not
contain secrets. No generic serializer can identify every secret embedded in a label.
