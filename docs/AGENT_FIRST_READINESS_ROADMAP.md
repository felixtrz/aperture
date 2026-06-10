# Agent-First Readiness Roadmap

**Status:** ready-for-execution · created 2026-06-09 · branch `claude/nice-franklin-5sray8`
**Purpose:** the dependency-ordered execution plan that takes Aperture from "agent-first in architecture" to "agent-first as a claimable, verifiable property". Derived from the 2026-06-09 holistic review of the engine against `docs/NORTH_STAR.md`'s own agent-first bar (strong schemas, determinism, clear diagnostics, inspectable state, agent-readable APIs).
**Scope rule:** everything here is fix/polish/hardening of existing feature areas. **Shipping is explicitly out of scope** — no npm publish (AI-72), no public docs-site deployment (AI-80), no framework bindings (AI-81). The in-repo cold-start gate (AF-6) deliberately stops short of publishing.
**Id conventions:** `AI-N` items are canonical in `docs/ACTIONABLE_ROADMAP.md` (full acceptance criteria live there; this doc sequences them and adds readiness-level done-when checks). `AF-N` items are new to this initiative and carry their full acceptance criteria here. `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` remains the status ledger — record completions in its Implementation Log as usual.

## How to execute

- Work **phase by phase, in order**; within a phase respect each item's `Depends on`. Phases R1–R4 are the readiness gate; R5–R6 strengthen the claim.
- An item is done when its acceptance criteria are met, each proven by a committed test or CI job, and `pnpm run check` is green.
- The **Global invariants** in `docs/ACTIONABLE_ROADMAP.md` (ECS-authoritative, worker separation, snapshot-pure rendering, determinism, loud-over-silent, backend-neutral facades, TypeScript-first/WebGPU-only, tested+green) apply to every item below without exception.
- **The readiness claim itself:** Aperture may be called an agent-first 3D runtime when R1–R4 are complete — i.e. CI verifies the breadth of visual behavior, determinism is proven by a replay gate, agents have a documented read+write+verify loop, and the cold-start path is exercised by CI from a clean scaffold.

---

## Phase R1 — Verification you can trust

**Status: ✅ COMPLETE (2026-06-09)** — all six items landed on `claude/nice-franklin-5sray8`; see `docs/FRAMEWORK_GAP_ACTION_ITEMS.md` batch 10 for the per-item record. Coverage rose 82.99% → 85.45% statements (thresholds now gate CI), the full e2e suite runs sharded 8 ways with skip gating and seven golden baselines, and the bench harness + frame budget are in.

_An agent-first engine's core promise is that the harness reports breakage. When this phase started, CI gated 4 of 145 e2e specs with no coverage thresholds._

### R1.1 · AF-1 · Lift the verified floor of the weakest-covered runtime modules

**Priority** P1 · **Effort** M · **Depends on** none

**Change.** Add focused unit tests for the lowest-covered high-value modules found by the 2026-06-09 coverage scan (v8 provider, `npx vitest run --coverage --coverage.include='packages/*/src/**'`; baseline: 82.99% statements / 71.19% branches overall). Targets, worst first (statement %):

- `packages/webgpu/src/shadows/shadow-depth-probe.ts` — **6.3%** (112 stmts)
- `packages/webgpu/src/render/frame/frame-boundary.ts` — **43.2%** (139 stmts)
- `packages/cli/src/reference/source-collection.ts` — **44.0%** (125 stmts)
- `packages/app/src/entities/lookup/mutation.ts` — **51.1%** (280 stmts; the agent write path — see AF-3)
- `packages/webgpu/src/picking/id-buffer-pick.ts` — **51.1%** (139 stmts; `test/webgpu/id-buffer-pick.test.ts` exists but misses half the branches)
- `packages/webgpu/src/app/frame-boundaries.ts` — **58.2%** (213 stmts)
- `packages/physics/src/worker-transfer.ts` — **65.3%**
- `packages/app/src/config/validation.ts` — **66.0%**
- `packages/runtime/src/simulation-worker.ts` — **66.0%**
- `packages/app/src/input/state.ts` — **66.7%**

