# Queued Source Asset Index Helper Extraction Audit - 2026-05-18

## Scope

Audit the queued source asset index helper extraction.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-source-assets.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-source-assets.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

The extraction matches the selected scope. `queued-source-assets.ts` now owns
generic source mesh/material asset indexing for WebGPU app route collection:

- `QueuedSourceMeshAsset`
- `QueuedSourceMaterialAsset`
- `indexQueuedSourceAssets()`

The built-in collector now imports those contracts and helper. It still owns
adapter lookup, route traversal, built-in compatibility diagnostics, and app
resource item creation.

Focused coverage verifies that the helper:

- indexes ready mesh/material assets once even when repeated by multiple draw
  packets;
- produces versioned source resource keys;
- clears stale output maps before indexing;
- skips missing, loading, and failed source assets.

## Architecture Check

- ECS authority is unchanged; the helper reads the asset registry and extracted
  render snapshot only.
- Render extraction remains the boundary; no renderer-owned state moves into
  ECS or source assets.
- WebGPU resources remain backend-owned; the helper only produces source asset
  metadata and versioned cache keys.
- Built-in adapter policy and non-built-in app rendering remain deferred.

## Validation

- `pnpm exec vitest run test/webgpu/queued-source-assets.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should decide
whether to continue route collector cleanup or return to StandardMaterial/glTF
fidelity now that the obvious generic helper seams have been extracted.
