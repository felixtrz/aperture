# GLTF Status Compaction After Matrix Computation Plan — 2026-05-19

## Task

Completed `task-1846`: decide whether the GLTF scene status should be compacted
after computed shadow matrices and StandardMaterial IBL/shadow layout metadata
landed.

## Reference Anchors

- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `docs/research/GLTF_STATUS_GROUPING_AFTER_IBL_LAYOUT_AUDIT_2026_05_19.md`
- `packages/webgpu/src/webgpu/directional-shadow-matrix-computation.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`

## Findings

The status payload is large, but still serving a concrete purpose.

- `readiness.ibl.phases` and `readiness.shadow.phases` provide the compact
  dashboard-level status needed for quick checks.
- The detailed `ibl.*` and `shadow.*` sections still guard active contracts that
  do not yet have replacement resource summaries:
  - group 4 IBL layout metadata;
  - group 5 shadow layout metadata;
  - computed directional shadow matrices;
  - deferred shadow matrix buffer upload;
  - deferred command encoding; and
  - deferred IBL/shadow shader sampling.
- The e2e assertions are verbose, but they catch misplaced status fields and
  JSON-safety regressions while the GLTF scene path is still the primary proof
  target.

Do not compact the public GLTF status object yet.

## Selected Follow-Up

After group 4 IBL descriptor planning lands, add one targeted compaction/audit
task if the e2e assertion grows again. That task should prefer test assertion
cleanup over runtime status deletion unless the new descriptor plan is fully
covered by compact summaries.

Suggested cleanup:

- keep the runtime `readiness.*.phases` groups;
- keep detailed runtime sections for newly added resource contracts;
- replace repeated test assertions with shared expected fragments for IBL and
  shadow layout metadata; and
- preserve JSON-safe checks for every live-resource report.

## Deferred

- Removing `ibl.bindGroupLayout` or `shadow.bindGroupLayout` from status.
- Removing computed `shadow.matrixComputation` details before matrix upload
  consumes them.
- Folding detailed IBL/shadow sections into summaries before bind-group
  descriptors, live bind groups, and shader sampling have landed.
