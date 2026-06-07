# Code Audit Remediation Execution Plan

**Status:** ready-for-execution
**Created:** 2026-06-06
**Refined:** 2026-06-06
**Source:** Original multi-agent dead/experimental/unfinished-code audit, plus
2026-06-06 ultracode verification against current source.
**Scope:** `@aperture-engine/*`, `docs/`, `examples/`, `playground/`,
`scripts/`, and tests.

This document is the executable version of the code-audit remediation plan. It
supersedes the earlier raw audit queue. Do not execute items from the parked or
rejected sections unless a new source-grounded decision changes their status.

## Verification Result

The latest ultracode verification changed the plan materially:

- Most Phase 0 cleanup remains valid.
- Phase 6 docs/tooling cleanup remains valid.
- Phase 4 physics was stale. The current project keeps simulation-worker
  physics as the default proof route and keeps the Rapier transferable dedicated
  worker as a supported proof route, not the next product focus.
- Several render-frame deletion claims were wrong because the code is live in
  examples, diagnostics, or E2E coverage.
- Several feature items are now partly or fully implemented and need narrower
  follow-up wording.

## Execution Rules

1. Re-run symbol searches before deleting or de-exporting anything:
   `rg -n "<symbol>" packages examples playground test scripts docs`.
2. Treat test-only usage as a signal to relocate or rewrite tests, not as a
   live production consumer.
3. Do not delete examples or proof routes unless this document explicitly says
   the route is rejected.
4. Prefer small commits by queue. Each commit should include the focused tests
   for that queue.
5. Keep public API removals explicit. If a package public barrel changes, add or
   update changeset/release-note material. This applies especially to `DC-04`,
   `DC-07`, `DC-13`, `BH-01`, `BH-05`, and `BH-06`.
6. After each queue, run the listed validation. Run `pnpm run check` before a
   final commit or before marking a larger phase done.

## Recommended Order

1. **Q0 - Immediate safe cleanup**: mostly dead exports and one example bug.
2. **Q6 - Docs/tooling freshness**: low-risk, high signal.
3. **Q1 - Public-surface hygiene**: narrow barrels and move test-only helpers.
4. **Q3 - Confirmed duplicate consolidation**: shared utilities and wrappers.
5. **Q5 - Feature follow-ups**: actual implementation work.
6. **Q4 - Physics facade and validation follow-ups**: do not purge the dedicated
   worker route unless a future decision says so.

## Validation Shortcuts

Use targeted validation while developing, then `pnpm run check` before marking a
large queue done.

- Public-surface cleanup:

  ```sh
  pnpm run check:boundaries && pnpm run typecheck && pnpm run typecheck:test && pnpm run check:publish
  ```

- Physics barrel/worker-transfer cleanup:
  `pnpm exec vitest run test/runtime/physics-worker-transfer.test.ts test/physics/worker-protocol.test.ts`
  plus the `physics-worker-mode` E2E route when browser behavior is affected.
- Render cleanup: targeted render/webgpu Vitest coverage for the touched symbol,
  then `pnpm run check:examples`.
- Docs/tooling cleanup: `pnpm run check:progress`,
  `pnpm run check:examples`, and `pnpm run format:check`.

## Queue Q0 - Immediate Safe Cleanup

Most items in this queue are source-verified and independently executable.
Items marked `needs-refinement` are still small, but require the narrower action
written under that item before implementation. Suggested validation: targeted
tests for touched package, `pnpm run build`, `pnpm run typecheck`, and
`pnpm run check:examples` when examples change.

### DC-01 - Fix `markReadbackClearOk` no-op

- Status: completed 2026-06-06.
- File: `examples/render-to-texture.main.js`.
- Problem: the example still calls `aperture.markReadbackClearOk?.(...)` even
  though `markReadbackClearOk` is a local helper from `examples/webgpu-readback.js`.
- Action: import/use the local helper directly, matching sibling examples.
- Accept: `node --check examples/render-to-texture.main.js`; readback clear-ok
  marking is applied through the local helper.

### DC-02 - Delete dead CLI planned-command scaffold

- Status: completed 2026-06-06.
- File: `packages/cli/src/cli.ts`.
- Problem: `isPlannedCommand()` hardcodes `false`, making the planned-command
  branch and help text unreachable.
- Action: delete `isPlannedCommand`, `plannedCommandHelp`, and the dead branch.
- Accept: CLI tests and typecheck pass.

### DC-03 - Delete fake shared-snapshot reduction estimator

