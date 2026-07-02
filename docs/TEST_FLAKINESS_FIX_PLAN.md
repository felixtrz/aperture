# Test Flakiness Fix Plan

Phased remediation plan for the 2026-07-02 test-suite flakiness audit. The
audit combined three full runs of the vitest suite (one baseline, two with
`--sequence.shuffle` under seeds 1337 and 42) with a static sweep of all test
directories and shared helpers.

**Audit summary.** The suite's hygiene is strong (fresh worlds/devices per
test, no snapshots, no unseeded randomness, consistent stub/temp cleanup), but
fragility concentrates in four clusters:

1. Order dependence and a fresh-checkout build race — both reproduced
   empirically.
2. Wall-clock timing assertions and real-timer deadlines inside the gating
   unit suite.
3. Filesystem/process/environment hazards in the CLI, vite-plugin, and app
   tooling tests (plus non-atomic writers in product code that tests poll).
4. E2E: a readiness helper that accepts transient statuses, `waitForFunction`
   timeout-argument bugs, ~16 arbitrary sleeps papering over a missing
   "frame presented" signal, and pixel/timing budgets calibrated to a single
   rasterizer (SwiftShader/Linux).

Phases are ordered by certainty and blast-radius-per-effort: each phase is
independently shippable and leaves the suite strictly less flaky.

**Verification vocabulary used below.**

```bash
# Full unit suite, deterministic order
pnpm test

# Full unit suite, shuffled order (order-dependence detector)
pnpm exec vitest run --sequence.shuffle --sequence.seed=<seed>

# Coverage-instrumented run (the slow environment where deadlines bite)
pnpm run test:coverage

# Single WebGPU e2e spec under the local SwiftShader config
scripts/webgpu-e2e.sh test/e2e/<spec>.spec.ts
```

---

## Phase 1 — Confirmed breakages: order dependence and the build race

**Goal:** every unit test passes in isolation and in any execution order, on a
fresh checkout, deterministically.

### Changes

1. **`test/app/physics-access.test.ts` — component-registration order
   dependence.** elics stores component registration (`bitmask`/`typeId`) on
   the component class — global to the file's module graph — and
   `Entity.hasComponent` throws on an unregistered component while
   `addComponent` auto-registers. Tests that create bare worlds pass only when
   a sibling test has already registered `PhysicsVelocity`. Fix:
   - Call `registerPhysicsComponents(world)` (or register the specific
     components used) in every test of the file that touches the physics
     facade; prefer a small local `createPhysicsWorld()` helper.
   - Audit the seven other files that use `createApertureSystemContext`
     without registering components (`cameras`, `gltf-instance-lookup`,
     `meshes`, `physics-spatial-source`, `spatial-index-population`,
     `start-options`, `trails` under `test/app/`) and apply the same
     treatment where they exercise `hasComponent`-guarded paths.
   - Product-side hardening (small, separately reviewable): the
     `hasComponent`-guarded readers in `packages/app/src/systems/physics.ts`
     (e.g. `readPhysicsVelocityField`, `ensurePhysicsVelocity`) should treat
     an unregistered component as "absent" instead of crashing, so headless
     consumers can't hit the same TypeError.
