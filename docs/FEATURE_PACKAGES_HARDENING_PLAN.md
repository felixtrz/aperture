# Feature Packages Hardening Plan

Status: implemented (2026-07-02) — all phases landed, every acceptance
criterion below is ticked, `pnpm run check` green, representative WebGPU e2e
showcases (gpu-particles, particle-bursts, ui-hud, ui-interaction, msaa,
msdf-text, sprite-billboard, spinning-cube, content-showcase) green on Metal.

Implementation notes (deviations from the original fix directions, all in the
plan's spirit):

- P1.1 landed one level deeper than proposed: built-ins register eagerly in
  `createWebGpuAppResourceCache()` (not `createWebGpuApp`), covering every
  cache construction path; the registry's duplicate-id check then rejects
  reserved ids at `registerFeatureRealizer` call time with no separate
  reserved-id list.
- P1.2/P1.3: empty command groups are silently legal (no informational code);
  realizer exceptions propagate uncaught (no third-party isolation catch), and
  `renderSnapshot` clears `latestWorkerError` only on `ok: true`.
- P1.4/P5 landed together: the registry returns split `sceneGroups` (sort
  keys preserved) + ordinal-ordered `overlayCommands`; merge is the single
  sort/validate pass and returns `{ commands, diagnostics }`. The `post`
  phase was cut as dead surface (documented in FEATURE_PACKAGES_PLAN.md).
- P2.4 uses SCC analysis (Tarjan) so optional edges are dropped exactly when
  they participate in any cycle, including cycles mixing required edges.
- P3.2/P3.3: per-feature reports aggregate as `reports:
ReadonlyMap<string, unknown>` keyed by realizer id and surface on the
  render report as the generic `features` section; `webGpuParticleFrameReport`
  is the typed particles alias. The `output` side-channel is gone.
- P4: `FORBIDDEN_BROWSER_GLOBALS` was narrowed to MAIN-THREAD-ONLY globals
  (the invariant is the worker import graph; Blob/Response/OffscreenCanvas
  et al. are worker-available and legitimately used by render's texture
  decode). The render decoder's DOM-canvas fallback was deleted outright —
  every WebGPU-capable environment ships OffscreenCanvas. `document`-named
  locals in simulation/physics were renamed `sceneDocument`, and ui's
  dom-bridge moved to `src/browser/dom-bridge.ts`.
- P6.1/P6.2: `runDisposersInReverse` and `MaybePromise` now live in
  `@aperture-engine/simulation` and are consumed by both app and webgpu.
- P6.5 resolved as KEEP: the extraction ref-count registry is the enforcement
  point for `aperture.feature.unknownPacketFamily` (P2.2) and is covered by
  the feature-extraction-gates tests.

Source: code review of the staged feature-package boundary work on
`codex/feature-packages-boundaries` (2026-07-02). Every issue below was
verified against the staged sources with file:line evidence; verdicts are
noted as CONFIRMED (traced concretely) or PLAUSIBLE (mechanism confirmed,
trigger runtime-dependent).

Companion docs: `docs/FEATURE_PACKAGES_PLAN.md` (architecture intent),
`docs/DIAGNOSTICS_CATALOG.md` (diagnostic code registry — several fixes below
add codes that must be cataloged there).

What the review did NOT find, so this plan does not cover it: the particle
authoring move to `@aperture-engine/particles` is content-identical with all
old exports reachable; all five webgpu frame paths were consistently rewired;
release/gate plumbing for the new package is complete; the `renderFeatures`
thunk is re-evaluated per extract so late extractor registration propagates.

Phases are ordered by severity. Phases 1–2 fix user-visible correctness,
Phase 3 fixes lifecycle/contract gaps, Phase 4 closes a CI enforcement hole,
Phase 5 removes per-frame overhead, Phase 6 is consolidation. Phases are
independently landable except where noted.

---

## Phase 1 — Realizer registry frame-safety

The renderer-side registry treats registration as frame-time work and any
diagnostic as fatal. Three of the four worst findings share this root cause.

### Issues

- **P1.1 (CONFIRMED)** Registering a realizer named `particles` or `ui`
  permanently bricks rendering.
  `packages/webgpu/src/app/built-in-feature-realizers.ts:94` — built-ins
  register lazily on the first frame into the same registry the public
  `registerFeatureRealizer` (`create-webgpu-app.ts:304`) writes to, with no id
  reservation. The collision throws mid-frame, and because
  `builtInFeatureRealizersRegistered` is only set after BOTH built-ins
  register (`:153`), the half-registered state rethrows every frame — even
  after the user unregisters. The dispose handles at `:94`/`:128` are also
  discarded.
- **P1.2 (CONFIRMED)** Any diagnostic from any realizer blacks out the whole
  frame. `packages/webgpu/src/app/feature-command-groups.ts:136` —
  `valid: valid && diagnostics.length === 0` means an advisory warning with
  `valid: true`, or an empty command group on an idle frame, flips the
  registry invalid; all five frame paths early-return `ok: false` before
  submitting anything (frame-loop.ts:906, custom-wgsl-frame.ts:298,
  sprite-frame.ts:150, mixed-custom-wgsl-frame.ts:463,
  queued-built-in-frame.ts:613). Old code rendered through warnings.
- **P1.3 (CONFIRMED)** Built-in particle/UI prep exceptions are silently
  swallowed. `feature-command-groups.ts:116` — previously a prep throw
  rejected `renderSnapshot` loudly (bare awaits at HEAD in all five paths);
  now it becomes a message-only diagnostic (stack lost), the presentation
  loop never inspects the report, and the `ok: false` return path clears
  `latestWorkerError` (`create-webgpu-app.ts:474`). An engine bug becomes an
  undebuggable silent black-frame loop.
- **P1.4 (CONFIRMED)** Realizer-provided sort keys are discarded; one foreign
  renderId silently unsorts the whole transparent pass.
  `built-in-feature-realizers.ts:176` flattens scene groups to bare commands
  (dropping `group.sortKey`); `mergeSnapshotSortedRenderPassCommands`
  (`feature-command-groups.ts:278`) re-derives keys only from the four
  built-in snapshot arrays, misses, and falls back to plain concat for ALL
  transparent commands — while its own missingSortKey diagnostics are
  computed and dropped on the floor (`:276`).

### Fix direction

- P1.1: register built-ins eagerly at app creation (inside
  `createWebGpuApp`, not lazily per frame), delete the
  `builtInFeatureRealizersRegistered` flag, and make `registerFeatureRealizer`
  reject reserved ids (`particles`, `ui`) at call time with a clear error.
  Registration must never happen inside the frame path.
- P1.2: `valid` must be realizer-declared validity only. Diagnostics ride
  along in the report (they already flow into `renderReport.diagnostics`)
  without gating submission. Empty command groups are legal no-ops, not
  errors — drop the `webGpuFeatureCommandGroup.empty` severity or make it
  informational.
- P1.3: do not catch realizer `prepareFrame` exceptions for built-ins — or if
  the catch stays for third-party isolation, preserve the error object
  (attach `cause`, keep the stack), surface it through the worker error
  channel (`workerSnapshotRenderFailed`), and never clear
  `latestWorkerError` on an `ok: false` return.
- P1.4: carry command groups (with their sort keys) end-to-end instead of
  flattening to bare commands and re-deriving. `merge` should accept groups,
  use the realizer-provided `sortKey` when present, and fall back to the
  snapshot lookup only for the base sprite/text path. A transparent group
  that ends up keyless is a contract violation: report the missingSortKey
  diagnostic (do not drop it) and degrade ordering for that group only —
  never for the whole frame. No silent whole-frame fallback (repo rule: no
  hacky fallbacks).

### Test plan

Unit (extend `test/webgpu/feature-command-groups.test.ts`,
`test/webgpu/built-in-feature-realizers.test.ts`,
`test/webgpu/webgpu-app.test.ts`):

- `registerFeatureRealizer({id:'particles'})` and `({id:'ui'})` throw
  synchronously at registration with a reserved-id message; the first frame
  still renders.
- User realizer registered before the first frame coexists with built-ins;
  registration order does not change which realizers run.
- Realizer returns `{valid:true, diagnostics:[warning]}` → frame report
  `ok: true`, warning present in `report.diagnostics`, commands submitted.
- Realizer returns an empty command group → frame renders; no fatal gate.
- Realizer `prepareFrame` throws → frame fails loudly per the chosen design
  (rejection or `workerSnapshotRenderFailed` with the original error/stack);
  `latestWorkerError` is not cleared by the failing return.
- Transparent group with explicit sortKey + synthetic renderId: merged output
  preserves snapshot-sorted interleaving for base commands, honors the
  group's own key, emits no silent fallback; keyless transparent group emits
  the missingSortKey diagnostic in the returned report.
- Regression pins: existing ordering tests (sprite/text/particle interleave)
  stay green across all five frame paths.

E2e (SwiftShader per `scripts/webgpu-e2e.sh`): one spec registering a benign
custom overlay realizer via `app.registerFeatureRealizer` asserting the scene
still renders (non-black readback) and overlay ordering is stable across two
frames.

### Acceptance criteria

- [x] Reserved-id registration fails at `registerFeatureRealizer` call time;
      no code path registers realizers during a frame.
- [x] A diagnostic-emitting but `valid: true` realizer cannot prevent frame
      submission; the early-return gate fires only on realizer-declared
      invalidity or thrown errors. (The report-level `ok` flag still reflects
      diagnostics, exactly as it always has for built-in sprite/text/particle
      diagnostics — the frame renders and the diagnostics ride along.)
- [x] A throwing built-in prep produces a loud, stack-bearing failure signal
      observable without polling `latestReport`.
- [x] No input a public-API realizer can return silently changes ordering of
      commands it does not own.
- [x] All five frame paths covered by at least one new test each for the
      gate change; `pnpm run check` green.

---

## Phase 2 — Worker-side contract diagnostics (silent no-ops)

The worker-side feature contract fails silently in the cases a feature-package
author will actually hit.

### Issues

- **P2.1 (CONFIRMED)** `features: []` (or any list omitting particles/ui)
  silently disables particle and UI extraction — including UI hit regions, so
  interaction breaks with nothing to point at.
  `packages/app/src/advanced.ts:617`. The opt-in flip is intended and pinned
  by `test/app/feature-extraction-gates.test.ts`; the defect is the silence:
  no diagnostic fires when live emitters/UI nodes exist while their family is
  gated off, and `config/validation.ts` only shape-checks.
- **P2.2 (CONFIRMED)** `registerExtractor` silently no-ops for unknown packet
  families. `advanced.ts:561` — a hook with `packetFamilies: ['decalDraws']`
  gets a success disposer; the diagnostics sink sits in
  `FeatureExtractionContext` but is never threaded into the registry closure.
  Note the deeper gap: the implemented `ExtractionHook` has no `extract()`
  method (unlike the plan doc's contract), so unknown families can never
  produce packets by construction.
- **P2.3 (CONFIRMED, latent)** `resolveApertureWorkerFeatureOrder` throws if
  the caller-supplied diagnostics sink contains ANY pre-existing
  error-severity diagnostic (`packages/app/src/features.ts:281`) — a reused
  or pre-seeded sink fails resolution of a perfectly valid feature list. Both
  affordances (`diagnostics` option, `createFeatureDiagnosticsSink(initial)`)
  are exported public API.
- **P2.4 (CONFIRMED, latent)** Mutual `optional` hints are treated as a hard
  dependency cycle (`features.ts:339`) — `[{id:'a', optional:['b']},
{id:'b', optional:['a']}]` aborts app creation despite a trivially valid
  order, and the diagnostic mislabels it `dependencyCycle`. `optional`
  semantics are documented nowhere.
- **P2.5 (CONFIRMED)** `ApertureFeatureError.diagnostics` is dropped at the
  worker boundary: `packages/app/src/worker/loop.ts:239`
  (`errorToApertureDiagnostic`) reads `error["detail"]`, not `.diagnostics`,
  so feature-install diagnostics never reach worker error events.

### Fix direction

- P2.1: extraction emits a warning diagnostic (new catalog code, e.g.
  `render.extraction.featureGatedWithLiveEntities`) when a gated-off family
  has live entities in the world. Emit once per family per session, not per
  frame. Alternatively (or additionally) `config/validation.ts` warns when
  `features` is present and a world-known family id is absent — decide one
  primary home, don't do both halfway.
- P2.2: thread the scoped diagnostics sink into
  `createFeatureExtractorRegistry`; unknown packet families report an
  error-severity diagnostic (e.g. `aperture.feature.unknownPacketFamily`)
  and fail install (consistent with the plan's explicit-contract stance).
  Resolve the `extract()` divergence from the plan doc explicitly: either
  implement the plan's hook shape or update the plan.
- P2.3: snapshot `diagnostics.list().length` on entry and gate only on
  diagnostics added during this resolution.
- P2.4: break cycles across `optional` edges instead of throwing (drop the
  optional edge, keep resolving); document `optional` as soft ordering in
  the features JSDoc and plan doc. If fail-fast is preferred instead, emit a
  dedicated code (not `dependencyCycle`) and document it.
- P2.5: `errorToApertureDiagnostic` recognizes `ApertureFeatureError` and
  forwards its `diagnostics` array (fits the existing `data` sweep).

### Test plan

Unit (extend `test/app/feature-extraction-gates.test.ts`,
`test/app/features.test.ts`, `test/app/config-validation.test.ts`; new
`test/app/worker-feature-errors.test.ts` if needed):

- World with live particle emitters + `features: []` → snapshot has no
  particle packets AND the gated-family warning appears exactly once.
- `installExtraction` hook with an unknown packet family → install fails
  with `unknownPacketFamily` naming the family and feature id.
- Reused sink: install → legit failure → second install with same sink and a
  valid list succeeds.
- Mutual-optional pair resolves (either order accepted); `requires` cycles
  still throw `dependencyCycle`.
- A feature whose `installRuntime` throws inside the worker loop surfaces its
  `ApertureFeatureError.diagnostics` in the worker error event payload.
- Docs: new codes added to `docs/DIAGNOSTICS_CATALOG.md` (check-docs gates).

### Acceptance criteria

- [x] No silent no-op remains in the worker-side contract: gated-off
      families with live entities warn; unknown packet families fail install
      with a diagnostic.
- [x] Feature resolution is a pure function of the feature list — sink
      history cannot change the outcome.
- [x] `optional` semantics are documented and tested; mutual-optional does
      not abort app creation (or is rejected under its own documented code).
- [x] Feature diagnostics survive the worker error boundary.
- [x] All new diagnostic codes cataloged; `pnpm run check` green.

---

## Phase 3 — Lifecycle and public realizer contract

The realizer contract is currently two-tier: built-ins get plumbing
third-party realizers cannot reach, and nothing disposes anything.

### Issues

- **P3.1 (PLAUSIBLE)** `void runner.app.dispose()` in
  `packages/cli/src/headless/session-controller.ts:808` turns a throwing
  feature disposer into an unhandled rejection → CLI process crash
  (rollback rethrows AggregateError after an await; no `unhandledRejection`
  handler exists in packages/cli). Physics teardown itself is still covered
  (feature rollback runs it synchronously first), and the old
  runner-ordering behavior is unchanged — the regression is strictly the
  unobserved rejection.
- **P3.2 (CONFIRMED)** `WebGpuAppFeatureRealizerInput`
  (`packages/webgpu/src/app/app.ts:84`) omits the `cache`/`output` fields
  realizers actually receive at runtime; user realizers get them untyped via
  the shared registry cast (`built-in-feature-realizers.ts:88`,
  `create-webgpu-app.ts:304`).
- **P3.3 (CONFIRMED)** `result.report` (`feature-command-groups.ts:49`) is
  declared but never read; built-ins smuggle typed resources through the
  `input.output` side-channel; `frame-loop.ts:903/:1036` still hardcodes
  `particleFrame.report`. A third-party realizer has no way to surface
  per-frame stats. Sprite/text frames are not realizers at all.
- **P3.4 (CONFIRMED)** Nothing ever calls `featureRealizers.dispose()`;
  `WebGpuApp` has no teardown lifecycle (`stop()` only unsubscribes), so a
  realizer's GPU resources leak on session recycle.
- **P3.5 (CONFIRMED)** Overlay ordering uses magic ordinals `1_000`/`2_000`
  (`built-in-feature-realizers.ts:120/:146`) with no named constants or
  reservation scheme; equal ordinals tie-break by registration order, which
  is load-order-dependent for user-vs-builtin.

### Fix direction

- P3.1: make `disposeRunner` await-or-catch: either propagate the promise to
  the session-command handler, or `.catch()` into the session diagnostics
  channel. Never `void` a promise that is specified to reject.
- P3.2/P3.3: make the contract honest in one move. Give realizers a typed
  per-feature resource slot instead of the untyped side-channel — e.g. the
  registry aggregates `report` into a `Map<featureId, report>` returned from
  `prepareFrame`, frame paths read `reports.get('particles')`, and the
  render report gains a generic `features: Record<string, unknown>` section
  (keep `particles` as a typed alias while migrating). Then `output` can be
  deleted and the public input type matches reality (decide explicitly
  whether `cache` is public; if not, built-ins should close over it rather
  than receive it via input).
- P3.4: registry disposal must be owned by an app lifecycle. Add
  `WebGpuApp.dispose()` (or fold into an existing teardown if one is
  introduced) that awaits `featureRealizers.dispose()`; wire the headless
  session controller to it.
- P3.5: export named ordinal constants (e.g.
  `BUILT_IN_OVERLAY_ORDINALS = { particles: 1_000, ui: 2_000 }`), document
  the reservation scheme in the plan doc, and make Phase 1's eager
  registration remove the load-order dependence for ties.

### Test plan

- Unit (`test/cli/headless-session-controller.test.ts`): feature disposer
  that throws during session recycle → controller surfaces a diagnostic;
  process-level rejection test via `process.on('unhandledRejection')` spy
  asserting none fired.
- Unit (`test/webgpu/feature-command-groups.test.ts`): realizer sets
  `report` → registry output exposes it keyed by feature id; built-in
  particle report reaches the render report unchanged (pin existing
  `particles:` report shape).
- Unit (`test/webgpu/webgpu-app.test.ts`): realizer with `dispose()` →
  app teardown runs it exactly once; double-teardown is a no-op.
- Type-level: a realizer written against the public input type compiles and
  runs without casts (compile-only test or expectTypeOf).
- Unit: two overlay groups at the same ordinal from different realizers →
  deterministic documented order regardless of registration timing.

### Acceptance criteria

- [x] `app.dispose()` rejections are always observed; a throwing feature
      disposer cannot crash the headless CLI process.
- [x] The public realizer input type matches what realizers receive; the
      `output` side-channel is gone; per-feature reports flow through one
      documented mechanism used by built-ins and third parties alike.
- [x] Realizer `dispose()` runs on app teardown without manual unregister.
- [x] No magic ordinals: named constants + documented reservation ranges.
- [x] `pnpm run check` green.

---

## Phase 4 — Boundary enforcement generalization

### Issues

- **P4.1 (CONFIRMED)** `scripts/check-package-boundaries.mjs:315` applies the
  browser-global rule only when `packageName === "ui"`, with two hardcoded
  exempt paths (`UI_BROWSER_SUBPATHS`, `:96`). `FEATURE_PACKAGES_PLAN.md`
  claims scripts enforce browser-global bans for feature packages generally
  (boundary table ~`:282`, "enforced by scripts" `:265`). `window` in
  `packages/particles/src` passes CI today — and typecheck (tsconfig `lib`
  includes DOM). Audio's Web Audio allowance is by design; the gap is
  browser globals in any headless feature package outside `ui`.

### Fix direction

Make the rule convention-driven instead of package-hardcoded: every package
in `DEFAULT_HEADLESS_PACKAGES` is checked for `FORBIDDEN_BROWSER_GLOBALS`,
with a single structural exemption — files under a declared browser entry
subtree (e.g. `src/browser.ts` + `src/browser/**`, or a
`package.json`-declared list) are exempt. Delete `UI_BROWSER_SUBPATHS`; `ui`
becomes a plain instance of the convention. Fix any violations the widened
check surfaces (do the clean thing, no per-file carve-outs).

### Test plan

- Extend the boundary-check self-tests (or add
  `test/scripts/check-package-boundaries.test.mjs` beside existing script
  tests): fixture with `window` in a headless package root → violation;
  same identifier under the browser subtree → pass; `ui`'s current layout →
  pass unchanged.
- Run the widened check across the repo; triage every new hit (fix or move
  behind a browser entry — no allowlisting).

### Acceptance criteria

- [x] The check enforces exactly what `FEATURE_PACKAGES_PLAN.md` promises,
      for every headless package, including ones added later with zero
      script edits.
- [x] No hardcoded per-package file paths remain in the script.
- [x] Repo-wide check passes; `pnpm run check` green.

---

## Phase 5 — Frame-path efficiency

All confirmed regressions on the 60 Hz path introduced by the realizer layer.
Best landed after Phase 1 since P1.4 reshapes the same functions.

### Issues

- **P5.1 (CONFIRMED)** `createWebGpuFeatureCommandGroupsFromCommands`
  (`feature-command-groups.ts:175`) builds the whole-snapshot sort-key Map
  before checking for zero commands — a particle-free scene with 5,000 mesh
  draws allocates and fills a 5,000-entry Map every frame for an empty list
  (old code: zero maps on such frames).
- **P5.2 (CONFIRMED)** The same whole-snapshot map is built a second time in
  `mergeSnapshotSortedRenderPassCommands` — invariantly one extra full-map
  build per frame vs HEAD.
- **P5.3 (CONFIRMED)** Groups are sorted + validated in the registry, then
  flattened and re-grouped/re-validated/re-sorted in merge — double work,
  the first sort discarded.
- **P5.4 (CONFIRMED, queued path only)** The queued frame lost its
  allocation-free `snapshotHasUiFrameWork` `.some()` gate; UI prep now runs
  spread + two filters + sort over all uiNodes per frame even when nothing
  is renderable. (frame-loop already ran ui prep unconditionally at HEAD.)
- **P5.5 (CONFIRMED)** Minor churn: `sceneCommandsFromGroups`/
  `overlayCommandsFromGroups` allocate 4 intermediate arrays per frame; the
  `.map((d) => ({...d, code: d.code}))` at `feature-command-groups.ts:127`
  is a verified no-op clone (assignability checked under strict +
  exactOptionalPropertyTypes).

### Fix direction

Compute the sort-key map at most once per frame and thread it through
(realizer input or explicit parameter); early-return `[]` on empty commands
before any map build; single sort/validate pass (merge accepts pre-built
groups — falls out of P1.4); restore a cheap has-work predicate for the ui
realizer (or make `sortedRenderableUiNodes` allocation-free when empty);
single-pass group partitioning; delete the no-op clone.

### Test plan

- Unit: sort-key map builder invoked exactly once per frame (spy/counter in
  a frame-shaped test through `prepareBuiltInWebGpuFeatureFrameResources` +
  merge); zero-command realizer path performs no snapshot iteration.
- Existing ordering/interleave tests stay green (behavioral no-op).
- Optional: assert command output identity (deep-equal) before/after on a
  recorded snapshot fixture to prove pure-refactor status.

### Acceptance criteria

- [x] At most one whole-snapshot sort-key map build per rendered frame; zero
      on frames with no feature commands.
- [x] One sort + one validation pass per frame over feature groups.
- [x] No behavioral change: identical command sequences on fixture
      snapshots; all existing frame tests green.

---

## Phase 6 — Consolidation cleanups

Non-urgent, all verified. Batch into one PR.

- **P6.1** Duplicate LIFO disposer stacks: `features.ts:358/:399` vs
  `feature-command-groups.ts:80/:141` — extract one shared
  run-disposers-in-reverse helper (note: features.ts variant also reports
  per-failure diagnostics; parameterize).
- **P6.2** `MaybePromise<T>` defined 3× (`features.ts:7`,
  `feature-command-groups.ts:8`, private in `particles.ts:326`) — hoist to a
  shared package both already depend on.
- **P6.3** `emptyParticleFrameReport`/`emptyParticleFrameResources`/
  `emptyUiFrameResources` in `built-in-feature-realizers.ts:197-229` are
  field-for-field copies of private constructors in `particles.ts:3729` /
  `ui.ts:113` — export the originals and import.
- **P6.4** Never-constructed diagnostic codes
  `webGpuFeatureRealizer.duplicate` / `.disposeFailed`
  (`feature-command-groups.ts:36/:38`) — construct them where the plain
  Error/AggregateError throws happen, or delete from the union.
- **P6.5** Dead ref-count machinery in `createFeatureExtractorRegistry`
  (`advanced.ts:554`) — becomes load-bearing if Phase 2 lands as specified;
  otherwise delete until a real extractor exists. Decide with P2.2.
- **P6.6** `BuiltInWebGpuFeatureFrameResources` triple representation
  (`commandGroups` + `sceneCommands` + `overlayCommands`;
  `built-in-feature-realizers.ts:33`) — production reads only the derived
  arrays; likely resolved by P1.4's group-passing redesign; otherwise drop
  `commandGroups` (tests can use the registry directly).
- **P6.7** Pass-through re-export of `mergeSnapshotSortedRenderPassCommands`
  mid-file in `particles.ts:60`, kept only for test-support — export
  feature-command-groups from `test-support.ts` and delete.
- **P6.8** `sceneCommandsFromGroups` phase set duplicates private
  `requiresRenderSortKey` (`feature-command-groups.ts:292`) — export one
  predicate; note the two have different nominal semantics (scene-pass
  membership vs needs-sort-key) that merely coincide today — name them
  accordingly if they stay separate.
- **P6.9** `FeatureDiagnostic.details` vs the repo-wide `data` field naming
  (`features.ts:33`) — rename to `data` before the API is public-locked.
  (Verified NOT a payload-drop bug — `normalizeApertureDiagnostic` sweeps
  unknown keys into `data` — purely consistency.)

### Test plan / acceptance criteria

- [x] Pure refactors: full unit + e2e suites green with no test-expectation
      changes except renamed symbols/fields.
- [x] No new exports duplicating existing helpers; grep confirms single
      definition for each consolidated item.
- [x] `pnpm run check` green.

---

## Suggested sequencing

1. Phase 1 (frame-safety) — blocks shipping `registerFeatureRealizer` as
   public API in any form.
2. Phase 2 (silent no-ops) — blocks the first real third-party feature
   package.
3. Phase 3 (lifecycle/contract) — before the realizer API is documented.
4. Phase 4 (boundary gate) — cheap, independent, closes a stated-vs-enforced
   gap; can land any time.
5. Phase 5 (efficiency) — after Phase 1 to avoid double-touching merge.
6. Phase 6 (cleanup) — opportunistic.
