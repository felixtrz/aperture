# Next Route Or StandardMaterial Follow-Up After Source Asset Index Helper Plan - 2026-05-18

## Scope

Select the next focused follow-up after extracting generic queued source asset
indexing from the built-in collector.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/QUEUED_SOURCE_ASSET_INDEX_HELPER_EXTRACTION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-source-assets.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidate A - Material Route Architecture

Continue extracting generic route traversal or app resource item creation from
the built-in collector.

Why not next:

- The obvious small generic helper seams now have coverage: route report
  builder, route diagnostic normalizer, and source asset indexing.
- The remaining route traversal mixes adapter lookup, built-in compatibility
  diagnostics, and app resource item creation. Extracting it now would be a
  broader collector rewrite and should wait for another concrete non-built-in
  app rendering requirement.

## Candidate B - StandardMaterial/glTF Fidelity

Audit remaining StandardMaterial/glTF texture and render-state coverage gaps
after the recent combined texture fixtures.

Why now:

- Recent runs added broad combined browser coverage, but the backlog has stayed
  focused on route architecture cleanup for several tasks.
- A focused audit can decide the next fidelity slice without guessing: sampler
  edge behavior, texture transform coverage gaps, alpha/double-sided variants,
  unsupported extension diagnostics, or dependency/readiness gaps.
- Returning to fidelity work now exercises the generic route helper spine
  through user-facing browser fixtures.

Risks:

- The audit should not balloon into a full PBR roadmap. It should pick one
  browser-verifiable slice.

## Candidate C - Diagnostics/Tooling

Write a summary document of the route helper extractions completed in this run.

Why not next:

- Handoff and tracker already capture the route helper cleanup.
- The higher leverage next step is to use the cleaned route path to choose the
  next StandardMaterial/glTF fidelity slice.

## Selected Follow-Up

Select Candidate B: audit remaining StandardMaterial/glTF fidelity gaps and
recommend one browser-verifiable follow-up.

Proposed task:

```md
### task-1514 — Audit remaining StandardMaterial glTF fidelity gaps after route helper cleanup

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and recent StandardMaterial/glTF browser coverage audits.

Acceptance criteria:

- Inventory the remaining near-term StandardMaterial/glTF fidelity gaps visible
  from current examples/tests and medium-term goals.
- Compare at least three candidate browser-verifiable slices.
- Recommend exactly one next implementation task with category,
  package/write-scope, reference anchor, and acceptance criteria.
- Keep IBL, shadows, binary GLB loading, and app-level non-built-in rendering
  deferred unless the audit finds a direct blocker.
```

## Notes

This does not abandon route architecture cleanup. It pauses further collector
genericization because the next route extraction would be broader than the
helper slices completed in this run.
