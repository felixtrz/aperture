# Next Route-Boundary Or StandardMaterial Fidelity Plan

Date: 2026-05-18

## Scope

Compare one route-boundary candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after the route-key summary and
multiple optional extension warning slices.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/MULTIPLE_OPTIONAL_EXTENSION_WARNING_STATUS_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Route-Boundary Candidate

Start a real app-level non-built-in material adapter route prerequisite.

Pros:

- Moves toward Decision 0010's registry-driven route-family direction.

Risks:

- A meaningful slice needs source material assets, prepared-resource contracts,
  adapter registration, and app diagnostics. That is larger than the next safe
  task unless it is first decomposed further.

### StandardMaterial / glTF Fidelity Candidate

Add a browser diagnostic fixture for invalid numeric StandardMaterial scalar
factors, such as a malformed `pbrMetallicRoughness.metallicFactor` or
`roughnessFactor`.

Pros:

- Exercises existing `mapFiniteNumber()` validation in a user-facing browser
  status path.
- Preserves JSON-safe `field` and `value` diagnostics for malformed glTF
  material data.
- Stays narrow: example fixture plus Playwright status coverage unless a mapper
  bridge field is missing.

Risks:

- It is diagnostic fidelity rather than new PBR rendering capability.

### Diagnostics / Tooling Candidate

Add a small route/glTF diagnostic summary helper or public tracker refinement.

Pros:

- Improves agent readability.

Risks:

- Recent work already strengthened route summaries and tracker freshness. The
  next step should return to a concrete browser behavior.

## Selected Follow-Up

Select a new task:

### Add Invalid glTF Material Scalar Factor Browser Diagnostic

Category: `render-bridge`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts` only if the invalid scalar
  diagnostic field/value is not preserved into app status

Reference anchor:

- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Acceptance criteria:

- Add a browser fixture with an invalid numeric StandardMaterial scalar factor.
- Assert asset mapping fails before registration/rendering and no GPU resources
  or draw submissions are produced.
- Assert status includes `gltfMaterial.invalidField` with JSON-safe `field` and
  `value` data for the malformed scalar.
- Do not add new material rendering behavior, binary GLB loading, IBL, shadows,
  or GLB viewer behavior.

## Deferred

- App-level non-built-in material adapter routing still needs a smaller
  prerequisite plan before implementation.
- Broader StandardMaterial PBR resources remain deferred behind narrow,
  validated glTF fidelity slices.