Follow the pattern used for `worker/devtools/camera.ts` (0% → covered via `test/app/devtools-camera-tools.test.ts`, 2026-06-09): drive the real module through its public entry with fake device/port objects, assert behavior and diagnostics, not internals.

**Acceptance criteria:**

- Each listed module reaches ≥ 80% statement coverage, proven by the coverage report committed alongside (or summarized in) the PR/handoff.
- Tests assert observable behavior (returned reports, diagnostics codes, written ECS state, encoded buffers) — not snapshots of internals.
- Workspace branch coverage rises measurably (target ≥ 75% overall) without deleting existing assertions.

**Files.** Listed above; new tests under `test/webgpu/`, `test/app/`, `test/cli/`, `test/physics/`, `test/runtime/`.

### R1.2 · AI-77 · Enable vitest coverage thresholds in the CI gate

**Priority** P1 · **Effort** S · **Depends on** AF-1 (so thresholds start above, not below, reality)

**Change.** The `@vitest/coverage-v8` provider is installed (2026-06-09). Add a `coverage` block to `vitest.config.ts` (include `packages/*/src/**`, v8 provider, `thresholds` at or just below current totals) and a CI step running `vitest run --coverage` that fails on regression. Ratchet thresholds upward as AF-1 lands.
**Done when** a PR that meaningfully drops coverage fails the `check` job. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-77.
**Files.** `vitest.config.ts`, `.github/workflows/ci.yml`, `package.json` (script).

### R1.3 · AI-71 · Shard the full e2e suite in CI instead of 4 hand-picked specs

**Priority** P1 · **Effort** L · **Depends on** none

**Change.** `.github/workflows/ci.yml` currently runs exactly 4 of the 145 specs in `test/e2e/` (`post-effects`, `taa`, `custom-graph-pass`, `camera-clear-load-matrix`; `dof.spec.ts` excluded for a documented SwiftShader timeout). Replace the hard-coded list with a sharded matrix (`playwright test --shard=k/N`) over the whole directory on the existing SwiftShader runner, keeping known-environment-incompatible specs in one explicit, commented exclusion list. The real-GPU macOS runner half of AI-71 may follow separately — sharding must not wait for it.
**Done when** CI executes every non-excluded spec on every push, the exclusion list is the single place environment skips live, and total wall-clock stays acceptable via shard count. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-71.
**Files.** `.github/workflows/ci.yml`, `playwright.ci.config.ts`, `scripts/webgpu-e2e.sh`.

### R1.4 · AI-75 · Gate skip counts so "environment can't test" never hides "feature broke"

**Priority** P1 · **Effort** S · **Depends on** R1.3

**Change.** Distinguish `test.skip` reasons (environment-capability vs unexpected) and fail CI when the skipped count exceeds the documented allowlist.
**Done when** adding an unexplained skip fails CI with a message naming the spec. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-75.
**Files.** `playwright.ci.config.ts`, `.github/workflows/ci.yml`, a small `scripts/check-e2e-skips.mjs` reporter.

### R1.5 · AI-74 · Golden-image baselines for the core visual set

**Priority** P2 · **Effort** M · **Depends on** R1.3

**Change.** Adopt Playwright `toHaveScreenshot` (or the existing readback-sample probes in `scripts/render-control.mjs` proofs, which are already deterministic) as committed golden baselines for a pinned renderer config: unlit/standard/matcap cube, IBL scene, shadowed scene, post-stack scene, text/UI scene.
**Done when** a one-pixel-region rendering regression in any baselined scene fails CI, and refreshing a baseline is a documented one-command flow. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-74.
**Files.** `test/e2e/`, `playwright.ci.config.ts`, `docs/RENDER_CONTROL.md`.