- Status: completed 2026-06-06.
- File: `packages/webgpu/src/app/app-snapshot-transport.ts`.
- Problem: `estimateSharedSnapshotTransportReduction()` hardcodes the shared
  buffer byte count to zero and has no real caller.
- Action: delete the function and its `test-support` re-export.
- Accept: no references remain; webgpu tests/typecheck pass.

### DC-04 - Delete `fullMipLevelCountForTextureSize`

- Status: completed 2026-06-06.
- File: `packages/webgpu/src/resources/textures/generate-mipmaps.ts`.
- Problem: helper is publicly exported but unused; live mip generation uses the
  supplied `mipLevelCount`.
- Action: delete helper and public export.
- Accept: no references remain; webgpu typecheck/tests pass.

### DC-05 - Delete string JSON variant for prepared environment asset set

- Status: completed 2026-06-06.
- File: `packages/webgpu/src/app/app-environment-resources.ts`.
- Problem: `webGpuPreparedEnvironmentAssetSetToJson()` is dead; live callers use
  `webGpuPreparedEnvironmentAssetSetToJsonValue()`.
- Action: delete the string variant.
- Accept: no references remain.

### DC-06 - Trim internal physics worker-transfer helpers

- Status: completed 2026-06-06; dedicated worker route preserved.
- File: `packages/physics/src/worker-transfer.ts`.
- Problem: `estimatePhysicsTransferableResultBytes()` has no callers;
  `summarizePhysicsCommands()` is exported but only used internally.
- Action: delete the unused estimator; make `summarizePhysicsCommands` internal.
- Accept: worker-transfer tests still pass.

### DC-07 - De-export `executePhysicsWorkerAction`

- Status: completed 2026-06-06; dedicated worker route preserved.
- File: `packages/physics/src/worker-transfer.ts`.
- Problem: `executePhysicsWorkerAction()` is exported through `export *` but
  only called internally.
- Action: de-export by narrowing `packages/physics/src/index.ts` or moving the
  helper out of the public barrel.
- Accept: public barrel no longer exposes the helper; worker-transfer tests pass.
- Note: this overlaps with `BH-05`.

### DC-08 - Remove or wire only the unused character-settings wrapper

- Status: completed 2026-06-06.
- File: `packages/physics/src/validation.ts`.
- Problem: public `validateCharacterControllerSettings()` wrapper has no
  callers, but the underlying validation logic is live through
  `validatePhysicsCharacterControllerInput()` and `validatePhysicsCharacterMove()`.
- Action: either wire the wrapper into authoring as part of `PHY-04`, or delete
  only the unused public wrapper. Do not delete shared validation internals.
- Accept: character-controller validation tests and devtools move validation
  still pass.

### DC-09 - Delete orphaned app input barrel

- Status: completed 2026-06-06.
- File: `packages/app/src/input/index.ts`.
- Problem: no package subpath exposes it and no importers were found.
- Action: delete the barrel.
- Accept: `pnpm run check:boundaries` and app typecheck pass.

### DC-10 - Delete or de-export `assetDiagnosticFromSystemDiagnostic`

- Status: completed 2026-06-06.
- File: `packages/app/src/systems/diagnostics.ts`.
- Problem: re-exported via `@aperture-engine/app/systems`, no consumers found.
- Action: delete or de-export, and update stale docs that still describe this
  helper as preserved through `systems.ts` (notably
  `docs/PACKAGE_STRUCTURE_REFACTOR_PLAN.md` if it still contains that claim).
- Accept: app typecheck passes.

### DC-11 - Delete `SimulationWorkerInboundMessage`

- Status: completed 2026-06-06.
- File: `packages/runtime/src/simulation-worker.ts`.
- Problem: dead union type re-exported from runtime index.
- Action: delete type and public re-export.
- Accept: runtime typecheck/tests pass.

### DC-12 - Relocate or rewrite test-only simulation helpers

- Status: completed 2026-06-06.
- Files: `packages/simulation/src/math/ray.ts`,
  `packages/simulation/src/assets/collections.ts`.
- Problem: `rayIntersectsAabb`, `rayIntersectsSphere`, and
  `createTypedAssetCollection` are not live production callers, but tests import
  them directly.
- Action: either rewrite tests to use live hit-returning APIs and constructors,
  or move helpers behind test-support. Do not blindly delete while tests import
  them.
- Accept: simulation tests pass and public runtime surface is smaller.

### DC-13 - De-export render asset internals precisely

