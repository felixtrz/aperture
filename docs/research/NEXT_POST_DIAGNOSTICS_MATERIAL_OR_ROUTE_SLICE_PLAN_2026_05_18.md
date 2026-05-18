# Next Post-Diagnostics Material Or Route Slice Plan

Date: 2026-05-18

## Scope

Compare the next candidate after invalid material scalar diagnostics and recent
route-family diagnostic hardening.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/INVALID_GLTF_MATERIAL_SCALAR_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates

### Material Fidelity Candidate

Add a browser diagnostic fixture for an invalid glTF texture scalar, such as
`occlusionTexture.strength` or `normalTexture.scale`.

Pros:

- Reuses existing material mapper validation while covering texture-specific
  scalar fields rather than only top-level PBR factors.
- Keeps the next implementation narrow and browser-visible.
- Preserves the current StandardMaterial/glTF fidelity track.

Risks:

- It is another diagnostic slice and does not add new rendered PBR behavior.

### Route / Prepared-Resource Candidate

Start decomposing real non-built-in material adapter routing into a source asset
and prepared-resource contract plan.

Pros:

- Moves toward the medium-term material-family direction.

Risks:

- It is still larger than a safe implementation task. The recent route-key work
  established diagnostics boundaries but not the source/prepared adapter shape.

### Diagnostics / Tooling Candidate

Add summary aggregation for repeated glTF mapping diagnostics.

Pros:

- Could make agent-facing status easier to scan.

Risks:

- Current status already preserves actionable details. A concrete browser
  diagnostic fixture is more valuable next.

## Selected Follow-Up

Select a new task:

### Add Invalid glTF Texture Scalar Browser Diagnostic

Category: `render-bridge`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts` only if the invalid texture
  scalar diagnostic field/value is not preserved into app status

Reference anchor:

- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Acceptance criteria:

- Add a browser fixture with an invalid texture scalar field such as
  `occlusionTexture.strength` or `normalTexture.scale`.
- Assert asset mapping fails before registration/rendering and no GPU resources
  or draw submissions are produced.
- Assert status includes `gltfMaterial.invalidField` with JSON-safe `field` and
  `value` data for the malformed texture scalar.
- Do not add new material rendering behavior, binary GLB loading, IBL, shadows,
  or GLB viewer behavior.

## Deferred

- Real non-built-in route adapter work still needs a focused source/prepared
  contract plan before implementation.
- Rendered PBR feature expansion should remain behind narrow verified material
  mapping and resource-readiness slices.
