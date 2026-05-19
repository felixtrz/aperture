# GLTF Live Resource Status Growth Audit — 2026-05-19

## Task

Completed `task-1836`: audit GLTF scene status shape after live IBL sampler,
diffuse IBL texture, shadow depth texture, and compact summary reports were
added.

## References

- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `docs/ARCHITECTURE.md`
- Decision 0009, no steady-state render hot-path allocations.

## Findings

The status remains navigable because the high-level `readiness` object groups
IBL and shadow progress into phase names, while detailed reports stay under
`ibl.*` and `shadow.*`.

The detailed live-resource path is now clear:

- IBL:
  - `ibl.diffuseTextureResource`;
  - `ibl.samplerResources`;
  - `ibl.diffuseResourceSummary`.
- Shadow:
  - `shadow.textures` for descriptor planning;
  - `shadow.depthTextureResources` for live depth texture/view allocation;
  - `shadow.depthResourceSummary` for compact deferred-stage status;
  - `shadow.resourceSummary` for command-resource planning.

No raw WebGPU handles are exposed by the JSON helpers or e2e status assertions.
The live resources remain renderer-owned and derived from extracted/planned
state rather than ECS-owned state.

## Status Growth Risk

The GLTF scene status is becoming a broad integration dashboard. That is useful
for the current vertical slice, but the detailed reports are starting to repeat
the same readiness concepts:

- descriptor readiness;
- live resource allocation;
- pass/submission readiness;
- shader sampling readiness.

For now, keeping both details and summaries is acceptable because each report
guards a newly added contract. Once IBL/shadow bind-group layout work lands,
the example should prefer compact summaries for top-level inspection and keep
detailed reports only for fields that have active tests or unblock the next
pipeline step.

## Recommended Follow-Up

After the IBL layout metadata task, add a small status-grouping cleanup if the
GLTF scene status adds another detailed IBL or shadow report. The cleanup should
not remove current tests until replacement summary assertions cover the same
contracts.