- Status: completed 2026-06-06.
- Files: KTX2 decoder/transcoder and GLB container diagnostics modules.
- Problem: cleanup is real, but body deletion is too broad.
- Action:
  - Keep `decodeKtx2TextureData()` body if async decode still uses it.
  - Replace broad asset barrel exports with named exports so public test-only
    sync KTX2 decode is no longer leaked from `packages/render/src/assets/index.ts`.
  - Move or rewrite tests that import public test-only sync KTX2 decode.
  - De-export internal-only `transcodeBasisKtx2TextureData()`.
  - De-export internal-only `createGlbContainerDiagnostic()`.
- Accept: asset tests pass; public barrel no longer exposes test/internal helpers.

### DC-14 - Collapse physics test-backend shim hop

- Status: completed 2026-06-06.
- Files: `packages/physics/src/testing.ts`,
  `packages/physics/src/test-backend.ts`.
- Problem: `testing.ts -> test-backend.ts -> test-backend/backend.ts` has an
  unnecessary middle shim.
- Action: make `testing.ts` re-export `./test-backend/backend.js` directly and
  delete the middle shim if no references remain.
- Accept: `@aperture-engine/physics/testing` tests still pass.

## Queue Q1 - Public-Surface Hygiene

These are public-barrel cleanup tasks. Suggested validation:
`pnpm run typecheck`, `pnpm run typecheck:test`, package tests for touched
packages, and an `rg` scan for moved symbols.

### BH-01 - Split injected-frame runner/summary exports

- Status: completed 2026-06-06.
- Files: `packages/webgpu/src/render/frame/renderer-frame-summary.ts`,
  `packages/webgpu/src/index.ts`, `packages/webgpu/src/test-support.ts`,
  `docs/RENDER_FRAME_READINESS.md`.
- Problem: `packages/webgpu/src/index.ts` still exports the whole
  `renderer-frame-summary` module. Only
  `writeInjectedRenderFrameSnapshotResourceBindings` is live; runner/summary
  helpers appear test-only in source. However, `docs/RENDER_FRAME_READINESS.md`
  currently documents some runner/summary helpers as public helper surface.
- Action: keep the live writer public; move test-only runner/summary helpers to
  test-support; replace `export *` with named exports. Update/deprecate the
  render-frame readiness docs in the same change so docs do not promise removed
  public APIs.
- Accept: tests import helpers from test-support; public barrel is narrower.
- Result: the public WebGPU barrel now keeps the snapshot binding planner,
  scratch writer, and their signature types; injected frame runners and
  renderer-frame summary JSON/grouping helpers remain available through
  `@aperture-engine/webgpu/test-support`. The planner stays public because
  examples call it directly.

### BH-02 - No action: render-frame smoke/report leaks already fixed

- Status: already-fixed/stale.
- Current state: listed smoke/report/validation modules are already only in
  `packages/webgpu/src/test-support.ts`, not the public webgpu index.
- Action: do nothing unless a new leak is found.

### BH-03 - No action: queue/material inspection leaks already fixed

- Status: already-fixed/stale.
- Current state: listed queue/material inspection helpers are test-support only.
  Fidelity summary siblings remain public because app diagnostics uses them.
- Action: do nothing unless a new leak is found.

### BH-04 - Split webgpu serializer cleanup by symbol

- Status: completed 2026-06-06 by source verification.
- Problem: original item grouped live and test-only symbols together.
- Action:
  - Keep `createPreparedResourceAppReuseAlignmentSummary`; it is used by
    `examples/app-diagnostics-scene.js`.
  - Keep `createLightShaderResourceReadinessReport` internal where direct-light
    readiness uses it.
  - Move or de-export `commandSubmissionMetricsReportToJson*` if still
    test-only.
  - Move `createOffscreenColorTargets` to test/e2e support if still e2e-only.
- Accept: no live app diagnostics imports break.
- Result: no code change was needed. `packages/webgpu/src/index.ts` already
  keeps only `createPreparedResourceAppReuseAlignmentSummary` public from this
  set. `createLightShaderResourceReadinessReport`,
  `commandSubmissionMetricsReportToJson*`, and `createOffscreenColorTargets`
  are internal/test-support surfaces; tests import them from
  `@aperture-engine/webgpu/test-support`.

### BH-05 - Narrow physics public barrel

- Status: completed 2026-06-06.
- File: `packages/physics/src/index.ts`.
- Problem: `export * from "./worker-transfer.js"` leaks internal helpers such
  as `executePhysicsWorkerAction`.
