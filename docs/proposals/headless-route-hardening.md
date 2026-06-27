# Headless Route Hardening Plan

## 1. Summary

The headless validation loop works, but it is held together by a Vite SSR workaround, a repo-only render path, a reboot-per-call model, and two silent correctness gaps (nondeterminism + placeholder assets). This plan hardens and *simplifies* it in four tracks. Because the engine APIs are explicitly unstable and there is no backward-compat constraint, we delete machinery rather than wrap it: Track A removes the entire Vite SSR config/system loader in favor of native Node `.ts` import (verified single-realm on Node 22.22.2), which also lets us revert the subprocess-only tests and the coverage exclusions that workaround forced. Track B makes `aperture render` resolve engine packages dynamically so it survives an npm install instead of only the source checkout. Track C adds a warm `serve` mode that boots once and dispatches stdin JSON-lines commands through the engine's *existing* in-process devtools router. Track D closes the two honesty gaps: a seeded RNG/sim-clock on the system context, and structured real-vs-placeholder asset provenance surfaced through status, the bundle, and the render warning. Track A lands first because it removes a footgun every other track would otherwise inherit and unblocks in-process testing for all of them.

## 2. Current pain points

| Area | What's fragile/limited today | Evidence |
|---|---|---|
| Config/system loading | In-process Vite SSR server + `createServerModuleRunner` + `ssr.external` exist only to dodge a dual-realm "Component already exists" bug that **does not occur** under native Node import. Forces subprocess-only engine tests and a coverage exclusion. | `vite-runtime.ts`; `config-loader.ts:44-50,83`; `vitest.config.ts:184-195` |
| Render portability | `resolveApertureWebRoot` walks parents for `examples/render-harness/index.html`; static server hardcodes `examples/packages/node_modules` top-level dirs; harness importmap hardcodes `/packages/*/dist`. None survive an npm install. | `driver.ts:37-63`; `static-server.ts:22`; `index.html:7-24` |
| Render resolution | `import.meta.resolve` silently works for hoisted pkgs (app/physics) but fails for render/webgpu/runtime/simulation/math; importmap has 3 dead entries (`math/kernel`, `webgpu/test-support`, `wgpu-matrix`). | Investigator B empirical trace |
| Per-call cost | `aperture render` and `aperture headless` reboot everything per invocation; no boot-once-then-microseconds loop for shell agents. | `driver.ts:74-116`; `headless.ts:55-86` |
| Determinism | No RNG service, no sanctioned sim-time on `ApertureSystemContext`; user `Math.random()`/`Date.now()` silently breaks bit-identical replay. | `context.ts:63-89`; no RNG in src |
| Asset honesty | Placeholder assets are marked `status:"ready"` with synthetic bytes; the "placeholdered" list lives only in a CLI closure and never reaches status/bundle/render. Agents can't tell a stubbed render from a real one. | `assets.ts:317-331`; `node-asset-loader.ts:7-44`; `bundle.ts:20-26` |

---

## 3. Track A — Drop the Vite SSR loader (highest priority)

**Decision: go native type-strip, not jiti.** All 42 config/system files are erasable-only TS with bare `@aperture-engine/*` specifiers; native import is zero-dep, has no module-cache/realm footgun, and "erasable-only headless TS" is an acceptable documented constraint for an unstable engine. Jiti is held in reserve (PA.5) only as a documented fallback path, not adopted now.

### PA.1 — Rewrite the loader to use native import

- **Goal** — `loadApertureHeadlessApp` loads the config and each system via native Node `.ts` import with no Vite involvement, sharing the single already-loaded engine instance.
- **Changes**
  - Edit `packages/cli/src/headless/config-loader.ts`: delete the `import type { Alias } from "vite"` (line 9), delete `import { createHeadlessViteRuntime }` (line 11), delete the `aliases` option (lines 18-19) and its spread at the call site (lines 44-47). Replace both `runtime.importModule(file)` calls (lines 50, 83) with `await import(pathToFileURL(absPath).href)` (add `import { pathToFileURL } from "node:url"`). Remove the `try/finally { runtime.dispose() }`. Keep `assertConfigFileExists`, mode/default-export validation, and `createApertureSystemManifest` discovery unchanged.
  - Wrap the config `await import` in a try/catch that maps `ERR_MODULE_NOT_FOUND` and `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`-class failures to a new `ApertureCliError("aperture.headless.configLoadFailed", …)` with a clear message ("resolve `@aperture-engine/*` from the config's project / config uses non-erasable TS").
