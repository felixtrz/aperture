# Orchestration contract

The coordinator issues permissions; it is not a provider SDK or a deployed tool
interceptor. These mappings describe how the real parent/tool adapter must use
`collaboration.spawn_agent` or `cloud_threads.create`. Provider calls themselves
are not exercised by the local Python fixtures. Do not enable production dispatch
until the actual adapter satisfies this contract. Aperture development remains in
the dot cloud environment; its separate Codex jobs remain publication-only under
the user's current instructions.

## Immutable create request and one permission

1. Reserve the exact domains. Choose a never-reused operation ID and a random
   `secrets.token_hex(32)` correlation nonce. They are nonsecret correlation data,
   not worker identity or authorization tokens.
2. Construct the **complete** provider request, including environment selector,
   task name/title, model settings and the waiting-only initial instruction. Put
   the operation ID and nonce in that instruction. It must direct the child to do
   no consequential work, spawn no descendants, and await a separate bounded
   write permission. Cloud tasks must retain the exact observed running turn;
   local-native tasks may wait/idle within the registered logical execution scope. Do not use an initial
   prompt that starts the actual assignment automatically.
3. Retain the immutable request locally; compute `sha(encoded(request))`. The
   specification contains this exact digest, provider, exact parent identity and
   the native requested task path (or null for cloud). Pass it with the nonce to
   `prepare_spawn`. The manifest stores the request digest, not arbitrary prompt
   text or credentials. Keep reviewable nonsecret request evidence with its record.
4. Publish the prepared canonical checkpoint through the authorized publication
   owner. Verify the exact remote receipt and call `begin` once.
5. Before calling the provider, compare `dispatch_authorized`, operation, nonce,
   specification, payload, request digest and intended claim against the local
   request. Recompute `spawn_payload(nonce, specification)`. Consume the successful
   response once; no replay, retry loop or different create request is authorized.
6. Call the indicated real create tool exactly once. Persist a sanitized receipt
   tying its invocation/result to the original claim, operation, nonce, payload,
   request digest and provider identity. Hash that receipt as `observed.evidence`.
   Do not treat a similarly named task found in a list as the result of this call.
7. Call `record_spawn` once with the exact provider result, then `bind` with the
   identical observation. Binding rotates the token. The trusted parent may retain
   this token privately; a worker only needs its exact bounded effect permission,
   not the authority token. Never put live tokens in prompts, chat or Git.
8. Only now prepare/publish/begin a separate bounded write using the exact bound
   identity/incarnation. The execution adapter verifies current context and the
   payload/domain scope before executing. Local-native `begin` requires the actual
   current `root_id` from authoritative routing/context and rechecks boot/epoch.
   Cloud turns retain their distinct provider identity; later turns cannot reuse a
   permission. A native follow-up can retain the same logical owner only after prior
   effects/descendants are reconciled and with a new bounded permission.

If a runtime cannot establish the applicable provider or local logical identity,
keep the worker waiting for authorization, or deliver one bounded permission to
that identity, it cannot implement this adapter. Leave dispatch blocked rather than asserting those
capabilities. Merely telling a child to wait is a cooperative protocol, not provider
fencing or a technical sandbox. Direct tool calls outside the protocol are not
protected by this helper.

## Native local task-path adapter

The native `collaboration.spawn_agent` interface in this environment returns the
canonical `task_name`; it does not expose an `agent_id`. The runtime rejects
repeated paths in one root namespace. Do not invent a provider generation to fill
the missing field. Use the explicit cooperative `native-local-v1` scheme instead.

After external admission, call `register_native_execution` once with the observed
root conversation ID and an evidence record attesting its actual context and the
runtime's unique-task-path contract. The coordinator reads this host's actual
`/proc/sys/kernel/random/boot_id`; the registered scope contains that boot ID, the
root conversation ID and the current coordinator recovery epoch. These are local
observations, not proof of VM exclusivity, remote cancellation or internal process
restart detection. Kernel boot IDs can be shared across container environments.

For an observed parent `/root` spawning `task_name: "inspect_mesh"`, the native
specification uses `requested_task: "/root/inspect_mesh"` and the exact registered
`local_execution` scope. Hash the complete waiting-only request as usual. After
one gated call returns, use the actual returned canonical path:

```python
scope = co.register_native_execution(authority, observed_root_conversation_id, {
    "scope_observed": True,
    "unique_task_paths": True,
    "evidence": sha(encoded(reviewed_namespace_observation)),
})["scope"]
# Include scope as specification["local_execution"] BEFORE prepare/publish/begin.
# Call collaboration.spawn_agent exactly once after the successful begin permit.
observed = native_observation(
    scope,
    response["task_name"],
    sha(encoded(reviewed_create_invocation_and_result)),
)
co.record_spawn(claim_id, token, operation, nonce, prepared_payload, observed)
token = co.bind(claim_id, token, operation, nonce, prepared_payload, observed)["token"]
```

