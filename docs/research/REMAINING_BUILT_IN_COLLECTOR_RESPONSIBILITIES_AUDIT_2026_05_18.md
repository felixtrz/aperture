# Remaining Built-In Collector Responsibilities Audit - 2026-05-18

## Scope

Classify remaining responsibilities in `queued-built-in-app-resource-set.ts`
after generic route-report diagnostic assembly and diagnostic normalization were
extracted.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Classification

Built-in compatibility responsibilities:

- `QueuedBuiltInAppResourceItem` / `QueuedBuiltInAppResourceSet` aliases remain
  acceptable compatibility names over the generic item/set contracts.
- `QueuedBuiltInMaterialAdapter` and the built-in adapter registry remain
  necessary while only built-in material families have app-level rendering
  resources.
- `queuedPrepareRouteDiagnosticToAppDiagnostic()` should stay local because its
  supported-family message is intentionally built-in-specific.

Generic extraction candidates:

- `QueuedSourceMeshAsset`, `QueuedSourceMaterialAsset`, and
  `indexQueuedSourceAssets()` are generic in practice. They index ready source
  mesh/material assets from an `AssetRegistry` and `RenderSnapshot` before route
  preparation. Future non-built-in app route collectors would need the same
  source-asset lookup behavior.
- The main queue traversal in `collectQueuedBuiltInAppResourceSet()` is partly
  generic, but it still coordinates built-in adapter validation, built-in
  compatibility diagnostics, and app resource item creation. Extracting it now
  would be a broad collector rewrite.
- `createSingleQueuedBuiltInAppResourceItem()` still depends on built-in app
  adapter typing and is not the next useful generic seam.

Deferred until real non-built-in app rendering:

- Generic app-level material adapter resource creation.
- Non-built-in family support messages and app route failure policy.
- A generic collector that owns queue traversal, adapter lookup, and app
  resource item creation.

## Recommendation

Select one small implementation follow-up: extract the generic queued source
asset indexing helper and its source asset interfaces from
`queued-built-in-app-resource-set.ts`.

This is narrow enough for one run, gives future app route collectors a reusable
source-asset lookup surface, and avoids rewriting route traversal or built-in
compatibility diagnostics. If that extraction exposes more collector coupling,
stop there and audit before moving more logic.

Proposed task:

```md
### task-1506 — Extract generic queued source asset index helper

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-source-assets.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Move generic queued source mesh/material asset interfaces and source asset
  indexing into a reusable WebGPU app route helper.
- Route the built-in collector through the helper without changing collector
  result shape or diagnostics.
- Add focused tests for ready, missing/loading, duplicate, and versioned mesh
  and material source asset indexing.
- Do not move built-in adapter policy, route traversal, compatibility
  diagnostics, or app-level non-built-in rendering.
```

## Validation

Documentation-only audit; covered by final formatting and progress checks.
