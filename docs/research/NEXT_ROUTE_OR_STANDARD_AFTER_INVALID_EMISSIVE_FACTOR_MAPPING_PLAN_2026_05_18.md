# Next Route Or Standard Follow-Up After Invalid Emissive Mapping Coverage

Date: 2026-05-18

Task: `task-1615`

## Context

`task-1612` closed the adjacent valid/invalid mapper-level coverage pair for
glTF `emissiveFactor`. The next slice should move back toward the generic
material route and prepared-resource surface unless a directly adjacent
StandardMaterial defect appears.

## Candidates

### Material Route / Prepared-Resource Candidate

Add a mixed built-in app diagnostics regression that proves the successful
multi-family app path exposes only the generic `routedResourceSet` summary and
does not leak legacy family-specific summary fields.

Pros:

- Keeps pressure on the generic route/prepared-resource contract that should
  replace narrow family-specific app routing.
- Covers the realistic mixed-family success path that includes `unlit`,
  `matcap`, and `standard` items in one frame.
- Stays test-only and low risk while guarding the public JSON surface.

Cons:

- Does not remove the remaining specialized built-in route implementation yet.
- Another field-shape regression is smaller than a production refactor.

Decision: select. It is the safest next route-focused follow-up after the
mapper coverage pair and should be quick to audit.

### StandardMaterial / glTF Fidelity Candidate

Add another mapper or browser fidelity regression after emissive factor, such as
an additional invalid-factor edge case.

Pros:

- StandardMaterial/glTF coverage remains an important proof-point track.

Cons:

- The valid and invalid emissive-factor mapping pair is now covered.
- Continuing on emissive-factor cases would delay the generic route contract
  work called out by the architecture docs.

Decision: defer.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after invalid emissive-factor mapping.

Pros:

- Low risk.

Cons:

- Already handled by `task-1614`.
- Does not advance the route/prepared-resource spine.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1617 — Add mixed-family routed-resource summary field-shape regression

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`, the existing mixed
built-in material app route tests, and recent scalar/route-failure field-shape
regressions.

Acceptance criteria:

- Add a focused assertion to the mixed `unlit`/`matcap`/`standard` app route
  path proving `diagnosticsSummary.routedResourceSet` is present.
- Assert the JSON diagnostics summary does not contain legacy
  `standardResourceSet`, `unlitResourceSet`, or `matcapResourceSet` fields.
- Preserve ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics.
- Do not change browser examples, glTF mapping, adapter policy, binary GLB
  loading, IBL, shadows, or non-built-in material rendering.

## Next Step

Run `task-1616` to audit this selected follow-up before implementation.
