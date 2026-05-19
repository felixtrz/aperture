# Custom Material Source Validation Docs Implementation Audit

Date: 2026-05-19

Task: `task-1729`

## Scope

Audit the `task-1728` diagnostics docs update.

Reference files inspected:

- `docs/research/NEXT_PACKAGE_VALIDATOR_OR_GLTF_AFTER_TEST_FIXTURE_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DOCS_PLAN_AUDIT_2026_05_19.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/DECISIONS.md` Decision 0012
- `test/materials/custom-material-source-validation-fixture.test.ts`

## Findings

- Added a `Custom Material Source Validation` section to
  `docs/DIAGNOSTICS_SUMMARIES.md`.
- The section defines `customMaterialSource.*` as source-shape diagnostics and
  separates them from route, app, dependency readiness, preparation,
  frame-resource, pipeline, and WebGPU resource diagnostics.
- It documents JSON-safe payload limits and explicitly bans full source objects,
  source payload bytes, raw WebGPU handles, callbacks, adapter instances,
  caches, worlds, typed arrays, and live backend objects.
- It references the current executable guardrail as test-only and states that
  public `CustomMaterialAsset` types, package validators, app-owned adapter
  facades, shader loading, prepared-resource adapters, rendered custom
  families, IBL, shadows, and binary GLB loading remain deferred.
- No runtime code, package exports, public API shape, app facade option, shader,
  prepared-resource adapter, browser fixture, or renderer behavior changed.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Proceed to tracker/backlog alignment. After this docs boundary is recorded,
returning to a StandardMaterial/glTF fidelity slice is reasonable unless the
next run deliberately accepts a package-level source validator shape first.
