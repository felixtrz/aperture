# GLTF Scene Vertical Slice Architecture Audit

Date: 2026-05-19
Task: `task-1794`
Category: `audit-refactor`

## Scope Audited

- `packages/render/src/assets/gltf-scene-import-contract.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`

## Findings

No architecture blocker found.

- ECS remains authoritative. The GLTF scene fixture authors entities through
  ECS command replay and public app spawn helpers.
- Rendering remains derived from extraction. The WebGPU app consumes the
  extracted snapshot; the example does not pass scene objects directly to the
  renderer.
- There is no central mutable scene graph. The glTF node hierarchy is converted
  into command-plan parent keys and ECS transform components.
- Source assets stay renderer-independent. Mesh/material assets are registered
  in typed asset collections/registry entries; no raw GPU handles are stored in
  ECS components or source assets.
- WebGPU ownership remains backend-side. Environment/IBL and shadow status are
  currently readiness/intent diagnostics; shader sampling and shadow-map passes
  are explicitly deferred.
- The replay bridge now uses stable asset handle keys for `Mesh` and `Material`
  components, matching extraction's expected contract.

## Remaining Gaps

- Environment/IBL readiness currently proves extracted environment packets and
  renderer-side resource-key readiness, not GPU cubemap allocation or shader
  sampling.
- Shadow readiness currently proves directional shadow request extraction and
  JSON-safe status, not shadow-map texture/pass allocation or material shadow
  sampling.
- Binary GLB parsing is still deferred; the fixture is inline glTF-derived scene
  data.
- The scene app does not yet exercise texture-backed GLTF materials and IBL in
  the same frame.

## Recommended Next Work

Start `task-1795`: define the GLTF scene environment/IBL resource descriptor
contract for renderer-owned cubemap/atlas readiness, then wire it into the
scene status without claiming shader IBL sampling is active.