- **Acceptance criteria**
  - [ ] `config-loader.ts` contains no reference to `vite`, `Alias`, `createHeadlessViteRuntime`, or `aliases`.
  - [ ] `loadApertureHeadlessApp` against `test/fixtures/headless-procedural` returns `config.mode === "headless"` and `systems[0].default` is a class, with no "Component … already exists" error.
  - [ ] `aperture headless <fixture-config> --out <bundle>` produces a byte-identical bundle to the pre-change `main` run (snapshot unchanged).
- **How to test**
  - `pnpm --filter @aperture-engine/cli build && node packages/cli/dist/bin/aperture.js headless test/fixtures/headless-procedural/<config> --out /tmp/a.bundle` — exit 0, bundle written.
  - Add `test/cli/headless-loader.test.ts` (PA.4) asserting the above in-process.

### PA.2 — Delete `vite-runtime.ts` and its tests/fixtures

- **Goal** — the dual-realm workaround and everything that existed only to serve it are gone.
- **Changes**
  - Delete `packages/cli/src/headless/vite-runtime.ts`.
  - Delete `test/cli/headless-runtime.test.ts` (tests `createHeadlessViteRuntime`; its config-not-found assertion moves to PA.4).
  - Delete `test/fixtures/headless-procedural/plain-module.ts` (existed only to exercise the Vite TS transform without the engine).
- **Acceptance criteria**
  - [ ] `git status` shows `vite-runtime.ts`, `headless-runtime.test.ts`, `plain-module.ts` deleted.
  - [ ] `pnpm -r exec tsc --noEmit` passes (no dangling imports of the deleted module).
  - [ ] No source file references `createHeadlessViteRuntime` (grep returns nothing).
- **How to test**
  - `pnpm --filter @aperture-engine/cli typecheck` — clean.
  - `pnpm vitest run test/cli` — green with the deleted suites gone.

### PA.3 — Convert the headless command end-to-end tests to in-process

- **Goal** — the real engine-load path is tested in-process, not via a subprocess against `dist`.
- **Changes**
  - Edit `test/cli/headless-command.test.ts`: drop the `beforeAll` build-on-demand (lines 108-118) and the `execFileAsync` end-to-end block (lines 105-213); call `runHeadlessCommand` in-process. Keep **exactly one** subprocess smoke test that runs `node packages/cli/dist/bin/aperture.js headless …` to prove the shipped binary boots.
- **Acceptance criteria**
  - [ ] `headless-command.test.ts` no longer imports `execFileAsync` except in the single retained smoke test.
  - [ ] In-process tests assert: bundle written, `status.frame` advanced by the stepped count, diagnostics surfaced for the bad-system fixture.
- **How to test**
  - `pnpm vitest run test/cli/headless-command.test.ts` — green, runtime noticeably lower (no per-test pnpm build).

### PA.4 — Add a genuine in-process loader unit test

- **Goal** — `config-loader.ts` has real coverage of the engine-load path that was previously subprocess-only.
- **Changes**
  - New file `test/cli/headless-loader.test.ts`: calls `loadApertureHeadlessApp({ configFile, root })` against `test/fixtures/headless-procedural` and asserts `config.mode === "headless"`, `systems[0].default` is a function/class, a `missingDefaultExport` diagnostic appears for the bad-system fixture, and `aperture.headless.configNotFound` is thrown for a missing path.
- **Acceptance criteria**
  - [ ] New test file exists and passes.
  - [ ] It covers the success path, the diagnostics path, and the not-found path.
- **How to test**
  - `pnpm vitest run test/cli/headless-loader.test.ts` — green.

### PA.5 — Revert coverage exclusion and document the constraint

