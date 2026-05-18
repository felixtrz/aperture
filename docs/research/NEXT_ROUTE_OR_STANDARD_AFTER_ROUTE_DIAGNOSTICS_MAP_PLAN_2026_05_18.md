# Next Route Or Standard Follow-Up After Route Diagnostics Map

Date: 2026-05-18

Task: `task-1640`

## Context

`task-1637` mapped the current material route diagnostics layers and called out
real non-built-in app material adapter support as the meaningful route milestone
that remains too broad for one implementation. The next slice should decompose
that milestone without activating custom material rendering.

## Candidates

### Route / Prepared-Resource Design Candidate

Decompose real non-built-in app material adapter support into small vertical
slices.

Pros:

- Directly addresses the remaining route architecture milestone without trying
  to implement it all.
- Can define the source asset, adapter registration, prepared-resource,
  diagnostics, and browser proof boundaries needed before runtime work starts.
- Keeps implementation future-safe by staying design-only.

Cons:

- No runtime behavior changes.
- Needs to be concrete enough to refill actionable backlog tasks later.

Decision: select. This is the right next route step after the diagnostics map.

### StandardMaterial / glTF Fidelity Candidate

Add a browser proof for metallic/roughness scalar factors multiplied by
`metallicRoughnessTexture`.

Pros:

- Continues glTF PBR fidelity after the base-color factor tint proof.

Cons:

- Visual assertions are more lighting-sensitive than the base-color tint proof.
- The route map now points to a concrete architecture planning gap that should
  be handled before more fidelity fixtures.

Decision: defer.

### Diagnostics / Tooling Candidate

Move the route diagnostics map into public docs.

Pros:

- Helps users inspect route diagnostics.

Cons:

- The map is still agent/research-oriented and should not become public API
  documentation before non-built-in support is decomposed.

Decision: defer.

## Selected Follow-Up

### task-1642 — Decompose non-built-in app material adapter support

Category: `docs-tooling`
Package/write-scope:
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
and backlog only.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/DECISIONS.md`,
`docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`, and
`packages/render/src/materials/types.ts`.

Acceptance criteria:

- Break real non-built-in app material adapter support into small ordered
  vertical slices.
- For each slice, identify package/write-scope, required diagnostics, tests,
  and explicit non-goals.
- Preserve closed source material asset kinds until a separate public custom
  material source API decision exists.
- Do not add runtime code, public APIs, shader code, examples, or browser
  fixtures.

## Next Step

Run `task-1641` to audit this decomposition follow-up before writing it.