- Action: replace blanket export with an explicit list. Keep
  `createPhysicsWorkerTransferProxy` and `createPhysicsWorkerBackendEndpoint`
  public because the parked Rapier transferable proof route currently uses them.
  Hide only internal helpers such as `executePhysicsWorkerAction` and the unused
  estimator.
- Accept: `executePhysicsWorkerAction` and unused estimator are not public, while
  `createPhysicsWorkerTransferProxy` and `createPhysicsWorkerBackendEndpoint`
  remain public for the supported transferable proof route.

### BH-06 - Split render package test-only exports by symbol

- Status: completed 2026-06-06.
- Problem: original item grouped live inspectors with test-only inspectors.
- Action:
  - Keep `inspectRenderSnapshot` and `explainRenderSnapshotEntity`; examples use
    them.
  - Keep `DrawPackageBatchingReport` type; webgpu frame reports use it.
  - Move or de-export test-only package inspection, cloneability, snapshot
    diagnostics, and string serializer helpers.
- Accept: render packet inspector and multi-entity examples still build.
- Result: `@aperture-engine/render` now keeps the live snapshot inspectors and
  batching report types public, while `inspectRenderPackages`,
  `validateRenderSnapshotCloneability`, and
  `summarizeRenderSnapshotDiagnostics` are exposed through the new
  `@aperture-engine/render/test-support` subpath. No current public string
  serializer helper matched the source search for this item.

## Queue Q2 - Render-Fork Cleanup

Only execute confirmed items below. Three original RF deletion claims were
refuted by source evidence.

### RF-01 - Rejected: render queue subsystem is live

- Status: incorrect.
- Current state: `planRenderQueueRecords` is used by batching examples, and
  render queue sort policy/report types are used by app diagnostics.
- Action: do not delete.

### RF-02 - Delete orphan render-package frame taxonomy

- Status: completed 2026-06-06.
- File: `packages/render/src/rendering/render-frame-phases.ts`.
- Problem: public render-package taxonomy is consumed only by its own test.
  WebGPU has the live canonical phase model.
- Action: delete the render-package taxonomy and its test after `DOC-07`
  documents the WebGPU taxonomy as canonical.
- Accept: webgpu render-frame phase tests still pass; render typecheck passes.
- Result: WebGPU now owns `RENDER_FRAME_PHASES` and descriptor metadata; the
  render-package taxonomy and self-only test were removed.

### RF-03 - Split prepared-resource binding cleanup

- Status: completed 2026-06-06.
- Problem: `prepareAndBindSnapshotPreparedResourcesToRenderWorld` is test-only,
  but `createRenderWorldPreparedResourceSummary` is live in app diagnostics.
- Action: delete or relocate the binding orchestrator and its tests. Keep the
  summary path if diagnostics still imports it.
- Accept: `examples/app-diagnostics-scene.js` still builds.
- Result: `@aperture-engine/render` keeps the live
  `createRenderWorldPreparedResourceSummary` and JSON helper public, while the
  combined `prepareAndBindSnapshotPreparedResourcesToRenderWorld` orchestrator
  and `createRenderWorldPreparedResourceSummaryFromReport` adapter moved to
  `@aperture-engine/render/test-support`. The app diagnostics example still uses
  the public summary helper directly.

### RF-04 - Rejected: `mesh-merge` is live

- Status: incorrect.
- Current state: `mergeMeshAssetsForBatch` is used by
  `examples/batching-assets.js` and covered by `test/e2e/mesh-merge.spec.ts`.
- Action: do not delete.

### RF-05 - Rejected: allocating view uniform packer is live

- Status: incorrect.
- Current state: `packSnapshotViewUniforms` is used by raw WebGPU examples.
- Action: do not delete unless those examples are migrated first.

### RF-06 - Delete allocating material queue builder

- Status: completed 2026-06-06.
- File: `packages/render/src/rendering/material-queue.ts`.
- Problem: `buildMaterialQueueFromSnapshot` is public and test-only; live app
  paths use `writeMaterialQueueFromSnapshot`.
- Action: delete or move behind test-support and update tests.
- Accept: material queue tests still cover the writer path; app queueing tests
  pass.
- Result: `writeMaterialQueueFromSnapshot`, material queue scratch, and phase
  summaries remain public. The allocating `buildMaterialQueueFromSnapshot`
  convenience helper moved to `@aperture-engine/render/test-support` for tests.

## Queue Q3 - Confirmed Duplicate Consolidation

