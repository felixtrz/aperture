# Agent Handoff

Updated: 2026-05-19T17:32:15Z

## Current Run Update — 2026-05-19T17:32:15Z — Protocol rewrite accepted, continuing task-2001

This automation run initially paused before implementation because the working
tree already had agent/protocol changes at startup. The user then explicitly
confirmed that if the agent is good with a change, it should commit the change
and keep working instead of waiting.

The required startup safety check found `agent/STATUS.json` in `idle` state with
no active PID, but the working tree already had uncommitted changes before this
agent made implementation edits:

- `AGENTS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `agent/STOP_CONDITIONS.md`
- `agent/WAKE.md`

The diff appears to be the visible-feature protocol and MVP-track backlog
rewrite described by the prior handoff. It is now being treated as intentional
agent-bookkeeping work and checkpointed before continuing implementation.

### References inspected

- No external engine reference files were inspected before this checkpoint.
  `task-2001` still needs the IBL reference reads before implementation.

### Validation

- Startup context and safety files were read.
- `git status --short` showed the dirty tree listed above.

### Recommended next task

Start `task-2001 — Render diffuse IBL on the spinning-cube example` and first
inspect:

- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

## Current Run Update — 2026-05-19T15:30:00Z — Direction shift to MVP-visible work

The agent protocol has been rewritten to prioritize visible-feature work and suppress ceremony (plans, audits, tracker-alignment, JSON-only status proofs). The 55-minute work window is preserved.

### What changed in protocol

- `agent/WAKE.md` §3 — task definition tightened to "vertical slice ending in user-visible change." Early-finish behavior is now "extend the same slice," not "start a new ceremonial task." Never start `plan-X`/`audit-X`/`tracker-alignment-X` to fill leftover time.
- `agent/WAKE.md` §4 — Reference Anchor strengthened: reading the analogous Bevy / PlayCanvas (`references/engine`) / three.js implementation is now a hard precondition for any shader, pipeline, render-graph, asset-loading, lighting, shadow, or material slice. Every visible-feature task entry must include a `Reference anchor:` line. Each run's handoff entry must include a `References inspected:` subsection.
- `agent/WAKE.md` §7 — periodic audit cadence dropped. Audits are now demand-driven and folded into the implementing slice. The standing audit is the test suite (`check:boundaries`, `typecheck`, `lint`, `vitest`, `playwright`).
- `agent/WAKE.md` §9 — backlog refill must keep ≥3 visible-feature tasks, ≤1 plan, ≤1 audit, 0 tracker-alignment. Acceptance-criteria template defines visible vs diagnostic. Every visible-feature task must cite a reference. If 3 visible-feature tasks cannot be identified, stop and document the gap rather than fill with diagnostic work.
- `AGENTS.md` Backlog Expansion Protocol — now defers to `WAKE.md` §9 with a one-page summary. Good Task Shape rewritten with concrete IBL/GLB/runtime examples; Bad Task Shape now lists "Plan next X" and "Audit X" explicitly.
- `agent/STOP_CONDITIONS.md` line 18 — narrowed to ban ceremony-as-filler; stop early if no visible-feature slice can be identified within 5 minutes of inspection.
- `agent/BACKLOG.md` — Strategic Focus replaced with MVP renderer scope (IBL, real GLB loading, multi-light + PCF shadow path). Ceremony tasks 1784, 1785, 1786, 1787, 1788, 1976, 1977, 1978, 1979 marked superseded and removed from the ready queue. 14 new visible-feature MVP-track tasks added (task-2001 through task-2014), each citing specific reference files.

### What landed in this run (real code, currently uncommitted)

- `applyGltfEcsCommandPlanToApp` runtime facade in `packages/runtime/src/index.ts`.
- No-fetch GLB source-loader output summary in `packages/render/src/assets/glb-source-loader-output-summary.ts`.
- Report-only replay-readiness preflight in `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`.
- Visible buffer-backed GLB primitive replay in `examples/gltf-scene.js` (4 mesh draws confirmed via Playwright). This completes `task-1975`.
- 11 research markdown docs in `docs/research/` from the recent plan/audit cycle. These are the **last batch** of that shape; future runs will not produce standalone planning/audit markdown.

### Validation already run for in-flight work

- `pnpm exec vitest run test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts test/runtime/runtime.test.ts`
- `pnpm exec tsc -p packages/render/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`
- `pnpm run check:progress`, `pnpm run format:check`

### Recommended next task

**`task-2001`** — Render diffuse IBL on the spinning-cube example. See `agent/BACKLOG.md` under "Strategic Focus — MVP Renderer" for the full track.

The IBL infrastructure (descriptors, bind groups, shader variants) is already built in `packages/webgpu/src/`. Only shader wiring, pipeline-key extension, and bind-group routing remain.

### Known follow-ups under the new MVP composition

- IBL track: task-2001 → task-2002 → task-2003 → task-2004
- GLB-loading track: task-2005 → task-2006 → task-2007 → task-2008 → task-2009
- Shadow track: task-2010 → task-2011 → task-2012 → task-2013 → task-2014

### References inspected during this run (per the new §4 requirement)

- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/extensions/mod.rs`
- `references/bevy/crates/bevy_gltf/src/lib.rs`