### R1.6 · AI-76 · Commit the vitest bench harness for render/extraction hot paths

**Priority** P2 · **Effort** M · **Depends on** none (unblocks AI-30/AI-13 measurement in R5)

**Change.** `test/physics/benchmark.test.ts` is the in-repo pattern; add `vitest bench` suites for extraction, transform pack, render-queue planning, and snapshot encode, with thresholds reported (not gating) in CI.
**Done when** `pnpm bench` (or equivalent) produces stable numbers for those four paths and the R5 items can cite before/after deltas. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-76.
**Files.** `test/bench/` (new), `vitest.config.ts`, `.github/workflows/ci.yml` (report step).

---

## Phase R2 — Provable determinism

**Status: ✅ CORE COMPLETE (2026-06-09)** — R2.1 (frame-stamped input drain) and R2.3 (the replay + snapshot-hash CI gate, `test/determinism/replay.test.ts`) are in, plus the AI-55 clock-half equivalence proof (`test/determinism/fixed-clock.test.ts`). The worker-loop residuals (frame-stamped snapshot messages, configurable publish cadence, renderer backpressure) remain open under AI-55/AI-61 in `ACTIONABLE_ROADMAP.md`.

_The North Star promises "same inputs → same snapshots". That is now a CI-enforced contract for the headless simulation path._

### R2.1 · AI-56 · Frame-stamped input ring with deterministic per-frame drain

**Priority** P1 · **Effort** M · **Depends on** none

**Change.** Input events today are drained from `pendingInput` arrays at publish time (`packages/app/src/worker/snapshot.ts:74-78`); stamp each generated input event with the simulation frame it applies to and drain exactly the events for the frame being stepped, so replay applies the identical sequence.
**Done when** the same recorded event list applied twice yields identical input summaries per frame. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-56 (the SAB-ring half can land with AI-70; the frame-stamping half must not wait for it).
**Files.** `packages/app/src/input/events.ts`, `packages/app/src/input/state.ts`, `packages/app/src/worker/loop.ts`, `packages/app/src/worker/snapshot.ts`.

### R2.2 · AI-55 / AI-61 · Fixed-rate sim clock with frame-stamped snapshots and a configurable publish cadence

**Priority** P1 · **Effort** M · **Depends on** R2.1

