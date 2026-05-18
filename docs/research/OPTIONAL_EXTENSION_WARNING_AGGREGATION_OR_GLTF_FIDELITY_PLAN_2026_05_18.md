# Optional Extension Warning Aggregation Or glTF Fidelity Plan

Date: 2026-05-18

## Scope

Compare the next narrow follow-up after route-key diagnostic summaries and the
single unsupported optional glTF material-extension warning fixture.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Optional-Extension Warning Aggregation

Add browser coverage for a material with multiple unsupported optional material
extensions, proving the status reports every warning while still rendering the
base StandardMaterial path.

Pros:

- Exercises an existing mapper behavior: `inspectMaterialExtensions()` emits one
  warning per unsupported optional extension.
- Improves agent-facing status for real glTF files that often carry several
  optional material extensions.
- Should be a browser fixture/test-only slice unless status mapping drops a
  field.

Risks:

- It remains diagnostic fidelity, not new rendering capability.

### Another glTF Fidelity Diagnostic

Add a new narrow invalid field or texture-info browser fixture.

Pros:

- Keeps strengthening StandardMaterial/glTF input validation.
- Fits the current browser fixture pattern.

Risks:

- Recent runs already added several glTF validation fixtures. The optional
  extension path now has exactly one warning case and benefits from aggregation
  coverage first.

### Route-Boundary Candidate

Move toward real non-built-in route adapters or public material-family registry
shape.

Pros:

- Advances the generic route-family direction from Decision 0010.

Risks:

- A real adapter slice needs source asset and prepared-resource contracts. That
  is larger than the next focused follow-up should be.

## Selected Follow-Up

Select a new task:

### Add Multiple Optional glTF Material-Extension Warning Status

Category: `render-bridge`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts` only if warning fields are
  not preserved into app status

Reference anchor:

- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Acceptance criteria:

- Add a browser fixture with at least two unsupported optional glTF material
  extensions.
- Assert the scenario renders the base StandardMaterial path successfully.
- Assert status includes one `gltfMaterial.unsupportedOptionalExtension` warning
  per extension with JSON-safe `extensionName` and `field` values.
- Do not add support for clearcoat, transmission, sheen, IBL, shadows, binary
  GLB loading, or GLB viewer behavior.

## Deferred

- Optional-extension warning aggregation beyond material-level warnings can wait
  until more glTF warning sources need grouping.
- Real non-built-in route adapter rendering remains deferred until source asset
  and prepared-resource contracts are selected.
