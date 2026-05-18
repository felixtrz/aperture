# Valid Non-Default glTF Sampler Mapping Plan Audit

Date: 2026-05-18

Task: `task-1558`

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_DIAGNOSTICS_NAMING_AUDIT_PLAN_2026_05_18.md`:
add browser coverage for a valid non-default glTF sampler mapping.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_DIAGNOSTICS_NAMING_AUDIT_PLAN_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Assessment

The selected follow-up is concrete enough for one focused implementation run:

- It has a narrow write scope: the existing glTF texture browser fixture and its
  Playwright test.
- It targets a documented fidelity gap: sampler behavior is called out in the
  medium/long-term goals, and existing browser tests mostly cover default,
  invalid, and unavailable sampler states.
- It can preserve ECS authority because sampler assets remain source assets and
  WebGPU sampler resources remain derived/prepared renderer state.
- It can preserve the render extraction boundary because the fixture only
  verifies extracted/prepared status and rendered output, not renderer-owned ECS
  state.
- It can keep diagnostics JSON-safe by extending the existing status assertions
  that omit raw GPU handles from sampler mapping and prepared resource reports.

## Risk Check

- A visual repeat/wrap proof could grow if it requires new UV geometry or
  texture content. Keep `task-1561` scoped to source enum, mapped sampler,
  resource creation, draw submission, and JSON-safety unless the existing
  fixture makes a visual proof trivial.
- Do not add a public sampler API or route compatibility helper as part of this
  task.
- Do not pull in IBL, shadows, binary GLB loading, broad PBR, or non-built-in
  app rendering.

## Recommendation

Proceed with `task-1561` after tracker/backlog alignment. The acceptance
criteria are well bounded and align with Aperture's ECS-authoritative,
WebGPU-only architecture.
