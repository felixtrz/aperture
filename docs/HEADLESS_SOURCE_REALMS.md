# Headless source realms

File-based headless execution uses a fresh native Node Worker for each session
start, reset, restore, or one-shot command. Edit ordinary TypeScript source, call
`app_reset({ target: "headless" })`, then step and inspect the resulting ECS state.
The config, discovered system files, and transitive native imports are evaluated
again. Component IDs and EliCS world storage belong to that execution realm, so
simultaneous sessions can define the same component ID independently.

This applies to MCP, `aperture headless serve`, `aperture headless`, and the
exported file-based client:

```ts
import { createHeadlessSessionClient } from "@aperture-engine/cli";

const session = await createHeadlessSessionClient({
  configFile: "/project/aperture.headless.config.ts",
  root: "/project",
  seed: 7,
  assetMode: "strict",
  publicDir: "public",
  allowHttpAssets: false,
  determinism: "off",
});
try {
  await session.step({ frames: 1, delta: 1 / 60 });
  const result = await session.callTool({ name: "ecs_list_systems" });
  await session.reset(); // Fresh source and fresh state, same default seed.
} finally {
  await session.dispose();
}
```

All client operations are asynchronous. The Worker owns the authoritative world;
the host receives JSON data and existing RenderBundle/SessionSnapshot encodings.
`extract()` returns the serialized result rather than a live RenderSnapshot or
asset registry. Host rendering consumes an exported bundle. Requests return
`executionRevision` and `sourceRevision`; `cachedStatus()` is explicitly a cached
readback. Use `status()` for a fresh read. The existing
`createHeadlessSessionController()` and
`createHeadlessSessionControllerFromConfig()` remain in-process APIs for callers intentionally supplying functions and classes; their
reset reuses those supplied modules and does not provide source isolation.

## Source and SDK identity

The first runtime import selects the app SDK resolved from the config location.
All engine runtime imports and EliCS then resolve through that physical app
anchor, including imports made by the CLI controller. This prevents a globally
installed CLI from creating a world with one SDK copy while project systems
extend another copy. Missing exports or runtime packages in a selected project
SDK fail with diagnostics. Only tooling dependencies such as the system-discovery
loader can fall back to the CLI installation. When no project app package exists,
the CLI's entire SDK graph is used; install the project SDK to pin this choice.

The CLI checks required APIs, not a complete semantic-version compatibility
matrix. Use compatible CLI and SDK releases. The source manifest records exact
bytes returned by the native file loader outside node_modules, SHA-256 hashes,
physical SDK binding URLs, and a digest of that manifest. It does not hash every
transitive package file or freeze files on disk. A file edited during loading may
produce a mixed disk revision; the manifest describes the bytes actually loaded.
Dynamic imports add to the current source revision when evaluated. Native Node
TypeScript syntax and resolution rules still apply.

## Reset and restore

Replacement first loads and preflights the candidate source without creating a
world. Syntax/config errors and known snapshot schema mismatches preserve the
old ready world. Once preflight succeeds, new runtime calls close, accepted work
drains, the old world disposes, and its Worker must exit before the candidate
world boots. Calls arriving during replacement fail promptly; overlapping
replacement requests are rejected. A failed candidate boot leaves a stopped,
retryable client when all cleanup succeeded. Reset can retry corrected source.

Saved snapshots keep the existing app snapshot format and add optional
`headlessExecution` metadata: source provenance, exact component definitions,
resource field names/kinds, and authored system order/name/priority/state hooks.
Restore reloads source into a new realm and validates this compatibility before
applying world/private/RNG/time/resource/asset state. Definitions created during
initialization receive a second check after boot and before restore; such a
mismatch can occur after the old world has already retired. Compatible code edits
are allowed and reported as `sourceChanged`. Custom private state still needs
compatible `snapshotState()`/`restoreState()` semantics; automatic data migration
is not supplied. Legacy snapshots restore with `legacy-unverified` compatibility
and a warning rather than an unsupported claim of schema verification.

## Queues, deadlines, and cleanup

The client admits a bounded FIFO queue: by default 128 requests and 16 MiB of
queued JSON input. Runtime requests have a 60-second deadline including queue
wait; expired queued calls are not applied. Source preparation/boot each allow
120 seconds. Reply JSON is capped at 128 MiB and source manifests at 2,048 native
file modules. Client options can configure these limits. Values must be finite,
plain JSON data; functions, cycles, typed buffers, and live ECS objects fail at
the boundary. Use the existing bundle/snapshot codecs for assets and geometry.

A running request timeout has unknown effects and retires the Worker. Cleanup is
reported truthfully, including `exitObserved`, exit code, forced termination, and
bounded original error stacks/causes. Terminating JavaScript is not proof that
app owners disposed gracefully. An unclean exit sets a sticky cleanup breaker;
reset/start must not silently clear it. Inspect retained diagnostics and restart
the owning process before establishing another managed session after such a
failure. Exit history retains the latest 32 realm retirements.

Disposal rejects new work immediately, drains accepted requests and replacement,
attempts every owned cleanup, and observes actual Worker exit. It is idempotent.
The default retirement budget has three bounded phases of up to 30 seconds each:
request app disposal, wait for natural exit, then force termination and wait for
observed exit. A forced or unobserved exit remains a cleanup failure. Author
console output is captured as bounded session log chunks; it cannot corrupt MCP
or one-shot JSON stdout. One-shot structured output callback failures are retained
while the child completes its cleanup.

`withLease()` holds host bundle export/capture under one accepted revision. Its
host callback shares the request deadline and receives an AbortSignal. Expiry
invalidates future lease calls and holds the revision barrier while cancellation
settles, bounded by the disposal timeout. Host code must honor the signal and
release its own rendering work. Unobserved or failed host cleanup sets a sticky
cleanup breaker even if the JS Worker subsequently exits gracefully. MCP closes
an expired warm renderer and guards PNG publication after abort. Detached bundles can
outlive their realm without retaining an ECS world.
