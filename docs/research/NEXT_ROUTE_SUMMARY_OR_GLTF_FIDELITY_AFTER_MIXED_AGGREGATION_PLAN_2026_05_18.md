# Next Route Summary Or glTF Fidelity After Mixed Aggregation Plan

Date: 2026-05-18

## Scope

Select the next narrow slice after mixed-family route summary aggregation
coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MIXED_FAMILY_ROUTE_SUMMARY_AGGREGATION_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`

## Candidates Compared

### Route summary diagnostic-code sorting regression

Add a unit test with deliberately unsorted diagnostic codes across prepare and
frame-resource summaries. Assert stage-level and group-level code maps are
sorted deterministically and duplicate codes merge correctly.

Why this is preferred:

- It locks down JSON determinism for agent-readable diagnostics.
- It stays on the route-summary surface already changed in this run.
- It does not imply app-level non-built-in route migration or new material
  behavior.

### Narrow app-status route diagnostic

Expose another route summary detail through app status.

Why this is deferred:

- App status is closer to public behavior and should wait until the route
  summary unit surface has deterministic mixed/diagnostic aggregation coverage.

### StandardMaterial/glTF fidelity diagnostic

Return to source-side glTF material diagnostic coverage.

Why this is deferred for this slice:

- The recent diagnostic cluster already expanded invalid glTF render-state,
  unresolved texture-binding, invalid texture-info, and invalid-source no-work
  browser coverage. The route-summary deterministic-code slice is smaller and
  directly follows the current route aggregation work.

## Selected Follow-Up

Select `task-1279 — Add route summary diagnostic-code sorting regression`.

The slice should:

- build route summaries with unsorted diagnostic codes in both prepare and
  frame-resource stages;
- assert deterministic sorted `byCode` maps at stage and group levels;
- assert duplicate diagnostic codes merge correctly across stages;
- keep JSON output free of raw facade/backend resource keys and GPU handles;
- avoid app-level non-built-in rendering, shader behavior, WebGPU uploads, IBL,
  shadows, binary GLB loading, GLB viewer behavior, and public material-family
  API changes.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