For task-2001, the agent MUST first read:
- `references/three.js/src/extras/PMREMGenerator.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/reflectionEnv.js`
- `references/engine/src/scene/graphics/reproject-texture.js`

## Summary

Completed `task-1953` through `task-1975` in this run.

This run advanced the GLB/glTF ingestion spine from report-only source status to
controlled runtime replay and browser render-path readbacks:

- Added compact no-fetch ECS command-plan output summaries.
- Added report-only ECS replay-readiness summaries.
- Added `applyGltfEcsCommandPlanToApp(...)` as the explicit runtime facade for
  applying glTF ECS command plans to an app world.
- Routed the browser GLTF scene's main replay through that runtime facade.
- Added buffer-backed GLB command-plan and replay-readiness status to the
  browser scene.
- Replayed one buffer-backed GLB-derived primitive into ECS in the browser scene
  and asserted four extracted mesh draws, four WebGPU draw calls, and four
  active render-world draws.

The `task-1975` browser proof is currently readback/status-based rather than an
isolated pixel proof. The buffer-backed mesh and proof material are prepared and
included in the WebGPU render route, but the placement/material mapping still
needs a follow-up audit/planning slice before treating it as final visual
fidelity.

## Reference Anchors Inspected

- Project docs: `docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`.
- Existing GLTF browser example and e2e route:
  `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`.
- Existing GLB/source-loader and ECS replay helpers under
  `packages/render/src/assets`.
- Runtime facade patterns in `packages/runtime/src/index.ts`.
- Local Bevy reference was used conceptually for the runtime-orchestration
  boundary: source/import produces data, runtime/app orchestration applies ECS
  commands, and rendering remains derived from extraction.

## Files Touched

Primary implementation:

- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`
- `packages/render/src/assets/index.ts`
- `packages/runtime/src/index.ts`
- `examples/gltf-scene.js`

Tests:

- `test/assets/glb-source-loader-output-summary.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `test/assets/glb-buffer-fixture.test.ts`
- `test/assets/gltf-ecs-command-replay-readiness.test.ts`
- `test/runtime/runtime.test.ts`
- `test/e2e/gltf-scene.spec.ts`

Docs/bookkeeping:

- `examples/gltf-scene-source-status.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`
- `docs/research/ECS_COMMAND_PLAN_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`
- `docs/research/ECS_REPLAY_READINESS_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`
- `docs/research/CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_AUDIT_2026_05_19.md`
- `docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`
- `docs/research/BROWSER_RUNTIME_REPLAY_FACADE_ADOPTION_AUDIT_2026_05_19.md`
- `docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_PLAN_2026_05_19.md`
- `docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_AUDIT_2026_05_19.md`
- `docs/research/FIRST_VISIBLE_BUFFER_BACKED_GLB_PRIMITIVE_REPLAY_PLAN_2026_05_19.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

- Stop hook full validation passed and checkpointed/pushed commit `9049476`.
- `pnpm exec vitest run test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec vitest run test/assets/gltf-ecs-command-replay-readiness.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec vitest run test/runtime/runtime.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts`
- `pnpm exec tsc -p packages/render/tsconfig.json --noEmit`
- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `node --check examples/gltf-scene.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`
- `pnpm exec vitest run test/assets/glb-buffer-fixture.test.ts test/assets/glb-source-loader-output-summary.test.ts test/assets/glb-source-loader-facade.test.ts test/assets/gltf-ecs-command-replay-readiness.test.ts`
- `pnpm run check:progress`
- `pnpm run format:check`

## Known Issues

- Buffer-backed GLB visible replay is proven through browser status and
  render-path readbacks, not through an isolated pixel region yet.
- The visible buffer-backed primitive uses an explicitly registered proof
  material. Source-driven GLB material mapping for that primitive remains
  deferred.
- External GLB loading/fetching remains deferred; current source-loader work is
  no-fetch and caller-provided bytes only.
- Source-loader output remains report-only by design; it does not mutate asset
  registries or ECS worlds.
- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.

## Recommended Next Task

Start with `task-1976 — Audit visible buffer-backed GLB primitive replay proof`.

Focus the audit on:

- ECS remains the authority and WebGPU only consumes extracted/render-world data.
- Source loading remains separate from replay execution.
- The readback-based browser proof is honest about the missing isolated pixel.
- The next implementation slice should plan source-driven material mapping for
  the buffer-backed primitive rather than broad GLB viewer behavior.
