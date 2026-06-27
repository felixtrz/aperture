# Implementation Plan — `aperture headless` + `aperture render` (smaller validation loop)

## 1. Summary

The target is a **decoupled, fast validation loop**: run the authoritative ECS/sim in pure Node, inspect/diff state deterministically, and only pay for a real browser+WebGPU when pixels actually matter. **`aperture headless`** loads a `mode:"headless"` aperture config and its `*.system.ts` from disk via an in-process Vite SSR module runner, injects input, steps a fixed timestep N frames, and writes a serialized **RenderSnapshot bundle** (snapshot + source-asset registry) to disk. **`aperture render`** takes that saved bundle and produces exactly one PNG on demand by booting Playwright against a new standalone render entrypoint, applying the snapshot via the existing `app.renderSnapshot()` path, and screenshotting `#aperture-canvas`. The two commands share one on-disk format and never run concurrently with a live sim. The hard constraints are honored explicitly: Track 1 has no browser image decoder / no `globalThis.location`, so external/texture assets are scoped out first (procedural-asset apps), and Track 2 cannot render a handle-only snapshot, so the source-asset registry must travel inside the bundle.

## 2. What already exists vs. what's missing

| Capability | Status | Evidence |
|---|---|---|
| Headless runner in pure Node (`step`/`extract`/`getStatus`) | **Exists** | `packages/app/src/headless.ts`; many `test/app/*.test.ts` |
| `createApertureApp(options.systems: ApertureSystemModule[])` | **Exists** | `advanced.ts:204` |
| System discovery (pure Node fs + AST) | **Exists, reusable** | `packages/vite-plugin/src/system-discovery.ts:39` (`createApertureSystemManifest`) |
| Node-side **config-from-disk loader** (Vite SSR) | **Missing** | no `createServer(middlewareMode)`/`ssrLoadModule` usage in repo |
| Generic render-any-snapshot browser call | **Exists** | `app.renderSnapshot()` `create-webgpu-app.ts:430` |
| Source-asset registry serialize/rehydrate | **Exists, exported** | `serializeSourceAssetRegistry`/`mirrorSourceAssetRegistryFromMessage` `asset-mirror.ts:84,127` |
| Standalone "load arbitrary snapshot + render" browser entrypoint | **Missing** | `examples/*.html` are scene-specific |
| Snapshot ↔ JSON codec (typed-array-safe) | **Missing** | zero hits for `serializeRenderSnapshot`; `JSON.stringify` corrupts typed arrays |
| Playwright boot/wait/screenshot harness | **Exists, reusable pattern** | `scripts/render-control.mjs` (launch:57, status-wait:200, screenshot:810, `assertScreenshotNotBlank`:822) |
| Pure-Node PNG decode (for cheap assertions) | **Exists** | `test/cli/png-readback.test.ts`, `test/e2e/png.ts` |
| CLI dispatch / errors / help | **Exists** | `cli.ts:55-152`; `ApertureCliError` `errors.ts:5` |
| CLI dep on `@aperture-engine/app` & `/render` + tsconfig refs | **Missing** | `package.json` deps lack both; `tsconfig.json references: []` |
| Asset-in-Node: image decode / root-relative URL resolution | **Broken by design in Node** | `assets.ts:1217-1235` (`invalidUrl`), `gltf-texture-browser-decoder.ts:14-18` |

---

## 3. Track 1 — `aperture headless` (pure Node loop)

### P1.1 — CLI package can import `@aperture-engine/app` and `/render`

- **Goal** — The CLI build resolves the headless runner and snapshot codec types without `tsc` errors.
- **Changes**
  - Edit `packages/cli/package.json`: add `"@aperture-engine/app": "workspace:*"` and `"@aperture-engine/render": "workspace:*"` to `dependencies`.
  - Edit `packages/cli/tsconfig.json`: change `references: []` to include `{ "path": "../app" }` and `{ "path": "../render" }`.
  - No source change yet; add a throwaway `import type { RenderSnapshot } from "@aperture-engine/render";` in a scratch spot to prove resolution, then remove.
