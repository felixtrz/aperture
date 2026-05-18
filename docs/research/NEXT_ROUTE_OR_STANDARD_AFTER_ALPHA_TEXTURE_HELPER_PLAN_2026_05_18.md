# Next Route Or StandardMaterial Follow-Up After Alpha Texture Helper Plan - 2026-05-18

## Scope

Select the next focused task after the alpha texture browser pixel assertion
helper cleanup.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/ALPHA_TEXTURE_BROWSER_PIXEL_ASSERTION_HELPER_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_TEXTURE_HELPER_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Candidate A - Material Route Architecture

Generalize the app material queue route report bridge so failure diagnostics can
serialize routed items through the family-agnostic `QueuedMaterialAppResourceItem`
contract.

Why now:

- Recent work made the app resource item and set contracts generic.
- `collectQueuedBuiltInAppResourceSet()` still owns routed-item report
  serialization through a built-in-specific helper.
- A generic report bridge is a small step toward real app-level non-built-in
  material routing without adding a fake renderer path.

Risks:

- The task should avoid rewriting the collector or changing app route behavior.
- Built-in diagnostics must keep their current JSON shape and messages.

Validation shape:

- Targeted route-report/resource-set tests.
- `pnpm run typecheck:test`.

## Candidate B - StandardMaterial/glTF Fidelity

Add another combined StandardMaterial browser fixture, such as double-sided
alpha-mask plus emissive or transformed emissive UV coverage.

Why not next:

- Browser fidelity coverage is now broad enough for the current texture
  combinations.
- The architecture backlog still carries more risk from built-in-specific app
  route contracts than from one missing fixture combination.

## Candidate C - Diagnostics/Tooling

Add a tracker-only or audit-only slice to summarize the alpha texture helper and
latest route contracts.

Why not next:

- The tracker is already aligned for the last feature-level browser fixture.
- Another documentation-only task would not advance the material route spine.

## Selected Follow-Up

Select the material route architecture slice: generalize app material queue route
report routed-item serialization.

Proposed task:

```md
### task-1474 — Generalize app route report routed-item serialization

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a family-agnostic helper that serializes a `QueuedMaterialAppResourceItem`
  into the JSON-safe routed-item shape used by app material queue route reports.
- Use the helper from the built-in app resource set route failure diagnostic.
- Add or update tests with a test-only non-built-in item to prove the helper
  does not require built-in material fields or GPU handles.
- Preserve existing built-in route diagnostic JSON shape and app behavior.
```

## Notes

This task deliberately stops short of implementing app-level custom material
rendering. It only removes another built-in-specific diagnostic bridge from the
route-contract path.
