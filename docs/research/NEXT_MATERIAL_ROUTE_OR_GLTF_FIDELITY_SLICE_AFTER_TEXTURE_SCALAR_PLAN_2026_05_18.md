# Next Material Route Or glTF Fidelity Slice After Texture Scalar Plan

Date: 2026-05-18

## Scope

Plan the next focused follow-up after invalid glTF material scalar-factor and
texture scalar-field browser diagnostics.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_TEXTURE_SCALAR_AUDIT_2026_05_18.md`
- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Candidates

### Route / Prepared-Resource Candidate

Start a small implementation slice for generic material-family frame-resource
adapter migration.

Pros:

- Directly advances the material architecture spine described in the medium-term
  goals.
- Builds on the existing generic app route item and test-only route family
  coverage.

Risks:

- The remaining useful migration is no longer a tiny diagnostic-only step. It
  touches app-owned frame-resource preparation, built-in adapter wrappers, and
  hot-path allocation constraints.
- A rushed partial migration would be more likely to create broad unfinished
  scaffolding than to produce a coherent vertical slice.

### StandardMaterial / glTF Fidelity Candidate

Add a browser diagnostic fixture for an invalid glTF vector/color factor, such
as `pbrMetallicRoughness.baseColorFactor` with the wrong tuple length or
non-number entries.

Pros:

- Covers a different glTF source-data shape than scalar fields while reusing the
  existing material mapper and browser expected-failure path.
- Keeps source material validation renderer-independent and verifies invalid
  data still stops before registration, resource creation, pipelines, and draw
  submission.
- Provides concrete coverage for one of the core StandardMaterial glTF inputs
  before returning to broader route migration.

Risks:

- It is another diagnostics/fidelity slice and does not add rendered PBR
  features or route architecture.

### Diagnostics / Tooling Candidate

Add aggregation for repeated glTF mapping diagnostics in example status.

Pros:

- Could make app status easier for agents to scan after multiple invalid fields.

Risks:

- Current browser status already preserves detailed diagnostic arrays and
  existing route/material summaries. Aggregation would be useful later, but less
  valuable than pinning another source-data validation path.

## Selected Follow-Up

Select a new task:

### Add Invalid glTF Vector Factor Browser Diagnostic

Category: `render-bridge`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts` only if the vector factor
  diagnostic field/value is not preserved into app status

Reference anchor:

- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Acceptance criteria:

- Add a browser fixture with an invalid glTF vector/color field such as
  `pbrMetallicRoughness.baseColorFactor`.
- Assert asset mapping fails before material registration/rendering and no GPU
  resources, pipelines, or draw submissions are produced.
- Assert status includes `gltfMaterial.invalidField` with JSON-safe `field` and
  `value` data for the malformed vector/color factor.
- Do not add app-level non-built-in rendering, binary GLB loading, IBL, shadows,
  GLB viewer behavior, or new material rendering behavior.

## Deferred

- Generic material-family frame-resource adapter migration remains the right
  route/prepared-resource direction, but it should be selected only when the
  implementation task can stay coherent across app-owned callbacks,
  adapter-owned resource creation, JSON-safe route summaries, and hot-path
  scratch reuse.
- Diagnostic aggregation can wait until a concrete multi-diagnostic browser
  scenario needs a summary.
