# Browser Runtime Replay Facade Adoption Audit - 2026-05-19

## Scope

Audited browser GLTF scene replay routing after `task-1969`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`
- `packages/runtime/src/index.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

- The browser GLTF scene now calls `applyGltfEcsCommandPlanToApp(...)` for ECS
  command replay.
- Browser status publishes `gltf.replay.source: "runtime-facade"` with replay
  validity, created count, applied component count, and diagnostic count.
- Playwright asserts the runtime-facade status and existing visible scene pixels
  continue to pass.
- The no-fetch source-loader facade remains report-only.

## Architecture Check

- ECS mutation happens through runtime/app orchestration.
- Source loading still only produces source status, output summaries, and
  reports.
- Rendering remains derived from ECS extraction through the WebGPU app path.
- WebGPU code still owns only GPU resources and command submission.
- No scene graph API or external file loading path was introduced.

## Recommendation

Next task: `task-1971`, plan a buffer-backed GLB command-plan browser status
proof. Keep the next slice status-first unless the plan selects a very narrow
visible geometry proof with explicit Playwright pixel expectations.
