# Non-Built-In App Material Adapter Decomposition Audit

Date: 2026-05-18

Task: `task-1643`

## Scope

Audit
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

## Findings

- The decomposition keeps `MaterialKind` closed and does not treat arbitrary
  route family strings as public source material assets.
- The slices are ordered from test/design contract checks toward a later public
  custom material source API decision and only then a rendered proof.
- Each slice includes package/write-scope, diagnostics, tests, and non-goals.
- The recommended next slice, a generic app adapter contract audit, is small
  enough for a future focused run and does not require runtime rendering.

## Boundary Check

- Documentation only; no runtime code, public API, shader code, examples,
  browser fixtures, dependencies, or package boundaries changed.
- ECS authority, render extraction, renderer-owned GPU resources, WebGPU-only
  backend ownership, and JSON-safe diagnostics are preserved.
- No decision record is required yet because the decomposition defers the public
  custom material source API decision to a later explicit task.

## Validation

- Covered by final `pnpm run format:check` and broad validation.

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should use this
decomposition as a reference and strongly consider selecting the generic app
adapter contract audit as the next route-focused design slice.