Suggested validation: focused tests for each package plus `pnpm run check` after
the whole queue.

### DUP-01 - Centralize quaternion math

- Status: confirmed-open.
- Files: `packages/physics-rapier/src/math.ts`,
  `packages/physics/src/test-backend/math.ts`,
  `packages/physics/src/ecs-sync.ts`,
  `packages/app/src/physics-interpolation.ts`,
  `packages/simulation/src/math/quaternion.ts`.
- Problem: quaternion multiply/normalize/slerp/rotate logic exists in multiple
  copies with divergent zero-length behavior.
- Action: add shared quat ops with a documented policy
  (`length <= 1e-8 -> identity` recommended), then route copies through it.
- Important dependency caveat: `physics-rapier` does not currently depend on
  `simulation`; either add a deliberate dependency or expose shared helpers
  through `@aperture-engine/physics`.
- Accept: local reimplementations are gone or narrowed; physics, Rapier, and
  interpolation tests pass.

### DUP-02 - Consolidate `jsonSafeValue`

- Status: confirmed-open.
- Files: `packages/app/src/systems/json.ts`,
  `packages/app/src/entities/lookup/summary.ts`,
  `packages/app/src/worker/payload.ts`,
  `packages/app/src/diagnostics.ts`,
  `packages/app/src/browser/commands.ts`.
- Problem: same JSON-safe conversion is copied in several app modules.
- Action: create one shared app utility and route all callers through it.
- Accept: no duplicate local implementations remain.

### DUP-03 - Canonicalize example shadow caster helpers only

- Status: needs-refinement.
- Files: `packages/webgpu/src/shadows/render-shadow-frame-caster-meshes.ts`
  plus shadow examples.
- Problem: local example copies remain. The app auto-shadow path is related but
  not a drop-in duplicate because it prepares GPU resources directly.
- Action: make examples use the existing shadow helper where the helper shape
  matches. Do not blindly rewrite `packages/webgpu/src/app/auto-shadow-frame.ts`
  unless a lower-level shared helper is extracted.
- Accept: example copies are gone; shadow examples and E2E specs pass.

### DUP-04 - Delete `TransformResolutionSystem` wrapper

- Status: confirmed-open.
- File: `packages/simulation/src/transform/resolution.ts`.
- Problem: `TransformResolutionSystem`, report key, and getter are not
  registered by production code. Live code calls `resolveWorldTransforms(world)`
  imperatively.
- Action: delete wrapper/report plumbing and its self-only tests.
- Accept: transform, runtime, and physics sync tests pass.

### DUP-05 - Delete render-side material preparation plan factories

- Status: confirmed-open.
- Files: `packages/render/src/materials/debug-normal-preparation.ts`,
  `packages/render/src/materials/matcap-preparation.ts`.
- Problem: render-side factories are test-only; WebGPU material preparation is
  live elsewhere.
- Action: delete factories and tests, or move test value to WebGPU prep tests.
- Accept: matcap/debug-normal WebGPU prep tests and examples pass.

### DUP-06 - Migrate unlit layout to `*Plan` pattern

- Status: confirmed-open.
- Files: `packages/webgpu/src/materials/unlit/unlit-bind-group-layout.ts`,
  `packages/webgpu/src/app/pipeline-layouts.ts`.
- Problem: unlit has a plan helper used only by tests/test-support while live
  code builds inline metadata; sibling materials use plan helpers live.
- Action: use `createUnlitBindGroupLayoutPlan` in the live pipeline-layout path.
- Accept: unlit pipeline layout tests and examples pass.

## Queue Q4 - Physics Follow-Ups

Do not purge the dedicated physics-worker route. Current project state keeps it
as a Rapier transferable proof route while simulation-worker physics remains the
default developer path.

### PHY-01 - Update audit decision text only

- Status: stale-as-written.
- Current state: `docs/DECISIONS.md` records backend-neutral physics contracts
  and keeps a dedicated third physics worker as an advanced/proof route.
- Action: if this remediation doc is committed, keep this queue wording aligned
  with the current decision. Do not write a new ADR that contradicts existing
  physics docs unless the project lead explicitly re-decides.

### PHY-02 - Add high-level physics facade/config

- Status: partially-fixed, still open.
- Files: `packages/app/src/advanced.ts`,
  `packages/app/src/systems/physics.ts`, generated-worker app system patterns.