- **Acceptance criteria**
  - [ ] `pnpm --filter @aperture-engine/cli build` succeeds (after `pnpm -w tsc -b packages/app packages/render` so the referenced dist exists).
  - [ ] `pnpm -w typecheck` passes.
  - [ ] No new entry in `scripts/check-package-boundaries.mjs` is required (cli/app are not policed — noted as a risk, not a blocker here).
- **How to test** — `pnpm -w tsc -b && pnpm --filter @aperture-engine/cli build`. Expect exit 0. No new test file; this is a wiring phase verified by the build.

### P1.2 — Node config + system loader (Vite SSR middlewareMode)

- **Goal** — A pure-Node function loads a headless config file and its discovered `*.system.ts` into `{ config, systems: ApertureSystemModule[] }`.
- **Changes**
  - New file `packages/cli/src/headless/config-loader.ts` exporting `loadApertureHeadlessApp({ root, configFile, devAliases? }): Promise<{ config; systems: ApertureSystemModule[]; diagnostics; dispose(): Promise<void> }>`.
    - Resolve config path explicitly from `configFile` (do **not** rely on `resolveConfigFile`'s `aperture.config.ts` default).
    - `const server = await createServer({ root, configFile: false, appType: "custom", logLevel: "error", server: { middlewareMode: true }, resolve: { alias: devAliases ?? {} } })` — do **not** load the user's `vite.config` and do **not** register the `aperture()` plugin (its `configureServer` writes a devtools/session bridge, `vite-plugin/src/index.ts:146-162`).
    - `const runner = createServerModuleRunner(server.environments.ssr)`.
    - `const config = (await runner.import(configFile)).default;` assert `config.mode === "headless"` early → `ApertureCliError("aperture.headless.invalidMode", …)`.
    - Call `createApertureSystemManifest({ root, configFile })` (`vite-plugin/src/system-discovery.ts:39`); for each discovered system, `runner.import(file)` → build `{ default }`. Surface manifest diagnostics (missing default export, empty glob, invalid priority) on the returned `diagnostics`.
    - `dispose()` calls `server.close()` (middlewareMode holds file watchers — leak hangs process exit).
  - New file `packages/cli/src/headless/dev-aliases.ts`: build the vitest-style `@aperture-engine/* → packages/*/src/*.ts` alias map (mirror `vitest.config.ts:4-156`), used only when running against the unbuilt in-repo `examples/*`. Auto-enable by detecting whether `@aperture-engine/app` resolves; otherwise empty.
- **Acceptance criteria**
  - [ ] Loading `examples/developer-api/aperture.headless.config.ts` returns `config.mode === "headless"` and a non-empty `systems` array.
  - [ ] A config with `mode:"browser"` throws `aperture.headless.invalidMode`.
  - [ ] A missing config path throws `aperture.headless.configNotFound`.
  - [ ] A system glob with no default export yields a diagnostic (not a crash).
  - [ ] `dispose()` resolves and the test process exits without a hang.
- **How to test** — Add `test/cli/headless-config-loader.test.ts` (vitest): load the example config with dev aliases, assert mode/systems; assert `invalidMode` and `configNotFound`; assert a no-default-export glob produces a diagnostic. Run `pnpm vitest run test/cli/headless-config-loader.test.ts`.

### P1.3 — Node asset loader stub (the ASSET-IN-NODE limitation, head-on)

- **Goal** — Boot never crashes on assets in Node; structural scenes load with placeholder pixels, and the scope is explicit.
- **Changes**
  - New file `packages/cli/src/headless/node-asset-loader.ts` exporting `createNodeApertureAssetLoader({ root, publicDir, mode }): ApertureAssetLoader` (consumed via `createApertureApp` `options.assetLoader`, `advanced.ts:55`; when present, `assets.ts:273-274` skips fetch/decode/`resolveAssetUrl` entirely).
    - Modes: `"placeholder"` (default) registers a 1×1 placeholder `TextureAsset` and structural-only mesh/gltf so the snapshot has valid handles; `"disk"` resolves root-relative URLs (`/assets/x`) against `<root>/<publicDir>` and reads bytes for gltf/audio/shader (textures still placeholder — no CPU image decoder in Node, `gltf-texture-browser-decoder.ts:14-18`).
  - In the headless command (P1.4), **always inject this loader** so the example's `asset.gltf('/assets/cube.glb', { preload: 'blocking' })` (which throws `aperture.asset.invalidUrl` today, asserted at `developer-api.test.ts:2369-2400`) does not crash boot.
  - **Scoping decision, documented in `--help` and AI_TOOLING.md:** Track 1 v1 targets **procedural-asset apps** (`mesh.box`/`material.standard`, no external textures) for *faithful* output; apps with external/texture assets load **structurally with placeholder pixels** — real pixels are deferred to Track 2's browser render. `--resolve-assets disk` opts into disk byte-reading for gltf/audio.
- **Acceptance criteria**
  - [ ] Booting the example headless config in Node **does not throw** `aperture.asset.invalidUrl` (loader injected).
  - [ ] A procedural-only config produces a snapshot whose draw count matches entity count with no asset diagnostics.
  - [ ] An external-asset config boots and emits a `aperture.headless.assetPlaceholder` warning per placeholdered texture.
- **How to test** — Add `test/cli/headless-asset-loader.test.ts`: (a) procedural config → snapshot with expected draws, zero warnings; (b) external-asset config → boots, warnings emitted, snapshot draw count preserved. `pnpm vitest run test/cli/headless-asset-loader.test.ts`.

### P1.4 — `aperture headless` command + cli.ts wiring

- **Goal** — `aperture headless <config> --frames N --out snapshot.json` runs the loop and writes the bundle.
- **Changes**
  - New file `packages/cli/src/commands/headless.ts` exporting `runHeadlessCommand({ argv, cwd, stdout }): Promise<number>`, modeled on `tool.ts` (flat single-positional, **not** subcommand): local `isHelpFlag`, `readOptionValue`, `parsePositiveInteger`.
    - Positional = config path (`aperture.headless.missingConfig` if absent; `aperture.headless.tooManyArguments` if >1).
    - Flags: `--frames <n>` (default 1), `--delta <seconds>` (default fixed `1/60`), `--out <path>` (required → `aperture.headless.missingOutput`), `--resolve-assets <placeholder|disk>`, `--public-dir <dir>` (default `public`), `--inject <file.json>` (input injection, P1.5), `--json` (machine ECS summary to stdout). Unknown `-` arg → `aperture.headless.unknownOption`.
    - Flow: `loadApertureHeadlessApp` (P1.2) → `createApertureHeadlessRunner({ config, systems, assetLoader })` → apply injected input (P1.5) → loop `runner.step(delta, frameIndex*delta)` N times → final `runner.extract()` → serialize bundle (P1.6) → `mkdir(dirname,{recursive:true})` + `writeFile(out, json)` (the `browser.ts:188-195` write pattern) → `dispose()` in `finally`.
    - Map underlying `ApertureAppError` codes through to `ApertureCliError` preserving the `aperture.*` code; use `createApertureHeadlessFailureStatus` (`headless.ts:129`) for structured diagnostics.
  - Edit `packages/cli/src/cli.ts`: `import { runHeadlessCommand } from "./commands/headless.js";`; add `if (command === "headless") { return await runHeadlessCommand({ argv: rest, cwd: options.cwd, stdout: io.stdout }); }` **before** the `unknownCommand` throw (cli.ts:108); add a `aperture headless <config>` line to `mainHelp()` Commands block (cli.ts:140-146).
  - Edit `packages/cli/README.md` (lines 27-32) and `docs/AI_TOOLING.md` (lines 17-44): add `aperture headless`.
- **Acceptance criteria**
  - [ ] `aperture headless --help` exits 0 and prints usage including `--frames`, `--out`, `--inject`.
  - [ ] `aperture headless <missing>` → stderr `aperture.headless.configNotFound`, exit 1.
  - [ ] `aperture headless cfg` with no `--out` → `aperture.headless.missingOutput`, exit 1.
  - [ ] Running against the example writes a parseable bundle JSON whose `version`/`format` fields exist (P1.6) and exit 0.
  - [ ] `mainHelp()` lists `aperture headless` (and `create.test.ts` help assertion extended to match).
- **How to test** —
  - Add `test/cli/headless-command.test.ts`: drive `runApertureCli(["headless", …], {stdout, stderr})` (the `runCli` helper pattern from `test/cli/reference.test.ts`): assert help/exit 0; assert `missingConfig`/`missingOutput`/`unknownOption` codes; assert a temp procedural config produces a bundle on disk and exit 0.
  - Extend `test/cli/create.test.ts:41-47` to assert `mainHelp()` contains `aperture headless`.
  - Real run: `pnpm --filter @aperture-engine/cli build && node packages/cli/dist/bin/aperture.js headless examples/developer-api/aperture.headless.config.ts --frames 30 --out /tmp/claude-0/snap.json` → expect `/tmp/claude-0/snap.json` written, exit 0.
  - Doc-sync: `node scripts/generate-diagnostics-catalog.mjs` then `pnpm run check:diagnostics` (new `aperture.headless.*` codes must be regenerated into `docs/DIAGNOSTICS_CATALOG.md` or the check fails).

### P1.5 — Input injection arg format

- **Goal** — `--inject <file.json>` deterministically sets input before stepping.
- **Changes**
  - In `packages/cli/src/headless/inject.ts`: `applyApertureInput(runner, injectSpec)` reading a JSON of the form `{ "pointer": { "primary": { "position": [x,y], "down": true } }, "keys": { "KeyW": true }, "atFrame": 0 }`. Assign directly to runner context fields (`runner.app.context.input.pointer.primary.position.value = [x,y]`, per `test/app/interaction-route.test.ts:114`). Support an array of timed specs (`atFrame`) applied between steps.
  - Wire into the P1.4 loop: before each `step`, apply any spec whose `atFrame` matches.
- **Acceptance criteria**
  - [ ] An inject file setting pointer position changes `runner.app.context.input.pointer.primary.position.value` and the resulting snapshot/ECS reflects the interaction route.
  - [ ] Malformed inject JSON → `aperture.headless.invalidInject`.
- **How to test** — Add `test/cli/headless-inject.test.ts`: load a config with a pointer-driven system, inject a position, step, assert `extract()` output changed vs. no-inject baseline. `pnpm vitest run test/cli/headless-inject.test.ts`.

### P1.6 — Bundle write (snapshot + source-asset registry)

- **Goal** — The written file is a self-contained bundle Track 2 can render.
- **Changes**
  - In P1.4's write step, build `{ format: "aperture-render-snapshot", version: 1, snapshot: renderSnapshotToJsonValue(snapshot), sourceAssets: serializeSourceAssetRegistry(runner.app.lowLevel.assets, /* no reuse state → full assets */) }` (`asset-mirror.ts:84`; pass **no** serialization state so full assets, not mesh-patch deltas, are emitted — patch mode needs the prior asset to rehydrate, `asset-mirror.ts:175-193`).
  - `renderSnapshotToJsonValue` comes from the new codec (Section 5 / built in P2.1's shared module — land the codec first or in parallel).
  - Before serializing, await `app.preload`/ensure blocking assets are `ready` so the bundle renders a complete frame (`asset-mirror.ts:286-313` only materializes `ready` assets); emit `aperture.headless.assetUnready` diagnostic for any unready referenced handle.
- **Acceptance criteria**
  - [ ] Bundle JSON has top-level `format`, `version`, `snapshot`, `sourceAssets`.
  - [ ] Re-reading the bundle and round-tripping the snapshot yields typed-array-equal `transforms`/`viewMatrices` (Float32Array) and `morphInstanceDescriptors` (Uint32Array where present).
  - [ ] `sourceAssets` contains full (non-patch) mesh entries for every `draw.mesh` handle in the snapshot.
- **How to test** — Covered by `test/cli/snapshot-codec.test.ts` (P2.1) for the snapshot half and a new assertion in `test/cli/headless-command.test.ts` that every snapshot draw handle has a matching `sourceAssets` entry.

---

## 4. Track 2 — `aperture render` (snapshot → PNG via Playwright)

### P2.1 — Typed-array-safe snapshot JSON codec

- **Goal** — `renderSnapshotToJsonValue` / `renderSnapshotFromJsonValue` round-trip any snapshot losslessly.
- **Changes**
  - New file `packages/render/src/rendering/snapshot-json.ts` exporting both functions plus string wrappers. Export from the render package barrel.
    - Generic replacer: any value where `ArrayBuffer.isView(v)` → `{ $typedArray: "<ctor>", base64: <bytes>, length }`. This catches **both** the 8 top-level buffers (`snapshot-core-types.ts:61-80`) + `quads.instanceFloats/instanceWords` **and** the nested `BoundsPacket` vecs (`localAabb`/`worldAabb`/`localSphere`/`worldSphere` are Float32Array, `extraction-mesh-bounds.ts:14`).
    - Reviver: rebuild exact constructor (`Float32Array` vs `Uint32Array` for `morphInstanceDescriptors`); rebuild `quads` via `createQuadSnapshotBuffers({instanceFloats, instanceWords})` so `version:1`/stride `24`/`8` literals satisfy `assertQuadSnapshotBuffers`. Normalize `BoundsPacket` vecs to plain `[x,y,z]` tuples (render path only index-accesses them; `readVec3` precedent in `snapshot-packed-bounds-codec.ts`).
    - Use **base64-of-bytes** (not number arrays) to avoid `Infinity`/`NaN`→`null` JSON corruption and keep f32 exact.
  - Do **not** reuse `encodeSnapshotPackets` — it is lossy (drops sprites/UI/skyboxes/morph/etc per `hasUnsupportedSharedSnapshotPayload`, `worker/snapshot.ts:857`).
- **Acceptance criteria**
  - [ ] Round-trip of a real extracted snapshot is deep-equal with typed-array-aware comparison (constructor + contents).
  - [ ] `quads` round-trips through `assertQuadSnapshotBuffers` without throwing.
  - [ ] An unknown `version` on load throws a typed error.
- **How to test** — Add `packages/render/test/snapshot-json.test.ts` (or `test/cli/snapshot-codec.test.ts`): extract a snapshot via the headless runner, round-trip, assert deep equality incl. `morphInstanceDescriptors` Uint32 and a `BoundsPacket` vec. `pnpm vitest run snapshot-json`.

### P2.2 — Standalone browser render entrypoint (the ASSET-PREPARATION blocker, head-on)

- **Goal** — A served page that deserializes a bundle, **rehydrates the source-asset registry**, and renders the snapshot to a canvas — so a handle-only snapshot is no longer unrenderable.
- **Changes**
  - New files `examples/render-snapshot.html` + `examples/render-snapshot.main.ts` (served by the existing examples Vite server used by `playwright.config.ts` webServer on `:4173`).
    - Mount `<canvas id="aperture-canvas">`.
    - Read the bundle JSON from a URL param / injected global (`window.__APERTURE_SNAPSHOT_BUNDLE__`, set by Playwright via `page.evaluate`/`addInitScript`).
    - `const reg = new AssetRegistry(); mirrorSourceAssetRegistryFromMessage(reg, { sourceAssets: bundle.sourceAssets });` (`asset-mirror.ts:127`) — **this is the resolution of the coupling blocker**: the snapshot carries only `{kind,id}` handles, GPU bytes come from `reg`; without rehydration `resolveMeshResourceKey` returns null and every draw is dropped to a blank frame (`queued-built-in-frame.ts:527-530`).
    - `const app = createWebGpuApp({ canvas, sourceAssets: reg, simulationWorker: createNoopSimulationWorker() })` (`create-webgpu-app.ts:54`, noop worker from `examples/noop-simulation-worker.js`); **never** call `app.start()`.
    - `await app.renderSnapshot(renderSnapshotFromJsonValue(bundle.snapshot)); await device.queue.onSubmittedWorkDone();` then set `window.__APERTURE_EXAMPLE_STATUS__ = { ok: true }` (the signal `render-control.mjs:200` waits on) — or `{ ok:false, error }` on failure.
  - Use `runInjectedRenderFrameFromSnapshot`? **No** — it requires caller-built GPU mesh/pipeline/bindGroups (`renderer-frame-summary.ts:202,698`). Use the generic `app.renderSnapshot` path.
- **Acceptance criteria**
  - [ ] Navigating to `/render-snapshot.html` with a procedural-cube bundle injected sets `__APERTURE_EXAMPLE_STATUS__.ok === true`.
  - [ ] The canvas is non-blank (passes `assertScreenshotNotBlank`).
  - [ ] Removing the `mirrorSourceAssetRegistryFromMessage` call makes the frame blank (proves the asset-rehydration is load-bearing) — asserted in the e2e negative path or documented.
- **How to test** — Manual: `pnpm --filter examples build && pnpm exec playwright test` against a temp spec that injects a procedural bundle. Real assertion lands in P2.4.

### P2.3 — `aperture render` command + cli.ts wiring + Playwright driver

- **Goal** — `aperture render <bundle.json> --out frame.png` produces one PNG via on-demand Playwright.
- **Changes**
  - New file `packages/cli/src/commands/render.ts` exporting `runRenderCommand({ argv, cwd, stdout })`, modeled on `tool.ts`: positional = bundle path (`aperture.render.missingSnapshot`; `aperture.render.tooManyArguments` if >1); required `--out <png>` (`aperture.render.missingOutput`); optional `--width`/`--height`; `aperture.render.unknownOption` for bad `-` args.
  - New file `packages/cli/src/render/driver.ts`: reuse `render-control.mjs` patterns — launch Chrome (channel `chrome`, or SwiftShader under xvfb for GPU-less, `--enable-unsafe-webgpu`), serve/boot the `render-snapshot.html` entrypoint (boot a one-off Vite server for the examples dir, or a minimal static server hosting the built entrypoint), `addInitScript` injecting the bundle into `window.__APERTURE_SNAPSHOT_BUNDLE__`, `page.waitForFunction(() => window.__APERTURE_EXAMPLE_STATUS__?.ok)`, `page.locator("#aperture-canvas").screenshot({ type: "png" })`, then `mkdir`+`writeFile(out, bytes)` (`browser.ts:188-195`). Run `assertScreenshotNotBlank` and throw `aperture.render.blankFrame` if blank. Tear down browser + server in `finally`.
  - Edit `packages/cli/src/cli.ts`: `import { runRenderCommand }`; add `if (command === "render") { … }` before the `unknownCommand` throw; add `aperture render <snapshot>` to `mainHelp()`.
  - Edit `packages/cli/README.md` + `docs/AI_TOOLING.md`: add `aperture render`.
- **Acceptance criteria**
  - [ ] `aperture render --help` exits 0 with `--out`, `--width`, `--height`.
  - [ ] `aperture render <bundle>` with no `--out` → `aperture.render.missingOutput`, exit 1.
  - [ ] `aperture render <missing>` → `aperture.render.missingSnapshot` or a read error, exit 1.
  - [ ] A blank render → `aperture.render.blankFrame`, exit 1 (no silently-black PNG).
  - [ ] `mainHelp()` lists `aperture render` (and `create.test.ts` assertion extended).
- **How to test** —
  - Add `test/cli/render-command.test.ts` (vitest, no browser): assert arg/error codes via `runApertureCli`; mock the driver to assert it's invoked with parsed `out`/`width`/`height`.
  - Add `test/cli/render-png.test.ts` (vitest, no browser): feed a known PNG through the repo's hand-rolled decoder (`png-readback.test.ts` pattern) to assert the command's PNG-write path yields correct dimensions.
  - Doc-sync: `node scripts/generate-diagnostics-catalog.mjs` + `pnpm run check:diagnostics` for new `aperture.render.*` codes.

### P2.4 — End-to-end render verification (real GPU)

- **Goal** — A committed e2e proves `aperture render` writes a non-blank PNG from a real bundle.
- **Changes**
  - Add `test/e2e/render-snapshot-cli.spec.ts` modeled on `test/e2e/render-control.spec.ts`: under the `chrome-webgpu-swiftshader` CI project (`playwright.ci.config.ts:71`), `execFile` the built CLI `node packages/cli/dist/bin/aperture.js render <committed procedural bundle> --out <tmp>.png`, assert the file exists and `byteLength > 1000` (cheap, like `cli-ai-tools.spec.ts:1144-1152`). Optionally add one `toHaveScreenshot` golden in `test/e2e/render-snapshot-cli.spec.ts-snapshots/` with `maxDiffPixels: 1500` (suffix `-chrome-webgpu-swiftshader-linux.png`).
  - Commit a small deterministic procedural-cube bundle fixture (generated by `aperture headless` against a fixture config) under `test/e2e/fixtures/`.
  - Any conditional skip on GPU-less hosts must use an allowlisted reason (`scripts/check-e2e-skips.mjs`).
- **Acceptance criteria**
  - [ ] e2e produces a PNG with `byteLength > 1000` and passes `assertScreenshotNotBlank`.
  - [ ] (If golden) pixel diff ≤ 1500 vs committed baseline.
  - [ ] `node scripts/check-e2e-skips.mjs` passes.
- **How to test** — `pnpm exec playwright test --config playwright.ci.config.ts test/e2e/render-snapshot-cli.spec.ts`. Expect green.

---

## 5. Snapshot file format

On-disk JSON envelope (one file = one renderable bundle):

```jsonc
{
  "format": "aperture-render-snapshot",
  "version": 1,
  "snapshot": {
    // packet object trees verbatim (draws, views, lights, sprites, ui, skyboxes…)
    // every typed array — at ANY depth — encoded as:
    "transforms":   { "$typedArray": "Float32Array", "base64": "…", "length": 64 },
    "viewMatrices": { "$typedArray": "Float32Array", "base64": "…", "length": 16 },
    "morphInstanceDescriptors": { "$typedArray": "Uint32Array", "base64": "…", "length": 8 },
    "quads": {
      "version": 1, "instanceFloatStride": 24, "instanceWordStride": 8,
      "instanceFloats": { "$typedArray": "Float32Array", "base64": "…", "length": 24 },
      "instanceWords":  { "$typedArray": "Uint32Array",  "base64": "…", "length": 8 }
    }
    // draw.mesh / material / texture handles stay plain { "kind": "...", "id": "..." }
  },
  "sourceAssets": { /* SerializedSourceAssetRegistry: handles + base64/Uint8Array mesh bytes, FULL (no patch state) */ }
}
```

Rules: (1) **base64-of-bytes** for every `ArrayBuffer.isView` value — exact f32/u32, no `Infinity/NaN`→`null` loss; (2) reviver rebuilds the **exact** constructor (`Float32Array` vs `Uint32Array`); (3) `quads` rebuilt via `createQuadSnapshotBuffers` to satisfy `assertQuadSnapshotBuffers`; (4) nested `BoundsPacket` vecs normalized to plain tuples on load; (5) asset **handles are references only** — bytes live in `sourceAssets`, which Track 2 rehydrates via `mirrorSourceAssetRegistryFromMessage`; (6) top-level `version` is validated on load (unknown → throw).

## 6. Risks & open decisions (ranked)

1. **Asset-in-Node (Track 1).** No image decoder, no `globalThis.location`; external/texture-asset configs crash or can't produce pixels. **Default:** ship for **procedural-asset apps first**; always inject the Node asset loader (P1.3) so external-asset apps load *structurally* with placeholder textures + warnings; real pixels come from Track 2. Document in `--help` + AI_TOOLING.md.
2. **Asset-preparation coupling (Track 2).** Handle-only snapshot renders blank without source bytes. **Default (resolved):** the bundle carries `sourceAssets` (`serializeSourceAssetRegistry`, full/no-patch); Track 2 rehydrates before `renderSnapshot` (P2.2). Snapshot-only saves are rejected.
3. **"Pure Node" invariant for Track 1 is unguarded** — `check-package-boundaries.mjs` excludes cli/app. **Default:** add `test/cli/headless-purity.test.ts` asserting the headless command/loader module graph imports only `@aperture-engine/app` + `/render` + `vite`, never `@aperture-engine/webgpu` or browser globals.
4. **In-repo monorepo resolution.** `@aperture-engine/*` are unbuilt → SSR import fails without the dev alias map. **Default:** auto-enable the vitest-style alias map when `@aperture-engine/app` doesn't resolve (P1.2); document `pnpm -w tsc -b` as a prerequisite for shipped-package runs.
5. **Coverage CI (vitest 85/90).** Browser-only render code drags coverage. **Default:** keep all Node-testable logic (loader, codec, arg parsing, PNG decode) under vitest; only the Chrome boot lives in e2e.
6. **Golden-image flakiness (SwiftShader).** **Default:** assert `byteLength>1000` + `assertScreenshotNotBlank` for v1; add a single `maxDiffPixels:1500` golden only after the path is stable.
7. **`--json` output convention is new.** **Default:** `aperture headless --json` prints a machine ECS/status summary to stdout (binary PNG can't go to stdout, so `aperture render` is `--out`-only/required); document both in help.
8. **Doc-sync hard gates.** New `aperture.headless.*`/`aperture.render.*` codes must be regenerated into `DIAGNOSTICS_CATALOG.md`; `mainHelp()` + `create.test.ts` + README + AI_TOOLING.md hand-synced; `.changeset/*.md` bumping `@aperture-engine/cli` **minor**. **Default:** run `pnpm run check` before done.

## 7. Sequencing

| Phase | Depends on | Independently shippable? |
|---|---|---|
| **P2.1** snapshot JSON codec | — | Yes (pure render-package addition, unit-tested) |
| **P1.1** CLI deps + tsconfig refs | — | Yes (build-only) |
| **P1.2** Node config/system loader | P1.1 | Yes (loader unit-tested, no command yet) |
| **P1.3** Node asset loader stub | P1.1 | Yes |
| **P1.5** input injection | P1.2 | With P1.4 |
| **P1.6** bundle write | P1.3, P2.1 | With P1.4 |
| **P1.4** `aperture headless` command + wiring | P1.2, P1.3, P1.5, P1.6 | **Yes — Track 1 ships here** (procedural-asset scope) |
| **P2.2** standalone render entrypoint | P2.1 | Yes (browser-manual verifiable) |
| **P2.3** `aperture render` command + driver | P2.1, P2.2 | **Yes — Track 2 ships here** |
| **P2.4** e2e render verification | P2.3, P1.4 (for fixture) | Yes (locks the loop) |

Critical path: **P2.1 → (P1.1 → P1.2/P1.3 → P1.4) ships Track 1**, and **P2.1 → P2.2 → P2.3 ships Track 2**. P2.1 is the shared linchpin — build it first. Track 1 and Track 2 are otherwise parallelizable; the only cross-track artifact is the bundle file (format frozen in P2.1 + Section 5). P2.4 closes the loop end-to-end and should land last.