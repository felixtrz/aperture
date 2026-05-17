# Stable Material Queue Ordering Boundary Audit - 2026-05-17

## Scope

Audit stable material queue ordering after adding explicit snapshot immutability
coverage.

The goal is to verify that queue sorting remains a derived render-stage
operation and does not mutate ECS/source state or `RenderSnapshot`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/research/STABLE_MATERIAL_QUEUE_ORDERING_PLAN_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/render-queue.ts`
- `test/rendering/material-queue.test.ts`
- `references/bevy/crates/bevy_render/src/lib.rs`
- `references/bevy/crates/bevy_pbr/src/transmission/phase.rs`

## Findings

### Sorting applies to derived queue items

`writeMaterialQueueFromSnapshot()` reads `RenderSnapshot.meshDraws`, writes
derived `MaterialQueueItem` objects into caller-owned scratch storage, and sorts
that derived item array.

It does not sort or rewrite `RenderSnapshot.meshDraws`.

### Deterministic tie-breakers are explicit

Opaque-like items sort by phase, view, layer, order, pipeline key, material
resource key, mesh resource key, depth, stable id, and draw index.

Transparent items sort after opaque and alpha-test phases, then back-to-front
by depth, stable id, and draw index.

The final `drawIndex` tie-breaker makes equal-key ordering deterministic even
if the JavaScript engine's sort stability were not relied upon.

### Snapshot immutability is covered

Focused tests now assert that queue sorting changes derived queue item order
without adding `meshResourceKey` or `materialResourceKey` fields to source draw
packets.

### ECS/render ownership remains aligned

The queue writer consumes snapshots and prepared resource key resolvers. It
does not access or mutate ECS worlds, source assets, WebGPU resources, or
render-world object ownership.

This keeps queue sorting in the render bridge as a derived stage.

## Result

No ownership drift found.

The remaining ready tasks can plan queued draw package diagnostics and hot-path
report allocation audits, but no further queue-ordering corrective work is
needed from this audit.