- **Goal** — the workaround-driven coverage carve-out for the loader is gone and the erasable-TS constraint is written down.
- **Changes**
  - Edit `vitest.config.ts`: remove the `packages/cli/src/headless/config-loader.ts` entry from `coverage.exclude` (line 195) and trim the explanatory comment (lines 184-192) to mention only `render/driver.ts`.
  - Add a short note to the headless CLI help/README: "headless configs and `*.system.ts` must be erasable TypeScript (no enums/decorators/namespaces/parameter-properties); resolved by native Node type-stripping."
- **Acceptance criteria**
  - [ ] `config-loader.ts` no longer appears in `coverage.exclude`; `render/driver.ts` still does (until PB.4).
  - [ ] Coverage report shows non-zero statements/branches/functions for `config-loader.ts`.
- **How to test**
  - `pnpm vitest run --coverage` — passes thresholds; `config-loader.ts` appears in the coverage table.
  - *(Reserve)* If a future user system needs enums/decorators, promote `jiti@2.7.0` to a direct CLI dep configured with `interopDefault:true` + the engine packages in `nativeModules` (port the `ENGINE_PACKAGES` list) so they defer to the host instances. Not done now.

---

## 4. Track B — Portable render command

### PB.1 — Add a pure engine-package resolver

- **Goal** — every importmap target resolves from the CLI's own location under any install layout (pnpm strict, npm v9, packed tarball).
- **Changes**
  - New file `packages/cli/src/render/resolve-engine-packages.ts` exporting `resolveEnginePackages(): Map<specifier, absoluteDistDirOrFile>`. Implement with `createRequire` + `require.resolve.paths(scope)` probing `<dir>/<pkg>/package.json`, `realpathSync`, and **chain transitive deps from each declaring package**: `render`+`app` from the CLI module URL; `simulation` from `render`; `webgpu`+`runtime`+`physics`+`@preact/signals-core` from `app`; `math`+`elics` from `simulation`. **Do not use `import.meta.resolve`** (verified to fail for render/webgpu/runtime/simulation/math).
  - Emit only the live key set: `@aperture-engine/{webgpu,render,runtime,physics,simulation,math}`, `@aperture-engine/app/asset-mirror`, `elics`, `@preact/signals-core` (browser ESM build `signals-core.module.js`). **Exclude** dead entries `math/kernel`, `webgpu/test-support`, `wgpu-matrix`.
- **Acceptance criteria**
  - [ ] `resolveEnginePackages()` returns a non-null absolute, existing file/dir for every live key.
  - [ ] Returned map contains none of the three dead specifiers.
- **How to test**
  - New `test/cli/resolve-engine-packages.test.ts`: assert every value `existsSync`, assert dead specifiers absent, assert `elics` resolved (proves the simulation-anchored chain works under strict layout).
  - `pnpm vitest run test/cli/resolve-engine-packages.test.ts` — green.

### PB.2 — Rewrite the static server as a mount table

- **Goal** — the server serves each engine package's real dist dir from wherever it physically lives, with per-mount traversal safety.
- **Changes**
  - Edit `packages/cli/src/render/static-server.ts`: replace the single `webRoot` + `ALLOWED_TOP_LEVEL` model with `mounts: Array<{ urlPrefix: string; realDir: string }>`. For each engine pkg mount `dist/` at `/_engine/<pkg>/`; vendor at `/_vendor/<name>/`; harness assets at `/`. Re-implement containment per mount: `realpathSync(filePath).startsWith(realpathSync(mount.realDir))`. Keep the 127.0.0.1 bind and content-type table. Add **no** COOP/COEP headers (verified unnecessary — no workers/SharedArrayBuffer).
- **Acceptance criteria**
  - [ ] `startApertureStaticServer(mounts)` serves a file from a mount under `.pnpm/...` (outside `packages/`).
  - [ ] A `..` traversal request returns 403; a path escaping any mount's realpath is rejected.
- **How to test**
  - `test/cli/static-server.test.ts`: start with a temp mount table, fetch a mounted file (200), fetch `/_engine/render/../../etc/passwd` (403), fetch unknown prefix (404).

### PB.3 — Move the harness into a CLI-owned asset and generate the importmap