- Current state: fixed-step integration exists and generated-worker systems can
  install Rapier through `this.fixedStep.register(...)`,
  `stepPhysicsWorld(...)`, and `this.physics.setBackend(...)`. There is no
  high-level `createApertureApp` physics backend/config option.
- Action: add an opt-in physics config/facade that constructs and installs the
  Rapier backend without example-local glue.
- Accept: a non-example app/headless test steps Rapier physics through the
  facade and reproduces settling/joint/character behavior.

### PHY-03 - Rejected unless re-decided: purge worker-transfer protocol

- Status: stale-as-written.
- Current state: worker-transfer protocol is public and used by the supported
  Rapier transferable proof route.
- Action: do not delete. Only trim internal leaks per `DC-06`, `DC-07`, and
  `BH-05`.

### PHY-04 - Wire validators into authoring/spawn

- Status: confirmed-open.
- Files: `packages/physics/src/validation.ts`,
  `packages/app/src/systems/spawn/physics.ts`.
- Problem: validators exist, but authoring/spawn path creates components
  directly without running them. `validatePhysicsCharacterMove` is live in
  devtools and should stay.
- Action: call rigid-body/collider/joint/character-controller validators on real
  app authoring paths and return structured diagnostics for invalid input.
- Accept: tests spawn invalid physics descriptors and observe diagnostics.

### PHY-05 - Add facade seam for asset-backed collider provider

- Status: mostly-fixed low-level, still open high-level.
- Files: `packages/app/src/physics-collider-geometry.ts`,
  `packages/physics/src/backend.ts`,
  `packages/physics-rapier/src/backend.ts`.
- Current state: provider and Rapier cooking work; large-scale example proves
  provider-backed colliders. No high-level app facade option wires it.
- Action: thread a geometry-provider seam through the same high-level physics
  facade/config from `PHY-02`.
- Accept: an app uses asset-backed colliders through the facade without calling
  `createRapierPhysicsBackend(...)` directly.

### PHY-06 - Fold physics quaternion copies into `DUP-01`

- Status: confirmed-open.
- Action: implement as part of `DUP-01`.

### PHY-07 - Rejected unless re-decided: purge physics-worker-mode example

- Status: stale-as-written.
- Current state: `examples/physics-worker-mode.*` and its E2E spec are still the
  supported proof route for transferable dedicated-worker physics.
- Action: do not delete unless the project lead explicitly changes the current
  physics route decision.

### PHY-08 - Docs cleanup for historical Havok references

- Status: code-fixed, docs-partially-stale.
- Current state: packages contain only `physics` and `physics-rapier`; Havok is
  docs-only/historical. Some SOTA roadmap entries still describe removed Havok
  prototype files as current.
- Action: update docs so Havok/Jolt are historical/future candidates only and
  no removed `packages/physics-havok` path is described as current.
- Accept: the package graph has no non-Rapier backend implementation, and docs
  no longer describe removed Havok files as current. A useful verification
  command is:

  ```sh
  rg -ni "physics-havok|createHavok|@babylonjs/havok" packages package.json pnpm-lock.yaml
  ```

## Queue Q5 - Feature Follow-Ups

These are implementation work, not cleanup. Treat each as its own vertical
slice with example/E2E proof.

### FEAT-01 - Finish particle over-lifetime curves

- Status: confirmed-open.
- Files: `packages/render/src/assets/particles.ts`,
  `packages/render/src/rendering/snapshot-packet-types.ts`,
  `packages/webgpu/src/app/particles.ts`,
  `packages/webgpu/src/render/particles/particle-pipeline.ts`,
  `examples/gpu-particles-*`.
- Problem: curves are authored/packed, but snapshot packets and GPU params do
  not carry curve data; WGSL still uses two-point `mix`.
- Action: carry curve LUT data into emitter packets/GPU buffers and sample it in
  WGSL. Update example to show a non-linear size/color curve.
- Accept: gpu-particles E2E proves the curve is visible and no silent fallback
  remains.

### FEAT-02 - Generalize SharedArrayBuffer snapshot producer

- Status: partially-complete.
- Current state: SAB writer exists and `sab-cube.worker.js` uses it; most
  generated/example workers still use `renderSnapshotTransferList`.
- Action: decide whether SAB is default with transfer-list fallback or a
  config-selected transport. Then wire the generic producer route, not just the
  opt-in example.
- Accept: at least one generated-worker or default app route uses SAB end to
  end, with a fallback for non-cross-origin-isolated hosts.

### FEAT-03 - Decide buffer pool by benchmark

