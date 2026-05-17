# Stable Material Queue Ordering Plan - 2026-05-17

## Scope

Plan the next small step for deterministic material queue ordering.

This is a planning slice only. It does not change queue behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/render-queue.ts`
- `test/rendering/material-queue.test.ts`
- `references/bevy/crates/bevy_render/src/lib.rs`
- `references/bevy/crates/bevy_pbr/src/transmission/phase.rs`

## Current State

`material-queue.ts` already contains:

- `MaterialQueueItemSortKey`;
- `sortMaterialQueueItems()`;
- `compareMaterialQueueItems()`.

The queue writer sorts after collecting items from the snapshot. Opaque-like
items sort by phase, view, layer, order, pipeline key, material resource key,
mesh resource key, depth, stable id, and draw index. Transparent items sort by
phase/view/layer/order, reverse depth, stable id, and draw index.

This is already a stable deterministic ordering path for the current queue
model.

## Gap

The behavior is implemented, but the next useful slice is focused regression
coverage that makes the ordering contract explicit:

- opaque items group by pipeline/material/mesh before depth;
- transparent items sort back-to-front before stable id;
- equal keys preserve deterministic order through `drawIndex`;
- sorting mutates only the caller-provided queue item array, not the source
  snapshot.

## Proposed Follow-Up

Keep `sortMaterialQueueItems()` as the implementation surface. Do not add a new
helper unless tests reveal a naming or API gap.

Add tests in `test/rendering/material-queue.test.ts` covering:

1. mixed opaque items with different pipeline/material/mesh resource keys;
2. transparent items with different depths;
3. equal sort keys falling back to `drawIndex`;
4. source `RenderSnapshot.meshDraws` remaining unchanged after queue writing.

## Bevy Anchor

Bevy separates queuing into phase items and sorts phases as a distinct render
stage. Aperture's material queue follows the same direction at a smaller scale:
the queue derives from snapshots and prepared resource keys, then sorts derived
items without mutating ECS or snapshot state.

## Result

Proceed with `task-0922` as a test-strengthening slice for the existing
ordering helper rather than a new implementation from scratch.
