# Next Route Or Standard Follow-Up After Scalar Route Shape Coverage

Date: 2026-05-18

Task: `task-1600`

## Context

`task-1597` pinned successful scalar StandardMaterial app reports to the generic
`routedResourceSet` diagnostics summary shape and explicitly rejected
family-specific app resource-set fields.

The next slice should stay in the same route-contract area rather than jumping
back to another browser fixture.

## Candidates

### Material Route / Prepared-Resource Candidate

Add the same family-specific resource-set absence assertion to route-failure app
diagnostics summaries.

Pros:

- Complements the successful scalar StandardMaterial route regression.
- Covers the app route failure surface where `materialQueueRoute` is reported
  without successful routed resources.
- Keeps route traversal and prepared resources unchanged.

Cons:

- Test-only contract pin; no runtime behavior changes expected.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another narrow StandardMaterial browser fixture.

Pros:

- Continues glTF coverage.

Cons:

- Recent work already added emissive-factor browser coverage.
- Route shape still benefits from one matching failure-path assertion.

Decision: defer.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after scalar route shape coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1599`.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1602 — Pin route-failure summary field shape

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts`.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
the `task-1597` implementation, and the unsupported material queue family app
route test.

Acceptance criteria:

- Extend the unsupported material queue family app route test to assert route
  failure diagnostics use `materialQueueRoute`.
- Assert the route failure diagnostics summary does not expose
  `standardResourceSet`, `unlitResourceSet`, or `matcapResourceSet`.
- Do not change route traversal, prepared resources, app report JSON shape,
  shader behavior, binary GLB loading, IBL, shadows, or non-built-in rendering.

## Next Step

Run `task-1601` to audit this selected follow-up before implementation.