- Status: confirmed-open, benchmark-gated.
- Files: `packages/runtime/src/simulation-worker.ts`.
- Problem: pool helpers and protocol fields exist, but live path still uses
  transfer-list and no recycle handler was found.
- Action: benchmark pool vs transfer-list under a high-churn scene. If
  net-positive, wire `bufferLeaseId` and `recycleSnapshotBuffers`; otherwise
  delete the dormant pool/protocol fields and record the benchmark result.
- Accept: either live pooling plus benchmark evidence, or deletion plus recorded
  non-adoption evidence.

### FEAT-04 - No implementation action: specular IBL design changed

- Status: completed-by-accepted-alternate-design.
- Current state: PMREM execution is real and `iblSpecularBrdf` variant selection
  exists. Shader uses analytic `environmentBrdfApprox`, and that deviation is
  recorded in `docs/DECISIONS.md`.
- Action: update stale audit/docs if needed. Do not implement literal BRDF LUT
  sampling unless a new rendering-quality decision supersedes the accepted
  analytic path.

### FEAT-05 - Wire prepared mesh/material cache eviction

- Status: confirmed-open.
- Files: `packages/webgpu/src/resources/meshes/prepared-mesh-cache.ts`,
  `packages/webgpu/src/materials/core/prepared-built-in-material-store.ts`.
- Problem: eviction helpers exist but no app/frame-path caller was found.
- Action: add bounded cache eviction policy and tests that prove resources are
  not evicted while in use.
- Accept: cache size is bounded under asset churn and regression tests pass.

### FEAT-06 - Polish generic equirect environment asset API

- Status: mostly-complete.
- Current state: `ibl-equirect` proves equirect-to-cube compute projection and
  E2E asserts `projection: "equirect-to-cube"` plus specular prefiltering.
  Generic `WebGpuAppEnvironmentAssetInput` still accepts cube sources, not a
  direct equirect source.
- Action: add a generic equirect environment asset input path if product API
  wants it. Otherwise mark the original feature complete and keep the example
  route as proof.
- Accept: app-level environment input can take an equirect source, or docs
  explicitly say equirect projection is example/helper-level for now.

## Queue Q6 - Docs And Tooling

Suggested validation: `pnpm run check:examples`, `pnpm run check:progress`,
`pnpm run format:check`, and targeted scripts added by the queue.

### DOC-01 - Close `check:examples` syntax-gate gap

- Status: completed 2026-06-06.
- File: `package.json`.
- Problem: `check:examples` is hand-maintained and currently omits
  `physics-character-{scene,main,worker}.js` and
  `physics-large-scale-{scene,main,worker}.js`.
- Action: preferably replace the hand-maintained chain with a script that
  enumerates `examples/*.js`; minimum fix is adding the six missing files.
- Accept: every example JS file is syntax-checked.

### DOC-02 - Rewrite stale SOTA "stands today" blockquote

- Status: completed 2026-06-06.
- File: `docs/SOTA_ROADMAP.md`.
- Problem: blockquote still claims missing features that now exist, including
  submitted shadows, KTX2 wiring, populated spatial index, scene serialization,
  physics, particles, text, and UI.
- Action: rewrite to match current state or delete the stale historical
  blockquote if the corrected prose below it is sufficient.
- Accept: no current-state contradiction remains.

### DOC-03 - Mark shipped plan/proposal docs implemented or superseded

- Status: completed 2026-06-06.
- Files: `docs/INPUT_STATE_AND_ACTION_PLAN.md`,
  `docs/DEVELOPER_API_PROPOSAL.md`,
  `docs/CREATE_SYSTEM_DESCRIPTOR_MIGRATION_PLAN.md`.
- Action: add `Status: implemented` or mark superseded, with notes for any
  advanced sub-proposals still unbuilt.
- Accept: shipped docs no longer present implemented systems as plans.

### DOC-04 - Retire stale ACTIVE debug-normal research docs

- Status: completed 2026-06-06.
- Files:
  `docs/research/SUPERSEDED_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`
  and audit sibling.
- Action: rename/drop `ACTIVE_` and mark superseded, or delete if no longer
  useful.
- Accept: no stale active debug-normal plan remains.

### DOC-05 - Add WebXR boundary decision or relax plan gate

- Status: completed 2026-06-06.
- Files: `docs/WEBXR_IMPLEMENTATION_PLAN.md`, `docs/DECISIONS.md`.
- Problem: WebXR plan Phase 0 requires a decision record that does not exist.
- Action: add the WebXR boundary decision to `docs/DECISIONS.md`, or relax the
  Phase 0 acceptance text.