2. **`test/cli/headless-command.test.ts:245-254` — on-demand workspace
   build.** The `beforeAll` runs a full `pnpm run build` when
   `packages/cli/dist/bin/aperture.js` is missing, while `test/index.test.ts`
   asserts dist artifacts exist from a parallel worker — pass/fail depends on
   worker scheduling, and other workers can read half-written dist output.
   Fix: fail fast with an actionable message ("run `pnpm run build` before
   `pnpm test`"), or `describe.skipIf(distMissing)` the shipped-binary smoke
   with a loud console warning. Never build inside a test worker.

### Acceptance criteria

- [ ] `pnpm exec vitest run test/app/physics-access.test.ts -t "reads authored velocities"`
      passes in isolation (today it fails 100% of the time).
- [ ] Every test file under `test/app/` that uses the physics facade passes
      when run as a single file (`pnpm exec vitest run <file>`).
- [ ] Full suite passes shuffled with at least seeds `1337`, `42`, and one
      fresh seed: `pnpm exec vitest run --sequence.shuffle --sequence.seed=<s>`.
      (Seed 1337 reproduces the original failure before the fix.)
- [ ] On a simulated fresh checkout (`git clean -xfd packages/*/dist` after
      backup, or a fresh clone), `pnpm test` produces the same result twice in
      a row — no scheduling-dependent `test/index.test.ts` failure, and no
      `pnpm run build` is spawned by any test worker.
- [ ] Calling `context.physics.getLinearVelocity(entity)` before any physics
      component registration returns `[0, 0, 0]` instead of throwing
      (covered by a new unit test).

---

## Phase 2 — Wall-clock timing in the gating unit suite

**Goal:** no unit test's pass/fail depends on machine speed. Relative-speed
claims live in the non-gating `*.bench.ts` suites (the convention the AI-76
comment in `test/rendering/extraction-budget.test.ts` already states).

### Changes

1. `test/rendering/extraction-transform-only.test.ts:199` — replace the
   zero-margin `expect(transformOnly).toBeLessThan(structural)` with the
   hardened estimator already used at `extraction.test.ts:1748` (min of
   several mean-samples + allowance `max(x * 1.3, x + 8ms)`), or delete the
   timing claim — the sortKey/batchKey identity assertions in the same test
   already prove the fast path structurally.
2. `test/rendering/extraction.test.ts:799-802` — same treatment for
   `staticMs < dirtyMs * 0.5`; alternatively assert cache reuse via cache
   counters instead of time.
3. `test/rendering/extraction-budget.test.ts:86-106` — raise the noise floor
   of the sub-quadratic gate (≥ 0.5 ms), use min instead of median, or raise
   the sample count. Keep the generous 250 ms absolute budget as is.
4. `test/webgpu/webgpu-app.test.ts` — raise `waitForCondition`'s default
   100 ms wall-clock deadline (line ~346) to ≥ 5 s (the loop exits early on
   success, so a generous cap costs nothing), including the explicit 500 ms
   call sites; prefer iteration-count bounds over wall time.
5. `test/runtime/shared-snapshot-transport.test.ts:184-229` — reduce the
   real-`setInterval` stress from 1,000 frames to ~100, or give the test an
   explicit `{ timeout: 30_000 }` — today it needs ~1.3 s of an idle machine
   against vitest's 5 s default.
6. Small deadline bumps on real-async waits: `simulation-worker.test.ts`
   `nextSnapshot` 1 s → 10 s; the duplicated `nextPostedMessage` helpers in
   `test/app/developer-api.test.ts` and
   `test/app/generated-worker-start.test.ts` 1 s → 10 s; heavy MCP/headless
   describes in `test/cli/dev-session.test.ts` get `{ timeout: 60_000 }` to
   match `test/cli/reference.test.ts` (whose comment documents that the 5 s
   default is insufficient under coverage).

### Acceptance criteria

- [ ] `pnpm run test:coverage` (the slow, instrumented environment) passes
      **5 consecutive times** with zero failures in the files listed above.
- [ ] The affected rendering/webgpu/runtime files pass **10 consecutive
      repeats** under induced CPU contention, e.g.
      `for i in $(seq 10); do pnpm exec vitest run test/rendering/ test/webgpu/webgpu-app.test.ts test/runtime/shared-snapshot-transport.test.ts || exit 1; done`
      run alongside a busy-loop pinning 2 of the 4 cores.
- [ ] No gating unit test asserts a relative wall-clock comparison without
      (a) a min-based estimator and (b) an additive allowance —
      verified by review of every `performance.now()` call site under `test/`
      (there are currently 8, in 5 files).
- [ ] The AI-76 convention ("relative-speed claims live in `*.bench.ts`;
      gating timing assertions must use min-estimators plus additive
      allowance") is written down in `AGENTS.md` or `CONTRIBUTING.md`.

---

## Phase 3 — Filesystem, process, and environment hygiene

**Goal:** tests never write inside the checkout, never race each other on
shared paths, never leak processes, and pass under any locale.

### Changes

1. **Shared fixture collision (parallel workers).**
   `test/cli/codegen-command.test.ts` and
   `test/vite-plugin/generated-types.test.ts` both write and `rm -rf`
   `test/fixtures/codegen-factory/.aperture`. Copy the fixture into a
   `mkdtemp` root per test file (it is two small files) so parallel workers
   cannot delete each other's output.
2. **Non-atomic product writers polled by tests.**
   `packages/vite-plugin` writes `session.json` and generated action types
   with plain `fs.writeFile`
   (`packages/vite-plugin/src/generated-action-types.ts:49`,
   `dev-session.ts:102`); `test/vite-plugin/cross-origin-isolation.test.ts`
   and `test/app/developer-api.test.ts` poll-read them and can parse a
   half-written file. Switch to write-temp-then-rename (the CLI's
   `writeApertureDevSession` already does this and has a test asserting it),
   and make the polling helpers retry on empty/unparseable content with
   deadline-based (not iteration-count) timeouts.
3. **Repo-root pollution.** `test/app/developer-api.test.ts:468-499` fires
   unawaited codegen against `process.cwd()`, creating `.aperture/generated/`
   in the checkout and racing two writes to the same file. Point `root` at a
   `mkdtemp` dir and await the write.
4. **Locale-dependent ordering.** Replace bare `localeCompare()` in
   `packages/physics/src/test-backend/backend.ts`,
   `packages/physics/src/ecs-sync.ts:307-318`, and
   `packages/physics/src/backend.ts:883` with codepoint comparison
   (`a < b ? -1 : a > b ? 1 : 0`) or a pinned `Intl.Collator("en")`. Ordered
   `toEqual` assertions across `test/physics*` sit on top of this.
5. **Process leaks and kill wiring.**
   - `test/cli/dev-session.test.ts` (~line 1144): track the spawned detached
     daemon's pid and kill it in `finally` — today a slow spawn leaks a
     detached `setInterval` process past the suite.
   - `test/cli/headless-command.test.ts:266`: pass
     `{ timeout, killSignal: "SIGKILL" }` to `execFileAsync` so a hung CLI
     child dies with the test.
6. **Environment assumptions.** `test/cli/create.test.ts:219`: stub/delete
   `APERTURE_LOCAL` around `defaultApertureDependencySpec()` so an exported
   env var on a dev machine can't fail the test.
   `test/cli/reference/state.ts` warms the **user-global** cache
   (`~/.cache/aperture/reference`) ~12 times per run — allow tests to inject
   the shared-cache dir (env var) and point it at the temp root.

### Acceptance criteria

- [ ] `git status --porcelain` is empty after a full `pnpm test` run on a
      clean tree (no `.aperture/`, no fixture churn anywhere under the
      checkout).
- [ ] `LC_ALL=de_DE.UTF-8 pnpm exec vitest run test/physics test/physics-rapier`
      and the same under `LC_ALL=C` both pass.
- [ ] The two codegen-fixture files pass **10 consecutive concurrent runs**:
      `for i in $(seq 10); do pnpm exec vitest run test/cli/codegen-command.test.ts test/vite-plugin/generated-types.test.ts || exit 1; done`.
- [ ] Zero leaked processes: `pgrep -f aperture` (and a node-process count
      snapshot) is identical before and after a full suite run, including a
      run where `test/cli/dev-session.test.ts` is forced to time out.
- [ ] A full suite run with `HOME` pointed at a scratch dir leaves
      `~/.cache/aperture` untouched in the real home (tests use the injected
      cache dir).
- [ ] `pnpm test` passes with `APERTURE_LOCAL=1` exported in the environment.

---

## Phase 4 — E2E hard bugs and readiness-signal fixes

**Goal:** kill the defects that are outright bugs (wrong argument slots,
wrong predicates, self-reduced timeouts) before touching the harness design.

### Changes

1. **`test/e2e/webgpu-status.ts:81` — `waitForExampleStatus` accepts
   transient statuses.** Twelve routes publish `{ok:false, phase:"loading"}`
   before the real status; the helper resolves on _any_ defined status, so
   each of its 62 consumers must independently remember a second wait, and
   `skipIfUnsupportedWebGpu` can miss the late "unsupported" reason (150 s
   timeout instead of a skip). Change the predicate to
   `ok === true || phase !== "loading"` — the same predicate
   `test/e2e/render-control/controller.ts:344-369` already uses.
2. **`waitForFunction` options-in-arg-slot bugs.**
   `test/e2e/physics-benchmark.spec.ts:438` passes `{ timeout: 60000 }` as
   the _argument_ parameter, so the intended timeout is silently ignored
   (30 s default applies inside a test whose budget was already cut to 60 s).
   Fix here and at the two latent sites
   (`physics-character.spec.ts:175`, `physics-joints.spec.ts:210`):
   `page.waitForFunction(fn, undefined, { timeout: … })`.
3. **Self-reduced timeouts.** Remove the per-test `test.setTimeout(60–120 s)`
   overrides in `test/e2e/glb-viewer.spec.ts` that are _below_ the CI
   config's 240 s default (the file documents two prior timeout flakes that
   forced budget raises); align the local SwiftShader config's timeout with
   the CI config's 240 s so `csm-directional-shadow`/`clustered-lights`
   (CI-excluded, 2–3 min runtime) stop being guaranteed local timeout flakes.
4. **Ports and global daemons.** `test/e2e/cli-ai-tools.spec.ts` (fixed ports
   5187/5193/5196/5197/5201, machine-global `aperture dev` daemon, opens by
   killing any live session) and `test/e2e/developer-api.spec.ts` (fixed
   5175 with `--strictPort`): allocate ephemeral ports (`listen(0)` is
   already imported) and namespace the dev session per run.

### Acceptance criteria

- [ ] `grep -rn "waitForFunction(" test/e2e | grep -c "{ timeout"` shows no
      two-argument form remaining (options always in the third slot).
- [ ] No spec sets `test.setTimeout()` below its project config default —
      verified by grep.
- [ ] The 12 routes that publish a transient loading status pass via plain
      `waitForExampleStatus` with their spec-level second waits **removed**
      in at least two representative specs (proving the helper alone is
      sufficient).
- [ ] On an environment without WebGPU support, a spec using
      `skipIfUnsupportedWebGpu` reports **skipped** (not a timeout failure).
- [ ] `scripts/webgpu-e2e.sh` passes **3 consecutive runs** for each of:
      `physics-benchmark.spec.ts`, `cli-ai-tools.spec.ts`,
      `developer-api.spec.ts`, and one glb-viewer shard.
- [ ] `cli-ai-tools.spec.ts` passes while a dummy listener is bound to each
      of its previously fixed ports.

---

## Phase 5 — Present-fence and sleep elimination in e2e

**Goal:** no e2e assertion depends on an arbitrary sleep or a hardcoded
single pixel. The harness gains a first-class "frame presented" signal.

Note: `docs/RENDER_FRAME_READINESS.md` covers _renderer diagnostics reports_,
not presentation timing — this is new example-control surface, not a
duplicate.

### Changes

1. **Add a present fence to the example control API.** Extend
   `__APERTURE_EXAMPLE_CONTROL__` with a method that resolves after N frames
   have been _presented_ to the canvas (e.g. `waitForPresentedFrames(n)`,
   implementable via a post-present frame counter the status already partly
   exposes on some routes). Adopt it in the shared helpers.
2. **Replace all `waitForTimeout` sleeps** (~16 sites: `golden-baselines`
   1500 ms, `ssao` 1000 ms, `dof` 1000 ms, `multi-light-shadow`/`taa`/`msaa`/
   `ssr`/`iridescence`/`custom-graph-pass`/`app-diagnostics` 100 ms,
   `developer-api` 500 ms, `matcap-app` 200 ms, `custom-material` 2500 ms
   window, …) with the present fence or `expect.poll` on the pixel predicate.
3. **Deterministic captures of animated scenes.** Pause/step via the control
   API before screenshots in `taa`, `msaa`, `spinning-cube`,
   `custom-material` (wall-clock frame-delta assertions become poll-based).
4. **Probe robustness.** Convert fixed-coordinate single-pixel probes to
   region scans (`readPngRegionExtremes` already exists in
   `test/e2e/render-control/png.ts`): `iridescence.spec.ts` (six probes,
   thresholds 18–24), `physics-settling.spec.ts:239-259`; loosen the
   near-identity `maxSampleDelta < 10` reset check in
   `glb-viewer.spec.ts:1005` (orbit numbers are already compared exactly).
5. **`multi-light-shadow.spec.ts`** — rebuild the no-shadow vs shadowed
   comparison on fenced captures instead of two 100 ms-sleep-gated presents
   across a page reload.
6. **`dof.spec.ts`** — make `startBrowser()`
   (`render-control/controller.ts:62-71`) inherit the project's channel and
   launch args instead of hardcoding headed `chrome` with different GPU
   flags than every other spec in the run.

### Acceptance criteria

- [ ] `grep -rn "waitForTimeout" test/e2e/` returns zero hits (or only
      allowlisted sites, each carrying a comment justifying why no
      deterministic signal can exist for it).
- [ ] Every spec touched in this phase passes **3 consecutive runs** under
      the local SwiftShader config (`scripts/webgpu-e2e.sh`).
- [ ] `golden-baselines.spec.ts` passes against the _committed_ goldens after
      the sleep removal (i.e. the fence produces the same steady-state frame;
      no golden refresh required — if a refresh is needed, that's a finding
      to investigate, not to paper over).
- [ ] No spec asserts on a single hardcoded pixel coordinate; probes are
      region-based or come from coordinates the example itself publishes in
      its status.
- [ ] `dof.spec.ts` runs on the same browser/GPU stack as the rest of the
      suite (verified via the launch args in the trace).

---

## Phase 6 — Guardrails: keep it fixed

**Goal:** regressions in any of the above classes are caught mechanically,
not by the next flaky week.

### Changes

1. **Shuffle in the gate.** Run CI vitest with `--sequence.shuffle` and a
   printed seed (reproduce with `--sequence.seed=<seed>`). Optionally also
   locally via config so developers hit order bugs before CI does.
2. **Shared test helpers.** Create one `test/helpers/` module with
   deadline-based `waitFor`/`waitForFile` (parse-retry on JSON), a single
   `nextPostedMessage`/worker-port helper, and `tempRoot()`; migrate the
   per-file clones in `test/app/`, `test/cli/`, `test/vite-plugin/` (today:
   four wait helpers with deadlines from 100 ms to 4 s, two duplicated
   ~70-line worker-port classes, three tempRoot/runCli clones).
3. **Flake tracking in e2e.** Surface Playwright `flaky` results (pass on
   retry) in the report and fail—or at least annotate—on them, so
   `retries: 1` stops silently absorbing intermittence. Keep an eye on the
   `check-e2e-skips.mjs` allowlist: if readback support regresses, all pixel
   assertions currently skip forever and stay green — add a canary spec that
   _requires_ readback to be available on CI.
4. **Sleep lint.** Add a small check script (alongside the existing
   `check:e2e-skips` style) failing on new `waitForTimeout` in `test/e2e/`
   and on `page.waitForFunction(fn, { …` two-arg forms.
5. **Write the conventions down** (in `AGENTS.md`, which the repo already
   uses for agent-facing rules): tests never write inside the checkout;
   no wall-clock relative assertions in the gating suite; no sleeps in e2e;
   fixed ports only for fakes that never bind; every test file must pass in
   isolation.

### Acceptance criteria

- [ ] CI vitest job runs shuffled; two different seeds green on the same
      commit.
- [ ] The helper clones are gone: exactly one implementation each of
      `waitFor`/`waitForFile`/`readEventually`/worker-port helper under
      `test/helpers/`, verified by grep.
- [ ] An intentionally-flaky canary PR (e.g. re-adding a 100 ms sleep to an
      e2e spec, or a two-arg `waitForFunction`) fails the new check script.
- [ ] Playwright report distinguishes `flaky` (passed-on-retry) from `passed`
      and CI logs list flaky tests explicitly.
- [ ] Conventions section exists in `AGENTS.md` and covers the five rules
      above.

---

## Deferred / backlog (documented, not scheduled)

- **Rapier numeric windows** (`test/physics-rapier/rapier-backend.test.ts`):
  hand-tuned windows on Rapier 0.19.3 output are stable per version; widen
  toward behavioral contracts and record the tuned-against version when the
  next Rapier upgrade happens. The exact-float `toMatchObject` at line 1063
  should move to `expect.closeTo` opportunistically.
- **Golden baselines beyond SwiftShader/Linux**: goldens skip on every other
  platform; decide whether to commit Metal baselines or accept and document
  the gap. Pin the CI Chrome version so channel auto-updates can't push AA
  drift past `MAX_DIFF_PIXELS` suite-wide.
- **`test/e2e/glb-viewer.spec.ts` decomposition**: 28.6k lines / 136 tests in
  one serial file concentrates timeout risk and retry cost; split by feature
  area when convenient.
- **Audio flush convention**: ~16 audio test files flush decode/voice-start
  with a single `setTimeout(0)`; sound today (engine has no internal timers)
  but implicit — document the invariant in `FakeAudioBackend` or expose an
  explicit drain promise.
- **elics upstream**: `hasComponent` throwing on never-registered components
  (instead of returning false) is the root enabler of Phase 1's order
  dependence; consider an upstream issue/PR.