`native_observation` derives `incarnation` as `local:` plus the SHA-256 of the
canonical scheme, registered scope and exact returned path. The creation receipt
is a separate immutable hash tied to the original operation/nonce/payload/request
and actual result. Hash that original receipt before adding derived binding fields;
there is no self-referential receipt hash. The derived value is explicitly a local
logical identity, not a provider-issued instance ID.

Mismatched returned paths, wrong scope, ambiguous/lost results, or changed receipts
during binding fail closed. A `local:` identity with its scope omitted also fails.
A **new create** cannot reuse a recorded task path in the same root conversation,
even after release, a boot change or a coordinator-epoch change. Preserve prior
path usage when handing over epochs. The provider's actual path-uniqueness
constraint remains necessary when the locally recovered history is incomplete.

For each local-native write, pass the actual current root conversation ID to
`begin(..., root_id=observed_root_conversation_id)`. The trusted parent can use its
authoritative current routing/context; no nonexistent provider-ID lookup is
required. The coordinator independently rechecks the kernel boot ID and its
registered epoch. Each write still needs its own published intent and at-most-once
permission. A native follow-up turn is the same logical owner only within this
scope and after previous effects/descendants are reconciled. This does not claim
observation of internal process generations or fence an uncooperative worker.

A different native provider that genuinely returns an immutable generation ID may
use the original provider-observed identity form without `local_execution`.
That is an explicit alternative backed by actual evidence, never a fallback from
missing local scope. Cloud identity does not use this local substitute.

## Cloud provider-assigned identity example

Before `cloud_threads.create`, use `provider: "cloud"` and
`requested_task: null`. The complete hashed request includes the selected
`environmentId` or `environmentConfigId` when applicable. There is no thread ID or
turn ID before creation. The parent's actual provider identity remains a separate
`specification.parent` field.

After a confirmed create response, map its exact `threadId` and `turnId`:

```python
observed = {
    "provider": "cloud",
    "task": response["threadId"],
    "incarnation": response["turnId"],
    "evidence": sha(encoded(reviewed_invocation_receipt)),
}
co.record_spawn(claim_id, token, operation, nonce, prepared_payload, observed)
token = co.bind(claim_id, token, operation, nonce, prepared_payload, observed)["token"]
```

`threadId` is not a native `/root/...` path, and the task's title is neither field.
The binding does not authorize future turns on the same thread. In particular,
`cloud_threads.send_message` can start a **new** turn when a task is idle. Check
actual lifecycle state; do not use it as if it guaranteed delivery to the original
turn. If the intended incarnation has ended, reconcile/release it, then explicitly
adopt a known waiting incarnation under a new claim and fresh evidence. Do not
rewrite an existing binding or replace `turnId` with `threadId` to avoid this guard.

## Unknown creation and lost responses

A create error, timeout or ambiguous response is an unknown effect, not a failed
spawn. Call `resolve(..., evidence=None)` when state is available. If that call is
also uncertain, stop. Do not repeat create, record an identity discovered by a
name-only search, bind an unknown operation, or release its scope optimistically.
Reconcile the exact original invocation, actual provider task/turn, descendants,
tools and effects, including any orphan. Only real proof can resolve the intent.
A repeated observation or bind fails even if identical. If binding persisted but
its token response was lost, quiesce/recover; no token retrieval API exists.

## Existing parent or worker adoption

An already-running parent must not spawn a fake `/root` worker to earn permission.
After admission and evidence-backed domain availability:

1. Register the observed local namespace as above. Establish the actual current
   root conversation, host boot, exact existing task path and waiting state from
   authoritative context. Alternatively use a genuinely observed provider generation
   when that provider exposes one; a canonical path alone is insufficient.
2. Verify the owner has no ungated in-flight effects or descendants. Preserve these
   observations in a reviewed adoption receipt. Existing-root adoption uses this
   real root observation, never a fabricated spawn result.
3. Build `observed = native_observation(scope, "/root", adoption_receipt_digest)`
   for the actual root. Claim with `owner` equal to its exact task path, then call
   `adopt_existing` with authority, claim token and the matching adoption evidence.
4. Retain the rotated token privately. Prepare/publish/begin ordinary bounded writes
   with the current root ID. There is no fake spawn event in its history.

Sequential claims may explicitly re-adopt the same logical local owner after real
reconciliation. The derived identity remains unchanged while scope/path are the
same; the fresh adoption evidence is separately recorded. An unreleased binding
for that same local identity cannot be duplicated. A new create at the old path
is still forbidden. Wrong authority/owner, prior operations on the new claim,
missing evidence and repeated binding fail closed.

Recovery registration does not erase old scope observations, cancel old tasks or
release uncertain effects. Re-adoption across recovery still requires the same
real `no_ungated_effects` evidence even when the new domains are proven disjoint.
Historical effects remain quarantined until their own scope/effect reconciliation
is supported. Boot/root/epoch metadata is never a substitute for that evidence.
