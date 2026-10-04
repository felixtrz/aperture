# Interrupted dependency installation audit

Date: 2026-10-04 UTC. Scope: independent source/artifact audit of unified-exec
session `14255`, lifecycle `run-ccbd47e7aa934ba6bd6f44d966a25408`, and the parent's
`setup-dependencies-001` operation. This report is local evidence, not a dispatch
permit or a claim that the interruption was reconciled.

## Result

**Unreconciled. Preserve the parent's UNKNOWN operation, active lifecycle,
running dependency stage, and partial installation. Do not retry or reset.**

The available artifacts and documented tool interfaces do not establish the fate
of the original installer and every descendant/effect. The exact missing evidence
is a trustworthy terminal/containment observation for the original invocation,
followed by reconciliation of its actual filesystem and any delegated effects.
An unavailable session handle, an obtainable lock, absent server metadata, or an
unchanged directory inventory cannot supply that observation.

## Direct observations

- The retained setup state still marks `dependencies` as `running`; the recorded
  wrapper PID is `2`. No original PID-namespace identity, process start identity,
  or descendant inventory is stored there.
- The exact lifecycle manifest is `active`. Its sole retained audit event is
  `run-start`; there is no `run-completed`, `run-error`, or stage receipt.
- There are 761 directories under `node_modules/.pnpm`. The root modules manifest
  and TypeScript/Vite package probes are absent. The expected local store-server
  directory is absent. These are current partial-install observations only.
- The interruption record reports the policy-blocked registry error, then
  `Unknown process id 14255`. It also records that both exact locks were obtainable
  and that a separately approved read-only registry HEAD returned HTTP 200.
  This auditor did not repeat the network probe, acquire either lock, or poll the
  old session again. A successful network probe is not permission or evidence for
  retrying this unresolved operation.
- Current observer PID/mount namespace labels were read. They are not linked to
  the interrupted session. Repeated current inode labels are not provider process
  generations, and a current process listing cannot establish the original tree.

`observations.json` contains actual paths, byte hashes, read-stability checks,
retained state, and current artifact observations. All 18 hashed reads were stable
during their individual reads. This is not a guarantee of future immutability.

## Exact source findings

### The normal lifecycle proof is missing

`tools/recovery/cleanup.py:440–478` enables a Linux subreaper, holds the shared
lifecycle lock, passes that lock descriptor to the direct child, waits for that
child, and then waits until no child remains before writing completion. Lines
479–487 preserve uncertainty on exceptions. An active manifest provides no proof
that the wait loop completed; neither does the absence of an exception receipt.

`tools/recovery/setup.py:65–85,197–235` blocks a same-boot running stage and retains
running status on an exception. Lines 140–145 order the install, four rebuild
targets, and TypeScript/Vite probes. No evidence shows the later steps ran.
There is no reconciliation CLI in this implementation; `status` and `advance`
are its exposed setup commands. This audit does not invent a reset command.

### An inherited lock is not a universal descendant fence

The installed Corepack bundle, `dist/lib/corepack.cjs:22479–22516`, sets argv and
loads the selected package-manager entry in the same Node process. The pinned
pnpm entry, `bin/pnpm.cjs:1–27`, loads its bundle. These particular transitions do
not show a child-process hop that drops the lifecycle descriptor.

However, the exact pnpm 10.12.1 bundle contains a concrete optional counterexample:

- `dist/pnpm.cjs:102006–102048` can connect to an existing store server or launch
  one when `useStoreServer` is enabled.
- `dist/pnpm.cjs:101941–101945` selects the background server launcher.
- `dist/pnpm.cjs:101909–101924` spawns detached with only a three-element stdio
  array, then calls `unref()`. It does not pass the Aperture lock descriptor.
- `dist/pnpm.cjs:8034–8045,17117–17118` accepts environment-derived configuration
  and the relevant store-server options. `setup.py:102–106` copies the inherited
  environment rather than recording a complete effective-config snapshot.

