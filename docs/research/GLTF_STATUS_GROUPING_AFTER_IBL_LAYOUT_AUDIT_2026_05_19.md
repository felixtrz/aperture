# GLTF Status Grouping After IBL Layout Audit — 2026-05-19

## Task

Completed `task-1840`: audit GLTF scene status grouping after adding
`ibl.bindGroupLayout`.

## References

- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `docs/research/GLTF_LIVE_RESOURCE_STATUS_GROWTH_AUDIT_2026_05_19.md`
- Decision 0009, no steady-state render hot-path allocations.

## Findings

The GLTF scene status remains navigable because the high-level
`readiness.ibl.phases` and `readiness.shadow.phases` groups now expose the
important state transitions:

- IBL descriptors and preparation are present.
- Diffuse texture and sampler resources are live.
- IBL bind-group layout metadata is planned but deferred.
- IBL shader binding, pipeline-key, and shader sampling remain deferred.
- Shadow depth resources are live.
- Shadow matrix upload, pass submission, and shader sampling remain deferred.

The detailed `ibl.*` and `shadow.*` reports are still useful for tests because
they each guard a concrete contract added in the last few runs. Removing them
now would reduce observability while the bind-group/resource/shader chain is
still incomplete.

## Cleanup Trigger

Do not add a cleanup task yet. Add one when either of these lands:

- IBL bind-group resource creation; or
- shadow matrix computation plus buffer allocation/upload.

At that point, detailed fields that only repeat top-level summary state should
move behind compact summary assertions in the e2e test.

## Deferred

- No GLTF status shape cleanup is required immediately.
- Keep current detailed reports until replacement summaries cover the same
  readiness contracts.
