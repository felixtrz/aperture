# Next Route Or Standard Follow-Up After Emissive-Factor Coverage

Date: 2026-05-18

Task: `task-1595`

## Context

`task-1592` added a browser-visible StandardMaterial/glTF proof for
`emissiveFactor` without `emissiveTexture`. Since the last completed slice was
a material fidelity fixture, the next follow-up should give route and
prepared-resource cleanup serious weight.

## Candidates

### Material Route / Prepared-Resource Candidate

Add an app-level scalar StandardMaterial route regression proving the successful
route report uses the generic `routedResourceSet` field and does not add a
family-specific `standardResourceSet` field.

Pros:

- Advances the route contract without changing route traversal or app
  orchestration.
- Pins the public app report shape for a real StandardMaterial route, not only
  the lower-level diagnostics summary helper.
- Small and testable inside the existing scalar StandardMaterial app route test.

Cons:

- It is a regression assertion rather than a new runtime behavior.
- It does not unlock real non-built-in material routing by itself.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another small browser fixture around a remaining glTF material factor.

Pros:

- Continues closing material fidelity gaps.

Cons:

- The previous task just added a browser fixture.
- Another fixture would not address the route-shape risk called out in the
  current tracker/backlog guidance.

Decision: defer.

### Diagnostics / Tooling Candidate

Add only tracker/backlog cleanup after emissive-factor coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1594`.
- Does not improve runtime contracts or coverage.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1597 — Pin scalar StandardMaterial app route summary field shape

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`,
and the existing scalar StandardMaterial app route test.

Acceptance criteria:

- Extend the scalar StandardMaterial app route report test to assert successful
  app diagnostics use `routedResourceSet`.
- Assert the serialized app report does not expose `standardResourceSet`,
  `unlitResourceSet`, or `matcapResourceSet` fields.
- Do not change app report JSON shape, route traversal, prepared resources,
  shader behavior, binary GLB loading, IBL, shadows, or non-built-in material
  rendering.

## Next Step

Run `task-1596` to audit this selected follow-up before implementation.