**This is a conditional source path, not evidence that a daemon actually ran.**
Likewise, present-day absence of its metadata does not demonstrate what ran in
the interrupted invocation. The normal fetch pool also uses Node worker threads
(`dist/pnpm.cjs:97038–97045,97137–97152`); this does not prove that every possible
effect was confined to that pool. No credentials, private environment, or private
package-manager configuration was read to make an unsupported historical claim.

Node documents that extra descriptors are not inherited unless specified in
stdio. That supports the narrow source-level counterexample above, not a finding
about the actual old descendants. See [Node child-process stdio documentation](https://nodejs.org/api/child_process.html#optionsstdio).

### The provider evidence is unavailable through the exposed interfaces

The available tools provide no authoritative descendant-termination receipt for
this prior session. No supported containment query was found. An unknown process
ID is not a terminal exit receipt, and the observed policy error does not itself
establish that the entire original process tree was killed and reaped.

Linux does terminate the processes of a PID namespace when its init terminates.
That could support reconciliation only with an actual binding from session 14255
to that containment boundary and evidence that its init terminated. Neither is
present. The kernel rule is not a statement about this provider's error handling.
See [Linux PID namespaces](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html).

## Minimal next action and stopping condition

1. Retain the original UNKNOWN reservation and all current run/setup/partial-install
   bytes. No supported local retry/reset is justified by this audit.
2. Obtain a real executor/provider or operator observation tying session 14255 to
   a terminal process tree or completely retired containment boundary, including
   descendants and any delegated work. An actual surviving supervisor receipt
   that proves its wait loop completed would also be relevant. This is a required
   missing input; no currently exposed tool is claimed to provide it.
3. If that evidence becomes available, reconcile the exact effects and preserve
   the original interrupted result. Only then consider a separately permitted,
   reviewed state transition and a fresh dependency-stage attempt. Full setup,
   rebuild, build, runtime, and browser gates still apply.

Without step 2, the supported outcome is to remain blocked in this scope. Time,
static source review, alternate permissions, new locks, new operation IDs, or
editing the running flag must not substitute for evidence. Verified retirement of
the entire original environment may supply containment evidence, but a new boot
ID or missing path alone does not.

## Source identities and audit completion

Publication excludes internal tool metadata and instructions, private authority,
credentials, private environment/configuration, and protected session data. The
publishable audit consists only of this report, `observations.json`, and the local
exclusion rule. Local internal tool metadata is expressly excluded from Git and
must not be included through a broad directory upload.

SHA-256 of inspected source bytes:

- `tools/recovery/cleanup.py`: `1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`
- `tools/recovery/setup.py`: `1b02c3666bb0f3297de6dd6567a901ddb07906df8fbe4c4ceec23bcb3a22616b`
- Installed Corepack `dist/lib/corepack.cjs`: `4c348070c8937f4693d6ccb128f7d034a2542932b9ed7968cbb9a3fe38158d4a`
- Pinned pnpm `bin/pnpm.cjs`: `b276da51dc8ca5b0d3ee3371695b50fc8b3244b281b091c63a3f082a88dadeb9`
- Pinned pnpm `dist/pnpm.cjs`: `41d1c32fa13a9db906f088c93233df01dec87da32a0ce32523e66ac41b2728fd`

The local checkout HEAD was `3af21132cf20a393c82e0b558070c84400560787`, tree
`68dc525e64081422dbf72aa0038abbfc37079b9a`, with existing recovery/coordinator
changes in the working tree. Source-specific hashes identify the actual inspected
bytes; this report does not claim local HEAD was the newer published audit permit.

No installer, rebuild, build, browser, dynamic CPU test, cleanup, deletion,
publication, or coordinator mutation was performed. No descendant agents or
persistent workloads were spawned. All audit commands returned normally. The only writes were the artifacts inside
`benchmarks/dependency-interruption-audit-20261004`. The auditor has no pending
tools or background work. This scoped audit quiescence says nothing about the
unknown installer; its reservation must remain retained.