- Accept: WebXR plan and decisions are consistent.

### DOC-06 - Link or generate example gallery

- Status: completed 2026-06-06.
- File: `examples/index.html`.
- Problem: 122 example pages exist; 102 are linked. `render-control` can still
  enumerate unlinked pages, so this is discoverability, not dead code.
- Action: link the 20 missing pages or auto-generate the gallery.
- Accept: gallery covers all examples or documents the exclusion policy.
- Result: linked all current example pages and added `check-example-gallery` to
  keep the gallery in sync with `examples/*.html`.

### DOC-07 - Declare canonical render-frame-phase taxonomy

- Status: completed 2026-06-06.
- Files: `docs/ARCHITECTURE.md`,
  `packages/webgpu/src/render/frame/render-frame-phases.ts`,
  `packages/render/src/rendering/render-frame-phases.ts`.
- Action: document the WebGPU taxonomy as canonical and then execute `RF-02`.
- Accept: only one live taxonomy remains.
- Result: `apply -> prepare -> queue -> resolve -> command -> submit` is the
  canonical WebGPU submitted-frame diagnostics taxonomy.

### DOC-08 - Add plan-doc status convention and freshness check

- Status: completed 2026-06-06.
- Action: add a lightweight status convention such as
  `Status: plan|implemented|superseded`, then add a script or extend
  `check:progress` to catch drift.
- Accept: stale plan docs are mechanically detectable.
- Result: added `docs/DOC_STATUS_CONVENTION.md` and
  `scripts/check-plan-doc-status.mjs`; `pnpm run check:progress` now verifies
  top-level plan/proposal status lines plus explicit active/superseded research
  plan naming.

### DOC-09 - Add dead-code tooling in CI

- Status: completed 2026-06-06.
- Current state: no `knip`, `ts-prune`, `depcheck`, or `check:deadcode` script.
- Action: add `knip` with workspace-aware config. Start non-blocking; promote
  to blocking after Q0-Q3 cleanup.
- Accept: `pnpm run check:deadcode` exists and reports actionable output.
- Result: added `knip`, `knip.json`, `pnpm run check:deadcode`, and a
  non-blocking CI reporting step. The first report surfaces playground files,
  one root dependency, one unlisted binary, and unused exports/types.

## Parked Or Rejected Items

These items should not be implemented from the original audit wording.

| Item    | Current status                | Reason                                                                          |
| ------- | ----------------------------- | ------------------------------------------------------------------------------- |
| BH-02   | Already fixed                 | Listed modules are already test-support only.                                   |
| BH-03   | Already fixed                 | Listed helpers are test-support only; fidelity summaries are live.              |
| RF-01   | Rejected                      | Render queue pieces are live in examples/app diagnostics.                       |
| RF-04   | Rejected                      | Mesh merge is live in batching example and E2E.                                 |
| RF-05   | Rejected                      | Allocating view uniform packer is live in raw WebGPU examples.                  |
| PHY-03  | Rejected/stale                | Dedicated physics worker protocol remains a supported proof route.              |
| PHY-07  | Rejected/stale                | `physics-worker-mode` remains the supported transferable worker proof route.    |
| FEAT-04 | Completed by alternate design | Analytic BRDF path is accepted; do not force LUT sampling without new decision. |

## Non-Actions To Preserve

These were verified as deliberate staging or public test/debug surface. Do not
turn them into cleanup work without a separate decision.

- `packages/simulation/src/spatial/entity-bounds-bvh.ts`: entity-bounds BVH is a
  tracked perf follow-up; current linear query volume is acceptable.
- `packages/physics/src/test-backend/backend.ts`: test backend is correctly
  gated behind the `/testing` subpath.
- `packages/webgpu/src/lighting/ibl-texture-preparation.ts`: deferred branch is
  an intentional readiness diagnostic.
- Skin/morph handles in simulation assets remain API completeness for the
  animation/content path.
- `installApertureSystemContext` and the headless app runner remain documented
  escape hatch/test harness surfaces.

## Appendix - Refined Verification Counts

Approximate executable status after refinement:

| Status                                | Items |
| ------------------------------------- | ----- |
| Completed                             | 30    |
| Confirmed open / executable           | 10    |
| Needs refinement but actionable       | 8     |
| Partially complete / docs-update only | 5     |
| Already fixed, rejected, or stale     | 8     |

The counts are orientation only. Re-run local symbol checks before editing any
specific item.