- **Goal** — the harness ships in the published tarball and its importmap is generated from the resolved set, not hardcoded.
- **Changes**
  - Move `examples/render-harness/render-harness.main.js` → `packages/cli/assets/render-harness/render-harness.main.js` (no code change). Delete `examples/render-harness/index.html`.
  - Generate `index.html` **in-memory in the driver** (template string) with the importmap baked in server-side (importmaps must exist before module scripts; `page.addInitScript` is too late). Ship only `.main.js` as a static asset.
  - Edit `packages/cli/package.json`: add `"assets"` to `files` (currently `["dist","LICENSE"]`).
  - Resolve the asset dir from `import.meta.url` relative to `dist` (no parent-dir walk). If a copy step is needed (tsc won't emit `.js` assets without `allowJs`), add a `cp -r assets dist/` postbuild; otherwise reference `assets/` by relative path from `dist`.
- **Acceptance criteria**
  - [ ] `examples/render-harness/` is deleted; no source/doc references `/examples/render-harness/index.html`.
  - [ ] `pnpm pack --filter @aperture-engine/cli` produces a tarball containing `assets/render-harness/render-harness.main.js`.
  - [ ] Generated importmap contains every live key and none of the dead ones.
- **How to test**
  - `test/cli/render-harness-importmap.test.ts`: call the driver's importmap generator, assert every target resolves to an existing on-disk file (replaces the guard `check-examples.mjs` never provided).
  - `pnpm pack` then `tar tzf <tarball> | grep render-harness` — present.

### PB.4 — Rewire the driver and harden the e2e for portability

- **Goal** — `renderBundleToPng` resolves packages dynamically and works from outside the repo; the coverage exclusion for `driver.ts` can be revisited.
- **Changes**
  - Edit `packages/cli/src/render/driver.ts`: delete `resolveApertureWebRoot` (lines 37-63) and `HARNESS_ROUTE` (line 8). Call `resolveEnginePackages()`, start the static server with the mount table, generate the harness HTML, navigate to it. Keep SwiftShader launch args and the 60s status wait unchanged.
  - Edit `test/e2e/render-snapshot-cli.spec.ts`: add a case that runs `aperture render` with `cwd` set to a temp dir **outside** the repo (ideally against a `pnpm pack`ed CLI installed into a scratch `node_modules`).
- **Acceptance criteria**
  - [ ] `aperture render <fixture-bundle> --out /tmp/out.png` run from `/tmp` (cwd outside repo) exits 0 and writes a non-empty PNG.
  - [ ] `driver.ts` contains no parent-dir walk and no hardcoded `examples`/`packages` paths.
- **How to test**
  - `pnpm --filter @aperture-engine/cli build && (cd /tmp && node /home/user/aperture/packages/cli/dist/bin/aperture.js render <abs-fixture-bundle> --out /tmp/out.png)` — exit 0, PNG > 0 bytes.
  - `pnpm playwright test test/e2e/render-snapshot-cli.spec.ts` — green including the new out-of-repo case.

---

## 5. Track C — Warm/persistent headless mode

**Decision: stdin JSON-lines child process, not a session-file daemon.** Agents want a single long-lived process they own over a pipe; the daemon/CDP/session-file machinery is exactly what this route deletes. **Commands are serialized through a single in-order queue** — do not copy `mcp.ts`'s concurrent fire-and-forget handling (it would interleave a step with a `set_component_field` and corrupt the world).

### PC.1 — Export the in-process tool dispatcher from `@aperture-engine/app`

- **Goal** — the CLI can call the engine's devtools router in Node without dragging in worker/CDP machinery.
- **Changes**
  - Export `callGeneratedDevtoolsTool` (currently unexported, `bridge.ts:113`) via a new subpath `@aperture-engine/app/headless-tools` (or extend `/headless`). Re-export `createGeneratedEntityToolBridge`, `callInputDevtoolsTool`, and the `GeneratedDevtoolsToolResult` type.
  - Add the export map entry in `packages/app/package.json`.
- **Acceptance criteria**
  - [ ] `import { callGeneratedDevtoolsTool, createGeneratedEntityToolBridge } from "@aperture-engine/app/headless-tools"` typechecks from the CLI.
  - [ ] Importing the subpath does **not** pull in worker/port modules (verify no transitive `worker/port` import).
- **How to test**
  - `pnpm --filter @aperture-engine/app build && pnpm --filter @aperture-engine/cli typecheck` — clean.

### PC.2 — `aperture headless serve` protocol loop + command set

- **Goal** — a long-lived process boots the runner once and answers id-correlated JSON-lines commands.
- **Changes**
  - New file `packages/cli/src/commands/headless-serve.ts`: `aperture headless serve <config> [--root <dir>] [--seed <n>] [--auto-step <hz>]`. Boot `createApertureHeadlessRunner` once; on ready, emit `{ ready: true, status }`. Read newline-delimited `{ id, cmd, params? }` on stdin; write one `{ id, ok, result?, diagnostics?, error? }` per request on stdout; logs to stderr. **Single in-order async queue** (mirror `mcp.ts:50-121` transport, *not* its concurrency).
  - Native commands mapping to the runner: `step {delta?,time?}` → `runner.step`; `extract {frame?}` → `runner.extract`; `inject {step}` → `applyApertureHeadlessInjectStep`; `get-status` → `runner.getStatus()`; `bundle {out?}` → `createApertureSnapshotBundle` (inline or to path); `reset {seed?}` → rebuild runner + entityTools; `shutdown` → exit 0.
- **Acceptance criteria**
  - [ ] Piping `{"id":1,"cmd":"get-status"}\n{"id":2,"cmd":"step","params":{"delta":0.016}}\n{"id":3,"cmd":"shutdown"}` yields three ordered response lines with matching ids; frame advances by 1 between status reads.
  - [ ] Two commands sent back-to-back never interleave (queue serialization).
- **How to test**
  - `test/cli/headless-serve.test.ts`: spawn in-process, feed the line sequence, assert ordered id-correlated responses and frame advance.

### PC.3 — Route ecs_/input_/resource_/asset_/physics_ tools through the bridge

- **Goal** — agents get the same MCP tool names/shapes (`ecs_find_entities`, `ecs_snapshot`, `ecs_diff`, `ecs_set_component_field`, `input_*`, …) in the warm session with no browser.
- **Changes**
  - In `headless-serve.ts`: build `entityTools = createGeneratedEntityToolBridge(runner.app.lowLevel.world)` at boot (rebuild on reset). Synthesize `step`/`setPaused`/`getSimulationState` callbacks locally over the warm step loop (manual stepping, no timer unless `--auto-step`). A `{ cmd:"tool", params:{ name, arguments } }` request calls `callGeneratedDevtoolsTool({ app: runner.app, entityTools, … }, { tool:name, payload:arguments })`.
- **Acceptance criteria**
  - [ ] `tool ecs_snapshot` then `step` then `tool ecs_diff` returns a non-empty diff; `ecs_diff` before any snapshot returns the `diff requires a previous snapshot` diagnostic.
  - [ ] `tool ecs_set_component_field` mutates a field readable by a subsequent `ecs_get_entity`.
- **How to test**
  - Extend `test/cli/headless-serve.test.ts` with the snapshot→step→diff and set→get sequences.

### PC.4 — Gate GPU/browser-only tools explicitly

- **Goal** — tools with no Node meaning fail loudly with a structured diagnostic instead of silently returning null or throwing.
- **Changes**
  - In the warm dispatcher, intercept `camera_*`, `browser_*`, `render_get_*`/`render_pick_*`/`render_readback_*` and return `{ ok:false, diagnostics:[{ code:"aperture.headless.toolUnavailable", message:"<tool> requires a GPU/browser; use aperture render." }] }`. Audit `physics_*` per-tool against the Node runner (`app.context.physics` exists) and allow the ones that work.
- **Acceptance criteria**
  - [ ] `tool camera_get` returns `ok:false` with code `aperture.headless.toolUnavailable` (not a throw, not null).
  - [ ] At least one verified `physics_*` query tool returns `ok:true`.
- **How to test**
  - Test asserts the gated-tool envelope and one allowed physics tool.

### PC.5 — `reset` honesty and keep warm-render out of v1

- **Goal** — `reset` gives a clean deterministic world without process restart, and warm render is deferred.
- **Changes**
  - `reset {seed?}` rebuilds the runner via `createApertureHeadlessRunner` + `await preload`, re-seeds the injected clock/seed (depends on PD.1) to the same start, and rebuilds `entityTools` (discarding `lastSnapshot`). Document: reset ≠ process restart, but re-runs app construction + asset preload.
  - Warm `render` is **not** in the stdin protocol for v1: `bundle` writes a snapshot bundle; the agent calls one-shot `aperture render <bundle>`. (Future: lazily-booted kept-warm Playwright driver behind a `render` command.)
- **Acceptance criteria**
  - [ ] After `reset {seed:7}`, two identical step sequences produce identical `extract` output (given PD.1 landed).
  - [ ] The serve protocol has no `render` command in v1; docs point to one-shot `aperture render`.
- **How to test**
  - Test: seed, run N steps, hash extract; reset same seed, rerun, assert equal.

---

## 6. Track D — Determinism + asset honesty

### PD.1 — Seeded RNG service on the system context

- **Goal** — systems have a sanctioned deterministic RNG injectable at app construction.
- **Changes**
  - New file `packages/app/src/systems/random.ts`: a ~10-line mulberry32/xorshift128 PRNG exposing `{ next():number; int(max):number; range(min,max):number; fork(label):ApertureRandom }`, no deps.
  - Add `readonly random?: { readonly seed:number } | ApertureRandom` to `CreateApertureAppOptions` (`advanced.ts:52-62`). Thread through `createApertureSystemContext` options (`context.ts:91-99`) and expose `readonly random: ApertureRandom` on `ApertureSystemContext` (`context.ts:63-89`). Default seed = `0`. Ensure the browser app and worker loop construct the same context shape.
- **Acceptance criteria**
  - [ ] `context.random.next()` is identical across two fresh apps booted with the same seed.
  - [ ] Default (no option) yields a stable, documented sequence.
- **How to test**
  - `pnpm vitest run packages/app` covering `random.ts`; assert determinism and `fork` independence.

### PD.2 — Sanctioned sim-time accessor

- **Goal** — systems read sim time from the context instead of `Date.now()`/`performance.now()`.
- **Changes**
  - Add `readonly time: { readonly delta:number; readonly elapsed:number; readonly frame:number }` to `ApertureSystemContext`, populated each step from the caller-supplied `delta`/`time`/`frame` already in scope at `advanced.ts:221` / `headless.ts:108-111`.
- **Acceptance criteria**
  - [ ] `context.time.frame` increments by 1 per `runner.step`; `elapsed` matches caller-supplied accumulated time.
- **How to test**
  - Unit test in `packages/app` asserting `time` values across stepped frames.

### PD.3 — Determinism replay test + documented constraint

- **Goal** — the seeded path is proven bit-identical and the one constraint is written down.
- **Changes**
  - Extend `test/determinism/replay.test.ts` with a system that calls `context.random`; assert two fresh runs + the committed fixture match.
  - Document in headless help/README: "Replay is bit-identical only if systems use `context.random` and `context.time`, not `Math.random()`/`Date.now()`/`performance.now()`."
  - *(Optional, opt-in)* a `determinism:"strict"` flag that, around each `step()`, swaps `globalThis.Math.random`→`context.random.next` and `Date.now`/`performance.now`→frozen sim-time, restoring after. **Keep opt-in** and per-step scoped (do not leak across warm-mode runs or the shared CLI realm).
- **Acceptance criteria**
  - [ ] `replay.test.ts` passes with a `context.random`-using system; the float-quantized hash matches the committed fixture.
  - [ ] The constraint appears in `aperture headless --help` output and the README.
- **How to test**
  - `pnpm vitest run test/determinism/replay.test.ts` — green.

### PD.4 — Asset provenance in the registry data model

- **Goal** — placeholder assets are distinguishable from real ones at the registry level.
- **Changes**
  - Add `readonly provenance: "loaded" | "placeholder"` (default `"loaded"`) to `AssetRegistryEntry` (`types.ts:64-76`); add a `provenance?` param to `markReady` (`registry.ts:86-96`). At the placeholder fallback (`assets.ts:317-331`) pass `provenance:"placeholder"`. **Change the `ApertureAssetLoader.load` contract** so the Node loader *declares* `{ placeholder:true }` rather than the registry inferring it from "not populated" (avoids mislabeling legitimate deferring loaders).
- **Acceptance criteria**
  - [ ] A stubbed asset's registry entry has `provenance:"placeholder"`; a real one has `"loaded"`.
  - [ ] No registry entry's provenance is inferred from absence of population.
- **How to test**
  - Unit test in `packages/simulation`/`packages/app`: load one real + one placeholder asset, assert provenance values.

### PD.5 — Surface provenance through manifest, status, and bundle

- **Goal** — an agent can query "did this render use N stubbed assets" from status and the bundle without the loader closure.
- **Changes**
  - Extend `createManifestReport` (`registry.ts:138-165`) + `AssetManifestReport` (`types.ts:113-119`) with `readonly placeholders: { count:number; ids:readonly string[] }`. This flows automatically into `ApertureHeadlessStatus.assets` (`headless.ts:41-43,156`).
  - Add `readonly assetProvenance: { placeholderCount:number; placeholderIds:readonly string[]; real:number }` to `ApertureSnapshotBundle` (`bundle.ts:20-26`), populated in `createApertureSnapshotBundle` from the registry. **Ensure the per-asset placeholder flag survives `serializeSourceAssetRegistry` + `encodeTypedArrayTree`** so per-asset provenance, not just the envelope summary, is in the bundle.
  - Drop the ad-hoc `placeholdered` closure in `node-asset-loader.ts:7-44`; CLI warnings in `headless.ts:63-67` derive from `createManifestReport().placeholders`.
- **Acceptance criteria**
  - [ ] `aperture headless … --json` status contains `assets.placeholders.count`.
  - [ ] The written bundle's `assetProvenance.placeholderCount` matches the number of stubbed assets.
  - [ ] `node-asset-loader.ts` no longer maintains a separate `placeholdered` list.
- **How to test**
  - `test/cli/headless-command.test.ts`: run against a fixture with a stubbed asset, assert status + bundle provenance counts agree.

### PD.6 — Render-time placeholder warning

- **Goal** — `aperture render` cannot silently pass a stubbed bundle off as a real render.
- **Changes**
  - In `packages/cli/src/commands/render.ts`, read `bundle.assetProvenance`; when `placeholderCount > 0`, emit a structured stderr warning (`rendering N placeholder asset(s): <ids> — pixels stubbed, not real`). Optionally write a PNG sidecar JSON recording provenance.
- **Acceptance criteria**
  - [ ] `aperture render <stubbed-bundle>` prints the placeholder warning with the ids; a fully-real bundle prints nothing.
  - [ ] Exit code unchanged (warning, not failure).
- **How to test**
  - e2e: render a stubbed fixture bundle, assert stderr contains the warning and ids; render a real bundle, assert no warning.

---

## 7. Sequencing

```
Track A (PA.1→PA.5)  ──┬──► unblocks in-process tests + coverage reverts for ALL tracks
                       │
Track D (PD.1→PD.2) ───┼──► dependency for Track C reset determinism (PC.5)
                       │
Track B (PB.1→PB.4) ───┤    independent of A's outcome; ship anytime
                       │
Track C (PC.1→PC.5) ◄──┘    needs A (in-process load) + PD.1/PD.2 (deterministic reset)
Track D (PD.4→PD.6) ───────  independent; ship anytime
```

- **Land Track A first.** It removes the dual-realm footgun every other track would inherit and **directly unblocks reverting the subprocess-only tests (PA.3) and the `config-loader.ts` coverage exclusion (PA.5)**. New tests in B and C can then run in-process instead of via a `dist` subprocess.
- **Track B is fully independent** of A's outcome and can ship in parallel; it only needs its own resolver + mount table. Its e2e portability assertion (PB.4) is the highest-value single check in the whole plan for "works after npm install."
- **Track D splits cleanly**: PD.1–PD.3 (determinism) and PD.4–PD.6 (asset honesty) are independent of each other. PD.1/PD.2 are a hard dependency for Track C's deterministic `reset` (PC.5), so land them before PC.5.
- **Track C lands last** because PC.2/PC.3 build on A's in-process load and PC.5 needs PD.1/PD.2. PC.1 (export the dispatcher) can land early as a no-risk prerequisite.
- **Independently shippable units:** PA.1–PA.5 (one PR), PB.1–PB.4 (one PR), PD.1–PD.3 (one PR), PD.4–PD.6 (one PR), PC.1–PC.5 (one PR, after A + PD.1/PD.2).

## 8. Risks & open decisions (ranked, with defaults)

1. **Native type-strip vs jiti for the loader.** **Default: native** (PA.1). All 42 repo files are erasable-only with bare specifiers; native is zero-dep with no module-cache realm footgun. *Risk:* third-party user systems using enums/decorators throw `ERR_UNSUPPORTED_…`. *Mitigation:* PA.1's structured `configLoadFailed` error names the cause; jiti is a documented reserve path (PA.5) only if "any valid TS loads" becomes a requirement — and only with `nativeModules`/`alias` configured to defer `@aperture-engine/*` to host instances, or the dual-realm bug returns.

2. **Test realm ≠ shipped realm.** In-process tests share vitest's *src* realm; the shipped CLI shares the *dist* realm. Both are internally single-realm and consistent. **Default: accept**, and keep **one** dist-subprocess smoke test (PA.3) so the shipped binary boot is still asserted.

3. **`import.meta.resolve` mirage in render resolution.** It works in-repo for hoisted pkgs and fails for render/webgpu/simulation/math in a real install. **Default: forbidden** — use `createRequire` + probe + chain anchored at the *declaring* package (PB.1). Anchoring `elics` at the CLI instead of `simulation` works in this hoisted repo and breaks under strict pnpm; the test must resolve `elics` to lock the anchor.

4. **JSON-lines child process vs session-file daemon for warm mode.** **Default: stdin JSON-lines** (PC.2). No port/file-race/cleanup surface, dies with the agent. *Risk:* command interleaving corrupts the single world — **mandatory** single in-order queue; do **not** copy `mcp.ts`'s concurrent handling.

5. **Warm render scope.** Keeping Playwright + static server warm re-introduces the heavyweight process the route deletes. **Default: warm render out of v1** (PC.5) — `bundle` then one-shot `aperture render`. Revisit as a lazily-booted opt-in only if measured agent latency demands it.

6. **Provenance must survive serialization.** The per-asset placeholder flag must thread through `serializeSourceAssetRegistry` + `encodeTypedArrayTree`, not just the bundle envelope (PD.5). *Risk if missed:* render sees only the summary count, not which assets. **Default:** test asserts per-asset provenance round-trips through the bundle.

7. **Strict determinism global-patching.** Monkeypatching `Math.random`/`Date.now` leaks across runs in warm mode and the shared CLI realm. **Default: keep `determinism:"strict"` opt-in and per-step scoped** (install/restore around each `step()`), never on by default (PD.3).

8. **Harness asset must actually ship.** If the harness stays in `src/` (no `allowJs`) it won't emit to `dist` and the published CLI throws `harnessNotFound` — the exact bug being fixed. **Default:** put it in `packages/cli/assets`, add `"assets"` to `package.json` `files`, and assert presence via `pnpm pack` + tarball grep (PB.3).

Relevant files: `/home/user/aperture/packages/cli/src/headless/config-loader.ts`, `/home/user/aperture/packages/cli/src/headless/vite-runtime.ts`, `/home/user/aperture/packages/cli/src/render/driver.ts`, `/home/user/aperture/packages/cli/src/render/static-server.ts`, `/home/user/aperture/packages/app/src/worker/devtools/bridge.ts`, `/home/user/aperture/packages/app/src/systems/context.ts`, `/home/user/aperture/packages/simulation/src/assets/registry.ts`, `/home/user/aperture/packages/cli/src/headless/bundle.ts`, `/home/user/aperture/vitest.config.ts`.