# Generic App Adapter Registration Policy Audit

Date: 2026-05-18

Task: `task-1655`

## Scope

Audit app adapter registration policy after the test-only generic adapter
contract proof. This audit does not add public custom material authoring,
runtime adapter options, shaders, GPU resources, examples, or browser fixtures.

Reference files inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_ADAPTER_CONTRACT_PROOF_PLAN_2026_05_18.md`
- `docs/research/GENERIC_APP_ADAPTER_CONTRACT_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/app.ts`

## Generic Registration Pieces

These pieces can remain or become generic without exposing public custom source
material authoring:

- `QueuedMaterialAdapterRegistration` and
  `createQueuedMaterialAdapterRegistry()` already support arbitrary family
  strings and JSON-safe duplicate-family diagnostics.
- `QueuedMaterialPrepareRouteAdapter` can now accept non-public test material
  objects, so adapter registration no longer requires every internal route
  family to be part of the public `MaterialAsset` union.
- `QueuedMaterialAppResourceItem` can carry a typed adapter and material without
  built-in fields.
- `prepareQueuedMaterialFrameResourceSet()` already accepts generic items,
  pipeline results, layout metadata, texture/sampler dependency reports,
  frame-resource options/results, mesh resources, and bind groups.
- The frame-resource route diagnostic helper accepts generic route shells.

These are enough for a generic app adapter registry helper that validates
family registration and duplicate keys without knowing about Unlit, Matcap,
StandardMaterial, or DebugNormalMaterial.

## Built-In Policy Boundaries

These pieces should stay built-in-specific for now:

- `BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES` and
  `validateQueuedBuiltInAppResourceAdapterRegistry()` encode required default
  built-in families and the `queuedBuiltInAppResourceAdapter.missingFamily`
  diagnostic.
- `createQueuedBuiltInAppResourceAdapterRegistrations()` merges built-in route
  adapters with built-in texture/sampler and frame-resource callbacks.
- `collectQueuedBuiltInAppResourceSet()` reads public source material assets
  from the app asset registry and should continue to reject unknown public
  material route families.
- `QueuedBuiltInFrameResources` exposes built-in compatibility arrays for
  existing app/render diagnostics.
- `createWebGpuApp()` owns built-in caches and a singleton default built-in
  adapter registry.

These boundaries preserve the closed public `MaterialKind` union and avoid
pretending a custom material source API exists.

## Generic Versus Built-In Diagnostics

Keep built-in diagnostics:

- Missing required built-in family:
  `queuedBuiltInAppResourceAdapter.missingFamily`.
- Built-in route failures and unsupported public material route families.

Candidate generic diagnostics:

- Duplicate app adapter family can continue to use
  `queuedMaterialAdapter.duplicateFamily`.
- A future generic app adapter registry validation helper can report expected
  families only when a caller supplies an expected-family list. It should not
  imply built-in defaults.
- A future app-owned adapter registration policy should report unknown or
  missing app families as app adapter policy diagnostics, not source material
  validation diagnostics.

## Recommended Next Implementation Slice

Add a generic app adapter registry validation helper and tests.

Suggested task:

### task-1658 — Add generic app adapter registry validation helper

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-adapter.ts` or a focused sibling
module, plus targeted `test/webgpu` coverage.
Reference anchor:
this audit,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`, and
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.

Acceptance criteria:

- Add a generic validation helper that accepts a
  `QueuedMaterialAdapterRegistry` plus optional expected family keys.
- Preserve existing duplicate-family diagnostics.
- Report missing expected family diagnostics without naming built-in policy.
- Add tests for duplicate custom family, missing expected custom family,
  expected built-in family compatibility, and JSON-safe serialization.
- Do not change `createWebGpuApp()`, public source material APIs, shaders, GPU
  resources, examples, or browser fixtures.

## Decision

No decision record is needed before the generic registry validation helper. A
decision record is still required before exposing public custom material source
assets or app-level runtime custom material registration.