**Change.** The fixed-step scheduler exists (`this.fixedStep.register`, wired by `createApertureApp`); finish the contract: a fixed-rate sim clock that steps N fixed ticks per wall delta, snapshots stamped with the fixed frame they derive from, and a configurable publish cadence on the worker loop.
**Done when** a headless app stepped with irregular wall deltas produces the same fixed-tick sequence and snapshot stamps as one stepped with regular deltas of equal total. Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` § AI-55, § AI-61.
**Files.** `packages/app/src/worker/loop.ts`, `packages/runtime/src/index.ts`, `packages/app/src/advanced.ts`.

### R2.3 · AF-2 · Determinism replay harness + snapshot-hash CI gate

**Priority** P1 · **Effort** M · **Depends on** R2.1, R2.2

**Change.** Build the proof on existing pieces — no new engine features required:

1. A test-support `hashRenderSnapshot(snapshot)` that hashes the packed snapshot deterministically (reuse `encodeSnapshotPackets` from `@aperture-engine/render` plus the `transforms`/`viewMatrices` buffers; FNV-1a over the words is sufficient).
2. A replay harness: create a headless `createApertureApp` (mode `"headless"`), feed a committed recording (fixed deltas + frame-stamped `ApertureGeneratedInputEvent`s, including pointer/keyboard/gamepad and at least one physics-driven entity), and collect per-frame hashes for ≥ 300 frames.
3. A vitest gate that runs the recording in **two fresh app instances** and asserts the hash sequences are identical, and a committed `expected-hashes.json` so cross-machine drift is also caught (regenerable by a documented command when a change is intentionally non-deterministic-breaking).

**Acceptance criteria:**

- Two same-process runs of the recording produce identical per-frame hash sequences (catches map-iteration order, pooled-scratch leakage, wall-clock reads).
- The committed expected-hash file matches on CI (catches platform/engine drift); the refresh command is documented in the test header.
- The recording exercises input-driven movement, a spawned/despawned entity, and a physics body, so the hash covers transforms, packets, and physics writeback.
- Introducing a deliberate `Math.random()` or `performance.now()` into a system under test makes the gate fail (proven once in the PR, then removed).

**Files.** `packages/render/src/test-support.ts` (hash helper), `test/determinism/replay.test.ts` (new), `test/fixtures/determinism/` (recording + expected hashes).

---

## Phase R3 — The agent read→write→verify loop

**Status: ✅ COMPLETE (2026-06-10)** — AF-3 (render-side mutation registry + doc-sync test), AF-4 (generated diagnostics catalog, CI-gated), AF-5 (`docs/recipes/`, all code lifted from committed sources). Residual: a `material_set` devtools tool over the documented `materials.set` path.

_Inspection is excellent; writing and self-serve feedback lag. Close the loop agents actually run: find → mutate → verify → revert._

### R3.1 · AF-3 · Extend `ecs_set_component_field` to render-side authoring and make the docs match reality

**Priority** P1 · **Effort** M · **Depends on** none

**Change.** The mutation registry (`packages/app/src/entities/lookup/mutation.ts`, `componentFieldMutations`) already covers DebugMetadata, LocalTransform, RigidBody, Collider, PhysicsVelocity, ExternalForce/Impulse, KinematicTarget, PhysicsGravity, and PhysicsCharacterController — but `docs/AI_TOOLING.md` still claims the allowlist is only `debug.tag`/`debug.note`, and the render-side authoring components are missing entirely. Do three things:

1. Add registry entries for the render-side components agents most need: `Visibility` (visible), `RenderLayer` (mask), `Light` (color/intensity/range/kind-safe numeric fields), `Camera` (priority, clearColor, near/far/fov), `Name`/`AppEntityKey` (string), `InstanceTint`. Reuse the existing typed-field-setter helpers; every rejection stays a structured diagnostic with `suggestedFix`.
2. Material parameters do **not** go through this registry — document that material edits flow through the existing `materials.set` patch path, and surface it as the `material_set` devtools tool if not already exposed via `packages/app/src/worker/devtools/`.
3. Rewrite the `Mutating Tools` section of `docs/AI_TOOLING.md` to enumerate the real registry (generate the list from `componentFieldMutations` in a unit test so the doc can never go stale again — the test fails when registry and doc diverge).

**Acceptance criteria:**

- An MCP/devtools call sets `Visibility.visible=false` on a found entity and a subsequent `render_get_frame_report` shows the draw disappear (observable round trip, not a status field).
- Every new field setter has rejection tests: wrong type, stale entity ref, missing component — each returning its structured diagnostic.
- The AI_TOOLING doc lists exactly the registry contents, enforced by the doc-sync test.
- `mutation.ts` coverage rises past the AF-1 bar as a side effect.

**Files.** `packages/app/src/entities/lookup/mutation.ts`, `packages/app/src/worker/devtools/entities.ts`, `docs/AI_TOOLING.md`, `test/app/entity-mutation.test.ts` (new or extended).

### R3.2 · AF-4 · A generated diagnostics-code catalog

**Priority** P2 · **Effort** S · **Depends on** none

**Change.** The codebase emits ~1,220 distinct structured diagnostic codes (`code: "..."` literals across `packages/*/src`) — the raw material for agent self-service — but there is no index. Add `scripts/generate-diagnostics-catalog.mjs` that scans the source for diagnostic-shaped literals (code + message + optional suggestedFix), groups them by package/namespace prefix, and writes `docs/DIAGNOSTICS_CATALOG.md`. Wire it into `check:progress` (or a new `check:diagnostics`) so the committed catalog must match the source.

**Acceptance criteria:**

- `docs/DIAGNOSTICS_CATALOG.md` lists every emitted code with its message template and suggestedFix, grouped by area, with file anchors.
- CI fails when a new diagnostic code is added without regenerating the catalog.
- The catalog is referenced from `docs/AI_TOOLING.md` as the lookup table for tool-returned diagnostics.

**Files.** `scripts/generate-diagnostics-catalog.mjs` (new), `docs/DIAGNOSTICS_CATALOG.md` (generated), `package.json`, `docs/AI_TOOLING.md`.

### R3.3 · AF-5 · Task recipes for agents building _with_ Aperture

**Priority** P2 · **Effort** S · **Depends on** R3.1

**Change.** `docs/AUTHORING.md` documents concepts; agents need end-to-end recipes with verification steps. Add a `docs/recipes/` set (or an AUTHORING.md section per recipe), each in the same shape: goal → config/system code → MCP verification calls → expected reports → revert. Minimum set: spawn a glTF scene; add a custom WGSL material; add a physics body + character controller; build a HUD from signals; run a spatial query from a system; the inspect→mutate→verify→revert loop using `ecs_snapshot`/`ecs_set_component_field`/`ecs_diff` (the documented revert recipe — a broad ECS undo tool stays explicitly out of scope).

**Acceptance criteria:**

- Each recipe's code blocks are lifted from a committed, passing test or the playground (no untested snippets) and say where they came from.
- The mutate→verify→revert recipe runs verbatim against the playground via `aperture tool` calls.
- `playground/GAME_PLAN.md` is cross-referenced as the worked example of the whole flow.

**Files.** `docs/recipes/` (new) or `docs/AUTHORING.md`, `docs/AI_TOOLING.md` (links).

---

## Phase R4 — The in-repo cold-start gate

**Status: ✅ COMPLETE (2026-06-10)** — the cold-start e2e spec passes under the CI config (two real breakages fixed: workspace linking, chromium headless shell) and is gated by the sharded matrix; `scripts/cold-start-proof.sh` is the local repro.

### R4.1 · AF-6 · CI job: scaffold → dev up → MCP tools → pixels, from a clean directory

**Priority** P1 · **Effort** M · **Depends on** R1.3 (shares the e2e runner setup)

**Change.** Prove the cold-start loop works end-to-end using workspace-linked packages (no npm publish). Add a CI job (and a local `scripts/cold-start-proof.sh`) that: creates a temp dir outside the repo checkout; runs the CLI scaffold (`node packages/cli/dist/bin/aperture.js create proof-app` with workspace package links, mirroring what `test/e2e/cli-ai-tools.spec.ts` and `test/cli/dev-session.test.ts` already do piecemeal); runs `aperture dev up --headless`; calls `browser_canvas_status`, `ecs_find_entities`, `render_get_frame_report` over the session; asserts running WebGPU status, ≥ 1 draw call, and zero error-severity diagnostics; runs `aperture dev down`.

**Acceptance criteria:**

- The job passes from a clean checkout on the CI runner (xvfb/SwiftShader, same environment as the e2e job) and fails if scaffold, dev session, tool transport, or first-frame rendering breaks.
- Total job time ≤ ~5 minutes; failures print the session log (`aperture dev logs`) for diagnosis.
- The script is the documented local reproduction (`docs/AI_TOOLING.md` quickstart section points at it).

**Files.** `scripts/cold-start-proof.sh` (new), `.github/workflows/ci.yml`, `packages/cli/src/create-project.ts` (only if scaffolding needs a `--link-workspace` flag), `docs/AI_TOOLING.md`.

---

## Phase R5 — Performance floor at scale

**Status: IN PROGRESS (2026-06-10)** — AI-13 ✅ (per-app persistent extraction cache, byte-identical + determinism-fixture-verified), AI-60 cheap half ✅ (one resolve/refresh per steady-state step via `worldChangeVersion()`), AI-66 ✅ (`writeBufferSubData`). Open: AI-64 (dirty-range transform uploads; depends on AI-67's transform-version split), AI-30 (bench-gated scratch reuse — harness now exists), AI-65/AI-67.

_Sequenced per `docs/ACTIONABLE_ROADMAP.md` Phase 3; listed here because scene-scale perf is part of the agent-first promise ("performance transparency" means acceptable performance plus honest reports). Execute in this order; cite AI-76 bench deltas (R1.6) for each._

1. **AI-13** — own and thread the persistent `RenderExtractionCache` per app instance (the plumbing exists and is currently unreachable). _Depends on R1.6 for the before/after numbers._
2. **AI-60 (cheap half)** — collapse the double resolve/refresh per `step()` before attempting dirty-flag propagation.
3. **AI-66** — the dirty-range-aware buffer upload primitive (`writeBufferSubData`).
4. **AI-64** — wire `RenderSnapshotUpdateSchedule` + per-entity versions into dirty-range transform uploads. _Depends on AI-13 + AI-66._
5. **AI-30** — extraction scratch reuse, **only with** AI-76 benchmarks proving the win (FEAT-03 measured naive reuse 3.9× slower; this stays measure-then-hoist).
6. **AI-65 / AI-67** — generalize dirty-range uploads and split transform-only updates, as follow-ons.

Canonical ACs for all six: `docs/ACTIONABLE_ROADMAP.md` Phase 3.

---

## Phase R6 — Platform stubs that undermine the claim

**Status: IN PROGRESS (2026-06-10)** — AI-87 ✅ (every authored env map prefilters; placeholders retired). AI-12/AI-25 and AI-47 in flight. AI-82 deferred with rationale: the real-embedding swap needs an ONNX/transformers.js-class dependency — a repo-owner decision per AGENTS.md's no-large-dependencies rule; the index format is versioned and ready.

_Each is an existing-feature-area completion whose absence makes a public API silently lie — worse than a missing feature for an agent that trusts contracts._

1. **AI-12** — run user passes (`addRenderPass`/`addComputePass`) on the forward/default route instead of silently no-opping. **P1.**
2. **AI-25** — flip `useFrameGraph` default at parity + an e2e gating spec. _Depends on AI-12._
3. **AI-47** — wheel input event kind + worker-side `UiScroll` mapping so scrollable UI functions.
4. **AI-87** — prefilter every authored env map so the IBL "unsupported source" placeholder is unreachable; drop the stale diagnostics.
5. **AI-82** — swap the reference RAG's hashed bag-of-words for a real local embedding model behind the existing `cosineSimilarity` interface (versioned on-disk index migration; quality of `aperture reference search` directly bounds agent self-service).

Canonical ACs: `docs/ACTIONABLE_ROADMAP.md` Phases 1, 2, 5, 9.

---

## Out of scope (deliberately)

- **Shipping:** AI-72 (release + changelog), AI-80 (public docs/example site deployment), AI-81 (React binding). The work above makes shipping low-risk; it does not perform it.
- **New feature areas:** WebXR (`docs/WEBXR_IMPLEMENTATION_PLAN.md` stays a plan), audio, networking, editor UI, a11y/i18n (by-design non-goals per the gaps audit §5).
- **Broad ECS undo:** the revert story is the snapshot/diff recipe (R3.3); a transactional undo system would be a new feature area.

## Done-definition for the initiative

R1–R4 complete ⇒ update `docs/NORTH_STAR.md`'s status note and the public tracker (`docs/index.html`) to state the agent-first loop is CI-verified end to end, citing: the sharded e2e + golden gates, the determinism replay gate, the documented read→write→verify→revert loop, and the cold-start proof job. R5–R6 then convert "verified" into "verified and scales".
