# Non-Built-In App Material Adapter Decomposition

Date: 2026-05-18

Task: `task-1642`

## Goal

Decompose real non-built-in app material adapter support into safe vertical
slices without activating custom material rendering in this run.

This document intentionally preserves Decision 0010: route family keys may be
registry-driven at queue and adapter boundaries, but source material asset kinds
remain closed until Aperture has a separate public custom material source API
decision.

## Current Constraints

- Source `MaterialAsset.kind` is still the built-in union:
  `unlit | matcap | standard | debug-normal`.
- Generic queue and route helpers can carry arbitrary route family strings.
- The WebGPU app only has backend resource adapters for built-in material
  families.
- Unsupported route family keys must diagnose and produce no routed resources.
- Renderer-owned GPU resources must remain derived from extracted snapshots and
  source/prepared assets, not from ECS-owned GPU state.

## Ordered Slices

### Slice 1 — Design Test-Only Non-Built-In Source Fixture

Category: `docs-tooling` or `webgpu-render` test-only.

Package/write-scope:
`docs/research`, targeted `test/webgpu` fixtures only if implemented.

Purpose:

- Define a test-only material-like source object for adapter-boundary tests
  without adding it to public `MaterialKind`.
- Keep it outside user-facing asset collections and browser examples.

Diagnostics:

- Unsupported public source assets must still report existing unsupported-route
  diagnostics.
- Test-only fixtures may use `testMaterial.*` diagnostic codes but must not
  appear in app/browser status.

Tests:

- Unit tests only.
- Assert the fixture cannot be mistaken for a public `MaterialAsset`.

Non-goals:

- No public custom material API.
- No shader or pipeline rendering.

### Slice 2 — Generic App Adapter Contract Audit

Category: `audit-refactor`.

Package/write-scope:
`docs/research`, `packages/webgpu/src/webgpu/queued-material-adapter.ts`, and
related type tests only if a tiny mismatch is found.

Purpose:

- Audit whether `QueuedMaterialAdapterRegistration`,
  `QueuedMaterialPrepareRouteAdapter`, and app frame-resource callbacks expose
  enough metadata for a non-built-in adapter without depending on built-in
  material arrays.

Diagnostics:

- Duplicate family warnings remain `queuedMaterialAdapter.duplicateFamily`.
- Missing adapter and material mismatch remain prepare-route diagnostics before
  app normalization.

Tests:

- Type-level or unit tests for a test-only adapter registration.

Non-goals:

- No app-level rendering path.
- No public source asset contract.

### Slice 3 — Prepared-Resource Contract Shell For Non-Built-In Families

Category: `webgpu-render`.

Package/write-scope:
Focused WebGPU route/prepared-resource tests and any generic type helpers
needed to describe prepared resource keys.

Purpose:

- Prove a non-built-in family can produce facade and backend resource keys in
  route/frame-resource metadata without drawing.
- Keep the route shell JSON-safe and resource-key-only.

Diagnostics:

- Missing prepared mesh/material keys should produce existing route or
  frame-resource diagnostics with no raw GPU handles.

Tests:

- Unit tests around route shell summaries and generic frame-resource set
  metadata.

Non-goals:

- No shader, bind group, pipeline, or command submission.
- No browser example.

### Slice 4 — Backend Adapter Registration Policy

Category: `webgpu-render`.

Package/write-scope:
`packages/webgpu/src/webgpu` adapter registry helpers and targeted tests.

Purpose:

- Define how an app-owned non-built-in backend adapter would be registered
  alongside built-ins.
- Keep built-in default registration unchanged.

Diagnostics:

- Duplicate family diagnostics must identify first and duplicate adapter
  indexes.
- Missing built-in family validation remains built-in-specific.
- Unknown app adapter failure must not silently fallback to a built-in family.

Tests:

- Unit tests for duplicate custom family, built-in/custom family coexistence,
  and JSON-safe registry reports.

Non-goals:

- No custom source material authoring.
- No rendered pixels.

### Slice 5 — Public Custom Material Source API Decision

Category: `docs-tooling`.

Package/write-scope:
`docs/DECISIONS.md`, architecture docs, and backlog only.

Purpose:

- Decide whether Aperture should expose custom material source assets, how they
  are validated, and how they declare shader/resource dependencies.

Diagnostics:

- Must define source validation diagnostics separately from route diagnostics.

Tests:

- None in the decision slice; follow-up tasks should add source validation
  tests.

Non-goals:

- No implementation before the decision is accepted.

### Slice 6 — Minimal Rendered Custom Family Proof

Category: `webgpu-render`.

Package/write-scope:
Only after slices 1-5. Focused source asset, adapter, prepared resource,
pipeline, shader, and browser fixture files.

Purpose:

- Render one intentionally minimal custom family through the generic app route
  path.

Diagnostics:

- Missing adapter, source mismatch, dependency readiness, pipeline creation,
  frame-resource creation, and app summary diagnostics must all be JSON-safe.

Tests:

- Unit route tests.
- Focused browser test proving pixels and diagnostics.

Non-goals:

- No shader graph.
- No arbitrary user WGSL injection.
- No PBR custom material family.

## Recommended Next Slice

Start with Slice 2: a generic app adapter contract audit.

Reason:

- Slice 1 can stay implicit as a test fixture unless the audit finds a type
  blocker.
- Slice 2 can identify whether the current generic adapter contracts are
  already sufficient or whether a small type/test cleanup is needed before
  designing public custom material source assets.
- It keeps Decision 0010 intact and avoids pretending route-family strings are
  already public custom material authoring.
