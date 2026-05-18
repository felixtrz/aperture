# Generic material route boundary before non-built-in app migration audit - 2026-05-18

## Scope

Audit the app route boundary before any real non-built-in material adapter
rendering is attempted.

Reference anchors inspected:

- `docs/DECISIONS.md` decision 0010
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-source-assets.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Boundary inventory

Still intentionally built-in-specific:

- Adapter registration policy for Unlit, Matcap, Standard, and DebugNormal.
- Built-in compatibility diagnostics that describe the currently supported app
  material families.
- Type narrowing from generic `MaterialAsset` to the closed built-in source
  material union.

Already family-generic:

- Queue item and routed item report serialization.
- Route report shell, grouped family/phase summaries, and diagnostic
  normalization.
- Queued source asset indexing for mesh/material source assets.
- Queued app resource item/set shape.
- Frame-resource bucket summaries downstream of routed resources.

## Architecture check

Decision 0010 is still respected: arbitrary route family keys are routing
metadata, not public custom source material authoring. A route can diagnose an
unknown family, but that does not make the source material valid or renderable.

The reference engines both keep backend binding/resource preparation behind
renderer-owned systems. Aperture's equivalent should remain explicit adapters
fed by extracted queue items and source assets; custom material authoring needs
a separate source asset, dependency, prepared-resource, pipeline, shader, and
diagnostics contract before app-level rendering.

## Recommended follow-up

Do not start real non-built-in app rendering yet. The next route-boundary
implementation should be a small diagnostics contract, such as a test-only
unknown route family fixture that proves the app route report can explain the
unsupported family without exposing built-in-only fields, app objects, source
assets, or GPU handles.

For the immediate ready queue, the StandardMaterial/glTF occlusion/emissive
dependency gap is higher leverage because it closes real user-facing material
honesty while leaving the route boundary intact.

## Validation

Documentation-only audit; covered by final formatting/check validation.
